import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import type { Asset, Collection, Tag } from '../lib/types';
import { api } from '../lib/api';
import { mediaKind, MEDIA_META, type MediaKind } from '../lib/media';
import { useBrands } from '../lib/useBrands';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';

const fmtBytes = (n: number) => {
  if (!n) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB']; const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
};

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, flex: 1, minWidth: 150 }}>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>{value}</Typography>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
    </Paper>
  );
}

function Breakdown({ title, rows, onPick }: { title: string; rows: { key: string; label: string; count: number; color?: string }[]; onPick?: (key: string) => void }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, flex: 1, minWidth: 260 }}>
      <Typography variant="subtitle1" sx={{ mb: 1.5 }}>{title}</Typography>
      <Stack spacing={1}>
        {rows.map((r) => (
          <Box key={r.key} sx={{ cursor: onPick ? 'pointer' : 'default' }} onClick={() => onPick?.(r.key)}>
            <Stack direction="row" justifyContent="space-between"><Typography variant="body2">{r.label}</Typography><Typography variant="body2" color="text.secondary">{r.count}</Typography></Stack>
            <Box sx={{ height: 6, borderRadius: 1, bgcolor: 'action.hover', mt: 0.5, overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${(r.count / max) * 100}%`, bgcolor: r.color || 'primary.main', borderRadius: 1 }} />
            </Box>
          </Box>
        ))}
        {!rows.length && <Typography variant="body2" color="text.secondary">Nothing yet.</Typography>}
      </Stack>
    </Paper>
  );
}

export function OverviewPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { labelOf } = useBrands();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const [a, c, t] = await Promise.all([api.listAssets({}), api.listCollections(), api.listTags()]); setAssets(a); setCollections(c); setTags(t); }
      catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s = useMemo(() => {
    const bytes = assets.reduce((sum, a) => sum + (a.bytes || 0), 0);
    const byBrand = new Map<string, number>();
    const byType = new Map<string, number>();
    const byMedia = new Map<MediaKind, number>();
    let untagged = 0;
    for (const a of assets) {
      byBrand.set(a.brand, (byBrand.get(a.brand) || 0) + 1);
      byType.set(a.type, (byType.get(a.type) || 0) + 1);
      const k = mediaKind(a.content_type, a.filename); byMedia.set(k, (byMedia.get(k) || 0) + 1);
      if (!a.tags?.length) untagged++;
    }
    const largest = [...assets].filter((a) => a.bytes).sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 6);
    return { bytes, byBrand, byType, byMedia, untagged, largest };
  }, [assets]);

  if (loading) return <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>;

  const brandRows = [...s.byBrand.entries()].sort((a, b) => b[1] - a[1]).map(([k, count]) => ({ key: k, label: labelOf(k), count }));
  const typeRows = [...s.byType.entries()].sort((a, b) => b[1] - a[1]).map(([k, count]) => ({ key: k, label: k, count }));
  const mediaRows = [...s.byMedia.entries()].sort((a, b) => b[1] - a[1]).map(([k, count]) => ({ key: k, label: MEDIA_META[k].label, count, color: MEDIA_META[k].color }));

  return (
    <Stack spacing={2.5}>
      <PageHeader title="Overview" subtitle="Library at a glance — Alameda Soda + Brix" />
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <StatTile label="Assets" value={assets.length} />
        <StatTile label="Folders" value={collections.length} />
        <StatTile label="Tags" value={tags.length} />
        <StatTile label="Storage used" value={fmtBytes(s.bytes)} />
        <StatTile label="Untagged" value={s.untagged} sub={s.untagged ? 'need tags' : 'all tagged'} />
      </Stack>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Breakdown title="By brand" rows={brandRows} onPick={(k) => nav(`/?brand=${encodeURIComponent(k)}`)} />
        <Breakdown title="By type" rows={typeRows} />
        <Breakdown title="By media" rows={mediaRows} />
      </Stack>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Largest files</Typography>
        <Stack spacing={0.75}>
          {s.largest.map((a) => (
            <Stack key={a.id} direction="row" justifyContent="space-between" sx={{ cursor: 'pointer' }} onClick={() => nav(`/?q=${encodeURIComponent(a.title || a.filename || '')}`)}>
              <Typography variant="body2" noWrap sx={{ flex: 1, mr: 2 }}>{a.title || a.filename}</Typography>
              <Typography variant="body2" color="text.secondary">{fmtBytes(a.bytes || 0)}</Typography>
            </Stack>
          ))}
          {!s.largest.length && <Typography variant="body2" color="text.secondary">No size data yet.</Typography>}
        </Stack>
      </Paper>
      {s.untagged > 0 && (
        <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => nav('/')}>Go tag {s.untagged} untagged asset{s.untagged === 1 ? '' : 's'} →</Button>
      )}
    </Stack>
  );
}
