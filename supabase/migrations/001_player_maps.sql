-- Запустите один раз: Supabase Dashboard → SQL Editor → New query → вставьте весь файл → Run

create table if not exists public.published_player_maps (
  publish_id text primary key,
  map_id text not null,
  name text not null,
  mode text not null,
  cells jsonb not null,
  overlays jsonb not null,
  rotations jsonb,
  author_id text not null,
  author_name text not null,
  published_at timestamptz not null default now(),
  expires_at timestamptz not null,
  likes int not null default 0,
  dislikes int not null default 0
);

create index if not exists idx_ppm_mode_expires
  on public.published_player_maps (mode, expires_at);

create table if not exists public.player_map_author_stats (
  player_id text primary key,
  total_dislikes int not null default 0,
  publish_banned_until timestamptz,
  last_publish_by_map_id jsonb not null default '{}'::jsonb,
  expired_notified_ids jsonb not null default '[]'::jsonb
);

alter table public.published_player_maps enable row level security;
alter table public.player_map_author_stats enable row level security;

-- Все видят живые карты
create policy "ppm_select_live"
  on public.published_player_maps for select
  using (expires_at > now());

-- Публикация и голоса (бета; позже привяжем к Supabase Auth)
create policy "ppm_insert"
  on public.published_player_maps for insert
  with check (true);

create policy "ppm_update"
  on public.published_player_maps for update
  using (true);

create policy "ppm_delete"
  on public.published_player_maps for delete
  using (true);

create policy "stats_select"
  on public.player_map_author_stats for select
  using (true);

create policy "stats_upsert"
  on public.player_map_author_stats for all
  using (true)
  with check (true);
