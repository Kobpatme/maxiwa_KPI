-- MAXIWA KPI future-ready Supabase schema
-- Purpose:
--   Add a compatibility-safe configuration layer for multi-department access,
--   executive visibility, system settings, and structured audit events.
--
-- Important:
--   This script does not alter legacy operational tables such as users, teams,
--   kpis, holidays, tasks, or audit_log. It can be applied after the current
--   system is already running, then wired into the app/backend gradually.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_access_scope') then
    create type public.app_access_scope as enum (
      'Self',
      'Team',
      'Department',
      'Division',
      'Organization',
      'System'
    );
  end if;
end $$;

create or replace function public.app_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.app_role_definitions (
  role text primary key,
  label text not null,
  default_scope public.app_access_scope not null,
  role_level integer not null check (role_level >= 0),
  can_admin boolean not null default false,
  can_executive_view boolean not null default false,
  can_manage_tasks boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists app_role_definitions_set_updated_at on public.app_role_definitions;
create trigger app_role_definitions_set_updated_at
before update on public.app_role_definitions
for each row execute function public.app_set_updated_at();

insert into public.app_role_definitions
  (role, label, default_scope, role_level, can_admin, can_executive_view, can_manage_tasks, description)
values
  ('Staff', 'Staff', 'Self', 10, false, false, false, 'Operational user who manages own work.'),
  ('Lead', 'Lead', 'Team', 20, false, false, true, 'Team lead who manages own work and team work.'),
  ('Manager', 'Manager', 'Department', 30, false, true, true, 'Department manager with executive dashboard access.'),
  ('SrManager', 'Sr. Manager', 'Division', 40, false, true, false, 'Senior manager with division-level visibility.'),
  ('Director', 'Director', 'Division', 50, false, true, false, 'Director with strategic division-level visibility.'),
  ('Executive', 'Executive', 'Organization', 60, false, true, false, 'Executive reader with organization-level visibility.'),
  ('Admin', 'System Admin', 'System', 90, true, true, true, 'Single system admin role for all setup and maintenance.')
on conflict (role) do update set
  label = excluded.label,
  default_scope = excluded.default_scope,
  role_level = excluded.role_level,
  can_admin = excluded.can_admin,
  can_executive_view = excluded.can_executive_view,
  can_manage_tasks = excluded.can_manage_tasks,
  description = excluded.description,
  updated_at = now();

create table if not exists public.app_departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  parent_department_id uuid references public.app_departments(id) on delete set null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_emp_id text,
  updated_by_emp_id text,
  constraint app_departments_code_not_blank check (btrim(code) <> ''),
  constraint app_departments_name_not_blank check (btrim(name) <> '')
);

create index if not exists app_departments_parent_idx on public.app_departments(parent_department_id);
create index if not exists app_departments_active_idx on public.app_departments(is_active) where is_active = true;

drop trigger if exists app_departments_set_updated_at on public.app_departments;
create trigger app_departments_set_updated_at
before update on public.app_departments
for each row execute function public.app_set_updated_at();

create table if not exists public.app_team_departments (
  id uuid primary key default gen_random_uuid(),
  team_name text not null unique,
  department_id uuid not null references public.app_departments(id) on delete restrict,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_emp_id text,
  updated_by_emp_id text,
  constraint app_team_departments_team_not_blank check (btrim(team_name) <> '')
);

create index if not exists app_team_departments_department_idx on public.app_team_departments(department_id);
create index if not exists app_team_departments_active_idx on public.app_team_departments(is_active) where is_active = true;

drop trigger if exists app_team_departments_set_updated_at on public.app_team_departments;
create trigger app_team_departments_set_updated_at
before update on public.app_team_departments
for each row execute function public.app_set_updated_at();

create table if not exists public.app_user_access (
  emp_id text primary key,
  role text not null references public.app_role_definitions(role) on update cascade,
  access_scope public.app_access_scope not null,
  primary_department_id uuid references public.app_departments(id) on delete set null,
  home_team_name text,
  allowed_department_ids uuid[] not null default '{}'::uuid[],
  allowed_team_names text[] not null default '{}'::text[],
  allowed_emp_ids text[] not null default '{}'::text[],
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_emp_id text,
  updated_by_emp_id text,
  constraint app_user_access_emp_not_blank check (btrim(emp_id) <> ''),
  constraint app_user_access_home_team_not_blank check (home_team_name is null or btrim(home_team_name) <> '')
);

create index if not exists app_user_access_role_idx on public.app_user_access(role);
create index if not exists app_user_access_scope_idx on public.app_user_access(access_scope);
create index if not exists app_user_access_department_idx on public.app_user_access(primary_department_id);
create index if not exists app_user_access_active_idx on public.app_user_access(is_active) where is_active = true;
create index if not exists app_user_access_allowed_departments_gin on public.app_user_access using gin(allowed_department_ids);
create index if not exists app_user_access_allowed_teams_gin on public.app_user_access using gin(allowed_team_names);
create index if not exists app_user_access_allowed_emp_ids_gin on public.app_user_access using gin(allowed_emp_ids);

drop trigger if exists app_user_access_set_updated_at on public.app_user_access;
create trigger app_user_access_set_updated_at
before update on public.app_user_access
for each row execute function public.app_set_updated_at();

create table if not exists public.app_executive_access (
  id uuid primary key default gen_random_uuid(),
  emp_id text not null,
  department_id uuid references public.app_departments(id) on delete cascade,
  team_name text,
  access_scope public.app_access_scope not null default 'Department',
  can_export boolean not null default true,
  can_view_people boolean not null default true,
  can_view_task_detail boolean not null default true,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_emp_id text,
  updated_by_emp_id text,
  constraint app_executive_access_emp_not_blank check (btrim(emp_id) <> ''),
  constraint app_executive_access_target_required check (department_id is not null or team_name is not null or access_scope in ('Organization', 'System'))
);

create unique index if not exists app_executive_access_unique_target
on public.app_executive_access (
  emp_id,
  coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(team_name, ''),
  access_scope
);

create index if not exists app_executive_access_emp_idx on public.app_executive_access(emp_id);
create index if not exists app_executive_access_department_idx on public.app_executive_access(department_id);
create index if not exists app_executive_access_team_idx on public.app_executive_access(team_name);
create index if not exists app_executive_access_active_idx on public.app_executive_access(is_active) where is_active = true;

drop trigger if exists app_executive_access_set_updated_at on public.app_executive_access;
create trigger app_executive_access_set_updated_at
before update on public.app_executive_access
for each row execute function public.app_set_updated_at();

create table if not exists public.app_system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_emp_id text,
  constraint app_system_settings_key_not_blank check (btrim(key) <> '')
);

create index if not exists app_system_settings_public_idx on public.app_system_settings(is_public) where is_public = true;

drop trigger if exists app_system_settings_set_updated_at on public.app_system_settings;
create trigger app_system_settings_set_updated_at
before update on public.app_system_settings
for each row execute function public.app_set_updated_at();

insert into public.app_system_settings (key, value, description, is_public)
values
  ('schema_mode', '{"mode":"compatibility-first","legacy_tables_readable":true}'::jsonb, 'How the new app should treat legacy data.', true),
  ('admin_model', '{"single_admin_role":true,"role":"Admin"}'::jsonb, 'Admin is a single system-wide role.', true),
  ('default_role_scopes', '{"Staff":"Self","Lead":"Team","Manager":"Department","SrManager":"Division","Director":"Division","Executive":"Organization","Admin":"System"}'::jsonb, 'Fallback access scopes when user access metadata is missing.', true)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  is_public = excluded.is_public,
  updated_at = now();

create table if not exists public.app_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_time timestamptz not null default now(),
  actor_emp_id text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  department_id uuid references public.app_departments(id) on delete set null,
  team_name text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  source text not null default 'app',
  constraint app_audit_events_action_not_blank check (btrim(action) <> ''),
  constraint app_audit_events_entity_type_not_blank check (btrim(entity_type) <> '')
);

create index if not exists app_audit_events_time_idx on public.app_audit_events(event_time desc);
create index if not exists app_audit_events_actor_idx on public.app_audit_events(actor_emp_id, event_time desc);
create index if not exists app_audit_events_entity_idx on public.app_audit_events(entity_type, entity_id, event_time desc);
create index if not exists app_audit_events_department_idx on public.app_audit_events(department_id, event_time desc);
create index if not exists app_audit_events_team_idx on public.app_audit_events(team_name, event_time desc);
create index if not exists app_audit_events_metadata_gin on public.app_audit_events using gin(metadata);

create or replace function public.app_log_audit_event(
  p_actor_emp_id text,
  p_actor_role text,
  p_action text,
  p_entity_type text,
  p_entity_id text default null,
  p_department_id uuid default null,
  p_team_name text default null,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_metadata jsonb default '{}'::jsonb,
  p_request_id text default null,
  p_source text default 'app'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.app_audit_events (
    actor_emp_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    department_id,
    team_name,
    before_data,
    after_data,
    metadata,
    request_id,
    source
  )
  values (
    p_actor_emp_id,
    p_actor_role,
    p_action,
    p_entity_type,
    p_entity_id,
    p_department_id,
    p_team_name,
    p_before_data,
    p_after_data,
    coalesce(p_metadata, '{}'::jsonb),
    p_request_id,
    coalesce(p_source, 'app')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace view public.app_effective_user_access as
select
  ua.emp_id,
  ua.role,
  rd.label as role_label,
  ua.access_scope,
  rd.default_scope,
  rd.role_level,
  rd.can_admin,
  rd.can_executive_view,
  rd.can_manage_tasks,
  ua.primary_department_id,
  d.code as department_code,
  d.name as department_name,
  ua.home_team_name,
  ua.allowed_department_ids,
  ua.allowed_team_names,
  ua.allowed_emp_ids,
  ua.is_active,
  ua.metadata,
  ua.updated_at
from public.app_user_access ua
join public.app_role_definitions rd on rd.role = ua.role
left join public.app_departments d on d.id = ua.primary_department_id;

alter table public.app_role_definitions enable row level security;
alter table public.app_departments enable row level security;
alter table public.app_team_departments enable row level security;
alter table public.app_user_access enable row level security;
alter table public.app_executive_access enable row level security;
alter table public.app_system_settings enable row level security;
alter table public.app_audit_events enable row level security;

-- RLS note:
-- The current Cloudflare Worker can use Supabase service-role credentials and
-- bypass RLS for controlled server-side operations. If you later move direct
-- authenticated browser access to Supabase Auth, add JWT-aware policies here.
--
-- Public settings and role definitions are safe to read.

drop policy if exists app_role_definitions_read_all on public.app_role_definitions;
create policy app_role_definitions_read_all
on public.app_role_definitions
for select
to anon, authenticated
using (true);

drop policy if exists app_system_settings_read_public on public.app_system_settings;
create policy app_system_settings_read_public
on public.app_system_settings
for select
to anon, authenticated
using (is_public = true);

-- Helper comments for backend integration:
--
-- 1. Keep legacy tasks/users/kpis/teams unchanged for compatibility.
-- 2. On login, resolve legacy users first, then overlay app_user_access by emp_id.
-- 3. If app_user_access is missing, use role default from app_role_definitions.
-- 4. Admin screens should write app_departments, app_team_departments,
--    app_user_access, app_executive_access, and app_system_settings only
--    through backend routes.
-- 5. Every write route should call app_log_audit_event(...).

commit;
