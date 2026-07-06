import { useState, type ReactNode } from 'react';
import { Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { getSession, login } from '../lib/auth';

export function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(() => !!getSession());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authed) return <>{children}</>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await login(email.trim(), password); setAuthed(true); }
    catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ p: 4, width: '100%', maxWidth: 400, borderRadius: 1 }}>
        <Stack spacing={1.25} sx={{ mb: 2 }} alignItems="center" textAlign="center">
          <Box component="img" src="/fountain-icon.png" alt="Fountain DAM" sx={{ width: 64, height: 64, borderRadius: 1 }} />
          <Typography variant="h6">Fountain DAM</Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in with your Alameda Point BG account to manage the brand library.
          </Typography>
        </Stack>
        <form onSubmit={submit}>
          <Stack spacing={1.5}>
            <TextField size="small" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            <TextField size="small" label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            {error && <Typography variant="body2" color="error">{error}</Typography>}
            <Button type="submit" variant="contained" disabled={busy} startIcon={busy ? <CircularProgress size={16} /> : undefined}>
              Sign in
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
