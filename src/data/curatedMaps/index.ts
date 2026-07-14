import type { MapSave, EditorMode } from "../../utils/mapEditorAPI";
import { validateMap } from "../../utils/mapEditorAPI";
import {
  MapBuilder,
  type CuratedBlueprint,
  GS,
} from "./mapBuilder";
import {
  showdownLayout,
  gemArena,
  placeTeamSpawns3,
  heistLayout,
  bountyLayout,
  starstrikeLayout,
  siegeLayout,
  bossraidLayout,
} from "./layouts";
import { assertDensityInRange } from "./denseFill";

const SHOWDOWN_NAMES = [
  "Кольцо кустов",
  "Крестовина",
  "Песчаные ступени",
  "Заборный лабиринт",
  "Двойные коридоры",
];

const GEMGRAB_NAMES = [
  "Кристальный крест",
  "Кольцо силы",
  "Диагональ",
  "Звёздный центр",
  "Разделённые линии",
];

const HEIST_NAMES = [
  "Сейфовая аллея",
  "Защитный зал",
  "Центральный проход",
  "Боковые укрытия",
  "Последний рубеж",
];

const BOUNTY_NAMES = [
  "Звёздное кольцо",
  "Крест воды",
  "Костяная арена",
  "Фланговые форты",
  "Кактусовый дуэль",
];

const STARSTRIKE_NAMES = [
  "Супер-пляж",
  "Центральные ворота",
  "Крестовый мяч",
  "Водный центр",
  "Центральная полоса",
];

const SIEGE_NAMES = [
  "Крепость левого фланга",
  "Двойной рубеж",
  "Каменный зал",
  "Перекрёсток осад",
  "Последняя стена",
];

const BOSSRAID_NAMES = [
  "Логово босса",
  "Центральный проход",
  "Крестовая арена",
  "Каменный зал",
  "Финальная арена",
];

function makeBlueprints(
  mode: EditorMode,
  prefix: string,
  names: string[],
  paintFn: (b: Parameters<CuratedBlueprint["paint"]>[0], i: number) => void,
  symmetry: CuratedBlueprint["symmetry"] = "x",
): CuratedBlueprint[] {
  return names.map((name, i) => ({
    id: `curated_${prefix}_${String(i + 1).padStart(2, "0")}`,
    name,
    mode,
    symmetry,
    variant: i,
    paint: (b) => paintFn(b, i),
  }));
}

export const CURATED_BLUEPRINTS: CuratedBlueprint[] = [
  ...makeBlueprints("showdown", "sd", SHOWDOWN_NAMES, (b, i) => showdownLayout(b, i), "xy"),
  ...makeBlueprints("gemgrab", "gg", GEMGRAB_NAMES, (b, i) => {
    placeTeamSpawns3(b);
    gemArena(b, i);
  }),
  ...makeBlueprints("heist", "hs", HEIST_NAMES, (b, i) => heistLayout(b, i)),
  ...makeBlueprints("bounty", "bn", BOUNTY_NAMES, (b, i) => bountyLayout(b, i)),
  ...makeBlueprints("starstrike", "ss", STARSTRIKE_NAMES, (b, i) => starstrikeLayout(b, i)),
  ...makeBlueprints("siege", "sg", SIEGE_NAMES, (b, i) => siegeLayout(b, i)),
  ...makeBlueprints("bossraid", "br", BOSSRAID_NAMES, (b, i) => bossraidLayout(b, i), "none"),
];

export function buildBlueprint(bp: CuratedBlueprint): { cells: number[]; overlays: number[] } {
  const b = new MapBuilder();
  bp.paint(b);
  switch (bp.symmetry ?? "x") {
    case "x":
      b.mirrorX();
      break;
    case "y":
      b.mirrorY();
      break;
    case "xy":
      b.mirrorX();
      b.mirrorY();
      break;
    case "rot4":
      b.mirrorRot4();
      break;
    case "none":
      break;
  }
  b.scrubOverlayNeighborhoods();
  b.clearAroundOverlays();
  b.applyOpenDenseFill(bp.variant ?? 0, bp.mode === "gemgrab");
  b.scrubOverlayNeighborhoods();
  b.clearAroundOverlays();
  b.carveAxisCorridors();
  b.purgeUnreachableCover();
  return { cells: b.cells, overlays: b.overlays };
}

export function buildCuratedMapSave(bp: CuratedBlueprint, now = Date.now()): MapSave {
  const { cells, overlays } = buildBlueprint(bp);
  return {
    id: bp.id,
    name: bp.name,
    mode: bp.mode,
    cells,
    overlays,
    rotations: new Array(GS * GS).fill(0),
    createdAt: now,
    updatedAt: now,
  };
}

export function buildAllCuratedMaps(now = Date.now()): MapSave[] {
  return CURATED_BLUEPRINTS.map(bp => buildCuratedMapSave(bp, now));
}

/** Validate all curated maps at build/seed time — throws on first invalid map. */
export function assertCuratedMapsValid(): void {
  const errors: string[] = [];
  for (const bp of CURATED_BLUEPRINTS) {
    const { cells, overlays } = buildBlueprint(bp);
    const result = validateMap(cells, overlays, bp.mode);
    if (!result.ok) {
      errors.push(`${bp.id} (${bp.name}): ${result.errors.join("; ")}`);
    }
    try {
      assertDensityInRange(cells, bp.id);
    } catch (e) {
      errors.push(String(e));
    }
  }
  if (errors.length > 0) {
    throw new Error(`Invalid curated maps:\n${errors.join("\n")}`);
  }
}

export const CURATED_MAPS_BY_MODE: Record<EditorMode, string[]> = {
  showdown: SHOWDOWN_NAMES.map((_, i) => `curated_sd_${String(i + 1).padStart(2, "0")}`),
  gemgrab: GEMGRAB_NAMES.map((_, i) => `curated_gg_${String(i + 1).padStart(2, "0")}`),
  heist: HEIST_NAMES.map((_, i) => `curated_hs_${String(i + 1).padStart(2, "0")}`),
  bounty: BOUNTY_NAMES.map((_, i) => `curated_bn_${String(i + 1).padStart(2, "0")}`),
  starstrike: STARSTRIKE_NAMES.map((_, i) => `curated_ss_${String(i + 1).padStart(2, "0")}`),
  siege: SIEGE_NAMES.map((_, i) => `curated_sg_${String(i + 1).padStart(2, "0")}`),
  bossraid: BOSSRAID_NAMES.map((_, i) => `curated_br_${String(i + 1).padStart(2, "0")}`),
};

export const CURATED_MAP_NAMES: Record<EditorMode, string[]> = {
  showdown: SHOWDOWN_NAMES,
  gemgrab: GEMGRAB_NAMES,
  heist: HEIST_NAMES,
  bounty: BOUNTY_NAMES,
  starstrike: STARSTRIKE_NAMES,
  siege: SIEGE_NAMES,
  bossraid: BOSSRAID_NAMES,
};
