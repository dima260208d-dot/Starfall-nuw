#!/usr/bin/env node
/**
 * Применяет SQL keep-alive + деплоит Edge Function keepalive.
 * Usage: node scripts/supabase-deploy-keepalive.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return out;
}

async function runSql(accessToken, projectRef, sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`SQL API ${r.status}: ${text.slice(0, 600)}`);
  return text;
}

const envPath = join(root, ".env.local");
if (!existsSync(envPath)) {
  console.error("Need .env.local");
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const accessToken = env.SUPABASE_ACCESS_TOKEN;
const projectRef = env.SUPABASE_PROJECT_REF;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supaUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");

if (!accessToken || !projectRef) {
  console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF in .env.local");
  process.exit(1);
}

const migrationPath = join(root, "supabase/migrations/009_infra_keepalive_hourly.sql");
const migrationSql = readFileSync(migrationPath, "utf8");

console.log("[supabase-keepalive] Enable pg_cron...");
try {
  await runSql(accessToken, projectRef, "create extension if not exists pg_cron with schema extensions;");
  console.log("  ok");
} catch (err) {
  console.warn("  warn:", err.message);
}

console.log("[supabase-keepalive] Apply migration...");
try {
  await runSql(accessToken, projectRef, migrationSql);
  console.log("  ok migration");
} catch (err) {
  console.error("  migration failed:", err.message);
  process.exit(1);
}

console.log("[supabase-keepalive] Deploy Edge Function...");
const dep = spawnSync(
  "npx",
  ["--yes", "supabase@2", "functions", "deploy", "keepalive", "--project-ref", projectRef],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
  },
);
if (dep.status !== 0) {
  console.warn("[supabase-keepalive] CLI deploy failed — upload function in Dashboard");
}

if (supaUrl && serviceKey) {
  console.log("[supabase-keepalive] Test tick...");
  const test = await fetch(`${supaUrl}/functions/v1/keepalive`, {
    headers: { authorization: `Bearer ${serviceKey}` },
  });
  console.log(`  HTTP ${test.status}: ${(await test.text()).slice(0, 500)}`);
}

console.log("\nDone. Hourly triggers:");
console.log("  1) pg_cron job starfall-infra-keepalive-hourly (DB)");
console.log("  2) Dashboard → Edge Functions → keepalive → Schedule: 0 * * * *");
