import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Images, FolderOpen, Share2, Users, LogOut, BookOpen } from 'lucide-react';
import { getSession, logout } from '../lib/auth';
import { ToastProvider } from './Toast';

const NAV = [
  { to: '/', label: 'Library', icon: Images },
  { to: '/collections', label: 'Collections', icon: FolderOpen },
  { to: '/guidelines', label: 'Guidelines', icon: BookOpen },
  { to: '/shares', label: 'Share Links', icon: Share2 },
  { to: '/members', label: 'Users', icon: Users },
];

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const email = getSession()?.email;
  const active = (to: string) => (to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to));

  return (
    <ToastProvider>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '236px 1fr' }, minHeight: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{ borderRight: '1px solid', borderColor: 'divider', p: 2, display: { xs: 'none', md: 'block' }, position: 'sticky', top: 0, height: '100vh', bgcolor: '#fafbfc' }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 3 }}>
            <Box component="img" src="/fountain-icon.png" alt="Fountain DAM" sx={{ width: 40, height: 40, borderRadius: 2, display: 'block' }} />
            <Box>
              <Typography variant="subtitle1" lineHeight={1.1}>Fountain</Typography>
              <Typography variant="caption" color="text.secondary">DAM</Typography>
            </Box>
          </Stack>
          <Stack spacing={0.5}>
            {NAV.map(({ to, label, icon: Icon }) => (
              <Button
                key={to}
                component={Link}
                to={to}
                startIcon={<Icon size={18} />}
                sx={{
                  justifyContent: 'flex-start', px: 1.5, py: 1, color: active(to) ? 'primary.main' : 'text.secondary',
                  bgcolor: active(to) ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover' },
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
