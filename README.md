# MAXIWA KPI

MAXIWA KPI is the next-generation rebuild of the current SLA / KPI tracking system.

Core goals:
- Preserve all business-critical features from the existing system
- Connect to the current backend and current database directly without requiring backend or schema changes
- Redesign UX/UI to feel premium, modern, executive-ready, and easy to use
- Improve performance, clarity, and maintainability from the frontend and application architecture
- Keep all operations inside the system so no role needs direct database access

This folder contains the planning and deployment documentation:
- [`docs/legacy-system-audit.md`](docs/legacy-system-audit.md)
- [`docs/product-blueprint.md`](docs/product-blueprint.md)
- [`docs/ux-ui-direction.md`](docs/ux-ui-direction.md)
- [`docs/feature-parity-checklist.md`](docs/feature-parity-checklist.md)
- [`DEPLOY.md`](DEPLOY.md)

Deploy-ready project structure:
- [`public/maxiwa.html`](public/maxiwa.html)
- [`public/js/maxiwa.js`](public/js/maxiwa.js)
- [`public/js/api.js`](public/js/api.js)
- [`public/config.js`](public/config.js)
- [`wrangler.toml`](wrangler.toml)
- [`package.json`](package.json)

Non-negotiable release rule:
- Release 1 of MAXIWA KPI must work against the existing routes, existing tables, and existing business logic contracts.

Current delivery status:
1. Standalone frontend deploy structure for Cloudflare Pages is in place
2. Runtime API target is configurable via `MAXIWA_API_BASE` at build time
3. Task Center now includes richer filtering, duplicate signals, and edit-task workflow
4. Admin Studio now includes richer user permission editing and in-system operations
5. Job Tracker now uses deeper grouped timeline cards with audit detail
6. Remaining work is focused on final parity gaps and side-by-side UAT
