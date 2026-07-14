// ─────────────────────────────────────────────────────────────────────────────
// maps.mjs — tile maps for server-authoritative battles.
// The Gem Grab map is a 20×20 grid with 180° rotational symmetry (fair for both
// teams). Cells: 0 empty, 1 wall (blocks movement + projectiles), 2 bush (stealth).
// The same grid is sent to the client so it renders exactly what the server uses.
// ─────────────────────────────────────────────────────────────────────────────
import { ARENA } from "./constants.mjs";

export const GRID = 20;
export const CELL = ARENA.w / GRID; // 80 world units per cell
export const TILE = { EMPTY: 0, WALL: 1, BUSH: 2 };

export function cellCenter(r, c) {
  return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
}

function buildGemGrab() {
  const g = Array.from({ length: GRID }, () => new Array(GRID).fill(TILE.EMPTY));
  const inb = (r, c) => r >= 0 && r < GRID && c >= 0 && c < GRID;

  // Solid border ring (matches ARENA.margin == one cell).
  for (let i = 0; i < GRID; i++) { g[0][i] = TILE.WALL; g[GRID - 1][i] = TILE.WALL; g[i][0] = TILE.WALL; g[i][GRID - 1] = TILE.WALL; }

  // Top-half features; mirrored 180° to the bottom for fairness.
  const feats = [
    // central cover near the gem mine
    [8, 6, 1], [8, 7, 1],
    [6, 9, 1], [6, 10, 1],
    // left vertical wall (cover lane)
    [5, 3, 1], [6, 3, 1], [7, 3, 1],
    // upper cover blocks
    [2, 7, 1], [2, 8, 1],
    [4, 13, 1], [4, 14, 1],
    // bush clusters (stealth pockets)
    [3, 2, 2], [3, 3, 2], [4, 2, 2],
    [2, 15, 2], [2, 16, 2], [3, 16, 2],
    [8, 12, 2], [8, 13, 2],
    [7, 9, 2], [7, 10, 2],
  ];
  for (const [r, c, t] of feats) {
    if (inb(r, c)) g[r][c] = t;
    const rr = GRID - 1 - r, cc = GRID - 1 - c;
    if (inb(rr, cc)) g[rr][cc] = t;
  }

  // Spawn cells (blue bottom; red = 180° rotation of blue).
  const blue = [[16, 6], [17, 10], [16, 13]];
  const red = blue.map(([r, c]) => [GRID - 1 - r, GRID - 1 - c]);

  // Solo (Showdown) spawns: 10 points around the perimeter, evenly spread.
  const solo = [
    [2, 2], [2, 10], [2, 17],
    [10, 2], [10, 17],
    [17, 2], [17, 10], [17, 17],
    [6, 6], [13, 13],
  ];

  // Keep gem mine + all spawns clear of features.
  for (const [r, c] of [[9, 9], [9, 10], [10, 9], [10, 10], ...blue, ...red, ...solo]) g[r][c] = TILE.EMPTY;

  const toWorld = (cells) => cells.map(([r, c]) => cellCenter(r, c));
  return {
    grid: g,
    cell: CELL,
    n: GRID,
    blueSpawns: toWorld(blue),
    redSpawns: toWorld(red),
    soloSpawns: toWorld(solo),
    center: { x: ARENA.w / 2, y: ARENA.h / 2 },
  };
}

// Open field for ball/flow modes (Star Strike): clear center + goal lanes, only
// a few symmetric side covers and bushes so the ball never gets trapped.
function buildOpenField() {
  const g = Array.from({ length: GRID }, () => new Array(GRID).fill(TILE.EMPTY));
  const inb = (r, c) => r >= 0 && r < GRID && c >= 0 && c < GRID;
  for (let i = 0; i < GRID; i++) { g[0][i] = TILE.WALL; g[GRID - 1][i] = TILE.WALL; g[i][0] = TILE.WALL; g[i][GRID - 1] = TILE.WALL; }

  // Side cover only (never on the central vertical lane cols 8..11), mirrored.
  const feats = [
    [7, 4, 1], [12, 4, 1],   // left posts
    [7, 15, 1], [12, 15, 1], // right posts (mirror)
    [5, 6, 2], [5, 13, 2],   // bush pockets
    [14, 6, 2], [14, 13, 2],
    [9, 3, 2], [10, 16, 2],
  ];
  for (const [r, c, t] of feats) if (inb(r, c)) g[r][c] = t;

  const blue = [[16, 7], [17, 10], [16, 12]];
  const red = blue.map(([r, c]) => [GRID - 1 - r, GRID - 1 - c]);
  // Keep center + both goal mouths perfectly clear.
  for (let r = 1; r <= GRID - 2; r++) for (let c = 8; c <= 11; c++) g[r][c] = TILE.EMPTY;
  for (const [r, c] of [...blue, ...red]) g[r][c] = TILE.EMPTY;

  const toWorld = (cells) => cells.map(([r, c]) => cellCenter(r, c));
  return {
    grid: g, cell: CELL, n: GRID,
    blueSpawns: toWorld(blue), redSpawns: toWorld(red),
    soloSpawns: toWorld(blue.concat(red)),
    center: { x: ARENA.w / 2, y: ARENA.h / 2 },
  };
}

let _gemGrab = null;
export function getGemGrabMap() {
  if (!_gemGrab) _gemGrab = buildGemGrab();
  return _gemGrab;
}

let _open = null;
export function getOpenFieldMap() {
  if (!_open) _open = buildOpenField();
  return _open;
}

/** Pick the tile map a given mode kind should use. */
export function getMapForKind(kind) {
  if (kind === "starstrike") return getOpenFieldMap();
  return getGemGrabMap();
}
