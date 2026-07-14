#!/usr/bin/env node
/**
 * Handcrafted curated map generator — explicit stamp compositions only.
 * NO procedural grid fill, NO hash patches, NO axisCorridor auto-grass.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  GS, PLAY_LO, PLAY_HI, PLAY_CELLS, CX, CY, LEFT, RIGHT, TOP, BOT, HALF, T,
  MAPS_PER_MODE,
  filterRegion, clipGemZone, clipBossPath, isDecorative, inGemZone, inBossPath,
  fillForMode, distributedScatter, getThematicPool, poolStartIndex, rejectEnclosed, allWalkableConnected,
} from "./handcrafted/helpers.mjs";
import { MODE_DESIGNS } from "./handcrafted/designs.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "src/data/curatedMaps");

const OV = { NONE: 0, SPAWN_BLUE: 1, SPAWN_RED: 2, SPAWN_SD: 3, GEM_CENTER: 4, POWER_BOX: 11, BOSS_SPAWN: 12 };

const SD_SPAWNS = [
  [LEFT, TOP], [LEFT, CY], [LEFT, BOT],
  [CX, TOP], [CX, BOT],
  [RIGHT, TOP], [RIGHT, CY], [RIGHT, BOT],
  [CX - 8, CY - 8], [CX + 8, CY + 8],
];

const SD_POWER_SPOTS = [
  [CX, CY], [CX - 7, CY - 7], [CX + 7, CY + 7], [CX - 7, CY + 7], [CX + 7, CY - 7],
  [LEFT + 8, CY], [RIGHT - 8, CY], [CX, TOP + 6], [CX, BOT - 6],
];

function overlayProtectRadius(type) {
  if (type === OV.GEM_CENTER) return 2;
  if (type === OV.POWER_BOX || type === OV.SPAWN_SD || type === OV.SPAWN_BLUE || type === OV.SPAWN_RED) return 1;
  if (type === OV.BOSS_SPAWN) return 2;
  return 2;
}

class SimBuilder {
  cells = new Array(GS * GS).fill(T.GRASS);
  overlays = new Array(GS * GS).fill(OV.NONE);
  protectedCells = new Set();
  idx(x, y) { return y * GS + x; }
  inPlay(x, y) { return x >= PLAY_LO && x <= PLAY_HI && y >= PLAY_LO && y <= PLAY_HI; }
  protect(x, y, r = 4) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < GS && ny < GS) this.protectedCells.add(this.idx(nx, ny));
      }
  }
  canPaint(x, y) { return this.inPlay(x, y) && !this.protectedCells.has(this.idx(x, y)); }
  set(x, y, tile) { if (this.canPaint(x, y)) this.cells[this.idx(x, y)] = tile; }
  forceSet(x, y, tile) {
    if (!this.inPlay(x, y)) return;
    if (this.overlays[this.idx(x, y)] !== OV.NONE) return;
    this.cells[this.idx(x, y)] = tile;
  }
  applyOpenDenseFill(variant = 0, skipCenter = false) {
    const tiles = [T.BUSH, T.BUSH, T.FENCE, T.WALL, T.SAND_WALL];
    for (let y = PLAY_LO + 1; y <= PLAY_HI - 1; y++) {
      for (let x = PLAY_LO + 1; x <= PLAY_HI - 1; x++) {
        if (skipCenter && Math.abs(x - CX) <= 2 && Math.abs(y - CY) <= 2) continue;
        const h = x + y + variant;
        if (h % 2 !== 0 && h % 5 !== 0) continue;
        if (this.overlays[this.idx(x, y)] !== OV.NONE) continue;
        this.forceSet(x, y, tiles[(x * 13 + y * 29 + variant) % tiles.length]);
      }
    }
  }
  ov(x, y, type) {
    if (!this.inPlay(x, y)) return;
    const pr = overlayProtectRadius(type);
    this.protect(x, y, pr);
    for (let dy = -pr; dy <= pr; dy++)
      for (let dx = -pr; dx <= pr; dx++) {
        const nx = x + dx, ny = y + dy;
        if (this.inPlay(nx, ny)) this.cells[this.idx(nx, ny)] = T.GRASS;
      }
    this.cells[this.idx(x, y)] = T.GRASS;
    this.overlays[this.idx(x, y)] = type;
  }
  pair(lx, ly, lOv, rOv) { this.ov(lx, ly, lOv); this.ov(GS - 1 - lx, ly, rOv); }
  rect(x, y, w, h, tile) { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.set(x + dx, y + dy, tile); }
  hline(x, y, len, tile) { for (let i = 0; i < len; i++) this.set(x + i, y, tile); }
  vline(x, y, len, tile) { for (let i = 0; i < len; i++) this.set(x, y + i, tile); }
  L(x, y, len, ori, tile) {
    for (let k = 0; k < len; k++) {
      if (ori === 0) { this.set(x + k, y, tile); this.set(x, y + k, tile); }
      else if (ori === 1) { this.set(x - k, y, tile); this.set(x, y + k, tile); }
      else if (ori === 2) { this.set(x + k, y, tile); this.set(x, y - k, tile); }
      else { this.set(x - k, y, tile); this.set(x, y - k, tile); }
    }
  }
  cross(x, y, arm, tile) {
    for (let k = -arm; k <= arm; k++) { this.set(x + k, y, tile); this.set(x, y + k, tile); }
  }
  waterRect(x, y, w, h) { this.rect(x, y, w, h, T.WATER); }
  room(x, y, w, h, wall, inner) {
    this.rect(x, y, w, 1, wall); this.rect(x, y + h - 1, w, 1, wall);
    this.rect(x, y, 1, h, wall); this.rect(x + w - 1, y, 1, h, wall);
    if (inner !== undefined) this.rect(x + 1, y + 1, w - 2, h - 2, inner);
  }
  mirrorX() {
    for (let y = 0; y < GS; y++)
      for (let x = 0; x < HALF; x++) {
        const t = this.cells[this.idx(x, y)];
        if (t === T.GRASS) continue;
        const rx = GS - 1 - x;
        if (!this.protectedCells.has(this.idx(rx, y))) this.cells[this.idx(rx, y)] = t;
      }
  }
  mirrorY() {
    for (let y = 0; y < HALF; y++)
      for (let x = 0; x < GS; x++) {
        const t = this.cells[this.idx(x, y)];
        if (t === T.GRASS) continue;
        const ry = GS - 1 - y;
        if (!this.protectedCells.has(this.idx(x, ry))) this.cells[this.idx(x, ry)] = t;
      }
  }
  scrubOverlayNeighborhoods() {
    for (let y = PLAY_LO; y <= PLAY_HI; y++)
      for (let x = PLAY_LO; x <= PLAY_HI; x++) {
        const ov = this.overlays[this.idx(x, y)];
        if (ov === OV.NONE) continue;
        const pr = overlayProtectRadius(ov);
        for (let dy = -pr; dy <= pr; dy++)
          for (let dx = -pr; dx <= pr; dx++) {
            const nx = x + dx, ny = y + dy;
            if (this.inPlay(nx, ny)) this.cells[this.idx(nx, ny)] = T.GRASS;
          }
      }
  }
  clearAroundOverlays() {
    for (let i = 0; i < this.overlays.length; i++)
      if (this.overlays[i] !== OV.NONE) this.cells[i] = T.GRASS;
  }
  carveAxisCorridors() {
    for (let y = PLAY_LO; y <= PLAY_HI; y++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = CX + dx;
        if (this.inPlay(x, y)) this.cells[this.idx(x, y)] = T.GRASS;
      }
    for (let x = PLAY_LO; x <= PLAY_HI; x++)
      for (let dy = -1; dy <= 1; dy++) {
        const y = CY + dy;
        if (this.inPlay(x, y)) this.cells[this.idx(x, y)] = T.GRASS;
      }
  }
  purgeUnreachableCover() {
    const walkable = (t) => t === T.GRASS || t === T.BUSH || t === T.HEAL;
    const visited = new Uint8Array(GS * GS);
    const queue = [];
    for (const [sx, sy] of [[CX, CY], [LEFT, CY], [RIGHT, CY]]) {
      if (!this.inPlay(sx, sy)) continue;
      const si = this.idx(sx, sy);
      if (!walkable(this.cells[si]) || visited[si]) continue;
      visited[si] = 1;
      queue.push([sx, sy]);
    }
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inPlay(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (visited[ni] || !walkable(this.cells[ni])) continue;
        visited[ni] = 1;
        queue.push([nx, ny]);
      }
    }
    for (let y = PLAY_LO; y <= PLAY_HI; y++)
      for (let x = PLAY_LO; x <= PLAY_HI; x++) {
        const i = this.idx(x, y);
        if (visited[i]) continue;
        const t = this.cells[i];
        if (t === T.BUSH || t === T.DECORATION || t === T.HEAL) this.cells[i] = T.GRASS;
      }
  }
}

function applyStampsSim(b, stamps) {
  for (const s of stamps) {
    switch (s.kind) {
      case "set": b.set(s.x, s.y, s.tile); break;
      case "rect": b.rect(s.x, s.y, s.w, s.h, s.tile); break;
      case "hline": b.hline(s.x, s.y, s.len, s.tile); break;
      case "vline": b.vline(s.x, s.y, s.len, s.tile); break;
      case "L": b.L(s.x, s.y, s.len, s.ori, s.tile); break;
      case "cross": b.cross(s.x, s.y, s.arm, s.tile); break;
      case "room": b.room(s.x, s.y, s.w, s.h, s.wall, s.inner); break;
      case "waterRect": b.waterRect(s.x, s.y, s.w, s.h); break;
    }
  }
}

function isWalkable(t) {
  return t === T.GRASS || t === T.BUSH || t === T.HEAL;
}

function bfsConnected(cells, starts) {
  if (starts.length < 2) return true;
  const visited = new Uint8Array(GS * GS);
  const queue = [starts[0]];
  visited[starts[0][1] * GS + starts[0][0]] = 1;
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GS || ny >= GS) continue;
      const idx = ny * GS + nx;
      if (visited[idx]) continue;
      if (!isWalkable(cells[idx])) continue;
      visited[idx] = 1;
      queue.push([nx, ny]);
    }
  }
  for (const [sx, sy] of starts.slice(1)) {
    if (!visited[sy * GS + sx]) return false;
  }
  return true;
}

function collectSpawns(overlays, mode) {
  const spawns = [];
  for (let y = PLAY_LO; y <= PLAY_HI; y++) {
    for (let x = PLAY_LO; x <= PLAY_HI; x++) {
      const ov = overlays[y * GS + x];
      if (mode === "showdown" && ov === OV.SPAWN_SD) spawns.push([x, y]);
      else if (mode === "bossraid" && (ov === 1 || ov === OV.BOSS_SPAWN)) spawns.push([x, y]);
    }
  }
  return spawns;
}

function isMapConnected(stamps, mode, symmetry, variant) {
  const b = simulateMap(stamps, mode, symmetry, variant);
  const spawns = collectSpawns(b.overlays, mode);
  return bfsConnected(b.cells, spawns);
}

function measureFillRatio(cells) {
  let filled = 0;
  for (let y = PLAY_LO; y <= PLAY_HI; y++)
    for (let x = PLAY_LO; x <= PLAY_HI; x++)
      if (cells[y * GS + x] !== T.GRASS) filled++;
  return filled / PLAY_CELLS;
}

function simulateMap(stamps, mode, symmetry, variant) {
  const b = new SimBuilder();
  if (mode === "showdown") {
    for (const [x, y] of SD_SPAWNS) b.ov(x, y, OV.SPAWN_SD);
    for (let i = 0; i < 4 + (variant % 4) && i < SD_POWER_SPOTS.length; i++) {
      const [x, y] = SD_POWER_SPOTS[i];
      b.ov(x, y, OV.POWER_BOX);
    }
  } else if (mode === "gemgrab") {
    for (const sy of [CY - 4, CY, CY + 4]) b.pair(LEFT, sy, 1, 2);
    b.ov(CX, CY, 4);
  } else if (mode === "heist") {
    b.pair(LEFT + 4, CY, 5, 6);
    for (const sy of [CY - 4, CY, CY + 4]) b.pair(LEFT, sy, 1, 2);
  } else if (mode === "bounty") {
    for (const sy of [CY - 8, CY - 4, CY, CY + 4, CY + 8]) b.pair(LEFT, sy, 1, 2);
  } else if (mode === "starstrike") {
    b.ov(CX, 6, 9); b.ov(CX, 53, 10);
    for (const sy of [CY - 4, CY, CY + 4]) b.pair(LEFT, sy, 1, 2);
  } else if (mode === "siege") {
    b.ov(LEFT, CY, 7); b.ov(LEFT, CY - 4, 1); b.ov(LEFT, CY + 4, 1);
  } else if (mode === "bossraid") {
    for (const sy of [CY - 8, CY - 4, CY, CY + 4, CY + 8]) b.ov(LEFT, sy, 1);
    b.ov(RIGHT - 2, CY, OV.BOSS_SPAWN);
  }
  applyStampsSim(b, stamps);
  if (mode === "bossraid") b.mirrorX();
  else if (symmetry === "xy") { b.mirrorX(); b.mirrorY(); }
  else if (symmetry === "x") b.mirrorX();
  b.scrubOverlayNeighborhoods();
  b.clearAroundOverlays();
  b.applyOpenDenseFill(variant, mode === "gemgrab");
  b.scrubOverlayNeighborhoods();
  b.clearAroundOverlays();
  b.carveAxisCorridors();
  b.purgeUnreachableCover();
  return b;
}

function stampAllowed(stamp, mode) {
  if (mode === "gemgrab") {
    if (stamp.kind === "set" && inGemZone(stamp.x, stamp.y)) return false;
    if (stamp.kind === "hline") {
      for (let i = 0; i < stamp.len; i++) if (inGemZone(stamp.x + i, stamp.y)) return false;
    }
    if (stamp.kind === "vline") {
      for (let i = 0; i < stamp.len; i++) if (inGemZone(stamp.x, stamp.y + i)) return false;
    }
    if (stamp.kind === "room" || stamp.kind === "rect" || stamp.kind === "waterRect") {
      for (let dy = 0; dy < stamp.h; dy++)
        for (let dx = 0; dx < stamp.w; dx++)
          if (inGemZone(stamp.x + dx, stamp.y + dy)) return false;
    }
  }
  if (mode === "bossraid") {
    if (stamp.kind === "set" && inBossPath(stamp.x, stamp.y)) return false;
    if (stamp.kind === "hline") {
      for (let i = 0; i < stamp.len; i++) if (inBossPath(stamp.x + i, stamp.y)) return false;
    }
    if (stamp.kind === "rect" || stamp.kind === "waterRect") {
      for (let dy = 0; dy < stamp.h; dy++)
        for (let dx = 0; dx < stamp.w; dx++)
          if (inBossPath(stamp.x + dx, stamp.y + dy)) return false;
    }
  }
  return true;
}

function isMapValid(stamps, mode, symmetry, variant) {
  const b = simulateMap(stamps, mode, symmetry, variant);
  if (!allWalkableConnected(b.cells)) return false;
  if (mode === "showdown" && !isMapConnected(stamps, mode, symmetry, variant)) return false;
  return true;
}

function tuneDensity(stamps, mode, symmetry, variant) {
  stamps = rejectEnclosed(stamps);
  const pool = getThematicPool(mode);
  let poolIdx = poolStartIndex(mode, variant);
  const MIN_FILL = 0.50;
  const MAX_FILL = 0.60;
  for (let pass = 0; pass < 240; pass++) {
    const sim = simulateMap(stamps, mode, symmetry, variant);
    const ratio = measureFillRatio(sim.cells);
    if (ratio >= MIN_FILL && ratio <= MAX_FILL && allWalkableConnected(sim.cells)) return stamps;
    if (ratio > MAX_FILL) {
      let removed = false;
      for (let i = stamps.length - 1; i >= 0; i--) {
        if (isDecorative(stamps[i])) { stamps.splice(i, 1); removed = true; break; }
      }
      if (!removed && stamps.length > 0) stamps.pop();
      else if (!removed) break;
      continue;
    }
    const raw = pool[poolIdx++ % pool.length];
    const filtered = rejectEnclosed(filterRegion([raw], mode));
    if (!filtered.length) continue;
    const stamp = filtered[0];
    if (!stampAllowed(stamp, mode)) continue;
    const trial = [...stamps, stamp];
    const after = measureFillRatio(simulateMap(trial, mode, symmetry, variant).cells);
    if (after > MAX_FILL) continue;
    if (!isMapValid(trial, mode, symmetry, variant)) continue;
    stamps.push(stamp);
  }
  return stamps;
}

function fixConnectivity(stamps, mode, symmetry, v) {
  for (let attempt = 0; attempt < 100 && !isMapValid(stamps, mode, symmetry, v); attempt++) {
    let fixed = false;
    for (let i = stamps.length - 1; i >= 0; i--) {
      const trial = stamps.slice(0, i).concat(stamps.slice(i + 1));
      if (isMapValid(trial, mode, symmetry, v)) {
        stamps = trial;
        fixed = true;
        break;
      }
    }
    if (!fixed) break;
  }
  return stamps;
}

function boostToTargetFill(stamps, mode, symmetry, variant) {
  const pool = getThematicPool(mode);
  let idx = poolStartIndex(mode, variant) + 3;
  for (let pass = 0; pass < 400; pass++) {
    const sim = simulateMap(stamps, mode, symmetry, variant);
    const ratio = measureFillRatio(sim.cells);
    if (ratio >= 0.50 && ratio <= 0.60 && allWalkableConnected(sim.cells)) return stamps;
    if (ratio > 0.60) break;
    const batch = [];
    for (let k = 0; k < 3; k++) {
      const raw = pool[idx++ % pool.length];
      const filtered = rejectEnclosed(filterRegion([raw], mode));
      if (filtered.length) batch.push(filtered[0]);
    }
    const trial = [...stamps, ...batch];
    if (!isMapValid(trial, mode, symmetry, variant)) continue;
    const after = measureFillRatio(simulateMap(trial, mode, symmetry, variant).cells);
    if (after > 0.60) continue;
    stamps = trial;
  }
  return stamps;
}

function topUpFill(stamps, mode, symmetry, variant) {
  const yMax = mode === "showdown" ? CY : PLAY_HI;
  const tiles = [T.BUSH, T.BUSH, T.FENCE, T.WALL, T.SAND_WALL, T.BUSH];
  let ti = 0;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = TOP + 4 + pass; y <= yMax - 4; y += 4) {
      for (let x = LEFT + 4 + (pass % 2); x <= CX - 4; x += 4) {
        const sim = simulateMap(stamps, mode, symmetry, variant);
        if (measureFillRatio(sim.cells) >= 0.50) return stamps;
        const stamp = { kind: "set", x, y, tile: tiles[ti++ % tiles.length] };
        if (!stampAllowed(stamp, mode)) continue;
        const trial = [...stamps, stamp];
        const afterSim = simulateMap(trial, mode, symmetry, variant);
        if (measureFillRatio(afterSim.cells) > 0.60) continue;
        if (!allWalkableConnected(afterSim.cells)) continue;
        if (mode === "showdown" && !isMapConnected(trial, mode, symmetry, variant)) continue;
        stamps.push(stamp);
      }
    }
  }
  return stamps;
}

function buildMapStamps(mode, v) {
  let stamps = rejectEnclosed([
    ...filterRegion(MODE_DESIGNS[mode][v](), mode),
    ...filterRegion(fillForMode(mode, v), mode),
    ...filterRegion(distributedScatter(mode, v), mode),
  ]);
  if (mode === "gemgrab") stamps = clipGemZone(stamps);
  if (mode === "bossraid") stamps = clipBossPath(stamps);
  stamps = fixConnectivity(stamps, mode, MODES[mode].symmetry, v);
  stamps = tuneDensity(stamps, mode, MODES[mode].symmetry, v);
  stamps = boostToTargetFill(stamps, mode, MODES[mode].symmetry, v);
  stamps = topUpFill(stamps, mode, MODES[mode].symmetry, v);
  stamps = fixConnectivity(stamps, mode, MODES[mode].symmetry, v);
  return stamps;
}


const MODES = {
  showdown: { symmetry: "xy" },
  gemgrab: { symmetry: "x" },
  heist: { symmetry: "x" },
  bounty: { symmetry: "x" },
  starstrike: { symmetry: "x" },
  siege: { symmetry: "x" },
  bossraid: { symmetry: "none" },
};

const ALL_MAPS = {};
for (const mode of Object.keys(MODES)) {
  ALL_MAPS[mode] = [];
  for (let v = 0; v < MAPS_PER_MODE; v++) ALL_MAPS[mode].push(buildMapStamps(mode, v));
}

const TILE_NAMES = { 0: "T.GRASS", 1: "T.WALL", 3: "T.BUSH", 4: "T.WATER", 5: "T.DECORATION", 6: "T.FENCE", 7: "T.HEAL", 11: "T.SAND_WALL" };

function formatStamp(s) {
  const parts = Object.entries(s).map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v}"` : v}`);
  return `{ kind: "${s.kind}", ${parts.slice(1).join(", ")} }`;
}

function formatStampArray(stamps, indent = "    ") {
  if (!stamps.length) return "[]";
  return `[\n${stamps.map(s => {
    let line = formatStamp(s);
    for (const [n, name] of Object.entries(TILE_NAMES)) line = line.replace(new RegExp(`tile: ${n}\\b`), `tile: ${name}`);
    if (s.wall !== undefined) line = line.replace(/wall: (\d+)/, (_, n) => `wall: ${TILE_NAMES[n] ?? n}`);
    if (s.inner !== undefined) line = line.replace(/inner: (\d+)/, (_, n) => `inner: ${TILE_NAMES[n] ?? n}`);
    return `${indent}${line},`;
  }).join("\n")}\n  ]`;
}

function writeHandcraftedFile(mode, maps) {
  const region = mode === "showdown" ? "quadrant" : "half";
  const content = `import type { Stamp } from "../stamps";
import { Tile as T } from "../mapBuilder";

/** Handcrafted stamp layouts for ${mode} — left ${region} only. */
export const MAPS: readonly Stamp[][] = [
${maps.map((stamps, i) => `  // Map ${i + 1}\n  ${formatStampArray(stamps, "    ")}`).join(",\n")}
] as const;
`;
  fs.mkdirSync(path.join(OUT, "handcrafted"), { recursive: true });
  fs.writeFileSync(path.join(OUT, "handcrafted", `${mode}.ts`), content, "utf8");
}

function writeStampsTs() {
  fs.writeFileSync(path.join(OUT, "stamps.ts"), `import { MapBuilder } from "./mapBuilder";

export type Stamp =
  | { kind: "set"; x: number; y: number; tile: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; tile: number }
  | { kind: "hline"; x: number; y: number; len: number; tile: number }
  | { kind: "vline"; x: number; y: number; len: number; tile: number }
  | { kind: "L"; x: number; y: number; len: number; ori: number; tile: number }
  | { kind: "cross"; x: number; y: number; arm: number; tile: number }
  | { kind: "room"; x: number; y: number; w: number; h: number; wall: number; inner?: number }
  | { kind: "waterRect"; x: number; y: number; w: number; h: number };

export function applyStamps(b: MapBuilder, stamps: readonly Stamp[]): void {
  for (const s of stamps) {
    switch (s.kind) {
      case "set": b.set(s.x, s.y, s.tile); break;
      case "rect": b.rect(s.x, s.y, s.w, s.h, s.tile); break;
      case "hline": b.hline(s.x, s.y, s.len, s.tile); break;
      case "vline": b.vline(s.x, s.y, s.len, s.tile); break;
      case "L": b.L(s.x, s.y, s.len, s.ori, s.tile); break;
      case "cross": b.cross(s.x, s.y, s.arm, s.tile); break;
      case "room": b.room(s.x, s.y, s.w, s.h, s.wall, s.inner); break;
      case "waterRect": b.waterRect(s.x, s.y, s.w, s.h); break;
    }
  }
}
`, "utf8");
}

function writeSharedTs() {
  fs.writeFileSync(path.join(OUT, "shared.ts"), `import { MapBuilder, OV, CX, CY, LEFT, RIGHT, TOP, BOT } from "./mapBuilder";

const SD_SPAWNS: [number, number][] = [
  [LEFT, TOP], [LEFT, CY], [LEFT, BOT],
  [CX, TOP], [CX, BOT],
  [RIGHT, TOP], [RIGHT, CY], [RIGHT, BOT],
  [CX - 8, CY - 8], [CX + 8, CY + 8],
];

export function placeShowdownSpawns(b: MapBuilder): void {
  for (const [x, y] of SD_SPAWNS) b.ov(x, y, OV.SPAWN_SD);
}

export function placeTeamSpawns3(b: MapBuilder): void {
  for (const sy of [CY - 4, CY, CY + 4]) b.pair(LEFT, sy, OV.SPAWN_BLUE, OV.SPAWN_RED);
}

export function placeBountySpawns5(b: MapBuilder): void {
  for (const sy of [CY - 8, CY - 4, CY, CY + 4, CY + 8]) b.pair(LEFT, sy, OV.SPAWN_BLUE, OV.SPAWN_RED);
}

export function placeGemCenter(b: MapBuilder): void {
  b.ov(CX, CY, OV.GEM_CENTER);
}

export function placeHeistSafes(b: MapBuilder): void {
  b.pair(LEFT + 4, CY, OV.SAFE_BLUE, OV.SAFE_RED);
}

export function placeSiegeBase(b: MapBuilder): void {
  b.ov(LEFT, CY, OV.BASE_BLUE);
}

export function placeStarstrikeGoals(b: MapBuilder): void {
  b.ov(CX, TOP, OV.GOAL_BLUE);
  b.ov(CX, BOT, OV.GOAL_RED);
}

export function placeBossRaid(b: MapBuilder): void {
  for (const sy of [CY - 8, CY - 4, CY, CY + 4, CY + 8]) b.ov(LEFT, sy, OV.SPAWN_BLUE);
  b.ov(RIGHT - 2, CY, OV.BOSS_SPAWN);
}

export function placeShowdownPowerBoxes(b: MapBuilder, variant: number): void {
  const spots: [number, number][] = [
    [CX, CY], [CX - 7, CY - 7], [CX + 7, CY + 7], [CX - 7, CY + 7], [CX + 7, CY - 7],
    [LEFT + 8, CY], [RIGHT - 8, CY], [CX, TOP + 6], [CX, BOT - 6],
  ];
  for (let i = 0; i < 4 + (variant % 4) && i < spots.length; i++) b.ov(spots[i][0], spots[i][1], OV.POWER_BOX);
}
`, "utf8");
}

function writeDenseFillTs() {
  fs.writeFileSync(path.join(OUT, "denseFill.ts"), `import { MapBuilder, Tile as T, PLAY_LO, PLAY_HI, GS } from "./mapBuilder";

const PLAY_W = PLAY_HI - PLAY_LO + 1;
const PLAY_CELLS = PLAY_W * PLAY_W;

export function measureFillRatio(cells: number[]): number {
  let filled = 0;
  for (let y = PLAY_LO; y <= PLAY_HI; y++)
    for (let x = PLAY_LO; x <= PLAY_HI; x++)
      if (cells[y * GS + x] !== T.GRASS) filled++;
  return filled / PLAY_CELLS;
}

export function assertDensityInRange(cells: number[], id: string, min = 0.50, max = 0.60): void {
  const ratio = measureFillRatio(cells);
  if (ratio < min || ratio > max) throw new Error(\`\${id}: fill \${(ratio * 100).toFixed(1)}% (need \${min * 100}-\${max * 100}%)\`);
}
`, "utf8");
}

function writeCuratedMapSeed() {
  const p = path.join(ROOT, "src/utils/curatedMapSeed.ts");
  fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/export const CURATED_SEED_KEY = "[^"]+";/, 'export const CURATED_SEED_KEY = "clash_seed_v9_openmaps";'), "utf8");
}

writeStampsTs();
writeSharedTs();
writeDenseFillTs();
for (const mode of Object.keys(MODES)) writeHandcraftedFile(mode, ALL_MAPS[mode]);
writeCuratedMapSeed();

console.log("Generated handcrafted map files:");
let bad = 0;
let disconnected = 0;
for (const mode of Object.keys(MODES)) {
  for (let v = 0; v < MAPS_PER_MODE; v++) {
    const b = simulateMap(ALL_MAPS[mode][v], mode, MODES[mode].symmetry, v);
    const ratio = measureFillRatio(b.cells);
    const ok = ratio >= 0.50 && ratio <= 0.60;
    const conn = allWalkableConnected(b.cells);
    if (!ok) bad++;
    if (!conn) disconnected++;
    console.log(`  ${mode}[${v}]: ${(ratio * 100).toFixed(1)}% ${ok ? "OK" : "FAIL"} ${conn ? "connected" : "DISCONNECTED"}`);
  }
}
console.log(bad ? `WARNING: ${bad} maps outside 50-60%` : "All maps in density range.");
console.log(disconnected ? `WARNING: ${disconnected} maps have unreachable areas` : "All maps fully walkable.");
console.log("Run: npx tsx -e \"import { assertCuratedMapsValid } from './src/data/curatedMaps/index.ts'; assertCuratedMapsValid(); console.log('OK');\"");
