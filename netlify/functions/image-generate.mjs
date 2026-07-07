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
  const id = payload.assetId || (Array.isArray(payload.assetIds) && payload.assetIds[0]);
  if (id) {
    const rows = await db('GET', `assets?id=eq.${q(id)}&select=id,storage_path,brand,title,filename`);
    if (rows[0]) return { url: publicUrl(rows[0].storage_path), brand: rows[0].brand, title: rows[0].title || rows[0].filename };
  }
  if (payload.imageUrl && /^https?:\/\//i.test(payload.imageUrl)) return { url: payload.imageUrl, brand: null, title: null };
  return null;
}

// Downscale a Supabase public object URL via the on-the-fly render endpoint so
// reference images don't blow past Gemini's inline payload limit.
function rendered(url, width) {
  if (typeof url === 'string' && url.includes('/storage/v1/object/public/')) {
    const base = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    return `${base}${base.includes('?') ? '&' : '?'}width=${width}&quality=82&resize=contain`;
  }
  return url;
}

// Collect every reference image the caller wants merged: an uploaded photo, one
// or more DAM assets (assetIds / assetId), and any raw imageUrls. Capped so the
// request stays under Gemini's inline size ceiling.
async function gatherReferences(payload) {
  const refs = [];
  let primaryBrand = null, primaryTitle = null;

  if (payload.uploadData) {
    refs.push({ mime: payload.uploadMime || 'image/png', base64: String(payload.uploadData).replace(/^data:[^;]+;base64,/, '') });
  }
  const ids = [...new Set((Array.isArray(payload.assetIds) ? payload.assetIds : (payload.assetId ? [payload.assetId] : [])).filter(Boolean))].slice(0, 6);
  if (ids.length) {
    const rows = await db('GET', `assets?id=in.(${ids.map(q).join(',')})&select=id,storage_path,brand,title,filename`);
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const id of ids) {
      const r = byId.get(id); if (!r) continue;
      refs.push(await fetchImageBase64(rendered(publicUrl(r.storage_path), 1024)));
      if (!primaryBrand) { primaryBrand = r.brand; primaryTitle = r.title || r.filename; }
    }
  }
  for (const u of (Array.isArray(payload.imageUrls) ? payload.imageUrls : []).slice(0, 4)) {
    if (/^https?:\/\//i.test(u)) refs.push(await fetchImageBase64(rendered(u, 1024)));
  }
  return { refs: refs.slice(0, 6), primaryBrand, primaryTitle };
}

// A few representative images of a brand so the model matches its look.
async function brandIdentityImages(brand, limit = 3) {
  if (!isBrand(brand) || limit < 1) return [];
  const rows = await db('GET', `assets?brand=eq.${q(brand)}&deleted_at=is.null&content_type=ilike.image/*&select=storage_path,type&limit=24`);
  const pick = [];
  for (const t of ['logo', 'hero', 'can', 'equipment', 'other']) {
    const r = rows.find((x) => x.type === t && !pick.includes(x));
    if (r && pick.length < limit) pick.push(r);
  }
  for (const r of rows) { if (pick.length >= limit) break; if (!pick.includes(r)) pick.push(r); }
  const out = [];
  for (const r of pick.slice(0, limit)) out.push(await fetchImageBase64(rendered(publicUrl(r.storage_path), 640)));
  return out;
}

// Turn a brand's guidelines doc into a compact instruction (colors + fonts + tone).
async function brandStyleText(brand) {
  if (!isBrand(brand)) return '';
  const [glRow, brandRow] = await Promise.all([
    db('GET', `brand_guidelines?brand=eq.${q(brand)}&select=doc`).then((r) => r[0]).catch(() => null),
    db('GET', `brands?slug=eq.${q(brand)}&select=label`).then((r) => r[0]).catch(() => null),
  ]);
  const doc = glRow?.doc || {};
  const out = [`Brand: ${brandRow?.label || brand}.`];
  const colors = (doc.colors || [])
    .map((c) => [c.name, c.hex, c.pantone && `Pantone ${c.pantone}`, c.cmyk && `CMYK ${c.cmyk}`].filter(Boolean).join(' '))
    .filter(Boolean);
  if (colors.length) out.push(`Stay on-brand — use these brand colors where color is applied: ${colors.join('; ')}.`);
  const fonts = (doc.fonts || []).map((f) => f.name || f.label).filter(Boolean);
  if (fonts.length) out.push(`Typography feel: ${fonts.join(', ')}.`);
  const tone = doc.tone || (doc.sections || []).map((s) => s.body || s.text).filter(Boolean).join(' ');
  if (tone) out.push(`Brand tone/aesthetic: ${String(tone).slice(0, 400)}.`);
  return out.join(' ');
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
    const { refs, primaryBrand, primaryTitle } = await gatherReferences(payload);
    const brandSlug = isBrand(payload.brand) ? payload.brand : primaryBrand;
    const identityImgs = payload.useBrandImages && brandSlug
      ? await brandIdentityImages(brandSlug, Math.min(Number(payload.brandImageCount) || 3, 4))
      : [];
    const styleText = payload.useBrandGuidelines && brandSlug ? await brandStyleText(brandSlug) : '';
    const source = { brand: brandSlug || null, title: primaryTitle || null };

    const parts = [];
    for (const r of refs) parts.push({ inline_data: { mime_type: r.mime, data: r.base64 } });
    for (const r of identityImgs) parts.push({ inline_data: { mime_type: r.mime, data: r.base64 } });

    const instruction = [
      refs.length
        ? `You are given ${refs.length} product/reference image(s)${identityImgs.length ? ` plus ${identityImgs.length} brand-style reference(s)` : ''}. Keep every product, label, and logo EXACTLY as-is — do not redraw, relabel, distort, or change any packaging or text.`
        : '',
      refs.length > 1 ? 'Merge the provided images into one cohesive, believable composition.' : '',
      identityImgs.length ? 'Match the visual identity — color palette, lighting, and mood — shown in the brand-style reference images.' : '',
      styleText,
      `Scene / instruction: ${prompt}`,
    ].filter(Boolean).join('\n');
    parts.push({ text: instruction });

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
