import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, FormControl, InputAdornment, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { Images, FolderOpen, Share2, Users, LogOut, BookOpen, Search, X, FileImage, LayoutDashboard, Wrench } from 'lucide-react';
import { getSession, logout } from '../lib/auth';
import { api } from '../lib/api';
import { useBrands } from '../lib/useBrands';
import { useBrandScope } from '../lib/brandScope';
import type { Asset, Collection } from '../lib/types';
import { CommandPalette } from './CommandPalette';
import { ToastProvider } from './Toast';

const NAV = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/', label: 'Library', icon: Images },
  { to: '/collections', label: 'Collections', icon: FolderOpen },
  { to: '/guidelines', label: 'Guidelines', icon: BookOpen },
  { to: '/shares', label: 'Share Links', icon: Share2 },
  { to: '/members', label: 'Users', icon: Users },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench },
];

// Collapsible sidebar search: shows a box, and reveals matching collections +
// assets only while there's a query with matches.
function SidebarSearch() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [cols, setCols] = useState<Collection[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setCols([]); setAssets([]); return; }
    const id = setTimeout(async () => {
      try {
        const [all, a] = await Promise.all([api.listCollections(), api.listAssets({ q: term })]);
        setCols(all.filter((c) => c.name.toLowerCase().includes(term.toLowerCase())).slice(0, 5));
        setAssets(a.slice(0, 6));
      } catch { /* ignore */ }
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  const hasResults = q.trim() && (cols.length > 0 || assets.length > 0);
  const go = (path: string) => { setQ(''); nav(path); };

  return (
    <Box ref={boxRef} sx={{ position: 'relative', mb: 1 }}>
      <TextField
        size="small" fullWidth placeholder="Search" value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) go(`/?q=${encodeURIComponent(q.trim())}`); }}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search size={15} /></InputAdornment>,
          endAdornment: q ? <InputAdornment position="end"><X size={14} style={{ cursor: 'pointer' }} onClick={() => setQ('')} /></InputAdornment> : undefined,
        }}
      />
      {hasResults && (
        <Paper elevation={4} sx={{ position: 'absolute', top: '100%', left: 0, right: 0, mt: 0.5, zIndex: 20, borderRadius: 2, overflow: 'hidden', maxHeight: 360, overflowY: 'auto' }}>
          {cols.length > 0 && <Typography variant="caption" sx={{ px: 1.5, pt: 1, display: 'block', color: 'text.secondary' }}>Folders</Typography>}
          {cols.map((c) => (
            <MenuItem key={c.id} dense onClick={() => go(`/collections/${c.id}`)}>
              <FolderOpen size={14} style={{ marginRight: 8, opacity: 0.6 }} />
              <Typography variant="body2" noWrap>{c.name}</Typography>
            </MenuItem>
          ))}
          {assets.length > 0 && <Typography variant="caption" sx={{ px: 1.5, pt: 1, display: 'block', color: 'text.secondary' }}>Assets</Typography>}
          {assets.map((a) => (
            <MenuItem key={a.id} dense onClick={() => go(`/?q=${encodeURIComponent(a.title || a.filename || '')}`)}>
              <FileImage size={14} style={{ marginRight: 8, opacity: 0.6 }} />
              <Typography variant="body2" noWrap>{a.title || a.filename}</Typography>
            </MenuItem>
          ))}
          <MenuItem dense onClick={() => go(`/?q=${encodeURIComponent(q.trim())}`)} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <Search size={14} style={{ marginRight: 8, opacity: 0.6 }} />
            <Typography variant="body2">See all results for “{q.trim()}”</Typography>
          </MenuItem>
        </Paper>
      )}
    </Box>
  );
}

function BrandScopePicker() {
  const { brands } = useBrands();
  const [scope, setScope] = useBrandScope();
  return (
    <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
      <InputLabel>Brand</InputLabel>
      <Select label="Brand" value={brands.some((b) => b.slug === scope) || scope === 'all' ? scope : 'all'} onChange={(e) => setScope(e.target.value)}>
        <MenuItem value="all">All brands</MenuItem>
        {brands.map((b) => <MenuItem key={b.slug} value={b.slug}>{b.label}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const email = getSession()?.email;
  const active = (to: string) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to));
  const nav = useMemo(() => NAV, []);

  return (
    <ToastProvider>
      <CommandPalette />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '236px 1fr' }, minHeight: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{ borderRight: '1px solid', borderColor: 'divider', p: 2, display: { xs: 'none', md: 'block' }, position: 'sticky', top: 0, height: '100vh', bgcolor: '#ffffff' }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2.5 }}>
            <Box component="img" src="/fountain-icon.png" alt="Fountain DAM" sx={{ width: 40, height: 40, borderRadius: 2, display: 'block' }} />
            <Box>
              <Typography variant="subtitle1" lineHeight={1.1}>Fountain</Typography>
              <Typography variant="caption" color="text.secondary">DAM</Typography>
            </Box>
          </Stack>
          <BrandScopePicker />
          <SidebarSearch />
          <Stack spacing={0.5}>
            {nav.map(({ to, label, icon: Icon }) => (
              <Button
                key={to}
                component={Link}
                to={to}
                startIcon={<Icon size={18} />}
                sx={{
                  justifyContent: 'flex-start', px: 1.5, py: 1, borderRadius: 2,
                  fontWeight: active(to) ? 700 : 600,
                  color: active(to) ? 'primary.main' : 'text.secondary',
                  bgcolor: active(to) ? 'action.selected' : 'transparent',
                  '& .MuiButton-startIcon': { color: active(to) ? 'primary.main' : 'text.disabled' },
                  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>
          <Box sx={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
            {email && <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mb: 0.5 }}>{email}</Typography>}
            <Button size="small" fullWidth startIcon={<LogOut size={16} />} onClick={() => { logout(); location.reload(); }} sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}>
              Sign out
            </Button>
          </Box>
        </Box>
        <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>{children}</Box>
      </Box>
    </ToastProvider>
  );
}
