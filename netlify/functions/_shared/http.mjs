// CORS + JSON helpers + auth gate shared by all Fountain DAM functions.
import { SUPABASE_URL, ANON_KEY, db, q } from './supabase.mjs';

export function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

export function json(body, status = 200) {
  return { statusCode: status, headers: { ...cors(), 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

export function preflight(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(), body: '' };
  return null;
}

const RANK = { viewer: 1, contributor: 2, admin: 3 };

// Validate the Bearer JWT and resolve the caller's DAM role.
// Superadmins/admins (app_metadata.role) are always DAM admins; otherwise the
// role comes from dam.members, defaulting authenticated users to viewer.
export async function getAuth(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  if (!m) return { ok: false, status: 401, error: 'Missing Authorization bearer token' };
  const jwt = m[1];
  let user;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${jwt}` } });
    if (!res.ok) return { ok: false, status: res.status >= 500 ? 502 : 401, error: 'Invalid or expired token' };
    user = await res.json();
  } catch {
    return { ok: false, status: 503, error: 'Auth service unavailable' };
  }
  if (!user?.id) return { ok: false, status: 401, error: 'Invalid token' };

  const appRole = user.app_metadata?.role || user.user_metadata?.role || null;
  let role = 'viewer';
  if (appRole === 'superadmin' || appRole === 'admin') {
    role = 'admin';
  } else {
    try {
      const rows = await db('GET', `members?user_id=eq.${q(user.id)}&select=role`);
      if (rows?.[0]?.role) role = rows[0].role;
    } catch { /* default viewer */ }
  }
  return { ok: true, user, role, email: user.email };
}

export async function requireRole(event, need = 'viewer') {
  const auth = await getAuth(event);
  if (!auth.ok) return auth;
  if ((RANK[auth.role] || 0) < (RANK[need] || 0)) {
    return { ok: false, status: 403, error: `Requires ${need} role (you are ${auth.role})` };
  }
  return auth;
}
