import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, FormControl, InputAdornment, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from '@mui/material';
import { Images, FolderOpen, Share2, Users, LogOut, BookOpen, Search, X, FileImage, LayoutDashboard, Wrench, Code2, Wand2 } from 'lucide-react';
import { getSession, logout } from '../lib/auth';
import { api } from '../lib/api';
import { useBrands } from '../lib/useBrands';
import { useBrandScope } from '../lib/brandScope';
import { useIsAdmin } from '../lib/useIsAdmin';
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

// Admin-only nav items (gated by /whoami).
const ADMIN_NAV = [
  { to: '/studio', label: 'AI Studio', icon: Wand2 },
  { to: '/api', label: 'API', icon: Code2 },
];

// Solid light sidebar — a soft periwinkle-slate tinted with the Brix navy.
const SIDEBAR_BG = '#e7eef8';
const SIDEBAR_ACCENT = '#1f4e79';   // navy used for active text/icons
const SIDEBAR_TEXT = '#1f2a3d';
const SIDEBAR_MUTED = '#5b6a86';
const SIDEBAR_LINE = '#d3dcec';
const SIDEBAR_FIELD = '#ffffff';
const SIDEBAR_HOVER = 'rgba(31,78,121,.08)';

const sidebarFieldSx = {
  '& .MuiOutlinedInput-root': {
    color: SIDEBAR_TEXT,
    bgcolor: SIDEBAR_FIELD,
    borderRadius: 1,
    '& fieldset': { borderColor: SIDEBAR_LINE },
    '&:hover fieldset': { borderColor: '#b9c6dd' },
    '&.Mui-focused fieldset': { borderColor: SIDEBAR_ACCENT },
    '& .MuiSvgIcon-root': { color: SIDEBAR_MUTED },
    '& svg': { color: SIDEBAR_MUTED },
  },
  '& .MuiInputLabel-root': { color: SIDEBAR_MUTED },
  '& .MuiInputLabel-root.Mui-focused': { color: SIDEBAR_ACCENT },
  '& .MuiInputBase-input::placeholder': { color: SIDEBAR_MUTED, opacity: 1 },
};

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
        sx={sidebarFieldSx}
        InputProps={{
          startAdornment: <InputAdornment position="start"><Search size={15} /></InputAdornment>,
          endAdornment: q ? <InputAdornment position="end"><X size={14} style={{ cursor: 'pointer' }} onClick={() => setQ('')} /></InputAdornment> : undefined,
        }}
      />
      {hasResults && (
        <Paper elevation={4} sx={{ position: 'absolute', top: '100%', left: 0, right: 0, mt: 0.5, zIndex: 20, borderRadius: 1, overflow: 'hidden', maxHeight: 360, overflowY: 'auto' }}>
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
    <FormControl size="small" fullWidth sx={{ mb: 1.5, ...sidebarFieldSx }}>
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
  const isAdmin = useIsAdmin();
  const nav = useMemo(() => (isAdmin ? [...NAV, ...ADMIN_NAV] : NAV), [isAdmin]);

  return (
    <ToastProvider>
      <CommandPalette />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '248px 1fr' }, minHeight: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{ p: 2, display: { xs: 'none', md: 'block' }, position: 'sticky', top: 0, height: '100vh', bgcolor: SIDEBAR_BG, color: SIDEBAR_TEXT, borderRight: '1px solid', borderColor: SIDEBAR_LINE }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2.5 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: 1.5, bgcolor: SIDEBAR_ACCENT, display: 'grid', placeItems: 'center', boxShadow: '0 6px 16px rgba(31,78,121,.35)' }}>
              <Box component="img" src="/fountain-icon.png" alt="Fountain DAM" sx={{ width: 34, height: 34, display: 'block' }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" lineHeight={1.1} sx={{ color: SIDEBAR_TEXT }}>Fountain</Typography>
              <Typography variant="caption" sx={{ color: SIDEBAR_MUTED }}>DAM</Typography>
            </Box>
          </Stack>
          <BrandScopePicker />
          <SidebarSearch />
          <Stack spacing={0.5} sx={{ mt: 1.5 }}>
            {nav.map(({ to, label, icon: Icon }) => (
              <Button
                key={to}
                component={Link}
                to={to}
                startIcon={<Icon size={18} />}
                sx={{
                  justifyContent: 'flex-start', px: 1.25, py: 1, borderRadius: 1, minHeight: 38,
                  fontWeight: active(to) ? 700 : 600,
                  color: active(to) ? SIDEBAR_ACCENT : SIDEBAR_MUTED,
                  bgcolor: active(to) ? '#ffffff' : 'transparent',
                  boxShadow: active(to) ? '0 1px 3px rgba(15,23,42,.12)' : 'none',
                  '& .MuiButton-startIcon': { color: active(to) ? SIDEBAR_ACCENT : SIDEBAR_MUTED },
                  '&:hover': {
                    bgcolor: active(to) ? '#ffffff' : SIDEBAR_HOVER,
                    color: active(to) ? SIDEBAR_ACCENT : SIDEBAR_TEXT,
                    '& .MuiButton-startIcon': { color: active(to) ? SIDEBAR_ACCENT : SIDEBAR_TEXT },
                  },
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>
          <Box sx={{ position: 'absolute', bottom: 16, left: 16, right: 16, pt: 1.5, borderTop: '1px solid', borderColor: SIDEBAR_LINE }}>
            {email && <Typography variant="caption" noWrap sx={{ display: 'block', mb: 0.5, color: SIDEBAR_MUTED }}>{email}</Typography>}
            <Button size="small" fullWidth startIcon={<LogOut size={16} />} onClick={() => { logout(); location.reload(); }} sx={{ justifyContent: 'flex-start', color: SIDEBAR_MUTED, borderRadius: 1, '&:hover': { bgcolor: SIDEBAR_HOVER, color: SIDEBAR_TEXT } }}>
              Sign out
            </Button>
          </Box>
        </Box>
        <Box sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>{children}</Box>
      </Box>
    </ToastProvider>
  );
}
