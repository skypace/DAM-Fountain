import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, IconButton, Paper, Stack, TextField, Typography } from '@mui/material';
import { Plus, Trash2, FolderOpen } from 'lucide-react';
import type { Collection } from '../lib/types';
import { api } from '../lib/api';
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
    try { setCollections(await api.listCollections()); } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
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
      {null}
      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5 }}>
          {collections.map((c) => (
            <Paper key={c.id} variant="outlined" sx={{ overflow: 'hidden', cursor: 'pointer', transition: '.15s', '&:hover': { borderColor: 'primary.main', boxShadow: '0 10px 24px rgba(15,23,42,.12)' } }} onClick={() => nav(`/collections/${c.id}`)}>
              <Box sx={{ aspectRatio: '16 / 9', bgcolor: 'action.hover', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                {c.coverUrl
                  ? <Box component="img" src={c.coverUrl} alt={c.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <FolderOpen size={30} opacity={0.4} />}
              </Box>
              <Box sx={{ p: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>{c.name}</Typography>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); del(c); }}><Trash2 size={15} /></IconButton>
                </Stack>
                <Typography variant="caption" color="text.secondary">{c.count ?? 0} asset{(c.count ?? 0) === 1 ? '' : 's'}</Typography>
              </Box>
            </Paper>
          ))}
          {!collections.length && <Typography color="text.secondary">No collections yet.</Typography>}
        </Box>
      )}
    </Stack>
  );
}
