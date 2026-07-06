import { useState } from 'react';
import {
  Box, Button, Chip, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Tooltip,
} from '@mui/material';
import { Download, Trash2, X, Tag as TagIcon, Sparkles, FileText } from 'lucide-react';
import type { Asset, Collection } from '../lib/types';
import { STATUSES } from '../lib/types';
import { api, downloadZip } from '../lib/api';
import { mediaKind } from '../lib/media';
import { useBrands } from '../lib/useBrands';
import { useTypes } from '../lib/useTypes';
import { useToast } from './Toast';

// Sticky bar shown when 1+ assets are selected — apply one action to all of them.
export function BulkActionBar({ ids, assets, collections, onDone, onClear }: {
  ids: string[];
  assets: Asset[];
  collections: Collection[];
  onDone: () => void;
  onClear: () => void;
}) {
  const toast = useToast();
  const { brands: brandList } = useBrands();
  const { types: typeList, addType } = useTypes();
  const [busy, setBusy] = useState(false);
  const [tag, setTag] = useState('');
  const [desc, setDesc] = useState('');

  async function run(body: Parameters<typeof api.bulkAssets>[0], label: string) {
    setBusy(true);
    try { const r = await api.bulkAssets(body); toast(`${label} · ${r.count} asset${r.count === 1 ? '' : 's'}.`); onDone(); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const selectedAssets = assets.filter((a) => ids.includes(a.id));

  async function downloadAllZip() {
    setBusy(true);
    toast(`Zipping ${ids.length} asset${ids.length === 1 ? '' : 's'}…`);
    try { await downloadZip(selectedAssets, 'fountain-assets.zip'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  async function aiTagAll() {
    const images = selectedAssets.filter((a) => { const k = mediaKind(a.content_type, a.filename); return k === 'image' || k === 'vector'; });
    const skipped = selectedAssets.length - images.length;
    if (!images.length) { toast('AI tagging needs image or vector files — none in the selection.'); return; }
    setBusy(true);
    let ok = 0;
    let lastErr = '';
    try {
      for (const a of images) {
        try { await api.aiTag(a.id); ok++; }
        catch (e) { lastErr = e instanceof Error ? e.message : String(e); }
      }
      if (ok) {
        const tail = skipped ? ` (${skipped} non-image skipped)` : '';
        toast(`AI-tagged ${ok} of ${images.length} image${images.length === 1 ? '' : 's'}${tail}.`);
        onDone();
      } else {
        toast(`AI tagging failed${lastErr ? `: ${lastErr}` : '.'}`);
      }
    } finally { setBusy(false); }
  }

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'sticky', bottom: 16, mt: 2, p: 1.25, borderRadius: 1, border: '1px solid', borderColor: 'primary.main',
        display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', zIndex: 20,
        boxShadow: '0 10px 30px rgba(15,23,42,.16)', bgcolor: 'background.paper',
      }}
    >
      <Chip color="primary" label={`${ids.length} selected`} sx={{ fontWeight: 700 }} />
      <Divider orientation="vertical" flexItem />

      <Stack direction="row" spacing={0.5} alignItems="center">
        <TextField
          size="small" placeholder="add tag…" value={tag} onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && tag.trim()) { run({ ids, addTags: [tag.trim().toLowerCase()] }, 'Tagged'); setTag(''); } }}
          sx={{ width: 130 }}
          InputProps={{ startAdornment: <TagIcon size={14} style={{ marginRight: 6, opacity: 0.6 }} /> }}
        />
      </Stack>

      <Tooltip title="Set a shared description on all selected — press Enter to apply">
        <TextField
          size="small" placeholder="set description…" value={desc} onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && desc.trim()) { run({ ids, description: desc.trim() }, 'Description set'); setDesc(''); } }}
          disabled={busy}
          sx={{ width: 190 }}
          InputProps={{ startAdornment: <FileText size={14} style={{ marginRight: 6, opacity: 0.6 }} /> }}
        />
      </Tooltip>

      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Move to collection</InputLabel>
        <Select label="Move to collection" value="" disabled={busy || !collections.length} onChange={(e) => run({ ids, collectionId: String(e.target.value) }, 'Moved to collection')}>
          {collections.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 110 }}>
        <InputLabel>Status</InputLabel>
        <Select label="Status" value="" disabled={busy} onChange={(e) => run({ ids, status: String(e.target.value) }, 'Status set')}>
          {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 105 }}>
        <InputLabel>Brand</InputLabel>
        <Select label="Brand" value="" disabled={busy} onChange={(e) => run({ ids, brand: String(e.target.value) }, 'Brand set')}>
          {brandList.map((b) => <MenuItem key={b.slug} value={b.slug}>{b.label}</MenuItem>)}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel>Type</InputLabel>
        <Select label="Type" value="" disabled={busy} onChange={async (e) => { const v = String(e.target.value); if (v === '__add__') { const s = await addType(); if (s) run({ ids, type: s }, 'Type set'); } else run({ ids, type: v }, 'Type set'); }}>
          {typeList.map((t) => <MenuItem key={t.slug} value={t.slug}>{t.label}</MenuItem>)}
          <MenuItem value="__add__" sx={{ fontStyle: 'italic' }}>＋ Add type…</MenuItem>
        </Select>
      </FormControl>

      <Box sx={{ flex: 1 }} />
      <Button size="small" startIcon={<Sparkles size={15} />} disabled={busy} onClick={aiTagAll}>AI tag</Button>
      <Button size="small" startIcon={<Download size={15} />} disabled={busy} onClick={downloadAllZip}>Download ZIP</Button>
      <Button size="small" color="error" startIcon={<Trash2 size={15} />} disabled={busy}
        onClick={() => { if (confirm(`Delete ${ids.length} asset${ids.length === 1 ? '' : 's'}? This removes the files.`)) run({ ids, delete: true }, 'Deleted'); }}>
        Delete
      </Button>
      <Tooltip title="Clear selection"><Button size="small" color="inherit" onClick={onClear}><X size={16} /></Button></Tooltip>
    </Paper>
  );
}
