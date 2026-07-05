# Fountain DAM

The Alameda Soda + Brix Beverage brand asset library — an in-house **Digital Asset Management** app that replaces Brandox. Tag, organize into collections, share public links, and manage users; everything is backed by the shared Supabase `brand-assets` bucket and the `dam` schema.

React + Vite + TypeScript + MUI, with Netlify Functions and Supabase. See [`CLAUDE.md`](CLAUDE.md) for architecture, the data model, env vars, and the go-live checklist.

## Develop

```bash
npm install
npm run dev        # Vite dev server (functions need `netlify dev` for the API)
npm run build      # tsc + vite build → dist/
```

Set the env vars in `.env.example` (client `VITE_*`, plus `SUPABASE_SERVICE_ROLE_KEY` for functions). Deploys on Netlify: build `npm install && npm run build`, publish `dist`, functions in `netlify/functions`.

## Features

- **Library** — search + filter by type / brand / tag, drag-and-drop upload, import-from-URL, one-click backfill of files already in the bucket.
- **Tags** — freeform tagging with full-text search.
- **Collections** — curated named sets; add/remove; share a whole collection.
- **Share links** — public tokenized galleries with optional password + expiry, download toggle, view/download tracking, revoke.
- **Users & roles** — viewer / contributor / admin; superadmins always have access.
- **Public share pages** at `/s/:token` — branded, no login.
