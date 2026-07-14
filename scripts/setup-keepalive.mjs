#!/usr/bin/env node
/**
 * Настройка keep-alive для Cloudflare Worker (Supabase + VPS ping).
 * Читает .env.local — не коммитится.
 *
 * Usage: node scripts/setup-keepalive.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCloudflareTokenFromEnvFile } from "./load-cloudflare-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadCloudflareTokenFromEnvFile(root);
const envPath = join(root, ".env.local");
const workerDir = join(root, "cloudflare-worker");
const wranglerBin = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");

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

if (!existsSync(envPath)) {
  console.error("Need .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const supaUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supaAnon = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
if (!supaUrl || !supaAnon) {
  console.error("Missing Supabase URL/anon key in .env.local");
  process.exit(1);
}

console.log("[keepalive] Setting Cloudflare Worker secrets...");
for (const [name, value] of [
  ["KEEPALIVE_SUPABASE_URL", supaUrl],
  ["KEEPALIVE_SUPABASE_ANON_KEY", supaAnon],
  ["KEEPALIVE_SUPABASE_FUNCTION_URL", `${supaUrl.replace(/\/$/, "")}/functions/v1/keepalive`],
]) {
  const r = spawnSync(process.execPath, [wranglerBin, "secret", "put", name], {
    cwd: workerDir,
    input: value,
    encoding: "utf8",
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status ?? 1);
  }
  console.log(`  ok ${name}`);
}

console.log("[keepalive] Deploying worker with cron...");
const dep = spawnSync(process.execPath, [wranglerBin, "deploy"], {
  cwd: workerDir,
  stdio: "inherit",
  env: process.env,
});
if (dep.status !== 0) process.exit(dep.status ?? 1);

console.log("\n[keepalive] Manual check:");
console.log("  curl https://starfall-assets-cdn.dima260208.workers.dev/keepalive");
console.log("\n[keepalive] Supabase hourly pulse:");
console.log("  npm run supabase:keepalive");
