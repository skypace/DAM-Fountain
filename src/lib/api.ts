import { token } from './auth';
import type { Asset, Collection, Member, Share, Tag, AssetType, Brand } from './types';

const FN = '/.netlify/functions';

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const t = token();
  if (t) headers.set('Authorization', `Bearer ${t}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const res = await fetch(`${FN}${path}`, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export interface AssetFilters { q?: string; type?: string; brand?: string; tag?: string; collection?: string; status?: string }

export const api = {
  listAssets: (f: AssetFilters = {}) => {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
    return call<{ assets: Asset[] }>(`/assets${qs.toString() ? `?${qs}` : ''}`).then((r) => r.assets);
  },
  uploadAsset: (body: { filename: string; contentType: string; dataBase64: string; type?: AssetType; brand?: Brand; title?: string; tags?: string[] }) =>
    call<{ asset: Asset }>('/assets', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.asset),
  // Signed direct-to-storage upload — works for any file size/type (video, audio,
  // design source files…), bypassing the function request limit.
  uploadFile: async (file: File, opts: { type?: AssetType; brand?: Brand; tags?: string[] } = {}): Promise<Asset> => {
    const sign = await call<{ uploadUrl: string; path: string; contentType: string }>('/assets', {
      method: 'POST', body: JSON.stringify({ action: 'sign', filename: file.name, contentType: file.type, type: opts.type }),
    });
    const put = await fetch(sign.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': file.type || sign.contentType || 'application/octet-stream', 'x-upsert': 'true' },
      body: file,
    });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    const reg = await call<{ asset: Asset }>('/assets', {
      method: 'POST',
      body: JSON.stringify({ action: 'register', path: sign.path, filename: file.name, contentType: file.type, type: opts.type, brand: opts.brand, tags: opts.tags, sizeBytes: file.size }),
    });
    return reg.asset;
  },
  importAssets: (urls: string[], type?: AssetType, brand?: Brand) =>
    call<{ imported: Asset[]; errorCount: number }>('/assets', { method: 'POST', body: JSON.stringify({ action: 'import', urls, type, brand }) }),
  migrateBucket: () => call<{ migrated: number }>('/assets', { method: 'POST', body: JSON.stringify({ action: 'migrate' }) }),
  updateAsset: (body: Omit<Partial<Asset>, 'tags'> & { id: string; tags?: string[] }) =>
    call<{ asset: Asset }>('/assets', { method: 'PATCH', body: JSON.stringify(body) }).then((r) => r.asset),
  deleteAsset: (id: string) => call<{ ok: boolean }>(`/assets?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  bulkAssets: (body: { ids: string[]; status?: string; brand?: string; type?: string; addTags?: string[]; collectionId?: string; delete?: boolean }) =>
    call<{ ok: boolean; count: number }>('/assets', { method: 'POST', body: JSON.stringify({ action: 'bulk', ...body }) }),

  listTags: () => call<{ tags: Tag[] }>('/tags').then((r) => r.tags),

  listCollections: () => call<{ collections: Collection[] }>('/collections').then((r) => r.collections),
  getCollection: (id: string) => call<{ collection: Collection; assets: Asset[] }>(`/collections?id=${encodeURIComponent(id)}`),
  createCollection: (name: string, description?: string) =>
    call<{ collection: Collection }>('/collections', { method: 'POST', body: JSON.stringify({ name, description }) }).then((r) => r.collection),
  deleteCollection: (id: string) => call<{ ok: boolean }>(`/collections?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  addToCollection: (collectionId: string, assetIds: string[]) =>
    call<{ ok: boolean }>('/collections', { method: 'POST', body: JSON.stringify({ action: 'add', collectionId, assetIds }) }),
  removeFromCollection: (collectionId: string, assetIds: string[]) =>
    call<{ ok: boolean }>('/collections', { method: 'POST', body: JSON.stringify({ action: 'remove', collectionId, assetIds }) }),

  listShares: () => call<{ shares: Share[] }>('/shares').then((r) => r.shares),
  createShare: (body: { kind: 'asset' | 'collection'; assetId?: string; collectionId?: string; title?: string; allowDownload?: boolean; password?: string; expiresInDays?: number }) =>
    call<{ share: Share }>('/shares', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.share),
  revokeShare: (id: string) => call<{ ok: boolean }>(`/shares?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listMembers: () => call<{ members: Member[] }>('/members').then((r) => r.members),
  addMember: (email: string, role: string) => call<{ status: string }>('/members', { method: 'POST', body: JSON.stringify({ email, role }) }),
  setMemberRole: (user_id: string, role: string) => call<{ ok: boolean }>('/members', { method: 'PATCH', body: JSON.stringify({ user_id, role }) }),
  removeMember: (user_id: string) => call<{ ok: boolean }>(`/members?user_id=${encodeURIComponent(user_id)}`, { method: 'DELETE' }),
};

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result || ''); resolve(s.includes(',') ? s.slice(s.indexOf(',') + 1) : s); };
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsDataURL(file);
  });
}
