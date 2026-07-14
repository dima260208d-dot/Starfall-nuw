-- Анти-чит: запретить клиентам (anon) писать в player_profiles напрямую.
-- Запись теперь только через серверный шлюз матчмейкера (service_role обходит RLS),
-- который проверяет владельца аккаунта и делает трофеи авторитетными.
-- Чтение остаётся публичным (нужно для профилей/поиска). Supabase SQL Editor → Run.

-- Убираем разрешения на запись для anon/authenticated.
drop policy if exists "profiles_insert" on public.player_profiles;
drop policy if exists "profiles_update" on public.player_profiles;

-- Чтение оставляем открытым (пересоздаём идемпотентно).
drop policy if exists "profiles_select" on public.player_profiles;
create policy "profiles_select"
  on public.player_profiles for select
  using (true);

-- Никаких insert/update политик для anon → прямая запись с клиентским ключом
-- невозможна. Пишет только сервер service_role'ом через /mm/profile/push.
