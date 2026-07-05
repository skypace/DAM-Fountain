import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, q, publicUrl } from './_shared/supabase.mjs';

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = 'claude-haiku-4-5-20251001';
const isImg = (p) => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(p || '');

async function resolveTagIds(names) {
  const clean = [...new Set((names || []).map((n) => String(n).trim().toLowerCase()).filter(Boolean))].slice(0, 12);
  if (!clean.length) return [];
  await db('POST', 'tags', { body: clean.map((name) => ({ name })), prefer: 'resolution=merge-duplicates,return=minimal' });
  const rows = await db('GET', `tags?select=id,name&name=in.(${clean.map((n) => `"${n.replace(/"/g, '')}"`).join(',')})`);
  return rows.map((r) => r.id);
}

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  if (event.httpMethod !== 'POST') return json({ error: 'method not allowed' }, 405);
  const auth = await requireRole(event, 'contributor');
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  if (!ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_API_KEY is not set on this site.' }, 501);

  try {
    const { assetId } = JSON.parse(event.body || '{}');
    if (!assetId) return json({ error: 'assetId required' }, 400);
    const rows = await db('GET', `assets?id=eq.${q(assetId)}&select=*`);
    const asset = rows[0];
    if (!asset) return json({ error: 'not found' }, 404);
    if (!isImg(asset.storage_path)) return json({ error: 'AI tagging currently supports image assets only.' }, 400);

    const prompt = 'You are cataloguing a beverage-brand marketing asset for a digital asset library (Alameda Soda + Brix Beverage). '
      + 'Reply with ONLY minified JSON, no prose, in the form {"tags":["..."],"description":"..."}. '
      + 'tags = 5-10 short lowercase keywords describing the visible subject, product, packaging, colors, and setting. '
      + 'description = one concise sentence usable as alt text.';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'url', url: publicUrl(asset.storage_path) } },
          { type: 'text', text: prompt },
        ] }],
      }),
    });
    if (!res.ok) return json({ error: `AI request failed (${res.status}): ${(await res.text()).slice(0, 200)}` }, 502);
    const data = await res.json();
    const text = (data.content || []).map((c) => c.text || '').join('').trim();
    let parsed;
    try { parsed = JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()); } catch { return json({ error: 'AI returned an unparseable response.' }, 502); }
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean) : [];
    const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';

    // Apply: merge tags; set description only if the asset has none.
    const tagIds = await resolveTagIds(tags);
    if (tagIds.length) await db('POST', 'asset_tags', { body: tagIds.map((tag_id) => ({ asset_id: assetId, tag_id })), prefer: 'resolution=merge-duplicates,return=minimal' });
    if (description && !asset.description) {
      await db('PATCH', `assets?id=eq.${q(assetId)}`, { body: { description, updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
    }
    return json({ ok: true, tags, description });
  } catch (e) {
    console.error('ai-tag error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
