import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, q } from './_shared/supabase.mjs';

const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const BUILTIN = ['logo', 'can', 'equipment', 'hero', 'testimonial', 'sell-sheet', 'other'];

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  try {
    if (event.httpMethod === 'GET') {
      const auth = await requireRole(event, 'viewer');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const rows = await db('GET', 'asset_types?select=slug,label,sort_order&order=sort_order.asc,label.asc');
      return json({ types: rows });
    }
    if (event.httpMethod === 'POST') {
      const auth = await requireRole(event, 'contributor');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const body = JSON.parse(event.body || '{}');
      const label = String(body.label || '').trim();
      if (!label) return json({ error: 'A type name is required' }, 400);
      const slug = slugify(body.slug || label);
      if (!slug) return json({ error: 'Could not derive a slug from that name' }, 400);
      const rows = await db('POST', 'asset_types?on_conflict=slug', {
        body: { slug, label, sort_order: Number.isFinite(body.sort_order) ? body.sort_order : 500 },
        prefer: 'resolution=merge-duplicates,return=representation',
      });
      return json({ type: rows?.[0] || { slug, label } });
    }
    if (event.httpMethod === 'DELETE') {
      const auth = await requireRole(event, 'admin');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const slug = (event.queryStringParameters?.slug || '').toLowerCase();
      if (!slug) return json({ error: 'slug is required' }, 400);
      if (BUILTIN.includes(slug)) return json({ error: 'Built-in types cannot be removed' }, 400);
      await db('PATCH', `assets?type=eq.${q(slug)}`, { body: { type: 'other' }, prefer: 'return=minimal' });
      await db('DELETE', `asset_types?slug=eq.${q(slug)}`, { prefer: 'return=minimal' });
      return json({ ok: true });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error('types error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
