import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputAdornment, InputLabel, LinearProgress, Menu,
  MenuItem, Paper, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import { Upload, Globe, Download, Search, Images, MoreVertical, X, LayoutGrid, Table as TableIcon, Share2, FolderOpen, FolderPlus, UploadCloud, Sun, Moon, Grid3x3, Ban, Sparkles } from 'lucide-react';
import type { Asset, Collection, Tag } from '../lib/types';
import { api, type AssetFilters } from '../lib/api';
import { useBrands } from '../lib/useBrands';
import { useTypes } from '../lib/useTypes';
import { useBrandScope } from '../lib/brandScope';
import { usePreviewBg } from '../lib/previewBg';
import { dtHasFiles, readAssetIds, readDropped, uploadDroppedTree } from '../lib/dnd';
import { getRecents } from '../lib/recents';
import { mediaKind, MEDIA_KINDS, MEDIA_META } from '../lib/media';
import { AssetGrid } from '../components/AssetGrid';
import { AssetTable } from '../components/AssetTable';
import { AssetDialog } from '../components/AssetDialog';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, GridSkeleton } from '../components/EmptyState';
import { BulkActionBar } from '../components/BulkActionBar';
import { useToast } from '../components/Toast';

export function LibraryPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { brands: brandList } = useBrands();
  const { types: typeList, addType } = useTypes();
  const [brandScope] = useBrandScope();
  const [previewBg, setPreviewBg] = usePreviewBg();
  const [searchParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Asset | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [brand, setBrand] = useState('');
  const [tag, setTag] = useState('');
  const [collection, setCollection] = useState('');
  const [media, setMedia] = useState('');
  const [uploadType, setUploadType] = useState('other');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const folderRef = useRef<HTMLInputElement | null>(null);
  const [dropOver, setDropOver] = useState(false);
  const [chipOver, setChipOver] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; pct: number } | null>(null);
  const overallPct = progress && progress.total ? Math.round(((progress.done + progress.pct) / progress.total) * 100) : 0;

  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // Merge a section table's selection into the global set without disturbing
  // selections made in other sections.
  const mergeSectionSelection = (items: Asset[], ids: string[]) => setSelected((prev) => {
    const itemIds = new Set(items.map((a) => a.id));
    return new Set([...[...prev].filter((id) => !itemIds.has(id)), ...ids]);
  });

  // A brand chosen in the sidebar scopes the whole library; the toolbar filter
  // only applies when scope is "all".
  const effectiveBrand = brandScope !== 'all' ? brandScope : brand;
  const uploadBrand = brandScope !== 'all' ? (brandScope as Asset['brand']) : undefined;
  const filters = useMemo<AssetFilters>(() => ({ q: q || undefined, type: type || undefined, brand: effectiveBrand || undefined, tag: tag || undefined, collection: collection || undefined }), [q, type, effectiveBrand, tag, collection]);

  // Seed the search box from a ?q= link (sidebar search navigates here).
  useEffect(() => {
    const urlq = searchParams.get('q');
    if (urlq !== null && urlq !== q) setQ(urlq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [a, t, c] = await Promise.all([api.listAssets(filters), api.listTags(), api.listCollections()]);
      setAssets(a); setTags(t); setCollections(c);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [q, type, effectiveBrand, tag, collection]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const list = Array.from(files);
    let ok = 0;
    setProgress({ done: 0, total: list.length, pct: 0 });
    try {
      for (let i = 0; i < list.length; i++) {
        await api.uploadFile(list[i], { type: uploadType as Asset['type'], brand: uploadBrand, onProgress: (p) => setProgress({ done: i, total: list.length, pct: p }) });
        ok++;
      }
      toast(`Uploaded ${ok} asset${ok === 1 ? '' : 's'}.`); await load();
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); setProgress(null); }
  }

  // Upload one or more folders — each folder (by its immediate name) becomes a
  // collection, and its files are uploaded and moved into it.
  async function uploadFolders(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const groups = new Map<string, File[]>();
      for (const f of Array.from(files)) {
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || '';
        const segs = rel.split('/').filter(Boolean);
        const folder = segs.length >= 2 ? segs[segs.length - 2] : (segs[0] || 'Uploads');
        if (!groups.has(folder)) groups.set(folder, []);
        groups.get(folder)!.push(f);
      }
      const cols = await api.listCollections();
      const total = files.length;
      let fileCount = 0;
      setProgress({ done: 0, total, pct: 0 });
      for (const [name, groupFiles] of groups) {
        let col = cols.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (!col) { col = await api.createCollection(name); cols.push(col); }
        const ids: string[] = [];
        for (const f of groupFiles) { const a = await api.uploadFile(f, { type: uploadType as Asset['type'], brand: uploadBrand, onProgress: (p) => setProgress({ done: fileCount, total, pct: p }) }); ids.push(a.id); fileCount++; }
        if (ids.length) await api.addToCollection(col.id, ids);
      }
      await load();
      toast(`Uploaded ${fileCount} file${fileCount === 1 ? '' : 's'} into ${groups.size} collection${groups.size === 1 ? '' : 's'}.`);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); setProgress(null); }
  }
  // Desktop drop anywhere on the library → upload. Loose files land in the
  // library root; dropped folders become collections (nested trees preserved).
  async function onPageDrop(e: React.DragEvent) {
    if (!dtHasFiles(e.dataTransfer)) return;
    e.preventDefault(); setDropOver(false); setBusy(true);
    try {
      const dropped = await readDropped(e.dataTransfer);
      if (dropped.length) {
        setProgress({ done: 0, total: dropped.length, pct: 0 });
        const r = await uploadDroppedTree(dropped, { parentId: collection || null, type: uploadType as Asset['type'], brand: uploadBrand, onProgress: (done, total, pct) => setProgress({ done, total, pct }) });
        await load(); toast(`Uploaded ${r.files} file${r.files === 1 ? '' : 's'}${r.collections ? ` · ${r.collections} collection${r.collections === 1 ? '' : 's'}` : ''}.`);
      }
    } catch (err) { toast(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); setProgress(null); }
  }
  // Drop an asset drag onto a collection chip → move it into that collection.
  async function onChipDrop(e: React.DragEvent, collectionId: string) {
    e.preventDefault(); e.stopPropagation(); setChipOver(null);
    const ids = readAssetIds(e.dataTransfer);
    if (!ids.length) return;
    try { await api.addToCollection(collectionId, ids); await load(); toast(`Moved ${ids.length} asset${ids.length === 1 ? '' : 's'}.`); }
    catch (err) { toast(err instanceof Error ? err.message : String(err)); }
  }
  async function runImport() {
    const urls = importText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (!urls.length) { toast('Paste at least one URL.'); return; }
    setBusy(true);
    try { const r = await api.importAssets(urls, uploadType as Asset['type']); setImportText(''); setShowImport(false); await load(); toast(`Imported ${r.imported.length}${r.errorCount ? ` · ${r.errorCount} failed` : ''}.`); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  // One-click: run Claude vision on every image that has no description yet
  // (a proxy for "not AI-tagged"), 3 at a time, with the progress overlay.
  async function aiTagUntagged() {
    setMenuAnchor(null); setBusy(true);
    try {
      const all = await api.listAssets({});
      const targets = all.filter((a) => mediaKind(a.content_type, a.filename) === 'image' && !a.description);
      if (!targets.length) { toast('No untagged images to process.'); return; }
      setProgress({ done: 0, total: targets.length, pct: 0 });
      let done = 0;
      const lanes: Asset[][] = [[], [], []];
      targets.forEach((a, i) => lanes[i % 3].push(a));
      await Promise.all(lanes.map(async (lane) => {
        for (const a of lane) { try { await api.aiTag(a.id); } catch { /* skip failures */ } done++; setProgress({ done, total: targets.length, pct: 0 }); }
      }));
      await load(); toast(`AI-tagged ${done} image${done === 1 ? '' : 's'}.`);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); setProgress(null); }
  }
  async function migrate() {
    setBusy(true);
    try { const r = await api.migrateBucket(); await load(); toast(`Imported ${r.migrated} existing bucket file${r.migrated === 1 ? '' : 's'}.`); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function shareCollection(id: string) {
    try {
      const s = await api.createShare({ kind: 'collection', collectionId: id, allowDownload: true });
      await navigator.clipboard.writeText(`${location.origin}/s/${s.token}`);
      toast('Collection share link copied.');
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }
  const activeCollection = collections.find((c) => c.id === collection) || null;

  // Media-kind filter is applied client-side (derived from content type / extension).
  const shownAssets = useMemo(
    () => (media ? assets.filter((a) => mediaKind(a.content_type, a.filename) === media) : assets),
    [assets, media],
  );

  // When viewing "All assets" (no single collection selected), group into
  // sections per collection, plus an Uncategorized bucket. An asset in multiple
  // collections appears under each.
  const sections = useMemo(() => {
    if (collection) return null;
    const list = collections
      .map((c) => ({ key: c.id, name: c.name, collection: c, items: shownAssets.filter((a) => (a.collections || []).some((ac) => ac.id === c.id)) }))
      .filter((s) => s.items.length);
    const uncategorized = shownAssets.filter((a) => !(a.collections || []).length);
    if (uncategorized.length) list.push({ key: '_none', name: 'Uncategorized', collection: null as unknown as Collection, items: uncategorized });
    return list;
  }, [shownAssets, collections, collection]);

  // Landing rails (shown before any search): newest uploads + recently viewed.
  const recentlyAdded = useMemo(() => [...assets].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 12), [assets]);
  const recentlyViewed = useMemo(() => {
    const byId = new Map(assets.map((a) => [a.id, a]));
    return getRecents().map((id) => byId.get(id)).filter(Boolean).slice(0, 12) as Asset[];
  }, [assets]);

  const hasFilters = !!(q || type || brand || tag || collection || media);
  // Nothing is shown until the operator searches or narrows down — a search /
  // filter / collection / brand scope / tag / media / type must be active.
  const browsing = hasFilters || brandScope !== 'all';
  const clearFilters = () => { setQ(''); setType(''); setBrand(''); setTag(''); setCollection(''); setMedia(''); };
  const selectedIds = [...selected];

  return (
    <Stack
      spacing={2}
      onDragOver={(e) => { if (dtHasFiles(e.dataTransfer)) { e.preventDefault(); setDropOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropOver(false); }}
      onDrop={onPageDrop}
      sx={{ position: 'relative', minHeight: '60vh' }}
    >
      {dropOver && !progress && (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, bgcolor: 'rgba(15,23,42,.55)', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <Stack alignItems="center" spacing={1.5} sx={{ color: '#fff' }}>
            <UploadCloud size={44} />
            <Typography variant="h6">{collection ? `Drop to add to “${activeCollection?.name}”` : 'Drop files or folders to upload'}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>{collection ? 'Folders become sub-folders' : 'Folders become collections'}</Typography>
          </Stack>
        </Box>
      )}
      {progress && (
        <Box sx={{ position: 'fixed', inset: 0, zIndex: 1300, bgcolor: 'rgba(15,23,42,.6)', display: 'grid', placeItems: 'center' }}>
          <Paper sx={{ p: 3, width: 360, maxWidth: '90vw', borderRadius: 3 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <UploadCloud size={20} />
                <Typography variant="subtitle1" sx={{ flex: 1 }}>Uploading…</Typography>
                <Typography variant="subtitle1" fontWeight={700}>{overallPct}%</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={overallPct} sx={{ height: 8, borderRadius: 4 }} />
              <Typography variant="caption" color="text.secondary">
                File {Math.min(progress.done + 1, progress.total)} of {progress.total}
              </Typography>
            </Stack>
          </Paper>
        </Box>
      )}
      <PageHeader
        title="Library"
        subtitle={`${shownAssets.length} asset${shownAssets.length === 1 ? '' : 's'}${hasFilters ? ' · filtered' : ''} · Alameda Soda + Brix`}
        actions={(
          <>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Upload as</InputLabel>
              <Select label="Upload as" value={uploadType} onChange={async (e) => { if (e.target.value === '__add__') { const s = await addType(); if (s) setUploadType(s); } else setUploadType(e.target.value); }}>
                {typeList.map((t) => <MenuItem key={t.slug} value={t.slug}>{t.label}</MenuItem>)}
                <MenuItem value="__add__" sx={{ fontStyle: 'italic' }}>＋ Add type…</MenuItem>
              </Select>
            </FormControl>
            <Button component="label" variant="contained" startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Upload size={16} />} disabled={busy}>
              Upload
              <input hidden type="file" multiple onChange={(e) => { upload(e.target.files); e.currentTarget.value = ''; }} />
            </Button>
            <Tooltip title="Upload folders — each folder becomes a collection">
              <Button variant="outlined" startIcon={<FolderPlus size={16} />} disabled={busy} onClick={() => folderRef.current?.click()}>
                Upload folder
              </Button>
            </Tooltip>
            <input
              ref={(el) => { folderRef.current = el; if (el) { el.setAttribute('webkitdirectory', ''); el.setAttribute('directory', ''); } }}
              hidden type="file" multiple
              onChange={(e) => { uploadFolders(e.target.files); e.currentTarget.value = ''; }}
            />
            <Button variant="outlined" startIcon={<Globe size={16} />} onClick={() => setShowImport((v) => !v)}>Import URL</Button>
            {view === 'grid' && (
              <Button variant={selectMode ? 'contained' : 'outlined'} color="secondary" onClick={() => { setSelectMode((v) => !v); setSelected(new Set()); }}>
                {selectMode ? 'Done' : 'Select'}
              </Button>
            )}
            <Button variant="text" sx={{ minWidth: 0, px: 1 }} onClick={(e) => setMenuAnchor(e.currentTarget)} aria-label="More actions"><MoreVertical size={18} /></Button>
            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
              <MenuItem disabled={busy} onClick={() => { setMenuAnchor(null); migrate(); }}>
                <Download size={15} style={{ marginRight: 8 }} /> Register existing bucket files
              </MenuItem>
              <MenuItem disabled={busy} onClick={aiTagUntagged}>
                <Sparkles size={15} style={{ marginRight: 8 }} /> AI-tag untagged images
              </MenuItem>
            </Menu>
          </>
        )}
      />

      {collections.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', flex: 1, pb: 0.5, '&::-webkit-scrollbar': { height: 6 } }}>
            <Chip
              label="All assets"
              clickable
              onClick={() => setCollection('')}
              color={collection === '' ? 'primary' : 'default'}
              variant={collection === '' ? 'filled' : 'outlined'}
            />
            {collections.map((c) => (
              <Chip
                key={c.id}
                label={typeof c.count === 'number' ? `${c.name} · ${c.count}` : c.name}
                clickable
                onClick={() => setCollection(c.id)}
                onDragOver={(e) => { e.preventDefault(); if (!dtHasFiles(e.dataTransfer)) setChipOver(c.id); }}
                onDragLeave={() => setChipOver((v) => (v === c.id ? null : v))}
                onDrop={(e) => onChipDrop(e, c.id)}
                color={chipOver === c.id ? 'primary' : collection === c.id ? 'primary' : 'default'}
                variant={collection === c.id || chipOver === c.id ? 'filled' : 'outlined'}
                sx={{ flexShrink: 0, ...(chipOver === c.id ? { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 } : {}) }}
              />
            ))}
          </Stack>
          {activeCollection && (
            <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
              <Tooltip title="Copy a public share link for this collection">
                <Button size="small" startIcon={<Share2 size={15} />} onClick={() => shareCollection(activeCollection.id)}>Share</Button>
              </Tooltip>
              <Tooltip title="Manage this collection">
                <Button size="small" color="inherit" startIcon={<FolderOpen size={15} />} onClick={() => navigate(`/collections/${activeCollection.id}`)}>Manage</Button>
              </Tooltip>
            </Stack>
          )}
        </Box>
      )}

      {activeCollection && (
        <Typography variant="body2" color="text.secondary">
          Showing <b>{activeCollection.name}</b>{activeCollection.description ? ` — ${activeCollection.description}` : ''}
        </Typography>
      )}

      {showImport && (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField fullWidth size="small" multiline minRows={2} placeholder="Paste image/PDF URLs (one per line) — e.g. assets exported from Brandox" value={importText} onChange={(e) => setImportText(e.target.value)} />
            <Stack spacing={0.5}>
              <Button variant="contained" onClick={runImport} disabled={busy}>Import</Button>
              <Button size="small" color="inherit" startIcon={<X size={14} />} onClick={() => setShowImport(false)}>Close</Button>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 3 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField
            size="small" placeholder="Search assets…" value={q} onChange={(e) => setQ(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 130 }}><InputLabel>Type</InputLabel>
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}><MenuItem value="">All types</MenuItem>{typeList.map((t) => <MenuItem key={t.slug} value={t.slug}>{t.label}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}><InputLabel>Brand</InputLabel>
            <Select label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}><MenuItem value="">All brands</MenuItem>{brandList.map((b) => <MenuItem key={b.slug} value={b.slug}>{b.label}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>Tag</InputLabel>
            <Select label="Tag" value={tag} onChange={(e) => setTag(e.target.value)}><MenuItem value="">All tags</MenuItem>{tags.map((t) => <MenuItem key={t.id} value={t.id}>{t.name} ({t.count})</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}><InputLabel>Media</InputLabel>
            <Select label="Media" value={media} onChange={(e) => setMedia(e.target.value)}><MenuItem value="">All media</MenuItem>{MEDIA_KINDS.map((k) => <MenuItem key={k} value={k}>{MEDIA_META[k].label}</MenuItem>)}</Select></FormControl>
          {hasFilters && <Button size="small" color="inherit" startIcon={<X size={14} />} onClick={clearFilters}>Clear</Button>}
          <ToggleButtonGroup
            size="small" exclusive value={view}
            onChange={(_, v) => { if (v) { setView(v); setSelectMode(false); setSelected(new Set()); } }}
          >
            <ToggleButton value="grid" aria-label="Grid view"><Tooltip title="Grid"><LayoutGrid size={16} /></Tooltip></ToggleButton>
            <ToggleButton value="table" aria-label="Table view"><Tooltip title="Table"><TableIcon size={16} /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
          <ToggleButtonGroup
            size="small" exclusive value={previewBg}
            onChange={(_, v) => { if (v) setPreviewBg(v); }}
          >
            <ToggleButton value="light" aria-label="White background"><Tooltip title="White"><Sun size={16} /></Tooltip></ToggleButton>
            <ToggleButton value="dark" aria-label="Dark background"><Tooltip title="Dark"><Moon size={16} /></Tooltip></ToggleButton>
            <ToggleButton value="none" aria-label="No background"><Tooltip title="None"><Ban size={16} /></Tooltip></ToggleButton>
            <ToggleButton value="diecut" aria-label="Die-cut / transparency"><Tooltip title="Die cut (transparency)"><Grid3x3 size={16} /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {error && <Alert severity="warning" action={<Button size="small" onClick={load}>Retry</Button>}>{error}</Alert>}

      {!browsing ? (
        <Stack spacing={3}>
          <EmptyState
            icon={<Search size={28} />}
            title="Search or pick a folder to begin"
            description="Search above (or press ⌘K), choose a brand in the sidebar, or select a collection, type, or tag. Your recent items are below."
          />
          {recentlyViewed.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Recently viewed</Typography>
              <AssetGrid assets={recentlyViewed} onOpen={setOpen} />
            </Box>
          )}
          {recentlyAdded.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Recently added</Typography>
              <AssetGrid assets={recentlyAdded} onOpen={setOpen} />
            </Box>
          )}
        </Stack>
      ) : loading ? <GridSkeleton />
        : !shownAssets.length ? (
          <EmptyState
            icon={<Images size={28} />}
            title={hasFilters ? 'No assets match your filters' : 'Your brand library is empty'}
            description={hasFilters ? 'Try clearing a filter or searching for something else.' : 'Upload logos, can art, equipment shots, hero images, or sell sheets — or register files already in the bucket from the ⋮ menu.'}
            action={!hasFilters ? (
              <Button component="label" variant="contained" startIcon={<Upload size={16} />}>
                Upload assets
                <input hidden type="file" multiple onChange={(e) => { upload(e.target.files); e.currentTarget.value = ''; }} />
              </Button>
            ) : <Button variant="outlined" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : sections ? (
          <Stack spacing={3}>
            {sections.map((s) => (
              <Box key={s.key}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <Typography variant="subtitle1">{s.name}</Typography>
                  <Chip size="small" variant="outlined" label={s.items.length} />
                  {s.collection && (
                    <>
                      <Box sx={{ flex: 1 }} />
                      <Button size="small" startIcon={<Share2 size={14} />} onClick={() => shareCollection(s.collection.id)}>Share</Button>
                      <Button size="small" color="inherit" startIcon={<FolderOpen size={14} />} onClick={() => navigate(`/collections/${s.collection.id}`)}>Manage</Button>
                    </>
                  )}
                </Stack>
                {view === 'table'
                  ? <AssetTable autoHeight assets={s.items} selected={selected} onSelectionChange={(ids) => mergeSectionSelection(s.items, ids)} onOpen={setOpen} />
                  : <AssetGrid assets={s.items} onOpen={setOpen} selectable={selectMode} selected={selected} onToggleSelect={toggleSelect} />}
              </Box>
            ))}
          </Stack>
        ) : view === 'table' ? (
          <AssetTable assets={shownAssets} selected={selected} onSelectionChange={(ids) => setSelected(new Set(ids))} onOpen={setOpen} />
        ) : (
          <AssetGrid assets={shownAssets} onOpen={setOpen} selectable={selectMode} selected={selected} onToggleSelect={toggleSelect} />
        )}

      {(selectMode || view === 'table') && selectedIds.length > 0 && (
        <BulkActionBar
          ids={selectedIds}
          assets={assets}
          collections={collections}
          onDone={() => { setSelected(new Set()); load(); }}
          onClear={() => setSelected(new Set())}
        />
      )}

      {open && (
        <AssetDialog
          asset={open}
          collections={collections}
          allTags={tags.map((t) => t.name)}
          onClose={() => setOpen(null)}
          onSaved={(a) => { setAssets((cur) => cur.map((x) => (x.id === a.id ? a : x))); setOpen(null); load(); }}
          onDeleted={(id) => { setAssets((cur) => cur.filter((x) => x.id !== id)); setOpen(null); }}
        />
      )}
    </Stack>
  );
}
