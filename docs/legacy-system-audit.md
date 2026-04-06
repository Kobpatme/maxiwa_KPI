# Legacy System Audit

## Current stack
- Frontend: static HTML + React-in-browser scripts + Tailwind CDN + custom JS files
- Backend: Cloudflare Workers + Hono
- Database: Supabase Postgres
- Realtime: Supabase realtime subscriptions on `tasks`

## Hard constraints for MAXIWA KPI
- The new frontend must connect to the current backend directly
- The new frontend must work with the current database structure directly
- Release 1 must not require schema migration
- Release 1 must not require route rewrites
- All operations must be completed through the application UI
- No role, including admin, should need direct database access for normal operations

## Current core domain model
- `users`
  - employee id, name, team, role, avatar (`pigurl`), permissions JSON
- `teams`
  - team catalog
- `kpis`
  - main KPI, sub KPI, team, SLA days, KPI weight
- `tasks`
  - job, assignee, team, KPI mapping, deadline, start date, completion date, status, note, weight, working days, extra JSON
- `audit_log`
  - task activity trail and admin operations
- `holidays`
  - holiday date, label, active flag

## Roles and permission model
- `Staff`
  - see own work
  - create new personal task
  - accept pending task
  - update own task status
  - append notes/logs
- `Lead`
  - see team members and team tasks
  - assign work to staff in team
  - update team task status with reason
  - access personal dashboard and personal tasks
  - optional `allowedStaff` permission narrows access
- `Manager`
  - see cross-team summary
  - see all staff or allowed teams only
  - assign and manage tasks
  - edit task details, update status, delete task
  - optional `allowedTeams` permission narrows access
- `Admin`
  - manage users
  - manage teams
  - manage KPI catalog
  - manage holidays
  - recalculate deadlines
  - view audit logs

## Main business logic

### 1. Authentication / identity
- User logs in with employee id
- Backend resolves employee id to a user profile
- Frontend behavior changes by `role`, `team`, and `permissions`

### 2. Task creation
- Staff can create one or many jobs in one save action
- Lead/Manager can assign a task to someone else
- Each task receives:
  - generated UUID
  - start date
  - KPI mapping from `team + subkpi`
  - deadline calculated from working days
  - task weight from main KPI

### 3. Deadline engine
- Deadline is based on:
  - KPI configured days
  - start date
  - weekends excluded
  - active holidays excluded
- If KPI or holidays change, open task deadlines can be recalculated

### 4. Task lifecycle
- `Pending`
  - assigned but not yet accepted
- `On Process`
  - actively being worked on
- `On Hold`
  - paused
- `Completed`
  - done and completion date set
- `Cancelled`
  - cancelled and removed from active flow

### 5. Notes and logging
- Staff append notes directly to task note text
- Lead/Manager status changes can also append reason into note text
- Audit log stores structured event records for status changes, edits, deletes, and admin actions

### 6. Reporting logic
- Summary is generated from tasks per person
- Metrics include:
  - total tasks
  - completed / on process / pending / hold / cancelled
  - on-time vs over-KPI
  - KPI distribution
  - weighted SLA score
  - weighted completion score

### 7. Job tracker behavior
- Tracker groups tasks by extracted job code
- A single job can legitimately contain many tasks
- Current UX can make multi-task jobs look like duplicates

## Existing functional modules
- Login / user bootstrap
- Staff dashboard
- Staff task list and updates
- Team dashboard
- Team member list
- Team task list
- Task assignment
- Manager summary dashboard
- Manager task board
- Job tracker
- Admin console
- Audit log viewer

## Pain points in the current system
- Large client-side scripts by role are hard to maintain
- Static-page architecture makes reuse and consistency difficult
- UI patterns differ across pages and roles
- Job tracker can be misunderstood as duplicate data
- Notes and audit data are split across free text and structured records
- Duplicate protection is only soft protection, not full uniqueness control
- Many screens show dense information without strong hierarchy
- Performance depends heavily on loading broad task sets
- Some admin workflows still assume technical understanding of the underlying data

## Feature parity requirements for MAXIWA KPI
- Keep all current roles and permission rules
- Keep KPI-based deadline engine
- Keep holiday-aware SLA calculation
- Keep weighted reporting logic
- Keep job tracker capability
- Keep admin management for users, teams, KPI, holidays, audit
- Keep realtime updates where useful
- Preserve `extra_data` extensibility on tasks
- Maintain direct compatibility with current routes and current database tables
- Ensure every operational and administrative action is available from inside the application
