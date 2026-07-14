#!/usr/bin/env node
/**
 * Записывает VITE_GAME_SERVER_URL в .env.local после деплоя на Render.
 * npm run party:apply -- https://starfall-party.onrender.com
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const urlFile = resolve(root, "server", ".party-url");

let httpUrl = process.argv[2]?.trim();
if (!httpUrl && existsSync(urlFile)) {
  httpUrl = readFileSync(urlFile, "utf8").trim();
}

if (!httpUrl?.startsWith("http")) {
  console.error("Укажите URL сервера команд:");
  console.error("  npm run party:apply -- https://starfall-party.onrender.com");
  process.exit(1);
}

httpUrl = httpUrl.replace(/\/$/, "");
const wsUrl = httpUrl.startsWith("https://")
  ? httpUrl.replace(/^https:/, "wss:") + "/ws"
  : httpUrl.replace(/^http:/, "ws:") + "/ws";

const lines = [
  { key: "VITE_GAME_SERVER_URL", val: httpUrl },
  { key: "VITE_GAME_SERVER_WS_URL", val: wsUrl },
];

let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

for (const { key, val } of lines) {
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${val}`;
  if (re.test(content)) {
    content = content.replace(re, line);
  } else {
    content = content.trimEnd() + (content ? "\n" : "") + `\n# Сервер команд (Render)\n${line}\n`;
  }
  console.info(`[party:apply] ${line}`);
}

writeFileSync(envPath, content.endsWith("\n") ? content : content + "\n", "utf8");
writeFileSync(urlFile, `${httpUrl}\n`, "utf8");

console.info("\n  Дальше: npm run sync:cloud && npm run dev  →  Ctrl+F5");
