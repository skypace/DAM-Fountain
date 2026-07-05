import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem,
  Select, Stack, TextField, Typography,
} from '@mui/material';
import { Upload, Globe, Download } from 'lucide-react';
import type { Asset, Collection, Tag } from '../lib/types';
import { ASSET_TYPES, BRANDS } from '../lib/types';
import { api, fileToBase64, type AssetFilters } from '../lib/api';
import { AssetGrid } from '../components/AssetGrid';
import { AssetDialog } from '../components/AssetDialog';
import { useToast } from '../components/Toast';

export function LibraryPage() {
  const toast = useToast();
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
  const [uploadType, setUploadType] = useState('other');

  const filters = useMemo<AssetFilters>(() => ({ q: q || undefined, type: type || undefined, brand: brand || undefined, tag: tag || undefined }), [q, type, brand, tag]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [a, t, c] = await Promise.all([api.listAssets(filters), api.listTags(), api.listCollections()]);
      setAssets(a); setTags(t); setCollections(c);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [q, type, brand, tag]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    try {
      for (const f of Array.from(files)) {
        const dataBase64 = await fileToBase64(f);
        await api.uploadAsset({ filename: f.name, contentType: f.type || 'application/octet-stream', dataBase64, type: uploadType as Asset['type'] });
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

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
        <Typography variant="h6">Library</Typography>
        <Chip size="small" variant="outlined" label={`${assets.length} asset${assets.length === 1 ? '' : 's'}`} />
        <Box sx={{ flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Upload as</InputLabel>
          <Select label="Upload as" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
            {ASSET_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <Button component="label" variant="contained" startIcon={busy ? <CircularProgress size={16} /> : <Upload size={16} />} disabled={busy}>
          Upload
          <input hidden type="file" multiple accept="image/*,application/pdf" onChange={(e) => { upload(e.target.files); e.currentTarget.value = ''; }} />
        </Button>
        <Button variant="outlined" startIcon={<Globe size={16} />} onClick={() => setShowImport((v) => !v)}>Import URL</Button>
        <Button variant="text" startIcon={<Download size={16} />} onClick={migrate} disabled={busy} title="Register files already in the brand-assets bucket">Import bucket</Button>
      </Stack>

      {showImport && (
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField fullWidth size="small" multiline minRows={2} placeholder="Paste image/PDF URLs (one per line) — e.g. assets exported from Brandox" value={importText} onChange={(e) => setImportText(e.target.value)} />
          <Button variant="contained" onClick={runImport} disabled={busy}>Import</Button>
        </Stack>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <TextField size="small" label="Search" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 200, flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 130 }}><InputLabel>Type</InputLabel>
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}><MenuItem value="">All types</MenuItem>{ASSET_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}><InputLabel>Brand</InputLabel>
          <Select label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)}><MenuItem value="">All brands</MenuItem>{BRANDS.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}><InputLabel>Tag</InputLabel>
          <Select label="Tag" value={tag} onChange={(e) => setTag(e.target.value)}><MenuItem value="">All tags</MenuItem>{tags.map((t) => <MenuItem key={t.id} value={t.id}>{t.name} ({t.count})</MenuItem>)}</Select></FormControl>
      </Stack>

      {error && <Alert severity="warning" action={<Button size="small" onClick={load}>Retry</Button>}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box>
        : <AssetGrid assets={assets} onOpen={setOpen} />}

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
