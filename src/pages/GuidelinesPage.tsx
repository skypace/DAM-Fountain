import { useEffect, useState } from 'react';
import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { Check, X as XIcon } from 'lucide-react';
import type { Asset } from '../lib/types';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';

const PALETTE = [
  { name: 'Brix Navy (°bx)', hex: '#1F4E79' },
  { name: 'Accent Blue', hex: '#3B82F6' },
  { name: 'Slate 900', hex: '#0F172A' },
  { name: 'Alameda Red', hex: '#C8102E' },
  { name: 'Cloud', hex: '#F8FAFC' },
  { name: 'Ink', hex: '#0F1E34' },
];

const DOS = [
  'Use the °bx round logo in Brix Navy on light backgrounds.',
  'Keep clear space around the logo equal to the height of the “bx”.',
  'Pull product imagery straight from this library so colors stay true.',
];
const DONTS = [
  'Don’t recolor the logo or place it on busy photos without a scrim.',
  'Don’t stretch, rotate, or add effects to the marks.',
  'Don’t use the retired teal — brand navy is #1F4E79.',
];

export function GuidelinesPage() {
  const toast = useToast();
  const [logos, setLogos] = useState<Asset[]>([]);
  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast(`Copied ${t}`));

  useEffect(() => { api.listAssets({ type: 'logo' }).then(setLogos).catch(() => {}); }, []);

  return (
    <Stack spacing={3}>
      <PageHeader title="Brand Guidelines" subtitle="Colors, logos, and usage for Alameda Soda + Brix Beverage" />

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Color palette</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
          {PALETTE.map((p) => (
            <Paper key={p.hex} variant="outlined" sx={{ overflow: 'hidden', cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }} onClick={() => copy(p.hex)}>
              <Box sx={{ height: 64, bgcolor: p.hex, borderBottom: '1px solid', borderColor: 'divider' }} />
              <Box sx={{ p: 1 }}>
                <Typography variant="body2" fontWeight={700}>{p.name}</Typography>
                <Typography variant="caption" color="text.secondary">{p.hex}</Typography>
              </Box>
            </Paper>
          ))}
        </Box>
      </Box>

      {logos.length > 0 && (
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>Logos</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
            {logos.map((l) => (
              <Paper key={l.id} variant="outlined" sx={{ p: 1.5 }}>
                <Box sx={{ aspectRatio: '4 / 3', display: 'grid', placeItems: 'center', bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
                  {l.thumbnailUrl && <Box component="img" src={l.thumbnailUrl} alt={l.title || ''} sx={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />}
                </Box>
                <Typography variant="caption" noWrap sx={{ display: 'block', mt: 0.75 }}>{l.title || l.filename}</Typography>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Typography</Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 800, fontSize: 28 }}>DM Sans — Headings</Typography>
          <Typography color="text.secondary">DM Sans is the house typeface across the portal and every APBG app. Use bold weights for headings, regular for body.</Typography>
        </Paper>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>Usage</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Chip size="small" color="success" label="Do" sx={{ mb: 1 }} />
            <Stack spacing={1}>{DOS.map((d) => <Stack key={d} direction="row" spacing={1}><Check size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} /><Typography variant="body2">{d}</Typography></Stack>)}</Stack>
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Chip size="small" color="error" label="Don’t" sx={{ mb: 1 }} />
            <Stack spacing={1}>{DONTS.map((d) => <Stack key={d} direction="row" spacing={1}><XIcon size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} /><Typography variant="body2">{d}</Typography></Stack>)}</Stack>
          </Paper>
        </Box>
      </Box>

      <Divider />
      <Typography variant="caption" color="text.secondary">
        Manage the assets shown here from the Library (tag logos with the “logo” type). This page reads live from the brand library.
      </Typography>
    </Stack>
  );
}
