import { api } from './api';
import type { AssetType } from './types';

// MIME keys used for in-app drags (asset cards / folder cards).
export const ASSET_MIME = 'application/x-fountain-asset';   // value: JSON array of asset ids
export const FOLDER_MIME = 'application/x-fountain-folder';  // value: collection id

export function dtHasFiles(dt: DataTransfer | null | undefined): boolean {
  return !!dt && Array.from(dt.types || []).includes('Files');
}
export function readAssetIds(dt: DataTransfer): string[] {
  try { const v = dt.getData(ASSET_MIME); return v ? JSON.parse(v) : []; } catch { return []; }
}
export function readFolderId(dt: DataTransfer): string | null {
  return dt.getData(FOLDER_MIME) || null;
}

interface DroppedFile { path: string; file: File }

// Recursively walk a dropped FileSystemEntry (folder support via webkitGetAsEntry).
function walkEntry(entry: any, prefix: string, out: DroppedFile[]): Promise<void> {
  return new Promise((resolve) => {
    if (!entry) return resolve();
    if (entry.isFile) {
      entry.file((file: File) => { out.push({ path: prefix + file.name, file }); resolve(); }, () => resolve());
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const all: any[] = [];
      const readBatch = () => reader.readEntries(async (batch: any[]) => {
        if (!batch.length) { for (const e of all) await walkEntry(e, `${prefix}${entry.name}/`, out); resolve(); }
        else { all.push(...batch); readBatch(); }
      }, () => resolve());
      readBatch();
    } else resolve();
  });
}

// Read an OS drop into a flat list of files, each with a relative path so folder
// structure is preserved. Entries are captured synchronously (the items list is
// cleared once the handler returns), then walked.
export async function readDropped(dt: DataTransfer): Promise<DroppedFile[]> {
  const entries = Array.from(dt.items || [])
    .map((it) => (typeof it.webkitGetAsEntry === 'function' ? it.webkitGetAsEntry() : null))
    .filter(Boolean);
  if (entries.length) {
    const out: DroppedFile[] = [];
    for (const e of entries) await walkEntry(e, '', out);
    return out;
  }
  return Array.from(dt.files || []).map((file) => ({ path: file.name, file }));
}

// Upload dropped files/folders. Loose files go into `parentId` (or the library
// root when null). Folders become nested collections; with a parentId they are
// created as sub-folders of it. Existing collections are reused by name+parent.
export async function uploadDroppedTree(
  dropped: DroppedFile[],
  opts: { parentId?: string | null; type?: AssetType; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ files: number; collections: number }> {
  const parentId = opts.parentId || null;
  const type = opts.type || 'other';
  const looseFiles: File[] = [];
  const byDir = new Map<string, File[]>();
  for (const { path, file } of dropped) {
    const segs = path.split('/').filter(Boolean);
    segs.pop(); // drop filename
    if (!segs.length) looseFiles.push(file);
    else { const key = segs.join('/'); if (!byDir.has(key)) byDir.set(key, []); byDir.get(key)!.push(file); }
  }
  const total = dropped.length;
  let done = 0;
  const bump = () => { done++; opts.onProgress?.(done, total); };

  const collections = await api.listCollections();
  const cache = new Map<string, string>();
  let created = 0;
  const findExisting = (name: string, pid: string | null) =>
    collections.find((c) => c.name.toLowerCase() === name.toLowerCase() && (c.parent_id || null) === (pid || null));
  async function ensureDir(dirKey: string): Promise<string> {
    const segs = dirKey.split('/');
    let pid: string | null = parentId;
    let curKey = '';
    for (const seg of segs) {
      curKey = curKey ? `${curKey}/${seg}` : seg;
      if (cache.has(curKey)) { pid = cache.get(curKey)!; continue; }
      let col = findExisting(seg, pid);
      if (!col) { col = await api.createCollection(seg, undefined, pid || undefined); collections.push(col); created++; }
      cache.set(curKey, col.id);
      pid = col.id;
    }
    return pid!;
  }

  for (const f of looseFiles) {
    const a = await api.uploadFile(f, { type });
    if (parentId) await api.addToCollection(parentId, [a.id]);
    bump();
  }
  for (const [dirKey, files] of byDir) {
    const colId = await ensureDir(dirKey);
    for (const f of files) { const a = await api.uploadFile(f, { type }); await api.addToCollection(colId, [a.id]); bump(); }
  }
  return { files: total, collections: created };
}
