import { db, q, publicUrl, SUPABASE_URL, BUCKET } from './_shared/supabase.mjs';

// Batch AI-tagger. Runs on a schedule (ongoing coverage for new uploads) and is
// also HTTP-callable so a backfill can be driven to completion. For each image
// with no description yet, Claude vision produces keywords + alt text.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = 'claude-haiku-4-5-20251001';
const PROMPT = 'You are cataloguing a beverage-brand marketing asset for a digital asset library (Alameda Soda + Brix Beverage). '
  + 'Reply with ONLY minified JSON, no prose, in the form {"tags":["..."],"description":"..."}. '
  + 'tags = 5-10 short lowercase keywords describing the visible subject, product, packaging, colors, and setting. '
  + 'description = one concise sentence usable as alt text.';

// Anthropic vision accepts raster formats and caps images at ~5MB, so large
// hi-res art fails on the raw public URL. Route png/jpg/webp through Supabase's
// on-the-fly image render (resized) to stay well under the limit.
const RENDERABLE = /\.(png|jpe?g|webp)(\?|#|$)/i;
const VISION_OK = /\.(png|jpe?g|gif|webp)(\?|#|$)/i;
function sourceUrl(storagePath) {
  const clean = String(storagePath || '').replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  if (RENDERABLE.test(storagePath)) return `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/${clean}?width=1400&quality=78&resize=contain`;
  return publicUrl(storagePath);
}

async function resolveTagIds(names) {
  const clean = [...new Set((names || []).map((n) => String(n).trim().toLowerCase()).filter(Boolean))].slice(0, 12);
  if (!clean.length) return [];
  await db('POST', 'tags?on_conflict=name', { body: clean.map((name) => ({ name })), prefer: 'resolution=merge-duplicates,return=minimal' });
  const rows = await db('GET', `tags?select=id,name&name=in.(${clean.map((n) => `"${n.replace(/"/g, '')}"`).join(',')})`);
  return rows.map((r) => r.id);
}

async function markFallback(asset) {
  await db('PATCH', `assets?id=eq.${q(asset.id)}`, { body: { description: asset.filename || 'asset', updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
}

async function tagOne(asset) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 400,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'url', url: sourceUrl(asset.storage_path) } },
        { type: 'text', text: PROMPT },
      ] }],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || '').join('').trim();
  const parsed = JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
  const tags = Array.isArray(parsed.tags) ? parsed.tags : [];
  const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
  const tagIds = await resolveTagIds(tags);
  if (tagIds.length) await db('POST', 'asset_tags?on_conflict=asset_id,tag_id', { body: tagIds.map((tag_id) => ({ asset_id: asset.id, tag_id })), prefer: 'resolution=merge-duplicates,return=minimal' });
  await db('PATCH', `assets?id=eq.${q(asset.id)}`, { body: { description: description || asset.filename || 'asset', updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
}

export async function handler(event) {
  if (!ANTHROPIC_KEY) return { statusCode: 501, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }) };
  const started = Date.now();
  const debug = event?.queryStringParameters?.debug === '1';
  const limit = debug ? 2 : Math.min(parseInt(event?.queryStringParameters?.limit || '10', 10) || 10, 20);
  let processed = 0, failed = 0, skipped = 0;
  const errors = [];
  try {
    const rows = await db('GET', `assets?select=id,storage_path,filename&content_type=like.image/*&or=(description.is.null,description.eq.)&order=created_at.asc&limit=${limit}`);
    for (const a of rows) {
      if (Date.now() - started > 22000) break;
      // Formats vision can't read at all (svg/tiff/heic/avif/bmp) — mark so they
      // leave the queue. AI failures are NOT marked, so they can be retried.
      if (!VISION_OK.test(a.storage_path)) { try { await markFallback(a); } catch { /* ignore */ } skipped++; continue; }
      try { await tagOne(a); processed++; }
      catch (e) { failed++; if (errors.length < 3) errors.push(`${a.filename}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    const rem = await db('GET', 'assets?select=id&content_type=like.image/*&or=(description.is.null,description.eq.)&limit=2000');
    return { statusCode: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ processed, skipped, failed, remaining: rem.length, ...(errors.length ? { errors } : {}) }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e instanceof Error ? e.message : String(e), processed, failed }) };
  }
}
