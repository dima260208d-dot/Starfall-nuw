from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

dense = ROOT / "src/data/curatedMaps/denseFill.ts"
s = dense.read_text(encoding="utf-8")
needle = "    if (!b.canPaint(x, y)) continue;\n    b.set(x, y, pickDenseTile"
repl = "    if (!b.canPaint(x, y)) continue;\n    if ((x - PLAY_LO) % 3 === 1 || (y - PLAY_LO) % 3 === 1) continue;\n    b.set(x, y, pickDenseTile"
if needle not in s:
    raise SystemExit("denseFill needle not found")
dense.write_text(s.replace(needle, repl, 1), encoding="utf-8")
print("patched denseFill")

seed_path = ROOT / "src/utils/curatedMapSeed.ts"
seed_path.write_text("""import {
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
} from "./mapSchedule";

export const CURATED_SEED_KEY = "clash_seed_v5_dense";
export const ROTATING_INTERVAL_HOURS = 12;

export function seedCuratedMaps(force = false): void {
  if (!force && localStorage.getItem(CURATED_SEED_KEY) === "1") return;

  assertCuratedMapsValid();
  const maps = buildAllCuratedMaps();
  const existing = getSavedMaps();
  const keepUserMaps = existing.filter(m => !m.id.startsWith("curated_"));
  const merged = [...keepUserMaps];
  for (const map of maps) {
    const idx = merged.findIndex(m => m.id === map.id);
    if (idx >= 0) merged[idx] = map;
    else merged.push(map);
  }
  localStorage.setItem("clash_editor_maps", JSON.stringify(merged));

  for (const mode of Object.keys(CURATED_MAPS_BY_MODE) as EditorMode[]) {
    const pool = CURATED_MAPS_BY_MODE[mode];
    const first = maps.find(m => m.id === pool[0]);
    if (first) publishMap(first);

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
  const id = CURATED_MAPS_BY_MODE[mode][index % 10];
  return getSavedMaps().find(m => m.id === id) ?? null;
}

export function getPublishedOrCuratedFallback(mode: EditorMode): MapSave | null {
  return getPublishedMap(mode) ?? getCuratedMapByIndex(mode, 0);
}
""", encoding="utf-8")
print("rewrote curatedMapSeed")
