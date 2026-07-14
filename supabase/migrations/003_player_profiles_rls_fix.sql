-- Fix RLS for upsert (INSERT + UPDATE on conflict).
-- Supabase Dashboard → SQL Editor → Run

drop policy if exists "profiles_update" on public.player_profiles;

create policy "profiles_update"
  on public.player_profiles for update
  using (true)
  with check (true);
