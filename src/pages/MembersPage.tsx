import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, FormControl, IconButton, InputLabel, MenuItem,
  Select, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { UserPlus, Trash2 } from 'lucide-react';
import type { Member, Role } from '../lib/types';
import { api } from '../lib/api';
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
    try { const r = await api.addMember(email.trim(), role); setEmail(''); await load(); toast(r.status === 'created' ? 'User created + added.' : 'User added.'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function changeRole(m: Member, r: Role) {
    try { await api.setMemberRole(m.user_id, r); setMembers((cur) => cur.map((x) => (x.user_id === m.user_id ? { ...x, role: r } : x))); toast('Role updated.'); }
    catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }
  async function remove(m: Member) {
    if (!confirm(`Remove ${m.email} from Fountain DAM?`)) return;
    try { await api.removeMember(m.user_id); await load(); toast('Removed.'); } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h6">Users & Roles</Typography>
      <Typography variant="body2" color="text.secondary">
        Superadmins always have full access. Add teammates here — <b>viewer</b> can browse &amp; download, <b>contributor</b> can upload/tag/organize/share, <b>admin</b> can also manage users.
      </Typography>
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
                <TableCell align="right"><IconButton size="small" onClick={() => remove(m)}><Trash2 size={15} /></IconButton></TableCell>
              </TableRow>
            ))}
            {!members.length && <TableRow><TableCell colSpan={3}><Typography color="text.secondary" sx={{ py: 1 }}>No members added yet. Superadmins already have access.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}
