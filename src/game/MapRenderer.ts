import { getPlatformTileCanvas, PLATFORM_FALLBACK_COLOR } from "../utils/platformTile";
import {
  TileGrid, TileType, getTile, TILE_CELL_SIZE, TILE_PROPS,
  findNearestFlatPickupCell, flatPickupCrateWorldOrigin, isFlatPickupCellClear,
} from "./TileMap";
import { getTileCanvas, TALL_TILE_TYPES, PYRAMID_TILE } from "../utils/tileModelCache";
import { getPowerBoxCanvas } from "../utils/powerModelCache";
import { getNeighbourMask } from "../utils/autoTile";
import { isBattle3DActive } from "./battle3DWorld";
import { getCrateShakeOffset, getTileShakeOffset } from "../utils/effects";

export interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
  solid: boolean;
}

export interface Bush {
  x: number;
  y: number;
  radius: number;
}

export interface Crate {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

export interface River {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GameMap {
  width: number;
  height: number;
  walls: Wall[];
  bushes: Bush[];
  crates: Crate[];
  rivers: River[];
  tileSize: number;
  name: string;
  tileGrid?: TileGrid;
}

function makeCrate(x: number, y: number): Crate {
  return { x, y, w: 50, h: 50, hp: 2500, maxHp: 2500, destroyed: false };
}

/** Snap POWER_BOX overlays to clear 3×3 grass pockets so crates/jars don’t sit under bush or tall tile art. */
export function collectPowerCratesFromOverlays(
  grid: TileGrid,
  overlays: ArrayLike<number>,
  powerBoxCode: number,
): Crate[] {
  const used = new Set<string>();
  const out: Crate[] = [];
  const W = grid.width;
  const H = grid.height;
  const len = Math.min(overlays.length, W * H);
  for (let i = 0; i < len; i++) {
    if (overlays[i] !== powerBoxCode) continue;
    const tx = i % W;
    const ty = Math.floor(i / W);
    const snap = findNearestFlatPickupCell(grid, tx, ty);
    if (!snap) continue;
    const key = `${snap.tx},${snap.ty}`;
    if (used.has(key)) continue;
    used.add(key);
    const o = flatPickupCrateWorldOrigin(grid, snap.tx, snap.ty);
    out.push({ x: o.x, y: o.y, w: 50, h: 50, hp: 2500, maxHp: 2500, destroyed: false });
  }
  return out;
}

/** Случайные боксы усиления на чистой траве (20–30), если на карте редактора их нет. */
export function spawnRandomPowerCrates(
  grid: TileGrid,
  overlays?: ArrayLike<number>,
  opts?: { min?: number; max?: number; playableRim?: number },
): Crate[] {
  const min = opts?.min ?? 20;
  const max = opts?.max ?? 30;
  const rim = opts?.playableRim ?? 10;
  const target = min + Math.floor(Math.random() * (max - min + 1));
  const W = grid.width;
  const H = grid.height;
  const overlayBlocked = new Set<string>();

  if (overlays) {
    const len = Math.min(overlays.length, W * H);
    for (let i = 0; i < len; i++) {
      if (overlays[i] !== 0) {
        overlayBlocked.add(`${i % W},${Math.floor(i / W)}`);
      }
    }
  }

  const used = new Set<string>();
  const out: Crate[] = [];
  let tries = 0;
  while (out.length < target && tries < 6000) {
    tries++;
    const tx = Math.floor(Math.random() * (W - rim * 2)) + rim;
    const ty = Math.floor(Math.random() * (H - rim * 2)) + rim;
    if (overlayBlocked.has(`${tx},${ty}`)) continue;
    if (!isFlatPickupCellClear(grid, tx, ty)) continue;
    let crowded = false;
    for (let dy = -2; dy <= 2 && !crowded; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (used.has(`${tx + dx},${ty + dy}`)) crowded = true;
      }
    }
    if (crowded) continue;
    used.add(`${tx},${ty}`);
    const o = flatPickupCrateWorldOrigin(grid, tx, ty);
    out.push({ x: o.x, y: o.y, w: 50, h: 50, hp: 2500, maxHp: 2500, destroyed: false });
  }
  return out;
}

export function createShowdownMap(tileGrid?: TileGrid): GameMap {
  const W = 3000, H = 3000;
  const walls: Wall[] = [
    { x: 0, y: 0, w: W, h: 4, solid: true },
    { x: 0, y: H - 4, w: W, h: 4, solid: true },
    { x: 0, y: 0, w: 4, h: H, solid: true },
    { x: W - 4, y: 0, w: 4, h: H, solid: true },
  ];

  const crates: Crate[] = [];

  // Place 18 power boxes on grass tiles
  if (tileGrid) {
    const C = TILE_CELL_SIZE;
    const placed: Array<{ tx: number; ty: number }> = [];
    const target = 18;
    let tries = 0;
    const rng = () => Math.random();
    while (placed.length < target && tries < 3000) {
      tries++;
      const tx = Math.floor(rng() * 36) + 12;
      const ty = Math.floor(rng() * 36) + 12;
      if (!isFlatPickupCellClear(tileGrid, tx, ty)) continue;
      if (placed.some(p => Math.abs(p.tx - tx) <= 2 && Math.abs(p.ty - ty) <= 2)) continue;
      const wx = tx * C + C * 0.25;
      const wy = ty * C + C * 0.25;
      crates.push({ x: wx, y: wy, w: 50, h: 50, hp: 3500, maxHp: 3500, destroyed: false });
      placed.push({ tx, ty });
    }
  }

  return { width: W, height: H, walls, bushes: [], crates, rivers: [], tileSize: 60, name: "Заброшенный храм" };
}

export function createCrystalsMap(): GameMap {
  const W = 3500, H = 3500;
  const walls: Wall[] = [
    { x: 0, y: 0, w: W, h: 60, solid: true },
    { x: 0, y: H - 60, w: W, h: 60, solid: true },
    { x: 0, y: 0, w: 60, h: H, solid: true },
    { x: W - 60, y: 0, w: 60, h: H, solid: true },
    { x: 600, y: 500, w: 200, h: 60, solid: true },
    { x: 900, y: 700, w: 60, h: 200, solid: true },
    { x: 1400, y: 400, w: 250, h: 60, solid: true },
    { x: 2600, y: 500, w: 200, h: 60, solid: true },
    { x: 2500, y: 700, w: 60, h: 200, solid: true },
    { x: 1800, y: 400, w: 250, h: 60, solid: true },
    { x: 500, y: 1400, w: 60, h: 300, solid: true },
    { x: 700, y: 1200, w: 200, h: 60, solid: true },
    { x: 2700, y: 1400, w: 60, h: 300, solid: true },
    { x: 2500, y: 1200, w: 200, h: 60, solid: true },
    { x: 1600, y: 1600, w: 60, h: 250, solid: true },
    { x: 1800, y: 1600, w: 60, h: 250, solid: true },
    { x: 500, y: 2400, w: 200, h: 60, solid: true },
    { x: 600, y: 2200, w: 60, h: 250, solid: true },
    { x: 2700, y: 2400, w: 200, h: 60, solid: true },
    { x: 2800, y: 2200, w: 60, h: 250, solid: true },
    { x: 1000, y: 2800, w: 250, h: 60, solid: true },
    { x: 2200, y: 2800, w: 250, h: 60, solid: true },
  ];

  const bushes: Bush[] = [
    { x: 300, y: 1750, radius: 70 },
    { x: 500, y: 1750, radius: 60 },
    { x: 3000, y: 1750, radius: 70 },
    { x: 3200, y: 1750, radius: 60 },
    { x: 1000, y: 600, radius: 60 },
    { x: 2400, y: 600, radius: 60 },
    { x: 1000, y: 2900, radius: 60 },
    { x: 2400, y: 2900, radius: 60 },
    { x: 1750, y: 300, radius: 60 },
    { x: 1750, y: 3200, radius: 60 },
  ];

  const crates: Crate[] = [];

  const rivers: River[] = [
    { x: 1500, y: 700, w: 500, h: 60 },
    { x: 1500, y: 2700, w: 500, h: 60 },
    { x: 200, y: 1500, w: 60, h: 500 },
    { x: 3200, y: 1500, w: 60, h: 500 },
  ];

  return { width: W, height: H, walls, bushes, crates, rivers, tileSize: 60, name: "Кристальная шахта" };
}

/**
 * Build a GameMap from a published TileGrid (used for all non-showdown modes
 * when a published map exists in the editor). Converts non-walkable cells to
 * wall rectangles (merged into horizontal runs for efficiency), collects
 * bushes and water patches from the grid, and sets map.tileGrid for
 * the isometric visual renderer.
 */
export function createTileGridMap(tileGrid: TileGrid, name: string): GameMap {
  const C = TILE_CELL_SIZE;
  const W = tileGrid.width * C;
  const H = tileGrid.height * C;

  const walls: Wall[] = [
    { x: 0, y: 0, w: W, h: C, solid: true },
    { x: 0, y: H - C, w: W, h: C, solid: true },
    { x: 0, y: 0, w: C, h: H, solid: true },
    { x: W - C, y: 0, w: C, h: H, solid: true },
  ];

  const bushes: Bush[] = [];
  const rivers: River[] = [];
  const crates: Crate[] = [];

  for (let ty = 0; ty < tileGrid.height; ty++) {
    let tx = 0;
    while (tx < tileGrid.width) {
      const t = getTile(tileGrid, tx, ty);
      const props = TILE_PROPS[t];
      if (props && !props.walkable) {
        if (t === TileType.WATER || t === TileType.FLOWERBED) {
          let runEnd = tx + 1;
          while (runEnd < tileGrid.width && getTile(tileGrid, runEnd, ty) === t) runEnd++;
          rivers.push({ x: tx * C, y: ty * C, w: (runEnd - tx) * C, h: C });
          walls.push({ x: tx * C, y: ty * C, w: (runEnd - tx) * C, h: C, solid: true });
          tx = runEnd;
        } else {
          let runEnd = tx + 1;
          while (runEnd < tileGrid.width) {
            const rt = getTile(tileGrid, runEnd, ty);
            const rp = TILE_PROPS[rt];
            if (!rp || rp.walkable || rt === TileType.WATER || rt === TileType.FLOWERBED) break;
            runEnd++;
          }
          walls.push({ x: tx * C, y: ty * C, w: (runEnd - tx) * C, h: C, solid: true });
          tx = runEnd;
        }
      } else {
        if (t === TileType.BUSH) {
          bushes.push({ x: (tx + 0.5) * C, y: (ty + 0.5) * C, radius: C * 0.55 });
        }
        tx++;
      }
    }
  }

  const map: GameMap = { width: W, height: H, walls, bushes, crates, rivers, tileSize: C, name };
  map.tileGrid = tileGrid;
  return map;
}

// Deterministic pseudo-random noise from integer coords (stable per tile)
function noise2(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

const WALL_DEPTH = 16; // pseudo-3D extrusion offset for walls/crates
const WALL_SHADOW = 22;

export function renderMap(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  camX: number,
  camY: number,
  canvasW: number,
  canvasH: number,
  frame = 0,
  playerX?: number,
  playerY?: number
): void {
  // В 3D-режиме боя 2D-карта не рисуется — мир выводит WebGL-сцена.
  if (isBattle3DActive()) return;

  const battle3D = false;
  const startTX = Math.floor(camX / map.tileSize);
  const endTX = Math.ceil((camX + canvasW) / map.tileSize);
  const startTY = Math.floor(camY / map.tileSize);
  const endTY = Math.ceil((camY + canvasH) / map.tileSize);

  const isShowdown = !!map.tileGrid;

  // ---------- GROUND — single platform image stretched across the full map ----------
  // 3D-сцена сама рисует землю мешем с реальным освещением и тенями. Пропускаем фон,
  // чтобы 2D-канвас остался прозрачным HUD-слоем поверх живого 3D-мира.
  if (!battle3D) {
    const tileCanvas = getPlatformTileCanvas();
    if (tileCanvas) {
      ctx.drawImage(tileCanvas, -camX, -camY, map.width, map.height);
    } else {
      ctx.fillStyle = isShowdown ? "#8B7040" : `#${PLATFORM_FALLBACK_COLOR.toString(16).padStart(6, "0")}`;
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
  }

  // Vignette overlay near map borders for atmosphere
  if (!battle3D) {
    const grad = ctx.createRadialGradient(
      canvasW / 2, canvasH / 2, Math.min(canvasW, canvasH) * 0.35,
      canvasW / 2, canvasH / 2, Math.max(canvasW, canvasH) * 0.75
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // ---------- POWER BOXES — must render for ALL map types (incl. tileGrid) ----
  {
    const _boxSprite = getPowerBoxCanvas();
    for (const crate of map.crates) {
      if (crate.destroyed) continue;
      const sx = crate.x - camX;
      const sy = crate.y - camY;
      if (sx + crate.w < 0 || sy + crate.h < 0 || sx > canvasW || sy > canvasH) continue;

      const shake = getCrateShakeOffset(crate);
      const drawSx = sx + shake.ox;
      const drawSy = sy + shake.oy;

      const hpRatio = crate.hp / crate.maxHp;
      const W = crate.w, H = crate.h;
      const draw = W * 1.8;

      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(drawSx + W / 2 + 2, drawSy + H + 4, draw * 0.45, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = hpRatio > 0.5 ? "#CE93D8" : hpRatio > 0.25 ? "#FF9800" : "#F44336";
      ctx.shadowBlur = 18;

      if (_boxSprite) {
        const dx = drawSx + W / 2 - draw / 2;
        const dy = drawSy + H / 2 - draw / 2 - 4;
        ctx.globalAlpha = hpRatio < 0.25 ? 0.55 : 1;
        ctx.drawImage(_boxSprite, dx, dy, draw, draw);
        ctx.globalAlpha = 1;
      } else {
        const faceGrad = ctx.createLinearGradient(sx, sy, sx + W, sy + H);
        faceGrad.addColorStop(0, "#7B2FBE");
        faceGrad.addColorStop(1, "#3A006E");
        ctx.fillStyle = faceGrad;
        ctx.fillRect(drawSx, drawSy, W, H);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#FFD700";
        ctx.font = `bold ${Math.round(W * 0.44)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✦", drawSx + W / 2, drawSy + H / 2);
      }

      ctx.shadowBlur = 0;

      if (hpRatio < 0.75) {
        ctx.strokeStyle = "rgba(255,120,0,0.75)";
        ctx.lineWidth = 2;
        const cx = drawSx + W / 2, cy = drawSy + H / 2;
        ctx.beginPath();
        ctx.moveTo(cx - W * 0.3, cy - H * 0.25);
        ctx.lineTo(cx, cy + H * 0.05);
        ctx.lineTo(cx - W * 0.15, cy + H * 0.3);
        ctx.stroke();
        if (hpRatio < 0.4) {
          ctx.beginPath();
          ctx.moveTo(cx + W * 0.2, cy - H * 0.3);
          ctx.lineTo(cx + W * 0.05, cy + H * 0.1);
          ctx.lineTo(cx + W * 0.3, cy + H * 0.35);
          ctx.stroke();
        }
      }

      const barW = draw;
      const barH = 5;
      const barX = drawSx + W / 2 - draw / 2;
      const barY = drawSy - 10;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
      ctx.fillStyle = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FFB300" : "#F44336";
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.restore();
    }
  }

  // Tile-grid maps handle all terrain via renderTileGrid — skip legacy geometry
  if (isShowdown) return;

  // ---------- RIVERS with animated water ----------
  const t = frame * 0.05;
  for (const river of map.rivers) {
    const sx = river.x - camX;
    const sy = river.y - camY;
    if (sx + river.w < 0 || sy + river.h < 0 || sx > canvasW || sy > canvasH) continue;

    // Recessed dark base (depth)
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(sx - 2, sy - 2, river.w + 4, river.h + 4);

    const grad = ctx.createLinearGradient(sx, sy, sx, sy + river.h);
    grad.addColorStop(0, "#0D47A1");
    grad.addColorStop(0.5, "#1976D2");
    grad.addColorStop(1, "#0D47A1");
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, river.w, river.h);

    // Caustic / wave shimmer
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, river.w, river.h);
    ctx.clip();
    ctx.strokeStyle = "rgba(180,220,255,0.45)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const baseY = sy + (river.h * (i + 0.5)) / 5;
      ctx.moveTo(sx, baseY);
      const step = 14;
      for (let xx = 0; xx <= river.w; xx += step) {
        const yy = baseY + Math.sin((xx + t * 30 + i * 50) * 0.06) * 3.2;
        ctx.lineTo(sx + xx, yy);
      }
      ctx.stroke();
    }
    // Highlight specular dots
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 6; i++) {
      const px = sx + ((i * 73 + frame * 0.7) % river.w);
      const py = sy + ((i * 41) % river.h);
      ctx.fillRect(px, py, 2, 1);
    }
    ctx.restore();

    // Bank highlight
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 0.5, sy + 0.5, river.w - 1, river.h - 1);
  }

  // ---------- BUSHES — multi-layer foliage with bevel ----------
  for (const bush of map.bushes) {
    const sx = bush.x - camX;
    const sy = bush.y - camY;
    if (sx + bush.radius < 0 || sy + bush.radius < 0 || sx - bush.radius > canvasW || sy - bush.radius > canvasH) continue;

    ctx.save();
    // Soft ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(sx + 6, sy + bush.radius * 0.55, bush.radius * 0.95, bush.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark base layer
    ctx.fillStyle = "#1B5E20";
    ctx.beginPath();
    ctx.arc(sx, sy + 4, bush.radius, 0, Math.PI * 2);
    ctx.fill();

    // Mid layer clusters
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const ox = Math.cos(a) * bush.radius * 0.45;
      const oy = Math.sin(a) * bush.radius * 0.4;
      ctx.beginPath();
      ctx.arc(sx + ox, sy + oy, bush.radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? "#2E7D32" : "#388E3C";
      ctx.fill();
    }

    // Top highlight cluster
    ctx.beginPath();
    ctx.arc(sx, sy - bush.radius * 0.1, bush.radius * 0.55, 0, Math.PI * 2);
    const bgrad = ctx.createRadialGradient(
      sx - bush.radius * 0.2, sy - bush.radius * 0.3, 2,
      sx, sy, bush.radius * 0.7
    );
    bgrad.addColorStop(0, "#A5D6A7");
    bgrad.addColorStop(0.5, "#66BB6A");
    bgrad.addColorStop(1, "#43A047");
    ctx.fillStyle = bgrad;
    ctx.fill();

    // Specular leaf highlights
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(sx - bush.radius * 0.25, sy - bush.radius * 0.3, bush.radius * 0.15, bush.radius * 0.07, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- WALLS — pseudo-3D extruded blocks ----------
  // Pass 1: drop shadows (soft)
  for (const wall of map.walls) {
    const sx = wall.x - camX;
    const sy = wall.y - camY;
    if (sx + wall.w + WALL_SHADOW < 0 || sy + wall.h + WALL_SHADOW < 0 || sx > canvasW || sy > canvasH) continue;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(sx + WALL_SHADOW * 0.6, sy + WALL_SHADOW, wall.w, wall.h);
  }

  // Pass 2: side faces (right and bottom extrusion)
  for (const wall of map.walls) {
    const sx = wall.x - camX;
    const sy = wall.y - camY;
    if (sx + wall.w + WALL_DEPTH < 0 || sy + wall.h + WALL_DEPTH < 0 || sx > canvasW || sy > canvasH) continue;

    // Right face
    ctx.fillStyle = isShowdown ? "#3E3E3E" : "#2A0E55";
    ctx.beginPath();
    ctx.moveTo(sx + wall.w, sy);
    ctx.lineTo(sx + wall.w + WALL_DEPTH, sy + WALL_DEPTH);
    ctx.lineTo(sx + wall.w + WALL_DEPTH, sy + wall.h + WALL_DEPTH);
    ctx.lineTo(sx + wall.w, sy + wall.h);
    ctx.closePath();
    ctx.fill();

    // Bottom face
    ctx.fillStyle = isShowdown ? "#2E2E2E" : "#1F0840";
    ctx.beginPath();
    ctx.moveTo(sx, sy + wall.h);
    ctx.lineTo(sx + WALL_DEPTH, sy + wall.h + WALL_DEPTH);
    ctx.lineTo(sx + wall.w + WALL_DEPTH, sy + wall.h + WALL_DEPTH);
    ctx.lineTo(sx + wall.w, sy + wall.h);
    ctx.closePath();
    ctx.fill();
  }

  // Pass 3: top faces with gradient + bevel
  for (const wall of map.walls) {
    const sx = wall.x - camX;
    const sy = wall.y - camY;
    if (sx + wall.w < 0 || sy + wall.h < 0 || sx > canvasW || sy > canvasH) continue;

    const grad = ctx.createLinearGradient(sx, sy, sx + wall.w, sy + wall.h);
    if (isShowdown) {
      grad.addColorStop(0, "#A8A8A8");
      grad.addColorStop(0.5, "#888888");
      grad.addColorStop(1, "#5C5C5C");
    } else {
      grad.addColorStop(0, "#9C27B0");
      grad.addColorStop(0.5, "#7B1FA2");
      grad.addColorStop(1, "#4A148C");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, wall.w, wall.h);

    // Stone block subdivision lines
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1;
    const blockSize = 40;
    for (let bx = blockSize; bx < wall.w; bx += blockSize) {
      ctx.beginPath();
      ctx.moveTo(sx + bx, sy);
      ctx.lineTo(sx + bx, sy + wall.h);
      ctx.stroke();
    }
    for (let by = blockSize; by < wall.h; by += blockSize) {
      ctx.beginPath();
      ctx.moveTo(sx, sy + by);
      ctx.lineTo(sx + wall.w, sy + by);
      ctx.stroke();
    }

    // Top + left bevel highlight (light from top-left)
    ctx.fillStyle = isShowdown ? "rgba(255,255,255,0.35)" : "rgba(225,180,255,0.35)";
    ctx.fillRect(sx, sy, wall.w, 3);
    ctx.fillRect(sx, sy, 3, wall.h);

    // Right + bottom inner shadow
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(sx, sy + wall.h - 2, wall.w, 2);
    ctx.fillRect(sx + wall.w - 2, sy, 2, wall.h);

    // Outline
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + 0.5, sy + 0.5, wall.w - 1, wall.h - 1);
  }
}

export function isInBush(x: number, y: number, bushes: Bush[]): boolean {
  for (const b of bushes) {
    const dx = x - b.x;
    const dy = y - b.y;
    if (dx * dx + dy * dy < b.radius * b.radius) return true;
  }
  return false;
}

export function isInRiver(x: number, y: number, rivers: River[]): boolean {
  for (const r of rivers) {
    if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
  }
  return false;
}

export function collidesWithWalls(x: number, y: number, radius: number, walls: Wall[]): { collides: boolean; nx: number; ny: number } {
  let nx = x, ny = y;
  let collides = false;
  for (const wall of walls) {
    const nearX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
    const nearY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
    const dx = x - nearX;
    const dy = y - nearY;
    const distSq = dx * dx + dy * dy;
    if (distSq < radius * radius) {
      collides = true;
      const dist = Math.sqrt(distSq) || 0.01;
      const overlap = radius - dist;
      nx += (dx / dist) * overlap;
      ny += (dy / dist) * overlap;
    }
  }
  return { collides, nx, ny };
}

const BUSH_REVEAL_RADIUS = 4 * 50; // 4 tiles in world units

// Base colours drawn under every GLB sprite to close subpixel seams between
// adjacent same-type tiles.
const TILE_BASE: Partial<Record<number, string>> = {
  [TileType.WALL]:       "#7A5555",
  [TileType.MOUNTAIN]:   "#506050",
  [TileType.DECORATION]: "#B8B8B8",
  [TileType.FENCE]:      "#C4A050",
  // HEAL (barrel) intentionally omitted — no red base fill under barrels.
  [TileType.CACTUS]:     "#447A22",
  [TileType.TREE]:       "#2E5A18",
  [TileType.FLOWERBED]:  "#4A7A28",
  [TileType.WOOD]:       "#7A5850",
  [TileType.SAND_WALL]:  "#607080",
  [PYRAMID_TILE]:        "#F9D520",
};

// Water wave pattern cache — re-created when tile size changes.
let _waterPatternC = 0;
let _waterPatternCanvas: HTMLCanvasElement | null = null;

function getWaterPatternCanvas(C: number): HTMLCanvasElement {
  if (_waterPatternCanvas && _waterPatternC === C) return _waterPatternCanvas;
  _waterPatternC = C;
  // Pattern is 4×4 cells wide/tall so offsets vary meaningfully across tiles.
  const pw = C * 4;
  const ph = C * 4;
  const wc = document.createElement("canvas");
  wc.width = pw; wc.height = ph;
  const wctx = wc.getContext("2d")!;

  // Deep water background
  const g = wctx.createLinearGradient(0, 0, 0, ph);
  g.addColorStop(0,   "#1878D0");
  g.addColorStop(0.5, "#1060A8");
  g.addColorStop(1,   "#0A4888");
  wctx.fillStyle = g;
  wctx.fillRect(0, 0, pw, ph);

  // Seamless sinusoidal wave lines (period = pw so they tile horizontally)
  wctx.strokeStyle = "rgba(180,220,255,0.32)";
  wctx.lineWidth = 1.5;
  const waveRows = 8;
  for (let row = 0; row < waveRows; row++) {
    const wy = (ph / waveRows) * (row + 0.3);
    const phase = (row * Math.PI * 0.618); // golden-ratio phase offset
    wctx.beginPath();
    for (let wx = 0; wx <= pw; wx += 2) {
      const yo = Math.sin((wx / pw) * Math.PI * 2 * 3 + phase) * (C * 0.06);
      if (wx === 0) wctx.moveTo(wx, wy + yo);
      else          wctx.lineTo(wx, wy + yo);
    }
    wctx.stroke();
  }

  // Foam specks distributed evenly
  wctx.fillStyle = "rgba(210,235,255,0.22)";
  for (let i = 0; i < 40; i++) {
    const fx = (i * pw * 0.137) % pw;
    const fy = (i * ph * 0.213) % ph;
    const r  = C * 0.022 + (i % 3) * C * 0.010;
    wctx.beginPath();
    wctx.arc(fx, fy, r, 0, Math.PI * 2);
    wctx.fill();
  }

  _waterPatternCanvas = wc;
  return wc;
}

/**
 * Blit a rectangle from the pattern canvas (with wrap-around) into (sx,sy,C,C).
 * offX / offY are the starting coordinates within the pattern canvas.
 */
function blitWrapped(
  ctx: CanvasRenderingContext2D,
  wpc: HTMLCanvasElement,
  offX: number, offY: number,
  sx: number, sy: number, C: number,
): void {
  const pw = wpc.width, ph = wpc.height;
  // Quadrants to handle horizontal + vertical wrap-around
  const x0 = offX,  w0 = Math.min(pw - offX, C);
  const x1 = 0,     w1 = C - w0;
  const y0 = offY,  h0 = Math.min(ph - offY, C);
  const y1 = 0,     h1 = C - h0;
  ctx.drawImage(wpc, x0, y0, w0, h0, sx,      sy,      w0, h0);
  if (w1 > 0) ctx.drawImage(wpc, x1, y0, w1, h0, sx + w0, sy,      w1, h0);
  if (h1 > 0) ctx.drawImage(wpc, x0, y1, w0, h1, sx,      sy + h0, w0, h1);
  if (w1 > 0 && h1 > 0) ctx.drawImage(wpc, x1, y1, w1, h1, sx + w0, sy + h0, w1, h1);
}

function drawWaterCell(
  ctx: CanvasRenderingContext2D,
  wpc: HTMLCanvasElement,
  sx: number, sy: number, C: number,
  tx: number, ty: number,
  hasN: boolean, hasE: boolean, hasS: boolean, hasW: boolean,
): void {
  const pw = wpc.width, ph = wpc.height;
  // World-coordinate-based offset so adjacent cells sample continuous regions
  const offX = ((tx * C) % pw + pw) % pw;
  const offY = ((ty * C) % ph + ph) % ph;
  blitWrapped(ctx, wpc, offX, offY, sx, sy, C);

  // Foam on exposed edges (where water meets land / non-water)
  const F = Math.max(2, Math.round(C * 0.09));
  ctx.fillStyle = "rgba(190,225,255,0.32)";
  if (!hasN) ctx.fillRect(sx, sy,           C, F);
  if (!hasS) ctx.fillRect(sx, sy + C - F,   C, F);
  if (!hasW) ctx.fillRect(sx, sy,           F, C);
  if (!hasE) ctx.fillRect(sx + C - F, sy,   F, C);
}

/** South edge of tile row in world Y — depth key vs brawler feet in isometric modes. */
export function tallTileDepthSortY(ty: number, cellSize: number): number {
  return (ty + 1) * cellSize;
}

type TileGridPass2DrawMode = "normal" | "deferTallNonBush" | "tallNonBushOnly";

function drawTilePass2AtCell(
  ctx: CanvasRenderingContext2D,
  grid: TileGrid,
  tx: number,
  ty: number,
  camX: number,
  camY: number,
  playerX: number,
  playerY: number,
  bushLayer: boolean,
  drawMode: TileGridPass2DrawMode,
): void {
  const C = grid.cellSize;
  const TALL_OVERFLOW = C * 0.60;
  const BUSH_W = C * 1.35;
  const BUSH_H = BUSH_W * 2.6;
  const BUSH_X_OFF = (C - BUSH_W) / 2;
  const BUSH_Y_TOP_OFF = BUSH_H - C;

  const type = getTile(grid, tx, ty);
  if (type === TileType.GRASS) return;
  if (type === TileType.WATER) return;

  const isBush = type === TileType.BUSH;

  if (drawMode === "tallNonBushOnly") {
    if (!TALL_TILE_TYPES.has(type)) return;
  } else {
    if (isBush !== bushLayer) return;
    if (drawMode === "deferTallNonBush" && !bushLayer && TALL_TILE_TYPES.has(type)) return;
  }

  const sx = Math.round(tx * C - camX);
  const sy = Math.round(ty * C - camY);
  const tileShake = getTileShakeOffset(tx, ty, C);
  const needsShake = tileShake.ox !== 0 || tileShake.oy !== 0;
  if (needsShake) {
    ctx.save();
    ctx.translate(tileShake.ox, tileShake.oy);
  }

  if (isBush) {
    const worldX = tx * C + C / 2;
    const worldY = ty * C + C / 2;
    const ddx = worldX - playerX;
    const ddy = worldY - playerY;
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    ctx.save();
    ctx.globalAlpha = dist < BUSH_REVEAL_RADIUS ? 0.35 : 1.0;
  }

  const tileCanvas = getTileCanvas(type);
  const isLineTile = type === TileType.DECORATION || type === TileType.FENCE;

  if (tileCanvas) {
    if (isBush) {
      ctx.drawImage(tileCanvas,
        sx + BUSH_X_OFF - 1, sy - BUSH_Y_TOP_OFF - 1,
        BUSH_W + 2, BUSH_H + 2);
    } else if (isLineTile) {
      const tAbove = getTile(grid, tx, ty - 1);
      const tBelow = getTile(grid, tx, ty + 1);
      const tLeft = getTile(grid, tx - 1, ty);
      const tRight = getTile(grid, tx + 1, ty);
      const hasVert = (tAbove === type || tBelow === type);
      const hasHoriz = (tLeft === type || tRight === type);
      const isVertical = hasVert && !hasHoriz;
      const od = Math.round(C * 0.30);
      if (isVertical) {
        ctx.save();
        ctx.translate(sx + C / 2, sy + C / 2);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(tileCanvas, -C / 2 - od, -C / 2 - od, C + od * 2, C + od * 2);
        ctx.restore();
      } else {
        ctx.drawImage(tileCanvas, sx - od, sy - od, C + od * 2, C + od * 2);
      }
    } else if (TALL_TILE_TYPES.has(type)) {
      const hasSameNorth = ty > 0 && getTile(grid, tx, ty - 1) === type;
      const hasSameSouth = ty < grid.height - 1 && getTile(grid, tx, ty + 1) === type;
      const odTop = hasSameNorth ? C * 1.0 : TALL_OVERFLOW;
      const odSide = C * 0.30;
      if (hasSameSouth) {
        const clipBottom = Math.round(sy + C * 0.5);
        // Negative height when the tile is far above the view breaks clip → seam / bright line.
        if (clipBottom > 2) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(sx - C, 0, C * 3, clipBottom);
          ctx.clip();
          ctx.drawImage(tileCanvas, sx - odSide, sy - odTop, C + odSide * 2, C + odTop + odSide);
          ctx.restore();
        } else {
          ctx.drawImage(tileCanvas, sx - odSide, sy - odTop, C + odSide * 2, C + odTop + odSide);
        }
      } else {
        ctx.drawImage(tileCanvas, sx - odSide, sy - odTop, C + odSide * 2, C + odTop + odSide);
      }
    } else if (type === TileType.HEAL) {
      const healOD = Math.round(C * 0.18);
      ctx.drawImage(tileCanvas, sx - healOD, sy - healOD, C + healOD * 2, C + healOD * 2);
    } else {
      ctx.drawImage(tileCanvas, sx - 1, sy - 1, C + 2, C + 2);
    }
  } else if (!isBush) {
    const base = TILE_BASE[type] ?? "#888";
    ctx.fillStyle = base;
    ctx.fillRect(sx - 1, sy - 1, C + 2, C + 2);
    const hl = Math.round(C * 0.28);
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.fillRect(sx - 1, sy - 1, C + 2, hl);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(sx - 1, sy + C - hl + 1, C + 2, hl + 1);
  }

  if (isBush) ctx.restore();
  if (needsShake) ctx.restore();
}

/** Paint one cell’s tall GLB tile (used after Y-sort vs brawlers in ISO showdown/mega). */
export function paintTileGridPass2Cell(
  ctx: CanvasRenderingContext2D,
  grid: TileGrid,
  tx: number,
  ty: number,
  camX: number,
  camY: number,
  playerX: number,
  playerY: number,
  _bushLayer: boolean,
  mode: "tallNonBushOnly",
): void {
  if (mode !== "tallNonBushOnly") return;
  if (isBattle3DActive()) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawTilePass2AtCell(ctx, grid, tx, ty, camX, camY, playerX, playerY, false, "tallNonBushOnly");
}

export function renderTileGrid(
  ctx: CanvasRenderingContext2D,
  grid: TileGrid,
  camX: number, camY: number,
  canvasW: number, canvasH: number,
  playerX: number, playerY: number,
  bushLayer: boolean,
  pass2Mode: "default" | "deferTallNonBush" = "default",
): void {
  if (isBattle3DActive()) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const C = grid.cellSize;
  const TALL_ROWS_ABOVE = 4;
  /** Draw in-grid tiles only — no virtual cells beyond map (avoids edge bleed). */
  const EDGE_PAD = 0;
  const startTX = Math.max(-EDGE_PAD, Math.floor(camX / C) - EDGE_PAD);
  const endTX = Math.min(grid.width - 1 + EDGE_PAD, Math.ceil((camX + canvasW) / C) + EDGE_PAD);
  const startTY = Math.max(-EDGE_PAD, Math.floor(camY / C) - TALL_ROWS_ABOVE);
  const endTY = Math.min(grid.height - 1 + EDGE_PAD, Math.ceil((camY + canvasH) / C) + EDGE_PAD);

  const wpc = getWaterPatternCanvas(C);

  // ── PASS 1: seamless base-colour fill (closes subpixel gaps between GLB
  //    sprite edges for adjacent same-type tiles).  Water gets the tiling
  //    wave pattern here instead of a flat colour.
  if (!bushLayer) {
    const GAP = 3; // px of colour bleed into each same-type neighbour
    for (let tx = startTX; tx <= endTX; tx++) {
      for (let ty = startTY; ty <= endTY; ty++) {
        const type = getTile(grid, tx, ty);
        if (type === TileType.GRASS || type === TileType.BUSH) continue;

        const sx = Math.round(tx * C - camX);
        const sy = Math.round(ty * C - camY);

        if (type === TileType.WATER) {
          const mask = getNeighbourMask(
            grid.cells, grid.destroyed, grid.width, grid.height, tx, ty, type
          );
          drawWaterCell(ctx, wpc, sx, sy, C, tx, ty,
            !!(mask & 1), !!(mask & 2), !!(mask & 4), !!(mask & 8));
          continue;
        }

        const base = TILE_BASE[type];
        if (!base) continue;

        // Skip base-colour fill for tall/line tiles — their sprites are self-contained
        // and the colored rectangles create "strange patterns under blocks" artifacts.
        if (TALL_TILE_TYPES.has(type)) continue;

        ctx.fillStyle = base;
        ctx.fillRect(sx - 1, sy - 1, C + 2, C + 2);
        // Bleed into same-type neighbours to merge their base fills seamlessly
        if (getTile(grid, tx, ty - 1) === type) ctx.fillRect(sx - 1, sy - GAP, C + 2, GAP);
        if (getTile(grid, tx, ty + 1) === type) ctx.fillRect(sx - 1, sy + C,   C + 2, GAP);
        if (getTile(grid, tx - 1, ty) === type) ctx.fillRect(sx - GAP, sy - 1, GAP, C + 2);
        if (getTile(grid, tx + 1, ty) === type) ctx.fillRect(sx + C,   sy - 1, GAP, C + 2);
      }
    }
  }

  const pass2Draw: TileGridPass2DrawMode =
    pass2Mode === "deferTallNonBush" && !bushLayer ? "deferTallNonBush" : "normal";

  // ── PASS 2: GLB sprites (or Canvas 2D fallback) on top of the base fills ──
  // Diagonal (tx+ty) order: NW “back” first, SE “front” last — correct pseudo-3D overlap.
  const sMin = startTX + startTY;
  const sMax = endTX + endTY;
  for (let s = sMin; s <= sMax; s++) {
    const txMin = Math.max(startTX, s - endTY);
    const txMax = Math.min(endTX, s - startTY);
    for (let tx = txMin; tx <= txMax; tx++) {
      const ty = s - tx;
      drawTilePass2AtCell(ctx, grid, tx, ty, camX, camY, playerX, playerY, bushLayer, pass2Draw);
    }
  }
}
