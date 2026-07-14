/**
 * liveConfig — the game's read-only client for the external live-ops config-server.
 *
 * The in-game admin panel is gone. All live-ops (balance, drop rates, deals, news,
 * map rotation, tech break, feature flags…) now come from the config-server as an
 * Ed25519-SIGNED document. We verify the signature before trusting anything, so a
 * tampered CDN/cache/MITM payload is rejected (anti-cheat boundary for live-ops).
 *
 * Published domains are mapped onto the same localStorage keys the game already
 * reads, so every existing reader keeps working — it just now receives
 * server-authoritative values that update live over WebSocket.
 */
import {
  getConfigServerUrl, getConfigServerWsUrl, getConfigPublicKey, isConfigServerConfigured,
} from "./runtimeConfig";
import { fetchJsonWithDiskCache } from "../utils/assetDiskCache";
import { setForcedDeal, saveDealPool, type DealTemplate } from "../utils/dailyDeals";
import { saveNews, saveNewsCategories } from "../utils/news";
import { TECH_BREAK_CHANGED_EVENT } from "../utils/techBreak";
import { processLiveCommands } from "../utils/liveCommandProcessor";
import { applyServerBotAiTuning } from "../utils/serverBotAiTuning";

export const LIVE_CONFIG_APPLIED_EVENT = "clash:live-config-applied";

type SignedConfig = {
  config: { version: number; updatedAt: number; domains: Record<string, unknown> };
  signature: string;
};

const CACHE_KEY = "clash_live_config_v1";

// Domain → the localStorage key(s) the game already consumes. Adding a domain here
// is all that's needed to make a new live-ops surface effective.
const DOMAIN_TO_LS: Record<string, string> = {
  balance: "clash_character_balance_v1",
  economy: "clash_character_balance_v1",
  chests: "clash_chest_balance_v1",
  trophies: "clash_trophy_tables_v1",
  mapSchedule: "clash_map_schedules_v2",
  disabledMonsterModels: "dev_disabled_monster_models_v1",
};

let current: SignedConfig["config"] | null = null;
let publicKey: CryptoKey | null = null;
let ws: WebSocket | null = null;
let wsRetry = 0;

const listeners = new Set<(domains: Record<string, unknown>) => void>();

export function onLiveConfig(cb: (domains: Record<string, unknown>) => void): () => void {
  listeners.add(cb);
  if (current) cb(current.domains);
  return () => listeners.delete(cb);
}

export function getLiveDomain<T = unknown>(domain: string): T | null {
  return (current?.domains?.[domain] as T) ?? null;
}

// ── Ed25519 verification (Web Crypto) ────────────────────────────────────────
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getKey(): Promise<CryptoKey | null> {
  if (publicKey) return publicKey;
  const pem = getConfigPublicKey();
  if (!pem || !globalThis.crypto?.subtle) return null;
  try {
    publicKey = await crypto.subtle.importKey("spki", pemToDer(pem), { name: "Ed25519" }, false, ["verify"]);
    return publicKey;
  } catch {
    return null; // browser without Ed25519 support
  }
}

// Must match the server's canonicalJson exactly (stable key ordering).
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

async function verify(snap: SignedConfig): Promise<boolean> {
  const key = await getKey();
  if (!key) return false;
  try {
    const data = new TextEncoder().encode(canonicalJson(snap.config));
    const sigBytes = Uint8Array.from(atob(snap.signature), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify("Ed25519", key, sigBytes, data);
  } catch {
    return false;
  }
}

// Admin-authored maps (from the external panel's map constructor) are published
// under the `editorMaps` domain as an array of MapSave. They are MERGED into the
// player's local map library (curated/player maps are preserved) and set as the
// active published map per mode so they show up in battle.
function applyEditorMaps(value: unknown) {
  if (!Array.isArray(value)) return;
  try {
    const EDITOR_KEY = "clash_editor_maps";
    const existing = JSON.parse(localStorage.getItem(EDITOR_KEY) || "[]");
    const byId = new Map<string, any>();
    for (const m of Array.isArray(existing) ? existing : []) if (m && m.id) byId.set(m.id, m);
    for (const m of value) {
      if (!m || !m.id || !m.mode) continue;
      byId.set(m.id, m);
      // Make it the active fallback for its mode.
      try { localStorage.setItem(`clash_published_map_${m.mode}`, JSON.stringify(m)); } catch { /* quota */ }
    }
    localStorage.setItem(EDITOR_KEY, JSON.stringify([...byId.values()]));
  } catch { /* ignore malformed */ }
}

function applyDeals(value: unknown): void {
  if (Array.isArray(value)) {
    saveDealPool(value as DealTemplate[]);
    return;
  }
  if (!value || typeof value !== "object") return;
  const v = value as { pool?: DealTemplate[]; forcedDealId?: string | null };
  if (Array.isArray(v.pool)) saveDealPool(v.pool);
  if ("forcedDealId" in v) setForcedDeal(v.forcedDealId ?? null);
}

function applyNews(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const v = value as { categories?: unknown[]; items?: unknown[] };
  if (Array.isArray(v.categories)) saveNewsCategories(v.categories as Parameters<typeof saveNewsCategories>[0]);
  if (Array.isArray(v.items)) saveNews(v.items as Parameters<typeof saveNews>[0]);
}

function applyTechBreak(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const v = value as {
    active?: { active?: boolean; startedAt?: number; estimatedEndAt?: number; durationLabel?: string };
    upcoming?: { startAt: number; durationMinutes: number } | null;
  };
  if (v.active?.active) {
    try {
      localStorage.setItem("clash_tech_break_v1", JSON.stringify({
        active: true,
        startedAt: v.active.startedAt ?? Date.now(),
        estimatedEndAt: v.active.estimatedEndAt ?? Date.now(),
        durationLabel: v.active.durationLabel ?? "",
      }));
    } catch { /* quota */ }
  } else {
    localStorage.removeItem("clash_tech_break_v1");
  }
  if (v.upcoming) {
    try { localStorage.setItem("clash_tech_break_upcoming_v1", JSON.stringify(v.upcoming)); } catch { /* quota */ }
  } else {
    localStorage.removeItem("clash_tech_break_upcoming_v1");
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TECH_BREAK_CHANGED_EVENT));
  }
}

// ── Apply published domains into the game's existing read paths ───────────────
function applyDomains(domains: Record<string, unknown>) {
  for (const [domain, value] of Object.entries(domains)) {
    if (domain === "editorMaps") { applyEditorMaps(value); continue; }
    if (domain === "botAi") { applyServerBotAiTuning(value); continue; }
    if (domain === "deals") { applyDeals(value); continue; }
    if (domain === "news") { applyNews(value); continue; }
    if (domain === "techBreak") { applyTechBreak(value); continue; }
    if (domain === "liveCommands") { processLiveCommands(value); continue; }
    const lsKey = DOMAIN_TO_LS[domain];
    if (!lsKey || value == null) continue;
    try { localStorage.setItem(lsKey, JSON.stringify(value)); } catch { /* quota */ }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LIVE_CONFIG_APPLIED_EVENT, { detail: domains }));
  }
  for (const cb of listeners) { try { cb(domains); } catch { /* ignore */ } }
}

async function accept(snap: SignedConfig, { fromCache = false } = {}): Promise<boolean> {
  if (!snap?.config) return false;
  if (current && snap.config.version <= current.version && !fromCache) return false;
  const ok = await verify(snap);
  if (!ok) {
    if (!fromCache) console.warn("[liveConfig] signature verification failed — ignoring config");
    return false;
  }
  current = snap.config;
  applyDomains(snap.config.domains);
  if (!fromCache) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(snap)); } catch { /* quota */ }
  }
  return true;
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) void accept(JSON.parse(raw) as SignedConfig, { fromCache: true });
  } catch { /* none */ }
}

async function fetchOnce(): Promise<void> {
  const base = getConfigServerUrl();
  if (!base) return;
  try {
    const url = `${base}/config/public`;
    await accept(await fetchJsonWithDiskCache<SignedConfig>(url, () => fetch(url, { cache: "no-cache" })));
  } catch { /* offline — keep cache */ }
}

function connectLive() {
  const url = getConfigServerWsUrl();
  if (!url) return;
  try {
    ws = new WebSocket(url);
    ws.onopen = () => { wsRetry = 0; };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg?.type === "config") void accept(msg as SignedConfig);
      } catch { /* ignore */ }
    };
    ws.onclose = () => { ws = null; scheduleReconnect(); };
    ws.onerror = () => { try { ws?.close(); } catch { /* */ } };
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  wsRetry = Math.min(wsRetry + 1, 6);
  setTimeout(connectLive, 1000 * 2 ** wsRetry);
}

let started = false;
export function initLiveConfig(): void {
  if (started) return;
  started = true;
  loadCache(); // instant: last-good signed config from previous session
  if (!isConfigServerConfigured()) return;
  void fetchOnce();
  connectLive();
}
