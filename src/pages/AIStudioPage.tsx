import { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControl, FormControlLabel,
  InputLabel, MenuItem, Paper, Select, Slider, Stack, TextField, Typography,
} from '@mui/material';
import { Sparkles, Wand2, Save, Download, ShieldAlert, Upload, X, Crop } from 'lucide-react';
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

const DISPLAY = "'Space Grotesk', 'DM Sans', system-ui, sans-serif";

// Branded header for the studio — °bx logo tile + gradient wordmark on a soft
// grey field with a subtle navy glow.
function StudioHero() {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        p: { xs: 2.5, md: 3.5 },
        color: '#0f172a',
        border: '1px solid #e2e8f0',
        background:
          'radial-gradient(900px 260px at 12% -30%, rgba(31,78,121,.16), transparent 70%),' +
          'radial-gradient(700px 240px at 100% 120%, rgba(59,130,246,.14), transparent 70%),' +
          'linear-gradient(135deg, #ffffff 0%, #eef2f8 60%, #e7ecf4 100%)',
        boxShadow: '0 10px 30px rgba(15,23,42,.06)',
      }}
    >
      {/* soft sheen */}
      <Box sx={{ position: 'absolute', top: -40, right: -30, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.18), transparent 70%)', filter: 'blur(6px)', pointerEvents: 'none' }} />
      <Stack direction="row" spacing={2} alignItems="center" sx={{ position: 'relative' }}>
        <Box
          sx={{
            width: { xs: 56, md: 66 }, height: { xs: 56, md: 66 }, flexShrink: 0,
            borderRadius: '20px',
            background: 'linear-gradient(150deg, #24578a 0%, #1f4e79 55%, #163a5c 100%)',
            display: 'grid', placeItems: 'center',
            boxShadow: '0 10px 22px rgba(31,78,121,.45), inset 0 1px 0 rgba(255,255,255,.25)',
          }}
        >
          <Typography sx={{ fontFamily: DISPLAY, fontWeight: 700, color: '#fff', fontSize: { xs: 26, md: 30 }, lineHeight: 1, letterSpacing: '-1px' }}>
            <span style={{ verticalAlign: 'super', fontSize: '0.5em', opacity: 0.9 }}>°</span>bx
          </Typography>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 12, letterSpacing: '3px', textTransform: 'uppercase', color: '#1f4e79' }}>
            Brix · Generative
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: DISPLAY, fontWeight: 700, lineHeight: 1.02, letterSpacing: '-1.2px',
              fontSize: { xs: 30, md: 40 },
              background: 'linear-gradient(92deg, #1f4e79 0%, #2f6fac 45%, #3b82f6 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}
          >
            AI Studio
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
            <Typography variant="body2" sx={{ color: '#475569' }}>
              Compose on-brand graphics from your real products.
            </Typography>
            <Chip size="small" icon={<Sparkles size={13} />} label="Gemini · Nano Banana"
              sx={{ fontFamily: DISPLAY, fontWeight: 600, bgcolor: 'rgba(31,78,121,.08)', color: '#1f4e79', border: '1px solid rgba(31,78,121,.18)' }} />
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
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
  const [refineText, setRefineText] = useState('');
  const [refining, setRefining] = useState(false);
  // Region selector: normalized {x,y,w,h} 0..1 over the preview image.
  const [region, setRegion] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [regionMode, setRegionMode] = useState(false);
  const [draft, setDraft] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  const drawStart = useRef<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
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

  const toggle = (a: Asset) => setSelected((cur) => cur.some((x) => x.id === a.id) ? cur.filter((x) => x.id !== a.id) : [...cur, a]);
  const canGenerate = (prompt.trim().length > 3 || selected.length > 0 || !!upload) && !busy;
  // Labels are assigned in the same order the backend receives them: upload first, then selected.
  const letter = (i: number) => String.fromCharCode(65 + i);
  const selLetter = (i: number) => letter((upload ? 1 : 0) + i);

  async function onUpload(files: FileList | null) {
    const f = files?.[0]; if (!f) return;
    try { setUpload({ dataUrl: await readFileBase64(f), name: f.name }); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }

  async function generate() {
    setBusy(true); setPreview(null); setSavedUrl(null); setRegion(null); setRegionMode(false);
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

  // Burn a magenta marker onto a copy of the preview so the model edits only that
  // region. Returns the plain preview if no region is selected.
  function annotatedBase(): Promise<{ data: string; mime: string }> {
    return new Promise((resolve, reject) => {
      if (!preview) return reject(new Error('no image'));
      if (!region) return resolve({ data: preview, mime: preview.slice(5, preview.indexOf(';')) || 'image/png' });
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('canvas unavailable'));
        ctx.drawImage(img, 0, 0);
        const x = region.x * c.width, y = region.y * c.height, w = region.w * c.width, h = region.h * c.height;
        ctx.fillStyle = 'rgba(255,0,255,0.16)'; ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = Math.max(4, c.width * 0.006); ctx.strokeRect(x, y, w, h);
        resolve({ data: c.toDataURL('image/png'), mime: 'image/png' });
      };
      img.onerror = () => reject(new Error('image load failed'));
      img.src = preview;
    });
  }

  // Iterative edit: feed the current preview back in + a change instruction.
  async function refine() {
    if (!preview || !refineText.trim()) return;
    setRefining(true);
    try {
      const base = await annotatedBase();
      const instruction = region
        ? `Edit ONLY the area inside the magenta rectangle; do NOT render the rectangle in the output and blend the edit seamlessly with the rest of the image. Change: ${refineText.trim()}`
        : refineText.trim();
      const r = await api.generateImage({
        baseImage: base.data,
        baseMime: base.mime,
        assetIds: selected.map((s) => s.id),
        uploadData: upload?.dataUrl,
        uploadMime: upload ? upload.dataUrl.slice(5, upload.dataUrl.indexOf(';')) : undefined,
        prompt: instruction,
        brand: brand || selected[0]?.brand || undefined,
        useBrandGuidelines: useGuidelines,
        useBrandImages: false,
      });
      setPreview(r.image);
      setRefineText('');
      setRegion(null); setRegionMode(false);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
    finally { setRefining(false); }
  }

  // Pointer handlers for drawing the region box over the preview.
  function onOverlayDown(e: React.PointerEvent) {
    const el = overlayRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    drawStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDraft({ l: drawStart.current.x, t: drawStart.current.y, w: 0, h: 0 });
    el.setPointerCapture(e.pointerId);
  }
  function onOverlayMove(e: React.PointerEvent) {
    if (!drawStart.current || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const cx = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const cy = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const l = Math.min(drawStart.current.x, cx), t = Math.min(drawStart.current.y, cy);
    setDraft({ l, t, w: Math.abs(cx - drawStart.current.x), h: Math.abs(cy - drawStart.current.y) });
  }
  function onOverlayUp() {
    const el = overlayRef.current;
    if (draft && el && draft.w > 6 && draft.h > 6) {
      const rect = el.getBoundingClientRect();
      setRegion({ x: draft.l / rect.width, y: draft.t / rect.height, w: draft.w / rect.width, h: draft.h / rect.height });
    }
    drawStart.current = null; setDraft(null);
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
    <Stack spacing={2.5} sx={{ background: 'linear-gradient(180deg, #f8fafc 0%, #eceff5 100%)', p: { xs: 1.5, md: 2 }, borderRadius: 3 }}>
      <StudioHero />

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
                    <Box sx={{ position: 'absolute', top: 2, left: 2, width: 18, height: 18, borderRadius: '50%', bgcolor: 'success.main', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>A</Box>
                    <Chip size="small" color="success" label="Upload" sx={{ position: 'absolute', bottom: 2, left: 2, height: 18, fontSize: 10 }} />
                    <Box component="button" onClick={() => setUpload(null)} sx={{ position: 'absolute', top: 2, right: 2, border: 'none', cursor: 'pointer', bgcolor: 'rgba(0,0,0,.6)', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'grid', placeItems: 'center' }}><X size={11} /></Box>
                  </Box>
                )}
                {results.map((a) => {
                  const idx = selected.findIndex((x) => x.id === a.id);
                  const sel = idx >= 0;
                  return (
                    <Box key={a.id} component="button" type="button" onClick={() => toggle(a)} title={a.title || a.filename || ''}
                      sx={{ position: 'relative', p: 0, cursor: 'pointer', borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover', aspectRatio: '1', border: '2px solid', borderColor: sel ? 'primary.main' : 'divider' }}>
                      <Box component="img" src={a.thumbnailUrl || a.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      {sel && <Box sx={{ position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, px: 0.5, borderRadius: 9, bgcolor: 'primary.main', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>{selLetter(idx)}</Box>}
                    </Box>
                  );
                })}
                {!results.length && !searching && <Typography variant="caption" color="text.secondary" sx={{ gridColumn: '1 / -1', py: 1 }}>No matches — try fewer / different words.</Typography>}
              </Box>
              {(upload || selected.length > 0) && (
                <Typography variant="caption" color="text.secondary">
                  Reference by letter in your prompt: {[upload ? 'A = upload' : null, ...selected.map((s, i) => `${selLetter(i)} = ${s.title || s.filename}`)].filter(Boolean).join(' · ')}
                </Typography>
              )}
              {selected.length > 0 && (
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {selected.map((s, i) => <Chip key={s.id} size="small" label={`${selLetter(i)} · ${s.title || s.filename}`} onDelete={() => toggle(s)} />)}
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
              <TextField multiline minRows={3} placeholder="e.g. put A on the bar top and B in the blurred background, warm evening light" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
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
                : preview ? (
                  <Box sx={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                    <Box component="img" src={preview} alt="Generated" sx={{ maxWidth: '100%', maxHeight: 460, display: 'block' }} />
                    {regionMode && (
                      <Box
                        ref={overlayRef}
                        onPointerDown={onOverlayDown} onPointerMove={onOverlayMove} onPointerUp={onOverlayUp}
                        sx={{ position: 'absolute', inset: 0, cursor: 'crosshair', touchAction: 'none' }}
                      >
                        {(draft || region) && (() => {
                          const r = draft
                            ? { left: draft.l, top: draft.t, width: draft.w, height: draft.h }
                            : { left: `${region!.x * 100}%`, top: `${region!.y * 100}%`, width: `${region!.w * 100}%`, height: `${region!.h * 100}%` };
                          return <Box sx={{ position: 'absolute', ...r, border: '2px solid #d500f9', bgcolor: 'rgba(213,0,249,.18)', pointerEvents: 'none' }} />;
                        })()}
                      </Box>
                    )}
                  </Box>
                )
                : <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>Your generated graphic appears here.</Typography>}
            </Box>
            {preview && (
              <>
                <Divider><Typography variant="caption" color="text.secondary">Refine (edit this image)</Typography></Divider>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Button size="small" variant={regionMode ? 'contained' : 'outlined'} startIcon={<Crop size={15} />}
                    onClick={() => { setRegionMode((v) => !v); if (regionMode) setRegion(null); }}>
                    {regionMode ? 'Selecting area' : 'Select area'}
                  </Button>
                  {region && <Chip size="small" color="secondary" label="Area set — edit applies here" onDelete={() => setRegion(null)} />}
                  {regionMode && !region && <Typography variant="caption" color="text.secondary">Drag a box on the image to target the change.</Typography>}
                </Stack>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    size="small" fullWidth multiline minRows={1}
                    placeholder={region ? 'Change just the selected area — e.g. “put a lime wedge here”, “remove this”' : 'Change it — e.g. “remove the straw”, “make it brighter”, “replace B with C”, “add A to the left”'}
                    value={refineText} onChange={(e) => setRefineText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) refine(); }}
                  />
                  <Button variant="contained" sx={{ whiteSpace: 'nowrap' }} startIcon={refining ? <CircularProgress size={16} /> : <Wand2 size={16} />} disabled={refining || !refineText.trim()} onClick={refine}>Apply change</Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">Each change edits the image above. Use <b>Select area</b> to target one spot, or keep products selected on the left (A/B/C) to swap them in.</Typography>
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
