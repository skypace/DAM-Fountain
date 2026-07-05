import { useState } from 'react';
import { Box, CircularProgress, IconButton, Paper, Stack, Typography } from '@mui/material';
import { FolderOpen, Trash2 } from 'lucide-react';
import type { Collection } from '../lib/types';
import { api } from '../lib/api';
import { dtHasFiles, readAssetIds, readFolderId, readDropped, uploadDroppedTree } from '../lib/dnd';
import { MediaPreview } from './MediaPreview';
import { useToast } from './Toast';

// A collection tile that is both a drag source (drag it onto another folder to
// nest it) and a drop target: drop assets to move them in, drop a folder to nest
// it, or drop files/folders from the desktop to upload into it.
export function FolderCard({ collection, onOpen, onDelete, onChanged }: {
  collection: Collection;
  onOpen: (id: string) => void;
  onDelete?: (c: Collection) => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const c = collection;
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-fountain-folder', c.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dtHasFiles(e.dataTransfer) ? 'copy' : 'move';
    if (!over) setOver(true);
  };
  async function onDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation(); setOver(false);
    const dt = e.dataTransfer;
    const isFiles = dtHasFiles(dt);
    const assetIds = isFiles ? [] : readAssetIds(dt);
    const folderId = isFiles ? null : readFolderId(dt);
    try {
      if (isFiles) {
        setBusy(true);
        const dropped = await readDropped(dt);
        if (dropped.length) { const r = await uploadDroppedTree(dropped, { parentId: c.id }); toast(`Uploaded ${r.files} file${r.files === 1 ? '' : 's'} into “${c.name}”.`); onChanged(); }
      } else if (assetIds.length) {
        setBusy(true); await api.addToCollection(c.id, assetIds); toast(`Moved ${assetIds.length} asset${assetIds.length === 1 ? '' : 's'} into “${c.name}”.`); onChanged();
      } else if (folderId && folderId !== c.id) {
        setBusy(true); await api.updateCollection(folderId, { parent_id: c.id }); toast(`Nested folder into “${c.name}”.`); onChanged();
      }
    } catch (err) { toast(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  return (
    <Paper
      variant="outlined"
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => onOpen(c.id)}
      sx={{
        overflow: 'hidden', cursor: 'pointer', position: 'relative', transition: '.15s',
        borderColor: over ? 'primary.main' : 'divider', borderWidth: over ? 2 : 1,
        boxShadow: over ? '0 0 0 3px rgba(31,78,121,.18)' : 'none',
        '&:hover': { borderColor: 'primary.main', boxShadow: '0 10px 24px rgba(15,23,42,.12)' },
      }}
    >
      <Box sx={{ aspectRatio: '16 / 9', bgcolor: 'action.hover', display: 'grid', placeItems: 'center', overflow: 'hidden', pointerEvents: 'none' }}>
        {busy ? <CircularProgress size={22} />
          : c.cover ? <MediaPreview url={c.cover.url} filename={c.cover.filename} contentType={c.cover.content_type} variant="thumb" alt={c.name} />
          : <FolderOpen size={28} opacity={0.4} />}
      </Box>
      <Box sx={{ p: 1.25 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: 600 }}>{c.name}</Typography>
          {onDelete && <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(c); }}><Trash2 size={14} /></IconButton>}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {c.count ?? 0} asset{(c.count ?? 0) === 1 ? '' : 's'}{c.subfolderCount ? ` · ${c.subfolderCount} folder${c.subfolderCount === 1 ? '' : 's'}` : ''}
        </Typography>
      </Box>
    </Paper>
  );
}
