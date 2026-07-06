import { db, q, publicUrl } from './_shared/supabase.mjs';

// Batch AI-tagger. Runs on a schedule (ongoing coverage for new uploads) and is
// also HTTP-callable so a backfill can be driven to completion. For each image
// with no description yet, Claude vision produces keywords + alt text.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = 'claude-haiku-4-5-20251001';
const PROMPT = 'You are cataloguing a beverage-brand marketing asset for a digital asset library (Alameda Soda + Brix Beverage). '
  + 'Reply with ONLY minified JSON, no prose, in the form {"tags":["..."],"description":"..."}. '
  + 'tags = 5-10 short lowercase keywords describing the visible subject, product, packaging, colors, and setting. '
  + 'description = one concise sentence usable as alt text.';

async function resolveTagIds(names) {
  const clean = [...new Set((names || []).map((n) => String(n).trim().toLowerCase()).filter(Boolean))].slice(0, 12);
  if (!clean.length) return [];
  await db('POST', 'tags', { body: clean.map((name) => ({ name })), prefer: 'resolution=merge-duplicates,return=minimal' });
  const rows = await db('GET', `tags?select=id,name&name=in.(${clean.map((n) => `"${n.replace(/"/g, '')}"`).join(',')})`);
  return rows.map((r) => r.id);
}

async function tagOne(asset) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 400,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'url', url: publicUrl(asset.storage_path) } },
        { type: 'text', text: PROMPT },
      ] }],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || '').join('').trim();
  const parsed = JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
  const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
  const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
  const tagIds = await resolveTagIds(tags);
  if (tagIds.length) await db('POST', 'asset_tags', { body: tagIds.map((tag_id) => ({ asset_id: asset.id, tag_id })), prefer: 'resolution=merge-duplicates,return=minimal' });
  // Always stamp a description so the row is not re-picked (fallback if blank).
  await db('PATCH', `assets?id=eq.${q(asset.id)}`, { body: { description: description || asset.filename || 'asset', updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
}

export async function handler(event) {
  if (!ANTHROPIC_KEY) return { statusCode: 501, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) };
  const started = Date.now();
  const limit = Math.min(parseInt(event?.queryStringParameters?.limit || '10', 10) || 10, 20);
  let processed = 0, failed = 0;
  try {
    const rows = await db('GET', `assets?select=id,storage_path,filename&content_type=like.image/*&or=(description.is.null,description.eq.)&order=created_at.asc&limit=${limit}`);
    for (const a of rows) {
      if (Date.now() - started > 22000) break; // stay under the function timeout
      try { await tagOne(a); processed++; } catch { failed++; }
    }
    // Rough remaining count for the caller's progress loop.
    const rem = await db('GET', 'assets?select=id&content_type=like.image/*&or=(description.is.null,description.eq.)&limit=1000');
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ processed, failed, remaining: rem.length }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e instanceof Error ? e.message : String(e), processed, failed }) };
  }
}
