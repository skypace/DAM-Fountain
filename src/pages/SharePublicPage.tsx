import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Button, CircularProgress, Container, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { Download } from 'lucide-react';

interface ShareAsset { id: string; title: string | null; filename: string | null; type: string; url: string; thumbnailUrl: string | null }
interface ShareMeta { title: string; kind: string; allow_download: boolean }

const FN = '/.netlify/functions/share-resolve';

export function SharePublicPage() {
  const { token = '' } = useParams();
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [assets, setAssets] = useState<ShareAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(async (pw?: string) => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ token }); if (pw) qs.set('pw', pw);
      const res = await fetch(`${FN}?${qs}`);
      const data = await res.json();
      if (res.status === 401 && data.needsPassword) { setNeedsPassword(true); if (data.error) setError(data.error); return; }
      if (!res.ok) { setError(data.error || 'Unable to load.'); setMeta(null); return; }
      setMeta(data.share); setAssets(data.assets || []); setNeedsPassword(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { resolve(); }, [resolve]);

  function download(a: ShareAsset) {
    const qs = new URLSearchParams({ token, track: 'download', asset: a.id });
    if (password) qs.set('pw', password);
    fetch(`${FN}?${qs}`).catch(() => {});
    const el = document.createElement('a'); el.href = a.url; el.target = '_blank'; el.rel = 'noopener'; el.download = a.filename || a.title || 'asset';
    document.body.appendChild(el); el.click(); el.remove();
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', py: 2 }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box component="img" src="/fountain-icon.png" alt="Fountain DAM" sx={{ width: 40, height: 40, borderRadius: 1.5 }} />
            <Box>
              <Typography variant="subtitle1" lineHeight={1.1}>Fountain DAM</Typography>
              <Typography variant="caption" color="text.secondary">Alameda Soda + Brix Beverage</Typography>
            </Box>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>
          : needsPassword ? (
            <Paper variant="outlined" sx={{ p: 4, maxWidth: 380, mx: 'auto' }}>
              <Typography variant="h6" gutterBottom>Password required</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>This shared gallery is password-protected.</Typography>
              <Stack spacing={1.5}>
                <TextField size="small" type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') resolve(password); }} />
                {error && <Typography variant="body2" color="error">{error}</Typography>}
                <Button variant="contained" onClick={() => resolve(password)}>View</Button>
              </Stack>
            </Paper>
          ) : error ? (
            <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">{error}</Typography></Paper>
          ) : (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h5" fontWeight={800}>{meta?.title}</Typography>
                <Typography variant="body2" color="text.secondary">{assets.length} asset{assets.length === 1 ? '' : 's'} shared with you</Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
                {assets.map((a) => (
                  <Paper key={a.id} variant="outlined" sx={{ overflow: 'hidden' }}>
                    <Box sx={{ aspectRatio: '4 / 3', bgcolor: 'action.hover', display: 'grid', placeItems: 'center' }}>
                      {a.thumbnailUrl ? <Box component="img" src={a.thumbnailUrl} alt={a.title || ''} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Typography variant="h4">📄</Typography>}
                    </Box>
                    <Stack sx={{ p: 1.25 }} spacing={0.75}>
                      <Typography variant="body2" fontWeight={700} noWrap title={a.title || ''}>{a.title || a.filename}</Typography>
                      {meta?.allow_download && <Button size="small" variant="outlined" startIcon={<Download size={15} />} onClick={() => download(a)}>Download</Button>}
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </Stack>
          )}
      </Container>
    </Box>
  );
}
