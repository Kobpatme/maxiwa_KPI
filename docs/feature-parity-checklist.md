# MAXIWA KPI Feature Parity Checklist

## Foundation
- [x] Login with existing employee id
- [x] Connect to existing API routes
- [x] Use existing database contracts without schema changes
- [x] Role-aware navigation

## Staff
- [x] Personal dashboard
- [x] Personal task list
- [x] Accept pending task
- [x] Update task status
- [x] Create personal task
- [ ] Full parity for all legacy note/log edge cases

## Lead
- [x] Team dashboard summary
- [x] Team task center
- [x] Team people view
- [x] Assign task
- [x] Update status with manager-style log flow
- [ ] Deeper team member drilldowns

## Manager
- [x] Executive dashboard shell
- [x] Cross-team task center
- [x] Assign task
- [x] People view
- [x] Delete task
- [x] Job tracker entry
- [ ] Full reporting parity by every old filter combination

## Admin
- [x] Admin dashboard shell
- [x] Save user
- [x] Save team
- [x] Save KPI
- [x] Save holiday
- [x] Recalculate deadlines
- [x] View audit logs
- [x] Delete user
- [x] Delete team
- [x] Delete KPI
- [x] Delete holiday
- [x] Rich permission editor parity

## Job Tracker
- [x] Search by job
- [x] Group by job code
- [x] Show grouped tasks
- [x] Expand task details
- [x] Show note content
- [x] Show audit timeline
- [x] Rich visual timeline and duplicate heuristics refinement

## Remaining production tasks
- [ ] Promote MAXIWA KPI to public entry point
- [x] Add realtime refresh behavior
- [ ] Polish validation and error states
- [x] Add deeper edit-task-details workflow
- [x] Add Cloudflare build/deploy structure
- [ ] Side-by-side UAT against legacy pages
