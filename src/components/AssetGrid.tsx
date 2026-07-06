import { Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { Check, Link2, Download } from 'lucide-react';
import type { Asset } from '../lib/types';
import { mediaKind, MEDIA_META } from '../lib/media';
import { ASSET_MIME } from '../lib/dnd';
import { usePreviewBg, previewBgSx } from '../lib/previewBg';
import { MediaPreview } from './MediaPreview';

export function AssetGrid({ assets, onOpen, selectable, selected, onToggleSelect }: {
  assets: Asset[];
  onOpen: (a: Asset) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const [, , bgFor] = usePreviewBg();
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 2 }}>
      {assets.map((a) => {
        const isSel = !!(selectable && selected?.has(a.id));
        const act = () => (selectable && onToggleSelect ? onToggleSelect(a.id) : onOpen(a));
        const kind = mediaKind(a.content_type, a.filename);
        const usesBg = kind === 'image' || kind === 'vector';
        // Drag an asset (or the whole selection, if this one is selected) onto a
        // folder to move it there.
        const onDragStart = (e: React.DragEvent) => {
          const ids = selected?.has(a.id) && (selected.size > 1) ? [...selected] : [a.id];
          e.dataTransfer.setData(ASSET_MIME, JSON.stringify(ids));
          e.dataTransfer.effectAllowed = 'move';
        };
        return (
          <Paper
            key={a.id}
            variant="outlined"
            draggable
            onDragStart={onDragStart}
            onClick={act}
            role="button"
            tabIndex={0}
            aria-label={a.title || a.filename || 'asset'}
            aria-pressed={selectable ? isSel : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } }}
            sx={{
              overflow: 'hidden', cursor: 'pointer', position: 'relative', borderRadius: 3,
              borderColor: isSel ? 'primary.main' : 'divider', borderWidth: isSel ? 2 : 1,
              transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              '&:hover': { borderColor: 'primary.main', transform: 'translateY(-3px)', boxShadow: '0 10px 24px rgba(15,23,42,.12)' },
              '&:hover .asset-actions': { opacity: 1 },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <Box sx={{ aspectRatio: '4 / 3', display: 'grid', placeItems: 'center', position: 'relative', p: usesBg ? 1 : 0, ...(usesBg ? previewBgSx(bgFor(a.id)) : { bgcolor: 'action.hover' }) }}>
              <MediaPreview url={a.url} filename={a.filename} contentType={a.content_type} variant="thumb" alt={a.title || a.filename || ''} />
              {!selectable && (
                <Stack direction="row" spacing={0.5} className="asset-actions" sx={{ position: 'absolute', top: 6, right: 6, opacity: 0, transition: 'opacity .15s' }}>
                  <Tooltip title="Copy link">
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(a.url); }} sx={{ bgcolor: 'rgba(255,255,255,.9)', '&:hover': { bgcolor: '#fff' }, width: 26, height: 26 }}><Link2 size={13} /></IconButton>
                  </Tooltip>
                  <Tooltip title="Download">
                    <IconButton size="small" component="a" href={a.url} download={a.filename || undefined} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} sx={{ bgcolor: 'rgba(255,255,255,.9)', '&:hover': { bgcolor: '#fff' }, width: 26, height: 26 }}><Download size={13} /></IconButton>
                  </Tooltip>
                </Stack>
              )}
              {kind === 'video' && (
                <Box sx={{ position: 'absolute', bottom: 6, left: 6, px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 10, fontWeight: 700 }}>▶ VIDEO</Box>
              )}
              {isSel && (
                <Box sx={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff', display: 'grid', placeItems: 'center' }}>
                  <Check size={15} />
                </Box>
              )}
              {a.status !== 'approved' && (
                <Chip size="small" color="warning" label={a.status} sx={{ position: 'absolute', top: 8, left: 8, height: 20, fontSize: 11 }} />
              )}
            </Box>
            <Box sx={{ p: 1.25 }}>
              <Typography variant="body2" fontWeight={700} noWrap title={a.title || a.filename || ''}>{a.title || a.filename}</Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, minWidth: 0 }} alignItems="center">
                <Chip size="small" variant="outlined" label={a.type} sx={{ height: 20, fontSize: 11 }} />
                {kind !== 'image' && <Chip size="small" label={kind} sx={{ height: 20, fontSize: 11, bgcolor: `${MEDIA_META[kind].color}22`, color: MEDIA_META[kind].color, fontWeight: 700 }} />}
                {a.brand !== 'shared' && <Chip size="small" variant="outlined" label={a.brand} sx={{ height: 20, fontSize: 11, textTransform: 'capitalize' }} />}
                {a.tags.length > 0 && <Typography variant="caption" color="text.secondary" noWrap>· {a.tags.length} tag{a.tags.length === 1 ? '' : 's'}</Typography>}
              </Stack>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
