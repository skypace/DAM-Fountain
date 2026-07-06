// Lightweight auth: shares the gateway's `apbg_session` (SSO across
// alamedapointbg.com) and falls back to a Supabase password-grant login.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://gfsdpwiqzshhexkofiif.supabase.co';
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdmc2Rwd2lxenNoaGV4a29maWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTUyMzcsImV4cCI6MjA5MTE3MTIzN30.AygnPJwQ5NfIeKwPtkO6tgVYmkV3MAxL1lMFwN9HPnY';

export interface Session { token: string; email?: string; role?: string; refresh_token?: string }

export function getSession(): Session | null {
  for (const key of ['apbg_session', 'apbg_dashboard_session']) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) { const s = JSON.parse(raw); if (s && s.token) return s; }
    } catch { /* ignore */ }
  }
  return null;
}

export function token(): string | null { return getSession()?.token || null; }

export async function login(email: string, password: string): Promise<Session> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error_description || d.msg || 'Sign in failed.');
  const sess: Session = { token: d.access_token, refresh_token: d.refresh_token, email, role: d.user?.user_metadata?.role };
  localStorage.setItem('apbg_session', JSON.stringify(sess));
  return sess;
}

export function logout() { localStorage.removeItem('apbg_session'); }

// Supabase access tokens expire (~1h). Exchange the refresh token for a fresh
// access token and persist it. Returns the new session, or null if it can't.
export async function refreshSession(): Promise<Session | null> {
  const s = getSession();
  if (!s?.refresh_token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.access_token) return null;
    const sess: Session = {
      token: d.access_token,
      refresh_token: d.refresh_token || s.refresh_token,
      email: s.email || d.user?.email,
      role: d.user?.user_metadata?.role || s.role,
    };
    localStorage.setItem('apbg_session', JSON.stringify(sess));
    return sess;
  } catch { return null; }
}

// Validate the stored token; if expired/invalid, try a refresh, else clear it.
// Used on app load so a stale session doesn't wedge the app in a "bad token" loop.
export async function ensureValidSession(): Promise<Session | null> {
  const s = getSession();
  if (!s?.token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${s.token}` } });
    if (res.ok) return s;
  } catch { /* network — fall through to refresh */ }
  const refreshed = await refreshSession();
  if (refreshed) return refreshed;
  logout();
  return null;
}
