# Deploy MAXIWA KPI to Cloudflare

## What this project expects

- The frontend is deployed from this repository only.
- The default frontend API target is `/api`.
- `/api` is served by the Pages worker in `public/_worker.js`.
- The worker can run in one of two modes:
  - Supabase-backed app API using `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` or the `MAXIWA_` equivalents.
  - Legacy backend proxy using `MAXIWA_BACKEND_API_BASE`.

## Local build

```bash
npm install
npm run build
```

Optional frontend API target override:

```bash
MAXIWA_API_BASE=https://your-existing-backend.example.com/api npm run build
```

## Local preview

```bash
npm run dev
```

## Deploy to Cloudflare Pages

```bash
npm run deploy
```

This deploys the generated `dist/` folder using the Cloudflare Pages project name `metrixverity`.

## Required runtime secrets for Cloudflare Pages

Set one of these configurations in the Cloudflare Pages project before deploying:

### Option 1: Run the built-in Supabase API

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

The worker also accepts the same keys with a `MAXIWA_` prefix.

### Option 2: Proxy to the legacy backend

- `MAXIWA_BACKEND_API_BASE`

Use the full backend API base URL, for example `https://your-existing-backend.example.com/api`.

## Important runtime setting

`public/config.js` and `dist/config.js` control the browser-side API base. By default that is `/api`, so the deployed Pages project must also have one of the worker runtime configurations above.
