# MAXIWA KPI Product Blueprint

## Product vision
MAXIWA KPI should feel like an executive operations platform, not a spreadsheet wrapper.

It must help leadership answer three questions immediately:
- What is the current operational health?
- Which teams or people need attention?
- Which jobs are at risk before SLA is missed?

## Non-negotiable constraints
- MAXIWA KPI must work with the current backend and current database immediately
- Release 1 must not require schema edits, SQL migrations, or route rewrites
- Admin capability must exist entirely inside the app experience
- No role, including admin, should need direct database access for normal operations

## Product principles
- Fast first: critical pages must open quickly and summarize before drilling down
- Clarity over density: every screen should separate summary, action, and detail
- Role-first navigation: users see only what matters to their role
- Operational confidence: deadlines, status, ownership, and KPI impact must be obvious
- Executive-grade presentation: modern, premium, and trustworthy visual language
- Compatibility first: improve the product without breaking the current data foundation

## Recommended new architecture
- Frontend
  - React app with routed layouts and shared design system
  - componentized pages instead of one large file per role
  - server-state caching for task/report queries
  - compatibility adapter layer for current API payloads and field names
- Backend
  - existing backend remains the system of record for release 1
  - new frontend consumes current routes directly
- Data layer
  - frontend-side typed service layer mapped to current API contracts
  - strong validation around task input and status transitions without changing current storage contracts
- Performance strategy
  - shape view models in the frontend service layer
  - avoid loading all tasks for every screen when not necessary
  - lazy-load deep detail views
  - use existing indexed filters for team, assignee, date, and status

## Compatibility-first implementation strategy
- Treat the current backend and current database as fixed integration contracts for release 1
- Build a new frontend experience over the existing operational model
- Normalize legacy field names and payload quirks inside the app service layer
- Move performance gains into:
  - better screen architecture
  - lighter initial payload use
  - smarter caching
  - cleaner rendering patterns
- Any future backend or schema evolution is optional phase-two work only

## Proposed app structure
- Executive Dashboard
- My Work
- Team Command
- Task Center
- Job Tracker
- Reports
- Admin Studio

## Role-based product mapping

### Staff
- My dashboard
- My active tasks
- Pending tasks requiring acceptance
- Quick update panel
- Create personal work item

### Lead
- Team health dashboard
- Team members performance view
- Team task queue
- Assignment center
- My own work

### Manager
- Executive summary dashboard
- Cross-team scorecards
- Workload and risk board
- Task operations center
- Job tracker
- Reports and export

### Admin
- Organization setup
- People and permissions
- KPI model management
- Holiday calendar and SLA recalc
- Audit and system activity

## Proposed domain modules

### 1. Identity and access
- employee lookup
- role-based access
- scoped team/staff permissions

### 2. Task engine
- create task
- assign task
- accept task
- update status
- edit details
- delete task
- append operational notes

### 3. SLA engine
- KPI-driven working day calculation
- holiday exclusion
- batch recalculation
- risk states:
  - healthy
  - approaching SLA
  - overdue

### 4. Reporting engine
- individual performance
- team performance
- weighted SLA and completion metrics
- trend analytics by period

### 5. Job intelligence
- group by job code
- timeline of related tasks
- ownership history
- lookalike duplicate detection and warnings

### 6. Administration
- users
- teams
- KPI definitions
- holidays
- audit log

## Admin operating model
- Admin is a business operator inside the application, not a database operator
- Every setup action must have a guided screen:
  - create or edit user
  - assign permissions
  - manage teams
  - manage KPI definitions
  - manage holidays
  - trigger deadline recalculation
  - inspect audit history
- The system must be self-sufficient for day-to-day operation
- UI and workflow language must avoid implying that someone should fix issues manually in the database

## Data model strategy
- Release 1 must use the current tables exactly as they exist today:
  - `users`
  - `teams`
  - `kpis`
  - `holidays`
  - `tasks`
  - `audit_log`
- Release 1 must use current route behavior and current field naming
- Future schema evolution is optional and must never block the new UI launch
- Duplicate prevention and cleaner event visualization should be improved first through compatibility-safe application logic

## Performance goals
- Dashboard first render under 2 seconds on normal office internet
- Task list filter response under 300 ms for common filters
- Job tracker search should not load unrelated records
- Summary endpoints should avoid unnecessary client-side heavy aggregation on first paint
- Performance optimization must come from better frontend architecture and smarter data use, not required database redesign

## Delivery phases

### Phase 1
- product spec
- route compatibility map
- database compatibility map
- UI concept direction

### Phase 2
- app shell
- authentication
- shared layout
- design system

### Phase 3
- task engine
- staff experience
- lead experience

### Phase 4
- manager dashboards
- reports
- job tracker

### Phase 5
- admin studio
- side-by-side validation
- rollout plan

## What this means in practice
- We are rebuilding the product experience, not replacing the data foundation on day one
- MAXIWA KPI should be deployable with minimal operational risk
- Users should feel the system is more powerful and more premium, while all operational control stays fully inside the application
