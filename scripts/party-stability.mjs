#!/usr/bin/env node
/** Проверка стабильности Render party server. npm run party:stability */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

function baseUrl() {
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/^VITE_GAME_SERVER_URL=(.+)$/m);
    if (m) return m[1].trim().replace(/\/$/, "");
  }
  return "https://starfall-party.onrender.com";
}

const url = baseUrl();
console.info(`[party:stability] ${url}\n`);

async function ping(label) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${url}/health`, { cache: "no-store" });
    const ms = Date.now() - t0;
    const body = await res.text();
    console.log(`${label}: ${res.status} ${ms}ms ${body.slice(0, 50)}`);
    return res.ok;
  } catch (e) {
    console.log(`${label}: FAIL ${Date.now() - t0}ms ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

async function partyFlow() {
  const code = "STAB" + Math.floor(Math.random() * 90 + 10);
  const room = { code, leaderPlayerId: "TEST", members: [], createdAt: Date.now() };
  const t0 = Date.now();
  const put = await fetch(`${url}/api/party/${code}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room }),
  });
  console.log(`PUT ${code}: ${put.status} ${Date.now() - t0}ms`);
  const get = await fetch(`${url}/api/party/${code}`);
  console.log(`GET ${code}: ${get.status} ${await get.text()}`);
  await fetch(`${url}/api/party/${code}`, { method: "DELETE" });
}

for (let i = 1; i <= 3; i++) await ping(`ping ${i}`);
await partyFlow();
console.info("\nЕсли первый ping >30s — Render был asleep. На телефоне нужно подождать.");
