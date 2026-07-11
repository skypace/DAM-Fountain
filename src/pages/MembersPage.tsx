import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, FormControl, IconButton, InputLabel, MenuItem,
  Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { UserPlus, Trash2, MailPlus } from 'lucide-react';
import type { Member, Role } from '../lib/types';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';

const ROLES: Role[] = ['viewer', 'contributor', 'admin'];

export function MembersPage() {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('contributor');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try { setMembers(await api.listMembers()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const r = await api.addMember(email.trim(), role);
      setEmail(''); await load();
      if (r.status === 'created') toast(r.emailed ? 'User created — welcome email sent with sign-in details.' : `User created, but the welcome email failed (${r.email_error || 'email not configured'}). Use the resend button.`);
      else toast(r.emailed ? 'User added — access notification sent.' : 'User added (notification email not sent).');
    }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function changeRole(m: Member, r: Role) {
    try { await api.setMemberRole(m.user_id, r); setMembers((cur) => cur.map((x) => (x.user_id === m.user_id ? { ...x, role: r } : x))); toast('Role updated.'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }
  async function resendWelcome(m: Member) {
    if (!confirm(`Reset ${m.email}'s password and email them new sign-in details?`)) return;
    try { const r = await api.resendWelcome(m.user_id); toast(r.emailed ? 'Welcome email re-sent with a new temporary password.' : `Password was reset but the email failed (${r.email_error || 'email not configured'}).`); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }
  async function remove(m: Member) {
    if (!confirm(`Remove ${m.email} from Fountain DAM?`)) return;
    try { await api.removeMember(m.user_id); await load(); toast('Removed.'); } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Users & Roles"
        subtitle={<>Superadmins always have full access. <b>viewer</b> browses &amp; downloads · <b>contributor</b> uploads/tags/organizes/shares · <b>admin</b> also manages users.</>}
      />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        <TextField size="small" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ minWidth: 240 }} />
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Role</InputLabel>
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select></FormControl>
        <Button variant="contained" startIcon={<UserPlus size={16} />} onClick={add} disabled={busy}>Add user</Button>
      </Stack>

      {error && <Alert severity="warning" action={<Button size="small" onClick={load}>Retry</Button>}>{error}</Alert>}
      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}><CircularProgress /></Box> : (
        <Table size="small">
          <TableHead><TableRow><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell align="right" /></TableRow></TableHead>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.user_id}>
                <TableCell>{m.email}</TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <Select value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)}>{ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select>
                  </FormControl>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" title="Re-send welcome email (resets password)" onClick={() => resendWelcome(m)}><MailPlus size={15} /></IconButton>
                  <IconButton size="small" title="Remove" onClick={() => remove(m)}><Trash2 size={15} /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!members.length && <TableRow><TableCell colSpan={3}><Typography color="text.secondary" sx={{ py: 1 }}>No members added yet. Superadmins already have access.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}
