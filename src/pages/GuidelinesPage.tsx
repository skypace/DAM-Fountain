import { useEffect, useRef, useState } from 'react';
import {
  Box, Button, CircularProgress, Divider, IconButton, Paper, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { Plus, Trash2, Save, Upload, Download, FileText, Copy } from 'lucide-react';
import type { Asset, BrandGuidelines, GuidelineFile } from '../lib/types';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';

const EMPTY: BrandGuidelines = { colors: [], fonts: [], sections: [], files: [] };
const HEX_RE = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

export function GuidelinesPage() {
  const toast = useToast();
  const [doc, setDoc] = useState<BrandGuidelines>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logos, setLogos] = useState<Asset[]>([]);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getGuidelines().then((d) => setDoc({ ...EMPTY, ...d })).catch((e) => toast(String(e.message || e))).finally(() => setLoading(false));
    api.listAssets({ type: 'logo' }).then(setLogos).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (p: Partial<BrandGuidelines>) => setDoc((d) => ({ ...d, ...p }));

  async function save() {
    setSaving(true);
    try { const saved = await api.saveGuidelines(doc); setDoc({ ...EMPTY, ...saved }); toast('Guidelines saved.'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  }

  // Colors
  const addColor = () => patch({ colors: [...doc.colors, { name: 'New color', hex: '#1F4E79' }] });
  const setColor = (i: number, k: 'name' | 'hex', v: string) => patch({ colors: doc.colors.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });
  const delColor = (i: number) => patch({ colors: doc.colors.filter((_, j) => j !== i) });
  function importHexFromText(text: string) {
    const found = [...new Set((text.match(HEX_RE) || []).map((h) => h.toLowerCase()))];
    if (!found.length) { toast('No hex colors found in that text.'); return; }
    const existing = new Set(doc.colors.map((c) => c.hex.toLowerCase()));
    const added = found.filter((h) => !existing.has(h)).map((hex) => ({ name: hex, hex }));
    patch({ colors: [...doc.colors, ...added] });
    toast(`Imported ${added.length} color${added.length === 1 ? '' : 's'}.`);
  }

  // Fonts
  const addFont = () => patch({ fonts: [...doc.fonts, { name: 'Font name', note: '' }] });
  const setFont = (i: number, k: 'name' | 'note', v: string) => patch({ fonts: doc.fonts.map((f, j) => (j === i ? { ...f, [k]: v } : f)) });
  const delFont = (i: number) => patch({ fonts: doc.fonts.filter((_, j) => j !== i) });

  // Sections
  const addSection = () => patch({ sections: [...doc.sections, { title: 'New section', body: '' }] });
  const setSection = (i: number, k: 'title' | 'body', v: string) => patch({ sections: doc.sections.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
  const delSection = (i: number) => patch({ sections: doc.sections.filter((_, j) => j !== i) });

  // Files (attach + parse text files for colors)
  async function attachFiles(files: FileList | null) {
    if (!files?.length) return;
    setSaving(true);
    try {
      const added: GuidelineFile[] = [];
      for (const f of Array.from(files)) {
        if (/^text\/|\.(txt|csv|json|css|scss)$/i.test(f.type + ' ' + f.name)) {
          importHexFromText(await f.text());
        }
        added.push(await api.uploadGuidelineFile(f));
      }
      const next = { ...doc, files: [...doc.files, ...added] };
      setDoc(next);
      await api.saveGuidelines(next);
      toast(`Attached ${added.length} file${added.length === 1 ? '' : 's'}.`);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
  }
  const delFile = (i: number) => patch({ files: doc.files.filter((_, j) => j !== i) });

  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Brand Guidelines"
        subtitle="Colors, fonts, notes, and resource files for Alameda Soda + Brix — editable, saved for everyone"
        actions={<Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save size={16} />} onClick={save} disabled={saving}>Save</Button>}
      />

      {/* Colors */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>Color palette</Typography>
          <Button size="small" startIcon={<Upload size={15} />} onClick={() => importRef.current?.click()}>Import hex from file</Button>
          <input ref={importRef} hidden type="file" accept=".txt,.csv,.json,.css,.scss,text/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) importHexFromText(await f.text()); e.currentTarget.value = ''; }} />
          <Button size="small" startIcon={<Plus size={15} />} onClick={addColor}>Add color</Button>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
          {doc.colors.map((c, i) => (
            <Paper key={i} variant="outlined" sx={{ overflow: 'hidden' }}>
              <Box component="label" sx={{ display: 'block', height: 56, bgcolor: c.hex, cursor: 'pointer', position: 'relative' }}>
                <Box component="input" type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#000000'} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(i, 'hex', e.target.value)} sx={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 0 }} />
              </Box>
              <Box sx={{ p: 1 }}>
                <TextField variant="standard" fullWidth value={c.name} onChange={(e) => setColor(i, 'name', e.target.value)} InputProps={{ disableUnderline: true, sx: { fontWeight: 700, fontSize: 14 } }} />
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <TextField variant="standard" value={c.hex} onChange={(e) => setColor(i, 'hex', e.target.value)} InputProps={{ disableUnderline: true, sx: { fontSize: 12, color: 'text.secondary' } }} />
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title="Copy hex"><IconButton size="small" onClick={() => navigator.clipboard.writeText(c.hex).then(() => toast(`Copied ${c.hex}`))}><Copy size={13} /></IconButton></Tooltip>
                  <IconButton size="small" onClick={() => delColor(i)}><Trash2 size={13} /></IconButton>
                </Stack>
              </Box>
            </Paper>
          ))}
          {!doc.colors.length && <Typography variant="body2" color="text.secondary">No colors yet — add one or import hex codes from a text/CSS/JSON file.</Typography>}
        </Box>
      </Box>

      {/* Fonts */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>Typography</Typography>
          <Button size="small" startIcon={<Plus size={15} />} onClick={addFont}>Add font</Button>
        </Stack>
        <Stack spacing={1}>
          {doc.fonts.map((f, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField size="small" label="Font" value={f.name} onChange={(e) => setFont(i, 'name', e.target.value)} sx={{ width: 220 }} />
                <TextField size="small" label="Note" value={f.note || ''} onChange={(e) => setFont(i, 'note', e.target.value)} sx={{ flex: 1 }} />
                <IconButton size="small" onClick={() => delFont(i)}><Trash2 size={15} /></IconButton>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Box>

      {/* Sections */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>Guidelines &amp; notes</Typography>
          <Button size="small" startIcon={<Plus size={15} />} onClick={addSection}>Add section</Button>
        </Stack>
        <Stack spacing={1.5}>
          {doc.sections.map((s, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <TextField size="small" fullWidth value={s.title} onChange={(e) => setSection(i, 'title', e.target.value)} placeholder="Section title" />
                <IconButton size="small" onClick={() => delSection(i)}><Trash2 size={15} /></IconButton>
              </Stack>
              <TextField size="small" fullWidth multiline minRows={3} value={s.body} onChange={(e) => setSection(i, 'body', e.target.value)} placeholder="Write guidance here…" />
            </Paper>
          ))}
          {!doc.sections.length && <Typography variant="body2" color="text.secondary">No sections yet.</Typography>}
        </Stack>
      </Box>

      {/* Resource files */}
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>Resource files</Typography>
          <Button size="small" component="label" startIcon={<Upload size={15} />} disabled={saving}>
            Attach files
            <input hidden type="file" multiple onChange={(e) => { attachFiles(e.target.files); e.currentTarget.value = ''; }} />
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary">Brand books (PDF), .txt/.css/.json (hex is auto-imported into the palette), swatches, anything.</Typography>
        <Stack spacing={1} sx={{ mt: 1 }}>
          {doc.files.map((f, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.25 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <FileText size={16} />
                <Typography variant="body2" sx={{ flex: 1 }} noWrap>{f.name}</Typography>
                <Button size="small" component="a" href={f.url} target="_blank" rel="noopener" startIcon={<Download size={14} />}>Open</Button>
                <IconButton size="small" onClick={() => delFile(i)}><Trash2 size={15} /></IconButton>
              </Stack>
            </Paper>
          ))}
          {!doc.files.length && <Typography variant="body2" color="text.secondary">No files attached.</Typography>}
        </Stack>
      </Box>

      {logos.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Logos (from the library)</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
            {logos.map((l) => (
              <Paper key={l.id} variant="outlined" sx={{ p: 1.5 }}>
                <Box sx={{ aspectRatio: '4 / 3', display: 'grid', placeItems: 'center', bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
                  {l.thumbnailUrl && <Box component="img" src={l.thumbnailUrl} alt={l.title || ''} sx={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />}
                </Box>
                <Typography variant="caption" noWrap sx={{ display: 'block', mt: 0.75 }}>{l.title || l.filename}</Typography>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      <Divider />
      <Box><Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save size={16} />} onClick={save} disabled={saving}>Save guidelines</Button></Box>
    </Stack>
  );
}
