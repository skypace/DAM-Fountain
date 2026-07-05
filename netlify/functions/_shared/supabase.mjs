// Supabase REST + Storage helpers for Fountain DAM functions.
// All DAM tables live in the `dam` schema (exposed via PostgREST). Functions use
// the service-role key, which bypasses RLS — the functions themselves enforce auth.
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gfsdpwiqzshhexkofiif.supabase.co';
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
export const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
export const BUCKET = 'brand-assets';

function restHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Accept-Profile': 'dam',
    'Content-Profile': 'dam',
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Thin PostgREST wrapper against the `dam` schema. `path` is everything after
// /rest/v1/ (e.g. "assets?select=*&order=created_at.desc").
export async function db(method, path, { body, prefer } = {}) {
  const headers = restHeaders(prefer ? { Prefer: prefer } : {});
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) {
    const msg = data && typeof data === 'object' && data.message ? data.message : (text || `DB error ${res.status}`);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const q = (v) => encodeURIComponent(v);

// ---- Storage ----
export function publicUrl(storagePath) {
  const clean = String(storagePath || '').replace(/^\/+/, '');
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${clean.split('/').map(encodeURIComponent).join('/')}`;
}

export async function storagePut(objectPath, bytes, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true', 'Cache-Control': '3600' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status}): ${(await res.text()).slice(0, 160)}`);
  return objectPath;
}

export async function storageDelete(objectPath) {
  const clean = String(objectPath).replace(/^\/+/, '');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${clean.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Storage delete failed (${res.status})`);
}

export async function storageList(prefix = '') {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!res.ok) throw new Error(`Storage list failed (${res.status})`);
  return res.json();
}
