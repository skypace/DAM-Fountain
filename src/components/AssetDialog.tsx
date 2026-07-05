import { useState } from 'react';
import {
  Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogContent, Divider, FormControl,
  FormControlLabel, InputLabel, MenuItem, Select, Stack, TextField, Typography,
} from '@mui/material';
import { Copy, Download, Trash2, Share2, Image as ImageIcon, Sparkles, RefreshCw, History, RotateCcw } from 'lucide-react';
import type { Asset, AssetVersion, Collection } from '../lib/types';
import { ASSET_TYPES, STATUSES } from '../lib/types';
import { useBrands } from '../lib/useBrands';
import { api } from '../lib/api';
import { usePreviewBg, previewBgSx } from '../lib/previewBg';
import { MediaPreview } from './MediaPreview';
import { useToast } from './Toast';

const SHARE_BASE = `${location.origin}/s/`;

export function AssetDialog({ asset, collections, allTags, onClose, onSaved, onDeleted }: {
  asset: Asset;
  collections: Collection[];
  allTags: string[];
  onClose: () => void;
  onSaved: (a: Asset) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(asset.title || '');
  const [description, setDescription] = useState(asset.description || '');
  const [type, setType] = useState(asset.type);
  const [brand, setBrand] = useState(asset.brand);
  const { brands: brandList } = useBrands();
  const [bg] = usePreviewBg();
  const [status, setStatus] = useState(asset.status);
  const [tags, setTags] = useState<string[]>(asset.tags.map((t) => t.name));
  const [collectionId, setCollectionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // Which of this asset's collections currently use it as their cover image.
  const [coverIds, setCoverIds] = useState<Set<string>>(
    () => new Set(collections.filter((c) => c.cover_asset_id === asset.id).map((c) => c.id)),
  );

  const [aiBusy, setAiBusy] = useState(false);
  const [versions, setVersions] = useState<AssetVersion[] | null>(null);

  async function aiTag() {
    setAiBusy(true);
    try {
      const r = await api.aiTag(asset.id);
      setTags((cur) => [...new Set([...cur, ...r.tags])]);
      if (r.description && !description) setDescription(r.description);
      toast(`AI added ${r.tags.length} tag${r.tags.length === 1 ? '' : 's'}.`);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setAiBusy(false); }
  }
  async function replaceFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try { const updated = await api.replaceFile(asset.id, file); toast('File replaced (previous version kept).'); onSaved(updated); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function loadVersions() {
    try { setVersions(await api.listVersions(asset.id)); } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }
  async function restore(versionId: string) {
    setBusy(true);
    try { const updated = await api.restoreVersion(asset.id, versionId); toast('Version restored.'); onSaved(updated); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  async function toggleCover(colId: string, checked: boolean) {
    setBusy(true);
    try {
      await api.setCollectionCover(colId, checked ? asset.id : null);
      setCoverIds((prev) => { const n = new Set(prev); if (checked) n.add(colId); else n.delete(colId); return n; });
      toast(checked ? 'Set as collection cover.' : 'Cover removed.');
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }

  async function save() {
    setBusy(true);
    try {
      const updated = await api.updateAsset({ id: asset.id, title, description, type, brand, status, tags });
      toast('Saved.'); onSaved(updated);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function moveToCollection() {
    if (!collectionId) return;
    setBusy(true);
    try { await api.addToCollection(collectionId, [asset.id]); toast('Moved to collection.'); onSaved(asset); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function share() {
    setBusy(true);
    try { const s = await api.createShare({ kind: 'asset', assetId: asset.id, allowDownload: true }); setShareUrl(SHARE_BASE + s.token); toast('Share link created.'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function del() {
    if (!confirm(`Delete "${asset.title || asset.filename}"? This removes the file.`)) return;
    setBusy(true);
    try { await api.deleteAsset(asset.id); toast('Deleted.'); onDeleted(asset.id); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast('Copied.'));

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box sx={{ borderRadius: 2, display: 'grid', placeItems: 'center', minHeight: 260, overflow: 'hidden', p: 1, ...previewBgSx(bg) }}>
            <MediaPreview url={asset.url} filename={asset.filename} contentType={asset.content_type} variant="full" alt={asset.title || ''} />
          </Box>
          <Stack spacing={1.5}>
            <TextField size="small" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <TextField size="small" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} multiline minRows={2} />
            <Stack direction="row" spacing={1}>
              <FormControl size="small" fullWidth><InputLabel>Type</InputLabel>
                <Select label="Type" value={type} onChange={(e) => setType(e.target.value as Asset['type'])}>
                  {ASSET_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select></FormControl>
              <FormControl size="small" fullWidth><InputLabel>Brand</InputLabel>
                <Select label="Brand" value={brand} onChange={(e) => setBrand(e.target.value as Asset['brand'])}>
                  {brandList.map((b) => <MenuItem key={b.slug} value={b.slug}>{b.label}</MenuItem>)}
                </Select></FormControl>
              <FormControl size="small" fullWidth><InputLabel>Status</InputLabel>
                <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as Asset['status'])}>
                  {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select></FormControl>
            </Stack>
            <Autocomplete
              multiple freeSolo size="small" options={allTags} value={tags}
              onChange={(_, v) => setTags(v.map((s) => String(s).toLowerCase()))}
              renderTags={(value, getTagProps) => value.map((option, index) => <Chip {...getTagProps({ index })} key={option} label={option} size="small" />)}
              renderInput={(params) => <TextField {...params} label="Tags" placeholder="Add tag + Enter" />}
            />
            <Button variant="contained" onClick={save} disabled={busy}>Save changes</Button>
          </Stack>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <Button size="small" startIcon={<Copy size={15} />} onClick={() => copy(asset.url)}>Copy URL</Button>
          <Button size="small" startIcon={<Download size={15} />} component="a" href={asset.url} target="_blank" rel="noopener">Download</Button>
          <Button size="small" startIcon={<Share2 size={15} />} onClick={share} disabled={busy}>Create share link</Button>
          {asset.thumbnailUrl && <Button size="small" startIcon={<Sparkles size={15} />} onClick={aiTag} disabled={aiBusy || busy}>{aiBusy ? 'AI tagging…' : 'AI tag'}</Button>}
          <Button size="small" component="label" startIcon={<RefreshCw size={15} />} disabled={busy}>
            Replace file
            <input hidden type="file" onChange={(e) => { replaceFile(e.target.files); e.currentTarget.value = ''; }} />
          </Button>
          <Button size="small" startIcon={<History size={15} />} onClick={() => (versions ? setVersions(null) : loadVersions())}>Versions</Button>
          <Box sx={{ flex: 1 }} />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Move to collection</InputLabel>
            <Select label="Move to collection" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}>
              {collections.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button size="small" onClick={moveToCollection} disabled={busy || !collectionId}>Move</Button>
          <Button size="small" color="error" startIcon={<Trash2 size={15} />} onClick={del} disabled={busy}>Delete</Button>
        </Stack>
        {(asset.collections?.length ?? 0) > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
              <ImageIcon size={15} />
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>Use as folder cover / thumbnail</Typography>
            </Stack>
            <Stack direction="row" flexWrap="wrap" useFlexGap>
              {(asset.collections || []).map((col) => (
                <FormControlLabel
                  key={col.id}
                  control={<Checkbox size="small" checked={coverIds.has(col.id)} disabled={busy} onChange={(e) => toggleCover(col.id, e.target.checked)} />}
                  label={col.name}
                />
              ))}
            </Stack>
          </>
        )}
        {versions && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>Version history</Typography>
            {versions.length === 0
              ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>No previous versions — this is the original.</Typography>
              : (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  {versions.map((v) => (
                    <Stack key={v.id} direction="row" spacing={1.25} alignItems="center">
                      <Box sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden', flexShrink: 0 }}>
                        {v.thumbnailUrl && <Box component="img" src={v.thumbnailUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>v{v.version} · {v.filename}</Typography>
                        <Typography variant="caption" color="text.secondary">{new Date(v.created_at).toLocaleString()}</Typography>
                      </Box>
                      <Button size="small" component="a" href={v.url} target="_blank" rel="noopener">Open</Button>
                      <Button size="small" startIcon={<RotateCcw size={14} />} onClick={() => restore(v.id)} disabled={busy}>Restore</Button>
                    </Stack>
                  ))}
                </Stack>
              )}
          </>
        )}
        {shareUrl && (
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="center">
            <TextField size="small" fullWidth value={shareUrl} InputProps={{ readOnly: true }} />
            <Button size="small" variant="outlined" onClick={() => copy(shareUrl)}>Copy</Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
