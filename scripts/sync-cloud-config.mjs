#!/usr/bin/env node
/**
 * Автоматически создаёт public/cloud-config.json из .env.local
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
const outPath = resolve(root, "public", "cloud-config.json");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const env = loadEnvFile(envPath);
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const gameServerUrl = env.VITE_GAME_SERVER_URL?.replace(/\/$/, "");
const gameServerWsUrl = env.VITE_GAME_SERVER_WS_URL;
const edgeServerUrl = env.VITE_EDGE_SERVER_URL?.replace(/\/$/, "");
const assetCdnUrl = env.VITE_ASSET_CDN_URL;
const battleMatchmakerUrl = env.VITE_BATTLE_MM_URL?.replace(/\/$/, "");
const battleWsBase = env.VITE_BATTLE_WS_BASE?.replace(/\/$/, "");
const configServerUrl = env.VITE_CONFIG_SERVER_URL?.replace(/\/$/, "");
const configServerWsUrl = env.VITE_CONFIG_SERVER_WS_URL;
const configPublicKey = env.VITE_CONFIG_PUBLIC_KEY;
const clubsUrl = env.VITE_CLUBS_URL?.replace(/\/$/, "");

if (!url?.includes("supabase.co") || !anonKey) {
  console.warn("[sync-cloud-config] skip — нет VITE_SUPABASE_* в .env.local");
  process.exit(0);
}

/** @type {Record<string, string>} */
const payload = {
  url,
  anonKey,
  updatedAt: new Date().toISOString(),
};

if (gameServerUrl) payload.gameServerUrl = gameServerUrl;
if (gameServerWsUrl) payload.gameServerWsUrl = gameServerWsUrl;
if (edgeServerUrl) payload.edgeServerUrl = edgeServerUrl;
if (assetCdnUrl) payload.assetCdnUrl = assetCdnUrl.replace(/\/?$/, "/");
if (battleMatchmakerUrl) payload.battleMatchmakerUrl = battleMatchmakerUrl;
if (battleWsBase) payload.battleWsBase = battleWsBase;
if (configServerUrl) payload.configServerUrl = configServerUrl;
if (configServerWsUrl) payload.configServerWsUrl = configServerWsUrl;
if (configPublicKey) payload.configPublicKey = configPublicKey;
if (clubsUrl) payload.clubsUrl = clubsUrl;

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.info("[sync-cloud-config] wrote public/cloud-config.json");
