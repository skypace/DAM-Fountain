import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, publicUrl } from './_shared/supabase.mjs';

const DEFAULT_DOC = {
  colors: [
    { name: 'Brix Navy (°bx)', hex: '#1F4E79' },
    { name: 'Accent Blue', hex: '#3B82F6' },
    { name: 'Slate 900', hex: '#0F172A' },
    { name: 'Alameda Red', hex: '#C8102E' },
  ],
  fonts: [{ name: 'DM Sans', note: 'House typeface — bold for headings, regular for body.' }],
  sections: [],
  files: [],
};

function withUrls(doc) {
  const d = { ...DEFAULT_DOC, ...(doc || {}) };
  d.files = (d.files || []).map((f) => ({ ...f, url: f.path ? publicUrl(f.path) : f.url }));
  return d;
}

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  try {
    if (event.httpMethod === 'GET') {
      const auth = await requireRole(event, 'viewer');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const rows = await db('GET', 'brand_guidelines?id=eq.1&select=doc');
      return json({ doc: withUrls(rows[0]?.doc) });
    }
    if (event.httpMethod === 'PUT' || event.httpMethod === 'POST') {
      const auth = await requireRole(event, 'contributor');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const body = JSON.parse(event.body || '{}');
      const doc = body.doc || {};
      // Persist only the raw fields (strip any computed url on files).
      const clean = {
        colors: Array.isArray(doc.colors) ? doc.colors.slice(0, 100) : [],
        fonts: Array.isArray(doc.fonts) ? doc.fonts.slice(0, 50) : [],
        sections: Array.isArray(doc.sections) ? doc.sections.slice(0, 100) : [],
        files: Array.isArray(doc.files) ? doc.files.map((f) => ({ name: f.name, path: f.path, contentType: f.contentType })).slice(0, 200) : [],
      };
      await db('POST', 'brand_guidelines', { body: { id: 1, doc: clean, updated_at: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=minimal' });
      return json({ ok: true, doc: withUrls(clean) });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error('guidelines error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
