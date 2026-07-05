import JSZip from 'jszip';
import { token } from './auth';
import type { Asset, AssetVersion, BrandGuidelines, Collection, GuidelineFile, Member, Share, Tag, AssetType, Brand } from './types';

const FN = '/.netlify/functions';
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://gfsdpwiqzshhexkofiif.supabase.co';
export const brandAssetUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/brand-assets/${path.split('/').map(encodeURIComponent).join('/')}`;

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
  aiTag: (assetId: string) => call<{ tags: string[]; description: string }>('/ai-tag', { method: 'POST', body: JSON.stringify({ assetId }) }),
  listVersions: (assetId: string) => call<{ versions: AssetVersion[] }>(`/assets?versions=${encodeURIComponent(assetId)}`).then((r) => r.versions),
  restoreVersion: (assetId: string, versionId: string) =>
    call<{ asset: Asset }>('/assets', { method: 'POST', body: JSON.stringify({ action: 'restore', assetId, versionId }) }).then((r) => r.asset),
  replaceFile: async (assetId: string, file: File): Promise<Asset> => {
    const sign = await call<{ uploadUrl: string; path: string; contentType: string }>('/assets', {
      method: 'POST', body: JSON.stringify({ action: 'sign', filename: file.name, contentType: file.type }),
    });
    const put = await fetch(sign.uploadUrl, { method: 'PUT', headers: { 'content-type': file.type || sign.contentType || 'application/octet-stream', 'x-upsert': 'true' }, body: file });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    const reg = await call<{ asset: Asset }>('/assets', {
      method: 'POST', body: JSON.stringify({ action: 'replace', assetId, path: sign.path, filename: file.name, contentType: file.type, sizeBytes: file.size }),
    });
    return reg.asset;
  },

  listTags: () => call<{ tags: Tag[] }>('/tags').then((r) => r.tags),

  listCollections: () => call<{ collections: Collection[] }>('/collections').then((r) => r.collections),
  getCollection: (id: string) => call<{ collection: Collection; assets: Asset[] }>(`/collections?id=${encodeURIComponent(id)}`),
  createCollection: (name: string, description?: string) =>
    call<{ collection: Collection }>('/collections', { method: 'POST', body: JSON.stringify({ name, description }) }).then((r) => r.collection),
  deleteCollection: (id: string) => call<{ ok: boolean }>(`/collections?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  setCollectionCover: (id: string, coverAssetId: string | null) =>
    call<{ collection: Collection }>('/collections', { method: 'PATCH', body: JSON.stringify({ id, cover_asset_id: coverAssetId }) }).then((r) => r.collection),
  addToCollection: (collectionId: string, assetIds: string[]) =>
    call<{ ok: boolean }>('/collections', { method: 'POST', body: JSON.stringify({ action: 'add', collectionId, assetIds }) }),
  removeFromCollection: (collectionId: string, assetIds: string[]) =>
    call<{ ok: boolean }>('/collections', { method: 'POST', body: JSON.stringify({ action: 'remove', collectionId, assetIds }) }),

  listShares: () => call<{ shares: Share[] }>('/shares').then((r) => r.shares),
  createShare: (body: { kind: 'asset' | 'collection'; assetId?: string; collectionId?: string; title?: string; allowDownload?: boolean; password?: string; expiresInDays?: number }) =>
    call<{ share: Share }>('/shares', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.share),
  revokeShare: (id: string) => call<{ ok: boolean }>(`/shares?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getGuidelines: (brand: string) => call<{ doc: BrandGuidelines }>(`/guidelines?brand=${encodeURIComponent(brand)}`).then((r) => r.doc),
  saveGuidelines: (brand: string, doc: BrandGuidelines) => call<{ doc: BrandGuidelines }>('/guidelines', { method: 'PUT', body: JSON.stringify({ brand, doc }) }).then((r) => r.doc),
  uploadGuidelineFile: async (file: File): Promise<GuidelineFile> => {
    const sign = await call<{ uploadUrl: string; path: string; contentType: string }>('/assets', {
      method: 'POST', body: JSON.stringify({ action: 'sign', filename: file.name, contentType: file.type }),
    });
    const put = await fetch(sign.uploadUrl, { method: 'PUT', headers: { 'content-type': file.type || sign.contentType || 'application/octet-stream', 'x-upsert': 'true' }, body: file });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    return { name: file.name, path: sign.path, contentType: file.type, url: brandAssetUrl(sign.path) };
  },

  listMembers: () => call<{ members: Member[] }>('/members').then((r) => r.members),
  addMember: (email: string, role: string) => call<{ status: string }>('/members', { method: 'POST', body: JSON.stringify({ email, role }) }),
  setMemberRole: (user_id: string, role: string) => call<{ ok: boolean }>('/members', { method: 'PATCH', body: JSON.stringify({ user_id, role }) }),
  removeMember: (user_id: string) => call<{ ok: boolean }>(`/members?user_id=${encodeURIComponent(user_id)}`, { method: 'DELETE' }),
};

// Fetch each asset and bundle them into a single .zip download.
export async function downloadZip(items: { url: string; filename?: string | null; title?: string | null }[], zipName = 'fountain-assets.zip') {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const it of items) {
    try {
      const res = await fetch(it.url);
      if (!res.ok) continue;
      const blob = await res.blob();
      let name = (it.filename || it.title || 'asset').replace(/[/\\]/g, '-');
      if (!/\.[a-z0-9]+$/i.test(name)) {
        const ext = it.url.split('.').pop()?.split(/[?#]/)[0];
        if (ext && ext.length <= 5) name += `.${ext}`;
      }
      let unique = name; let n = 1;
      while (used.has(unique)) { const dot = name.lastIndexOf('.'); unique = dot > 0 ? `${name.slice(0, dot)}-${n}${name.slice(dot)}` : `${name}-${n}`; n++; }
      used.add(unique);
      zip.file(unique, blob);
    } catch { /* skip unreachable files */ }
  }
  const out = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out);
  a.download = zipName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result || ''); resolve(s.includes(',') ? s.slice(s.indexOf(',') + 1) : s); };
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsDataURL(file);
  });
}
