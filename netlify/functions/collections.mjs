import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, q, publicUrl } from './_shared/supabase.mjs';

const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `c-${Date.now()}`;
const isImg = (p) => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(p || '');
// PostgREST may return a to-one embed as an object; normalize to an array.
const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
function shapeAsset(row) {
  return {
    ...row,
    asset_tags: undefined,
    collection_assets: undefined,
    url: publicUrl(row.storage_path),
    thumbnailUrl: isImg(row.storage_path) ? publicUrl(row.storage_path) : null,
    tags: asArray(row.asset_tags).map((t) => t.tag).filter(Boolean),
    collections: asArray(row.collection_assets).map((c) => c.collection).filter(Boolean),
  };
}

// Resolve chosen-cover assets for a set of collection rows in one query.
// Returns a Map<assetId, { url, filename, content_type }> for ANY media type,
// so PDFs / videos / etc. can act as a folder cover (rendered via MediaPreview).
async function coverMapFor(rows) {
  const coverIds = [...new Set(rows.map((c) => c.cover_asset_id).filter(Boolean))];
  const map = new Map();
  if (coverIds.length) {
    const covers = await db('GET', `assets?id=in.(${coverIds.map(q).join(',')})&select=id,storage_path,filename,content_type`);
    for (const a of covers) map.set(a.id, { url: publicUrl(a.storage_path), filename: a.filename, content_type: a.content_type, storage_path: a.storage_path });
  }
  return map;
}
// For collections with no explicit cover, auto-pick a cover: the first image
// asset if there is one, otherwise the first asset of ANY type (PDF/video/source
// file) so every non-empty folder shows a thumbnail.
async function autoCoverMapFor(rows) {
  const need = rows.filter((c) => !c.cover_asset_id).map((c) => c.id);
  const map = new Map();
  if (!need.length) return map;
  const links = await db('GET', `collection_assets?collection_id=in.(${need.map(q).join(',')})&select=collection_id,sort_order,asset:assets(storage_path,filename,content_type)&order=sort_order.asc`);
  const firstAny = new Map();
  for (const l of links) {
    const a = l.asset;
    if (!a) continue;
    const info = { url: publicUrl(a.storage_path), filename: a.filename, content_type: a.content_type, storage_path: a.storage_path };
    if (!firstAny.has(l.collection_id)) firstAny.set(l.collection_id, info);
    if (!map.has(l.collection_id) && (isImg(a.storage_path) || /^image\//i.test(a.content_type || ''))) {
      map.set(l.collection_id, info);
    }
  }
  // Fall back to the first asset of any kind where no image was found.
  for (const [cid, info] of firstAny) if (!map.has(cid)) map.set(cid, info);
  return map;
}
const shapeCollection = (c, covers, autoCovers, extra = {}) => {
  const explicit = c.cover_asset_id ? covers.get(c.cover_asset_id) || null : null;
  const cover = explicit || autoCovers?.get(c.id) || null;
  return {
    ...c,
    count: c.collection_assets?.[0]?.count ?? 0,
    cover,
    auto_cover: !explicit && !!cover, // true when the cover was auto-picked
    // Back-compat: coverUrl is the image-only URL (null for non-images).
    coverUrl: cover && isImg(cover.storage_path) ? cover.url : null,
    collection_assets: undefined,
    ...extra,
  };
};

async function list() {
  const rows = await db('GET', 'collections?select=*,collection_assets(count)&order=sort_order.asc,created_at.desc');
  const [covers, autoCovers] = await Promise.all([coverMapFor(rows), autoCoverMapFor(rows)]);
  const subfolderCount = new Map();
  for (const c of rows) if (c.parent_id) subfolderCount.set(c.parent_id, (subfolderCount.get(c.parent_id) || 0) + 1);
  return json({ collections: rows.map((c) => shapeCollection(c, covers, autoCovers, { subfolderCount: subfolderCount.get(c.id) || 0 })) });
}

async function detail(id) {
  const rows = await db('GET', `collections?id=eq.${q(id)}&select=*`);
  if (!rows.length) return json({ error: 'not found' }, 404);
  const links = await db('GET', `collection_assets?collection_id=eq.${q(id)}&select=sort_order,asset:assets(*,asset_tags(tag:tags(id,name)),collection_assets(collection:collections(id,name)))&order=sort_order.asc`);
  const assets = links.map((l) => shapeAsset(l.asset)).filter(Boolean);
  // Sub-folders of this collection, each with a direct asset count + cover.
  const childRows = await db('GET', `collections?parent_id=eq.${q(id)}&select=*,collection_assets(count)&order=sort_order.asc,name.asc`);
  const [covers, autoCovers] = await Promise.all([coverMapFor(childRows), autoCoverMapFor(childRows)]);
  const children = childRows.map((c) => shapeCollection(c, covers, autoCovers));
  // Parent breadcrumb (name only) if this is itself a sub-folder.
  let parent = null;
  if (rows[0].parent_id) {
    const p = await db('GET', `collections?id=eq.${q(rows[0].parent_id)}&select=id,name`);
    parent = p[0] || null;
  }
  return json({ collection: rows[0], assets, children, parent });
}

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  try {
    if (event.httpMethod === 'GET') {
      const auth = await requireRole(event, 'viewer');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const id = event.queryStringParameters?.id;
      return id ? await detail(id) : await list();
    }

    const auth = await requireRole(event, 'contributor');
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (b.action === 'reorder') {
        // Persist a new manual order: sort_order = position * 10.
        const ids = Array.isArray(b.ids) ? b.ids : [];
        if (!ids.length) return json({ error: 'ids required' }, 400);
        await Promise.all(ids.map((id, i) => db('PATCH', `collections?id=eq.${q(id)}`, { body: { sort_order: (i + 1) * 10 }, prefer: 'return=minimal' })));
        return json({ ok: true });
      }
      if (b.action === 'add' || b.action === 'remove') {
        const { collectionId, assetIds } = b;
        if (!collectionId || !Array.isArray(assetIds) || !assetIds.length) return json({ error: 'collectionId + assetIds required' }, 400);
        if (b.action === 'remove') {
          await db('DELETE', `collection_assets?collection_id=eq.${q(collectionId)}&asset_id=in.(${assetIds.map(q).join(',')})`);
        } else {
          // Single-membership: an asset lives in exactly one collection, so
          // adding = moving. Clear any existing membership first, then insert.
          await db('DELETE', `collection_assets?asset_id=in.(${assetIds.map(q).join(',')})`);
          await db('POST', 'collection_assets', { body: assetIds.map((asset_id) => ({ collection_id: collectionId, asset_id })), prefer: 'return=minimal' });
        }
        return json({ ok: true });
      }
      if (!b.name) return json({ error: 'name required' }, 400);
      const rows = await db('POST', 'collections', { body: { name: b.name, slug: slugify(b.slug || b.name), description: b.description || null, parent_id: b.parent_id || null, created_by: auth.user.id }, prefer: 'return=representation' });
      return json({ collection: rows[0] }, 201);
    }

    if (event.httpMethod === 'PATCH') {
      const b = JSON.parse(event.body || '{}');
      if (!b.id) return json({ error: 'id required' }, 400);
      const patch = { updated_at: new Date().toISOString() };
      for (const f of ['name', 'description', 'cover_asset_id', 'sort_order']) if (f in b) patch[f] = b[f];
      // Move a folder under another (or to top-level with null). Guard the
      // trivial self-parent cycle; deeper cycles are unlikely via the UI.
      if ('parent_id' in b && b.parent_id !== b.id) patch.parent_id = b.parent_id || null;
      const rows = await db('PATCH', `collections?id=eq.${q(b.id)}`, { body: patch, prefer: 'return=representation' });
      return json({ collection: rows[0] });
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return json({ error: 'id required' }, 400);
      await db('DELETE', `collections?id=eq.${q(id)}`);
      return json({ ok: true });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error('collections error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
