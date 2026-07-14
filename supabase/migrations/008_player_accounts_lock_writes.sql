-- Lock player_accounts to the server gateway only.
-- All account reads/writes (login, register, uniqueness, sync, password change)
-- now go through the matchmaker auth gateway, which uses the Supabase service
-- role (bypasses RLS). The anon key must NOT be able to read password hashes or
-- forge/overwrite accounts. Dropping every anon policy makes the table
-- service-role-only while RLS stays enabled.

alter table public.player_accounts enable row level security;

drop policy if exists "accounts_select" on public.player_accounts;
drop policy if exists "accounts_insert" on public.player_accounts;
drop policy if exists "accounts_update" on public.player_accounts;

-- No policies for anon/authenticated => only the service role can touch this table.
