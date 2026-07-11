import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, q, SUPABASE_URL, SERVICE_KEY } from './_shared/supabase.mjs';
import { sendWelcomeEmail, sendAccessEmail, tempPassword } from './_shared/email.mjs';

const ROLES = ['viewer', 'contributor', 'admin'];

async function adminApi(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null; if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) { const e = new Error((data && data.msg) || (data && data.error_description) || `Auth admin ${res.status}`); e.status = res.status; throw e; }
  return data;
}

async function findUserByEmail(email) {
  const lower = String(email).toLowerCase();
  const data = await adminApi('GET', 'admin/users?per_page=200');
  return (data?.users || []).find((u) => String(u.email || '').toLowerCase() === lower) || null;
}

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  try {
    const auth = await requireRole(event, event.httpMethod === 'GET' ? 'contributor' : 'admin');
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    if (event.httpMethod === 'GET') {
      const rows = await db('GET', 'members?select=user_id,email,role,created_at&order=created_at.asc');
      return json({ members: rows });
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');

      // Reset password + re-send credentials for an existing member.
      if (b.action === 'resend_welcome') {
        if (!b.user_id) return json({ error: 'user_id required' }, 400);
        const rows = await db('GET', `members?user_id=eq.${q(b.user_id)}&select=email,role`);
        const member = rows?.[0];
        if (!member) return json({ error: 'member not found' }, 404);
        const password = tempPassword();
        await adminApi('PUT', `admin/users/${b.user_id}`, { password });
        const mail = await sendWelcomeEmail({ to: member.email, password, role: member.role });
        return json({ ok: true, emailed: mail.sent, email_error: mail.sent ? undefined : mail.error });
      }

      const email = String(b.email || '').trim().toLowerCase();
      const role = ROLES.includes(b.role) ? b.role : 'viewer';
      if (!email) return json({ error: 'email required' }, 400);
      let user = await findUserByEmail(email);
      let status = 'added';
      let mail = { sent: false };
      if (!user) {
        const password = tempPassword();
        user = await adminApi('POST', 'admin/users', { email, email_confirm: true, password });
        status = 'created';
        await db('POST', 'members', { body: { user_id: user.id, email, role, invited_by: auth.user.id }, prefer: 'resolution=merge-duplicates,return=minimal' });
        mail = await sendWelcomeEmail({ to: email, password, role });
      } else {
        await db('POST', 'members', { body: { user_id: user.id, email, role, invited_by: auth.user.id }, prefer: 'resolution=merge-duplicates,return=minimal' });
        mail = await sendAccessEmail({ to: email, role });
      }
      return json({ ok: true, status, emailed: mail.sent, email_error: mail.sent ? undefined : mail.error, member: { user_id: user.id, email, role } }, 201);
    }

    if (event.httpMethod === 'PATCH') {
      const b = JSON.parse(event.body || '{}');
      if (!b.user_id || !ROLES.includes(b.role)) return json({ error: 'user_id + valid role required' }, 400);
      await db('PATCH', `members?user_id=eq.${q(b.user_id)}`, { body: { role: b.role }, prefer: 'return=minimal' });
      return json({ ok: true });
    }

    if (event.httpMethod === 'DELETE') {
      const uid = event.queryStringParameters?.user_id;
      if (!uid) return json({ error: 'user_id required' }, 400);
      await db('DELETE', `members?user_id=eq.${q(uid)}`);
      return json({ ok: true });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error('members error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
