// One-shot backfill: (re)send sign-in emails to existing DAM members.
// Members created before welcome emails existed never received credentials.
// For each member: if they've NEVER signed in, reset to a fresh temp password
// and send the welcome email (credentials); if they have signed in, send the
// access-granted note only (their password is untouched).
//
// Gated by BACKFILL_TOKEN (Netlify env) via the X-Backfill-Token header —
// there is no user in the loop, so JWT auth doesn't apply here.
//
//   curl -X POST https://fountain-dam.netlify.app/.netlify/functions/member-backfill \
//     -H "X-Backfill-Token: $BACKFILL_TOKEN" [-d '{"dry_run":true}']
import { randomBytes } from 'node:crypto';
import { preflight, json } from './_shared/http.mjs';
import { db, SUPABASE_URL, SERVICE_KEY } from './_shared/supabase.mjs';
import { sendWelcomeEmail, sendAccessEmail } from './_shared/email.mjs';

async function adminApi(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null; if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) { const e = new Error((data && data.msg) || `Auth admin ${res.status}`); e.status = res.status; throw e; }
  return data;
}

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  const token = process.env.BACKFILL_TOKEN || '';
  const given = event.headers?.['x-backfill-token'] || event.headers?.['X-Backfill-Token'] || '';
  if (!token || given !== token) return json({ error: 'forbidden' }, 403);
  if (event.httpMethod !== 'POST') return json({ error: 'method not allowed' }, 405);

  const dryRun = !!JSON.parse(event.body || '{}').dry_run;
  const members = await db('GET', 'members?select=user_id,email,role&order=created_at.asc');
  const results = [];
  for (const m of members || []) {
    try {
      const user = await adminApi('GET', `admin/users/${m.user_id}`);
      const neverSignedIn = !user?.last_sign_in_at;
      if (dryRun) { results.push({ email: m.email, would: neverSignedIn ? 'welcome+reset' : 'access-note' }); continue; }
      let mail;
      if (neverSignedIn) {
        const password = randomBytes(12).toString('base64url');
        await adminApi('PUT', `admin/users/${m.user_id}`, { password });
        mail = await sendWelcomeEmail({ to: m.email, password, role: m.role });
        results.push({ email: m.email, action: 'welcome+reset', emailed: mail.sent, error: mail.error });
      } else {
        mail = await sendAccessEmail({ to: m.email, role: m.role });
        results.push({ email: m.email, action: 'access-note', emailed: mail.sent, error: mail.error });
      }
    } catch (e) {
      results.push({ email: m.email, action: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }
  return json({ ok: true, dry_run: dryRun, count: results.length, results });
}
