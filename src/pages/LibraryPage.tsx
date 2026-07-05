import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputAdornment, InputLabel, Menu,
  MenuItem, Paper, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import { Upload, Globe, Download, Search, Images, MoreVertical, X, LayoutGrid, Table as TableIcon, Share2, FolderOpen } from 'lucide-react';
import type { Asset, Collection, Tag } from '../lib/types';
import { ASSET_TYPES, BRANDS } from '../lib/types';
import { api, type AssetFilters } from '../lib/api';
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

  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  // Merge a section table's selection into the global set without disturbing
  // selections made in other sections.
  const mergeSectionSelection = (items: Asset[], ids: string[]) => setSelected((prev) => {
    const itemIds = new Set(items.map((a) => a.id));
    return new Set([...[...prev].filter((id) => !itemIds.has(id)), ...ids]);
  });

  const filters = useMemo<AssetFilters>(() => ({ q: q || undefined, type: type || undefined, brand: brand || undefined, tag: tag || undefined, collection: collection || undefined }), [q, type, brand, tag, collection]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [a, t, c] = await Promise.all([api.listAssets(filters), api.listTags(), api.listCollections()]);
      setAssets(a); setTags(t); setCollections(c);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [q, type, brand, tag, collection]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    try {
      for (const f of Array.from(files)) {
        await api.uploadFile(f, { type: uploadType as Asset['type'] });
        ok++;
      }
      toast(`Uploaded ${ok} asset${ok === 1 ? '' : 's'}.`); await load();
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function runImport() {
    const urls = importText.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (!urls.length) { toast('Paste at least one URL.'); return; }
    setBusy(true);
    try { const r = await api.importAssets(urls, uploadType as Asset['type']); setImportText(''); setShowImport(false); await load(); toast(`Imported ${r.imported.length}${r.errorCount ? ` · ${r.errorCount} failed` : ''}.`); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
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

  const hasFilters = !!(q || type || brand || tag || collection || media);
  const clearFilters = () => { setQ(''); setType(''); setBrand(''); setTag(''); setCollection(''); setMedia(''); };
  const selectedIds = [...selected];

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Library"
        subtitle={`${shownAssets.length} asset${shownAssets.length === 1 ? '' : 's'}${hasFilters ? ' · filtered' : ''} · Alameda Soda + Brix`}
        actions={(
          <>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Upload as</InputLabel>
              <Select label="Upload as" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                {ASSET_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <Button component="label" variant="contained" startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Upload size={16} />} disabled={busy}>
              Upload
              <input hidden type="file" multiple onChange={(e) => { upload(e.target.files); e.currentTarget.value = ''; }} />
            </Button>
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
                color={collection === c.id ? 'primary' : 'default'}
                variant={collection === c.id ? 'filled' : 'outlined'}
                sx={{ flexShrink: 0 }}
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
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}><MenuItem value="">All types</MenuItem>{ASSET_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}><InputLabel>Brand</InputLabel>
            <Select label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}><MenuItem value="">All brands</MenuItem>{BRANDS.map((b) => <MenuItem key={b} value={b} sx={{ textTransform: 'capitalize' }}>{b}</MenuItem>)}</Select></FormControl>
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
        </Stack>
      </Paper>

      {error && <Alert severity="warning" action={<Button size="small" onClick={load}>Retry</Button>}>{error}</Alert>}

      {loading ? <GridSkeleton />
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
