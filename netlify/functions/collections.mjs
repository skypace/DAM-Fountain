import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, q, publicUrl } from './_shared/supabase.mjs';

const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `c-${Date.now()}`;
const isImg = (p) => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(p || '');
function shapeAsset(row) {
  return {
    ...row,
    asset_tags: undefined,
    collection_assets: undefined,
    url: publicUrl(row.storage_path),
    thumbnailUrl: isImg(row.storage_path) ? publicUrl(row.storage_path) : null,
    tags: (row.asset_tags || []).map((t) => t.tag).filter(Boolean),
    collections: (row.collection_assets || []).map((c) => c.collection).filter(Boolean),
  };
}

async function list() {
  const rows = await db('GET', 'collections?select=*,collection_assets(count)&order=created_at.desc');
  // Resolve the public URL of each collection's chosen cover image in one query.
  const coverIds = [...new Set(rows.map((c) => c.cover_asset_id).filter(Boolean))];
  const coverUrl = new Map();
  if (coverIds.length) {
    const covers = await db('GET', `assets?id=in.(${coverIds.map(q).join(',')})&select=id,storage_path`);
    for (const a of covers) coverUrl.set(a.id, isImg(a.storage_path) ? publicUrl(a.storage_path) : null);
  }
  return json({
    collections: rows.map((c) => ({
      ...c,
      count: c.collection_assets?.[0]?.count ?? 0,
      coverUrl: c.cover_asset_id ? coverUrl.get(c.cover_asset_id) || null : null,
      collection_assets: undefined,
    })),
  });
}

async function detail(id) {
  const rows = await db('GET', `collections?id=eq.${q(id)}&select=*`);
  if (!rows.length) return json({ error: 'not found' }, 404);
  const links = await db('GET', `collection_assets?collection_id=eq.${q(id)}&select=sort_order,asset:assets(*,asset_tags(tag:tags(id,name)),collection_assets(collection:collections(id,name)))&order=sort_order.asc`);
  const assets = links.map((l) => shapeAsset(l.asset)).filter(Boolean);
  return json({ collection: rows[0], assets });
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
      const rows = await db('POST', 'collections', { body: { name: b.name, slug: slugify(b.slug || b.name), description: b.description || null, created_by: auth.user.id }, prefer: 'return=representation' });
      return json({ collection: rows[0] }, 201);
    }

    if (event.httpMethod === 'PATCH') {
      const b = JSON.parse(event.body || '{}');
      if (!b.id) return json({ error: 'id required' }, 400);
      const patch = { updated_at: new Date().toISOString() };
      for (const f of ['name', 'description', 'cover_asset_id']) if (f in b) patch[f] = b[f];
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
