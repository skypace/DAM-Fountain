import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { ArrowLeft, Share2, Copy } from 'lucide-react';
import type { Asset, Collection, Tag } from '../lib/types';
import { api } from '../lib/api';
import { AssetGrid } from '../components/AssetGrid';
import { AssetDialog } from '../components/AssetDialog';
import { useToast } from '../components/Toast';

export function CollectionDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Asset | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true); setError(null);
    try {
      const [detail, t, c] = await Promise.all([api.getCollection(id), api.listTags(), api.listCollections()]);
      setCollection(detail.collection); setAssets(detail.assets); setAllTags(t); setCollections(c);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function shareCollection() {
    try { const s = await api.createShare({ kind: 'collection', collectionId: id, allowDownload: true }); setShareUrl(`${location.origin}/s/${s.token}`); toast('Share link created.'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }
  async function removeSelected() {
    if (!selected.size) return;
    try { await api.removeFromCollection(id, [...selected]); setSelected(new Set()); setSelecting(false); await load(); toast('Removed from collection.'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }
  const toggle = (aid: string) => setSelected((s) => { const n = new Set(s); n.has(aid) ? n.delete(aid) : n.add(aid); return n; });

  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="warning" action={<Button size="small" onClick={load}>Retry</Button>}>{error}</Alert>;

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
        <Button size="small" startIcon={<ArrowLeft size={16} />} onClick={() => nav('/collections')}>Collections</Button>
        <Typography variant="h6">{collection?.name}</Typography>
        <Chip size="small" variant="outlined" label={`${assets.length} asset${assets.length === 1 ? '' : 's'}`} />
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant={selecting ? 'contained' : 'outlined'} onClick={() => { setSelecting((v) => !v); setSelected(new Set()); }}>{selecting ? 'Done' : 'Select'}</Button>
        {selecting && <Button size="small" color="error" disabled={!selected.size} onClick={removeSelected}>Remove ({selected.size})</Button>}
        <Button size="small" variant="outlined" startIcon={<Share2 size={15} />} onClick={shareCollection}>Share collection</Button>
      </Stack>

      {shareUrl && (
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField size="small" fullWidth value={shareUrl} InputProps={{ readOnly: true }} />
          <Button size="small" variant="outlined" startIcon={<Copy size={15} />} onClick={() => navigator.clipboard.writeText(shareUrl).then(() => toast('Copied.'))}>Copy</Button>
        </Stack>
      )}

      <AssetGrid assets={assets} onOpen={setOpen} selectable={selecting} selected={selected} onToggleSelect={toggle} />

      {open && (
        <AssetDialog asset={open} collections={collections} allTags={allTags.map((t) => t.name)}
          onClose={() => setOpen(null)}
          onSaved={(a) => { setAssets((cur) => cur.map((x) => (x.id === a.id ? a : x))); setOpen(null); }}
          onDeleted={(aid) => { setAssets((cur) => cur.filter((x) => x.id !== aid)); setOpen(null); }} />
      )}
    </Stack>
  );
}
