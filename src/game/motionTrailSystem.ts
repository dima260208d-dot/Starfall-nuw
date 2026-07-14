import * as THREE from "three";
import type { Brawler } from "../entities/Brawler";
import { getTrailDef, type BrawlerTrailDef, type TrailPattern } from "../data/brawlerTrails";
import { getBattleGroundTilt } from "./battleVisualScale";

/** Optional battle/preview 3D camera — projects particles onto the overlay canvas. */
export interface TrailRenderCamera {
  camera: THREE.Camera;
  canvasW: number;
  canvasH: number;
}

type BodyAnchor = "feet" | "legs" | "torso" | "back" | "head";

interface TrailParticle {
  /** Game X / Three.js X. */
  x: number;
  /** Game Y / Three.js Z. */
  y: number;
  /** Height above ground in world px (Three.js Y). */
  elev: number;
  vx: number;
  vy: number;
  velev: number;
  life: number;
  maxLife: number;
  size: number;
  rot: number;
  rotSpeed: number;
  pattern: TrailPattern;
  color: string;
  secondary: string;
  layer: "ground" | "air";
  seed: number;
}

const particles: TrailParticle[] = [];
const lastSpawn = new Map<string, { x: number; y: number }>();
const _projVec = new THREE.Vector3();

const TRAIL_SIZE_MUL = 1.85;

export function clearMotionTrails(): void {
  particles.length = 0;
  lastSpawn.clear();
}

function brawlerBodyHeight(br: Brawler): number {
  return br.radius * 2.35;
}

function pickAnchor(layer: "ground" | "air", isMoving: boolean): BodyAnchor {
  const r = Math.random();
  if (layer === "ground") {
    if (r < 0.55) return "feet";
    if (r < 0.82) return "legs";
    return "torso";
  }
  if (isMoving) {
    if (r < 0.18) return "feet";
    if (r < 0.42) return "back";
    if (r < 0.68) return "torso";
    return "head";
  }
  if (r < 0.22) return "feet";
  if (r < 0.55) return "torso";
  return "head";
}

function anchorElev(anchor: BodyAnchor, bodyH: number): number {
  switch (anchor) {
    case "feet": return bodyH * (0.02 + Math.random() * 0.07);
    case "legs": return bodyH * (0.14 + Math.random() * 0.24);
    case "torso": return bodyH * (0.36 + Math.random() * 0.24);
    case "back": return bodyH * (0.46 + Math.random() * 0.3);
    case "head": return bodyH * (0.7 + Math.random() * 0.26);
  }
}

function spawnParticle(
  def: BrawlerTrailDef,
  br: Brawler,
  isMoving: boolean,
  forceLayer?: "ground" | "air",
): void {
  const bodyH = brawlerBodyHeight(br);
  const useAir = forceLayer ?? (
    def.layer === "air" || (def.layer === "both" && Math.random() < 0.48)
      ? "air"
      : "ground"
  );
  const layer = useAir;
  const anchor = pickAnchor(layer, isMoving);
  const elev = anchorElev(anchor, bodyH);

  const moveAngle = br.moveAngle ?? 0;
  const backAngle = moveAngle + Math.PI;
  const perp = moveAngle + Math.PI / 2;
  const lateral = (Math.random() - 0.5) * br.radius * 0.7;

  const backDist = (anchor === "back" || (isMoving && anchor !== "feet"))
    ? br.radius * (0.06 + Math.random() * 0.38)
    : br.radius * Math.random() * 0.14;

  const px = br.x + Math.cos(backAngle) * backDist + Math.cos(perp) * lateral;
  const py = br.y + Math.sin(backAngle) * backDist + Math.sin(perp) * lateral;

  let vx: number;
  let vy: number;
  let velev: number;

  if (isMoving) {
    const speed = 24 + Math.random() * 42;
    vx = Math.cos(backAngle) * speed * 0.58 + (Math.random() - 0.5) * 20;
    vy = Math.sin(backAngle) * speed * 0.58 + (Math.random() - 0.5) * 16;
    velev = layer === "ground"
      ? 2 + Math.random() * 10
      : 6 + Math.random() * 18;
  } else {
    vx = (Math.random() - 0.5) * 14;
    vy = (Math.random() - 0.5) * 10;
    velev = 12 + Math.random() * 28;
  }

  particles.push({
    x: px,
    y: py,
    elev,
    vx,
    vy,
    velev,
    life: def.particleLife * (0.75 + Math.random() * 0.55),
    maxLife: def.particleLife,
    size: (def.sizeMin + Math.random() * (def.sizeMax - def.sizeMin)) * TRAIL_SIZE_MUL,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 5.5,
    pattern: def.pattern,
    color: def.color,
    secondary: def.secondary,
    layer,
    seed: Math.floor(Math.random() * 9999),
  });
}

export function tickMotionTrails(dt: number, brawlers: Brawler[]): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.elev += p.velev * dt;
    p.vx *= 0.91;
    p.vy *= 0.91;
    p.velev *= 0.9;
    if (p.layer === "ground" && p.elev > 0) {
      p.velev -= 28 * dt;
    }
    p.elev = Math.max(0, p.elev);
    p.rot += p.rotSpeed * dt;
  }

  for (const br of brawlers) {
    if (!br.alive || !br.motionTrailId) continue;
    const def = getTrailDef(br.motionTrailId);
    if (!def) continue;

    const prev = lastSpawn.get(br.id);
    const dx = prev ? br.x - prev.x : 0;
    const dy = prev ? br.y - prev.y : 0;
    const movedDist = Math.hypot(dx, dy);
    const isMoving = movedDist >= 0.35;

    if (isMoving || !prev) {
      lastSpawn.set(br.id, { x: br.x, y: br.y });
    }

    const moveMul = isMoving ? 5.5 : 3.2;
    const burst = def.layer === "both" ? (isMoving ? 2 : 1) : 1;
    for (let n = 0; n < burst; n++) {
      if (Math.random() < def.spawnRate * 60 * dt * moveMul) {
        spawnParticle(def, br, isMoving);
        if (Math.random() < 0.38) {
          spawnParticle(def, br, isMoving, def.layer === "both" ? undefined : def.layer);
        }
      }
    }
  }
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function drawMotionTrailPattern(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  pattern: TrailPattern,
  size: number,
  color: string,
  secondary: string,
  rot: number,
  alpha: number,
  seed = 0,
): void {
  const variant = (seed % 100) / 100;
  const sz = size * (0.88 + variant * 0.28);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(rot + (variant - 0.5) * 0.35);
  ctx.globalAlpha = alpha;

  const glow = (r: number, a = 0.35) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, hexAlpha(color, a));
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  };

  switch (pattern) {
    case "petals":
    case "blossom":
    case "lotus": {
      glow(sz * 1.1, 0.28);
      const petals = pattern === "lotus" ? 4 : 3;
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2 + variant;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = i % 2 ? color : secondary;
        ctx.beginPath();
        ctx.ellipse(sz * 0.22, 0, sz * 0.55, sz * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hexAlpha(secondary, 0.5);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sz * 0.42, 0);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = hexAlpha(color, 0.9);
      ctx.beginPath();
      ctx.arc(0, 0, sz * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "wind":
    case "ribbon":
    case "mist": {
      glow(sz * 0.9, 0.22);
      const streaks = pattern === "mist" ? 4 : 3;
      for (let i = 0; i < streaks; i++) {
        const g = ctx.createLinearGradient(-sz * 1.2, i * 2, sz * 1.2, i * 2);
        g.addColorStop(0, "transparent");
        g.addColorStop(0.35, hexAlpha(color, 0.15 + i * 0.08));
        g.addColorStop(0.5, hexAlpha(i % 2 ? secondary : color, 0.85));
        g.addColorStop(0.65, hexAlpha(color, 0.15 + i * 0.08));
        g.addColorStop(1, "transparent");
        ctx.strokeStyle = g;
        ctx.lineWidth = sz * (0.22 - i * 0.035);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-sz * 1.1, (i - streaks / 2) * sz * 0.11);
        ctx.quadraticCurveTo(0, (i - streaks / 2) * sz * 0.2, sz * 1.1, (i - streaks / 2) * sz * 0.11);
        ctx.stroke();
      }
      break;
    }
    case "stars":
    case "comet":
    case "lightning":
    case "sparkle": {
      glow(sz * 1.4, 0.4);
      const drawStar = (r: number, fill: string, stroke?: string) => {
        ctx.fillStyle = fill;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const rr = i % 2 === 0 ? r : r * 0.42;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      };
      drawStar(sz, hexAlpha(color, 0.35), undefined);
      drawStar(sz * 0.72, color, hexAlpha(secondary, 0.8));
      if (pattern === "comet" || pattern === "sparkle") {
        ctx.strokeStyle = hexAlpha(secondary, 0.7);
        ctx.lineWidth = sz * 0.1;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sz * 0.5, 0);
        ctx.lineTo(-sz * (1.2 + variant), 0);
        ctx.stroke();
      }
      if (pattern === "lightning") {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-sz * 0.2, -sz * 0.6);
        ctx.lineTo(sz * 0.15, 0);
        ctx.lineTo(-sz * 0.05, 0);
        ctx.lineTo(sz * 0.25, sz * 0.65);
        ctx.stroke();
      }
      ctx.fillStyle = "#FFFFFFCC";
      ctx.beginPath();
      ctx.arc(-sz * 0.08, -sz * 0.08, sz * 0.12, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "butterfly": {
      glow(sz * 1.2, 0.3);
      for (const side of [-1, 1]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(side * sz * 0.38, -sz * 0.08, sz * 0.48, sz * 0.72, side * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hexAlpha(secondary, 0.75);
        ctx.beginPath();
        ctx.ellipse(side * sz * 0.42, -sz * 0.05, sz * 0.22, sz * 0.38, side * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = hexAlpha(color, 0.45);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.arc(side * sz * 0.3, -sz * 0.02, sz * 0.12, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = secondary;
      ctx.fillRect(-sz * 0.06, -sz * 0.55, sz * 0.12, sz * 1.1);
      break;
    }
    case "bubbles":
    case "dew": {
      glow(sz * 0.7, 0.25);
      ctx.strokeStyle = hexAlpha(secondary, 0.95);
      ctx.fillStyle = hexAlpha(color, 0.45);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, sz * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hexAlpha("#FFFFFF", 0.85);
      ctx.beginPath();
      ctx.arc(-sz * 0.14, -sz * 0.14, sz * 0.14, 0, Math.PI * 2);
      ctx.fill();
      if (pattern === "dew") {
        ctx.fillStyle = hexAlpha("#FFFFFF", 0.35);
        ctx.beginPath();
        ctx.arc(sz * 0.1, sz * 0.12, sz * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "snow": {
      glow(sz * 0.6, 0.2);
      ctx.strokeStyle = secondary;
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * sz * 0.55, Math.sin(a) * sz * 0.55);
        ctx.stroke();
        const ba = a + Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * sz * 0.28, Math.sin(a) * sz * 0.28);
        ctx.lineTo(
          Math.cos(a) * sz * 0.28 + Math.cos(ba) * sz * 0.14,
          Math.sin(a) * sz * 0.28 + Math.sin(ba) * sz * 0.14,
        );
        ctx.stroke();
      }
      ctx.fillStyle = hexAlpha(color, 0.9);
      ctx.beginPath();
      ctx.arc(0, 0, sz * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "flame":
    case "ember": {
      glow(sz * 1.1, 0.35);
      for (let i = 0; i < 3; i++) {
        const s = 1 - i * 0.18;
        ctx.fillStyle = i === 0 ? color : hexAlpha(i === 1 ? secondary : color, 0.7 - i * 0.15);
        ctx.beginPath();
        ctx.moveTo(0, -sz * 0.75 * s);
        ctx.quadraticCurveTo(sz * 0.55 * s, -sz * 0.1, sz * 0.35 * s, sz * 0.35 * s);
        ctx.quadraticCurveTo(0, sz * 0.65 * s, -sz * 0.35 * s, sz * 0.35 * s);
        ctx.quadraticCurveTo(-sz * 0.55 * s, -sz * 0.1, 0, -sz * 0.75 * s);
        ctx.fill();
      }
      ctx.fillStyle = hexAlpha(secondary, 0.95);
      ctx.beginPath();
      ctx.arc(0, sz * 0.12, sz * 0.24, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "ink": {
      glow(sz * 0.8, 0.2);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.fillStyle = i % 2 ? secondary : color;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * sz * 0.22, Math.sin(a) * sz * 0.22, sz * (0.28 + (i % 3) * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = hexAlpha(color, 0.85);
      ctx.beginPath();
      ctx.arc(0, 0, sz * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "goldDust": {
      glow(sz * 0.9, 0.45);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + variant;
        ctx.fillStyle = i % 2 ? secondary : color;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * sz * 0.28, Math.sin(a) * sz * 0.28, sz * (0.12 + (i % 2) * 0.06), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "moon": {
      glow(sz * 0.8, 0.3);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, sz * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(sz * 0.22, -sz * 0.06, sz * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = hexAlpha(secondary, 0.6);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(-sz * 0.05, 0, sz * 0.42, 0.5, Math.PI * 1.2);
      ctx.stroke();
      break;
    }
    case "crystal": {
      glow(sz * 1.0, 0.35);
      ctx.fillStyle = hexAlpha(color, 0.5);
      ctx.beginPath();
      ctx.moveTo(0, -sz * 0.65);
      ctx.lineTo(sz * 0.45, 0);
      ctx.lineTo(0, sz * 0.65);
      ctx.lineTo(-sz * 0.45, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -sz * 0.55);
      ctx.lineTo(sz * 0.38, 0);
      ctx.lineTo(0, sz * 0.55);
      ctx.lineTo(-sz * 0.38, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = hexAlpha(secondary, 0.95);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      break;
    }
    case "runes": {
      glow(sz * 0.7, 0.25);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(-sz * 0.38, -sz * 0.38, sz * 0.76, sz * 0.76);
      ctx.beginPath();
      ctx.moveTo(-sz * 0.22, 0);
      ctx.lineTo(sz * 0.22, 0);
      ctx.moveTo(0, -sz * 0.22);
      ctx.lineTo(0, sz * 0.22);
      ctx.stroke();
      break;
    }
    case "feather": {
      glow(sz * 0.9, 0.22);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.quadraticCurveTo(sz * 0.55, -sz * 0.15, sz * 0.15, sz * 0.55);
      ctx.quadraticCurveTo(0, sz, -sz * 0.15, sz * 0.55);
      ctx.quadraticCurveTo(-sz * 0.55, -sz * 0.15, 0, -sz);
      ctx.fill();
      ctx.strokeStyle = hexAlpha(secondary, 0.75);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -sz * 0.85);
      ctx.lineTo(0, sz * 0.75);
      ctx.stroke();
      break;
    }
    case "vine":
    case "leaves": {
      glow(sz * 0.85, 0.22);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -sz * 0.65);
      ctx.quadraticCurveTo(sz * 1.05, -sz * 0.05, sz * 0.15, sz * 0.65);
      ctx.quadraticCurveTo(0, sz * 0.35, -sz * 0.15, sz * 0.65);
      ctx.quadraticCurveTo(-sz * 0.85, 0, 0, -sz * 0.65);
      ctx.fill();
      ctx.strokeStyle = hexAlpha(secondary, 0.85);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -sz * 0.55);
      ctx.quadraticCurveTo(sz * 0.35, 0, 0, sz * 0.55);
      ctx.stroke();
      break;
    }
    case "aurora": {
      for (let i = 0; i < 4; i++) {
        const g = ctx.createRadialGradient(0, (i - 1.5) * sz * 0.1, 0, 0, (i - 1.5) * sz * 0.1, sz);
        g.addColorStop(0, hexAlpha(i % 2 ? secondary : color, 0.85));
        g.addColorStop(0.55, hexAlpha(color, 0.35));
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(-sz * 1.2, -sz * 0.45 + i * sz * 0.07, sz * 2.4, sz * 0.32);
      }
      break;
    }
    default: {
      glow(sz * 0.75, 0.35);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, sz * 0.48, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.arc(0, 0, sz * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function particleScreen(
  p: TrailParticle,
  camX: number,
  camY: number,
  proj?: TrailRenderCamera,
): { sx: number; sy: number } {
  if (proj && proj.canvasW > 0 && proj.canvasH > 0) {
    try {
      _projVec.set(p.x, p.elev, p.y);
      _projVec.project(proj.camera);
      const sx = (_projVec.x * 0.5 + 0.5) * proj.canvasW;
      const sy = (-_projVec.y * 0.5 + 0.5) * proj.canvasH;
      if (Number.isFinite(sx) && Number.isFinite(sy)) {
        return { sx, sy };
      }
    } catch {
      /* fall through to 2D */
    }
  }
  const tilt = getBattleGroundTilt();
  const lift = p.layer === "air" ? 1.12 : 1.0;
  return { sx: p.x - camX, sy: p.y - camY - p.elev * tilt * lift };
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  p: TrailParticle,
  alpha: number,
  camX: number,
  camY: number,
  proj?: TrailRenderCamera,
): void {
  const { sx, sy } = particleScreen(p, camX, camY, proj);
  drawMotionTrailPattern(ctx, sx, sy, p.pattern, p.size, p.color, p.secondary, p.rot, alpha, p.seed);
}

export function renderMotionTrails(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  proj?: TrailRenderCamera,
): void {
  for (const p of particles) {
    const t = p.life / p.maxLife;
    const alpha = Math.min(1, t * t * 0.96 + 0.04);
    drawPattern(ctx, p, alpha, camX, camY, proj);
  }
}

export function renderMotionTrailsGround(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  proj?: TrailRenderCamera,
): void {
  drawListFiltered(ctx, camX, camY, "ground", proj);
}

export function renderMotionTrailsAir(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  proj?: TrailRenderCamera,
): void {
  drawListFiltered(ctx, camX, camY, "air", proj);
}

function drawListFiltered(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  layer: "ground" | "air",
  proj?: TrailRenderCamera,
): void {
  for (const p of particles) {
    if (p.layer !== layer) continue;
    const t = p.life / p.maxLife;
    const alpha = Math.min(1, t * t * 0.96 + 0.04);
    drawPattern(ctx, p, alpha, camX, camY, proj);
  }
}
