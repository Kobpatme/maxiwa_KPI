-- Performance View query indexes
-- Safe to run more than once. Apply during a low-traffic window on a large table.

create index if not exists tasks_status_completiondate_idx
  on public.tasks (status, completiondate);

create index if not exists tasks_status_startdate_idx
  on public.tasks (status, startdate);

create index if not exists tasks_status_created_at_idx
  on public.tasks (status, created_at);

create index if not exists tasks_status_deadline_idx
  on public.tasks (status, deadline);

create index if not exists tasks_team_status_completiondate_idx
  on public.tasks (team, status, completiondate);

create index if not exists tasks_team_status_startdate_idx
  on public.tasks (team, status, startdate);

create index if not exists tasks_name_status_completiondate_idx
  on public.tasks (name, status, completiondate);

create index if not exists tasks_name_status_startdate_idx
  on public.tasks (name, status, startdate);

analyze public.tasks;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'audit_log'
      and column_name = 'created_at'
  ) then
    execute 'create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc)';
  end if;
end $$;

analyze public.audit_log;
