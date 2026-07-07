import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControl, FormControlLabel,
  InputLabel, MenuItem, Paper, Select, Slider, Stack, TextField, Typography,
} from '@mui/material';
import { Sparkles, Wand2, Save, Download, ShieldAlert, Upload, X } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useIsAdmin } from '../lib/useIsAdmin';
import { useBrands } from '../lib/useBrands';
import { useTypes } from '../lib/useTypes';
import { api } from '../lib/api';
import type { Asset } from '../lib/types';
import { useToast } from '../components/Toast';

const PRESETS = [
  'on a polished marble bar top, soft evening light, shallow depth of field',
  'flat lay on rustic wood with fresh citrus and mint, bright natural daylight',
  'minimal seamless gradient studio backdrop, product spotlight, e-commerce hero',
  'lifestyle cocktail bar scene at golden hour, warm bokeh background',
  'clean white studio with a soft contact shadow, crisp product hero',
];

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(r.error || new Error('read failed'));
    r.readAsDataURL(file);
  });
}

export function AIStudioPage() {
  const isAdmin = useIsAdmin();
  const toast = useToast();
  const { brands } = useBrands();
  const { types } = useTypes();

  const [brandFilter, setBrandFilter] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Asset[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Asset[]>([]);
  const [upload, setUpload] = useState<{ dataUrl: string; name: string } | null>(null);

  const [prompt, setPrompt] = useState('');
  const [brand, setBrand] = useState('');
  const [useGuidelines, setUseGuidelines] = useState(true);
  const [useBrandImages, setUseBrandImages] = useState(false);
  const [brandImageCount, setBrandImageCount] = useState(3);

  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState('');
  const [saveType, setSaveType] = useState('hero');
  const [saveBrand, setSaveBrand] = useState('shared');
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin !== true) return;
    let live = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const a = await api.listAssets({ q: search.trim() || undefined, brand: brandFilter || undefined });
        if (live) setResults(a.filter((x) => x.thumbnailUrl).slice(0, 120));
      } catch { if (live) setResults([]); }
      finally { if (live) setSearching(false); }
    }, 220);
    return () => { live = false; clearTimeout(t); };
  }, [search, brandFilter, isAdmin]);

  // Default the brand used for guidelines to the first selected product's brand.
  useEffect(() => {
    if (!brand && selected[0]?.brand && selected[0].brand !== 'shared') setBrand(selected[0].brand);
  }, [selected, brand]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  const toggle = (a: Asset) => setSelected((cur) => cur.some((x) => x.id === a.id) ? cur.filter((x) => x.id !== a.id) : [...cur, a]);
  const canGenerate = (prompt.trim().length > 3 || selected.length > 0 || !!upload) && !busy;

  async function onUpload(files: FileList | null) {
    const f = files?.[0]; if (!f) return;
    try { setUpload({ dataUrl: await readFileBase64(f), name: f.name }); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }

  async function generate() {
    setBusy(true); setPreview(null); setSavedUrl(null);
    try {
      const effectiveBrand = brand || selected[0]?.brand || undefined;
      const r = await api.generateImage({
        assetIds: selected.map((s) => s.id),
        uploadData: upload?.dataUrl,
        uploadMime: upload ? upload.dataUrl.slice(5, upload.dataUrl.indexOf(';')) : undefined,
        prompt: prompt.trim() || 'Compose an on-brand marketing graphic from the provided images.',
        brand: effectiveBrand,
        useBrandGuidelines: useGuidelines,
        useBrandImages,
        brandImageCount,
      });
      setPreview(r.image);
      setSaveBrand(effectiveBrand || 'shared');
      setSaveTitle(selected[0] ? `${selected[0].title || selected[0].filename} — scene` : 'AI scene');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function save() {
    if (!preview) return;
    setSaving(true);
    try {
      const r = await api.saveGeneratedImage({ imageData: preview, assetId: selected[0]?.id, title: saveTitle.trim() || undefined, brand: saveBrand, type: saveType });
      setSavedUrl(r.asset.url);
      toast('Saved to the library.');
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  }

  if (isAdmin === null) return <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box>;
  if (!isAdmin) {
    return (
      <Stack spacing={2}>
        <PageHeader title="AI Studio" subtitle="Admin only" />
        <Alert severity="warning" icon={<ShieldAlert size={18} />}>This page is available to Fountain DAM admins only.</Alert>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="AI Studio"
        subtitle="Generate on-brand graphics with Gemini (Nano Banana). Pick one or more real products (and/or upload a photo), describe the scene, and it merges them on-brand."
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle1" fontWeight={800}>1 · Choose images (pick as many as you want)</Typography>
              <Stack direction="row" spacing={1}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Brand</InputLabel>
                  <Select label="Brand" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
                    <MenuItem value="">All brands</MenuItem>
                    {brands.map((b) => <MenuItem key={b.slug} value={b.slug}>{b.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField size="small" fullWidth placeholder="Search products, flavors, sizes…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button component="label" size="small" variant="outlined" startIcon={<Upload size={15} />}>
                  Upload
                  <input hidden type="file" accept="image/*" onChange={(e) => { onUpload(e.target.files); e.currentTarget.value = ''; }} />
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {searching ? 'Searching…' : `${results.length} match${results.length === 1 ? '' : 'es'}`}{selected.length ? ` · ${selected.length} selected` : ''}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 1, maxHeight: 300, overflow: 'auto' }}>
                {upload && (
                  <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', aspectRatio: '1', border: '2px solid', borderColor: 'success.main' }}>
                    <Box component="img" src={upload.dataUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    <Chip size="small" color="success" label="Upload" sx={{ position: 'absolute', bottom: 2, left: 2, height: 18, fontSize: 10 }} />
                    <Box component="button" onClick={() => setUpload(null)} sx={{ position: 'absolute', top: 2, right: 2, border: 'none', cursor: 'pointer', bgcolor: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'grid', placeItems: 'center' }}><X size={11} /></Box>
                  </Box>
                )}
                {results.map((a) => {
                  const sel = selectedIds.has(a.id);
                  return (
                    <Box key={a.id} component="button" type="button" onClick={() => toggle(a)} title={a.title || a.filename || ''}
                      sx={{ position: 'relative', p: 0, cursor: 'pointer', borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', aspectRatio: '1', border: '2px solid', borderColor: sel ? 'primary.main' : 'divider' }}>
                      <Box component="img" src={a.thumbnailUrl || a.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      {sel && <Box sx={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>✓</Box>}
                    </Box>
                  );
                })}
                {!results.length && !searching && <Typography variant="caption" color="text.secondary" sx={{ gridColumn: '1 / -1', py: 1 }}>No matches — try fewer / different words.</Typography>}
              </Box>
              {selected.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {selected.map((s) => <Chip key={s.id} size="small" label={s.title || s.filename} onDelete={() => toggle(s)} />)}
                </Stack>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle1" fontWeight={800}>2 · Brand identity</Typography>
              <FormControl size="small" sx={{ maxWidth: 240 }}>
                <InputLabel>Brand for identity</InputLabel>
                <Select label="Brand for identity" value={brand} onChange={(e) => setBrand(e.target.value)}>
                  <MenuItem value="">Auto (from selection)</MenuItem>
                  {brands.map((b) => <MenuItem key={b.slug} value={b.slug}>{b.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControlLabel control={<Checkbox size="small" checked={useGuidelines} onChange={(e) => setUseGuidelines(e.target.checked)} />} label={<Typography variant="body2">Follow brand guidelines (colors, fonts, tone)</Typography>} />
              <FormControlLabel control={<Checkbox size="small" checked={useBrandImages} onChange={(e) => setUseBrandImages(e.target.checked)} />} label={<Typography variant="body2">Match the brand’s existing images (visual identity)</Typography>} />
              {useBrandImages && (
                <Box sx={{ pl: 1, maxWidth: 260 }}>
                  <Typography variant="caption" color="text.secondary">Reference images: {brandImageCount}</Typography>
                  <Slider size="small" min={1} max={4} step={1} value={brandImageCount} onChange={(_, v) => setBrandImageCount(v as number)} marks />
                </Box>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle1" fontWeight={800}>3 · Describe the scene</Typography>
              <TextField multiline minRows={3} placeholder="e.g. merge these into a hero banner on a marble bar top, warm evening light" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {PRESETS.map((p) => <Chip key={p} size="small" variant="outlined" label={p.split(',')[0]} onClick={() => setPrompt(p)} />)}
              </Stack>
              <Button variant="contained" startIcon={busy ? <CircularProgress size={16} /> : <Wand2 size={16} />} disabled={!canGenerate} onClick={generate}>
                {preview ? 'Regenerate' : 'Generate'}
              </Button>
            </Stack>
          </Paper>
        </Stack>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center"><Sparkles size={18} /><Typography variant="subtitle1" fontWeight={800}>4 · Preview & save</Typography></Stack>
            <Box sx={{ borderRadius: 1, border: '1px dashed', borderColor: 'divider', minHeight: 300, display: 'grid', placeItems: 'center', overflow: 'hidden', bgcolor: 'action.hover' }}>
              {busy ? <CircularProgress />
                : preview ? <Box component="img" src={preview} alt="Generated" sx={{ maxWidth: '100%', maxHeight: 460, display: 'block' }} />
                : <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>Your generated graphic appears here.</Typography>}
            </Box>
            {preview && (
              <>
                <Divider />
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <TextField size="small" label="Title" value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} sx={{ flex: 1, minWidth: 180 }} />
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Type</InputLabel>
                    <Select label="Type" value={saveType} onChange={(e) => setSaveType(e.target.value)}>
                      {types.map((t) => <MenuItem key={t.slug} value={t.slug}>{t.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Brand</InputLabel>
                    <Select label="Brand" value={saveBrand} onChange={(e) => setSaveBrand(e.target.value)}>
                      {brands.map((b) => <MenuItem key={b.slug} value={b.slug}>{b.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" startIcon={saving ? <CircularProgress size={16} /> : <Save size={16} />} disabled={saving} onClick={save}>Save to library</Button>
                  <Button variant="outlined" startIcon={<Download size={16} />} component="a" href={preview} download={`${(saveTitle || 'ai-scene').replace(/[^a-z0-9]+/gi, '-')}.png`}>Download</Button>
                </Stack>
                {savedUrl && <Alert severity="success">Saved — it’s in the library and available via the API.</Alert>}
              </>
            )}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
