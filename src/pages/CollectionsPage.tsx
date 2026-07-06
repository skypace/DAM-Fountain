import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { Plus } from 'lucide-react';
import type { Collection } from '../lib/types';
import { api } from '../lib/api';
import { FolderCard } from '../components/FolderCard';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';

type SortKey = 'custom' | 'name' | 'newest' | 'count';

export function CollectionsPage() {
  const toast = useToast();
  const nav = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<SortKey>('custom');

  async function load() {
    setLoading(true);
    // Only top-level collections here; sub-folders are shown inside their parent.
    try { setCollections((await api.listCollections()).filter((c) => !c.parent_id)); } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try { await api.createCollection(name.trim()); setName(''); await load(); toast('Collection created.'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function del(c: Collection) {
    if (!confirm(`Delete collection "${c.name}"? (assets are not deleted)`)) return;
    try { await api.deleteCollection(c.id); await load(); toast('Deleted.'); } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }

  const shown = useMemo(() => {
    const list = [...collections];
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'newest') list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    else if (sort === 'count') list.sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    else list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)); // custom
    return list;
  }, [collections, sort]);

  // Drag the grip of one folder onto another → insert it before that target,
  // persist the new order, and switch to Custom sort so it sticks.
  async function reorder(draggedId: string, targetId: string) {
    const order = shown.map((c) => c.id);
    const from = order.indexOf(draggedId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    order.splice(from, 1);
    order.splice(order.indexOf(targetId), 0, draggedId);
    const byId = new Map(collections.map((c) => [c.id, c]));
    setCollections(order.map((id, i) => ({ ...(byId.get(id) as Collection), sort_order: (i + 1) * 10 })));
    setSort('custom');
    try { await api.reorderCollections(order); } catch (e) { toast(e instanceof Error ? e.message : String(e)); load(); }
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Collections"
        subtitle="Curated sets of brand assets — share a whole collection with one link"
        actions={(
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="New collection name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} sx={{ maxWidth: 240 }} />
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={create} disabled={busy}>Create</Button>
          </Stack>
        )}
      />
      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Sort</InputLabel>
          <Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <MenuItem value="custom">Custom order</MenuItem>
            <MenuItem value="name">Name (A–Z)</MenuItem>
            <MenuItem value="newest">Newest</MenuItem>
            <MenuItem value="count">Most assets</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary">
          {sort === 'custom'
            ? 'Drag the ⋮⋮ grip on a folder to reorder. Drag a folder onto another to nest it; drop assets or desktop files onto a folder to add them.'
            : 'Switch to “Custom order” to drag-reorder folders.'}
        </Typography>
      </Stack>
      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.75 }}>
          {shown.map((c) => (
            <FolderCard key={c.id} collection={c} onOpen={(cid) => nav(`/collections/${cid}`)} onDelete={del} onChanged={load}
              sortable={sort === 'custom'} onReorder={reorder} />
          ))}
          {!shown.length && <Typography color="text.secondary">No collections yet.</Typography>}
        </Box>
      )}
    </Stack>
  );
}
