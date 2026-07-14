/**
 * Build config-server payloads from current local live-ops state.
 */
import { getDealPool, getForcedDealId } from "./dailyDeals";
import { getNews, getNewsCategories, exportNewsJson } from "./news";
import { getSavedMaps } from "./mapEditorAPI";
import { getDisabledDevMonsterModelIds } from "./devMonsterModelPrefs";
import { getTechBreakState, getUpcomingTechBreak } from "./techBreak";
import { CHARACTER_BALANCE_STORAGE_KEY } from "./characterBalance";
import type { CharacterBalanceOverrides } from "./characterBalance";
import type { ChestBalanceOverrides } from "./chestBalance";

const MAP_SCHEDULE_KEY = "clash_map_schedules_v2";
const TROPHY_KEY = "clash_trophy_tables_v1";
const CHEST_KEY = "clash_chest_balance_v1";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function snapshotDeals() {
  return {
    pool: getDealPool(),
    forcedDealId: getForcedDealId(),
  };
}

export function snapshotNews() {
  return JSON.parse(exportNewsJson()) as { categories: ReturnType<typeof getNewsCategories>; items: ReturnType<typeof getNews> };
}

export function snapshotTrophies() {
  return readJson(TROPHY_KEY, { overrides: {}, links: {} });
}

export function snapshotMapSchedule() {
  return readJson(MAP_SCHEDULE_KEY, {});
}

export function snapshotTechBreak() {
  return {
    active: getTechBreakState(),
    upcoming: getUpcomingTechBreak(),
  };
}

export function snapshotBalance(): CharacterBalanceOverrides {
  return readJson(CHARACTER_BALANCE_STORAGE_KEY, {});
}

export function snapshotChests(): ChestBalanceOverrides {
  return readJson(CHEST_KEY, {});
}

export function snapshotEditorMaps() {
  return getSavedMaps();
}

export function snapshotDisabledMonsterModels() {
  return [...getDisabledDevMonsterModelIds()];
}

export function snapshotAllLiveOpsDomains(): Record<string, unknown> {
  return {
    deals: snapshotDeals(),
    news: snapshotNews(),
    trophies: snapshotTrophies(),
    mapSchedule: snapshotMapSchedule(),
    techBreak: snapshotTechBreak(),
    balance: snapshotBalance(),
    economy: snapshotBalance(),
    chests: snapshotChests(),
    editorMaps: snapshotEditorMaps(),
    disabledMonsterModels: snapshotDisabledMonsterModels(),
  };
}
