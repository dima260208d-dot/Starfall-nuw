/**
 * Supabase Edge Function — лёгкий keep-alive (cron в Dashboard).
 * Не меняет данные игры; только SELECT 1 для активности проекта.
 *
 * Deploy: supabase functions deploy keepalive
 * Cron (Dashboard): every 4 hours
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (_req) => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!url || !key) {
    return new Response(JSON.stringify({ ok: false, error: "missing env" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const supa = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await supa.from("player_profiles").select("player_id", { head: true, count: "exact" });

  return new Response(
    JSON.stringify({
      ok: !error,
      service: "starfall-supabase-keepalive",
      db: error ? { error: error.message } : { ok: true },
      ts: Date.now(),
    }),
    { headers: { "content-type": "application/json" } },
  );
});
