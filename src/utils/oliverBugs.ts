import type { Brawler } from "../entities/Brawler";
import type { Projectile } from "../entities/Projectile";
import type { TileGrid } from "../game/TileMap";
import { TILE_CELL_SIZE, collidesWithTileGrid } from "../game/TileMap";
import { distance } from "./helpers";
import { getDevBattleMonsters, DEV_MONSTER_HIT_RADIUS, damageDevMonstersInRadius } from "./devBattleMonsters";

export interface OliverBugCrate {
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  destroyed: boolean;
}

export interface OliverBugWorldOpts {
  crates?: OliverBugCrate[];
  onCrateDamaged?: (crate: OliverBugCrate, damage: number, hitX: number, hitY: number) => void;
  onCrateDestroyed?: (crate: OliverBugCrate, cx: number, cy: number) => void;
}

function circleHitsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}

function tryHitCrate(
  bug: OliverBug,
  x: number,
  y: number,
  opts?: OliverBugWorldOpts,
): boolean {
  const crates = opts?.crates;
  if (!crates?.length) return false;

  for (const crate of crates) {
    if (crate.destroyed) continue;
    if (!circleHitsRect(x, y, bug.radius, crate.x, crate.y, crate.w, crate.h)) continue;

    crate.hp -= bug.damage;
    opts?.onCrateDamaged?.(crate, bug.damage, x, y);
    if (crate.hp <= 0) {
      crate.destroyed = true;
      opts?.onCrateDestroyed?.(crate, crate.x + crate.w / 2, crate.y + crate.h / 2);
    }

    bug.alive = false;
    spawnBugVfx?.({
      kind: "oliverBugImpact",
      x,
      y,
      radius: 20,
      color: "#FFB74D",
      secondary: "#795548",
      timer: 0.3,
      maxTimer: 0.3,
    });
    return true;
  }
  return false;
}

export interface OliverBug {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  damage: number;
  lifetime: number;
  ownerId: string;
  ownerTeam: string;
  radius: number;
  alive: boolean;
  /** Oliver position when the swarm was launched — max 5 cells from here. */
  originX: number;
  originY: number;
  maxRange: number;
  wobble: number;
  spawnGrace: number;
  /** Fixed flight bearing — each bug keeps its own lane. */
  launchAngle: number;
}

let bugs: OliverBug[] = [];
let nextId = 0;

type BugVfxSpawn = (eff: {
  kind: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  secondary?: string;
  timer: number;
  maxTimer: number;
  seed?: number;
}) => void;

let spawnBugVfx: BugVfxSpawn | null = null;

export function registerOliverBugVfx(fn: BugVfxSpawn): void {
  spawnBugVfx = fn;
}

export function clearOliverBugs(): void {
  bugs = [];
}

export function restoreOliverBugsSnapshot(snapshot: readonly OliverBug[] | undefined): void {
  if (!snapshot?.length) {
    bugs = [];
    return;
  }
  bugs = snapshot.map(b => ({ ...b }));
}

export function getOliverBugs(): readonly OliverBug[] {
  return bugs;
}

/** 5 tiles from Oliver / per-bug travel distance. */
export const OLIVER_BUG_TILE_RANGE = 5;
export const OLIVER_BUG_RANGE = TILE_CELL_SIZE * OLIVER_BUG_TILE_RANGE;
const BUG_SPEED = 340;
const BUG_LIFETIME = 3;
const BUG_RADIUS = 8;
const BUG_VISUAL_SCALE = 0.82;
const DEFAULT_SWARM = 5;

/** Launch `count` bugs (default 5) in a wide fan — each on its own straight trajectory. */
export function spawnOliverBugSwarm(
  owner: Brawler,
  aimAngle: number,
  count: number,
  damage: number,
  armored: boolean,
): void {
  const swarm = Math.max(1, count || DEFAULT_SWARM);
  const handX = owner.x + Math.cos(aimAngle) * 20;
  const handY = owner.y + Math.sin(aimAngle) * 20 - 8;
  const fanSpread = swarm <= 1 ? 0 : Math.min(Math.PI * 0.92, 0.26 * (swarm - 1));

  spawnBugVfx?.({
    kind: "oliverBugLaunch",
    x: handX,
    y: handY,
    radius: 32,
    color: "#FFB74D",
    secondary: "#795548",
    timer: 0.4,
    maxTimer: 0.4,
  });

  for (let i = 0; i < swarm; i++) {
    const t = swarm <= 1 ? 0 : (i / (swarm - 1)) * 2 - 1;
    const a = aimAngle + t * fanSpread * 0.5;
    const perpX = Math.cos(a + Math.PI / 2);
    const perpY = Math.sin(a + Math.PI / 2);
    const forward = 10 + Math.abs(t) * 8;
    const lateral = t * 22;
    const sx = handX + Math.cos(a) * forward + perpX * lateral;
    const sy = handY + Math.sin(a) * forward + perpY * lateral;
    const stagger = i * 0.035;
    bugs.push({
      id: `oliver_bug_${nextId++}`,
      x: sx,
      y: sy,
      vx: Math.cos(a) * BUG_SPEED,
      vy: Math.sin(a) * BUG_SPEED,
      hp: armored ? 100 : 1,
      maxHp: armored ? 100 : 1,
      damage: Math.max(1, Math.floor(damage)),
      lifetime: BUG_LIFETIME - stagger,
      ownerId: owner.id,
      ownerTeam: owner.team,
      radius: BUG_RADIUS,
      alive: true,
      originX: owner.x,
      originY: owner.y,
      maxRange: OLIVER_BUG_RANGE,
      wobble: Math.random() * Math.PI * 2 + i * 1.7,
      spawnGrace: 0.14 + stagger,
      launchAngle: a,
    });
  }
}

function ownerOf(all: Brawler[], id: string): Brawler | null {
  return all.find(b => b.id === id) ?? null;
}

export function updateOliverBugs(
  dt: number,
  allBrawlers: Brawler[],
  projectiles: Projectile[],
  mapW: number,
  mapH: number,
  tileGrid?: TileGrid,
  worldOpts?: OliverBugWorldOpts,
): void {
  for (let i = bugs.length - 1; i >= 0; i--) {
    const bug = bugs[i];
    if (!bug.alive) {
      bugs.splice(i, 1);
      continue;
    }

    bug.lifetime -= dt;
    bug.spawnGrace = Math.max(0, bug.spawnGrace - dt);
    bug.wobble += dt * 9;

    if (bug.lifetime <= 0) {
      bug.alive = false;
      continue;
    }

    if (distance(bug.originX, bug.originY, bug.x, bug.y) > bug.maxRange) {
      bug.alive = false;
      continue;
    }

    const wobbleAmt = Math.sin(bug.wobble) * 34;
    const perpX = -Math.sin(bug.launchAngle);
    const perpY = Math.cos(bug.launchAngle);
    bug.vx = Math.cos(bug.launchAngle) * BUG_SPEED + perpX * wobbleAmt * 0.12;
    bug.vy = Math.sin(bug.launchAngle) * BUG_SPEED + perpY * wobbleAmt * 0.12;

    const nx = bug.x + bug.vx * dt;
    const ny = bug.y + bug.vy * dt;

    if (bug.spawnGrace <= 0 && tryHitCrate(bug, nx, ny, worldOpts)) {
      continue;
    }

    if (tileGrid && bug.spawnGrace <= 0) {
      const hit = collidesWithTileGrid(nx, ny, bug.radius, tileGrid);
      if (hit.collides) {
        bug.alive = false;
        spawnBugVfx?.({
          kind: "oliverBugImpact",
          x: bug.x,
          y: bug.y,
          radius: 16,
          color: "#FFB74D",
          secondary: "#5D4037",
          timer: 0.25,
          maxTimer: 0.25,
        });
        continue;
      }
    }

    bug.x = Math.max(bug.radius, Math.min(mapW - bug.radius, nx));
    bug.y = Math.max(bug.radius, Math.min(mapH - bug.radius, ny));

    if (bug.maxHp > 1) {
      for (const p of projectiles) {
        if (!p.alive || p.team === bug.ownerTeam) continue;
        const d = distance(p.x, p.y, bug.x, bug.y);
        if (d <= bug.radius + p.radius) {
          bug.hp -= p.damage;
          p.alive = false;
          if (bug.hp <= 0) {
            bug.alive = false;
            spawnBugVfx?.({
              kind: "oliverBugImpact",
              x: bug.x,
              y: bug.y,
              radius: 18,
              color: "#BCAAA4",
              secondary: "#795548",
              timer: 0.3,
              maxTimer: 0.3,
            });
          }
          break;
        }
      }
    }

    if (!bug.alive) continue;

    for (const mon of getDevBattleMonsters()) {
      if (!mon.alive || mon.team === bug.ownerTeam) continue;
      const d = distance(bug.x, bug.y, mon.x, mon.y);
      if (d <= bug.radius + DEV_MONSTER_HIT_RADIUS) {
        const owner = ownerOf(allBrawlers, bug.ownerId);
        damageDevMonstersInRadius(bug.x, bug.y, bug.radius + 10, bug.damage, bug.ownerTeam, owner);
        bug.alive = false;
        spawnBugVfx?.({
          kind: "oliverBugImpact",
          x: bug.x,
          y: bug.y,
          radius: 22,
          color: "#FFD54F",
          secondary: "#FFB300",
          timer: 0.35,
          maxTimer: 0.35,
        });
        break;
      }
    }
    if (!bug.alive) continue;

    for (const b of allBrawlers) {
      if (!b.alive || b.team === bug.ownerTeam) continue;
      const d = distance(bug.x, bug.y, b.x, b.y);
      if (d <= bug.radius + b.radius) {
        const owner = ownerOf(allBrawlers, bug.ownerId);
        b.takeDamage(bug.damage, owner, { suppressDamageNumber: true });
        bug.alive = false;
        spawnBugVfx?.({
          kind: "oliverBugImpact",
          x: bug.x,
          y: bug.y,
          radius: 22,
          color: "#FFD54F",
          secondary: "#FFB300",
          timer: 0.35,
          maxTimer: 0.35,
        });
        break;
      }
    }
  }
}

function drawMechanicalBug(
  ctx: CanvasRenderingContext2D,
  frame: number,
  wobble: number,
  armored: boolean,
  hpRatio: number,
): void {
  const t = frame * 0.24 + wobble;
  const flap = Math.sin(t * 13) * 0.11;
  const legSwing = Math.sin(t * 11);
  const scale = (armored ? 1.14 : 1) * BUG_VISUAL_SCALE;
  const damaged = armored && hpRatio < 0.999;

  ctx.scale(scale, scale);

  // Ground shadow
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#3E2723";
  ctx.beginPath();
  ctx.ellipse(1, 5, 14, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Fluttering translucent wings (behind body)
  ctx.save();
  ctx.globalAlpha = 0.22 + Math.abs(flap) * 1.6;
  ctx.fillStyle = "#81D4FA";
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(-4, side * (7 + flap * 18));
    ctx.rotate(side * (0.55 + flap * 0.35));
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Six articulated legs
  ctx.strokeStyle = "#4E342E";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const along = -7 + (i % 3) * 7;
    const phase = legSwing + i * 0.9;
    const reach = 10 + Math.sin(phase) * 3;
    const kneeX = along + Math.cos(phase) * 2;
    const kneeY = side * (5 + Math.sin(phase * 1.3) * 1.5);
    const footX = kneeX + side * Math.sin(phase + 0.6) * reach * 0.35;
    const footY = kneeY + side * reach;
    ctx.lineWidth = i % 3 === 1 ? 2.1 : 1.7;
    ctx.beginPath();
    ctx.moveTo(along, side * 3);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.fillStyle = "#FFD54F";
    ctx.beginPath();
    ctx.arc(footX, footY, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Abdomen — three bronze segments
  const abdGrad = ctx.createLinearGradient(-16, 0, -4, 0);
  abdGrad.addColorStop(0, "#5D4037");
  abdGrad.addColorStop(0.35, "#A1887F");
  abdGrad.addColorStop(1, "#8D6E63");
  for (let s = 0; s < 3; s++) {
    const ax = -15 + s * 5.5;
    ctx.fillStyle = abdGrad;
    ctx.strokeStyle = "#3E2723";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(ax, 0, 4.8, 7.2 - s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,213,79,0.35)";
    ctx.beginPath();
    ctx.moveTo(ax - 2.5, -3.5);
    ctx.lineTo(ax + 2.5, -3.5);
    ctx.moveTo(ax - 2.5, 3.5);
    ctx.lineTo(ax + 2.5, 3.5);
    ctx.stroke();
  }

  // Elytra — split metallic wing cases
  ctx.fillStyle = armored ? "#9E9E9E" : "#BF8F42";
  ctx.strokeStyle = "#4E342E";
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(0, side * 2.5);
    ctx.rotate(side * (0.08 + flap * 0.5));
    ctx.beginPath();
    ctx.ellipse(0, side * 3.8, 10.5, 5.2, side * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-8, side * 2);
    ctx.lineTo(8, side * 5.5);
    ctx.stroke();
    ctx.strokeStyle = "#4E342E";
    ctx.lineWidth = 1.2;
    ctx.restore();
  }

  // Armored rivets
  if (armored) {
    ctx.fillStyle = "#ECEFF1";
    for (const [rx, ry] of [[-2, -4], [-2, 4], [4, -3.5], [4, 3.5]] as const) {
      ctx.beginPath();
      ctx.arc(rx, ry, 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#78909C";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }

  // Thorax
  const thorax = ctx.createRadialGradient(-1, -2, 1, 0, 0, 11);
  thorax.addColorStop(0, "#FFE082");
  thorax.addColorStop(0.55, armored ? "#B0BEC5" : "#FFB74D");
  thorax.addColorStop(1, "#6D4C41");
  ctx.fillStyle = thorax;
  ctx.strokeStyle = "#3E2723";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 10.5, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Gear emblem on thorax
  ctx.save();
  ctx.translate(-1, 0);
  ctx.rotate(t * 0.35);
  ctx.strokeStyle = "#FFD54F";
  ctx.fillStyle = "rgba(66,165,245,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let g = 0; g < 8; g++) {
    const a = (g / 8) * Math.PI * 2;
    const r = g % 2 === 0 ? 4.2 : 3.2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (g === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#42A5F5";
  ctx.beginPath();
  ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Head
  ctx.fillStyle = armored ? "#90A4AE" : "#D7A046";
  ctx.strokeStyle = "#3E2723";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(11, 0, 6.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Mandibles
  ctx.strokeStyle = "#5D4037";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(14, -2.5);
  ctx.lineTo(17.5, -1);
  ctx.moveTo(14, 2.5);
  ctx.lineTo(17.5, 1);
  ctx.stroke();

  // Antennae
  ctx.strokeStyle = "#6D4C41";
  ctx.lineWidth = 1.1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(12, side * 3);
    ctx.quadraticCurveTo(16, side * 9, 14 + Math.sin(t * 8 + side) * 2, side * 12);
    ctx.stroke();
    ctx.fillStyle = "#FFD54F";
    ctx.beginPath();
    ctx.arc(14 + Math.sin(t * 8 + side) * 2, side * 12, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mechanical eye — blue lens with glow
  ctx.save();
  ctx.shadowColor = "#42A5F5";
  ctx.shadowBlur = damaged ? 4 : 9;
  const eyeGrad = ctx.createRadialGradient(13, -1.5, 0.5, 13, -1.5, 3.2);
  eyeGrad.addColorStop(0, "#E1F5FE");
  eyeGrad.addColorStop(0.45, "#42A5F5");
  eyeGrad.addColorStop(1, "#1565C0");
  ctx.fillStyle = eyeGrad;
  ctx.beginPath();
  ctx.arc(13, -1.2, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.arc(12.3, -1.8, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Damage cracks on armored shell (no HP bar)
  if (damaged) {
    ctx.strokeStyle = `rgba(255,87,34,${0.35 + (1 - hpRatio) * 0.5})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.lineTo(-1, -1);
    ctx.lineTo(3, -4);
    ctx.moveTo(-4, 4);
    ctx.lineTo(2, 2);
    ctx.lineTo(6, 5);
    ctx.stroke();
    if (hpRatio < 0.45) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#78909C";
      ctx.beginPath();
      ctx.arc(-2, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

export function renderOliverBugs(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
): void {
  for (const bug of bugs) {
    if (!bug.alive) continue;
    const sx = bug.x - camX;
    const sy = bug.y - camY;
    const bob = Math.sin(bug.wobble * 1.4) * 1.8;
    const flyAngle = Math.atan2(bug.vy, bug.vx);
    const armored = bug.maxHp > 1;
    const hpRatio = bug.maxHp > 0 ? bug.hp / bug.maxHp : 1;

    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.rotate(flyAngle);
    drawMechanicalBug(ctx, frame, bug.wobble, armored, hpRatio);
    ctx.restore();
  }
}
