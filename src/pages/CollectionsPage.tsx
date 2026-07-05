import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { Plus } from 'lucide-react';
import type { Collection } from '../lib/types';
import { api } from '../lib/api';
import { FolderCard } from '../components/FolderCard';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';

export function CollectionsPage() {
  const toast = useToast();
  const nav = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

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

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Collections"
        subtitle="Curated sets of brand assets — share a whole collection with one link"
        actions={(
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="New collection name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') create(); }} sx={{ maxWidth: 260 }} />
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={create} disabled={busy}>Create</Button>
          </Stack>
        )}
      />
      <Typography variant="caption" color="text.secondary">
        Tip: drag assets or files from your desktop onto a folder to add them, or drag one folder onto another to nest it.
      </Typography>
      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5 }}>
          {collections.map((c) => (
            <FolderCard key={c.id} collection={c} onOpen={(cid) => nav(`/collections/${cid}`)} onDelete={del} onChanged={load} />
          ))}
          {!collections.length && <Typography color="text.secondary">No collections yet.</Typography>}
        </Box>
      )}
    </Stack>
  );
}
