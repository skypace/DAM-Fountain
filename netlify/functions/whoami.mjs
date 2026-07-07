// Returns the signed-in caller's resolved DAM role (viewer / contributor / admin)
// and email. Used by the client to gate admin-only UI (e.g. the API docs page).
import { preflight, json, getAuth } from './_shared/http.mjs';

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  const auth = await getAuth(event);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  return json({ role: auth.role, email: auth.email, isAdmin: auth.role === 'admin' });
}
