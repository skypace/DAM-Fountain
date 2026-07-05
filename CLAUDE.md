> **Architecture handbook:** This repo is part of the multi-repo APBG system documented in [`activespacescience/Skilliosis_Mytosis_Architecture`](https://github.com/activespacescience/Skilliosis_Mytosis_Architecture/blob/main/ARCHITECTURE.md). When work here touches architecture (new external service, cross-repo dependency, deploy target, MCP/connector, env-var category, new/renamed repo, or gateway proxy route), update `ARCHITECTURE.md` in the same change.

---

# Fountain DAM — Claude orientation

## What this is

**Fountain DAM** is the in-house **Digital Asset Management** app (brand asset library) for **Alameda Soda + Brix Beverage**, replacing the paid Brandox service. It's the successor to the single-page "Fountain" prototype that lived in `apbg-billing/public/fountain.html` — now its own app with tagging, collections, share links, and users.

- **Repo:** `skypace/dam-fountain`
- **Stack:** React 18 + Vite 5 + TypeScript + MUI v6 (SPA) · Netlify Functions (ESM `.mjs`) · Supabase (shared project `gfsdpwiqzshhexkofiif`)
- **Storage:** public Supabase bucket **`brand-assets`** (shared with the old page; no migration needed)
- **Metadata:** the **`dam`** Postgres schema (this repo owns it)
- **Auth:** Supabase Auth, shared SSO via `localStorage.apbg_session` (same as every APBG app)
- **Intended URL:** `alamedapointbg.com/fountain` (gateway proxy → this Netlify site) + `*.netlify.app` origin

## Roles

Access is gated by a DAM role resolved server-side in `netlify/functions/_shared/http.mjs`:

| Role | Can |
|---|---|
| **superadmin/admin** (from Supabase `app_metadata.role`) | everything (always treated as DAM admin) |
| `admin` (dam.members) | everything incl. managing users |
| `contributor` | upload / edit / tag / organize / create shares |
| `viewer` | browse + download |

Members are stored in `dam.members`; superadmins bypass and are always admin.

## Layout

```
src/
  main.tsx                  router: /s/:token is PUBLIC, everything else is auth-gated
  theme.ts                  dark navy MUI theme (matches the APBG hub)
  components/
    AuthGate.tsx            SSO or password login
    AppShell.tsx            sidebar nav (Library / Collections / Share Links / Users)
    AssetGrid.tsx           asset card grid (+ multi-select)
    AssetDialog.tsx         detail/edit: metadata, tags, add-to-collection, share, delete
    Toast.tsx               snackbar context
  pages/
    LibraryPage.tsx         search + type/brand/tag filters, upload, import-URL, bucket-import
    CollectionsPage.tsx     create/list/delete collections
    CollectionDetailPage.tsx  collection assets, remove, share whole collection
    SharesPage.tsx          manage share links (copy / open / revoke, view counts)
    MembersPage.tsx         users & roles
    SharePublicPage.tsx     PUBLIC branded gallery for /s/:token (password + download tracking)
  lib/  auth.ts · api.ts · types.ts

netlify/functions/
  _shared/supabase.mjs      PostgREST (dam schema) + Storage helpers (service key)
  _shared/http.mjs          CORS, json(), getAuth/requireRole
  assets.mjs                GET list(filters) · POST upload|import|migrate · PATCH · DELETE
  collections.mjs           CRUD + add/remove assets
  tags.mjs                  list/create/delete
  shares.mjs                create/list/patch/revoke (sha256 password, tokens)
  share-resolve.mjs         PUBLIC — resolves a token to its assets, logs view/download
  members.mjs               list/invite/set-role/remove (Supabase admin API)

supabase/migrations/0001_dam_schema.sql   the dam schema (applied live 2026-07-05)
```

## Data model (`dam` schema)

`assets` (storage_path, title, description, type, brand, status, tags via `asset_tags`↔`tags`, full-text `search` tsvector) · `collections` + `collection_assets` · `shares` + `share_events` · `members`.

**PostgREST:** `dam` is in the exposed-schemas list. RLS is ON with **no permissive policies** — only the service-role functions touch it; public share reads go exclusively through `share-resolve.mjs`.

## Netlify env vars (set on the new site)

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | `https://gfsdpwiqzshhexkofiif.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | functions read/write dam + storage + admin user API |
| `SUPABASE_ANON_KEY` | token validation in `getAuth` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | client login (build-time) |

## Deploy / go-live checklist

1. Create the Netlify site from this repo (build `npm install && npm run build`, publish `dist`, functions `netlify/functions`).
2. Set the env vars above (service key is required).
3. In the app: **Library → Import bucket** once to register the files already in `brand-assets` as `dam.assets` rows.
4. Repoint the gateway: change `apbg-gateway` `netlify.toml` `/fountain` → this site, and update the `gateway_apps` row `href` if needed (icon `fountain` already ships in apbg-gateway).
5. Retire `apbg-billing/public/fountain.html` + `proposal-brand-assets.mjs` once this is live (the Proposal Builder's `getBrandAssets` can repoint here later).

## What's built (Phase 1 — 2026-07-05)

Library (search + type/brand/tag filters, drag/drop upload, URL import, bucket backfill), asset detail/edit with tags + status + brand, collections, public share links (password + expiry + download tracking + view counts), users & roles. Icon = the Fountain tile (`public/fountain-icon.png`).

## Next (Phase 2 ideas)

Versioning + replace-file, brand-guidelines page (palette/fonts/do's & don'ts), bulk ZIP download, AI auto-tagging + alt-text (Anthropic key), analytics dashboard, custom share domain (`brand.brixbev.com`).

## Don't

- Don't expose the service-role key to the client (functions only; anon key in the browser).
- Don't add permissive RLS policies to `dam` — public access is only via `share-resolve`.
- Don't hard-delete the `brand-assets` bucket; it's shared with the legacy page during transition.
