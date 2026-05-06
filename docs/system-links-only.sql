-- Minimal Systems registry setup for MAXIWA KPI.
-- Run this in Supabase SQL Editor if you only need the Systems sidebar feature.

begin;

create or replace function public.app_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.app_system_links (
  id text primary key,
  name text not null,
  description text,
  url text,
  icon text not null default 'fa-up-right-from-square',
  status text not null default 'Active',
  visible_to_all boolean not null default false,
  allowed_roles text[] not null default '{}'::text[],
  allowed_team_names text[] not null default '{}'::text[],
  allowed_emp_ids text[] not null default '{}'::text[],
  sort_order integer not null default 100,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_emp_id text,
  updated_by_emp_id text,
  constraint app_system_links_id_not_blank check (btrim(id) <> ''),
  constraint app_system_links_name_not_blank check (btrim(name) <> ''),
  constraint app_system_links_status_allowed check (status in ('Active', 'Maintenance', 'Coming Soon', 'Hidden'))
);

create index if not exists app_system_links_active_idx on public.app_system_links(is_active) where is_active = true;
create index if not exists app_system_links_status_idx on public.app_system_links(status);
create index if not exists app_system_links_roles_gin on public.app_system_links using gin(allowed_roles);
create index if not exists app_system_links_teams_gin on public.app_system_links using gin(allowed_team_names);
create index if not exists app_system_links_emp_ids_gin on public.app_system_links using gin(allowed_emp_ids);

drop trigger if exists app_system_links_set_updated_at on public.app_system_links;
create trigger app_system_links_set_updated_at
before update on public.app_system_links
for each row execute function public.app_set_updated_at();

insert into public.app_system_links (
  id,
  name,
  description,
  url,
  icon,
  status,
  visible_to_all,
  allowed_roles,
  sort_order,
  is_active
)
values
  ('maxiwa-kpi', 'METRIX Verity', 'KPI, SLA, task tracking, and executive performance dashboard', './maxiwa.html', 'fa-chart-line', 'Active', true, '{}'::text[], 10, true),
  ('executive-view', 'Executive Dashboard', 'Portfolio, risk, SLA, and weighted KPI view for management', './dashboard.html', 'fa-display', 'Active', false, array['Manager','SrManager','Director','Executive','Admin'], 20, true),
  ('pr-system', 'PR System', 'Create and track purchase request work outside MAXIWA', '', 'fa-file-invoice', 'Coming Soon', false, array['Staff','Lead','Manager','Admin'], 30, true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  url = excluded.url,
  icon = excluded.icon,
  status = excluded.status,
  visible_to_all = excluded.visible_to_all,
  allowed_roles = excluded.allowed_roles,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.app_system_links enable row level security;

drop policy if exists app_system_links_read_active on public.app_system_links;
create policy app_system_links_read_active
on public.app_system_links
for select
to anon, authenticated
using (is_active = true and status <> 'Hidden');

-- Direct browser writes require authenticated Supabase users.
-- Keep this disabled if you will save through a backend/Edge Function.
drop policy if exists app_system_links_browser_write on public.app_system_links;
create policy app_system_links_browser_write
on public.app_system_links
for all
to authenticated
using (true)
with check (true);

commit;
