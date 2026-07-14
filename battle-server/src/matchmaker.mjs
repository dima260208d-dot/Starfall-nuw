// ─────────────────────────────────────────────────────────────────────────────
// matchmaker.mjs — the single front door for battles. Clients POST /mm/find;
// the matchmaker groups live players into a forming room on the least-loaded
// worker and returns the WebSocket path to connect to. Empty seats are filled
// with bots by the room when it locks, so a match always starts even solo.
// ─────────────────────────────────────────────────────────────────────────────
import http from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MODES, modeCapacity } from "./sim/constants.mjs";
import { fetchPlayerMapByPublishId } from "./playerMaps.mjs";

const PORT = Number(process.env.PORT || 8090);
const INTERNAL_KEY = process.env.INTERNAL_KEY || "dev-internal-key";
const WORKER_COUNT = Number(process.env.WORKER_COUNT || 1);
const BASE_PORT = Number(process.env.WORKER_BASE_PORT || 8101);

const workers = Array.from({ length: WORKER_COUNT }, (_, i) => ({
  id: `w${i + 1}`,
  index: i + 1,
  internal: `http://127.0.0.1:${BASE_PORT + i}`,
  publicPath: `/w${i + 1}`,
  humans: 0,
  rooms: 0,
  alive: false,
}));

async function pollWorkers() {
  await Promise.all(
    workers.map(async (w) => {
      try {
        const r = await fetch(`${w.internal}/internal/stats`, { signal: AbortSignal.timeout(1500) });
        if (r.ok) {
          const s = await r.json();
          w.humans = s.humans || 0;
          w.rooms = s.rooms || 0;
          w.alive = true;
        } else w.alive = false;
      } catch {
        w.alive = false;
      }
    }),
  );
}
setInterval(pollWorkers, 2000);
pollWorkers();

const roomCapacityFor = (mode) => modeCapacity(MODES[mode]); // 6 for 3v3, 10 for showdown

const SERVER_MAP_POOL_BY_MODE = {
  showdown: [{ name: "showdown-default", editorMode: "showdown", cells: [], overlays: [], rotations: [] }],
  gemGrab: [{ name: "gemgrab-default", editorMode: "gemGrab", cells: [], overlays: [], rotations: [] }],
  heist: [{ name: "heist-default", editorMode: "heist", cells: [], overlays: [], rotations: [] }],
  crystals: [{ name: "crystals-default", editorMode: "crystals", cells: [], overlays: [], rotations: [] }],
  bounty: [{ name: "bounty-default", editorMode: "bounty", cells: [], overlays: [], rotations: [] }],
  starstrike: [{ name: "starstrike-default", editorMode: "starstrike", cells: [], overlays: [], rotations: [] }],
  training: [{ name: "training-default", editorMode: "training", cells: [], overlays: [], rotations: [] }],
};

function pickServerBattleMap(mode, fallback = null) {
  if (fallback) return fallback;
  const pool = SERVER_MAP_POOL_BY_MODE[mode] || SERVER_MAP_POOL_BY_MODE.showdown;
  const chosen = pool[Math.floor(Math.random() * pool.length)] || null;
  if (!chosen) return null;
  return { ...chosen, name: `${chosen.name}:${Math.random().toString(36).slice(2, 8)}` };
}

// ── Persistent online ledger (authoritative anti-cheat progression) ──────────
// The server is the single source of truth for online trophies/coins/xp/wins.
// Clients can never write here directly — only the workers (internal-key) can,
// using rewards the simulation computed. Persisted to disk so it survives reboots.
const __dir = dirname(fileURLToPath(import.meta.url));
const LEDGER_PATH = process.env.LEDGER_PATH || resolve(__dir, "../data/ledger.json");
const ledger = new Map(); // playerId -> { name, trophies, coins, xp, wins, battles, ts }

function loadLedger() {
  try {
    const raw = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
    for (const [id, v] of Object.entries(raw)) ledger.set(id, v);
    console.log(`[matchmaker] ledger loaded: ${ledger.size} players`);
  } catch { /* no ledger yet */ }
}
let saveTimer = null;
function saveLedgerSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      mkdirSync(dirname(LEDGER_PATH), { recursive: true });
      const obj = Object.fromEntries(ledger.entries());
      writeFileSync(LEDGER_PATH, JSON.stringify(obj));
    } catch (e) { console.error("[matchmaker] ledger save failed:", e?.message || e); }
  }, 1500);
}
function entryFor(playerId) {
  let e = ledger.get(playerId);
  if (!e) {
    e = {
      name: "", trophies: 0, coins: 0, xp: 0, wins: 0, battles: 0, brawlers: {}, ts: 0,
      wallet: { coins: 0, gems: 0, powerPoints: 0 },
      walletSeeded: false,
    };
    ledger.set(playerId, e);
  }
  if (!e.brawlers) e.brawlers = {};
  if (!e.wallet) e.wallet = { coins: e.coins || 0, gems: 0, powerPoints: 0 };
  if (e.walletSeeded === undefined) e.walletSeeded = false;
  return e;
}
function applyAward(a) {
  if (!a || !a.playerId) return;
  const e = entryFor(a.playerId);
  if (a.name) e.name = a.name;
  const delta = Number(a.trophyDelta) || 0;
  e.trophies = Math.max(0, e.trophies + delta);
  const coinGrant = Math.max(0, Number(a.coins) || 0);
  e.coins = Math.max(0, e.coins + coinGrant);
  e.wallet.coins = Math.max(0, (Number(e.wallet.coins) || 0) + coinGrant);
  e.xp += Math.max(0, Number(a.xp) || 0);
  e.battles += 1;
  if (a.win) e.wins += 1;
  if (a.brawlerId) {
    e.brawlers[a.brawlerId] = Math.max(0, (Number(e.brawlers[a.brawlerId]) || 0) + delta);
  }
  e.walletSeeded = true;
  e.ts = Date.now();
  mirrorSoon(a.playerId);
}
loadLedger();

// ── Supabase mirror (server-authoritative records source) ────────────────────
// The ledger is the truth; we replicate it to a Supabase table that only the
// service role can write. The game's Records screen reads from there, so global
// leaderboards are built purely from server data and can't be client-forged.
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPA_ENABLED = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
const supaDirty = new Set();
let supaTimer = null;

function mirrorSoon(playerId) {
  if (!SUPA_ENABLED || !playerId) return;
  supaDirty.add(playerId);
  if (supaTimer) return;
  supaTimer = setTimeout(() => {
    flushSupabase().catch(() => {});
  }, 4000);
}

async function flushSupabase() {
  supaTimer = null;
  if (!SUPA_ENABLED || !supaDirty.size) return;
  const ids = [...supaDirty];
  supaDirty.clear();
  const rows = ids
    .map((id) => {
      const e = ledger.get(id);
      if (!e) return null;
      return {
        player_id: id, name: e.name || "", trophies: e.trophies,
        coins: e.coins, xp: e.xp, wins: e.wins, battles: e.battles,
        brawlers: e.brawlers || {},
        updated_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);
  if (!rows.length) return;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/online_leaderboard`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  } catch (e) {
    console.error("[matchmaker] supabase mirror failed:", e?.message || e);
    for (const id of ids) supaDirty.add(id); // re-queue
    if (!supaTimer) supaTimer = setTimeout(flushSupabase, 15000);
  }
}

// Backfill the whole ledger to Supabase once on boot so existing progression
// (and anything written while Supabase was down) lands in the records table.
if (SUPA_ENABLED && ledger.size) {
  for (const id of ledger.keys()) supaDirty.add(id);
  setTimeout(() => {
    flushSupabase().catch(() => {});
  }, 3000);
  console.log(`[matchmaker] supabase mirror enabled — backfilling ${ledger.size} players`);
}

// ── Profile write gateway (anti-cheat) ───────────────────────────────────────
// Clients can no longer write player_profiles directly (RLS locks anon writes).
// They POST here; the server verifies ownership against player_accounts and
// makes trophies authoritative (snapped to the ledger) before writing with the
// service role. This closes the "overwrite any profile with the shipped anon
// key" hole and prevents trophy inflation.
const SUPA_HEADERS = {
  apikey: SUPABASE_SERVICE_KEY,
  authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "content-type": "application/json",
};

async function supaSelectAccount(playerId) {
  const u = `${SUPABASE_URL}/rest/v1/player_accounts?player_id=eq.${encodeURIComponent(playerId)}&select=player_id,username,password_hash,account_blocked&limit=1`;
  const r = await fetch(u, { headers: SUPA_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`account lookup HTTP ${r.status}`);
  const rows = await r.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function supaUpsertProfile(playerId, username, profileData) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/player_profiles`, {
    method: "POST",
    headers: { ...SUPA_HEADERS, prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([{
      player_id: playerId, username,
      profile_data: profileData, updated_at: new Date().toISOString(),
    }]),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`profile upsert HTTP ${r.status}: ${await r.text()}`);
}

// Authoritative progression: server ledger is the single source of truth.
const TROPHY_SEED_CAP = 50_000;
const XP_SEED_CAP = 2_000_000;
const BRAWLER_TROPHY_SEED_CAP = 2_000;

/** One-time migration: seed ledger from client on first authenticated profile push. */
function ensureLedgerFromProfile(playerId, pd) {
  if (ledger.has(playerId)) return;
  const e = entryFor(playerId);
  e.trophies = Math.min(TROPHY_SEED_CAP, Math.max(0, num(pd.trophies)));
  e.xp = Math.min(XP_SEED_CAP, Math.max(0, num(pd.xp)));
  if (pd.brawlerTrophies && typeof pd.brawlerTrophies === "object") {
    for (const [bid, t] of Object.entries(pd.brawlerTrophies)) {
      e.brawlers[bid] = Math.min(BRAWLER_TROPHY_SEED_CAP, Math.max(0, num(t)));
    }
  }
  e.ts = Date.now();
  saveLedgerSoon();
}

function enforceServerTruth(playerId, pd) {
  ensureLedgerFromProfile(playerId, pd);
  const e = ledger.get(playerId);
  if (!e) return pd;
  pd.trophies = Math.max(0, num(e.trophies));
  pd.xp = Math.max(0, num(e.xp));
  pd.brawlerTrophies = pd.brawlerTrophies && typeof pd.brawlerTrophies === "object" ? { ...pd.brawlerTrophies } : {};
  for (const [bid, t] of Object.entries(e.brawlers || {})) {
    pd.brawlerTrophies[bid] = Math.max(0, num(t));
  }
  for (const bid of Object.keys(pd.brawlerTrophies)) {
    if (!(bid in (e.brawlers || {}))) {
      pd.brawlerTrophies[bid] = 0;
    }
  }
  return pd;
}

function readBody(req, maxBytes, cb) {
  let body = "";
  let aborted = false;
  req.on("data", (c) => {
    if (aborted) return;
    body += c;
    if (body.length > maxBytes) { aborted = true; cb(new Error("payload too large"), null); req.destroy(); }
  });
  req.on("end", () => { if (!aborted) cb(null, body); });
}

// ── Server-authoritative wallet (coins / gems / powerPoints) ─────────────────
// After first seed: client may spend (balance down), never grant (balance up).
// Battle/shop grants go through applyAward or future server APIs only.
const num = (v) => { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : 0; };
const WALLET_KEYS = ["coins", "gems", "powerPoints"];
const SEED_CAP = { coins: 50_000_000, gems: 5_000_000, powerPoints: 50_000_000 };

function reconcileWallet(playerId, pd) {
  const e = entryFor(playerId);
  for (const k of WALLET_KEYS) {
    const cap = SEED_CAP[k];
    const clientVal = Math.min(cap, Math.max(0, num(pd[k])));
    const serverVal = Math.max(0, num(e.wallet[k]));

    if (!e.walletSeeded) {
      e.wallet[k] = clientVal;
    } else if (clientVal < serverVal) {
      e.wallet[k] = clientVal;
    }
    pd[k] = e.wallet[k];
  }
  e.walletSeeded = true;
  e.coins = e.wallet.coins;
  saveLedgerSoon();
  return { coins: e.wallet.coins, gems: e.wallet.gems, powerPoints: e.wallet.powerPoints };
}

// ── Account gateway helpers (service role; never expose password_hash) ────────
function normLogin(s) { return String(s || "").trim().normalize("NFC"); }
function normEmail(s) { const t = String(s || "").trim().toLowerCase(); return t && t.includes("@") ? t : null; }
function stripHash(id) { return String(id || "").replace(/^#/, "").toLowerCase(); }

function matchAccount(accts, login) {
  const t = normLogin(login);
  if (!t) return null;
  const em = normEmail(t);
  const tl = t.toLowerCase();
  const tid = stripHash(t);
  for (const a of accts) {
    if (em && (a.email || "").toLowerCase() === em) return a;
    const u = normLogin(a.username);
    if (u === t || u.toLowerCase() === tl) return a;
    if (stripHash(a.player_id) === tid) return a;
  }
  return null;
}
function publicAccount(a) {
  return { playerId: a.player_id, username: a.username, email: a.email, accountBlocked: !!a.account_blocked };
}

async function supaAllAccounts() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/player_accounts?select=player_id,username,email,password_hash,account_blocked`, { headers: SUPA_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`accounts list HTTP ${r.status}`);
  return await r.json();
}
async function supaInsertAccount(row) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/player_accounts`, {
    method: "POST", headers: { ...SUPA_HEADERS, prefer: "return=minimal" },
    body: JSON.stringify([row]), signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`account insert HTTP ${r.status}: ${await r.text()}`);
}
async function supaUpdateAccount(playerId, patch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/player_accounts?player_id=eq.${encodeURIComponent(playerId)}`, {
    method: "PATCH", headers: { ...SUPA_HEADERS, prefer: "return=minimal" },
    body: JSON.stringify(patch), signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`account update HTTP ${r.status}: ${await r.text()}`);
}

// One forming room per mode is "current": real players fill it (good PvP)
// before a new room opens on the least-loaded worker (spreads rooms across cores).
const formingByMode = new Map(); // mode -> { workerIndex, roomId, seatsLeft }

// Where each player is currently battling, so friends/party can spectate live.
const liveByPlayer = new Map(); // playerId -> { workerIndex, roomId, ts }
const SPECTATE_TTL_MS = 6 * 60 * 1000;

function pickWorkerForNewRoom() {
  const live = workers.filter((w) => w.alive);
  const pool = live.length ? live : workers;
  // Fewest rooms → spread matches across all cores under load.
  return pool.reduce((a, b) => (a.rooms <= b.rooms ? a : b));
}

function send(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, GET, OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }

  if (url.pathname === "/health" || url.pathname === "/mm/health") {
    send(res, 200, { ok: true, workers: workers.map((w) => ({ id: w.id, alive: w.alive, humans: w.humans, rooms: w.rooms })) });
    return;
  }

  if (url.pathname === "/metrics" || url.pathname === "/mm/metrics") {
    (async () => {
      const parts = [];
      for (const w of workers) {
        if (!w.alive) continue;
        try {
          const r = await fetch(`${w.internal}/metrics`, { signal: AbortSignal.timeout(1200) });
          if (r.ok) parts.push(await r.text());
        } catch {
          /* worker offline */
        }
      }
      res.writeHead(200, { "content-type": "text/plain; version=0.0.4; charset=utf-8" });
      res.end(parts.join("\n"));
    })().catch((e) => {
      console.error("[matchmaker] metrics:", e?.message || e);
      res.writeHead(500).end("");
    });
    return;
  }

  // Authoritative online stats for a player (read-only, public).
  if ((url.pathname === "/mm/stats" || url.pathname === "/stats") && req.method === "GET") {
    const pid = url.searchParams.get("playerId") || "";
    const e = ledger.get(pid);
    send(res, 200, { ok: true, playerId: pid, stats: e || { name: "", trophies: 0, coins: 0, xp: 0, wins: 0, battles: 0 } });
    return;
  }

  // Where is this player battling right now? Returns the WS route to spectate.
  if ((url.pathname === "/mm/spectate" || url.pathname === "/spectate") && req.method === "GET") {
    const pid = url.searchParams.get("playerId") || "";
    const loc = liveByPlayer.get(pid);
    if (!loc || Date.now() - loc.ts > SPECTATE_TTL_MS) { send(res, 200, { ok: false }); return; }
    const worker = workers[loc.workerIndex];
    if (!worker || !worker.alive) { send(res, 200, { ok: false }); return; }
    send(res, 200, { ok: true, wsPath: `${worker.publicPath}/battle`, roomId: loc.roomId, mode: loc.mode || "gemGrab" });
    return;
  }

  // Tamper-proof online leaderboard (top by trophies).
  if ((url.pathname === "/mm/leaderboard" || url.pathname === "/leaderboard") && req.method === "GET") {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 25));
    const top = [...ledger.entries()]
      .map(([id, e]) => ({ playerId: id, name: e.name, trophies: e.trophies, wins: e.wins, battles: e.battles }))
      .sort((a, b) => b.trophies - a.trophies)
      .slice(0, limit);
    send(res, 200, { ok: true, leaderboard: top });
    return;
  }

  // Workers report match rewards here (internal-key protected).
  if (url.pathname === "/internal/award" && req.method === "POST") {
    if (req.headers["x-internal-key"] !== INTERNAL_KEY) { send(res, 403, { error: "forbidden" }); return; }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let data;
      try { data = JSON.parse(body || "{}"); } catch { data = {}; }
      const awards = Array.isArray(data.awards) ? data.awards : [];
      for (const a of awards) applyAward(a);
      if (awards.length) saveLedgerSoon();
      send(res, 200, { ok: true, applied: awards.length });
    });
    return;
  }

  // Server-authoritative profile write (ownership-verified, trophies clamped).
  if ((url.pathname === "/mm/profile/push" || url.pathname === "/profile/push") && req.method === "POST") {
    if (!SUPA_ENABLED) { send(res, 503, { error: "cloud disabled" }); return; }
    readBody(req, 2_000_000, async (err, body) => {
      if (err) { send(res, 413, { error: "payload too large" }); return; }
      let data;
      try { data = JSON.parse(body || "{}"); } catch { send(res, 400, { error: "bad json" }); return; }
      const playerId = String(data.playerId || "").trim();
      const secret = String(data.secret || "");
      const profile = data.profile;
      if (!playerId || !secret || !profile || typeof profile !== "object") {
        send(res, 400, { error: "missing fields" }); return;
      }
      try {
        const acc = await supaSelectAccount(playerId);
        if (!acc) { send(res, 403, { error: "no account" }); return; }
        if (acc.account_blocked) { send(res, 403, { error: "account blocked" }); return; }
        if (!acc.password_hash || acc.password_hash !== secret) { send(res, 403, { error: "forbidden" }); return; }
        const pd = enforceServerTruth(playerId, profile);
        const wallet = reconcileWallet(playerId, pd);
        await supaUpsertProfile(playerId, String(data.username || acc.username || "").trim() || acc.username, pd);
        send(res, 200, {
          ok: true,
          trophies: pd.trophies ?? 0,
          xp: pd.xp ?? 0,
          brawlerTrophies: pd.brawlerTrophies ?? {},
          wallet,
        });
      } catch (e) {
        console.error("[matchmaker] profile push failed:", e?.message || e);
        send(res, 502, { error: "push failed" });
      }
    });
    return;
  }

  // ── Account gateway (server-side auth; password hashes never leave the DB) ──
  if ((url.pathname === "/mm/auth/login" || url.pathname === "/auth/login") && req.method === "POST") {
    if (!SUPA_ENABLED) { send(res, 503, { ok: false, error: "cloud disabled" }); return; }
    readBody(req, 64_000, async (err, body) => {
      if (err) { send(res, 413, { ok: false, error: "too large" }); return; }
      let d; try { d = JSON.parse(body || "{}"); } catch { send(res, 400, { ok: false, error: "bad json" }); return; }
      try {
        const a = matchAccount(await supaAllAccounts(), d.login);
        if (!a) { send(res, 200, { ok: false, code: "not_found" }); return; }
        if (a.account_blocked) { send(res, 200, { ok: false, code: "blocked" }); return; }
        if (!a.password_hash || a.password_hash !== String(d.secret || "")) { send(res, 200, { ok: false, code: "bad_password" }); return; }
        send(res, 200, { ok: true, account: publicAccount(a) });
      } catch (e) { console.error("[mm] auth/login:", e?.message || e); send(res, 502, { ok: false, error: "login failed" }); }
    });
    return;
  }

  if ((url.pathname === "/mm/auth/lookup" || url.pathname === "/auth/lookup") && req.method === "POST") {
    if (!SUPA_ENABLED) { send(res, 503, { ok: false, error: "cloud disabled" }); return; }
    readBody(req, 64_000, async (err, body) => {
      if (err) { send(res, 413, { ok: false, error: "too large" }); return; }
      let d; try { d = JSON.parse(body || "{}"); } catch { send(res, 400, { ok: false, error: "bad json" }); return; }
      try {
        const a = matchAccount(await supaAllAccounts(), d.login);
        send(res, 200, { ok: true, account: a ? publicAccount(a) : null });
      } catch (e) { console.error("[mm] auth/lookup:", e?.message || e); send(res, 502, { ok: false, error: "lookup failed" }); }
    });
    return;
  }

  if ((url.pathname === "/mm/auth/check" || url.pathname === "/auth/check") && req.method === "POST") {
    if (!SUPA_ENABLED) { send(res, 503, { ok: false, error: "cloud disabled" }); return; }
    readBody(req, 64_000, async (err, body) => {
      if (err) { send(res, 413, { ok: false, error: "too large" }); return; }
      let d; try { d = JSON.parse(body || "{}"); } catch { send(res, 400, { ok: false, error: "bad json" }); return; }
      try {
        const accts = await supaAllAccounts();
        const except = stripHash(d.exceptPlayerId || "");
        const uname = normLogin(d.username || "").toLowerCase();
        const email = normEmail(d.email || "");
        let usernameTaken = false, emailTaken = false;
        for (const a of accts) {
          if (except && stripHash(a.player_id) === except) continue;
          if (uname && normLogin(a.username).toLowerCase() === uname) usernameTaken = true;
          if (email && (a.email || "").toLowerCase() === email) emailTaken = true;
        }
        send(res, 200, { ok: true, usernameTaken, emailTaken });
      } catch (e) { console.error("[mm] auth/check:", e?.message || e); send(res, 502, { ok: false, error: "check failed" }); }
    });
    return;
  }

  if ((url.pathname === "/mm/auth/register" || url.pathname === "/auth/register") && req.method === "POST") {
    if (!SUPA_ENABLED) { send(res, 503, { ok: false, error: "cloud disabled" }); return; }
    readBody(req, 64_000, async (err, body) => {
      if (err) { send(res, 413, { ok: false, error: "too large" }); return; }
      let d; try { d = JSON.parse(body || "{}"); } catch { send(res, 400, { ok: false, error: "bad json" }); return; }
      const playerId = String(d.playerId || "").trim();
      const username = String(d.username || "").trim();
      const secret = String(d.secret || "");
      const email = normEmail(d.email || "");
      if (!playerId || !username || !secret) { send(res, 400, { ok: false, error: "missing fields" }); return; }
      try {
        const accts = await supaAllAccounts();
        const idl = stripHash(playerId), unl = username.toLowerCase();
        for (const a of accts) {
          if (stripHash(a.player_id) === idl) { send(res, 200, { ok: false, error: "Аккаунт уже существует" }); return; }
          if (normLogin(a.username).toLowerCase() === unl) { send(res, 200, { ok: false, error: "Имя пользователя уже занято" }); return; }
          if (email && (a.email || "").toLowerCase() === email) { send(res, 200, { ok: false, error: "Этот e-mail уже привязан к другому аккаунту" }); return; }
        }
        await supaInsertAccount({ player_id: playerId, username, email, password_hash: secret, account_blocked: false, updated_at: new Date().toISOString() });
        send(res, 200, { ok: true });
      } catch (e) { console.error("[mm] auth/register:", e?.message || e); send(res, 502, { ok: false, error: "register failed" }); }
    });
    return;
  }

  if ((url.pathname === "/mm/auth/sync" || url.pathname === "/auth/sync") && req.method === "POST") {
    if (!SUPA_ENABLED) { send(res, 503, { ok: false, error: "cloud disabled" }); return; }
    readBody(req, 64_000, async (err, body) => {
      if (err) { send(res, 413, { ok: false, error: "too large" }); return; }
      let d; try { d = JSON.parse(body || "{}"); } catch { send(res, 400, { ok: false, error: "bad json" }); return; }
      const playerId = String(d.playerId || "").trim();
      const username = String(d.username || "").trim();
      const secret = String(d.secret || "");
      if (!playerId || !username || !secret) { send(res, 400, { ok: false, error: "missing fields" }); return; }
      try {
        const accts = await supaAllAccounts();
        const a = accts.find((x) => stripHash(x.player_id) === stripHash(playerId));
        const email = d.email === undefined ? undefined : normEmail(d.email);
        if (!a) {
          await supaInsertAccount({ player_id: playerId, username, email: email ?? null, password_hash: secret, account_blocked: !!d.accountBlocked, updated_at: new Date().toISOString() });
          send(res, 200, { ok: true, created: true }); return;
        }
        if (!a.password_hash || a.password_hash !== secret) { send(res, 200, { ok: false, code: "forbidden" }); return; }
        const patch = { username, updated_at: new Date().toISOString() };
        if (email !== undefined) patch.email = email;
        if (d.accountBlocked !== undefined) patch.account_blocked = !!d.accountBlocked;
        await supaUpdateAccount(a.player_id, patch);
        send(res, 200, { ok: true });
      } catch (e) { console.error("[mm] auth/sync:", e?.message || e); send(res, 502, { ok: false, error: "sync failed" }); }
    });
    return;
  }

  if ((url.pathname === "/mm/auth/password" || url.pathname === "/auth/password") && req.method === "POST") {
    if (!SUPA_ENABLED) { send(res, 503, { ok: false, error: "cloud disabled" }); return; }
    readBody(req, 64_000, async (err, body) => {
      if (err) { send(res, 413, { ok: false, error: "too large" }); return; }
      let d; try { d = JSON.parse(body || "{}"); } catch { send(res, 400, { ok: false, error: "bad json" }); return; }
      const playerId = String(d.playerId || "").trim();
      const secret = String(d.secret || "");
      const newSecret = String(d.newSecret || "");
      if (!playerId || !secret || !newSecret) { send(res, 400, { ok: false, error: "missing fields" }); return; }
      try {
        const accts = await supaAllAccounts();
        const a = accts.find((x) => stripHash(x.player_id) === stripHash(playerId));
        if (!a) { send(res, 200, { ok: false, code: "not_found" }); return; }
        if (!a.password_hash || a.password_hash !== secret) { send(res, 200, { ok: false, code: "forbidden" }); return; }
        await supaUpdateAccount(a.player_id, { password_hash: newSecret, updated_at: new Date().toISOString() });
        send(res, 200, { ok: true });
      } catch (e) { console.error("[mm] auth/password:", e?.message || e); send(res, 502, { ok: false, error: "password failed" }); }
    });
    return;
  }

  if (url.pathname === "/mm/find" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const finish = (code, obj) => send(res, code, obj);
      let player;
      try { player = JSON.parse(body || "{}"); } catch { player = {}; }
      const mode = player.mode || "gemGrab";
      let playerMap = null;
      if (player.playerMapPublishId) {
        playerMap = await fetchPlayerMapByPublishId(player.playerMapPublishId, mode);
        if (!playerMap) {
          send(res, 404, { error: "player map not found or expired" });
          return;
        }
      }
      const serverBattleMap = pickServerBattleMap(mode, player.battleMap || null);
      const serverMapHash = serverBattleMap ? `${mode}:${serverBattleMap.editorMode}:${serverBattleMap.name}` : null;
      const payload = {
        mode,
        playerId: player.playerId || `p${Math.random().toString(36).slice(2, 10)}`,
        brawlerId: player.brawlerId || null,
        level: player.level || 1,
        name: player.name || "Player",
        playerMap,
        battleMap: serverBattleMap,
        mapHash: serverMapHash,
      };

      const reserveOn = async (worker, roomId, withRoomMap) => {
        const r = await fetch(`${worker.internal}/internal/reserve`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-internal-key": INTERNAL_KEY },
          body: JSON.stringify({
            ...payload,
            roomId: roomId || undefined,
            playerMap: withRoomMap ? playerMap : null,
            battleMap: serverBattleMap,
            mapHash: serverMapHash,
          }),
          signal: AbortSignal.timeout(3000),
        });
        if (!r.ok) return null;
        return r.json();
      };

      try {
        // Training is solo practice: every player gets their own fresh room.
        const groupable = mode !== "training";

        // 1) Try to join the current forming room for this mode (group real players).
        let cur = groupable ? formingByMode.get(mode) : null;
        let worker = cur ? workers[cur.workerIndex] : null;
        let seat = null;
        if (cur && worker && worker.alive && cur.seatsLeft > 0) {
          seat = await reserveOn(worker, cur.roomId, false);
          if (!seat) {
            formingByMode.delete(mode);
            worker = pickWorkerForNewRoom();
            seat = await reserveOn(worker, null, !!playerMap);
          }
          if (seat) { cur.seatsLeft -= 1; if (cur.seatsLeft <= 0) formingByMode.delete(mode); }
          else formingByMode.delete(mode); // room locked/full — open a new one
        }

        // 2) Otherwise open a fresh room on the least-loaded worker (spreads across cores).
        if (!seat) {
          worker = pickWorkerForNewRoom();
          seat = await reserveOn(worker, null, !!playerMap);
          if (!seat) { send(res, 502, { error: "reserve failed" }); return; }
          worker.rooms += 1; // optimistic until next poll
          if (groupable) {
            const cap = roomCapacityFor(mode);
            formingByMode.set(mode, { workerIndex: worker.index - 1, roomId: seat.roomId, seatsLeft: cap - 1 });
          }
        }

        // Remember where this player is so others can spectate their battle.
        if (player.playerId) {
          liveByPlayer.set(payload.playerId, { workerIndex: worker.index - 1, roomId: seat.roomId, mode, ts: Date.now() });
        }

        send(res, 200, {
          ok: true,
          mode,
          wsPath: `${worker.publicPath}/battle`,
          roomId: seat.roomId,
          token: seat.token,
          team: seat.team,
          slot: seat.slot,
          seed: seat.seed,
          udpPort: BASE_PORT + worker.index - 1 + 1000,
        });
      } catch (e) {
        send(res, 502, { error: "matchmaker error", detail: String(e?.message || e) });
      }
    });
    return;
  }

  send(res, 404, { error: "not found" });
});

const HOST = process.env.BIND_HOST || "127.0.0.1";
server.listen(PORT, HOST, () => {
  console.log(`[matchmaker] listening on ${HOST}:${PORT} — ${WORKER_COUNT} worker(s)`);
});
