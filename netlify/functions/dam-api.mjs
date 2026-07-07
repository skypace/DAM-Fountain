// Fountain DAM — read-only JSON API for external tools (e.g. Claude).
// A single GET endpoint, gated by a static token, that lists/searches the brand
// asset library and returns public URLs + metadata. Read-only: it never mutates.
//
// Auth: send the token as `Authorization: Bearer <DAM_API_TOKEN>` or `?key=<token>`.
//   - Set DAM_API_TOKEN in the fountain-dam Netlify env before sharing the URL.
//   - If DAM_API_TOKEN is unset the endpoint refuses all requests (fail-closed),
//     so an unconfigured deploy never leaks the library.
//
// Endpoint (via netlify.toml):  https://fountain-dam.netlify.app/api/assets
//
// Query params:
//   ?q=          free text over title + filename
//   ?brand=      brand slug (top-hat-provisions, alameda, brix, …)
//   ?type=       logo | can | equipment | hero | testimonial | sell-sheet | other
//   ?tag=        tag name
//   ?media=      image | video | audio | pdf
//   ?limit=      max results (default 30, max 100)
//   ?id=<uuid>   fetch a single asset (with tags + collections)
//   ?brands=1    list brands (slug + label)
//   ?collections=1  list folders/collections
import { db, q, publicUrl } from './_shared/supabase.mjs';

const isImg = (p) => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(p || '');
const cors = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
});
const json = (body, status = 200) => ({ statusCode: status, headers: { ...cors(), 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const clean = (v) => String(v || '').replace(/[,()*]/g, ' ').trim();
const slug = (v) => (/^[a-z0-9-]{1,48}$/.test(String(v || '').toLowerCase()) ? String(v).toLowerCase() : null);
const MEDIA_PREFIX = { image: 'image/', video: 'video/', audio: 'audio/', pdf: 'application/pdf' };

function shapeAsset(row) {
  return {
    id: row.id,
    title: row.title || row.filename,
    filename: row.filename,
    brand: row.brand,
    type: row.type,
    status: row.status,
    description: row.description || null,
    contentType: row.content_type,
    url: publicUrl(row.storage_path),
    thumbnailUrl: isImg(row.storage_path) ? publicUrl(row.storage_path) : null,
    tags: (row.asset_tags || []).map((t) => t?.tag?.name).filter(Boolean),
    collections: (row.collection_assets || []).map((c) => c?.collection?.name).filter(Boolean),
  };
}

const LIST_SELECT = 'id,title,filename,content_type,type,brand,status,description,storage_path,created_at,asset_tags(tag:tags(name))';
const ONE_SELECT = `${LIST_SELECT},collection_assets(collection:collections(id,name))`;

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json({ error: 'GET only' }, 405);

  // Fail-closed token gate.
  const token = process.env.DAM_API_TOKEN;
  if (!token) return json({ error: 'API disabled: set DAM_API_TOKEN on the site to enable this endpoint.' }, 503);
  const hdr = event.headers?.authorization || event.headers?.Authorization || '';
  const got = /^Bearer\s+(.+)$/i.exec(String(hdr).trim())?.[1] || event.queryStringParameters?.key || '';
  if (got !== token) return json({ error: 'Unauthorized' }, 401);

  const p = event.queryStringParameters || {};
  try {
    if (p.brands) return json({ brands: await db('GET', 'brands?select=slug,label&order=label') });
    if (p.collections) return json({ collections: await db('GET', 'collections?select=id,name,parent_id&order=name&limit=1000') });

    if (p.id) {
      const rows = await db('GET', `assets?id=eq.${q(p.id)}&deleted_at=is.null&select=${ONE_SELECT}`);
      if (!rows[0]) return json({ error: 'not found' }, 404);
      return json({ asset: shapeAsset(rows[0]) });
    }

    const limit = Math.min(Math.max(Number(p.limit) || 30, 1), 100);
    const params = ['deleted_at=is.null', `select=${LIST_SELECT}`, 'order=created_at.desc', `limit=${limit}`];
    const term = clean(p.q);
    if (term) { const t = q(`*${term}*`); params.push(`or=(title.ilike.${t},filename.ilike.${t})`); }
    const b = slug(p.brand);
    if (b) params.push(`brand=eq.${q(b)}`);
    if (p.type && /^[a-z0-9-]{1,40}$/.test(String(p.type).toLowerCase())) params.push(`type=eq.${q(String(p.type).toLowerCase())}`);
    const pref = MEDIA_PREFIX[String(p.media || '').toLowerCase()];
    if (pref) params.push(`content_type=ilike.${q(pref + '*')}`);
    if (p.tag && clean(p.tag)) {
      const tagRow = (await db('GET', `tags?name=eq.${q(String(p.tag).toLowerCase())}&select=id`))[0];
      if (!tagRow) return json({ count: 0, assets: [] });
      const links = await db('GET', `asset_tags?tag_id=eq.${q(tagRow.id)}&select=asset_id&limit=1000`);
      const ids = links.map((l) => l.asset_id);
      if (!ids.length) return json({ count: 0, assets: [] });
      params.push(`id=in.(${ids.map(q).join(',')})`);
    }
    const rows = await db('GET', `assets?${params.join('&')}`);
    const assets = rows.map(shapeAsset);
    return json({ count: assets.length, assets });
  } catch (e) {
    console.error('dam-api error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
