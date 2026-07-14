import { TileType as T, BATTLE_MAP_RIM_CELLS } from "../../game/TileMap";
import { OV, type EditorMode } from "../../utils/mapEditorAPI";

export const GS = 60;
export const HALF = 30;
/** Совпадает с paintMountainBorderRing в бою — контент от края арены, без пустой полосы. */
export const PLAY_LO = BATTLE_MAP_RIM_CELLS;
export const PLAY_HI = GS - 1 - BATTLE_MAP_RIM_CELLS;
export const CX = 29;
export const CY = 29;
export const LEFT = PLAY_LO + 2;
export const RIGHT = PLAY_HI - 2;
export const TOP = PLAY_LO + 2;
export const BOT = PLAY_HI - 2;

export { T as Tile, OV };

export class MapBuilder {
  readonly cells = new Array<number>(GS * GS).fill(T.GRASS);
  readonly overlays = new Array<number>(GS * GS).fill(OV.NONE);
  private readonly protectedCells = new Set<number>();

  idx(x: number, y: number): number {
    return y * GS + x;
  }

  inPlay(x: number, y: number): boolean {
    return x >= PLAY_LO && x <= PLAY_HI && y >= PLAY_LO && y <= PLAY_HI;
  }

  protect(x: number, y: number, r = 4): void {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < GS && ny < GS) {
          this.protectedCells.add(this.idx(nx, ny));
        }
      }
    }
  }

  canPaint(x: number, y: number): boolean {
    return this.inPlay(x, y) && !this.protectedCells.has(this.idx(x, y));
  }

  set(x: number, y: number, tile: number): void {
    if (!this.canPaint(x, y)) return;
    this.cells[this.idx(x, y)] = tile;
  }

  /** Плотное заполнение — игнорирует protect, но не overlay-клетки. */
  forceSet(x: number, y: number, tile: number): void {
    if (!this.inPlay(x, y)) return;
    if (this.overlays[this.idx(x, y)] !== OV.NONE) return;
    this.cells[this.idx(x, y)] = tile;
  }

  /** Равномерное открытое заполнение по всей арене (50–60% после carve). */
  applyOpenDenseFill(variant = 0, skipCenter = false): void {
    const tiles = [T.BUSH, T.BUSH, T.FENCE, T.WALL, T.SAND_WALL];
    for (let y = PLAY_LO + 1; y <= PLAY_HI - 1; y++) {
      for (let x = PLAY_LO + 1; x <= PLAY_HI - 1; x++) {
        if (skipCenter && Math.abs(x - CX) <= 2 && Math.abs(y - CY) <= 2) continue;
        const h = x + y + variant;
        if (h % 2 !== 0 && h % 5 !== 0) continue;
        if (this.overlays[this.idx(x, y)] !== OV.NONE) continue;
        const tile = tiles[(x * 13 + y * 29 + variant) % tiles.length];
        this.forceSet(x, y, tile);
      }
    }
  }

  ov(x: number, y: number, type: number): void {
    if (!this.inPlay(x, y)) return;
    const pr =
      type === OV.POWER_BOX ? 1
        : type === OV.GEM_CENTER ? 2
          : (type === OV.SPAWN_SD || type === OV.SPAWN_BLUE || type === OV.SPAWN_RED) ? 1
            : 2;
    this.protect(x, y, pr);
    for (let dy = -pr; dy <= pr; dy++) {
      for (let dx = -pr; dx <= pr; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!this.inPlay(nx, ny)) continue;
        this.cells[this.idx(nx, ny)] = T.GRASS;
      }
    }
    const i = this.idx(x, y);
    this.cells[i] = T.GRASS;
    this.overlays[i] = type;
  }

  pair(lx: number, ly: number, lOv: number, rOv: number): void {
    this.ov(lx, ly, lOv);
    this.ov(GS - 1 - lx, ly, rOv);
  }

  rect(x: number, y: number, w: number, h: number, tile: number): void {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(x + dx, y + dy, tile);
      }
    }
  }

  hline(x: number, y: number, len: number, tile: number): void {
    for (let i = 0; i < len; i++) this.set(x + i, y, tile);
  }

  vline(x: number, y: number, len: number, tile: number): void {
    for (let i = 0; i < len; i++) this.set(x, y + i, tile);
  }

  /** L-corner: 0=SE, 1=SW, 2=NE, 3=NW */
  L(x: number, y: number, len: number, ori: number, tile: number): void {
    for (let k = 0; k < len; k++) {
      if (ori === 0) {
        this.set(x + k, y, tile);
        this.set(x, y + k, tile);
      } else if (ori === 1) {
        this.set(x - k, y, tile);
        this.set(x, y + k, tile);
      } else if (ori === 2) {
        this.set(x + k, y, tile);
        this.set(x, y - k, tile);
      } else {
        this.set(x - k, y, tile);
        this.set(x, y - k, tile);
      }
    }
  }

  cross(x: number, y: number, arm: number, tile: number): void {
    for (let k = -arm; k <= arm; k++) {
      this.set(x + k, y, tile);
      this.set(x, y + k, tile);
    }
  }

  bushBlob(cx: number, cy: number, r: number): void {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > r + 0.35) continue;
        if (d > r - 0.8 || Math.random() < 0.55) {
          this.set(cx + dx, cy + dy, T.BUSH);
        }
      }
    }
  }

  /** Deterministic bush blob (no Math.random). */
  bushPatch(cx: number, cy: number, r: number, density = 0.72): void {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > r + 0.2) continue;
        const ring = d >= r - 0.85 && d <= r + 0.15;
        const hash = ((cx + dx) * 17 + (cy + dy) * 31) % 100;
        if (ring || hash / 100 < density * (1 - d / (r + 1))) {
          this.set(cx + dx, cy + dy, T.BUSH);
        }
      }
    }
  }

  waterRect(x: number, y: number, w: number, h: number): void {
    this.rect(x, y, w, h, T.WATER);
  }

  room(x: number, y: number, w: number, h: number, wall: number, inner?: number): void {
    this.rect(x, y, w, 1, wall);
    this.rect(x, y + h - 1, w, 1, wall);
    this.rect(x, y, 1, h, wall);
    this.rect(x + w - 1, y, 1, h, wall);
    if (inner !== undefined) this.rect(x + 1, y + 1, w - 2, h - 2, inner);
  }

  scatterBones(count: number, seed: number): void {
    for (let i = 0; i < count; i++) {
      const x = PLAY_LO + 2 + ((seed + i * 13) % (PLAY_HI - PLAY_LO - 4));
      const y = PLAY_LO + 2 + ((seed + i * 29) % (PLAY_HI - PLAY_LO - 4));
      if (this.cells[this.idx(x, y)] === T.GRASS) this.set(x, y, T.DECORATION);
    }
  }

  mirrorX(): void {
    for (let y = 0; y < GS; y++) {
      for (let x = 0; x < HALF; x++) {
        const t = this.cells[this.idx(x, y)];
        if (t === T.GRASS) continue;
        const rx = GS - 1 - x;
        if (!this.protectedCells.has(this.idx(rx, y))) {
          this.cells[this.idx(rx, y)] = t;
        }
      }
    }
  }

  mirrorY(): void {
    for (let y = 0; y < HALF; y++) {
      for (let x = 0; x < GS; x++) {
        const t = this.cells[this.idx(x, y)];
        if (t === T.GRASS) continue;
        const ry = GS - 1 - y;
        if (!this.protectedCells.has(this.idx(x, ry))) {
          this.cells[this.idx(x, ry)] = t;
        }
      }
    }
  }

  /** 4-way symmetry around map center (for showdown layouts). */
  mirrorRot4(): void {
    for (let y = PLAY_LO; y <= CY; y++) {
      for (let x = PLAY_LO; x <= CX; x++) {
        const t = this.cells[this.idx(x, y)];
        if (t === T.GRASS) continue;
        const pts: [number, number][] = [
          [x, y],
          [GS - 1 - x, y],
          [x, GS - 1 - y],
          [GS - 1 - x, GS - 1 - y],
        ];
        for (const [px, py] of pts) {
          if (this.inPlay(px, py) && !this.protectedCells.has(this.idx(px, py))) {
            this.cells[this.idx(px, py)] = t;
          }
        }
      }
    }
  }

  /** Главные осевые коридоры — гарантия связности после плотного fill. */
  carveAxisCorridors(): void {
    for (let y = PLAY_LO; y <= PLAY_HI; y++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = CX + dx;
        if (this.inPlay(x, y)) this.cells[this.idx(x, y)] = T.GRASS;
      }
    }
    for (let x = PLAY_LO; x <= PLAY_HI; x++) {
      for (let dy = -1; dy <= 1; dy++) {
        const y = CY + dy;
        if (this.inPlay(x, y)) this.cells[this.idx(x, y)] = T.GRASS;
      }
    }
  }

  /** Убрать кусты/декор в недостижимых зонах (замурованные укрытия). */
  purgeUnreachableCover(): void {
    const walkable = (t: number) => t === T.GRASS || t === T.BUSH || t === T.HEAL;
    const visited = new Uint8Array(GS * GS);
    const queue: [number, number][] = [];
    const seeds: [number, number][] = [[CX, CY], [LEFT, CY], [RIGHT, CY]];
    for (const [sx, sy] of seeds) {
      if (!this.inPlay(sx, sy)) continue;
      const si = this.idx(sx, sy);
      if (!walkable(this.cells[si]) || visited[si]) continue;
      visited[si] = 1;
      queue.push([sx, sy]);
    }
    while (queue.length) {
      const [x, y] = queue.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inPlay(nx, ny)) continue;
        const ni = this.idx(nx, ny);
        if (visited[ni] || !walkable(this.cells[ni])) continue;
        visited[ni] = 1;
        queue.push([nx, ny]);
      }
    }
    for (let y = PLAY_LO; y <= PLAY_HI; y++) {
      for (let x = PLAY_LO; x <= PLAY_HI; x++) {
        const i = this.idx(x, y);
        const t = this.cells[i];
        if (visited[i]) continue;
        if (t === T.BUSH || t === T.DECORATION || t === T.HEAL) {
          this.cells[i] = T.GRASS;
        }
      }
    }
  }

  clearAroundOverlays(): void {
    for (let i = 0; i < this.overlays.length; i++) {
      if (this.overlays[i] !== OV.NONE) this.cells[i] = T.GRASS;
    }
  }

  /** После плотного fill — снова вычистить зоны маркеров (боксы, гем, спавны). */
  scrubOverlayNeighborhoods(): void {
    for (let y = PLAY_LO; y <= PLAY_HI; y++) {
      for (let x = PLAY_LO; x <= PLAY_HI; x++) {
        const ov = this.overlays[this.idx(x, y)];
        if (ov === OV.NONE) continue;
        let pr = 1;
        if (ov === OV.GEM_CENTER) pr = 2;
        else if (ov === OV.POWER_BOX || ov === OV.SPAWN_SD || ov === OV.SPAWN_BLUE || ov === OV.SPAWN_RED) pr = 1;
        else if (ov === OV.BOSS_SPAWN) pr = 2;
        for (let dy = -pr; dy <= pr; dy++) {
          for (let dx = -pr; dx <= pr; dx++) {
            const nx = x + dx, ny = y + dy;
            if (!this.inPlay(nx, ny)) continue;
            this.cells[this.idx(nx, ny)] = T.GRASS;
          }
        }
      }
    }
  }
}

export interface CuratedBlueprint {
  id: string;
  name: string;
  mode: EditorMode;
  paint: (b: MapBuilder) => void;
  symmetry?: "none" | "x" | "y" | "xy" | "rot4";
  variant?: number;
}
