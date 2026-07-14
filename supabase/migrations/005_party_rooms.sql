-- Этап 5: облачные команды (пати) — бесплатно через Supabase, без Fly.io.
-- Supabase Dashboard → SQL Editor → Run

create table if not exists public.party_rooms (
  code text primary key,
  room_data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_party_rooms_updated
  on public.party_rooms (updated_at desc);

alter table public.party_rooms enable row level security;

create policy "party_rooms_select"
  on public.party_rooms for select
  using (true);

create policy "party_rooms_insert"
  on public.party_rooms for insert
  with check (true);

create policy "party_rooms_update"
  on public.party_rooms for update
  using (true);

create policy "party_rooms_delete"
  on public.party_rooms for delete
  using (true);

-- Realtime: обновления команды между устройствами
alter table public.party_rooms replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.party_rooms;
exception
  when duplicate_object then null;
end $$;
