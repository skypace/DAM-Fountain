import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Button, Chip, CircularProgress, Container, Divider, Paper, Stack, Typography } from '@mui/material';
import { Copy, Download, Type as TypeIcon } from 'lucide-react';

interface Portal {
  brand: string; label: string;
  doc: { colors: { name: string; hex: string; pantone?: string; cmyk?: string }[]; fonts: { name: string; note?: string; url?: string; format?: string }[]; sections: { title: string; body: string }[]; files: { name: string; url?: string }[] };
  logos: { id: string; title: string | null; filename: string | null; url: string; isImage: boolean }[];
}

const FN = '/.netlify/functions';

export function BrandPortalPage() {
  const { brand = '' } = useParams();
  const [data, setData] = useState<Portal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [dark, setDark] = useState(false);

  useEffect(() => {
    fetch(`${FN}/brand-portal?brand=${encodeURIComponent(brand)}`)
      .then(async (r) => { if (!r.ok) throw new Error(`(${r.status})`); return r.json(); })
      .then(setData).catch((e) => setError(String(e.message || e)));
  }, [brand]);

  const copy = (t: string) => { navigator.clipboard?.writeText(t); setCopied(t); setTimeout(() => setCopied(''), 1200); };

  if (error) return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}><Typography color="text.secondary">Brand not found {error}</Typography></Box>;
  if (!data) return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>;

  const { doc } = data;
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f7f8fa' }}>
      <Box sx={{ bgcolor: '#0f172a', color: '#fff', py: 5 }}>
        <Container maxWidth="lg">
          <Typography variant="overline" sx={{ opacity: 0.7, letterSpacing: 2 }}>Brand Guidelines</Typography>
          <Typography variant="h3" sx={{ fontWeight: 800 }}>{data.label}</Typography>
        </Container>
      </Box>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={4}>
          {/* Colors */}
          {doc.colors.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Colors</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
                {doc.colors.map((c, i) => (
                  <Paper key={i} variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3 }}>
                    <Box sx={{ height: 84, bgcolor: c.hex || '#eee' }} />
                    <Box sx={{ p: 1.5 }}>
                      <Typography variant="subtitle2" noWrap>{c.name}</Typography>
                      {[['HEX', c.hex], ['Pantone', c.pantone], ['CMYK', c.cmyk]].filter(([, v]) => v).map(([k, v]) => (
                        <Stack key={k} direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ width: 52 }}>{k}</Typography>
                          <Typography variant="caption" sx={{ flex: 1, fontFamily: 'monospace' }} noWrap>{v}</Typography>
                          <Copy size={12} style={{ cursor: 'pointer', opacity: copied === v ? 1 : 0.5 }} onClick={() => copy(String(v))} />
                        </Stack>
                      ))}
                    </Box>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          {/* Logos */}
          {data.logos.length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <Typography variant="h6" sx={{ flex: 1 }}>Logos</Typography>
                <Button size="small" variant="outlined" onClick={() => setDark((v) => !v)}>{dark ? 'Light' : 'Dark'} background</Button>
              </Stack>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
                {data.logos.map((l) => (
                  <Paper key={l.id} variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3 }}>
                    <Box sx={{ height: 140, display: 'grid', placeItems: 'center', p: 2, bgcolor: dark ? '#0f172a' : '#fff' }}>
                      {l.isImage ? <Box component="img" src={l.url} alt={l.title || ''} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Typography variant="caption">{(l.filename || '').split('.').pop()?.toUpperCase()}</Typography>}
                    </Box>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" noWrap sx={{ flex: 1 }}>{l.title || l.filename}</Typography>
                      <Button size="small" startIcon={<Download size={14} />} component="a" href={l.url} download={l.filename || undefined} target="_blank" rel="noopener">Get</Button>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </Box>
          )}

          {/* Typography */}
          {doc.fonts.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Typography</Typography>
              <Stack spacing={1}>
                {doc.fonts.map((f, i) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <TypeIcon size={18} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2">{f.name}</Typography>
                      {f.note && <Typography variant="caption" color="text.secondary">{f.note}</Typography>}
                    </Box>
                    {f.url && <Button size="small" startIcon={<Download size={14} />} component="a" href={f.url} download target="_blank" rel="noopener">Font file</Button>}
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {/* Sections */}
          {doc.sections.map((sec, i) => (
            <Box key={i}>
              <Typography variant="h6" sx={{ mb: 0.5 }}>{sec.title}</Typography>
              <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>{sec.body}</Typography>
            </Box>
          ))}

          {/* Resource files */}
          {doc.files.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Resources</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {doc.files.map((f, i) => (
                  <Button key={i} size="small" variant="outlined" startIcon={<Download size={14} />} component="a" href={f.url} download target="_blank" rel="noopener">{f.name}</Button>
                ))}
              </Stack>
            </Box>
          )}

          <Divider />
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" label="Fountain DAM" />
            <Typography variant="caption" color="text.secondary">Alameda Point Beverage Group · brand assets</Typography>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
