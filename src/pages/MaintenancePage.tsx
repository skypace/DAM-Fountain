import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { RotateCcw, Trash2, Copy as CopyIcon } from 'lucide-react';
import type { Asset } from '../lib/types';
import { api } from '../lib/api';
import { mediaKind } from '../lib/media';
import { MediaPreview } from '../components/MediaPreview';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';

const fmtBytes = (n?: number | null) => {
  if (!n) return '';
  const u = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
};

function Thumb({ a }: { a: Asset }) {
  return (
    <Box sx={{ width: 46, height: 46, borderRadius: 1, bgcolor: 'action.hover', overflow: 'hidden', flexShrink: 0, display: 'grid', placeItems: 'center' }}>
      <MediaPreview url={a.url} filename={a.filename} contentType={a.content_type} variant="thumb" alt="" fit="cover" />
    </Box>
  );
}

export function MaintenancePage() {
  const toast = useToast();
  const [tab, setTab] = useState(0);
  const [all, setAll] = useState<Asset[]>([]);
  const [trash, setTrash] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try { const [a, t] = await Promise.all([api.listAssets({}), api.listTrash()]); setAll(a); setTrash(t); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Duplicate groups: assets sharing the same byte size (+ same filename when
  // present) are very likely the same file uploaded more than once.
  const dupeGroups = useMemo(() => {
    const by = new Map<string, Asset[]>();
    for (const a of all) {
      if (!a.bytes) continue;
      const key = `${a.bytes}::${(a.filename || '').toLowerCase()}`;
      if (!by.has(key)) by.set(key, []);
      by.get(key)!.push(a);
    }
    return [...by.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
  }, [all]);

  async function restore(id: string) { setBusy(true); try { await api.restoreAssets([id]); await load(); toast('Restored.'); } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }
  async function purge(a: Asset) {
    if (!confirm(`Permanently delete "${a.title || a.filename}"? This cannot be undone.`)) return;
    setBusy(true); try { await api.purgeAsset(a.id); await load(); toast('Permanently deleted.'); } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function trashOne(a: Asset) { setBusy(true); try { await api.deleteAsset(a.id); await load(); toast('Moved to Trash.'); } catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } }

  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Stack spacing={2}>
      <PageHeader title="Maintenance" subtitle="Find duplicates and manage trashed assets" />
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label={`Duplicates (${dupeGroups.length})`} icon={<CopyIcon size={15} />} iconPosition="start" sx={{ minHeight: 44 }} />
        <Tab label={`Trash (${trash.length})`} icon={<Trash2 size={15} />} iconPosition="start" sx={{ minHeight: 44 }} />
      </Tabs>

      {tab === 0 && (
        dupeGroups.length === 0
          ? <Alert severity="success">No duplicates found — every file is unique.</Alert>
          : (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">Grouped by identical size + filename. Keep one and trash the rest.</Typography>
              {dupeGroups.map((g, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Chip size="small" label={`${g.length} copies`} color="warning" />
                    <Typography variant="body2" noWrap sx={{ flex: 1 }}>{g[0].filename}</Typography>
                    <Typography variant="caption" color="text.secondary">{fmtBytes(g[0].bytes)} · {mediaKind(g[0].content_type, g[0].filename)}</Typography>
                  </Stack>
                  <Stack spacing={0.5}>
                    {g.map((a, idx) => (
                      <Stack key={a.id} direction="row" alignItems="center" spacing={1.25}>
                        <Thumb a={a} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" noWrap>{a.title || a.filename}{idx === 0 && <Chip size="small" label="keep" sx={{ ml: 1, height: 18 }} />}</Typography>
                          <Typography variant="caption" color="text.secondary">{(a.collections || []).map((c) => c.name).join(', ') || 'uncategorized'}</Typography>
                        </Box>
                        {idx > 0 && <Button size="small" color="error" startIcon={<Trash2 size={14} />} disabled={busy} onClick={() => trashOne(a)}>Trash</Button>}
                      </Stack>
                    ))}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )
      )}

      {tab === 1 && (
        trash.length === 0
          ? <Alert severity="info">Trash is empty.</Alert>
          : (
            <Stack spacing={0.5}>
              {trash.map((a) => (
                <Paper key={a.id} variant="outlined" sx={{ p: 1, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Thumb a={a} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap>{a.title || a.filename}</Typography>
                    <Typography variant="caption" color="text.secondary">{a.type} · {fmtBytes(a.bytes)}</Typography>
                  </Box>
                  <Button size="small" startIcon={<RotateCcw size={14} />} disabled={busy} onClick={() => restore(a.id)}>Restore</Button>
                  <Button size="small" color="error" startIcon={<Trash2 size={14} />} disabled={busy} onClick={() => purge(a)}>Delete forever</Button>
                </Paper>
              ))}
            </Stack>
          )
      )}
    </Stack>
  );
}
