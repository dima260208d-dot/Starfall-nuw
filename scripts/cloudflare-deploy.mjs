#!/usr/bin/env node
/**
 * Деплой Worker и сохранение URL для cf:apply
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCloudflareTokenFromEnvFile } from "./load-cloudflare-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadCloudflareTokenFromEnvFile(root);
const workerDir = resolve(root, "cloudflare-worker");
const urlFile = resolve(workerDir, ".worker-url");
const wranglerBin = join(workerDir, "node_modules", "wrangler", "bin", "wrangler.js");

console.info("[cf:deploy] wrangler deploy ...");

const r = spawnSync(process.execPath, [wranglerBin, "deploy"], {
  cwd: workerDir,
  encoding: "utf8",
  env: process.env,
});

const out = `${r.stdout || ""}\n${r.stderr || ""}`;
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");

if (r.status !== 0) {
  if (out.includes("Not logged in") || out.includes("authentication")) {
    console.error("\n[cf:deploy] Сначала: npm run cf:login:manual  или токен в .env.local");
  }
  process.exit(r.status ?? 1);
}

// wrangler 4: "Published starfall-assets-cdn (X sec)\n  https://....workers.dev"
const m = out.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i);
if (m) {
  writeFileSync(urlFile, `${m[0]}\n`, "utf8");
  console.info(`\n[cf:deploy] URL сохранён: ${m[0]}`);
  console.info("  Дальше: npm run cf:apply");
} else {
  console.info("\n[cf:deploy] Скопируйте URL Worker и выполните:");
  console.info("  npm run cf:apply -- https://ваш-worker.workers.dev");
}
