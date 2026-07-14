export const TILE_CELL_SIZE = 50;
export const GRID_SIZE = 60;
/** Mountain rim in live battles — keeps barrier art off the playable field. */
export const BATTLE_MAP_RIM_CELLS = 4;

export enum TileType {
  GRASS = 0,
  WALL = 1,
  MOUNTAIN = 2,
  BUSH = 3,
  WATER = 4,
  DECORATION = 5,
  FENCE = 6,
  HEAL = 7,
  TREE = 8,
  CACTUS = 9,
  WOOD = 10,
  SAND_WALL = 11,
  PYRAMID = 12,
  FLOWERBED = 13,
}

export interface TileProps {
  walkable: boolean;
  shootThrough: boolean;
  destructible: boolean;
  soraDestructible: boolean;
  healRate: number;
  cover: boolean;
}

export const TILE_PROPS: Record<number, TileProps> = {
  [TileType.GRASS]:      { walkable: true,  shootThrough: true,  destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.WALL]:       { walkable: false, shootThrough: false, destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.MOUNTAIN]:   { walkable: false, shootThrough: false, destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.BUSH]:       { walkable: true,  shootThrough: true,  destructible: false, soraDestructible: false, healRate: 0,   cover: true  },
  [TileType.WATER]:      { walkable: false, shootThrough: true,  destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.DECORATION]: { walkable: false, shootThrough: false, destructible: true,  soraDestructible: true,  healRate: 0,   cover: false },
  [TileType.FENCE]:      { walkable: false, shootThrough: true,  destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.HEAL]:       { walkable: false, shootThrough: false, destructible: false, soraDestructible: false, healRate: 500, cover: false },
  [TileType.TREE]:       { walkable: false, shootThrough: false, destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.CACTUS]:     { walkable: false, shootThrough: false, destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.WOOD]:       { walkable: false, shootThrough: false, destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.SAND_WALL]:  { walkable: false, shootThrough: false, destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.PYRAMID]:    { walkable: false, shootThrough: false, destructible: false, soraDestructible: false, healRate: 0,   cover: false },
  [TileType.FLOWERBED]:  { walkable: false, shootThrough: true,  destructible: false, soraDestructible: false, healRate: 0,   cover: false },
};

export function getTileGridWorldSize(grid: TileGrid): { mapWidth: number; mapHeight: number } {
  return {
    mapWidth: grid.width * grid.cellSize,
    mapHeight: grid.height * grid.cellSize,
  };
}

/** Минимальная трава-сетка, если у режима нет tileGrid (3D-сцена всё равно поднимается). */
export function createFallbackBattleTileGrid(mapWidthPx: number, mapHeightPx: number): TileGrid {
  const cw = Math.max(1, Math.ceil(mapWidthPx / TILE_CELL_SIZE));
  const ch = Math.max(1, Math.ceil(mapHeightPx / TILE_CELL_SIZE));
  const cells = new Uint8Array(cw * ch);
  cells.fill(TileType.GRASS);
  return {
    cells,
    destroyed: new Uint8Array(cw * ch),
    width: cw,
    height: ch,
    cellSize: TILE_CELL_SIZE,
  };
}

export interface TileGrid {
  cells: Uint8Array;
  destroyed: Uint8Array;
  /** Incremented when a destructible tile is destroyed — cheap dirty flag for 3D rebuild. */
  destroyRevision?: number;
  /**
   * Опциональный per-cell поворот для тайлов, у которых это имеет смысл.
   *   • bones (5), fence (6): 0 = горизонталь, 1 = вертикаль
   *   • wall (1), sand_wall (11): 0/1/2/3 → 0°/90°/180°/270° вокруг Y
   * Не задано → все клетки считаются с rot=0.
   * Используется в battle3DWorld для согласованного отображения с редактором.
   */
  rotations?: Uint8Array;
  width: number;
  height: number;
  cellSize: number;
}

export function getTile(grid: TileGrid, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return TileType.MOUNTAIN;
  const idx = ty * grid.width + tx;
  if (grid.destroyed[idx]) return TileType.GRASS;
  return grid.cells[idx];
}

export function setTile(grid: TileGrid, tx: number, ty: number, type: TileType): void {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return;
  grid.cells[ty * grid.width + tx] = type;
}

/** True when a non-grass tile shares an edge with grass (rim face bleeding into arena). */
export function tileAdjacentToGrass(grid: TileGrid, tx: number, ty: number): boolean {
  if (getTile(grid, tx, ty) === TileType.GRASS) return false;
  if (getTile(grid, tx, ty - 1) === TileType.GRASS) return true;
  if (getTile(grid, tx, ty + 1) === TileType.GRASS) return true;
  if (getTile(grid, tx - 1, ty) === TileType.GRASS) return true;
  if (getTile(grid, tx + 1, ty) === TileType.GRASS) return true;
  return false;
}

/** Force solid mountain rim so camera at map edge never shows empty void (GLB wall art). */
export function paintMountainBorderRing(grid: TileGrid, rimCells: number): void {
  const r = Math.max(1, Math.min(rimCells, Math.floor(Math.min(grid.width, grid.height) / 2)));
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (x < r || x >= grid.width - r || y < r || y >= grid.height - r) {
        grid.cells[y * grid.width + x] = TileType.MOUNTAIN;
      }
    }
  }
}

export function destroyTile(grid: TileGrid, tx: number, ty: number): void {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return;
  const type = grid.cells[ty * grid.width + tx];
  const props = TILE_PROPS[type];
  if (props?.destructible) {
    grid.destroyed[ty * grid.width + tx] = 1;
    grid.destroyRevision = (grid.destroyRevision ?? 0) + 1;
  }
}

export function soraDestroyTile(grid: TileGrid, tx: number, ty: number): void {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return;
  const type = grid.cells[ty * grid.width + tx];
  const props = TILE_PROPS[type];
  if (props?.soraDestructible) {
    grid.destroyed[ty * grid.width + tx] = 1;
    grid.destroyRevision = (grid.destroyRevision ?? 0) + 1;
  }
}

/**
 * ISO wall sprites leave empty padding on the canvas south side; full-cell AABB
 * feels like an invisible lip. Shrink collision from the south for these types
 * (fraction of cellSize). FENCE omitted — thin strip, full cell.
 */
const TILE_COLLISION_SOUTH_INSET_FRAC: Partial<Record<number, number>> = {
  [TileType.WALL]: 0.30,
  [TileType.MOUNTAIN]: 0.30,
  [TileType.SAND_WALL]: 0.30,
  [TileType.WOOD]: 0.30,
  [TileType.DECORATION]: 0.22,
  [TileType.CACTUS]: 0.20,
  [TileType.TREE]: 0.22,
  [TileType.PYRAMID]: 0.22,
};

/**
 * В 3D-режиме модели занимают всю ячейку без «пустого нижнего поля» (которое
 * было у 2D ISO-спрайтов). Соответственно south-inset нужно выключить, иначе
 * игрок может зайти в южную часть кубика «сквозь текстуру».
 *
 * Переключается из `battle3DWorld.initBattle3DForBattle` / `disposeBattle3D`.
 */
let tileCollisionFullCell = false;
export function setTileCollisionFullCell(enabled: boolean): void {
  tileCollisionFullCell = enabled;
}

export type TileGridCollisionOpts = {
  /**
   * Shift collision circle center along +world Y (down) from logical (x, y).
   * Used for brawlers so the circle sits near the feet, not the sprite pivot.
   */
  circleWorldDy?: number;
};

export function collidesWithTileGrid(
  x: number, y: number, radius: number,
  grid: TileGrid,
  opts?: TileGridCollisionOpts,
): { collides: boolean; nx: number; ny: number } {
  const dy = opts?.circleWorldDy ?? 0;
  let ccx = x;
  let ccy = y + dy;

  const C = grid.cellSize;
  const minTX = Math.max(0, Math.floor((ccx - radius) / C));
  const maxTX = Math.min(grid.width - 1, Math.floor((ccx + radius) / C));
  const minTY = Math.max(0, Math.floor((ccy - radius) / C));
  const maxTY = Math.min(grid.height - 1, Math.floor((ccy + radius) / C));

  let collides = false;

  for (let tx = minTX; tx <= maxTX; tx++) {
    for (let ty = minTY; ty <= maxTY; ty++) {
      const type = getTile(grid, tx, ty);
      const props = TILE_PROPS[type];
      if (!props || props.walkable) continue;

      const tileX = tx * C;
      const tileY = ty * C;
      const insetFrac = tileCollisionFullCell ? 0 : (TILE_COLLISION_SOUTH_INSET_FRAC[type] ?? 0);
      const southInset = insetFrac > 0 ? C * insetFrac : 0;
      const hSolid = C - southInset;
      const nearX = Math.max(tileX, Math.min(ccx, tileX + C));
      const nearY = Math.max(tileY, Math.min(ccy, tileY + hSolid));
      const dx = ccx - nearX;
      const dyCol = ccy - nearY;
      const distSq = dx * dx + dyCol * dyCol;
      if (distSq < radius * radius) {
        collides = true;
        const dist = Math.sqrt(distSq) || 0.01;
        const overlap = radius - dist;
        ccx += (dx / dist) * overlap;
        ccy += (dyCol / dist) * overlap;
      }
    }
  }

  return { collides, nx: ccx, ny: ccy - dy };
}

export function projectileBlockedByTile(
  x: number, y: number,
  grid: TileGrid
): { blocked: boolean; tx: number; ty: number } {
  const C = grid.cellSize;
  const tx = Math.floor(x / C);
  const ty = Math.floor(y / C);
  const type = getTile(grid, tx, ty);
  const props = TILE_PROPS[type];
  if (!props || props.shootThrough) return { blocked: false, tx, ty };
  return { blocked: true, tx, ty };
}

/** Тряска при попадании — все твёрдые деко, кроме кустов, костей, воды, заборов, клумб. */
export function tileShouldShakeOnHit(type: number): boolean {
  return type !== TileType.GRASS
    && type !== TileType.BUSH
    && type !== TileType.WATER
    && type !== TileType.DECORATION
    && type !== TileType.FENCE
    && type !== TileType.FLOWERBED;
}

export function getTileHealRate(x: number, y: number, grid: TileGrid): number {
  const C = grid.cellSize;
  const tx = Math.floor(x / C);
  const ty = Math.floor(y / C);
  // Check own tile first; also check 4 orthogonal neighbours so players
  // standing next to a non-walkable HEAL barrel still receive healing.
  const checks = [
    getTile(grid, tx, ty),
    getTile(grid, tx, ty - 1),
    getTile(grid, tx, ty + 1),
    getTile(grid, tx - 1, ty),
    getTile(grid, tx + 1, ty),
  ];
  let best = 0;
  for (const type of checks) {
    const rate = TILE_PROPS[type]?.healRate ?? 0;
    if (rate > best) best = rate;
  }
  return best;
}

export function isTileInBush(x: number, y: number, grid: TileGrid): boolean {
  const C = grid.cellSize;
  const tx = Math.floor(x / C);
  const ty = Math.floor(y / C);
  return getTile(grid, tx, ty) === TileType.BUSH;
}

export function nearestGrassTile(
  grid: TileGrid,
  worldX: number, worldY: number
): { x: number; y: number } {
  const C = grid.cellSize;
  let tx = Math.floor(worldX / C);
  let ty = Math.floor(worldY / C);
  tx = Math.max(0, Math.min(grid.width - 1, tx));
  ty = Math.max(0, Math.min(grid.height - 1, ty));

  if (getTile(grid, tx, ty) === TileType.GRASS) {
    return { x: (tx + 0.5) * C, y: (ty + 0.5) * C };
  }

  for (let r = 1; r < 10; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (getTile(grid, nx, ny) === TileType.GRASS) {
          return { x: (nx + 0.5) * C, y: (ny + 0.5) * C };
        }
      }
    }
  }

  return { x: (tx + 0.5) * C, y: (ty + 0.5) * C };
}

/**
 * Neighbour types whose rendered sprites overlap flat pickups (power boxes, jars)
 * on adjacent grass — placement-only rule; does not change tile rendering or collision.
 */
const FLAT_PICKUP_NEIGHBOR_BLOCK = new Set<number>([
  TileType.BUSH,
  TileType.WALL,
  TileType.MOUNTAIN,
  TileType.WATER,
  TileType.FLOWERBED,
  TileType.DECORATION,
  TileType.FENCE,
  TileType.HEAL,
  TileType.TREE,
  TileType.CACTUS,
  TileType.WOOD,
  TileType.SAND_WALL,
  TileType.PYRAMID,
]);

/** True if this cell is grass and the 8 neighbours are grass (no tall/bush/water overlap on pickups). */
export function isFlatPickupCellClear(grid: TileGrid, tx: number, ty: number): boolean {
  if (tx < 1 || ty < 1 || tx >= grid.width - 1 || ty >= grid.height - 1) return false;
  if (getTile(grid, tx, ty) !== TileType.GRASS) return false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (FLAT_PICKUP_NEIGHBOR_BLOCK.has(getTile(grid, tx + dx, ty + dy))) return false;
    }
  }
  return true;
}

/** Spiral search for a clear 3×3 grass pocket for crates / jar drops. */
export function findNearestFlatPickupCell(
  grid: TileGrid,
  tx: number,
  ty: number,
  maxRadius = 12,
): { tx: number; ty: number } | null {
  if (isFlatPickupCellClear(grid, tx, ty)) return { tx, ty };
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (isFlatPickupCellClear(grid, nx, ny)) return { tx: nx, ty: ny };
      }
    }
  }
  return null;
}

/** Power-box top-left in world (same as editor POWER_BOX overlay). */
export function flatPickupCrateWorldOrigin(grid: TileGrid, tx: number, ty: number): { x: number; y: number } {
  const C = grid.cellSize;
  return { x: tx * C + 12, y: ty * C + 12 };
}

/** Snap world XY to cell centre of nearest clear pocket (for jar drops). */
export function snapWorldPosToFlatPickupCenter(grid: TileGrid, wx: number, wy: number): { x: number; y: number } {
  const C = grid.cellSize;
  const tx = Math.floor(wx / C);
  const ty = Math.floor(wy / C);
  const snap = findNearestFlatPickupCell(grid, tx, ty, 14);
  if (!snap) return { x: wx, y: wy };
  return { x: (snap.tx + 0.5) * C, y: (snap.ty + 0.5) * C };
}

function lcg(seed: { v: number }): number {
  seed.v = Math.imul(seed.v, 1664525) + 1013904223;
  return ((seed.v >>> 0) / 0xffffffff);
}

export function generateShowdownTileGrid(seedVal = Date.now()): TileGrid {
  if ((globalThis as { __onlineClientMode?: boolean }).__onlineClientMode) {
    return {
      cells: new Uint8Array(GRID_SIZE * GRID_SIZE),
      destroyed: new Uint8Array(GRID_SIZE * GRID_SIZE),
      width: GRID_SIZE,
      height: GRID_SIZE,
      cellSize: TILE_CELL_SIZE,
    };
  }
  const W = GRID_SIZE, H = GRID_SIZE;
  const grid: TileGrid = {
    cells: new Uint8Array(W * H),
    destroyed: new Uint8Array(W * H),
    width: W, height: H,
    cellSize: TILE_CELL_SIZE,
  };
  const seed = { v: seedVal | 0 };

  grid.cells.fill(TileType.GRASS);

  // Mountain rim — same width as published-map battles.
  const RIM = BATTLE_MAP_RIM_CELLS;
  paintMountainBorderRing(grid, RIM);
  const INNER = RIM + 2;

  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  const numRooms = 4 + Math.floor(lcg(seed) * 4);
  for (let i = 0; i < numRooms; i++) {
    const rw = 6 + Math.floor(lcg(seed) * 5);
    const rh = 6 + Math.floor(lcg(seed) * 5);
    const rx = INNER + Math.floor(lcg(seed) * Math.max(1, W - 2 * INNER - rw));
    const ry = INNER + Math.floor(lcg(seed) * Math.max(1, H - 2 * INNER - rh));
    const overlaps = rooms.some(r =>
      rx < r.x + r.w + 2 && rx + rw + 2 > r.x &&
      ry < r.y + r.h + 2 && ry + rh + 2 > r.y
    );
    if (!overlaps) rooms.push({ x: rx, y: ry, w: rw, h: rh });
  }
  rooms.push({ x: 23, y: 23, w: 14, h: 14 });

  const numWalls = 14 + Math.floor(lcg(seed) * 12);
  for (let i = 0; i < numWalls; i++) {
    const wx = INNER + Math.floor(lcg(seed) * Math.max(1, W - 2 * INNER));
    const wy = INNER + Math.floor(lcg(seed) * Math.max(1, H - 2 * INNER));
    const wtype = lcg(seed) < 0.35 ? TileType.SAND_WALL : lcg(seed) < 0.6 ? TileType.WALL : TileType.MOUNTAIN;
    const ww = lcg(seed) < 0.5 ? 1 : 2;
    const wh = ww === 1 ? (lcg(seed) < 0.5 ? 1 : 2) : 1;
    const inRoom = rooms.some(r =>
      wx < r.x + r.w && wx + ww > r.x && wy < r.y + r.h && wy + wh > r.y
    );
    if (!inRoom) {
      for (let xx = 0; xx < ww; xx++) {
        for (let yy = 0; yy < wh; yy++) {
          if (getTile(grid, wx + xx, wy + yy) === TileType.GRASS) {
            setTile(grid, wx + xx, wy + yy, wtype);
          }
        }
      }
    }
  }

  const numBushClusters = 8 + Math.floor(lcg(seed) * 10);
  for (let i = 0; i < numBushClusters; i++) {
    const bx = INNER + Math.floor(lcg(seed) * Math.max(1, W - 2 * INNER));
    const by = INNER + Math.floor(lcg(seed) * Math.max(1, H - 2 * INNER));
    const br = 2 + Math.floor(lcg(seed) * 3);
    for (let dx = -br; dx <= br; dx++) {
      for (let dy = -br; dy <= br; dy++) {
        if (dx * dx + dy * dy <= br * br && getTile(grid, bx + dx, by + dy) === TileType.GRASS) {
          setTile(grid, bx + dx, by + dy, TileType.BUSH);
        }
      }
    }
  }

  const numRivers = 1 + Math.floor(lcg(seed) * 2);
  for (let i = 0; i < numRivers; i++) {
    const horizontal = lcg(seed) < 0.5;
    let cx = INNER + Math.floor(lcg(seed) * Math.max(1, W - 2 * INNER));
    let cy = INNER + Math.floor(lcg(seed) * Math.max(1, H - 2 * INNER));
    const steps = horizontal ? Math.max(4, W - 2 * INNER) : Math.max(4, H - 2 * INNER);
    for (let s = 0; s < steps; s++) {
      const t = getTile(grid, cx, cy);
      if (t === TileType.GRASS || t === TileType.BUSH) {
        setTile(grid, cx, cy, TileType.WATER);
        const px = cx + (horizontal ? 0 : 1);
        const py = cy + (horizontal ? 1 : 0);
        const t2 = getTile(grid, px, py);
        if (t2 === TileType.GRASS || t2 === TileType.BUSH) setTile(grid, px, py, TileType.WATER);
      }
      if (horizontal) cx++; else cy++;
      if (lcg(seed) < 0.25) {
        if (horizontal) cy += lcg(seed) < 0.5 ? 1 : -1;
        else cx += lcg(seed) < 0.5 ? 1 : -1;
      }
      cx = Math.max(INNER, Math.min(W - INNER - 1, cx));
      cy = Math.max(INNER, Math.min(H - INNER - 1, cy));
    }
  }

  // Trees removed — replaced by pyramid blocks scattered across the map
  const numPyramids = 6 + Math.floor(lcg(seed) * 8);
  for (let i = 0; i < numPyramids; i++) {
    const tx = INNER + Math.floor(lcg(seed) * Math.max(1, W - 2 * INNER));
    const ty = INNER + Math.floor(lcg(seed) * Math.max(1, H - 2 * INNER));
    if (getTile(grid, tx, ty) === TileType.GRASS) setTile(grid, tx, ty, TileType.PYRAMID);
  }

  const numCacti = 5 + Math.floor(lcg(seed) * 7);
  for (let i = 0; i < numCacti; i++) {
    const tx = INNER + Math.floor(lcg(seed) * Math.max(1, W - 2 * INNER));
    const ty = INNER + Math.floor(lcg(seed) * Math.max(1, H - 2 * INNER));
    if (getTile(grid, tx, ty) === TileType.GRASS) setTile(grid, tx, ty, TileType.CACTUS);
  }

  const numDecorations = 10 + Math.floor(lcg(seed) * 12);
  for (let i = 0; i < numDecorations; i++) {
    const tx = INNER + Math.floor(lcg(seed) * Math.max(1, W - 2 * INNER));
    const ty = INNER + Math.floor(lcg(seed) * Math.max(1, H - 2 * INNER));
    if (getTile(grid, tx, ty) === TileType.GRASS) {
      setTile(grid, tx, ty, lcg(seed) < 0.5 ? TileType.DECORATION : TileType.WOOD);
    }
  }

  const numFenceLines = 4 + Math.floor(lcg(seed) * 5);
  for (let i = 0; i < numFenceLines; i++) {
    const fx = INNER + Math.floor(lcg(seed) * Math.max(1, W - 2 * INNER));
    const fy = INNER + Math.floor(lcg(seed) * Math.max(1, H - 2 * INNER));
    const flen = 2 + Math.floor(lcg(seed) * 5);
    const horiz = lcg(seed) < 0.5;
    for (let j = 0; j < flen; j++) {
      const tx = fx + (horiz ? j : 0);
      const ty = fy + (horiz ? 0 : j);
      if (getTile(grid, tx, ty) === TileType.GRASS) setTile(grid, tx, ty, TileType.FENCE);
    }
  }

  const numHeal = 2 + Math.floor(lcg(seed) * 2);
  for (let i = 0; i < numHeal; i++) {
    const tx = 10 + Math.floor(lcg(seed) * (W - 20));
    const ty = 10 + Math.floor(lcg(seed) * (H - 20));
    if (getTile(grid, tx, ty) === TileType.GRASS) setTile(grid, tx, ty, TileType.HEAL);
  }

  for (let dx = -7; dx <= 7; dx++) {
    for (let dy = -7; dy <= 7; dy++) {
      const tx = 30 + dx, ty = 30 + dy;
      const t = getTile(grid, tx, ty);
      if (t !== TileType.GRASS && t !== TileType.HEAL && t !== TileType.BUSH) {
        setTile(grid, tx, ty, TileType.GRASS);
      }
    }
  }

  return grid;
}
