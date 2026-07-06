import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { ArrowLeft, Share2, Copy, Download, FolderPlus, Folder, UploadCloud } from 'lucide-react';
import type { Asset, Collection, Tag } from '../lib/types';
import { api, downloadZip } from '../lib/api';
import { dtHasFiles, readDropped, uploadDroppedTree } from '../lib/dnd';
import { AssetGrid } from '../components/AssetGrid';
import { AssetDialog } from '../components/AssetDialog';
import { BulkActionBar } from '../components/BulkActionBar';
import { FolderCard } from '../components/FolderCard';
import { useToast } from '../components/Toast';

export function CollectionDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [children, setChildren] = useState<Collection[]>([]);
  const [parent, setParent] = useState<{ id: string; name: string } | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Asset | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dropOver, setDropOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; pct: number } | null>(null);
  const overallPct = progress && progress.total ? Math.round(((progress.done + progress.pct) / progress.total) * 100) : 0;

  async function load() {
    setLoading(true); setError(null);
    try {
      const [detail, t, c] = await Promise.all([api.getCollection(id), api.listTags(), api.listCollections()]);
      setCollection(detail.collection); setAssets(detail.assets); setChildren(detail.children || []); setParent(detail.parent || null); setAllTags(t); setCollections(c);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addFolder() {
    const nm = window.prompt('New folder name');
    if (!nm || !nm.trim()) return;
    try { const c = await api.createCollection(nm.trim(), undefined, id); await load(); toast(`Created folder “${c.name}”.`); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }
  async function delFolder(c: Collection) {
    if (!confirm(`Delete sub-folder "${c.name}"? Its sub-folders are removed too; assets are not deleted.`)) return;
    try { await api.deleteCollection(c.id); await load(); toast('Sub-folder deleted.'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }
  // Desktop drop anywhere on the page → upload into this collection (loose files
  // land here; dropped folders become sub-folders).
  async function onPageDrop(e: React.DragEvent) {
    if (!dtHasFiles(e.dataTransfer)) return;
    e.preventDefault(); setDropOver(false); setUploading(true);
    try {
      const dropped = await readDropped(e.dataTransfer);
      if (dropped.length) {
        setProgress({ done: 0, total: dropped.length, pct: 0 });
        const r = await uploadDroppedTree(dropped, { parentId: id, onProgress: (done, total, pct) => setProgress({ done, total, pct }) });
        await load(); toast(`Uploaded ${r.files} file${r.files === 1 ? '' : 's'}${r.collections ? ` · ${r.collections} sub-folder${r.collections === 1 ? '' : 's'}` : ''}.`);
      }
    } catch (err) { toast(err instanceof Error ? err.message : String(err)); } finally { setUploading(false); setProgress(null); }
  }

  async function shareCollection() {
    try { const s = await api.createShare({ kind: 'collection', collectionId: id, allowDownload: true }); setShareUrl(`${location.origin}/s/${s.token}`); toast('Share link created.'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }
  async function removeSelected() {
    if (!selected.size) return;
    try { await api.removeFromCollection(id, [...selected]); setSelected(new Set()); setSelecting(false); await load(); toast('Removed from collection.'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }
  const toggle = (aid: string) => setSelected((s) => { const n = new Set(s); n.has(aid) ? n.delete(aid) : n.add(aid); return n; });

  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="warning" action={<Button size="small" onClick={load}>Retry</Button>}>{error}</Alert>;

  return (
    <Stack
      spacing={2}
      onDragOver={(e) => { if (dtHasFiles(e.dataTransfer)) { e.preventDefault(); setDropOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropOver(false); }}
      onDrop={onPageDrop}
      sx={{ position: 'relative', minHeight: '60vh' }}
    >
      {dropOver && !uploading && (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, bgcolor: 'rgba(15,23,42,.55)', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <Stack alignItems="center" spacing={1.5} sx={{ color: '#fff' }}>
            <UploadCloud size={44} />
            <Typography variant="h6">{`Drop to add to “${collection?.name}”`}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>Folders become sub-folders</Typography>
          </Stack>
        </Box>
      )}
      {uploading && (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, bgcolor: 'rgba(15,23,42,.6)', display: 'grid', placeItems: 'center' }}>
          <Paper sx={{ p: 3, width: 360, maxWidth: '90vw', borderRadius: 1 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <UploadCloud size={20} />
                <Typography variant="subtitle1" sx={{ flex: 1 }}>Uploading…</Typography>
                {progress && <Typography variant="subtitle1" fontWeight={700}>{overallPct}%</Typography>}
              </Stack>
              <LinearProgress variant={progress ? 'determinate' : 'indeterminate'} value={overallPct} sx={{ height: 8, borderRadius: 4 }} />
              {progress && <Typography variant="caption" color="text.secondary">File {Math.min(progress.done + 1, progress.total)} of {progress.total}</Typography>}
            </Stack>
          </Paper>
        </Box>
      )}
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        <Button size="small" startIcon={<ArrowLeft size={16} />} onClick={() => nav('/collections')}>Collections</Button>
        {parent && <Button size="small" color="inherit" startIcon={<Folder size={15} />} onClick={() => nav(`/collections/${parent.id}`)}>{parent.name}</Button>}
        <Typography variant="h6">{collection?.name}</Typography>
        <Chip size="small" variant="outlined" label={`${assets.length} asset${assets.length === 1 ? '' : 's'}`} />
        {children.length > 0 && <Chip size="small" variant="outlined" label={`${children.length} folder${children.length === 1 ? '' : 's'}`} />}
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" startIcon={<FolderPlus size={15} />} onClick={addFolder}>Add folder</Button>
        <Button size="small" variant={selecting ? 'contained' : 'outlined'} onClick={() => { setSelecting((v) => !v); setSelected(new Set()); }}>{selecting ? 'Done' : 'Select'}</Button>
        {selecting && <Button size="small" color="error" disabled={!selected.size} onClick={removeSelected}>Remove ({selected.size})</Button>}
        <Button size="small" variant="outlined" startIcon={<Download size={15} />} disabled={!assets.length} onClick={() => downloadZip(assets, `${collection?.name || 'collection'}.zip`)}>Download ZIP</Button>
        <Button size="small" variant="outlined" startIcon={<Share2 size={15} />} onClick={shareCollection}>Share collection</Button>
      </Stack>

      {shareUrl && (
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField size="small" fullWidth value={shareUrl} InputProps={{ readOnly: true }} />
          <Button size="small" variant="outlined" startIcon={<Copy size={15} />} onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast('Copied.'))}>Copy</Button>
        </Stack>
      )}

      {children.length > 0 && (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Folders</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.5 }}>
            {children.map((c) => (
              <FolderCard key={c.id} collection={c} onOpen={(cid) => nav(`/collections/${cid}`)} onDelete={delFolder} onChanged={load} />
            ))}
          </Box>
        </Box>
      )}

      <AssetGrid assets={assets} onOpen={setOpen} selectable={selecting} selected={selected} onToggleSelect={toggle} />

      {selected.size > 0 && (
        <BulkActionBar
          ids={[...selected]}
          assets={assets}
          collections={collections}
          onDone={() => { setSelected(new Set()); setSelecting(false); load(); }}
          onClear={() => setSelected(new Set())}
        />
      )}

      {open && (
        <AssetDialog asset={open} collections={collections} allTags={allTags.map((t) => t.name)}
          onClose={() => setOpen(null)}
          onSaved={(a) => { setAssets((cur) => cur.map((x) => (x.id === a.id ? a : x))); setOpen(null); }}
          onDeleted={(aid) => { setAssets((cur) => cur.filter((x) => x.id !== aid)); setOpen(null); }} />
      )}
    </Stack>
  );
}
