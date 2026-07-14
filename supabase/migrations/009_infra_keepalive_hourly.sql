-- Hourly infra keep-alive: создаёт служебный «аккаунт» и удаляет записи старше 1 ч.
-- НЕ player_accounts — на игру и логин не влияет.

create table if not exists public.infra_keepalive_accounts (
  account_id text primary key,
  created_at timestamptz not null default now()
);

comment on table public.infra_keepalive_accounts is
  'Dummy accounts for Supabase project activity only. Auto-pruned after 1 hour.';

alter table public.infra_keepalive_accounts enable row level security;
-- Без политик: только postgres / service_role (игровой anon не видит).

create or replace function public.infra_keepalive_tick()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id text;
  deleted_count int;
begin
  new_id := 'keepalive-' || replace(gen_random_uuid()::text, '-', '');
  insert into public.infra_keepalive_accounts (account_id) values (new_id);

  delete from public.infra_keepalive_accounts
  where created_at < now() - interval '1 hour';
  get diagnostics deleted_count = row_count;

  return jsonb_build_object(
    'ok', true,
    'created', new_id,
    'deletedOlderThan1h', deleted_count,
    'remaining', (select count(*)::int from public.infra_keepalive_accounts)
  );
end;
$$;

revoke all on function public.infra_keepalive_tick() from public;
grant execute on function public.infra_keepalive_tick() to service_role;

-- pg_cron: Dashboard → Database → Extensions → включить pg_cron, затем применить миграцию.
create extension if not exists pg_cron with schema extensions;

do $cron$
declare
  jid bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    for jid in select jobid from cron.job where jobname = 'starfall-infra-keepalive-hourly'
    loop
      perform cron.unschedule(jid);
    end loop;

    perform cron.schedule(
      'starfall-infra-keepalive-hourly',
      '0 * * * *',
      $$select public.infra_keepalive_tick();$$
    );
  end if;
end;
$cron$;
