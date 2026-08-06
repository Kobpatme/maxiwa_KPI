-- Performance View query indexes
-- Safe to run more than once. Apply during a low-traffic window on a large table.

create index if not exists tasks_status_completiondate_idx
  on public.tasks (status, completiondate);

create index if not exists tasks_status_startdate_idx
  on public.tasks (status, startdate);

create index if not exists tasks_team_status_completiondate_idx
  on public.tasks (team, status, completiondate);

create index if not exists tasks_team_status_startdate_idx
  on public.tasks (team, status, startdate);

create index if not exists tasks_name_status_completiondate_idx
  on public.tasks (name, status, completiondate);

create index if not exists tasks_name_status_startdate_idx
  on public.tasks (name, status, startdate);

analyze public.tasks;
