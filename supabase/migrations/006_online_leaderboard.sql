-- Этап: серверный (анти-чит) лидерборд. Источник истины — ledger матчмейкера.
-- Пишет ТОЛЬКО service_role (с сервера). Клиенты (anon) могут лишь читать —
-- никаких insert/update политик для anon нет, поэтому подделать рекорды нельзя.
-- Supabase Dashboard → SQL Editor → Run

create table if not exists public.online_leaderboard (
  player_id text primary key,
  name text not null default '',
  trophies integer not null default 0,
  coins bigint not null default 0,
  xp bigint not null default 0,
  wins integer not null default 0,
  battles integer not null default 0,
  brawlers jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Per-brawler trophies (server-authoritative) so the brawler records tab is
-- also built purely from server data. Idempotent for already-created tables.
alter table public.online_leaderboard
  add column if not exists brawlers jsonb not null default '{}'::jsonb;

create index if not exists idx_online_leaderboard_trophies
  on public.online_leaderboard (trophies desc);

alter table public.online_leaderboard enable row level security;

-- Публичное чтение лидерборда.
drop policy if exists "online_leaderboard_select" on public.online_leaderboard;
create policy "online_leaderboard_select"
  on public.online_leaderboard for select
  using (true);

-- Запись намеренно НЕ разрешена для anon — только service_role (сервер) пишет,
-- обходя RLS. Это и есть анти-чит: рекорды строятся из серверного ledger.
