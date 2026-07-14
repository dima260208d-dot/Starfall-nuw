import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "../src/data/curatedMaps/denseFill.ts");

const content = `import {
  MapBuilder,
  Tile as T,
  PLAY_LO,
  PLAY_HI,
  CX,
  CY,
  GS,
} from "./mapBuilder";

const PLAY_W = PLAY_HI - PLAY_LO + 1;
const PLAY_CELLS = PLAY_W * PLAY_W;

export function measureFillRatio(cells: number[]): number {
  let filled = 0;
  for (let y = PLAY_LO; y <= PLAY_HI; y++) {
    for (let x = PLAY_LO; x <= PLAY_HI; x++) {
      if (cells[y * GS + x] !== T.GRASS) filled++;
    }
  }
  return filled / PLAY_CELLS;
}

function hash(x: number, y: number, seed: number): number {
  return ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) >>> 0;
}

const DENSE_PALETTE = [
  T.WALL, T.WALL, T.WALL,
  T.BUSH, T.BUSH, T.BUSH,
  T.DECORATION, T.DECORATION,
  T.FENCE, T.SAND_WALL,
  T.CACTUS, T.TREE,
  T.WOOD, T.FLOWERBED,
  T.WATER,
];

function pickDenseTile(x: number, y: number, seed: number, variant: number): number {
  const h = hash(x, y, seed + variant * 997);
  let tile = DENSE_PALETTE[h % DENSE_PALETTE.length];
  if (variant % 4 === 0 && tile === T.WATER) tile = T.BUSH;
  if (variant % 4 === 1 && tile === T.BUSH) tile = T.WALL;
  if (variant % 4 === 2 && tile === T.WALL) tile = T.SAND_WALL;
  if (variant % 4 === 3 && tile === T.CACTUS) tile = T.DECORATION;
  return tile;
}

export function paintDenseBlockGrid(
  b: MapBuilder,
  variant: number,
  opts: { leftHalfOnly?: boolean; quadrantOnly?: boolean; corridorMod?: number } = {},
): void {
  const corridorMod = opts.corridorMod ?? 3;
  const xMax = opts.quadrantOnly ? CX : opts.leftHalfOnly !== false ? CX : PLAY_HI;
  const yMax = opts.quadrantOnly ? CY : PLAY_HI;
  for (let y = PLAY_LO; y <= yMax; y++) {
    for (let x = PLAY_LO; x <= xMax; x++) {
      const corridorX = (x - PLAY_LO) % corridorMod === 1;
      const corridorY = (y - PLAY_LO) % corridorMod === 1;
      if (corridorX || corridorY) continue;
      if (!b.canPaint(x, y)) continue;
      b.set(x, y, pickDenseTile(x, y, 11, variant));
    }
  }
}

export function paintDenseRim(b: MapBuilder, depth: number, variant: number): void {
  for (let d = 0; d < depth; d++) {
    const tile = d % 2 === 0 ? T.BUSH : T.WALL;
    b.hline(PLAY_LO + d, PLAY_LO + d, PLAY_W - d * 2, tile);
    b.hline(PLAY_LO + d, PLAY_HI - d, PLAY_W - d * 2, tile);
    b.vline(PLAY_LO + d, PLAY_LO + d, PLAY_W - d * 2, tile);
    b.vline(PLAY_HI - d, PLAY_LO + d, PLAY_W - d * 2, tile);
  }
}

export function paintDenseDiagonals(b: MapBuilder, variant: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const sx = PLAY_LO + 2 + (i * 5) % 14;
    const sy = PLAY_LO + 2 + (i * 7) % 14;
    const steps = 5 + (variant + i) % 4;
    for (let s = 0; s < steps; s++) {
      if (b.canPaint(sx + s, sy + s)) b.set(sx + s, sy + s, T.WALL);
      if (b.canPaint(sx + s, sy + s + 1)) b.set(sx + s, sy + s + 1, T.BUSH);
    }
  }
}

export function paintDenseClusters(b: MapBuilder, variant: number, clusterCount: number): void {
  for (let i = 0; i < clusterCount; i++) {
    const h = hash(i, variant, 41);
    const x = PLAY_LO + 2 + (h % 16);
    const y = PLAY_LO + 2 + ((h >> 4) % 16);
    const w = 2 + (h % 2);
    const hgt = 2 + ((h >> 8) % 2);
    const wall = (h % 3 === 0) ? T.SAND_WALL : T.WALL;
    b.rect(x, y, w, hgt, wall);
    b.hline(x - 1, y, w + 2, T.BUSH);
    b.vline(x + w, y - 1, hgt + 2, T.BUSH);
  }
}

export function paintDenseWaterPools(b: MapBuilder, variant: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const h = hash(i + 7, variant, 53);
    const x = PLAY_LO + 4 + (h % 12);
    const y = PLAY_LO + 4 + ((h >> 5) % 12);
    b.waterRect(x, y, 2 + (h % 3), 2 + ((h >> 3) % 2));
  }
}

export function topUpDensity(b: MapBuilder, target: number, seed: number): void {
  const targetClamped = Math.max(0.6, Math.min(0.9, target));
  const need = Math.floor(PLAY_CELLS * targetClamped);
  let filled = 0;
  const grassCells: [number, number][] = [];
  for (let y = PLAY_LO; y <= PLAY_HI; y++) {
    for (let x = PLAY_LO; x <= PLAY_HI; x++) {
      if (b.cells[b.idx(x, y)] !== T.GRASS) filled++;
      else if (b.canPaint(x, y)) grassCells.push([x, y]);
    }
  }
  if (filled >= need) return;
  grassCells.sort((a, b2) => hash(a[0], a[1], seed) - hash(b2[0], b2[1], seed));
  for (const [x, y] of grassCells) {
    if (filled >= need) break;
    if (b.cells[b.idx(x, y)] !== T.GRASS) continue;
    if (!b.canPaint(x, y)) continue;
    b.set(x, y, pickDenseTile(x, y, seed, seed % 10));
    filled++;
  }
}

export function applyDenseBaseLayer(
  b: MapBuilder,
  variant: number,
  mode: "showdown" | "team" | "boss",
): void {
  const corridor = 2 + (variant % 2);
  if (mode === "showdown") {
    paintDenseRim(b, 2 + (variant % 2), variant);
    paintDenseBlockGrid(b, variant, { quadrantOnly: true, corridorMod: corridor });
    paintDenseDiagonals(b, variant, 4 + (variant % 3));
    paintDenseWaterPools(b, variant, 2 + (variant % 2));
  } else if (mode === "boss") {
    paintDenseBlockGrid(b, variant, { leftHalfOnly: true, corridorMod: corridor });
    paintDenseClusters(b, variant, 8 + (variant % 4));
    paintDenseDiagonals(b, variant, 3);
  } else {
    paintDenseRim(b, 1, variant);
    paintDenseBlockGrid(b, variant, { leftHalfOnly: true, corridorMod: corridor });
    paintDenseClusters(b, variant, 6 + (variant % 5));
    paintDenseWaterPools(b, variant, 1 + (variant % 3));
    paintDenseDiagonals(b, variant, 3 + (variant % 2));
  }
}

export function targetDensityForVariant(variant: number): number {
  return 0.6 + ((variant * 17 + 13) % 31) / 100;
}

export function finalizeMapDensity(b: MapBuilder, variant: number): void {
  topUpDensity(b, targetDensityForVariant(variant), variant * 131 + 7);
}

export function assertDensityInRange(cells: number[], id: string, min = 0.6, max = 0.9): void {
  const ratio = measureFillRatio(cells);
  if (ratio < min || ratio > max) {
    throw new Error(\`\${id}: fill \${(ratio * 100).toFixed(1)}% (need \${min * 100}-\${max * 100}%)\`);
  }
}
`;

fs.writeFileSync(p, content, "utf8");
console.log("OK", p);

// ── Fix curated map index / circular import / seed ──
const root = path.join(__dirname, "../src/data/curatedMaps");
for (const f of ["index.ts", "mapBuilder.ts", "layouts.ts"]) {
  const fp = path.join(root, f);
  const b = fs.readFileSync(fp);
  if (b[1] === 0) fs.writeFileSync(fp, b.toString("utf16le"), "utf8");
}

let idx = fs.readFileSync(path.join(root, "index.ts"), "utf8");
idx = idx.replace("  buildBlueprint,\n  type CuratedBlueprint,", "  MapBuilder,\n  type CuratedBlueprint,");
idx = idx.replace(
  'import { applyDenseBaseLayer, assertDensityInRange } from "./denseFill";',
  'import { applyDenseBaseLayer, assertDensityInRange, finalizeMapDensity } from "./denseFill";',
);
if (!idx.includes("export function buildBlueprint")) {
  const fn = `
export function buildBlueprint(bp: CuratedBlueprint): { cells: number[]; overlays: number[] } {
  const b = new MapBuilder();
  bp.paint(b);
  switch (bp.symmetry ?? "x") {
    case "x": b.mirrorX(); break;
    case "y": b.mirrorY(); break;
    case "xy": b.mirrorX(); b.mirrorY(); break;
    case "rot4": b.mirrorRot4(); break;
    case "none": break;
  }
  if (bp.variant != null) finalizeMapDensity(b, bp.variant);
  b.clearAroundOverlays();
  return { cells: b.cells, overlays: b.overlays };
}

`;
  idx = idx.replace("export function buildCuratedMapSave", fn + "export function buildCuratedMapSave");
}
fs.writeFileSync(path.join(root, "index.ts"), idx, "utf8");

let mb = fs.readFileSync(path.join(root, "mapBuilder.ts"), "utf8");
mb = mb.replace('import { finalizeMapDensity } from "./denseFill";\n', "");
const cut = mb.indexOf("export function buildBlueprint");
if (cut >= 0) {
  mb = mb.slice(0, mb.indexOf("export interface CuratedBlueprint")) +
    mb.slice(mb.indexOf("export interface CuratedBlueprint"), cut);
}
fs.writeFileSync(path.join(root, "mapBuilder.ts"), mb, "utf8");

const densePath = path.join(root, "denseFill.ts");
let d = fs.readFileSync(densePath, "utf8");
const needle = "    if (!b.canPaint(x, y)) continue;\n    b.set(x, y, pickDenseTile";
if (d.includes(needle) && !d.includes("% 3 === 1")) {
  d = d.replace(
    needle,
    "    if (!b.canPaint(x, y)) continue;\n    if ((x - PLAY_LO) % 3 === 1 || (y - PLAY_LO) % 3 === 1) continue;\n    b.set(x, y, pickDenseTile",
  );
  fs.writeFileSync(densePath, d, "utf8");
}

const seed = `import {
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
    const idx2 = merged.findIndex(m => m.id === map.id);
    if (idx2 >= 0) merged[idx2] = map;
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
`;
fs.writeFileSync(path.join(__dirname, "../src/utils/curatedMapSeed.ts"), seed, "utf8");
console.log("Fixed curated maps pipeline");
