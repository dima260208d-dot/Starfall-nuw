export const GS = 60;
export const PLAY_LO = 4;
export const PLAY_HI = 55;
export const CX = 29;
export const CY = 29;
export const LEFT = 6;
export const RIGHT = 53;
export const TOP = 6;
export const BOT = 53;
export const HALF = 30;
export const PLAY_CELLS = (PLAY_HI - PLAY_LO + 1) ** 2;
export const MAPS_PER_MODE = 5;

export const T = { GRASS: 0, WALL: 1, BUSH: 3, WATER: 4, DECORATION: 5, FENCE: 6, HEAL: 7, SAND_WALL: 11 };

export function inGemZone(x, y) { return Math.abs(x - CX) <= 2 && Math.abs(y - CY) <= 2; }
export function inBossPath(x, y) { return y >= CY - 1 && y <= CY + 1 && x >= LEFT && x <= RIGHT - 2; }

export const BUSH_RING3 = [[-2, 0], [-1, -1], [0, -2], [1, -1], [2, 0], [1, 1], [0, 2], [-1, 1]];
export const BUSH_PLUS = [[-1, 0], [0, 0], [1, 0], [0, -1], [0, 1]];
export const BUSH_BLOCK = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
export const BUSH_LINE = [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]];

export function bushGrove(cx, cy, cells) {
  return cells.map(([dx, dy]) => ({ kind: "set", x: cx + dx, y: cy + dy, tile: T.BUSH }));
}

/** L-shaped wall corner + open bush pocket (always reachable). */
export function cornerFort(x, y, ori) {
  const bx = ori === 0 ? x + 2 : ori === 1 ? x - 2 : ori === 2 ? x + 2 : x - 2;
  const by = ori === 0 || ori === 1 ? y + 2 : y - 2;
  return [{ kind: "L", x, y, len: 4, ori, tile: T.WALL }, ...bushGrove(bx, by, BUSH_PLUS)];
}

/** Cross with a walkable center gap — no sealed pockets. */
export function crossArena(gap, arm, tile = T.WALL) {
  const stamps = [];
  for (let k = -arm; k <= arm; k++) {
    if (Math.abs(k) <= gap) continue;
    stamps.push({ kind: "set", x: CX + k, y: CY, tile });
    stamps.push({ kind: "set", x: CX, y: CY + k, tile });
  }
  return stamps;
}

/** Open arc of walls — always has a wide gap so nothing gets sealed inside. */
export function openRing(cx, cy, r, wallTile = T.WALL) {
  const stamps = [];
  const segments = 14;
  const gapStart = 11;
  for (let a = 0; a < segments; a++) {
    if (a >= gapStart && a <= gapStart + 2) continue;
    const ang = (a / segments) * Math.PI * 2;
    stamps.push({ kind: "set", x: Math.round(cx + Math.cos(ang) * r), y: Math.round(cy + Math.sin(ang) * r), tile: wallTile });
  }
  return stamps;
}

export function ringBushes(cx, cy, r) {
  const stamps = [];
  for (let a = 0; a < 10; a++) {
    const ang = (a / 10) * Math.PI * 2;
    stamps.push({ kind: "set", x: Math.round(cx + Math.cos(ang) * r), y: Math.round(cy + Math.sin(ang) * r), tile: T.BUSH });
  }
  return stamps;
}

export function waterL(x, y, w, h) {
  return [{ kind: "waterRect", x, y, w, h: 2 }, { kind: "waterRect", x, y, w: 2, h }];
}

export function diagonalStairs(sx, sy, steps) {
  const stamps = [];
  for (let i = 0; i < steps; i++) {
    stamps.push({ kind: "set", x: sx + i, y: sy + i, tile: T.WALL });
    if (i % 2 === 0) stamps.push({ kind: "set", x: sx + i, y: sy + i + 1, tile: T.WALL });
  }
  return stamps;
}

/** Partial lane wall — leaves gaps at both ends for passage. */
export function laneWall(x, y, len, vertical = false) {
  const inset = Math.max(1, Math.floor(len * 0.15));
  if (vertical) {
    return [{ kind: "vline", x, y: y + inset, len: len - inset * 2, tile: T.WALL }];
  }
  return [{ kind: "hline", x: x + inset, y, len: len - inset * 2, tile: T.WALL }];
}

export function leftLaneWall(y, len) {
  return laneWall(LEFT + 6, y, len, false);
}

export function leftPerimeterBushes(inset) {
  const span = CX - LEFT - inset;
  const height = (mode) => (mode === "showdown" ? CY : BOT) - TOP - inset;
  return (mode) => [
    { kind: "hline", x: LEFT + inset, y: TOP + inset, len: span, tile: T.BUSH },
    { kind: "vline", x: LEFT + inset, y: TOP + inset, len: height(mode), tile: T.BUSH },
  ];
}

export function sandBarrier(x, y, len, vertical = false) {
  return vertical ? [{ kind: "vline", x, y, len, tile: T.SAND_WALL }] : [{ kind: "hline", x, y, len, tile: T.SAND_WALL }];
}

export function fenceRow(x, y, len, vertical = false) {
  return vertical ? [{ kind: "vline", x, y, len, tile: T.FENCE }] : [{ kind: "hline", x, y, len, tile: T.FENCE }];
}

export function lanePair(y1, y2, len = 10) {
  return [...leftLaneWall(y1, len), ...leftLaneWall(y2, len)];
}

/** 3-wall alcove — one side open so inner cover stays reachable. open: 0=S,1=N,2=E,3=W */
export function coverAlcove(x, y, w, h, wall, open) {
  const stamps = [];
  if (open !== 1) stamps.push({ kind: "hline", x, y, len: w, tile: wall });
  if (open !== 0) stamps.push({ kind: "hline", x, y: y + h - 1, len: w, tile: wall });
  if (open !== 3) stamps.push({ kind: "vline", x, y, len: h, tile: wall });
  if (open !== 2) stamps.push({ kind: "vline", x: x + w - 1, y, len: h, tile: wall });
  const ix = open === 3 ? x + 1 : open === 2 ? x + w - 2 : x + Math.floor(w / 2);
  const iy = open === 1 ? y + 1 : open === 0 ? y + h - 2 : y + Math.floor(h / 2);
  stamps.push(...bushGrove(ix, iy, BUSH_PLUS));
  return stamps;
}

export function openCenter(stamps) {
  return [...stamps, { kind: "set", x: CX, y: CY, tile: T.GRASS }];
}

export function deco(x, y) { return { kind: "set", x, y, tile: T.DECORATION }; }
export function heal(x, y) { return { kind: "set", x, y, tile: T.HEAL }; }

export function filterRegion(stamps, mode) {
  const xMax = CX;
  const yMax = mode === "showdown" ? CY : PLAY_HI;
  return stamps.filter(s => {
    const pts = s.kind === "hline" ? [[s.x, s.y], [s.x + s.len - 1, s.y]] :
      s.kind === "vline" ? [[s.x, s.y], [s.x, s.y + s.len - 1]] :
      s.kind === "rect" || s.kind === "waterRect" ?
        [[s.x, s.y], [s.x + s.w - 1, s.y + s.h - 1]] : [[s.x, s.y]];
    return pts.every(([px, py]) => px >= PLAY_LO && px <= xMax && py >= PLAY_LO && py <= yMax);
  });
}

export function clipGemZone(stamps) {
  return stamps.filter(s => {
    if (s.kind === "set") return !inGemZone(s.x, s.y);
    if (s.kind === "rect" || s.kind === "waterRect")
      for (let dy = 0; dy < s.h; dy++)
        for (let dx = 0; dx < s.w; dx++)
          if (inGemZone(s.x + dx, s.y + dy)) return false;
    if (s.kind === "hline")
      for (let i = 0; i < s.len; i++) if (inGemZone(s.x + i, s.y)) return false;
    if (s.kind === "vline")
      for (let i = 0; i < s.len; i++) if (inGemZone(s.x, s.y + i)) return false;
    if (s.kind === "cross")
      for (let k = -s.arm; k <= s.arm; k++)
        if (inGemZone(s.x + k, s.y) || inGemZone(s.x, s.y + k)) return false;
    return true;
  });
}

export function clipBossPath(stamps) {
  return stamps.filter(s => {
    if (s.kind === "set") return !inBossPath(s.x, s.y);
    if (s.kind === "hline")
      for (let i = 0; i < s.len; i++) if (inBossPath(s.x + i, s.y)) return false;
    if (s.kind === "rect" || s.kind === "waterRect")
      for (let dy = 0; dy < s.h; dy++)
        for (let dx = 0; dx < s.w; dx++)
          if (inBossPath(s.x + dx, s.y + dy)) return false;
    return true;
  });
}

export function isDecorative(s) {
  return s.kind === "set" && (s.tile === T.DECORATION || s.tile === T.HEAL);
}

/** Forbidden: fully walled rooms and water-trapped islands. */
export function isEnclosedStamp(s) {
  return s.kind === "room";
}

export function rejectEnclosed(stamps) {
  return stamps.filter(s => !isEnclosedStamp(s));
}

export function isWalkableTile(t) {
  return t === T.GRASS || t === T.BUSH || t === T.HEAL;
}

/** Every cover tile (bush/heal/deco) must be reachable — grass pockets behind walls are OK. */
export function allWalkableConnected(cells) {
  const cover = (t) => t === T.BUSH || t === T.HEAL || t === T.DECORATION;
  let coverCount = 0;
  const queue = [];
  const visited = new Uint8Array(GS * GS);
  const walkable = (t) => t === T.GRASS || t === T.BUSH || t === T.HEAL;

  for (const [sx, sy] of [[CX, CY], [LEFT, CY], [RIGHT, CY]]) {
    if (sx < PLAY_LO || sy < PLAY_LO || sx > PLAY_HI || sy > PLAY_HI) continue;
    const si = sy * GS + sx;
    if (!walkable(cells[si]) || visited[si]) continue;
    visited[si] = 1;
    queue.push([sx, sy]);
  }
  if (!queue.length) return true;

  let seenCover = 0;
  while (queue.length) {
    const [x, y] = queue.shift();
    const t = cells[y * GS + x];
    if (cover(t)) seenCover++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < PLAY_LO || ny < PLAY_LO || nx > PLAY_HI || ny > PLAY_HI) continue;
      const idx = ny * GS + nx;
      if (visited[idx]) continue;
      if (!walkable(cells[idx])) continue;
      visited[idx] = 1;
      queue.push([nx, ny]);
    }
  }

  for (let y = PLAY_LO; y <= PLAY_HI; y++)
    for (let x = PLAY_LO; x <= PLAY_HI; x++)
      if (cover(cells[y * GS + x])) coverCount++;

  return seenCover === coverCount;
}

/** Open team-mode fill — lines and alcoves with gaps, no sealed rooms. */
export function openTeamFill(v = 0) {
  const o = v % MAPS_PER_MODE;
  const yMax = BOT;
  return [
    ...leftPerimeterBushes(2)("gemgrab"),
    { kind: "hline", x: LEFT + 2, y: TOP + 2, len: CX - LEFT - 2, tile: T.BUSH },
    { kind: "hline", x: LEFT + 2, y: yMax - 2, len: CX - LEFT - 2, tile: T.BUSH },
    ...lanePair(TOP + 10 + o, TOP + 20 + o, 18),
    ...lanePair(CY - 10, CY + 10, 16),
    ...lanePair(yMax - 22 - o, yMax - 12 - o, 18),
    { kind: "vline", x: LEFT + 8 + o, y: TOP + 8, len: 38, tile: T.WALL },
    { kind: "vline", x: LEFT + 16 + o, y: TOP + 10, len: 34, tile: T.FENCE },
    { kind: "vline", x: CX - 8 - o, y: TOP + 6, len: 42, tile: T.FENCE },
    ...fenceRow(LEFT + 12, TOP + 14 + o, 18),
    ...fenceRow(LEFT + 12, CY - 1, 18),
    ...fenceRow(LEFT + 12, yMax - 18 - o, 18),
    ...sandBarrier(LEFT + 10, TOP + 24, 16),
    ...sandBarrier(CX - 12, TOP + 28, 14, true),
    ...sandBarrier(CX - 12, yMax - 32, 14, true),
    ...coverAlcove(LEFT + 10, TOP + 10, 5, 5, T.WALL, 0),
    ...coverAlcove(LEFT + 10, yMax - 15, 5, 5, T.WALL, 1),
    ...coverAlcove(CX - 10, TOP + 12, 5, 5, T.FENCE, 3),
    ...coverAlcove(CX - 10, yMax - 17, 5, 5, T.FENCE, 2),
    ...cornerFort(LEFT + 4, TOP + 4, 0),
    ...cornerFort(LEFT + 4, yMax - 4, 2),
    ...cornerFort(CX - 4, TOP + 4, 1),
    ...cornerFort(CX - 4, yMax - 4, 3),
    ...waterL(LEFT + 16, TOP + 12 + o, 6, 5),
    ...waterL(LEFT + 16, yMax - 17 - o, 6, 5),
    ...bushGrove(LEFT + 20, TOP + 8, BUSH_BLOCK),
    ...bushGrove(LEFT + 20, yMax - 8, BUSH_BLOCK),
    ...bushGrove(CX - 4, TOP + 8, BUSH_RING3),
    ...bushGrove(CX - 4, yMax - 8, BUSH_RING3),
    ...bushGrove(LEFT + 22, CY, BUSH_PLUS),
    { kind: "hline", x: LEFT + 6, y: CY + 14, len: 12, tile: T.WALL },
    { kind: "hline", x: LEFT + 6, y: CY - 14, len: 12, tile: T.WALL },
  ];
}

export function openSdFill(v = 0) {
  const o = v % MAPS_PER_MODE;
  return [
    ...leftPerimeterBushes(2)("showdown"),
    ...lanePair(TOP + 8 + o, TOP + 18 + o, 16),
    ...lanePair(TOP + 22 + o, CY - 4, 12),
    { kind: "vline", x: LEFT + 6 + o, y: TOP + 5, len: 22, tile: T.WALL },
    { kind: "vline", x: LEFT + 14 + o, y: TOP + 7, len: 18, tile: T.FENCE },
    { kind: "vline", x: CX - 9 - o, y: TOP + 5, len: 20, tile: T.FENCE },
    ...fenceRow(LEFT + 8, TOP + 11 + o, 16),
    ...fenceRow(LEFT + 8, CY - 3, 14),
    ...coverAlcove(LEFT + 8, TOP + 10, 5, 5, T.WALL, 0),
    ...coverAlcove(CX - 10, TOP + 12, 5, 5, T.FENCE, 3),
    ...cornerFort(LEFT + 3, TOP + 3, 0),
    ...cornerFort(CX - 3, CY - 3, 2),
    ...waterL(LEFT + 13, TOP + 7 + o, 6, 4),
    ...sandBarrier(LEFT + 9, TOP + 24, 14),
    ...bushGrove(LEFT + 15, TOP + 5, BUSH_BLOCK),
    ...bushGrove(CX - 3, TOP + 11, BUSH_RING3),
    ...bushGrove(CX - 3, CY - 5, BUSH_PLUS),
    { kind: "hline", x: LEFT + 10, y: TOP + 25, len: 12, tile: T.FENCE },
  ];
}

export function fillForMode(mode, v) {
  return mode === "showdown" ? openSdFill(v) : openTeamFill(v);
}

/** Zone-balanced scatter — lines and bushes only (no alcoves). */
export function distributedScatter(mode, v) {
  const yMax = mode === "showdown" ? CY : BOT;
  const o = v % MAPS_PER_MODE;
  const stamps = [];
  const rows = [
    [TOP + 8 + o, LEFT + 8, 12, T.BUSH],
    [TOP + 16 + o, LEFT + 11, 11, T.FENCE],
    [TOP + 24 + o, LEFT + 9, 13, T.WALL],
    [yMax - 10 - o, LEFT + 8, 12, T.BUSH],
    [yMax - 18 - o, LEFT + 11, 11, T.FENCE],
    [(TOP + yMax) >> 1, LEFT + 10, 12, T.SAND_WALL],
  ];
  for (const [y, x, len, tile] of rows) stamps.push({ kind: "hline", x, y, len, tile });
  for (const [x, y, len, tile] of [
    [LEFT + 12, TOP + 10, 12, T.BUSH],
    [LEFT + 18, TOP + 18, 14, T.FENCE],
    [CX - 9, TOP + 8, 16, T.FENCE],
  ]) stamps.push({ kind: "vline", x, y, len, tile });
  for (const [cx, cy] of [
    [LEFT + 16, TOP + 6], [LEFT + 22, TOP + 20], [LEFT + 16, yMax - 6],
    [CX - 6, TOP + 14], [CX - 8, yMax - 12],
  ]) stamps.push(...bushGrove(cx, cy, BUSH_PLUS));
  if (o % 2 === 0) stamps.push(...waterL(LEFT + 14, TOP + 12, 4, 3));
  return stamps;
}

function buildOpenPool(mode) {
  const yMax = mode === "showdown" ? CY : BOT;
  const pool = [];
  for (const [y, x, len, tile] of [
    [TOP + 8, LEFT + 8, 10, T.BUSH], [TOP + 14, LEFT + 14, 9, T.FENCE],
    [TOP + 20, LEFT + 10, 11, T.WALL], [TOP + 26, LEFT + 16, 8, T.BUSH],
    [CY - 12, LEFT + 9, 10, T.SAND_WALL], [CY + 12, LEFT + 9, 10, T.SAND_WALL],
    [yMax - 14, LEFT + 10, 10, T.BUSH], [yMax - 20, LEFT + 15, 9, T.FENCE],
    [yMax - 8, LEFT + 8, 11, T.WALL],
  ]) pool.push({ kind: "hline", x, y, len, tile });
  for (const [x, y, len, tile] of [
    [LEFT + 10, TOP + 10, 12, T.BUSH], [LEFT + 16, TOP + 18, 14, T.FENCE],
    [LEFT + 20, TOP + 26, 10, T.WALL], [CX - 10, TOP + 12, 16, T.FENCE],
    [CX - 8, yMax - 22, 14, T.SAND_WALL],
  ]) pool.push({ kind: "vline", x, y, len, tile });
  for (const [x, y, open] of [
    [LEFT + 10, TOP + 12, 0], [LEFT + 16, TOP + 28, 1], [LEFT + 12, yMax - 16, 2],
    [CX - 10, TOP + 16, 3], [CX - 10, yMax - 18, 0],
  ]) pool.push(...coverAlcove(x, y, 4, 4, T.WALL, open));
  for (const [cx, cy, cells] of [
    [LEFT + 18, TOP + 8, BUSH_RING3], [LEFT + 22, yMax - 10, BUSH_PLUS],
    [CX - 4, TOP + 10, BUSH_BLOCK], [CX - 6, yMax - 8, BUSH_LINE],
  ]) pool.push(...bushGrove(cx, cy, cells));
  return pool;
}

const THEMATIC_POOLS = {};
for (const mode of ["showdown", "gemgrab", "heist", "bounty", "starstrike", "siege", "bossraid"]) {
  THEMATIC_POOLS[mode] = buildOpenPool(mode);
}

export function getThematicPool(mode) {
  return THEMATIC_POOLS[mode] ?? buildOpenPool(mode);
}

export function poolStartIndex(mode, variant) {
  return (variant * 7) % getThematicPool(mode).length;
}
