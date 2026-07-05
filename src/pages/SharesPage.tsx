import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, Tooltip, Typography,
} from '@mui/material';
import { Copy, ExternalLink, Ban } from 'lucide-react';
import type { Share } from '../lib/types';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';

export function SharesPage() {
  const toast = useToast();
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try { setShares(await api.listShares()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const urlFor = (s: Share) => `${location.origin}/s/${s.token}`;
  const label = (s: Share) => s.title || s.collection?.name || s.asset?.title || (s.kind === 'collection' ? 'Collection' : 'Asset');
  async function revoke(s: Share) {
    if (!confirm('Revoke this share link? It will stop working immediately.')) return;
    try { await api.revokeShare(s.id); await load(); toast('Revoked.'); } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <Stack spacing={2}>
      <PageHeader title="Share Links" subtitle="Public links to assets or collections — with optional password, expiry, and view tracking" />
      {error && <Alert severity="warning" action={<Button size="small" onClick={load}>Retry</Button>}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box> : (
        !shares.length ? <Typography color="text.secondary">No share links yet. Create one from an asset or a collection.</Typography> : (
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Shared item</TableCell><TableCell>Kind</TableCell><TableCell>Protections</TableCell>
              <TableCell align="right">Views</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {shares.map((s) => (
                <TableRow key={s.id} sx={{ opacity: s.revoked ? 0.5 : 1 }}>
                  <TableCell>{label(s)}</TableCell>
                  <TableCell><Chip size="small" variant="outlined" label={s.kind} /></TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {s.has_password && <Chip size="small" label="password" />}
                      {s.expires_at && <Chip size="small" label={`expires ${new Date(s.expires_at).toLocaleDateString()}`} />}
                      {!s.allow_download && <Chip size="small" label="no download" />}
                      {s.revoked && <Chip size="small" color="error" label="revoked" />}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">{s.view_count}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Copy link"><span><IconButton size="small" disabled={s.revoked} onClick={() => navigator.clipboard.writeText(urlFor(s)).then(() => toast('Copied.'))}><Copy size={15} /></IconButton></span></Tooltip>
                    <Tooltip title="Open"><span><IconButton size="small" disabled={s.revoked} component="a" href={urlFor(s)} target="_blank" rel="noopener"><ExternalLink size={15} /></IconButton></span></Tooltip>
                    <Tooltip title="Revoke"><span><IconButton size="small" disabled={s.revoked} onClick={() => revoke(s)}><Ban size={15} /></IconButton></span></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      )}
    </Stack>
  );
}
