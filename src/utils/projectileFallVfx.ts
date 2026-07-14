/**
 * Cosmetic fall when a kinetic projectile reaches max range — drops to the
 * ground and fades. No damage, no collision.
 */
import type { Projectile } from "../entities/Projectile";
import { WORLD_VFX_CANVAS_SCALE, getBattleGroundTilt, groundEllipsePath } from "../game/battleVisualScale";

const TAU = Math.PI * 2;
const MAX_FALLS = 48;

export interface FallingProjectile {
  x: number;
  y: number;
  vy: number;
  height: number;
  radius: number;
  color: string;
  angle: number;
  visual: string;
  life: number;
  maxLife: number;
}

const falls: FallingProjectile[] = [];

/** Projectile types that get a ground-drop animation at max range. */
const FALL_TYPES = new Set<string>([
  "hanaPetal",
  "chain",
  "zafkielTime",
  "zafkielVoid",
  "zafkielRage",
  "zafkielSeek",
  "devMonsterBolt",
  "raidBolt",
]);

export function shouldProjectileFall(type: string): boolean {
  return FALL_TYPES.has(type);
}

export function spawnProjectileFall(proj: Projectile): void {
  if (!shouldProjectileFall(proj.type)) return;
  if (falls.length >= MAX_FALLS) falls.shift();
  falls.push({
    x: proj.x,
    y: proj.y,
    vy: 0,
    height: 22,
    radius: proj.radius,
    color: proj.color,
    angle: Math.atan2(proj.vy, proj.vx),
    visual: proj.type,
    life: 0.55,
    maxLife: 0.55,
  });
}

export function updateProjectileFalls(dt: number): void {
  for (let i = falls.length - 1; i >= 0; i--) {
    const f = falls[i];
    f.life -= dt;
    if (f.life <= 0) {
      falls.splice(i, 1);
      continue;
    }
    f.vy += 680 * dt;
    f.height = Math.max(0, f.height - f.vy * dt * 0.85);
    if (f.height <= 0.5) f.height = 0;
  }
}

function rgbOf(c: string): [number, number, number] {
  if (!c) return [255, 255, 255];
  if (c[0] === "#") {
    const h = c.slice(1);
    if (h.length === 3) return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
    if (h.length >= 6) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = c.match(/\d+/g);
  if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  return [255, 255, 255];
}
const rgba = (c: string, a: number): string => {
  const [r, g, b] = rgbOf(c);
  return `rgba(${r},${g},${b},${a})`;
};

function drawFallBody(
  ctx: CanvasRenderingContext2D,
  f: FallingProjectile,
  sx: number,
  sy: number,
  pr: number,
  fade: number,
): void {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(f.angle + (1 - f.height / 22) * 1.4);
  ctx.globalAlpha = fade;

  switch (f.visual) {
    case "hanaPetal": {
      ctx.fillStyle = rgba(f.color, 0.85);
      ctx.beginPath();
      ctx.moveTo(0, -pr * 1.1);
      ctx.bezierCurveTo(pr * 0.9, -pr * 0.4, pr * 0.7, pr * 0.9, 0, pr * 0.55);
      ctx.bezierCurveTo(-pr * 0.7, pr * 0.9, -pr * 0.9, -pr * 0.4, 0, -pr * 1.1);
      ctx.fill();
      break;
    }
    case "chain": {
      ctx.fillStyle = rgba(f.color, 0.9);
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.75, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, pr * 1.1, 0, TAU * 0.6);
      ctx.stroke();
      break;
    }
    case "zafkielTime": {
      ctx.strokeStyle = rgba(f.color, 0.9);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.85, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(-0.8, -pr * 0.55, 1.6, pr * 0.35);
      ctx.fillRect(-0.8, -0.8, 1.6, pr * 0.55);
      break;
    }
    case "zafkielVoid":
    case "zafkielRage":
    case "zafkielSeek": {
      ctx.fillStyle = rgba(f.color, 0.88);
      ctx.beginPath();
      ctx.ellipse(0, 0, pr * 1.1, pr * 0.65, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case "devMonsterBolt":
    case "raidBolt": {
      ctx.fillStyle = rgba(f.color, 0.85);
      ctx.beginPath();
      ctx.moveTo(pr * 1.2, 0);
      ctx.lineTo(-pr * 0.5, -pr * 0.45);
      ctx.lineTo(-pr * 0.2, 0);
      ctx.lineTo(-pr * 0.5, pr * 0.45);
      ctx.closePath();
      ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = rgba(f.color, 0.8);
      ctx.beginPath();
      ctx.arc(0, 0, pr * 0.7, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function renderProjectileFalls(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
): void {
  const tilt = getBattleGroundTilt();
  for (const f of falls) {
    const fade = Math.min(1, f.life / f.maxLife);
    const pr = f.radius * WORLD_VFX_CANVAS_SCALE;
    const sxFlat = f.x - camX;
    const syFlat = f.y - camY;
    const sx = sxFlat;
    const sy = syFlat - f.height;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = fade * 0.35;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    groundEllipsePath(ctx, sxFlat, syFlat + 2, pr * (0.9 + (1 - fade) * 0.3));
    ctx.fill();
    ctx.restore();

    drawFallBody(ctx, f, sx, sy, pr, fade * (0.35 + f.height / 22 * 0.65));

    if (f.height <= 0 && fade < 0.35) {
      ctx.save();
      ctx.globalAlpha = fade * 2.2;
      ctx.strokeStyle = rgba(f.color, 0.5);
      ctx.lineWidth = 1.2;
      groundEllipsePath(ctx, sxFlat, syFlat + 2, pr * 1.3);
      ctx.stroke();
      ctx.restore();
    }
  }
}

export function clearProjectileFalls(): void {
  falls.length = 0;
}
