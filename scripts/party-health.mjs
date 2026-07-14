#!/usr/bin/env node
/**
 * Проверка сервера команд: GET /health
 * npm run party:health
 * npm run party:health -- https://starfall-party.onrender.com
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadUrl() {
  const arg = process.argv[2]?.trim();
  if (arg?.startsWith("http")) return arg.replace(/\/$/, "");

  const urlFile = resolve(root, "server", ".party-url");
  if (existsSync(urlFile)) return readFileSync(urlFile, "utf8").trim().replace(/\/$/, "");

  const envPath = resolve(root, ".env.local");
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/^VITE_GAME_SERVER_URL=(.+)$/m);
    if (m) return m[1].trim().replace(/\/$/, "");
  }
  return null;
}

const base = loadUrl();
if (!base) {
  console.error("[party:health] Нет URL. Укажите:");
  console.error("  npm run party:health -- https://starfall-party.onrender.com");
  process.exit(1);
}

console.info(`[party:health] ${base}/health ...`);

try {
  const res = await fetch(`${base}/health`, { cache: "no-store" });
  const text = await res.text();
  console.info(`  HTTP ${res.status}: ${text}`);
  if (res.ok) {
    console.info("[party:health] ✅ Сервер команд работает");
  } else {
    process.exit(1);
  }
} catch (e) {
  console.error(`[party:health] ❌ ${e instanceof Error ? e.message : e}`);
  console.error("  Render free tier засыпает — первый запрос может занять 30–60 сек, повторите.");
  process.exit(1);
}
