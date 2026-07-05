import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, q } from './_shared/supabase.mjs';

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  try {
    if (event.httpMethod === 'GET') {
      const auth = await requireRole(event, 'viewer');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const rows = await db('GET', 'tags?select=id,name,asset_tags(count)&order=name.asc');
      return json({ tags: rows.map((t) => ({ id: t.id, name: t.name, count: t.asset_tags?.[0]?.count ?? 0 })) });
    }
    const auth = await requireRole(event, 'contributor');
    if (!auth.ok) return json({ error: auth.error }, auth.status);
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      const name = String(b.name || '').trim().toLowerCase();
      if (!name) return json({ error: 'name required' }, 400);
      const rows = await db('POST', 'tags', { body: { name }, prefer: 'resolution=merge-duplicates,return=representation' });
      return json({ tag: rows[0] }, 201);
    }
    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return json({ error: 'id required' }, 400);
      await db('DELETE', `tags?id=eq.${q(id)}`);
      return json({ ok: true });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error('tags error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
