import {
  type EditorMode,
  type MapSave,
  getSavedMaps,
  publishMap,
  getPublishedMap,
} from "./mapEditorAPI";
import {
  buildAllCuratedMaps,
  assertCuratedMapsValid,
  CURATED_MAPS_BY_MODE,
  CURATED_MAP_NAMES,
} from "../data/curatedMaps";
import {
  getMapScheduleConfig,
  saveMapScheduleConfig,
  markMapSeen,
} from "./mapSchedule";

export const CURATED_SEED_KEY = "clash_seed_v9_openmaps";
export const ROTATING_INTERVAL_HOURS = 12;

export function seedCuratedMaps(force = false): void {
  if (!force && localStorage.getItem(CURATED_SEED_KEY) === "1") return;
  assertCuratedMapsValid();
  const maps = buildAllCuratedMaps();
  const existing = getSavedMaps();
  const keepUserMaps = existing.filter(m => !m.id.startsWith("curated_"));
  const merged = [...keepUserMaps];
  for (const map of maps) {
    const idx2 = merged.findIndex(m => m.id === map.id);
    if (idx2 >= 0) merged[idx2] = map;
    else merged.push(map);
  }
  localStorage.setItem("clash_editor_maps", JSON.stringify(merged));
  for (const mode of Object.keys(CURATED_MAPS_BY_MODE) as EditorMode[]) {
    const pool = CURATED_MAPS_BY_MODE[mode];
    const first = maps.find(m => m.id === pool[0]);
    if (first) {
      publishMap(first);
      markMapSeen(mode, first.id);
    }
    const prev = getMapScheduleConfig(mode);
    saveMapScheduleConfig(mode, {
      variant: "rotating",
      dailySlots: prev.dailySlots,
      weekly: prev.weekly,
      rotatingPool: pool,
      rotatingIntervalHours: ROTATING_INTERVAL_HOURS,
    });
  }
  localStorage.setItem(CURATED_SEED_KEY, "1");
}

export function getCuratedMapCatalog(): Record<EditorMode, { id: string; name: string }[]> {
  const result = {} as Record<EditorMode, { id: string; name: string }[]>;
  for (const mode of Object.keys(CURATED_MAPS_BY_MODE) as EditorMode[]) {
    result[mode] = CURATED_MAPS_BY_MODE[mode].map((id, i) => ({
      id,
      name: CURATED_MAP_NAMES[mode][i] ?? id,
    }));
  }
  return result;
}

export function getCuratedMapByIndex(mode: EditorMode, index: number): MapSave | null {
  const pool = CURATED_MAPS_BY_MODE[mode];
  const id = pool[index % pool.length];
  return getSavedMaps().find(m => m.id === id) ?? null;
}

export function getPublishedOrCuratedFallback(mode: EditorMode): MapSave | null {
  return getPublishedMap(mode) ?? getCuratedMapByIndex(mode, 0);
}
