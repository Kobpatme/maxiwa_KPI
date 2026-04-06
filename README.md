# MAXIWA KPI

MAXIWA KPI is the next-generation rebuild of the current SLA / KPI tracking system.

Core goals:
- Preserve all business-critical features from the existing system
- Connect to the current backend and current database directly without requiring backend or schema changes
- Redesign UX/UI to feel premium, modern, executive-ready, and easy to use
- Improve performance, clarity, and maintainability from the frontend and application architecture
- Keep all operations inside the system so no role needs direct database access

This folder contains the planning artifacts for the rebuild:
- [`docs/legacy-system-audit.md`](/D:/WebApp/SLA_Preformance/spds-cloudflare/MAXIWA%20KPI/docs/legacy-system-audit.md)
- [`docs/product-blueprint.md`](/D:/WebApp/SLA_Preformance/spds-cloudflare/MAXIWA%20KPI/docs/product-blueprint.md)
- [`docs/ux-ui-direction.md`](/D:/WebApp/SLA_Preformance/spds-cloudflare/MAXIWA%20KPI/docs/ux-ui-direction.md)

Non-negotiable release rule:
- Release 1 of MAXIWA KPI must work against the existing routes, existing tables, and existing business logic contracts.

Recommended next build steps:
1. Freeze feature parity and compatibility scope from the audit
2. Produce a route-and-data compatibility map for the current APIs
3. Design the new information architecture and screen map
4. Scaffold the new app shell and design system
5. Rebuild modules in this order: auth, task engine, dashboards, team operations, admin
6. Run side-by-side validation against the current system before migration
