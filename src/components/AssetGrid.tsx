import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { FileText, Image as ImageIcon } from 'lucide-react';
import type { Asset } from '../lib/types';

const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);

export function AssetGrid({ assets, onOpen, selectable, selected, onToggleSelect }: {
  assets: Asset[];
  onOpen: (a: Asset) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  if (!assets.length) {
    return <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>No assets here yet.</Typography>;
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
      {assets.map((a) => {
        const isSel = selectable && selected?.has(a.id);
        return (
          <Paper
            key={a.id}
            variant="outlined"
            onClick={() => (selectable && onToggleSelect ? onToggleSelect(a.id) : onOpen(a))}
            sx={{ overflow: 'hidden', cursor: 'pointer', transition: '.12s', position: 'relative',
              borderColor: isSel ? 'primary.main' : 'divider', borderWidth: isSel ? 2 : 1,
              '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' } }}
          >
            <Box sx={{ aspectRatio: '4 / 3', bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
              {a.thumbnailUrl
                ? <Box component="img" src={a.thumbnailUrl} alt={a.title || ''} loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : (isPdf(a.url) ? <FileText size={30} opacity={0.5} /> : <ImageIcon size={30} opacity={0.5} />)}
            </Box>
            <Box sx={{ p: 1 }}>
              <Typography variant="body2" fontWeight={700} noWrap title={a.title || a.filename || ''}>{a.title || a.filename}</Typography>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={a.type} />
                {a.status !== 'approved' && <Chip size="small" color="warning" variant="outlined" label={a.status} />}
              </Stack>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
