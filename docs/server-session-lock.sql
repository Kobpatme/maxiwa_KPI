alter table public.users
  add column if not exists active_session_id text,
  add column if not exists active_session_updated_at timestamptz,
  add column if not exists active_session_expires_at timestamptz;

create index if not exists users_active_session_id_idx
  on public.users (active_session_id);
