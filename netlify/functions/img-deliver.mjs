// Fountain DAM — stable "live link" image delivery.
// Give a partner/store ONE URL per asset:  https://fountain-dam.netlify.app/i/<assetId>
// It 302-redirects to the asset's CURRENT version in storage. When you replace the
// asset in the DAM (new version), the same link serves the new file automatically —
// no change needed on their site. Public by design (brand-assets are public), and
// only serves live (non-deleted) assets.
//
//   /i/<id>            → current version
//   /i/<id>?v=<n>      → pin a specific version number (won't auto-update)
//   /i/<id>?w=<px>     → downscaled via Supabase render (e.g. ?w=800)
import { db, q, publicUrl, SUPABASE_URL } from './_shared/supabase.mjs';

const BUCKET = 'brand-assets';
function rendered(storagePath, width) {
  const clean = String(storagePath || '').replace(/^\/+/, '');
  const enc = clean.split('/').map(encodeURIComponent).join('/');
  return `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}/${enc}?width=${width}&quality=85&resize=contain`;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  const p = event.queryStringParameters || {};
  // id comes from ?id= or the trailing path segment (/i/<id> → …/img-deliver/<id>).
  let id = p.id;
  if (!id) {
    const seg = String(event.path || '').split('/').filter(Boolean).pop();
    if (seg && seg !== 'img-deliver' && seg !== 'i') id = seg;
  }
  if (!id) return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'id required' }) };

  try {
    const rows = await db('GET', `assets?id=eq.${q(id)}&select=storage_path,version,deleted_at`);
    const asset = rows[0];
    if (!asset || asset.deleted_at) return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'not found' }) };

    let storagePath = asset.storage_path;
    let pinned = false;
    // Pin an older version by number if requested.
    if (p.v && Number(p.v) !== (asset.version || 1)) {
      const vrows = await db('GET', `asset_versions?asset_id=eq.${q(id)}&version=eq.${q(p.v)}&select=storage_path&limit=1`);
      if (vrows[0]?.storage_path) { storagePath = vrows[0].storage_path; pinned = true; }
    }

    const width = Number(p.w);
    const target = width && width >= 16 && width <= 4096 ? rendered(storagePath, Math.round(width)) : publicUrl(storagePath);

    // Pinned versions are immutable → cache hard. Live links cache briefly so a
    // new version propagates within a few minutes.
    const cache = pinned
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=300, stale-while-revalidate=86400';
    return { statusCode: 302, headers: { Location: target, 'Cache-Control': cache, 'Access-Control-Allow-Origin': '*' }, body: '' };
  } catch (e) {
    console.error('img-deliver error', e);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }) };
  }
}
