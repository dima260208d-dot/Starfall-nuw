#!/usr/bin/env node
/**
 * Записывает VITE_ASSET_CDN_URL в .env.local после деплоя Worker.
 * npm run cf:apply -- https://starfall-assets-cdn.xxx.workers.dev
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

let workerUrl = process.argv[2]?.trim();
if (!workerUrl) {
  const hint = resolve(root, "cloudflare-worker", ".worker-url");
  if (existsSync(hint)) {
    workerUrl = readFileSync(hint, "utf8").trim();
  }
}

if (!workerUrl?.startsWith("http")) {
  console.error("Укажите URL Worker:");
  console.error("  npm run cf:apply -- https://starfall-assets-cdn.ВАШ.workers.dev");
  process.exit(1);
}

const cdnBase = `${workerUrl.replace(/\/$/, "")}/cdn/`;
const key = "VITE_ASSET_CDN_URL";
const line = `${key}=${cdnBase}`;

let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const re = new RegExp(`^${key}=.*$`, "m");

if (re.test(content)) {
  content = content.replace(re, line);
} else {
  content = content.trimEnd() + (content.endsWith("\n") || !content ? "" : "\n") + `\n# Cloudflare Worker + R2 CDN\n${line}\n`;
}

writeFileSync(envPath, content, "utf8");
console.info(`[cf:apply] записано в .env.local:\n  ${line}`);
console.info("  Запустите: npm run dev  и Ctrl+F5 в браузере");
