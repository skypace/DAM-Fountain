import { createHash } from 'node:crypto';
import { preflight, json } from './_shared/http.mjs';
import { db, q, publicUrl } from './_shared/supabase.mjs';

const hashPw = (pw) => createHash('sha256').update(String(pw)).digest('hex');
const isImg = (p) => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(p || '');
const shape = (r) => ({
  id: r.id, title: r.title, type: r.type, brand: r.brand, filename: r.filename,
  url: publicUrl(r.storage_path), thumbnailUrl: isImg(r.storage_path) ? publicUrl(r.storage_path) : null,
  tags: (r.asset_tags || []).map((t) => t.tag).filter(Boolean),
});

// PUBLIC endpoint — no auth. Resolves a share token into its (approved) assets,
// enforcing password / expiry / revoked, and logs view + download events.
export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  try {
    const p = event.queryStringParameters || {};
    if (!p.token) return json({ error: 'token required' }, 400);
    const rows = await db('GET', `shares?token=eq.${q(p.token)}&select=*`);
    const share = rows[0];
    if (!share || share.revoked) return json({ error: 'This link is no longer available.' }, 404);
    if (share.expires_at && new Date(share.expires_at) < new Date()) return json({ error: 'This link has expired.' }, 410);
    if (share.password_hash) {
      if (!p.pw) return json({ needsPassword: true }, 401);
      if (hashPw(p.pw) !== share.password_hash) return json({ needsPassword: true, error: 'Incorrect password.' }, 401);
    }

    const ip = event.headers?.['x-forwarded-for'] || event.headers?.['client-ip'] || null;
    const ua = event.headers?.['user-agent'] || null;

    // Download tracking hit (fired by the public page before streaming a file).
    if (p.track === 'download') {
      await db('POST', 'share_events', { body: { share_id: share.id, event: 'download', asset_id: p.asset || null, ip, ua }, prefer: 'return=minimal' }).catch(() => {});
      return json({ ok: true });
    }

    let assets = [];
    if (share.kind === 'asset' && share.asset_id) {
      const a = await db('GET', `assets?id=eq.${q(share.asset_id)}&status=neq.archived&select=*,asset_tags(tag:tags(id,name))`);
      assets = a.map(shape);
    } else if (share.kind === 'collection' && share.collection_id) {
      const links = await db('GET', `collection_assets?collection_id=eq.${q(share.collection_id)}&select=sort_order,asset:assets(*,asset_tags(tag:tags(id,name)))&order=sort_order.asc`);
      assets = links.map((l) => l.asset).filter((a) => a && a.status !== 'archived').map(shape);
    }

    let heading = share.title;
    if (!heading && share.kind === 'collection' && share.collection_id) {
      const c = await db('GET', `collections?id=eq.${q(share.collection_id)}&select=name,description`);
      heading = c[0]?.name;
    }
    if (!heading) heading = assets[0]?.title || 'Shared brand assets';

    await db('PATCH', `shares?id=eq.${q(share.id)}`, { body: { view_count: (share.view_count || 0) + 1 }, prefer: 'return=minimal' }).catch(() => {});
    await db('POST', 'share_events', { body: { share_id: share.id, event: 'view', ip, ua }, prefer: 'return=minimal' }).catch(() => {});

    return json({ share: { title: heading, kind: share.kind, allow_download: share.allow_download }, assets });
  } catch (e) {
    console.error('share-resolve error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
