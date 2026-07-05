import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, q } from './_shared/supabase.mjs';

const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  try {
    if (event.httpMethod === 'GET') {
      const auth = await requireRole(event, 'viewer');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const rows = await db('GET', 'brands?select=slug,label,is_sister,sort_order&order=sort_order.asc,label.asc');
      return json({ brands: rows });
    }
    if (event.httpMethod === 'POST') {
      const auth = await requireRole(event, 'contributor');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const body = JSON.parse(event.body || '{}');
      const label = String(body.label || '').trim();
      if (!label) return json({ error: 'A brand name is required' }, 400);
      const slug = slugify(body.slug || label);
      if (!slug) return json({ error: 'Could not derive a slug from that name' }, 400);
      const rows = await db('POST', 'brands?on_conflict=slug', {
        body: { slug, label, is_sister: body.is_sister !== false, sort_order: Number.isFinite(body.sort_order) ? body.sort_order : 100 },
        prefer: 'resolution=merge-duplicates,return=representation',
      });
      return json({ brand: rows?.[0] || { slug, label } });
    }
    if (event.httpMethod === 'DELETE') {
      const auth = await requireRole(event, 'admin');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const slug = (event.queryStringParameters?.slug || '').toLowerCase();
      if (!slug) return json({ error: 'slug is required' }, 400);
      if (['alameda', 'brix', 'shared'].includes(slug)) return json({ error: 'Built-in brands cannot be removed' }, 400);
      // Reassign any assets on this brand back to Shared so nothing is orphaned.
      await db('PATCH', `assets?brand=eq.${q(slug)}`, { body: { brand: 'shared' }, prefer: 'return=minimal' });
      await db('DELETE', `brands?slug=eq.${q(slug)}`, { prefer: 'return=minimal' });
      return json({ ok: true });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error('brands error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
