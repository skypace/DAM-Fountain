import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { Check, FileText, Image as ImageIcon } from 'lucide-react';
import type { Asset } from '../lib/types';

const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);

export function AssetGrid({ assets, onOpen, selectable, selected, onToggleSelect }: {
  assets: Asset[];
  onOpen: (a: Asset) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 2 }}>
      {assets.map((a) => {
        const isSel = !!(selectable && selected?.has(a.id));
        const act = () => (selectable && onToggleSelect ? onToggleSelect(a.id) : onOpen(a));
        return (
          <Paper
            key={a.id}
            variant="outlined"
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
              '&:hover': { borderColor: 'primary.main', transform: 'translateY(-3px)', boxShadow: '0 12px 28px rgba(0,0,0,.35)' },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <Box sx={{ aspectRatio: '4 / 3', bgcolor: 'action.hover', display: 'grid', placeItems: 'center', position: 'relative' }}>
              {a.thumbnailUrl
                ? <Box component="img" src={a.thumbnailUrl} alt={a.title || a.filename || ''} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : (isPdf(a.url) ? <FileText size={30} opacity={0.5} /> : <ImageIcon size={30} opacity={0.5} />)}
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
