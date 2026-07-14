/**
 * Showdown toxic gas — animated green 3D-style smoke puffs.
 * Each puff pulses, drifts, splits into smaller puffs, and fades on its own
 * timeline so the cloud never empties all at once. Small green orbs add detail.
 */

export interface ShowdownSmokeArea {
  /** Camera top-left in world px (game space). */
  camX: number;
  camY: number;
  viewW: number;
  viewH: number;
  /** Safe-zone center in world px. */
  gasCx: number;
  gasCy: number;
  /** Safe AABB half-size in world px (matches ClashShowdown gas.safeHalfSize). */
  safeHalf: number;
  /** Ground Y squash for ellipse (getBattleGroundTilt). */
  groundTilt?: number;
}

type PuffKind = "puff" | "orb";

interface SmokePuff {
  kind: PuffKind;
  /** World X (game px). */
  wx: number;
  /** World Y (game px). */
  wy: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  life: number;
  lifetime: number;
  rot: number;
  rotSpeed: number;
  pulseHz: number;
  pulsePhase: number;
  alphaPeak: number;
  spriteIdx: number;
  tint: number;
  generation: number;
  canSplit: boolean;
  splitAt: number;
}

const PARTICLE_TARGET_DENSITY = 1 / (14 * 14);
const MAX_PARTICLES = 2200;
const MAX_SPAWN_PER_FRAME = 120;
const MAX_SPLIT_PER_FRAME = 64;

const SPRITE_COUNT = 5;
const SPRITE_SIZE = 256;

/** Toxic green palette — tighter, more uniform hue. */
const TINTS: [number, number, number][] = [
  [108, 188, 78],
  [98, 176, 72],
  [88, 164, 66],
  [118, 196, 84],
];

const sprites: HTMLCanvasElement[] = [];
let spritesReady = false;
const tintedCache = new Map<string, HTMLCanvasElement>();

const particles: SmokePuff[] = [];
let lastFrameMs = 0;
let splitsThisFrame = 0;

function trimParticles(max = MAX_PARTICLES): void {
  if (particles.length <= max) return;
  particles.splice(0, particles.length - max);
}

function normalizePuff(p: SmokePuff & { x?: number; y?: number }): boolean {
  if (!Number.isFinite(p.wx) || !Number.isFinite(p.wy)) {
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
      p.wx = p.x;
      p.wy = p.y;
    } else {
      return false;
    }
  }
  return true;
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSprite(seed: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const ctx = c.getContext("2d")!;
  const cx = SPRITE_SIZE / 2;
  const cy = SPRITE_SIZE / 2;
  const rnd = mulberry32(seed * 9301 + 49297);

  const grad = ctx.createRadialGradient(cx, cy - SPRITE_SIZE * 0.06, 0, cx, cy, SPRITE_SIZE * 0.52);
  grad.addColorStop(0.0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.92)");
  grad.addColorStop(0.62, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.85, "rgba(255,255,255,0.18)");
  grad.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 26; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = SPRITE_SIZE * (0.28 + rnd() * 0.24);
    const blobR = SPRITE_SIZE * (0.04 + rnd() * 0.11);
    const bx = cx + Math.cos(ang) * r;
    const by = cy + Math.sin(ang) * r * 0.88;
    const g2 = ctx.createRadialGradient(bx, by, 0, bx, by, blobR);
    g2.addColorStop(0, "rgba(0,0,0,1)");
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(bx - blobR, by - blobR, blobR * 2, blobR * 2);
  }

  ctx.globalCompositeOperation = "source-atop";
  for (let i = 0; i < 18; i++) {
    const ang = rnd() * Math.PI * 2;
    const r = SPRITE_SIZE * (0.04 + rnd() * 0.28);
    const billowR = SPRITE_SIZE * (0.05 + rnd() * 0.11);
    const bx = cx + Math.cos(ang) * r;
    const by = cy + Math.sin(ang) * r * 0.9;
    const g3 = ctx.createRadialGradient(bx, by, 0, bx, by, billowR);
    const a = 0.12 + rnd() * 0.2;
    g3.addColorStop(0, `rgba(255,255,255,${a})`);
    g3.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g3;
    ctx.fillRect(bx - billowR, by - billowR, billowR * 2, billowR * 2);
  }

  const img = ctx.getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const n = (rnd() - 0.5) * 42;
    data[i] = clamp255(data[i] + n);
    data[i + 1] = clamp255(data[i + 1] + n);
    data[i + 2] = clamp255(data[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return c;
}

function ensureSprites(): void {
  if (spritesReady) return;
  if (typeof document === "undefined") return;
  for (let i = 0; i < SPRITE_COUNT; i++) sprites.push(makeSprite(i + 1));
  spritesReady = true;
}

function getTintedSprite(spriteIdx: number, tintIdx: number): HTMLCanvasElement | null {
  if (!spritesReady) return null;
  const key = `${spriteIdx}-${tintIdx}`;
  let c = tintedCache.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(sprites[spriteIdx], 0, 0);
  ctx.globalCompositeOperation = "source-in";
  const [r, g, b] = TINTS[tintIdx % TINTS.length];
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(sprites[spriteIdx], 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(sprites[spriteIdx], 0, 0);
  ctx.globalCompositeOperation = "source-over";
  tintedCache.set(key, c);
  return c;
}

function safeHalfY(area: ShowdownSmokeArea): number {
  return area.safeHalf * (area.groundTilt ?? 1);
}

/** True when world position is outside the safe rectangle (in gas). */
function isWorldInGas(wx: number, wy: number, area: ShowdownSmokeArea): boolean {
  return Math.abs(wx - area.gasCx) > area.safeHalf || Math.abs(wy - area.gasCy) > safeHalfY(area);
}

function estimateVisibleGasArea(area: ShowdownSmokeArea): number {
  const samples = 10;
  let inGas = 0;
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const wx = area.camX + ((i + 0.5) / samples) * area.viewW;
      const wy = area.camY + ((j + 0.5) / samples) * area.viewH;
      if (isWorldInGas(wx, wy, area)) inGas++;
    }
  }
  return (inGas / (samples * samples)) * area.viewW * area.viewH;
}

function pickPointInGas(area: ShowdownSmokeArea): { wx: number; wy: number } | null {
  for (let attempt = 0; attempt < 16; attempt++) {
    const wx = area.camX + Math.random() * area.viewW;
    const wy = area.camY + Math.random() * area.viewH;
    if (isWorldInGas(wx, wy, area)) return { wx, wy };
  }
  return null;
}

function worldToScreen(
  wx: number,
  wy: number,
  area: ShowdownSmokeArea,
): { sx: number; sy: number } {
  return { sx: wx - area.camX, sy: wy - area.camY };
}

function lifetimeForGeneration(gen: number): number {
  if (gen === 0) return 1.8 + Math.random() * 2.4;
  if (gen === 1) return 1.1 + Math.random() * 1.6;
  return 0.65 + Math.random() * 1.0;
}

function sizeForGeneration(gen: number): number {
  if (gen === 0) return 32 + Math.random() * 38;
  if (gen === 1) return 16 + Math.random() * 22;
  return 6 + Math.random() * 12;
}

function pickTint(generation: number, wx: number, wy: number): number {
  const n = (generation * 17 + Math.floor(wx * 0.07) + Math.floor(wy * 0.07)) | 0;
  return ((n % TINTS.length) + TINTS.length) % TINTS.length;
}

function spawnPuff(
  area: ShowdownSmokeArea,
  generation: number,
  wx?: number,
  wy?: number,
  kind: PuffKind = generation >= 2 && Math.random() < 0.22 ? "orb" : "puff",
): SmokePuff | null {
  const pt = wx !== undefined && wy !== undefined ? { wx, wy } : pickPointInGas(area);
  if (!pt) return null;

  const lifetime = lifetimeForGeneration(generation);
  const baseSize = kind === "orb" ? 3 + Math.random() * 6 : sizeForGeneration(generation);

  return {
    kind,
    wx: pt.wx,
    wy: pt.wy,
    vx: (Math.random() - 0.5) * (kind === "orb" ? 8 : 14),
    vy: (Math.random() - 0.5) * (kind === "orb" ? 6 : 10) - (kind === "orb" ? 6 : 2),
    size: baseSize,
    baseSize,
    life: Math.random() * lifetime * 0.85,
    lifetime,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * (kind === "orb" ? 0.4 : 0.55),
    pulseHz: 0.9 + Math.random() * 2.2,
    pulsePhase: Math.random() * Math.PI * 2,
    alphaPeak: kind === "orb" ? 0.5 + Math.random() * 0.28 : 0.58 + Math.random() * 0.24,
    spriteIdx: (Math.random() * SPRITE_COUNT) | 0,
    tint: pickTint(generation, pt.wx, pt.wy),
    generation,
    canSplit: kind === "puff" && generation < 2,
    splitAt: 0.32 + Math.random() * 0.38,
  };
}

function spawnSplitChildren(parent: SmokePuff, area: ShowdownSmokeArea): void {
  if (splitsThisFrame >= MAX_SPLIT_PER_FRAME || particles.length >= MAX_PARTICLES) return;
  const count = Math.min(2 + ((Math.random() * 2) | 0), MAX_SPLIT_PER_FRAME - splitsThisFrame);
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_PARTICLES) break;
    const ang = Math.random() * Math.PI * 2;
    const dist = parent.baseSize * (0.15 + Math.random() * 0.35);
    const child = spawnPuff(
      area,
      parent.generation + 1,
      parent.wx + Math.cos(ang) * dist,
      parent.wy + Math.sin(ang) * dist * 0.72,
    );
    if (child) {
      child.vx += Math.cos(ang) * (8 + Math.random() * 16);
      child.vy += Math.sin(ang) * (6 + Math.random() * 12);
      particles.push(child);
      splitsThisFrame++;
    }
  }
}

function fadeAlpha(life: number, lifetime: number): number {
  const k = life / lifetime;
  if (k < 0.12) return k / 0.12;
  if (k > 0.88) return Math.max(0, (1 - k) / 0.12);
  return 1;
}

function drawGreenOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
  tintIdx: number,
): void {
  const [cr, cg, cb] = TINTS[tintIdx % TINTS.length];
  const g = ctx.createRadialGradient(x - r * 0.22, y - r * 0.28, 0, x, y, r);
  g.addColorStop(0, `rgba(${Math.min(255, cr + 60)},${Math.min(255, cg + 50)},${Math.min(255, cb + 30)},${alpha * 0.95})`);
  g.addColorStop(0.45, `rgba(${cr},${cg},${cb},${alpha * 0.75})`);
  g.addColorStop(1, `rgba(${cr * 0.4 | 0},${cg * 0.4 | 0},${cb * 0.4 | 0},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.45})`;
  ctx.beginPath();
  ctx.arc(x - r * 0.28, y - r * 0.32, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawVolumetricPuff(
  ctx: CanvasRenderingContext2D,
  p: SmokePuff,
  sx: number,
  sy: number,
  alpha: number,
  size: number,
): void {
  const tinted = getTintedSprite(p.spriteIdx, p.tint);
  const tiltY = 0.78;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(p.rot);

  ctx.globalAlpha = alpha * 0.22;
  ctx.fillStyle = "rgba(20,50,15,0.5)";
  ctx.beginPath();
  ctx.ellipse(0, size * 0.22, size * 0.42, size * 0.14 * tiltY, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha;
  if (tinted) {
    ctx.drawImage(tinted, -size * 0.5, -size * 0.52, size, size * 1.04);
  }

  ctx.globalAlpha = alpha * 0.35;
  const [hr, hg, hb] = TINTS[(p.tint + 1) % TINTS.length];
  const hi = ctx.createRadialGradient(-size * 0.12, -size * 0.18, 0, -size * 0.08, -size * 0.12, size * 0.35);
  hi.addColorStop(0, `rgba(${hr},${hg},${hb},0.55)`);
  hi.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hi;
  ctx.beginPath();
  ctx.ellipse(-size * 0.08, -size * 0.12, size * 0.32, size * 0.22, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawShowdownSmokeParticles(
  ctx: CanvasRenderingContext2D,
  area: ShowdownSmokeArea,
): void {
  try {
    drawShowdownSmokeParticlesInner(ctx, area);
  } catch (err) {
    console.warn("[showdown] smoke tick failed:", err);
    particles.length = 0;
  }
}

function drawShowdownSmokeParticlesInner(
  ctx: CanvasRenderingContext2D,
  area: ShowdownSmokeArea,
): void {
  ensureSprites();

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const dt = lastFrameMs === 0 ? 0.016 : Math.min(0.1, (now - lastFrameMs) / 1000);
  lastFrameMs = now;
  splitsThisFrame = 0;

  const gasArea = estimateVisibleGasArea(area);
  const target = Math.max(0, Math.min(MAX_PARTICLES, Math.floor(gasArea * PARTICLE_TARGET_DENSITY)));

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i] as SmokePuff & { x?: number; y?: number };
    if (!normalizePuff(p)) {
      particles.splice(i, 1);
      continue;
    }
    p.life += dt;
    p.wx += p.vx * dt;
    p.wy += p.vy * dt;
    p.rot += p.rotSpeed * dt;
    p.vx *= 0.985;
    p.vy *= 0.985;

    const pulse = 0.72 + 0.28 * Math.sin(p.life * p.pulseHz * Math.PI * 2 + p.pulsePhase);
    p.size = p.baseSize * pulse;

    if (p.canSplit && p.life / p.lifetime >= p.splitAt) {
      p.canSplit = false;
      spawnSplitChildren(p, area);
    }

    const { sx, sy } = worldToScreen(p.wx, p.wy, area);
    const offView =
      sx < -p.size * 2 || sx > area.viewW + p.size * 2
      || sy < -p.size * 2 || sy > area.viewH + p.size * 2;

    if (p.life > p.lifetime || !isWorldInGas(p.wx, p.wy, area) || offView) {
      particles.splice(i, 1);
    }
  }

  const need = target - particles.length;
  const maxSpawn = Math.max(0, Math.min(MAX_SPAWN_PER_FRAME, need));
  for (let i = 0; i < maxSpawn; i++) {
    const p = spawnPuff(area, 0);
    if (p) particles.push(p);
  }

  if (Math.random() < 0.55 * maxSpawn) {
    const orb = spawnPuff(area, 2, undefined, undefined, "orb");
    if (orb) particles.push(orb);
  }

  trimParticles(target);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";

  const sorted = [...particles].sort((a, b) => a.size - b.size);
  for (const p of sorted) {
    const fade = fadeAlpha(p.life, p.lifetime);
    const a = fade * p.alphaPeak;
    if (a < 0.015) continue;

    const { sx, sy } = worldToScreen(p.wx, p.wy, area);
    if (p.kind === "orb") {
      drawGreenOrb(ctx, sx, sy, p.size, a, p.tint);
    } else {
      drawVolumetricPuff(ctx, p, sx, sy, a, p.size);
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

export function resetShowdownSmokeParticles(): void {
  particles.length = 0;
  lastFrameMs = 0;
  splitsThisFrame = 0;
}
