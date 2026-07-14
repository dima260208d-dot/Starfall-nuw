import { TILE_CELL_SIZE } from "../game/TileMap";
import { appendSummonAutoAimTargets } from "./autoAimSummons";

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function angleTo(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function rectCircleCollide(
  rx: number, ry: number, rw: number, rh: number,
  cx: number, cy: number, cr: number
): boolean {
  const nearX = clamp(cx, rx, rx + rw);
  const nearY = clamp(cy, ry, ry + rh);
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}

export function circleCircleCollide(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  const d = distance(x1, y1, x2, y2);
  return d < r1 + r2;
}

export function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export interface AutoAimTarget {
  alive: boolean;
  inBush: boolean;
  inOctaviaInk?: boolean;
  team: string;
  x: number;
  y: number;
  radius: number;
  isPlayer?: boolean;
  bushRevealTimer?: number;
}

export interface AutoAimCamera {
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
}

export interface AutoAimCrate {
  x: number;
  y: number;
  w: number;
  h: number;
  destroyed: boolean;
}

export interface AutoAimOptions {
  camera?: AutoAimCamera;
  viewerTeam?: string;
  friendliesInBush?: { tx: number; ty: number }[];
  /** Power boxes — only when no visible enemy in range. */
  crates?: AutoAimCrate[];
}

function visibleRangeFromPlayer(
  player: { x: number; y: number },
  cam: AutoAimCamera,
): number {
  const ww = cam.w / cam.zoom;
  const wh = cam.h / cam.zoom;
  const corners: [number, number][] = [
    [cam.x, cam.y],
    [cam.x + ww, cam.y],
    [cam.x + ww, cam.y + wh],
    [cam.x, cam.y + wh],
  ];
  let max = 0;
  for (const [cx, cy] of corners) {
    max = Math.max(max, distance(player.x, player.y, cx, cy));
  }
  return max;
}

function isOnScreen(wx: number, wy: number, cam: AutoAimCamera, margin = 48): boolean {
  const ww = cam.w / cam.zoom;
  const wh = cam.h / cam.zoom;
  return (
    wx >= cam.x - margin &&
    wx <= cam.x + ww + margin &&
    wy >= cam.y - margin &&
    wy <= cam.y + wh + margin
  );
}

/** Same bush-hide rules as battle3DWorld syncBrawlerEntry. */
export function isAutoAimTargetVisible(
  target: AutoAimTarget,
  viewerTeam: string,
  friendliesInBush: { tx: number; ty: number }[],
): boolean {
  if (!target.alive || target.team === viewerTeam) return false;
  const isEnemyToViewer = !target.isPlayer && target.team !== viewerTeam;
  if (!isEnemyToViewer || (!target.inBush && !target.inOctaviaInk)) return true;
  let revealed = (target.bushRevealTimer ?? 0) > 0;
  if (!revealed && target.inBush) {
    const bTx = Math.floor(target.x / TILE_CELL_SIZE);
    const bTy = Math.floor(target.y / TILE_CELL_SIZE);
    for (const f of friendliesInBush) {
      if (Math.abs(bTx - f.tx) <= 1 && Math.abs(bTy - f.ty) <= 1) {
        revealed = true;
        break;
      }
    }
  }
  if (!revealed && target.inOctaviaInk) return false;
  return revealed;
}

/** Nearest intact power box in visible range (enemies take priority in autoAimAngle). */
export function autoAimCrateTarget(
  player: { x: number; y: number; stats: { attackRange: number } },
  crates: AutoAimCrate[],
  rangeMultiplier = 1.15,
  opts?: AutoAimOptions,
): { x: number; y: number } | null {
  if (!crates.length) return null;
  let range = player.stats.attackRange * rangeMultiplier;
  if (opts?.camera) {
    range = Math.min(range, visibleRangeFromPlayer(player, opts.camera));
  }
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const c of crates) {
    if (c.destroyed) continue;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    if (opts?.camera && !isOnScreen(cx, cy, opts.camera)) continue;
    const crateR = Math.hypot(c.w, c.h) * 0.5;
    const d = distance(player.x, player.y, cx, cy);
    if (d < range + crateR && d < bestD) {
      bestD = d;
      best = { x: cx, y: cy };
    }
  }
  return best;
}

export function autoAimAngle(
  player: { x: number; y: number; team: string; stats: { attackRange: number } },
  candidates: AutoAimTarget[],
  fallbackAngle: number,
  rangeMultiplier = 1.15,
  opts?: AutoAimOptions,
): number {
  const best = autoAimTarget(player, candidates, rangeMultiplier, opts);
  if (best) return angleTo(player.x, player.y, best.x, best.y);
  const crates = opts?.crates;
  if (crates?.length) {
    const crate = autoAimCrateTarget(player, crates, rangeMultiplier, opts);
    if (crate) return angleTo(player.x, player.y, crate.x, crate.y);
  }
  return fallbackAngle;
}

export function autoAimTarget(
  player: { x: number; y: number; team: string; stats: { attackRange: number } },
  candidates: AutoAimTarget[],
  rangeMultiplier = 1.15,
  opts?: AutoAimOptions,
): AutoAimTarget | null {
  let range = player.stats.attackRange * rangeMultiplier;
  if (opts?.camera) {
    range = Math.min(range, visibleRangeFromPlayer(player, opts.camera));
  }
  const viewerTeam = opts?.viewerTeam ?? player.team;
  const friendliesInBush = opts?.friendliesInBush ?? [];
  const merged = appendSummonAutoAimTargets(viewerTeam, candidates);
  let best: AutoAimTarget | null = null;
  let bestD = Infinity;
  for (const c of merged) {
    if (!c.alive) continue;
    if (c.team === player.team) continue;
    if (opts?.camera && !isOnScreen(c.x, c.y, opts.camera)) continue;
    if (!isAutoAimTargetVisible(c, viewerTeam, friendliesInBush)) continue;
    const d = distance(player.x, player.y, c.x, c.y);
    if (d < range + c.radius && d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export interface LOSWall { x: number; y: number; w: number; h: number; solid: boolean }

// Returns true if the segment from (x1,y1)→(x2,y2) intersects any solid wall rect.
export function lineBlockedByWalls(
  x1: number, y1: number, x2: number, y2: number, walls: LOSWall[]
): boolean {
  for (const w of walls) {
    if (!w.solid) continue;
    if (segIntersectsRect(x1, y1, x2, y2, w.x, w.y, w.x + w.w, w.y + w.h)) return true;
  }
  return false;
}

function segIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  rx1: number, ry1: number, rx2: number, ry2: number
): boolean {
  // Quick reject if the segment's bounding box doesn't touch the rect
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  if (maxX < rx1 || minX > rx2 || maxY < ry1 || minY > ry2) return false;
  // If either endpoint is inside the rect, blocked
  if (x1 >= rx1 && x1 <= rx2 && y1 >= ry1 && y1 <= ry2) return true;
  if (x2 >= rx1 && x2 <= rx2 && y2 >= ry1 && y2 <= ry2) return true;
  // Test against the four edges
  return (
    segSeg(x1, y1, x2, y2, rx1, ry1, rx2, ry1) ||
    segSeg(x1, y1, x2, y2, rx2, ry1, rx2, ry2) ||
    segSeg(x1, y1, x2, y2, rx2, ry2, rx1, ry2) ||
    segSeg(x1, y1, x2, y2, rx1, ry2, rx1, ry1)
  );
}

function segSeg(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): boolean {
  const r = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (r === 0) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / r;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / r;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function hpColor(ratio: number): string {
  const r = Math.floor(255 * (1 - ratio));
  const g = Math.floor(255 * ratio);
  return `rgb(${r},${g},0)`;
}
