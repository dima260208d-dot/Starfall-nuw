import type { DevBattleMonster } from "./devBattleMonsters";
import type { TileGrid } from "../game/TileMap";
import { TileType, getTile, TILE_CELL_SIZE } from "../game/TileMap";
import { isTileWalkable } from "../ai/aiNavigation";
import { distance } from "./helpers";
import { spawnEffect } from "./effects";

export const MONSTER_HIDE_MATCH_SEC = 180;
export const MONSTER_HIDE_KILL_TIME_BONUS = 15;
export const MONSTER_HIDE_MAX_TIME_BONUS = 60;
export const MONSTER_HIDE_COUNT = 10;
export const MONSTER_HIDE_TROPHY_PER_KILL = 1;
export const MONSTER_HIDE_TELEPORT_RADIUS = 300;
export const MONSTER_HIDE_ABILITY_CHANCE = 0.2;

export interface TeleportSmoke {
  x: number;
  y: number;
  timer: number;
}

const smokes: TeleportSmoke[] = [];

export function clearMonsterHideEffects(): void {
  smokes.length = 0;
}

export function getMonsterHideSmokes(): readonly TeleportSmoke[] {
  return smokes;
}

export function pickRandomBushPositions(
  tileGrid: TileGrid,
  count: number,
  minSeparation = 120,
): Array<{ x: number; y: number }> {
  const C = tileGrid.cellSize;
  const bushes: Array<{ x: number; y: number }> = [];
  for (let ty = 2; ty < tileGrid.height - 2; ty++) {
    for (let tx = 2; tx < tileGrid.width - 2; tx++) {
      if (getTile(tileGrid, tx, ty) !== TileType.BUSH) continue;
      bushes.push({ x: (tx + 0.5) * C, y: (ty + 0.5) * C });
    }
  }
  for (let i = bushes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bushes[i], bushes[j]] = [bushes[j], bushes[i]];
  }
  const picked: Array<{ x: number; y: number }> = [];
  for (const p of bushes) {
    if (picked.some(q => distance(p.x, p.y, q.x, q.y) < minSeparation)) continue;
    picked.push(p);
    if (picked.length >= count) break;
  }
  while (picked.length < count && bushes.length > 0) {
    picked.push(bushes[picked.length % bushes.length]);
  }
  return picked;
}

export function isMonsterInBush(m: DevBattleMonster, tileGrid?: TileGrid): boolean {
  if (!tileGrid) return false;
  const tx = Math.floor(m.x / TILE_CELL_SIZE);
  const ty = Math.floor(m.y / TILE_CELL_SIZE);
  return getTile(tileGrid, tx, ty) === TileType.BUSH;
}

/** Куст скрывает монстра от синей команды — те же правила, что у вражеских бойцов. */
export function isDevMonsterHiddenFromBlues(
  m: DevBattleMonster,
  tileGrid: TileGrid | undefined,
  blues: ReadonlyArray<{ x: number; y: number; alive: boolean; inBush?: boolean }>,
): boolean {
  if (!m.alive || !tileGrid || !isMonsterInBush(m, tileGrid)) return false;
  if ((m.bushRevealTimer ?? 0) > 0) return false;
  const C = tileGrid.cellSize;
  const mTx = Math.floor(m.x / C);
  const mTy = Math.floor(m.y / C);
  for (const b of blues) {
    if (!b.alive || !b.inBush) continue;
    const bTx = Math.floor(b.x / C);
    const bTy = Math.floor(b.y / C);
    if (Math.abs(mTx - bTx) <= 1 && Math.abs(mTy - bTy) <= 1) return false;
  }
  return true;
}

export function isMonsterVisibleToPlayers(m: DevBattleMonster, tileGrid?: TileGrid): boolean {
  if (!m.alive) return false;
  if (m.hideInvisible) return false;
  if (!isMonsterInBush(m, tileGrid)) return true;
  return false;
}

function findTeleportBush(
  m: DevBattleMonster,
  tileGrid: TileGrid,
  mapW: number,
  mapH: number,
): { x: number; y: number } | null {
  const candidates = pickRandomBushPositions(tileGrid, 24, 40);
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (const p of candidates) {
    const d = distance(m.x, m.y, p.x, p.y);
    if (d > MONSTER_HIDE_TELEPORT_RADIUS || d < 40) continue;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  if (best) return best;
  const C = tileGrid.cellSize;
  for (let attempt = 0; attempt < 32; attempt++) {
    const tx = 3 + Math.floor(Math.random() * (tileGrid.width - 6));
    const ty = 3 + Math.floor(Math.random() * (tileGrid.height - 6));
    if (getTile(tileGrid, tx, ty) !== TileType.BUSH) continue;
    const wx = (tx + 0.5) * C;
    const wy = (ty + 0.5) * C;
    const d = distance(m.x, m.y, wx, wy);
    if (d > MONSTER_HIDE_TELEPORT_RADIUS || d < 40) continue;
    if (wx < 80 || wy < 80 || wx > mapW - 80 || wy > mapH - 80) continue;
    return { x: wx, y: wy };
  }
  return null;
}

export function onMonsterHideDamaged(m: DevBattleMonster): void {
  if (m.hideSpeedBoostTimer && m.hideSpeedBoostTimer > 0) return;
  if (Math.random() >= MONSTER_HIDE_ABILITY_CHANCE) return;
  m.hideSpeedBoostTimer = 2;
  m.speed = (m.hideBaseSpeed ?? m.speed) * 1.2;
}

export function tryMonsterHideTeleport(
  m: DevBattleMonster,
  tileGrid: TileGrid,
  mapW: number,
  mapH: number,
): boolean {
  if (m.hideTeleportUsed) return false;
  if (Math.random() >= MONSTER_HIDE_ABILITY_CHANCE) return false;
  const dest = findTeleportBush(m, tileGrid, mapW, mapH);
  if (!dest) return false;
  m.hideTeleportUsed = true;
  smokes.push({ x: m.x, y: m.y, timer: 2 });
  spawnEffect({
    kind: "burst",
    x: m.x,
    y: m.y,
    radius: 48,
    color: "#9E9E9E",
    timer: 2,
    maxTimer: 2,
  });
  m.x = dest.x;
  m.y = dest.y;
  m.hideStillSec = 0;
  m.hideInvisible = false;
  return true;
}

export function tickMonsterHideStillness(
  m: DevBattleMonster,
  dt: number,
  tileGrid?: TileGrid,
  moved: boolean,
): void {
  if (!m.alive) return;
  if (!isMonsterInBush(m, tileGrid)) {
    m.hideStillSec = 0;
    m.hideInvisible = false;
    return;
  }
  if (moved) {
    m.hideStillSec = 0;
    m.hideInvisible = false;
    return;
  }
  m.hideStillSec = (m.hideStillSec ?? 0) + dt;
  if (m.hideStillSec >= 3 && !m.hideInvisible && Math.random() < MONSTER_HIDE_ABILITY_CHANCE * dt) {
    m.hideInvisible = true;
  }
}

export function tickMonsterHideSpeedBoost(m: DevBattleMonster, dt: number): void {
  if (!m.hideSpeedBoostTimer || m.hideSpeedBoostTimer <= 0) return;
  m.hideSpeedBoostTimer -= dt;
  if (m.hideSpeedBoostTimer <= 0) {
    m.hideSpeedBoostTimer = 0;
    if (m.hideBaseSpeed != null) m.speed = m.hideBaseSpeed;
  }
}

export function tickMonsterHideSmokes(dt: number): void {
  for (let i = smokes.length - 1; i >= 0; i--) {
    smokes[i].timer -= dt;
    if (smokes[i].timer <= 0) smokes.splice(i, 1);
  }
}

export function prepareMonsterForHide(m: DevBattleMonster): void {
  m.hideBaseSpeed = m.speed;
  m.hideStillSec = 0;
  m.hideInvisible = false;
  m.hideTeleportUsed = false;
  m.hideSpeedBoostTimer = 0;
}

export function findNearestBushTile(
  tileGrid: TileGrid,
  fromX: number,
  fromY: number,
  maxDist: number,
): { x: number; y: number } | null {
  const C = tileGrid.cellSize;
  const tx0 = Math.floor(fromX / C);
  const ty0 = Math.floor(fromY / C);
  const maxCells = Math.ceil(maxDist / C);
  let best: { x: number; y: number; d: number } | null = null;
  for (let dy = -maxCells; dy <= maxCells; dy++) {
    for (let dx = -maxCells; dx <= maxCells; dx++) {
      const tx = tx0 + dx;
      const ty = ty0 + dy;
      if (getTile(tileGrid, tx, ty) !== TileType.BUSH) continue;
      if (!isTileWalkable(tileGrid, tx, ty)) continue;
      const wx = (tx + 0.5) * C;
      const wy = (ty + 0.5) * C;
      const d = distance(fromX, fromY, wx, wy);
      if (d > maxDist) continue;
      if (!best || d < best.d) best = { x: wx, y: wy, d };
    }
  }
  return best ? { x: best.x, y: best.y } : null;
}
