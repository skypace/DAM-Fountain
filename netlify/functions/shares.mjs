import { randomBytes, createHash } from 'node:crypto';
import { preflight, json, requireRole } from './_shared/http.mjs';
import { db, q } from './_shared/supabase.mjs';

const hashPw = (pw) => createHash('sha256').update(String(pw)).digest('hex');

export async function handler(event) {
  const pre = preflight(event); if (pre) return pre;
  try {
    const auth = await requireRole(event, 'contributor');
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    if (event.httpMethod === 'GET') {
      const rows = await db('GET', 'shares?select=*,collection:collections(name),asset:assets(title,storage_path)&order=created_at.desc');
      return json({ shares: rows.map((s) => ({ ...s, has_password: !!s.password_hash, password_hash: undefined })) });
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      const kind = b.kind === 'asset' ? 'asset' : b.kind === 'collection' ? 'collection' : null;
      if (!kind) return json({ error: "kind must be 'asset' or 'collection'" }, 400);
      if (kind === 'asset' && !b.assetId) return json({ error: 'assetId required' }, 400);
      if (kind === 'collection' && !b.collectionId) return json({ error: 'collectionId required' }, 400);
      const token = randomBytes(12).toString('base64url');
      const expires_at = b.expiresInDays ? new Date(Date.now() + Number(b.expiresInDays) * 86400000).toISOString() : null;
      const row = {
        token, kind,
        asset_id: kind === 'asset' ? b.assetId : null,
        collection_id: kind === 'collection' ? b.collectionId : null,
        title: b.title || null,
        allow_download: b.allowDownload !== false,
        password_hash: b.password ? hashPw(b.password) : null,
        expires_at,
        created_by: auth.user.id,
        created_by_email: auth.email,
      };
      const rows = await db('POST', 'shares', { body: row, prefer: 'return=representation' });
      return json({ share: { ...rows[0], has_password: !!rows[0].password_hash, password_hash: undefined } }, 201);
    }

    if (event.httpMethod === 'PATCH') {
      const b = JSON.parse(event.body || '{}');
      if (!b.id) return json({ error: 'id required' }, 400);
      const patch = {};
      if ('revoked' in b) patch.revoked = !!b.revoked;
      if ('allowDownload' in b) patch.allow_download = !!b.allowDownload;
      if ('password' in b) patch.password_hash = b.password ? hashPw(b.password) : null;
      const rows = await db('PATCH', `shares?id=eq.${q(b.id)}`, { body: patch, prefer: 'return=representation' });
      return json({ share: { ...rows[0], has_password: !!rows[0]?.password_hash, password_hash: undefined } });
    }

    if (event.httpMethod === 'DELETE') {
      const id = event.queryStringParameters?.id;
      if (!id) return json({ error: 'id required' }, 400);
      await db('DELETE', `shares?id=eq.${q(id)}`);
      return json({ ok: true });
    }
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error('shares error', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, e?.status || 500);
  }
}
