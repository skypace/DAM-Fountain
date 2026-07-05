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

- **Library** — search + filter by type / brand / **media kind** / tag, grid + table views, bulk actions (MUI X DataGrid Pro).
- **Uploads** — drag files/folders from the desktop (folder trees become nested collections), an "Upload folder" picker, import-from-URL, or one-click backfill of files already in the bucket. Any media type (image, vector, design source, video, audio, docs, archives, fonts). Large files upload direct-to-storage with a **live progress bar**.
- **Collections & sub-folders** — curated named sets that **nest** (a collection can hold sub-folders). Single-membership: an asset lives in exactly one folder. Drag an asset onto a folder/chip to move it; drag a folder onto another to nest it.
- **Folder covers** — pick any asset (image, **PDF, or video**) as a folder's cover thumbnail; rendered as a real preview.
- **Brands & sister brands** — dynamic brand registry (`dam.brands`): the built-in Alameda / Brix / Shared plus any number of sister brands, each with its own guidelines tab and library filter.
- **Brand guidelines** — per-brand colors, uploadable typeface files (live `@font-face` preview), notes, and resource files.
- **Tags** — freeform tagging with full-text search; optional AI auto-tagging.
- **Share links** — public tokenized galleries with optional password + expiry, download toggle, view/download tracking, revoke. Public pages at `/s/:token` — branded, no login.
- **Users & roles** — viewer / contributor / admin; superadmins always have access.

## Storage & upload limits

Media lives in the public Supabase `brand-assets` bucket (`bucket file_size_limit = 500 MB`). Uploads go **browser → Supabase** via a signed direct-to-storage URL, so they bypass the Netlify function body limit — but they are still capped by Supabase's **project-wide** upload limit, which defaults to **50 MB** and overrides the bucket.

To allow large files (e.g. 200 MB videos): **Supabase dashboard → Storage → Settings → "Upload file size limit" → set to 500 MB** (the org is on the Pro plan, which permits this). No redeploy needed.
