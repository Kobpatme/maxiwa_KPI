# Deploy MAXIWA KPI to Cloudflare

## What this project expects

- The frontend is deployed from this repository only.
- `MAXIWA KPI` talks to the existing backend directly through `window.API_BASE`.
- No database schema or backend route changes are required for the frontend release.

## Local build

```bash
npm install
npm run build
```

Optional API target override:

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

This deploys the generated `dist/` folder using the Cloudflare Pages project name `maxiwa-kpi`.

## Important runtime setting

The frontend expects the existing backend API to stay reachable at the URL configured in:

- `public/config.js` for source defaults
- `dist/config.js` after build output

If the backend URL changes, rebuild with `MAXIWA_API_BASE` set to the correct `/api` base.
