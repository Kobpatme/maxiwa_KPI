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

## Verify a Git-connected production build

Cloudflare Pages builds `main` using `npm run build` and serves `dist/`.
Each build writes `/version.json` and `window.MAXIWA_BUILD_VERSION`, using
`CF_PAGES_COMMIT_SHA` and `CF_PAGES_BRANCH` with local Git fallbacks. Local JS/CSS
references include the short commit as a query parameter. Check the public
version against `git rev-parse HEAD` after every push; checked-in `dist` is a
local snapshot and Cloudflare must rebuild it to identify the deployed commit.

Run `npm ci`, `npm test`, `npm run test:build`, then `npm run build` before push.
The build test writes a test-version build, so the final ordinary build is required.
Optional browser checks use Playwright installed in the environment:
`node scripts/browser-smoke.mjs` tests local login and multi-line creation with
all API requests intercepted using synthetic data. Start the local server first.
`node scripts/browser-smoke.mjs --production` only checks public pages and the
Realtime transport; it does not log in or create production records.
For release verification, pass `--expect-commit=<full pushed SHA>` with
`--production`. The smoke check requires `/version.json`, the browser build
identifier and local asset query versions to agree; it also checks public config
for a publishable/anon key and fails on application asset HTTP errors, API 5xx
responses or JavaScript exceptions. A successful Realtime transport check does
not prove task-event delivery without the publication prerequisite below.
The local synthetic smoke check additionally completes a newly created task
through the UI and verifies one task PATCH, one additional audit insert and no
additional session activity write.
Set `MAXIWA_PLAYWRIGHT_MODULE` to an absolute Playwright `index.mjs` if it is not
available as a project dependency.

## Session, cache and audit behavior

Worker session validation deduplicates concurrent requests and caches successful
validation for at most 30 seconds in a bounded 500-entry cache. Cached results
never outlive the authoritative expiry. Session touches occur after five minutes
and PATCH only the matching session ID. Login and user mutations invalidate local
session caches; other isolates detect takeover at their next authoritative read.
Protected APIs require both session headers. Session persistence failure prevents
login from silently falling back to an unenforced session.

Healthy Realtime reconciles every 60 seconds; fallback reconciles every 30 seconds.
Hidden tabs skip reconciliation and refresh once when visible, without overlapping
polls. Every Realtime row event is delivered and stale subscriptions are cancelled.
Holidays cache for 15 minutes; KPI definitions, announcements and system links cache
for five minutes. Successful writes invalidate the corresponding Worker cache.
Other isolates expire their static caches naturally, so Admin changes can take up
to the corresponding TTL to reach them.

Production `audit_log` columns were verified through `information_schema.columns`:
`id uuid DEFAULT gen_random_uuid() NOT NULL`, nullable `taskid text`, `rowid text`,
`action text`, `details text`, `by_user text`, `timestamp timestamptz DEFAULT now()`.
The Worker inserts one payload containing `taskid/action/details/by_user/timestamp`;
details are JSON-encoded text. Failures log safe HTTP status/code and a correlation
ID once and do not retry or fail an otherwise successful task mutation.

## Production Realtime prerequisite

The inspection on 2026-10-08 found `public.tasks` absent from `supabase_realtime`,
with RLS disabled and no policies. A WebSocket connection alone does not prove
task-event delivery. This fix preserves the frontend subscription and fallback,
and does not change production publication, RLS, grants or credentials. Enabling
task-event delivery requires a separately reviewed access policy compatible with
the existing employee-ID session flow before adding tasks to the publication.
