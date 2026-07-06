import { preflight, json } from './_shared/http.mjs';
import { db, q, publicUrl } from './_shared/supabase.mjs';

// PUBLIC (no auth) read-only brand portal data: guidelines + logos for a brand.
// Meant to be shared with vendors/partners. Only exposes brand art + guidelines.
const isImg = (p) => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(p || '');
const withUrls = (doc) => {
  const d = { colors: [], fonts: [], sections: [], files: [], ...(doc || {}) };
  d.files = (d.files || []).map((f) => ({ ...f, url: f.path ? publicUrl(f.path) : f.url }));
  d.fonts = (d.fonts || []).map((f) => ({ ...f, url: f.path ? publicUrl(f.path) : f.url }));
  return d;
};

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  try {
    const brand = (event.queryStringParameters?.brand || '').toLowerCase();
    if (!/^[a-z0-9-]{1,48}$/.test(brand)) return json({ error: 'invalid brand' }, 400);

    const brandRow = (await db('GET', `brands?slug=eq.${q(brand)}&select=slug,label`))[0];
    const gl = (await db('GET', `brand_guidelines?brand=eq.${q(brand)}&select=doc`))[0];
    const logoRows = await db('GET', `assets?brand=eq.${q(brand)}&type=eq.logo&select=id,storage_path,filename,title,content_type&order=created_at.asc&limit=60`);
    const logos = logoRows.map((a) => ({
      id: a.id, title: a.title, filename: a.filename, content_type: a.content_type,
      url: publicUrl(a.storage_path), isImage: isImg(a.storage_path),
    }));
    return json({
      brand,
      label: brandRow?.label || (brand.charAt(0).toUpperCase() + brand.slice(1)),
      doc: withUrls(gl?.doc),
      logos,
    });
  } catch (e) {
    console.error('brand-portal error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
