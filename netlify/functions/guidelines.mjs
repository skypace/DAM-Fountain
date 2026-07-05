import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, q, publicUrl } from './_shared/supabase.mjs';

// Brands are dynamic (dam.brands) — accept any slug-shaped brand key so sister
// brands get their own guidelines doc.
const isBrand = (b) => typeof b === 'string' && /^[a-z0-9-]{1,48}$/.test(b);
const BRANDS = { includes: isBrand };
const EMPTY = { colors: [], fonts: [], sections: [], files: [] };

// Compute public URLs for any uploaded font files + resource files.
function withUrls(doc) {
  const d = { ...EMPTY, ...(doc || {}) };
  d.files = (d.files || []).map((f) => ({ ...f, url: f.path ? publicUrl(f.path) : f.url }));
  d.fonts = (d.fonts || []).map((f) => ({ ...f, url: f.path ? publicUrl(f.path) : f.url }));
  return d;
}

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  try {
    const brandParam = (event.queryStringParameters?.brand || '').toLowerCase();
    const brand = BRANDS.includes(brandParam) ? brandParam : 'shared';

    if (event.httpMethod === 'GET') {
      const auth = await requireRole(event, 'viewer');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const rows = await db('GET', `brand_guidelines?brand=eq.${q(brand)}&select=doc`);
      return json({ brand, doc: withUrls(rows[0]?.doc) });
    }
    if (event.httpMethod === 'PUT' || event.httpMethod === 'POST') {
      const auth = await requireRole(event, 'contributor');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const body = JSON.parse(event.body || '{}');
      const b = BRANDS.includes((body.brand || '').toLowerCase()) ? body.brand.toLowerCase() : brand;
      const doc = body.doc || {};
      const clean = {
        colors: Array.isArray(doc.colors) ? doc.colors.map((c) => ({ name: c.name, hex: c.hex, pantone: c.pantone, cmyk: c.cmyk })).slice(0, 100) : [],
        fonts: Array.isArray(doc.fonts) ? doc.fonts.map((f) => ({ name: f.name, note: f.note, path: f.path, format: f.format })).slice(0, 50) : [],
        sections: Array.isArray(doc.sections) ? doc.sections.slice(0, 100) : [],
        files: Array.isArray(doc.files) ? doc.files.map((f) => ({ name: f.name, path: f.path, contentType: f.contentType })).slice(0, 200) : [],
      };
      await db('POST', 'brand_guidelines?on_conflict=brand', { body: { brand: b, doc: clean, updated_at: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=minimal' });
      return json({ ok: true, brand: b, doc: withUrls(clean) });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error('guidelines error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
