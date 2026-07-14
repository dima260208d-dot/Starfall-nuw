-- Этап 2: облачный профиль игрока (прогресс между устройствами).
-- Supabase Dashboard → SQL Editor → Run

create table if not exists public.player_profiles (
  player_id text primary key,
  username text not null,
  profile_data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_player_profiles_username
  on public.player_profiles (username);

alter table public.player_profiles enable row level security;

create policy "profiles_select"
  on public.player_profiles for select
  using (true);

create policy "profiles_insert"
  on public.player_profiles for insert
  with check (true);

create policy "profiles_update"
  on public.player_profiles for update
  using (true);
