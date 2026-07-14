/**
 * Pull authoritative live-ops state from config-server into admin panel editors.
 */
import { isLiveOpsAdminSession } from "../lib/configServerPublish";
import { fetchAdminPublishedState, fetchAdminSettingsFromServer } from "./adminServerApi";
import { saveDevNotes, type DevNote } from "./devNotes";
import { saveDealPool, setForcedDeal, type DealTemplate } from "./dailyDeals";
import { saveNews, saveNewsCategories } from "./news";
import { applyAdminSettingsValues, ADMIN_SETTINGS_STORAGE_KEY } from "../data/adminSettingsManifest";

export const ADMIN_HYDRATE_EVENT = "sf:admin-hydrated";

const DOMAIN_TO_LS: Record<string, string> = {
  balance: "clash_character_balance_v1",
  economy: "clash_character_balance_v1",
  chests: "clash_chest_balance_v1",
  trophies: "clash_trophy_tables_v1",
  mapSchedule: "clash_map_schedules_v2",
  disabledMonsterModels: "dev_disabled_monster_models_v1",
};

function applyEditorMaps(value: unknown) {
  if (!Array.isArray(value)) return;
  try {
    const EDITOR_KEY = "clash_editor_maps";
    const existing = JSON.parse(localStorage.getItem(EDITOR_KEY) || "[]");
    const byId = new Map<string, unknown>();
    for (const m of Array.isArray(existing) ? existing : []) {
      if (m && typeof m === "object" && "id" in m) byId.set(String((m as { id: string }).id), m);
    }
    for (const m of value) {
      if (!m || typeof m !== "object" || !("id" in m) || !("mode" in m)) continue;
      const map = m as { id: string; mode: string };
      byId.set(map.id, m);
      try { localStorage.setItem(`clash_published_map_${map.mode}`, JSON.stringify(m)); } catch { /* quota */ }
    }
    localStorage.setItem(EDITOR_KEY, JSON.stringify([...byId.values()]));
  } catch { /* ignore */ }
}

function applyDeals(value: unknown) {
  if (!value || typeof value !== "object") return;
  const v = value as { pool?: DealTemplate[]; forcedDealId?: string | null };
  if (Array.isArray(v.pool)) saveDealPool(v.pool);
  if ("forcedDealId" in v) setForcedDeal(v.forcedDealId ?? null);
}

function applyNews(value: unknown) {
  if (!value || typeof value !== "object") return;
  const v = value as { categories?: unknown; items?: unknown };
  if (Array.isArray(v.categories)) saveNewsCategories(v.categories as Parameters<typeof saveNewsCategories>[0]);
  if (Array.isArray(v.items)) saveNews(v.items as Parameters<typeof saveNews>[0]);
}

function applyTechBreak(value: unknown) {
  if (!value || typeof value !== "object") return;
  try {
    localStorage.setItem("clash_tech_break_v1", JSON.stringify(value));
  } catch { /* quota */ }
}

function applyDevNotes(value: unknown) {
  if (!Array.isArray(value)) return;
  saveDevNotes(value as DevNote[]);
}

function applyDomains(domains: Record<string, unknown>) {
  for (const [domain, value] of Object.entries(domains)) {
    if (domain === "editorMaps") { applyEditorMaps(value); continue; }
    if (domain === "deals") { applyDeals(value); continue; }
    if (domain === "news") { applyNews(value); continue; }
    if (domain === "techBreak") { applyTechBreak(value); continue; }
    if (domain === "devNotes") { applyDevNotes(value); continue; }
    if (domain === "adminSettings") {
      try {
        localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(value));
        applyAdminSettingsValues(value as Record<string, unknown>);
      } catch { /* quota */ }
      continue;
    }
    const lsKey = DOMAIN_TO_LS[domain];
    if (!lsKey || value == null) continue;
    try { localStorage.setItem(lsKey, JSON.stringify(value)); } catch { /* quota */ }
  }
}

let hydratePromise: Promise<{ ok: boolean; domains: string[] }> | null = null;

/** Load published config from VPS into local admin editors (server = source of truth). */
export async function hydrateAdminFromServer(): Promise<{ ok: boolean; domains: string[] }> {
  if (!isLiveOpsAdminSession()) return { ok: false, domains: [] };
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const domains = await fetchAdminPublishedState();
    const keys = Object.keys(domains);
    if (keys.length) applyDomains(domains);

    const settings = await fetchAdminSettingsFromServer();
    if (settings) {
      try {
        localStorage.setItem(ADMIN_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        applyAdminSettingsValues(settings);
      } catch { /* quota */ }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ADMIN_HYDRATE_EVENT, { detail: { domains: keys } }));
    }
    return { ok: keys.length > 0 || settings !== null, domains: keys };
  })().finally(() => {
    hydratePromise = null;
  });

  return hydratePromise;
}

export function resetAdminHydrateCache() {
  hydratePromise = null;
}
