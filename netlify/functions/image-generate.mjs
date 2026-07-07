// Fountain DAM — AI image generation via Google Gemini 2.5 Flash Image ("Nano
// Banana"). Takes a real product image from the library (so the product stays
// truthful) plus a scene prompt, and returns a composited graphic. Can save the
// result straight back into the asset library.
//
// Needs GEMINI_API_KEY (from https://aistudio.google.com/apikey) on the site.
// Auth: contributor role (same as uploading) — generation writes to the library.
import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, q, publicUrl, storagePut } from './_shared/supabase.mjs';

const MODEL = 'gemini-2.5-flash-image';
const GEMINI_URL = (key) => `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
const isType = (t) => typeof t === 'string' && /^[a-z0-9-]{1,40}$/.test(t);
const isBrand = (b) => typeof b === 'string' && /^[a-z0-9-]{1,48}$/.test(b);
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function safeSeg(v, fallback) {
  const c = String(v || '').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return c || fallback;
}

// Fetch an image URL and return { mime, base64 }.
async function fetchImageBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch source image (${res.status})`);
  const mime = res.headers.get('content-type') || 'image/png';
  const buf = Buffer.from(await res.arrayBuffer());
  return { mime, base64: buf.toString('base64') };
}

async function resolveSource(payload) {
  if (payload.assetId) {
    const rows = await db('GET', `assets?id=eq.${q(payload.assetId)}&select=id,storage_path,brand,title,filename`);
    if (!rows[0]) throw new Error('source asset not found');
    return { url: publicUrl(rows[0].storage_path), brand: rows[0].brand, title: rows[0].title || rows[0].filename };
  }
  if (payload.imageUrl && /^https?:\/\//i.test(payload.imageUrl)) return { url: payload.imageUrl, brand: null, title: null };
  return null;
}

// Ensure a tag exists + link it (mirrors the on_conflict-safe pattern used elsewhere).
async function tagAsset(assetId, name) {
  const clean = String(name || '').trim().toLowerCase();
  if (!clean) return;
  await db('POST', 'tags?on_conflict=name', { body: [{ name: clean }], prefer: 'resolution=merge-duplicates,return=minimal' });
  const tagRow = (await db('GET', `tags?name=eq.${q(clean)}&select=id`))[0];
  if (tagRow) await db('POST', 'asset_tags?on_conflict=asset_id,tag_id', { body: [{ asset_id: assetId, tag_id: tagRow.id }], prefer: 'resolution=merge-duplicates,return=minimal' });
}

// Store a base64 image into the library and return the created asset.
async function saveImage(base64, mime, payload, source) {
  const ext = EXT[mime] || 'png';
  const brand = isBrand(payload.brand) ? payload.brand : (isBrand(source?.brand) ? source.brand : 'shared');
  const type = isType(payload.type) ? payload.type : 'hero';
  const title = String(payload.title || (source?.title ? `${source.title} — scene` : 'AI scene')).slice(0, 160);
  const filename = `${safeSeg(title, 'ai-scene')}.${ext}`;
  const path = `ai/${Date.now()}-${safeSeg(title, 'scene')}.${ext}`;
  await storagePut(path, Buffer.from(base64, 'base64'), mime);
  const rows = await db('POST', 'assets', {
    body: { storage_path: path, filename, title, content_type: mime, type, brand, status: 'approved' },
    prefer: 'return=representation',
  });
  const asset = rows[0];
  await tagAsset(asset.id, 'ai-generated');
  return { id: asset.id, title, brand, type, url: publicUrl(path) };
}

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  if (event.httpMethod !== 'POST') return json({ error: 'POST only' }, 405);

  // Two ways in: a DAM contributor's JWT (in-app AI Studio) OR the static
  // DAM_API_TOKEN (external tools like a Framer component). Token path lets
  // trusted sites generate — see the abuse caveat in the API docs page.
  const apiToken = process.env.DAM_API_TOKEN;
  const hdr = event.headers?.authorization || event.headers?.Authorization || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(String(hdr).trim())?.[1] || event.queryStringParameters?.key || '';
  if (!(apiToken && bearer === apiToken)) {
    const auth = await requireRole(event, 'contributor');
    if (!auth.ok) return json({ error: auth.error }, auth.status);
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return json({ error: 'invalid JSON' }, 400); }

  // Persist-only: save an image the client already previewed (no regeneration).
  if (payload.persist && payload.imageData) {
    try {
      const mime = payload.mime || 'image/png';
      const base64 = String(payload.imageData).replace(/^data:[^;]+;base64,/, '');
      const source = await resolveSource(payload);
      const asset = await saveImage(base64, mime, payload, source);
      return json({ saved: true, asset });
    } catch (e) {
      console.error('image-generate persist error', e);
      return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
    }
  }

  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
  if (!key) return json({ error: 'GEMINI_API_KEY is not configured on this site.' }, 503);

  const prompt = String(payload.prompt || '').trim();
  if (!prompt) return json({ error: 'prompt is required' }, 400);

  try {
    const source = await resolveSource(payload);
    const parts = [];
    if (source) {
      const img = await fetchImageBase64(source.url);
      parts.push({ inline_data: { mime_type: img.mime, data: img.base64 } });
      // Nudge the model to preserve the real product exactly.
      parts.push({ text: `Use the provided product image EXACTLY as-is — do not redraw, relabel, or alter the product, its packaging, or text. Composite it into this scene: ${prompt}` });
    } else {
      parts.push({ text: prompt });
    }

    const res = await fetch(GEMINI_URL(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `Gemini error ${res.status}`;
      return json({ error: msg }, res.status >= 500 ? 502 : 400);
    }

    const outParts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = outParts.find((p) => p.inline_data?.data || p.inlineData?.data);
    const inline = imgPart?.inline_data || imgPart?.inlineData;
    if (!inline?.data) {
      const textMsg = outParts.map((p) => p.text).filter(Boolean).join(' ').slice(0, 300);
      return json({ error: `Model returned no image${textMsg ? `: ${textMsg}` : '.'}` }, 502);
    }
    const mime = inline.mime_type || inline.mimeType || 'image/png';
    const dataUrl = `data:${mime};base64,${inline.data}`;

    // Optionally persist into the library right away.
    if (payload.save) {
      const asset = await saveImage(inline.data, mime, payload, source);
      return json({ image: dataUrl, saved: true, asset });
    }

    return json({ image: dataUrl, saved: false });
  } catch (e) {
    console.error('image-generate error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
