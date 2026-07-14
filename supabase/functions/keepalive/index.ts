/**
 * Supabase Edge Function — hourly infra keep-alive.
 * Создаёт служебную запись в infra_keepalive_accounts и чистит старше 1 ч.
 * Не трогает player_accounts / player_profiles.
 *
 * Cron (Dashboard → Edge Functions → keepalive): 0 * * * *
 * Или: node scripts/supabase-deploy-keepalive.mjs
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (_req) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    return new Response(JSON.stringify({ ok: false, error: "missing service env" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const supa = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supa.rpc("infra_keepalive_tick");

  return new Response(
    JSON.stringify({
      ok: !error,
      service: "starfall-supabase-keepalive",
      result: error ? { error: error.message } : data,
      ts: Date.now(),
    }),
    { headers: { "content-type": "application/json" } },
  );
});
