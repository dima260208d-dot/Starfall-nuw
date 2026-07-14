#!/usr/bin/env node
/**
 * Проверка: залогинен ли wrangler или задан CLOUDFLARE_API_TOKEN
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCloudflareTokenFromEnvFile } from "./load-cloudflare-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadCloudflareTokenFromEnvFile(root);
const workerDir = resolve(root, "cloudflare-worker");
const wranglerBin = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");

const r = spawnSync(process.execPath, [wranglerBin, "whoami"], {
  cwd: workerDir,
  encoding: "utf8",
  env: process.env,
});

process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");

if (r.status === 0) {
  console.log("\n[cf:whoami] ✅ Cloudflare подключён. Можно: npm run cf:setup");
} else {
  console.log("\n[cf:whoami] ❌ Не подключён. Выполните: npm run cf:login:manual");
  process.exit(1);
}
