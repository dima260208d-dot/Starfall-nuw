-- Этап 3: облачные аккаунты (логин, почта, пароль — привязка к player_id).
-- Supabase Dashboard → SQL Editor → Run

create table if not exists public.player_accounts (
  player_id text primary key,
  username text not null,
  email text,
  password_hash text not null,
  account_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_player_accounts_username_ci
  on public.player_accounts (lower(username));

create unique index if not exists idx_player_accounts_email_ci
  on public.player_accounts (lower(email))
  where email is not null and btrim(email) <> '';

create index if not exists idx_player_accounts_email_lookup
  on public.player_accounts (email);

alter table public.player_accounts enable row level security;

drop policy if exists "accounts_select" on public.player_accounts;
drop policy if exists "accounts_insert" on public.player_accounts;
drop policy if exists "accounts_update" on public.player_accounts;

create policy "accounts_select"
  on public.player_accounts for select
  using (true);

create policy "accounts_insert"
  on public.player_accounts for insert
  with check (true);

create policy "accounts_update"
  on public.player_accounts for update
  using (true)
  with check (true);
