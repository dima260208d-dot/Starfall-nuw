/**
 * ─── Общая навигация для всех ИИ в игре ─────────────────────────────────────
 *
 * Единственная точка истины «что ИИ может увидеть и куда может пойти».
 * Используется и автопилотом (`AstralAutoplay`), и обычными ботами (`Bot`),
 * и боссами (`bossRaidAttacks`), чтобы у них была:
 *
 *   • синхронизированная картина мира (LOS через тайлы и стены),
 *   • понимание границ карты (никаких выходов за край),
 *   • дешёвый pathfinding на тайл-сетке (BFS с эвристикой расстояния),
 *   • безопасные точки для wander/regroup (не в воде/в горе/за стеной).
 *
 * Все функции дёшевы: ни одна не делает аллокаций в hot-path кроме
 * `bfsTilePath` (один Uint16Array на вызов, переиспользуется через cache),
 * и все они работают на ОДНОМ кадре — никакой персистентной структуры данных.
 *
 * Архитектурный принцип: ИИ задаёт «куда хочу попасть», навигация отвечает
 * «куда реально пойти на следующем шаге», учитывая стены и края. ИИ не
 * должен знать про тайлы напрямую — только через эти хелперы.
 */

import { TileGrid, TileType, TILE_PROPS, TILE_CELL_SIZE, getTile, collidesWithTileGrid } from "../game/TileMap";
import { collidesWithWalls } from "../game/MapRenderer";
import { brawlerFootWorldDy } from "../game/battleVisualScale";

// ── Базовые типы ─────────────────────────────────────────────────────────────

/**
 * Минимальный интерфейс игровой карты, который нужен ИИ. Совместим и с
 * legacy GameMap (walls + width/height), и с TileGrid-картой (tileGrid).
 */
export interface NavMap {
  width: number;
  height: number;
  walls?: Array<{ x: number; y: number; w: number; h: number; solid?: boolean }>;
  tileGrid?: TileGrid;
}

export interface Point { x: number; y: number; }

// ── 1. Границы карты ────────────────────────────────────────────────────────

/**
 * Проверяет, что точка лежит ВНУТРИ играбельной области карты.
 * Учитывает rim из MOUNTAIN (10 клеток по периметру в большинстве режимов) —
 * считаем, что играбельная зона начинается от `rimWorld` отступа от края.
 */
export function isInsideArena(map: NavMap, x: number, y: number, padding = 0): boolean {
  const minX = padding;
  const minY = padding;
  const maxX = map.width - padding;
  const maxY = map.height - padding;
  return x >= minX && y >= minY && x <= maxX && y <= maxY;
}

/**
 * Зажимает точку внутри играбельной области. Не делает реальной коллизии со
 * стенами — только границы карты. Для коллизий используйте `clampAwayFromObstacles`.
 */
export function clampToArena(map: NavMap, x: number, y: number, padding = 0): Point {
  const minX = padding;
  const minY = padding;
  const maxX = map.width - padding;
  const maxY = map.height - padding;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

/**
 * Возвращает «безопасный отступ» от края, учитывающий rim карты. Большинство
 * tileGrid-карт имеют 10-клеточную каёмку MOUNTAIN, поэтому реальная играбельная
 * зона = [10*C, width-10*C]. Берём 8*C чтобы не клеить ИИ к самой кромке.
 */
export function arenaPadding(map: NavMap): number {
  if (!map.tileGrid) return 30;
  return TILE_CELL_SIZE * 10;
}

// ── 2. LOS (line-of-sight) ──────────────────────────────────────────────────

/**
 * Проверяет, блокирована ли прямая линия от (x1,y1) до (x2,y2) стенами или
 * непрозрачными тайлами. Используется для:
 *   • атак: «можно ли отсюда выстрелить врагу?»
 *   • тарга: «вижу ли я этого врага вообще?»
 *
 * Сэмплирует линию шагом ~половина клетки — даёт достаточную точность, но
 * остаётся O(distance/CELL).
 */
export function tileLineBlocked(
  grid: TileGrid | undefined,
  x1: number, y1: number,
  x2: number, y2: number,
): boolean {
  if (!grid) return false;
  const C = grid.cellSize;
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(2, Math.ceil((dist / C) * 2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const sx = x1 + (x2 - x1) * t;
    const sy = y1 + (y2 - y1) * t;
    const tx = Math.floor(sx / C);
    const ty = Math.floor(sy / C);
    const type = getTile(grid, tx, ty);
    const props = TILE_PROPS[type];
    if (!props) continue;
    // Считаем тайл блокирующим если он непроходим И непрозрачен (стены/горы/
    // дерево). Кусты/трава/вода НЕ блокируют выстрел (shootThrough=true).
    if (!props.shootThrough && !props.walkable) return true;
  }
  return false;
}

/**
 * Проверяет блокировку линии стенами legacy (Wall[]). Дешевая обёртка —
 * можно использовать совместно с `tileLineBlocked` через `||`.
 */
export function wallLineBlocked(
  walls: NavMap["walls"] | undefined,
  x1: number, y1: number, x2: number, y2: number,
): boolean {
  if (!walls) return false;
  for (const w of walls) {
    if (w.solid === false) continue;
    if (segIntersectsRect(x1, y1, x2, y2, w.x, w.y, w.x + w.w, w.y + w.h)) return true;
  }
  return false;
}

/** Полная LOS-проверка: и тайлы, и стены. */
export function isLineBlocked(
  map: NavMap,
  x1: number, y1: number, x2: number, y2: number,
): boolean {
  return tileLineBlocked(map.tileGrid, x1, y1, x2, y2) || wallLineBlocked(map.walls, x1, y1, x2, y2);
}

// ── 3. Проходимость клетки ──────────────────────────────────────────────────

/**
 * Можно ли стоять в клетке (tx, ty)? Учитывает walkable из TILE_PROPS и
 * границы grid'а (за границей считаем «горой», т.е. не walkable).
 */
export function isTileWalkable(grid: TileGrid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return false;
  // Учитываем разрушенные тайлы (становятся травой).
  const idx = ty * grid.width + tx;
  if (grid.destroyed?.[idx]) return true;
  const type = grid.cells[idx];
  const props = TILE_PROPS[type];
  return !!props && props.walkable;
}

/** То же для мировых координат. */
export function isWorldPosWalkable(grid: TileGrid, x: number, y: number): boolean {
  const tx = Math.floor(x / grid.cellSize);
  const ty = Math.floor(y / grid.cellSize);
  return isTileWalkable(grid, tx, ty);
}

// ── 4. Pathfinding (BFS на тайл-сетке) ───────────────────────────────────────

/**
 * Кешированный буфер для BFS. Размер фиксированный = 64×64 = 4096 (хватит для
 * любой текущей карты GRID_SIZE=60). Один буфер на процесс — все ИИ
 * последовательно его переиспользуют. BFS не реентерабелен, но за один tick
 * он вызывается максимум ~10 раз последовательно из разных ботов, что ок.
 */
const BFS_BUF_W = 80;
const BFS_BUF_H = 80;
const bfsVisited = new Uint8Array(BFS_BUF_W * BFS_BUF_H);
const bfsParent = new Int32Array(BFS_BUF_W * BFS_BUF_H);
const bfsQueue = new Int32Array(BFS_BUF_W * BFS_BUF_H);

/**
 * BFS от стартовой клетки до целевой по проходимым тайлам.
 *
 * Возвращает следующую клетку «куда сделать шаг» (НЕ полный путь — это
 * экономит память и достаточно для steering'а: ИИ перевычисляет путь
 * каждые ~200ms и идёт всегда к ближайшей цели на пути).
 *
 * Ограничения:
 *   • Если grid.width × grid.height > 80×80 — функция вернёт null (карта
 *     слишком большая, fallback на greedy steer).
 *   • Если путь длиннее `maxNodes` шагов — тоже null (цель далеко, лучше
 *     идти жадно по прямой и периодически перевычислять).
 */
export function bfsNextStep(
  grid: TileGrid,
  fromX: number, fromY: number,
  toX: number, toY: number,
  maxNodes = 600,
): Point | null {
  const W = grid.width;
  const H = grid.height;
  if (W > BFS_BUF_W || H > BFS_BUF_H) return null;
  const C = grid.cellSize;
  const fromTx = Math.floor(fromX / C);
  const fromTy = Math.floor(fromY / C);
  const toTx = Math.floor(toX / C);
  const toTy = Math.floor(toY / C);
  if (fromTx === toTx && fromTy === toTy) return null; // уже на цели
  if (!isTileWalkable(grid, toTx, toTy)) {
    // Цель в стене — попробуем найти ближайшую проходимую клетку рядом с целью.
    const adj = nearestWalkableAround(grid, toTx, toTy, 3);
    if (!adj) return null;
    return bfsNextStep(grid, fromX, fromY, (adj.tx + 0.5) * C, (adj.ty + 0.5) * C, maxNodes);
  }

  bfsVisited.fill(0);
  const startIdx = fromTy * W + fromTx;
  const goalIdx = toTy * W + toTx;
  bfsVisited[startIdx] = 1;
  bfsParent[startIdx] = -1;
  let qHead = 0, qTail = 0;
  bfsQueue[qTail++] = startIdx;

  let found = false;
  let visited = 0;
  while (qHead < qTail && visited < maxNodes) {
    const idx = bfsQueue[qHead++];
    visited++;
    if (idx === goalIdx) { found = true; break; }
    const ty = (idx / W) | 0;
    const tx = idx - ty * W;
    // 4 направления — диагонали бы давали красивее путь, но дороже и
    // создают «срезание углов» сквозь стены без дополнительной проверки.
    const neighbors = [
      [tx + 1, ty],
      [tx - 1, ty],
      [tx, ty + 1],
      [tx, ty - 1],
    ];
    for (let k = 0; k < 4; k++) {
      const nx = neighbors[k][0];
      const ny = neighbors[k][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nIdx = ny * W + nx;
      if (bfsVisited[nIdx]) continue;
      if (!isTileWalkable(grid, nx, ny)) continue;
      bfsVisited[nIdx] = 1;
      bfsParent[nIdx] = idx;
      bfsQueue[qTail++] = nIdx;
    }
  }

  if (!found) return null;

  // Восстанавливаем первый шаг от start: идём от goal к start через parent.
  let cur = goalIdx;
  let prev = goalIdx;
  while (bfsParent[cur] !== -1 && bfsParent[cur] !== startIdx) {
    prev = cur;
    cur = bfsParent[cur];
  }
  // cur теперь = первый шаг от start; если goal был соседом start, cur=goal.
  const stepIdx = bfsParent[cur] === -1 ? prev : cur;
  const stepTy = (stepIdx / W) | 0;
  const stepTx = stepIdx - stepTy * W;
  return { x: (stepTx + 0.5) * C, y: (stepTy + 0.5) * C };
}

function nearestNavigableForRadius(
  navMap: NavMap,
  tx: number,
  ty: number,
  radius: number,
  searchR: number,
): { tx: number; ty: number } | null {
  const grid = navMap.tileGrid;
  if (!grid) return null;
  const C = grid.cellSize;
  const W = grid.width;
  const H = grid.height;
  const padR = radius + 4;
  const ok = (nx: number, ny: number): boolean => {
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false;
    if (!isTileWalkable(grid, nx, ny)) return false;
    const wx = (nx + 0.5) * C;
    const wy = (ny + 0.5) * C;
    return isWorldPosNavigable(navMap, wx, wy, padR, undefined, 0);
  };
  if (ok(tx, ty)) return { tx, ty };
  for (let r = 1; r <= searchR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (ok(nx, ny)) return { tx: nx, ty: ny };
      }
    }
  }
  return null;
}

/**
 * BFS-шаг с учётом радиуса сущности — для теней Verdeletta и мелких юнитов.
 * Клетка проходима только если центр выдерживает circle-collision с тайлами.
 */
export function bfsNextStepForRadius(
  navMap: NavMap,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  radius: number,
  maxNodes = 1400,
): Point | null {
  const grid = navMap.tileGrid;
  if (!grid) return null;
  const W = grid.width;
  const H = grid.height;
  if (W > BFS_BUF_W || H > BFS_BUF_H) return null;
  const C = grid.cellSize;
  const padR = radius + 4;

  const cellNavigable = (tx: number, ty: number): boolean => {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return false;
    const idx = ty * W + tx;
    if (grid.destroyed[idx]) {
      const wx = (tx + 0.5) * C;
      const wy = (ty + 0.5) * C;
      return isWorldPosNavigable(navMap, wx, wy, padR, undefined, 0);
    }
    if (!isTileWalkable(grid, tx, ty)) return false;
    const wx = (tx + 0.5) * C;
    const wy = (ty + 0.5) * C;
    return isWorldPosNavigable(navMap, wx, wy, padR, undefined, 0);
  };

  let fromTx = Math.floor(fromX / C);
  let fromTy = Math.floor(fromY / C);
  let toTx = Math.floor(toX / C);
  let toTy = Math.floor(toY / C);

  if (!cellNavigable(fromTx, fromTy)) {
    const adj = nearestNavigableForRadius(navMap, fromTx, fromTy, padR, 6);
    if (!adj) return null;
    fromTx = adj.tx;
    fromTy = adj.ty;
  }
  if (fromTx === toTx && fromTy === toTy) return null;

  if (!cellNavigable(toTx, toTy)) {
    const adj = nearestNavigableForRadius(navMap, toTx, toTy, padR, 6);
    if (!adj) return null;
    toTx = adj.tx;
    toTy = adj.ty;
  }

  bfsVisited.fill(0);
  const startIdx = fromTy * W + fromTx;
  const goalIdx = toTy * W + toTx;
  bfsVisited[startIdx] = 1;
  bfsParent[startIdx] = -1;
  let qHead = 0;
  let qTail = 0;
  bfsQueue[qTail++] = startIdx;

  let found = false;
  let visited = 0;
  while (qHead < qTail && visited < maxNodes) {
    const idx = bfsQueue[qHead++];
    visited++;
    if (idx === goalIdx) { found = true; break; }
    const ty = (idx / W) | 0;
    const tx = idx - ty * W;
    const neighbors = [
      [tx + 1, ty],
      [tx - 1, ty],
      [tx, ty + 1],
      [tx, ty - 1],
    ];
    for (let k = 0; k < 4; k++) {
      const nx = neighbors[k][0];
      const ny = neighbors[k][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nIdx = ny * W + nx;
      if (bfsVisited[nIdx]) continue;
      if (!cellNavigable(nx, ny)) continue;
      bfsVisited[nIdx] = 1;
      bfsParent[nIdx] = idx;
      bfsQueue[qTail++] = nIdx;
    }
  }

  if (!found) return null;

  let cur = goalIdx;
  let prev = goalIdx;
  while (bfsParent[cur] !== -1 && bfsParent[cur] !== startIdx) {
    prev = cur;
    cur = bfsParent[cur];
  }
  const stepIdx = bfsParent[cur] === -1 ? prev : cur;
  const stepTy = (stepIdx / W) | 0;
  const stepTx = stepIdx - stepTy * W;
  return { x: (stepTx + 0.5) * C, y: (stepTy + 0.5) * C };
}

/**
 * Ищет ближайшую проходимую клетку вокруг (tx, ty) в spiral до `searchR`.
 * Используется, когда нужно поставить точку «безопасно где-то здесь».
 */
function nearestWalkableAround(
  grid: TileGrid,
  tx: number, ty: number,
  searchR: number,
): { tx: number; ty: number } | null {
  for (let r = 1; r <= searchR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (isTileWalkable(grid, nx, ny)) return { tx: nx, ty: ny };
      }
    }
  }
  return null;
}

// ── 5. Поиск безопасной точки для wander ─────────────────────────────────────

/**
 * Возвращает случайную проходимую точку в радиусе `radius` от текущей позиции,
 * с учётом границ карты и проходимости тайлов. Если не нашли — вернёт null,
 * вызывающий должен fallback на «стоять на месте».
 *
 * Полезно для ИИ, который потерял цель и хочет «куда-то идти», но не должен
 * шагать в стену или за край арены.
 */
export function pickRandomWanderPoint(
  map: NavMap,
  fromX: number, fromY: number,
  radius: number,
  maxTries = 12,
): Point | null {
  const pad = arenaPadding(map);
  for (let i = 0; i < maxTries; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = radius * (0.5 + Math.random() * 0.5);
    const tx = fromX + Math.cos(ang) * r;
    const ty = fromY + Math.sin(ang) * r;
    const clamped = clampToArena(map, tx, ty, pad);
    if (map.tileGrid && !isWorldPosWalkable(map.tileGrid, clamped.x, clamped.y)) continue;
    return clamped;
  }
  return null;
}

// ── 6. Обход препятствий (общий для ботов и автопилота) ───────────────────────

/** Проверка «можно ли сделать шаг» — без жёсткого arenaPadding (он только для целей). */
export function isWorldPosNavigable(
  map: NavMap,
  x: number,
  y: number,
  radius: number,
  brawlerId?: string,
  moveNy = 0,
): boolean {
  const edgePad = Math.max(24, radius);
  if (!isInsideArena(map, x, y, edgePad)) return false;
  if (map.walls && collidesWithWalls(x, y, radius, map.walls).collides) return false;
  if (map.tileGrid) {
    const footDy = moveNy < -0.08 && brawlerId ? brawlerFootWorldDy(brawlerId, radius) : 0;
    if (collidesWithTileGrid(x, y, radius, map.tileGrid, { circleWorldDy: footDy }).collides) {
      return false;
    }
  }
  return true;
}

/**
 * Нормализует желаемое направление и подбирает угол обхода стен/тайлов.
 * При полной блокировке — ищет любой проходимый угол (анти-«крутимся на месте»).
 */
export function steerNavDirection(
  map: NavMap,
  fromX: number,
  fromY: number,
  wantDx: number,
  wantDy: number,
  radius: number,
  brawlerId?: string,
  lookahead = 70,
  greedyFallback = false,
): { x: number; y: number } {
  const len = Math.hypot(wantDx, wantDy);
  if (len < 0.01) return { x: 0, y: 0 };
  const nx = wantDx / len;
  const ny = wantDy / len;

  const testAt = (ax: number, ay: number, dist: number) => {
    const px = fromX + ax * dist;
    const py = fromY + ay * dist;
    return isWorldPosNavigable(map, px, py, radius, brawlerId, ay);
  };

  if (testAt(nx, ny, lookahead)) return { x: nx, y: ny };

  const base = Math.atan2(ny, nx);
  const deltas = [Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];
  for (const d of deltas) {
    const a = base + d;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    if (testAt(cx, cy, lookahead)) return { x: cx, y: cy };
  }

  for (let dist = lookahead * 0.55; dist >= 24; dist -= 18) {
    if (testAt(nx, ny, dist)) return { x: nx, y: ny };
    for (const d of deltas) {
      const a = base + d;
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      if (testAt(cx, cy, dist)) return { x: cx, y: cy };
    }
  }

  if (greedyFallback) return { x: nx, y: ny };
  return { x: 0, y: 0 };
}

// ── 7. Вспомогательные геометрические функции ────────────────────────────────

function segIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  rx1: number, ry1: number, rx2: number, ry2: number,
): boolean {
  if (Math.max(x1, x2) < rx1 || Math.min(x1, x2) > rx2) return false;
  if (Math.max(y1, y2) < ry1 || Math.min(y1, y2) > ry2) return false;
  // Один из концов внутри
  if (x1 >= rx1 && x1 <= rx2 && y1 >= ry1 && y1 <= ry2) return true;
  if (x2 >= rx1 && x2 <= rx2 && y2 >= ry1 && y2 <= ry2) return true;
  // Пересечение с любой из 4 сторон
  return (
    segIntersect(x1, y1, x2, y2, rx1, ry1, rx2, ry1) ||
    segIntersect(x1, y1, x2, y2, rx2, ry1, rx2, ry2) ||
    segIntersect(x1, y1, x2, y2, rx2, ry2, rx1, ry2) ||
    segIntersect(x1, y1, x2, y2, rx1, ry2, rx1, ry1)
  );
}

function segIntersect(
  a1x: number, a1y: number, a2x: number, a2y: number,
  b1x: number, b1y: number, b2x: number, b2y: number,
): boolean {
  const d = (a2x - a1x) * (b2y - b1y) - (a2y - a1y) * (b2x - b1x);
  if (Math.abs(d) < 1e-10) return false;
  const t = ((b1x - a1x) * (b2y - b1y) - (b1y - a1y) * (b2x - b1x)) / d;
  const u = ((b1x - a1x) * (a2y - a1y) - (b1y - a1y) * (a2x - a1x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// ── 7. Поиск ближайшей точки с LOS на цель (для атаки из-за угла) ───────────

/**
 * Если LOS на цель заблокирован стеной — ищет ближайшую проходимую точку
 * рядом со мной, ОТКУДА LOS есть. Полезно для агрессивного флэнка вокруг
 * препятствия.
 *
 * Берёт точки на окружности радиуса `flankRadius` вокруг ИИ и проверяет LOS
 * до цели из каждой. Возвращает первую найденную, или null если ни одна не
 * подходит (значит цель за толстой стеной — лучше идти прямиком в обход).
 */
export function findFlankPointWithLOS(
  map: NavMap,
  fromX: number, fromY: number,
  toX: number, toY: number,
  flankRadius: number,
  samples = 12,
): Point | null {
  const pad = arenaPadding(map);
  // Идём по полному кругу: чередуем по и против часовой, чтобы быстрее найти
  // одну из двух «сторон» препятствия (короткий обход обычно с одной из них).
  for (let i = 1; i <= samples; i++) {
    const sign = i % 2 === 0 ? -1 : 1;
    const ang = sign * (Math.PI / samples) * Math.ceil(i / 2);
    const baseAng = Math.atan2(toY - fromY, toX - fromX) + ang;
    const px = fromX + Math.cos(baseAng) * flankRadius;
    const py = fromY + Math.sin(baseAng) * flankRadius;
    const clamped = clampToArena(map, px, py, pad);
    if (map.tileGrid && !isWorldPosWalkable(map.tileGrid, clamped.x, clamped.y)) continue;
    if (isLineBlocked(map, clamped.x, clamped.y, toX, toY)) continue;
    return clamped;
  }
  return null;
}
