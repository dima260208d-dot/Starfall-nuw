#!/usr/bin/env node
/**
 * Принудительная выгрузка профиля в Supabase (обход браузера).
 *
 * Использование:
 *   node scripts/push-profile-cloud.mjs --file starfall-profile-backup.json --username "РАЗРАБОТЧИК 1.0"
 *   node scripts/push-profile-cloud.mjs --file backup.json --player-id 7JTQJGBRYQD9
 *
 * Нужны в .env.local:
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") out.file = argv[++i];
    else if (a === "--username") out.username = argv[++i];
    else if (a === "--player-id") out.playerId = argv[++i];
  }
  return out;
}

const OMIT = new Set(["passwordHash", "socialPresence"]);

function packProfile(profile) {
  const out = { cloudSchema: 2 };
  for (const [k, v] of Object.entries(profile)) {
    if (OMIT.has(k) || v === undefined) continue;
    try {
      out[k] = JSON.parse(JSON.stringify(v));
    } catch {
      /* skip */
    }
  }
  out.cloudSyncedAt = Date.now();
  return out;
}

function normalizePlayerId(id) {
  return String(id || "").replace(/#/g, "").trim().toUpperCase();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error("Укажите --file путь к JSON (экспорт clashArena_profiles или backup)");
    process.exit(1);
  }

  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.includes("supabase.co") || !serviceKey) {
    console.error("Нужны VITE_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local");
    process.exit(1);
  }

  const filePath = resolve(process.cwd(), args.file);
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const profiles = raw.clashArena_profiles
    ? JSON.parse(raw.clashArena_profiles)
    : raw;

  let entryKey = args.username;
  let profile = entryKey ? profiles[entryKey] : null;

  if (!profile && args.playerId) {
    const pid = normalizePlayerId(args.playerId);
    for (const [key, p] of Object.entries(profiles)) {
      if (normalizePlayerId(p.playerId) === pid) {
        entryKey = key;
        profile = p;
        break;
      }
    }
  }

  if (!profile) {
    console.error("Профиль не найден. Ключи:", Object.keys(profiles).join(", "));
    process.exit(1);
  }

  const playerId = normalizePlayerId(profile.playerId);
  if (!playerId) {
    console.error("У профиля нет playerId");
    process.exit(1);
  }

  const username = entryKey || profile.username || args.username;
  const payload = packProfile(profile);
  const syncedAt = new Date().toISOString();

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates",
  };

  const profileRes = await fetch(`${url}/rest/v1/player_profiles`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      player_id: playerId,
      username,
      profile_data: payload,
      updated_at: syncedAt,
    }),
  });

  if (!profileRes.ok) {
    console.error("player_profiles error:", profileRes.status, await profileRes.text());
    process.exit(1);
  }

  if (profile.passwordHash) {
    const accountRes = await fetch(`${url}/rest/v1/player_accounts`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({
        player_id: playerId,
        username,
        email: profile.email?.trim().toLowerCase() || null,
        password_hash: profile.passwordHash,
        account_blocked: profile.accountBlocked ?? false,
        updated_at: syncedAt,
      }),
    });
    if (!accountRes.ok) {
      console.error("player_accounts error:", accountRes.status, await accountRes.text());
      process.exit(1);
    }
  }

  const kb = Math.round(JSON.stringify(payload).length / 1024);
  console.log("OK:", username, playerId, `${kb} KB`, profile.email || "");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
