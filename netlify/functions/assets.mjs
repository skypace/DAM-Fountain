import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, q, publicUrl, storagePut, storageDelete, storageList, BUCKET, SUPABASE_URL, SERVICE_KEY } from './_shared/supabase.mjs';

const TYPES = ['logo', 'can', 'equipment', 'hero', 'testimonial', 'sell-sheet', 'other'];
const BRANDS = ['alameda', 'brix', 'shared'];
// Any file type is accepted (images, vector, design source, video, audio, docs,
// archives, fonts…). This map only helps guess a content-type from an extension.
const MIME_BY_EXT = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml',
  pdf: 'application/pdf', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg',
  ai: 'application/postscript', eps: 'application/postscript', psd: 'image/vnd.adobe.photoshop', zip: 'application/zip',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
};
// Function-relayed uploads (base64 / URL import) are capped by Netlify's request
// limit; large media go through the signed direct-to-storage path instead.
const MAX_BYTES = 25 * 1024 * 1024;

function safeSeg(v, fallback) {
  const c = String(v || '').normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
  return c || fallback;
}
function extFor(name, ct) {
  const fromName = String(name || '').match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  return Object.entries(MIME_BY_EXT).find(([, m]) => m === ct)?.[0] || 'bin';
}
function mimeFor(ext, ct) {
  if (ct) return ct;
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}
function classify(name) {
  const v = String(name || '').toLowerCase();
  if (/\b(logo|mark|seal)\b/.test(v)) return 'logo';
  if (/\b(can|bottle|package|bib)\b/.test(v)) return 'can';
  if (/\b(equipment|dispenser|fountain|cooler|tower)\b/.test(v)) return 'equipment';
  if (/\b(hero|banner|cover|lifestyle)\b/.test(v)) return 'hero';
  if (/\b(testimonial|quote|review)\b/.test(v)) return 'testimonial';
  if (/\b(sell|sheet|brochure|flyer|one-pager)\b/.test(v)) return 'sell-sheet';
  return 'other';
}
const isImg = (p) => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(p);
const prettyName = (p) => (decodeURIComponent(String(p).split('/').pop() || p).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim() || 'Asset');

function shape(row) {
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

// Ensure tag rows exist for the given names; return their ids.
async function resolveTagIds(names) {
  const clean = [...new Set((names || []).map((n) => String(n).trim().toLowerCase()).filter(Boolean))];
  if (!clean.length) return [];
  await db('POST', 'tags', { body: clean.map((name) => ({ name })), prefer: 'resolution=merge-duplicates,return=minimal' });
  const rows = await db('GET', `tags?select=id,name&name=in.(${clean.map((n) => `"${n.replace(/"/g, '')}"`).join(',')})`);
  return rows.map((r) => r.id);
}

async function setAssetTags(assetId, names) {
  await db('DELETE', `asset_tags?asset_id=eq.${q(assetId)}`);
  const ids = await resolveTagIds(names);
  if (ids.length) await db('POST', 'asset_tags', { body: ids.map((tag_id) => ({ asset_id: assetId, tag_id })), prefer: 'return=minimal' });
}

async function insertAsset(fields, tags) {
  const rows = await db('POST', 'assets', { body: fields, prefer: 'return=representation' });
  const row = rows[0];
  if (tags?.length) await setAssetTags(row.id, tags);
  const full = await db('GET', `assets?id=eq.${q(row.id)}&select=*,asset_tags(tag:tags(id,name))`);
  return shape(full[0]);
}

async function handleList(event) {
  const p = event.queryStringParameters || {};
  let idFilter = null;

  if (p.tag) {
    const rows = await db('GET', `asset_tags?tag_id=eq.${q(p.tag)}&select=asset_id`);
    idFilter = rows.map((r) => r.asset_id);
    if (!idFilter.length) return json({ assets: [] });
  }
  if (p.collection) {
    const rows = await db('GET', `collection_assets?collection_id=eq.${q(p.collection)}&select=asset_id&order=sort_order.asc`);
    const cids = rows.map((r) => r.asset_id);
    idFilter = idFilter ? idFilter.filter((id) => cids.includes(id)) : cids;
    if (!idFilter.length) return json({ assets: [] });
  }

  const parts = ['select=*,asset_tags(tag:tags(id,name)),collection_assets(collection:collections(id,name))', 'order=created_at.desc'];
  if (idFilter) parts.push(`id=in.(${idFilter.join(',')})`);
  if (p.type && TYPES.includes(p.type)) parts.push(`type=eq.${q(p.type)}`);
  if (p.brand && BRANDS.includes(p.brand)) parts.push(`brand=eq.${q(p.brand)}`);
  if (p.status) parts.push(`status=eq.${q(p.status)}`);
  if (p.q) parts.push(`search=wfts(english).${q(p.q)}`);

  const rows = await db('GET', `assets?${parts.join('&')}`);
  return json({ assets: rows.map(shape) });
}

async function handleUpload(event, auth) {
  const payload = JSON.parse(event.body || '{}');
  if (payload.action === 'import') return handleImport(payload, auth);
  if (payload.action === 'migrate') return handleMigrate(auth);
  if (payload.action === 'bulk') return handleBulk(payload);
  if (payload.action === 'sign') return handleSign(payload);
  if (payload.action === 'register') return handleRegister(payload, auth);
  if (payload.action === 'replace') return handleReplace(payload, auth);
  if (payload.action === 'restore') return handleRestore(payload, auth);

  const { filename, dataBase64, type, brand, title, description, tags } = payload;
  if (!dataBase64) return json({ error: 'dataBase64 is required' }, 400);
  const bytes = Buffer.from(String(dataBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!bytes.length) return json({ error: 'empty upload' }, 400);
  if (bytes.length > MAX_BYTES) return json({ error: 'file too large for direct upload — use the signed upload path' }, 413);

  const ext = extFor(filename, payload.contentType);
  const ct = mimeFor(ext, payload.contentType);
  const folder = TYPES.includes(type) ? type : classify(filename);
  const objectPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeSeg(String(filename || '').replace(/\.[a-z0-9]+$/i, ''), 'asset')}.${ext}`;
  await storagePut(objectPath, bytes, ct);

  const asset = await insertAsset({
    storage_path: objectPath,
    filename: filename || objectPath.split('/').pop(),
    title: title || prettyName(objectPath),
    description: description || null,
    type: folder,
    brand: BRANDS.includes(brand) ? brand : 'shared',
    bytes: bytes.length,
    content_type: ct,
    uploaded_by: auth.user.id,
    uploaded_by_email: auth.email,
  }, tags);
  return json({ asset }, 201);
}

async function handleImport(payload, auth) {
  const urls = [...new Set((Array.isArray(payload.urls) ? payload.urls : [payload.url]).map((u) => String(u || '').trim()).filter((u) => /^https?:\/\//i.test(u)))];
  if (!urls.length) return json({ error: 'provide http(s) urls' }, 400);
  if (urls.length > 60) return json({ error: 'max 60 urls per import' }, 400);
  const imported = []; const errors = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'fountain-dam-import' } });
      if (!res.ok) { errors.push({ url, error: `HTTP ${res.status}` }); continue; }
      const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
      const bytes = Buffer.from(await res.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_BYTES) { errors.push({ url, error: 'empty or too large' }); continue; }
      const name = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || 'asset');
      const ext = extFor(name, ct);
      const mime = mimeFor(ext, ct);
      const folder = TYPES.includes(payload.type) ? payload.type : classify(name);
      const objectPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeSeg(name.replace(/\.[a-z0-9]+$/i, ''), 'asset')}.${ext}`;
      await storagePut(objectPath, bytes, mime);
      const asset = await insertAsset({
        storage_path: objectPath, filename: name, title: prettyName(objectPath), type: folder,
        brand: BRANDS.includes(payload.brand) ? payload.brand : 'shared', bytes: bytes.length, content_type: mime,
        uploaded_by: auth.user.id, uploaded_by_email: auth.email,
      }, payload.tags);
      imported.push(asset);
    } catch (e) { errors.push({ url, error: e instanceof Error ? e.message : String(e) }); }
  }
  return json({ imported, errors, importedCount: imported.length, errorCount: errors.length }, imported.length ? 201 : 502);
}

// Signed direct-to-storage upload: the browser PUTs the file straight to Supabase
// Storage (any size, bypassing the function's request limit), then calls
// action:'register' to create the dam.assets row.
async function handleSign(payload) {
  const { filename, contentType, type } = payload;
  if (!filename) return json({ error: 'filename required' }, 400);
  const ext = extFor(filename, contentType);
  const folder = TYPES.includes(type) ? type : classify(filename);
  const objectPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeSeg(String(filename).replace(/\.[a-z0-9]+$/i, ''), 'asset')}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) return json({ error: `Could not create upload URL (${res.status})` }, 502);
  const data = await res.json();
  return json({ uploadUrl: `${SUPABASE_URL}/storage/v1${data.url}`, path: objectPath, contentType: mimeFor(ext, contentType) });
}

async function handleRegister(payload, auth) {
  const { path, filename, contentType, type, brand, title, tags, sizeBytes } = payload;
  if (!path) return json({ error: 'path required' }, 400);
  const asset = await insertAsset({
    storage_path: path,
    filename: filename || path.split('/').pop(),
    title: title || prettyName(path),
    type: TYPES.includes(type) ? type : classify(filename || path),
    brand: BRANDS.includes(brand) ? brand : 'shared',
    bytes: sizeBytes != null ? Number(sizeBytes) : null,
    content_type: contentType || mimeFor(extFor(filename || path, contentType)),
    uploaded_by: auth.user.id,
    uploaded_by_email: auth.email,
  }, tags);
  return json({ asset }, 201);
}

// One-time backfill: register any files already sitting in the brand-assets
// bucket (e.g. from the old apbg-billing Fountain page) as dam.assets rows.
async function handleMigrate(auth) {
  const existing = await db('GET', 'assets?select=storage_path');
  const known = new Set(existing.map((r) => r.storage_path));
  const created = [];
  const folders = [];
  for (const e of await storageList('')) {
    if (!e?.name) continue;
    if (e.id === null || e.metadata == null) { folders.push(e.name); continue; }
    if (!known.has(e.name)) created.push(e.name);
  }
  for (const folder of folders) {
    for (const e of await storageList(folder)) {
      if (!e?.name || e.id === null) continue;
      const path = `${folder}/${e.name}`;
      if (!known.has(path)) created.push(path);
    }
  }
  const inserted = [];
  for (const path of created) {
    if (/(^|\/)\.emptyFolderPlaceholder$/.test(path)) continue;
    const folder = path.includes('/') ? path.split('/')[0] : '';
    const asset = await insertAsset({
      storage_path: path, filename: path.split('/').pop(), title: prettyName(path),
      type: TYPES.includes(folder) ? folder : classify(path), brand: 'shared',
      uploaded_by: auth.user.id, uploaded_by_email: auth.email,
    }, []);
    inserted.push(asset);
  }
  return json({ migrated: inserted.length, assets: inserted });
}

// Apply one or more changes to many assets at once: set status/brand/type, add
// tags, add to a collection, or delete. Powers the bulk-action bar.
async function handleBulk(payload) {
  const ids = [...new Set((payload.ids || []).map(String).filter(Boolean))];
  if (!ids.length) return json({ error: 'ids required' }, 400);
  const inList = `(${ids.map(q).join(',')})`;

  if (payload.delete) {
    const rows = await db('GET', `assets?id=in.${inList}&select=storage_path`);
    await Promise.all(rows.map((r) => storageDelete(r.storage_path).catch(() => {})));
    await db('DELETE', `assets?id=in.${inList}`);
    return json({ ok: true, count: ids.length });
  }

  const patch = {};
  if (payload.status) patch.status = payload.status;
  if (payload.brand && BRANDS.includes(payload.brand)) patch.brand = payload.brand;
  if (payload.type && TYPES.includes(payload.type)) patch.type = payload.type;
  if (Object.keys(patch).length) {
    patch.updated_at = new Date().toISOString();
    await db('PATCH', `assets?id=in.${inList}`, { body: patch, prefer: 'return=minimal' });
  }

  if (Array.isArray(payload.addTags) && payload.addTags.length) {
    const tagIds = await resolveTagIds(payload.addTags);
    const rows = [];
    for (const asset_id of ids) for (const tag_id of tagIds) rows.push({ asset_id, tag_id });
    if (rows.length) await db('POST', 'asset_tags', { body: rows, prefer: 'resolution=merge-duplicates,return=minimal' });
  }

  if (payload.collectionId) {
    // Single-membership: move into the target collection (clear any prior one).
    await db('DELETE', `collection_assets?asset_id=in.${inList}`);
    await db('POST', 'collection_assets', { body: ids.map((asset_id) => ({ collection_id: payload.collectionId, asset_id })), prefer: 'return=minimal' });
  }

  return json({ ok: true, count: ids.length });
}

const FULL_SELECT = '*,asset_tags(tag:tags(id,name)),collection_assets(collection:collections(id,name))';

async function fullAsset(id) {
  const rows = await db('GET', `assets?id=eq.${q(id)}&select=${FULL_SELECT}`);
  return rows[0] ? shape(rows[0]) : null;
}

// Save the asset's current file as a version, then point the asset at a new one.
async function archiveCurrent(cur, auth) {
  await db('POST', 'asset_versions', {
    body: { asset_id: cur.id, version: cur.version || 1, storage_path: cur.storage_path, filename: cur.filename, content_type: cur.content_type, bytes: cur.bytes, created_by: auth.user.id, created_by_email: auth.email },
    prefer: 'return=minimal',
  });
}

async function handleReplace(payload, auth) {
  const { assetId, path, filename, contentType, sizeBytes } = payload;
  if (!assetId || !path) return json({ error: 'assetId and path required' }, 400);
  const rows = await db('GET', `assets?id=eq.${q(assetId)}&select=*`);
  const cur = rows[0];
  if (!cur) return json({ error: 'not found' }, 404);
  await archiveCurrent(cur, auth);
  await db('PATCH', `assets?id=eq.${q(assetId)}`, {
    body: { storage_path: path, filename: filename || path.split('/').pop(), content_type: contentType || cur.content_type, bytes: sizeBytes != null ? Number(sizeBytes) : null, version: (cur.version || 1) + 1, updated_at: new Date().toISOString() },
    prefer: 'return=minimal',
  });
  return json({ asset: await fullAsset(assetId) });
}

async function handleRestore(payload, auth) {
  const { assetId, versionId } = payload;
  if (!assetId || !versionId) return json({ error: 'assetId and versionId required' }, 400);
  const vrows = await db('GET', `asset_versions?id=eq.${q(versionId)}&asset_id=eq.${q(assetId)}&select=*`);
  const v = vrows[0];
  if (!v) return json({ error: 'version not found' }, 404);
  const arows = await db('GET', `assets?id=eq.${q(assetId)}&select=*`);
  const cur = arows[0];
  if (!cur) return json({ error: 'not found' }, 404);
  await archiveCurrent(cur, auth);
  await db('PATCH', `assets?id=eq.${q(assetId)}`, {
    body: { storage_path: v.storage_path, filename: v.filename, content_type: v.content_type, bytes: v.bytes, version: (cur.version || 1) + 1, updated_at: new Date().toISOString() },
    prefer: 'return=minimal',
  });
  return json({ asset: await fullAsset(assetId) });
}

async function handleVersions(assetId) {
  const rows = await db('GET', `asset_versions?asset_id=eq.${q(assetId)}&select=*&order=version.desc`);
  return json({
    versions: rows.map((v) => ({
      id: v.id, version: v.version, filename: v.filename, bytes: v.bytes, created_at: v.created_at, created_by_email: v.created_by_email,
      url: publicUrl(v.storage_path), thumbnailUrl: isImg(v.storage_path) ? publicUrl(v.storage_path) : null,
    })),
  });
}

async function handlePatch(event) {
  const payload = JSON.parse(event.body || '{}');
  const id = payload.id;
  if (!id) return json({ error: 'id required' }, 400);
  const patch = {};
  for (const f of ['title', 'description', 'status']) if (f in payload) patch[f] = payload[f];
  if ('type' in payload && TYPES.includes(payload.type)) patch.type = payload.type;
  if ('brand' in payload && BRANDS.includes(payload.brand)) patch.brand = payload.brand;
  patch.updated_at = new Date().toISOString();
  await db('PATCH', `assets?id=eq.${q(id)}`, { body: patch, prefer: 'return=minimal' });
  if (Array.isArray(payload.tags)) await setAssetTags(id, payload.tags);
  const rows = await db('GET', `assets?id=eq.${q(id)}&select=*,asset_tags(tag:tags(id,name))`);
  return json({ asset: rows[0] ? shape(rows[0]) : null });
}

async function handleDelete(event) {
  const id = event.queryStringParameters?.id;
  if (!id) return json({ error: 'id required' }, 400);
  const rows = await db('GET', `assets?id=eq.${q(id)}&select=storage_path`);
  if (!rows.length) return json({ error: 'not found' }, 404);
  await storageDelete(rows[0].storage_path).catch(() => {});
  await db('DELETE', `assets?id=eq.${q(id)}`);
  return json({ ok: true });
}

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  try {
    if (event.httpMethod === 'GET') {
      const auth = await requireRole(event, 'viewer');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      if (event.queryStringParameters?.versions) return await handleVersions(event.queryStringParameters.versions);
      return await handleList(event);
    }
    if (event.httpMethod === 'POST') {
      const auth = await requireRole(event, 'contributor');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      return await handleUpload(event, auth);
    }
    if (event.httpMethod === 'PATCH') {
      const auth = await requireRole(event, 'contributor');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      return await handlePatch(event);
    }
    if (event.httpMethod === 'DELETE') {
      const auth = await requireRole(event, 'contributor');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      return await handleDelete(event);
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error('assets error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
