import { useState } from 'react';
import {
  Box, Button, Chip, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Tooltip,
} from '@mui/material';
import { Download, Trash2, X, Tag as TagIcon } from 'lucide-react';
import type { Asset, Collection } from '../lib/types';
import { ASSET_TYPES, BRANDS, STATUSES } from '../lib/types';
import { api } from '../lib/api';
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
  const [busy, setBusy] = useState(false);
  const [tag, setTag] = useState('');

  async function run(body: Parameters<typeof api.bulkAssets>[0], label: string) {
    setBusy(true);
    try { const r = await api.bulkAssets(body); toast(`${label} · ${r.count} asset${r.count === 1 ? '' : 's'}.`); onDone(); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  function downloadAll() {
    assets.filter((a) => ids.includes(a.id)).forEach((a, i) => setTimeout(() => {
      const el = document.createElement('a'); el.href = a.url; el.target = '_blank'; el.rel = 'noopener'; el.download = a.filename || a.title || 'asset';
      document.body.appendChild(el); el.click(); el.remove();
    }, i * 120));
    toast(`Opening ${ids.length} download${ids.length === 1 ? '' : 's'}…`);
  }

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'sticky', bottom: 16, mt: 2, p: 1.25, borderRadius: 3, border: '1px solid', borderColor: 'primary.main',
        display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', zIndex: 20,
        boxShadow: '0 12px 34px rgba(0,0,0,.45)',
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

      <FormControl size="small" sx={{ minWidth: 140 }}>
        <InputLabel>Add to collection</InputLabel>
        <Select label="Add to collection" value="" disabled={busy || !collections.length} onChange={(e) => run({ ids, collectionId: String(e.target.value) }, 'Added to collection')}>
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
          {BRANDS.map((b) => <MenuItem key={b} value={b} sx={{ textTransform: 'capitalize' }}>{b}</MenuItem>)}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 100 }}>
        <InputLabel>Type</InputLabel>
        <Select label="Type" value="" disabled={busy} onChange={(e) => run({ ids, type: String(e.target.value) }, 'Type set')}>
          {ASSET_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </Select>
      </FormControl>

      <Box sx={{ flex: 1 }} />
      <Button size="small" startIcon={<Download size={15} />} disabled={busy} onClick={downloadAll}>Download</Button>
      <Button size="small" color="error" startIcon={<Trash2 size={15} />} disabled={busy}
        onClick={() => { if (confirm(`Delete ${ids.length} asset${ids.length === 1 ? '' : 's'}? This removes the files.`)) run({ ids, delete: true }, 'Deleted'); }}>
        Delete
      </Button>
      <Tooltip title="Clear selection"><Button size="small" color="inherit" onClick={onClear}><X size={16} /></Button></Tooltip>
    </Paper>
  );
}
