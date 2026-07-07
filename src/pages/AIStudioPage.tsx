import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, FormControl, InputLabel, MenuItem,
  Paper, Select, Stack, TextField, Typography,
} from '@mui/material';
import { Sparkles, Wand2, Save, Download, ShieldAlert, ImageOff } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useIsAdmin } from '../lib/useIsAdmin';
import { useBrands } from '../lib/useBrands';
import { useTypes } from '../lib/useTypes';
import { api } from '../lib/api';
import type { Asset } from '../lib/types';
import { useToast } from '../components/Toast';

const PRESETS = [
  'on a polished marble bar top, soft studio lighting, shallow depth of field',
  'flat lay on rustic wood with fresh citrus and mint, bright natural daylight',
  'minimal seamless gradient studio backdrop, product spotlight, e-commerce hero',
  'lifestyle cocktail bar scene at golden hour, warm bokeh background',
  'clean white studio with a soft contact shadow, crisp product hero',
];

export function AIStudioPage() {
  const isAdmin = useIsAdmin();
  const toast = useToast();
  const { brands } = useBrands();
  const { types } = useTypes();

  const [brandFilter, setBrandFilter] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Asset[]>([]);
  const [source, setSource] = useState<Asset | null>(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const [saveTitle, setSaveTitle] = useState('');
  const [saveType, setSaveType] = useState('hero');
  const [saveBrand, setSaveBrand] = useState('shared');
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  // Search the library for a source product.
  useEffect(() => {
    if (isAdmin !== true) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const a = await api.listAssets({ q: search.trim() || undefined, brand: brandFilter || undefined });
        if (live) setResults(a.filter((x) => x.thumbnailUrl).slice(0, 24));
      } catch { if (live) setResults([]); }
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [search, brandFilter, isAdmin]);

  const canGenerate = useMemo(() => prompt.trim().length > 3 && !busy, [prompt, busy]);

  async function generate() {
    setBusy(true); setPreview(null); setSavedUrl(null);
    try {
      const r = await api.generateImage({ assetId: source?.id, prompt: prompt.trim() });
      setPreview(r.image);
      setSaveBrand(source?.brand || 'shared');
      setSaveTitle(source ? `${source.title || source.filename} — scene` : 'AI scene');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function save() {
    if (!preview) return;
    setSaving(true);
    try {
      const r = await api.saveGeneratedImage({ imageData: preview, assetId: source?.id, title: saveTitle.trim() || undefined, brand: saveBrand, type: saveType });
      setSavedUrl(r.asset.url);
      toast('Saved to the library.');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
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
        subtitle="Generate on-brand website graphics with Gemini (Nano Banana). Pick a real product to keep it accurate, describe the scene, and save the result to the library."
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {/* Left: source + prompt */}
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle1" fontWeight={800}>1 · Pick a product (keeps it real)</Typography>
              <Stack direction="row" spacing={1}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Brand</InputLabel>
                  <Select label="Brand" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
                    <MenuItem value="">All brands</MenuItem>
                    {brands.map((b) => <MenuItem key={b.slug} value={b.slug}>{b.label}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField size="small" fullWidth placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </Stack>
              <Button size="small" variant={source ? 'outlined' : 'contained'} startIcon={<ImageOff size={15} />} onClick={() => setSource(null)} sx={{ alignSelf: 'flex-start' }}>
                No product (background only)
              </Button>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 1, maxHeight: 260, overflow: 'auto' }}>
                {results.map((a) => {
                  const sel = source?.id === a.id;
                  return (
                    <Box key={a.id} component="button" type="button" onClick={() => setSource(a)} title={a.title || a.filename || ''}
                      sx={{ p: 0, cursor: 'pointer', borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', aspectRatio: '1', border: '2px solid', borderColor: sel ? 'primary.main' : 'divider' }}>
                      <Box component="img" src={a.thumbnailUrl || a.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </Box>
                  );
                })}
                {!results.length && <Typography variant="caption" color="text.secondary" sx={{ gridColumn: '1 / -1', py: 1 }}>Search to find a product image.</Typography>}
              </Box>
              {source && <Chip size="small" color="primary" label={`Using: ${source.title || source.filename}`} onDelete={() => setSource(null)} />}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle1" fontWeight={800}>2 · Describe the scene</Typography>
              <TextField multiline minRows={3} placeholder="e.g. on a marble bar top with soft evening light and a blurred bar background" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {PRESETS.map((p) => <Chip key={p} size="small" variant="outlined" label={p.split(',')[0]} onClick={() => setPrompt(p)} />)}
              </Stack>
              <Button variant="contained" startIcon={busy ? <CircularProgress size={16} /> : <Wand2 size={16} />} disabled={!canGenerate} onClick={generate}>
                {preview ? 'Regenerate' : 'Generate'}
              </Button>
            </Stack>
          </Paper>
        </Stack>

        {/* Right: preview + save */}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Sparkles size={18} />
              <Typography variant="subtitle1" fontWeight={800}>3 · Preview & save</Typography>
            </Stack>
            <Box sx={{ borderRadius: 1, border: '1px dashed', borderColor: 'divider', minHeight: 280, display: 'grid', placeItems: 'center', overflow: 'hidden', bgcolor: 'action.hover' }}>
              {busy ? <CircularProgress />
                : preview ? <Box component="img" src={preview} alt="Generated" sx={{ maxWidth: '100%', maxHeight: 420, display: 'block' }} />
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
                {savedUrl && <Alert severity="success">Saved. It's now in the library and via the API.</Alert>}
              </>
            )}
          </Stack>
        </Paper>
      </Box>
    </Stack>
  );
}
