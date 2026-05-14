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

create index if not exists app_system_settings_public_idx
  on public.app_system_settings (is_public)
  where is_public = true;

insert into public.app_system_settings (key, value, description, is_public)
values (
  'admin_announcement',
  '{"message":"","isActive":false,"updatedAt":"","updatedBy":""}'::jsonb,
  'Header announcement shown to all signed-in users',
  true
)
on conflict (key) do nothing;
