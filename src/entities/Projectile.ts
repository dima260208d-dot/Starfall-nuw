// ─────────────────────────────────────────────────────────────────────────────
// Projectile.ts — снаряды боя (мяч, сюрикен, кинжал, файрбол, луч и пр.).
//
// Логика снарядов (движение, столкновения, наведение) сохранена с минимальными
// правками. Полностью переписан только `renderProjectiles` — теперь каждая пуля
// рисуется как объёмная сущность с реалистичной подсветкой, бликами, длинным
// размытым следом и живыми частицами. 2D-оверлей рисуется поверх tilted-3D
// сцены, поэтому каждая пуля имеет два визуальных «этажа»: тень на земле
// (сплющенный по Y эллипс) и подсвеченное тело в воздухе.
// ─────────────────────────────────────────────────────────────────────────────

import { GameMap, collidesWithWalls } from "../game/MapRenderer";
import { projectileBlockedByTile } from "../game/TileMap";
import { handleProjectileTileImpact } from "../utils/effects";
import { resolveProjectileCrateHits, type CrateDamageOpts } from "../utils/crateDamage";
import {
  spawnProjectileFall,
  updateProjectileFalls,
  renderProjectileFalls,
} from "../utils/projectileFallVfx";
import { WORLD_VFX_CANVAS_SCALE, getBattleGroundTilt } from "../game/battleVisualScale";

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  speed: number;
  range: number;
  distanceTraveled: number;
  ownerId: string;
  ownerTeam: string;
  /** Brawler stats id for sprite VFX lookup (miya, yuki, …). */
  color: string;
  type:
    | "shuriken" | "snowball" | "fireball" | "dagger" | "chain" | "beam"
    | "verdelettaInvite" | "verdelettaShadowBolt" | "luminaBeam" | "mirabelSpark"
    | "hanaPetal" | "zafkielTime" | "zafkielVoid" | "zafkielRage" | "zafkielSeek"
    | "devMonsterBolt" | "raidBolt";
  active: boolean;
  piercing: boolean;
  hitIds: Set<string>;
  poison?: boolean;
  slow?: boolean;
  stunDuration?: number;       // stun-effect на хит (секунды)
  homing?: boolean;            // soft-lock на ближайшего врага (Yud)
  temporalRewind?: number;     // секунд rewind позиции цели
  hellBrand?: boolean;         // Verdeletta — адская метка + тень
  /** When false, hit does not grant super charge to owner (Verdeletta shadows). */
  chargeSuper?: boolean;
  explosionRadius?: number;
}

let projIdCounter = 0;

export function createProjectile(
  params: Omit<Projectile, "id" | "active" | "hitIds" | "distanceTraveled">,
): Projectile {
  return {
    ...params,
    id: `proj_${projIdCounter++}`,
    active: true,
    hitIds: new Set(),
    distanceTraveled: 0,
  };
}

/** Whether this projectile hit should add super charge to the attacker. */
export function projectileSuperChargeOpts(
  proj: Projectile,
  attacker: { stats: { id: string } } | null,
): { suppressSuperCharge?: boolean } {
  if (proj.chargeSuper === false) return { suppressSuperCharge: true };
  if (proj.type === "verdelettaShadowBolt") return { suppressSuperCharge: true };
  if (proj.ownerId.startsWith("vshadow_")) return { suppressSuperCharge: true };
  if (attacker?.stats.id === "verdeletta" && proj.type !== "verdelettaInvite") {
    return { suppressSuperCharge: true };
  }
  if (attacker?.stats.id === "lumina" && proj.type !== "luminaBeam") {
    return { suppressSuperCharge: true };
  }
  return {};
}

export interface HomingTarget {
  id: string;
  x: number;
  y: number;
  team: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export function updateProjectiles(
  projectiles: Projectile[],
  dt: number,
  map: GameMap,
  homingTargets?: HomingTarget[],
  crateOpts?: CrateDamageOpts,
): void {
  for (const proj of projectiles) {
    if (!proj.active) continue;

    // Soft-lock наведение (Zafkiel Yud) — постепенно подкручиваем вектор скорости
    // к ближайшему врагу. Турелим не больше 15° за 0.1с, чтобы пуля не «отскакивала».
    if (proj.homing && homingTargets && homingTargets.length > 0) {
      let nearest: HomingTarget | null = null;
      let nearestDist = Infinity;
      for (const t of homingTargets) {
        if (t.team === proj.ownerTeam || t.id === proj.ownerId) continue;
        const dx = t.x - proj.x;
        const dy = t.y - proj.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearestDist) { nearestDist = d; nearest = t; }
      }
      if (nearest && nearestDist < proj.range * 0.9) {
        const targetAngle = Math.atan2(nearest.y - proj.y, nearest.x - proj.x);
        const currentAngle = Math.atan2(proj.vy, proj.vx);
        const maxTurn = (15 * Math.PI / 180) * (dt / 0.1);
        let diff = targetAngle - currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
        const newAngle = currentAngle + turn;
        const speed = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
        proj.vx = Math.cos(newAngle) * speed;
        proj.vy = Math.sin(newAngle) * speed;
      }
    }

    const prevX = proj.x;
    const prevY = proj.y;
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    const dx = proj.x - prevX;
    const dy = proj.y - prevY;
    proj.distanceTraveled += Math.sqrt(dx * dx + dy * dy);

    if (proj.distanceTraveled >= proj.range) {
      spawnProjectileFall(proj);
      proj.active = false;
      continue;
    }
    if (proj.x < 0 || proj.x > map.width || proj.y < 0 || proj.y > map.height) {
      spawnProjectileFall(proj);
      proj.active = false;
      continue;
    }
    const col = collidesWithWalls(proj.x, proj.y, Math.max(proj.radius, 4), map.walls);
    if (col.collides) { proj.active = false; continue; }
    if (map.tileGrid) {
      const { blocked, tx, ty } = projectileBlockedByTile(proj.x, proj.y, map.tileGrid);
      if (blocked) {
        handleProjectileTileImpact(map.tileGrid, tx, ty);
        if (!proj.piercing) { proj.active = false; continue; }
      }
    }
    if (crateOpts?.crates?.length) {
      resolveProjectileCrateHits([proj], crateOpts);
    }
  }
  updateProjectileFalls(dt);
}

// ─────────────────────────────────────────────────────────────────────────────
//  RENDER HELPERS — общие для всех типов снарядов
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
/** Высота, на которой «летит» пуля над землёй (мировые пиксели, для тени). */
const FLIGHT_HEIGHT = 22;

/** Парсит #hex / #rgb / rgb()/rgba() → [r,g,b]. Никогда не падает. */
function rgbOf(c: string): [number, number, number] {
  if (!c) return [255, 255, 255];
  if (c[0] === "#") {
    const h = c.slice(1);
    if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
    if (h.length >= 6) return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  const m = c.match(/\d+/g);
  if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
  return [255, 255, 255];
}
const rgba = (c: string, a: number): string => {
  const [r, g, b] = rgbOf(c);
  return `rgba(${r},${g},${b},${a})`;
};
const lighten = (c: string, k: number): string => {
  const [r, g, b] = rgbOf(c);
  return `rgb(${(r + (255 - r) * k) | 0},${(g + (255 - g) * k) | 0},${(b + (255 - b) * k) | 0})`;
};
const darken = (c: string, k: number): string => {
  const [r, g, b] = rgbOf(c);
  return `rgb(${(r * (1 - k)) | 0},${(g * (1 - k)) | 0},${(b * (1 - k)) | 0})`;
};

/** Стабильный псевдослучайный 0..1 по (seed, i) — для частиц, не дрожащих покадрово. */
function srand(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Рисует «тень» под летящим снарядом — сплющенный по Y тёмный эллипс точно
 * под текущей XY-позицией снаряда. Тень намеренно отделена от тела пули и
 * сдвинута вниз на FLIGHT_HEIGHT, чтобы зритель чувствовал, что снаряд летит
 * над землёй, а не «приклеен» к ней.
 */
function drawGroundShadow(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  size: number,
  intensity: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.36 * intensity;
  const cx = sx;
  const cy = sy + FLIGHT_HEIGHT * 0.55;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
  g.addColorStop(0, "rgba(0,0,0,0.7)");
  g.addColorStop(0.65, "rgba(0,0,0,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  const shadowTilt = getBattleGroundTilt();
  ctx.beginPath();
  ctx.ellipse(cx, cy, size, size * shadowTilt, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * Рисует длинный «след за пулей»: 6 сегментов от хвоста до текущей позиции,
 * с экспоненциально затухающей шириной и альфой, гарантированно проходящий
 * через старую позицию даже на сверхвысоких скоростях. Дополнительный
 * белый «жар-сердцевина» в первой трети следа имитирует chromatic-разделение
 * (как у пуль из современных шутеров).
 */
function drawMotionTrail(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number,
  angle: number, speed: number,
  pr: number, color: string,
  feet: { sx: number; sy: number },
): void {
  if (speed < 1) return;
  const len = Math.min(72, speed * 0.13) * WORLD_VFX_CANVAS_SCALE;
  const segs = 4;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.shadowBlur = 0;
  for (let s = segs; s >= 1; s--) {
    const t1 = s / segs;
    const t2 = (s - 1) / segs;
    const x1 = sx - Math.cos(angle) * len * t1;
    const y1 = sy - Math.sin(angle) * len * t1;
    const x2 = sx - Math.cos(angle) * len * t2;
    const y2 = sy - Math.sin(angle) * len * t2;
    const a = (1 - t1) * 0.7;
    const w = Math.max(1.5, pr * (1 - t1 * 0.7) * 1.05);
    ctx.globalAlpha = a;
    ctx.strokeStyle = t1 > 0.55 ? rgba(color, 0.55) : rgba(color, 0.9);
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // Белый горячий керн только на ближнем участке (последние 35%)
    if (t1 < 0.35) {
      ctx.globalAlpha = (1 - t1) * 0.85;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = Math.max(1, pr * 0.5 * (1 - t1));
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }
  // Длинная мягкая тень-след на земле (намекает на скорость)
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = pr * 1.4;
  const shadowTilt = getBattleGroundTilt();
  ctx.beginPath();
  ctx.moveTo(feet.sx - Math.cos(angle) * len * 0.6, feet.sy - Math.sin(angle) * len * 0.6 * shadowTilt);
  ctx.lineTo(feet.sx, feet.sy);
  ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────────────────────

export function renderProjectiles(
  ctx: CanvasRenderingContext2D,
  projectiles: Projectile[],
  camX: number,
  camY: number,
  frame: number,
): void {
  for (const proj of projectiles) {
    if (!proj.active) continue;

    const pr = proj.radius * WORLD_VFX_CANVAS_SCALE;
    const sxFlat = proj.x - camX;        // позиция «на земле»
    const syFlat = proj.y - camY;
    // Поднимаем визуал в воздух (как над землёй). Тень остаётся на syFlat.
    const sx = sxFlat;
    const sy = syFlat - FLIGHT_HEIGHT;
    const angle = Math.atan2(proj.vy, proj.vx);
    const speed = Math.hypot(proj.vx, proj.vy);
    const feet = { sx: sxFlat, sy: syFlat };

    // 1) Тень снаряда на земле — рисуем ВСЕГДА первой, под след/тело.
    drawGroundShadow(ctx, sxFlat, syFlat, pr * 1.4, 1);

    // 2) Длинный motion-trail (общий для всех типов).
    drawMotionTrail(ctx, sx, sy, angle, speed, pr, proj.color, feet);

    ctx.save();

    switch (proj.type) {
      // ── SHURIKEN ────────────────────────────────────────────────────────
      // 4-лопастная вращающаяся звезда. Лопасти металлические (горизонтальный
      // градиент света), вокруг — двойное вращающееся кольцо энергии,
      // центральный кристалл с пульсирующим свечением. Каждый кадр срывает
      // 1-2 искры, которые тут же гасятся (рисуем точками за рамкой save).
      case "shuriken": {
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;

        ctx.translate(sx, sy);
        ctx.rotate(frame * 0.42);

        // 4-лопастной корпус с металлическим градиентом и тёмной кромкой
        for (let i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate((i * Math.PI) / 2);
          // Тень-подложка лопасти (даёт глубину)
          ctx.fillStyle = "rgba(15,15,25,0.45)";
          ctx.beginPath();
          ctx.moveTo(2, -pr * 1.95);
          ctx.quadraticCurveTo(pr * 0.7 + 2, -pr * 0.3, pr * 0.55 + 2, 2);
          ctx.quadraticCurveTo(pr * 0.7 + 2, pr * 0.3 + 2, 2, pr * 1.95 + 2);
          ctx.quadraticCurveTo(-pr * 0.7 + 2, pr * 0.3 + 2, -pr * 0.55 + 2, 2);
          ctx.quadraticCurveTo(-pr * 0.7 + 2, -pr * 0.3, 2, -pr * 1.95);
          ctx.closePath(); ctx.fill();

          const blade = ctx.createLinearGradient(0, -pr * 1.9, 0, pr * 1.9);
          blade.addColorStop(0, "#FFFFFF");
          blade.addColorStop(0.18, lighten(proj.color, 0.55));
          blade.addColorStop(0.45, proj.color);
          blade.addColorStop(0.85, darken(proj.color, 0.45));
          blade.addColorStop(1, "rgba(20,20,30,0.85)");
          ctx.fillStyle = blade;
          ctx.beginPath();
          ctx.moveTo(0, -pr * 1.9);
          ctx.quadraticCurveTo(pr * 0.7, -pr * 0.3, pr * 0.55, 0);
          ctx.quadraticCurveTo(pr * 0.7, pr * 0.3, 0, pr * 1.9);
          ctx.quadraticCurveTo(-pr * 0.7, pr * 0.3, -pr * 0.55, 0);
          ctx.quadraticCurveTo(-pr * 0.7, -pr * 0.3, 0, -pr * 1.9);
          ctx.closePath(); ctx.fill();

          // Острый светящийся край (правая сторона лопасти)
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(0, -pr * 1.85);
          ctx.quadraticCurveTo(pr * 0.6, -pr * 0.3, pr * 0.5, 0);
          ctx.stroke();
          ctx.restore();
        }

        // Центральный кристалл-камень с пульсацией
        const pulse = 0.7 + Math.sin(frame * 0.3) * 0.15;
        const gemR = pr * 0.55 * pulse;
        const gem = ctx.createRadialGradient(0, 0, 0, 0, 0, gemR);
        gem.addColorStop(0, "#FFFFFF");
        gem.addColorStop(0.45, lighten(proj.color, 0.4));
        gem.addColorStop(1, darken(proj.color, 0.35));
        ctx.fillStyle = gem;
        ctx.beginPath(); ctx.arc(0, 0, gemR, 0, TAU); ctx.fill();
        // Блик-«звёздочка» на кристалле
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-gemR * 0.65, 0); ctx.lineTo(gemR * 0.65, 0);
        ctx.moveTo(0, -gemR * 0.65); ctx.lineTo(0, gemR * 0.65);
        ctx.stroke();
        break;
      }

      // ── SNOWBALL ────────────────────────────────────────────────────────
      // Ледяной кристаллический шар: голубая мерцающая корона, объёмное тело
      // с specular-бликом и ярко-белый «иней» по краю, вокруг — снежинки
      // и стрелы-кристаллы, синхронно с поворотом снаряда.
      case "snowball": {
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = "#80D8FF"; ctx.shadowBlur = 24;

        // Морозная корона
        const aura = ctx.createRadialGradient(sx, sy, pr * 0.5, sx, sy, pr * 2.6);
        aura.addColorStop(0, "rgba(200,235,255,0.55)");
        aura.addColorStop(0.6, "rgba(129,212,250,0.28)");
        aura.addColorStop(1, "rgba(2,136,209,0)");
        ctx.fillStyle = aura;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 2.6, 0, TAU); ctx.fill();

        // Тело шара — многослойный градиент со смещённым блику-light source
        ctx.globalCompositeOperation = "source-over";
        const ball = ctx.createRadialGradient(
          sx - pr * 0.35, sy - pr * 0.4, pr * 0.05,
          sx, sy, pr * 1.05,
        );
        ball.addColorStop(0, "#FFFFFF");
        ball.addColorStop(0.25, "#E1F5FE");
        ball.addColorStop(0.55, "#81D4FA");
        ball.addColorStop(0.92, "#0288D1");
        ball.addColorStop(1, "#01579B");
        ctx.fillStyle = ball;
        ctx.beginPath(); ctx.arc(sx, sy, pr, 0, TAU); ctx.fill();

        // Тонкая ледяная обводка-иней
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 0.92, 0, TAU); ctx.stroke();

        // Кристаллические трещины на поверхности (3 шт, фиксированные по seed-у через id-hash)
        const seedH = (proj.x * 7 + proj.y * 13) | 0;
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const a0 = (seedH * 0.1 + k) % TAU;
          const r0 = pr * 0.2, r1 = pr * 0.85;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a0) * r0, sy + Math.sin(a0) * r0);
          ctx.lineTo(sx + Math.cos(a0 + 0.3) * r1, sy + Math.sin(a0 + 0.3) * r1);
          ctx.stroke();
        }

        // Specular блик — небольшое яркое пятно «солнца» сверху-слева
        const spec = ctx.createRadialGradient(
          sx - pr * 0.42, sy - pr * 0.42, 0,
          sx - pr * 0.42, sy - pr * 0.42, pr * 0.55,
        );
        spec.addColorStop(0, "rgba(255,255,255,0.95)");
        spec.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = spec;
        ctx.beginPath(); ctx.arc(sx - pr * 0.42, sy - pr * 0.42, pr * 0.55, 0, TAU); ctx.fill();

        // Орбитальные снежинки-крестики (4 шт.)
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.lineWidth = 1.6;
        ctx.shadowColor = "#FFFFFF"; ctx.shadowBlur = 6;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + frame * 0.06;
          const orb = pr * (1.25 + 0.08 * Math.sin(frame * 0.2 + i));
          const sxF = sx + Math.cos(a) * orb;
          const syF = sy + Math.sin(a) * orb;
          ctx.beginPath();
          ctx.moveTo(sxF - 3, syF); ctx.lineTo(sxF + 3, syF);
          ctx.moveTo(sxF, syF - 3); ctx.lineTo(sxF, syF + 3);
          const ang2 = Math.PI / 4;
          ctx.moveTo(sxF - Math.cos(ang2) * 2.2, syF - Math.sin(ang2) * 2.2);
          ctx.lineTo(sxF + Math.cos(ang2) * 2.2, syF + Math.sin(ang2) * 2.2);
          ctx.moveTo(sxF + Math.cos(ang2) * 2.2, syF - Math.sin(ang2) * 2.2);
          ctx.lineTo(sxF - Math.cos(ang2) * 2.2, syF + Math.sin(ang2) * 2.2);
          ctx.stroke();
        }
        break;
      }

      // ── FIREBALL ────────────────────────────────────────────────────────
      // Многослойный огненный шар. 3 смещённых сферы пламени дают «горение»,
      // тёмный аэрозоль-дым тянется назад, кометный хвост и эмберы по орбите
      // создают ощущение жара. На сильно вытянутой скорости огонь
      // деформируется (X-сжатие нелинейно).
      case "fireball": {
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = "#FF6D00"; ctx.shadowBlur = 38;

        // Внешний жар-ореол
        const heat = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 3.4);
        heat.addColorStop(0, "rgba(255,90,20,0.32)");
        heat.addColorStop(0.45, "rgba(255,0,0,0.18)");
        heat.addColorStop(1, "rgba(255,0,0,0)");
        ctx.fillStyle = heat;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 3.4, 0, TAU); ctx.fill();

        // 4 смещённых пламя-сферы, флукт-смещение по seed-у времени
        const offsets = [
          { ox: Math.cos(frame * 0.24) * pr * 0.25, oy: Math.sin(frame * 0.31) * pr * 0.25, sc: 1.85 },
          { ox: Math.cos(frame * 0.34 + 2) * pr * 0.16, oy: Math.sin(frame * 0.27 + 1) * pr * 0.16, sc: 1.45 },
          { ox: -Math.cos(frame * 0.19 + 3) * pr * 0.12, oy: -Math.sin(frame * 0.22 + 2) * pr * 0.12, sc: 1.08 },
          { ox: 0, oy: 0, sc: 0.7 },
        ];
        for (const o of offsets) {
          const fg = ctx.createRadialGradient(sx + o.ox, sy + o.oy, 0, sx + o.ox, sy + o.oy, pr * o.sc);
          fg.addColorStop(0, "rgba(255,255,235,0.95)");
          fg.addColorStop(0.18, "rgba(255,235,120,0.85)");
          fg.addColorStop(0.5, "rgba(255,109,0,0.55)");
          fg.addColorStop(0.9, "rgba(183,28,28,0.18)");
          fg.addColorStop(1, "rgba(80,0,0,0)");
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(sx + o.ox, sy + o.oy, pr * o.sc, 0, TAU); ctx.fill();
        }

        // Кометный хвост-дым (тёмный полупрозрачный, normal-комп.)
        ctx.globalCompositeOperation = "source-over";
        for (let s = 4; s >= 1; s--) {
          const t = s / 4;
          const tx = sx - Math.cos(angle) * pr * 1.6 * t;
          const ty = sy - Math.sin(angle) * pr * 1.6 * t;
          const sr = pr * (0.65 + t * 0.35);
          const sg = ctx.createRadialGradient(tx, ty, 0, tx, ty, sr);
          sg.addColorStop(0, `rgba(40,18,8,${0.55 * (1 - t)})`);
          sg.addColorStop(1, "rgba(40,18,8,0)");
          ctx.fillStyle = sg;
          ctx.beginPath(); ctx.arc(tx, ty, sr, 0, TAU); ctx.fill();
        }

        // Эмберы по орбите (8 шт, разной яркости)
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = "#FFCA28"; ctx.shadowBlur = 10;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + frame * 0.18;
          const orb = pr * (0.95 + Math.sin(frame * 0.3 + i) * 0.25);
          const ex = sx + Math.cos(a) * orb;
          const ey = sy + Math.sin(a) * orb;
          ctx.fillStyle = i % 3 === 0 ? "#FFFDE7" : i % 3 === 1 ? "#FFD740" : "#FF6D00";
          ctx.beginPath(); ctx.arc(ex, ey, 2.3 + (i % 2) * 0.7, 0, TAU); ctx.fill();
        }

        // Падающие искры за пулей (имитация гравитации)
        const sparkN = 3;
        for (let i = 0; i < sparkN; i++) {
          const fT = ((frame * 0.06 + i * 0.33) % 1);
          const bx = sx - Math.cos(angle) * pr * (1 + fT * 1.4) + (srand(i, frame & 31) - 0.5) * 6;
          const by = sy - Math.sin(angle) * pr * (1 + fT * 1.4) + fT * 8;
          ctx.globalAlpha = 1 - fT;
          ctx.fillStyle = "#FFAB00";
          ctx.beginPath(); ctx.arc(bx, by, 1.6 + (1 - fT) * 1.4, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }

      // ── DAGGER ──────────────────────────────────────────────────────────
      // Метательный клинок: вытянутое стальное лезвие с edge-highlight, тёмная
      // гарда, рукоять, и две «фантомные» полупрозрачные копии за реальным
      // клинком (motion-ghost). Сохраняем направление движения через rotate.
      case "dagger": {
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.shadowColor = proj.color; ctx.shadowBlur = 18;
        const dLen = pr * 3.0;

        // 2 фантомных копии за реальным клинком (motion-ghost)
        for (let g = 2; g >= 1; g--) {
          ctx.save();
          ctx.translate(-g * pr * 0.7, 0);
          ctx.globalAlpha = 0.18 * g;
          const ghost = ctx.createLinearGradient(-pr, 0, dLen, 0);
          ghost.addColorStop(0, "rgba(150,180,210,0)");
          ghost.addColorStop(0.5, "rgba(200,225,255,0.95)");
          ghost.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = ghost;
          ctx.beginPath();
          ctx.moveTo(dLen, 0);
          ctx.lineTo(-pr * 0.9, -pr * 0.42);
          ctx.lineTo(-pr * 0.9, pr * 0.42);
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = 1;

        // Тень лезвия (даёт объём, лезвие «выпирает» вверх)
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.beginPath();
        ctx.moveTo(dLen, 2.5);
        ctx.lineTo(-pr * 0.85, -pr * 0.55 + 2.5);
        ctx.lineTo(-pr * 0.85, pr * 0.55 + 2.5);
        ctx.closePath(); ctx.fill();

        // Основной клинок — диагональный градиент имитирует sun-reflection
        const blade = ctx.createLinearGradient(-pr, -pr * 0.5, dLen, pr * 0.5);
        blade.addColorStop(0, "#5C7C9E");
        blade.addColorStop(0.25, "#90CAF9");
        blade.addColorStop(0.45, "#E3F2FD");
        blade.addColorStop(0.65, "#FFFFFF");
        blade.addColorStop(0.85, lighten(proj.color, 0.3));
        blade.addColorStop(1, proj.color);
        ctx.fillStyle = blade;
        ctx.beginPath();
        ctx.moveTo(dLen, 0);
        ctx.lineTo(-pr * 0.85, -pr * 0.55);
        ctx.lineTo(-pr * 0.85, pr * 0.55);
        ctx.closePath(); ctx.fill();

        // Светящаяся верхняя кромка
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(dLen, 0);
        ctx.lineTo(-pr * 0.85, -pr * 0.55);
        ctx.stroke();
        // Тёмный нижний край
        ctx.strokeStyle = "rgba(40,55,72,0.7)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(dLen, 0);
        ctx.lineTo(-pr * 0.85, pr * 0.55);
        ctx.stroke();

        // Гарда (кросс-секция)
        ctx.fillStyle = "#37474F";
        ctx.fillRect(-pr * 0.95, -pr * 0.78, pr * 0.32, pr * 1.56);
        ctx.fillStyle = "#90A4AE";
        ctx.fillRect(-pr * 0.93, -pr * 0.76, pr * 0.14, pr * 0.62);
        ctx.fillStyle = "rgba(200,225,255,0.7)";
        ctx.fillRect(-pr * 0.93, -pr * 0.76, pr * 0.05, pr * 0.62);

        // Рукоять
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(-pr * 1.55, -pr * 0.28, pr * 0.62, pr * 0.56);
        ctx.fillStyle = "#3E2723";
        for (let h = 0; h < 3; h++) {
          ctx.fillRect(-pr * 1.5 + h * pr * 0.21, -pr * 0.3, pr * 0.04, pr * 0.6);
        }
        // Навершие
        ctx.fillStyle = "#B0BEC5";
        ctx.beginPath(); ctx.arc(-pr * 1.65, 0, pr * 0.22, 0, TAU); ctx.fill();
        break;
      }

      // ── BEAM ────────────────────────────────────────────────────────────
      // Энергетический луч: 4 слоя ширины (haze, mid, core, edge-line), вдоль
      // линии бегут «энерго-каплы» (chevrons), на дуле — большая дульная
      // вспышка, в конце луча — мини-импакт (расходящиеся искры). Создаёт
      // ощущение реального laser-beam-а высокой энергии.
      case "beam": {
        const bLen = proj.range * 0.9;
        const ex = sx + Math.cos(angle) * bLen;
        const ey = sy + Math.sin(angle) * bLen;
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";

        // 1. Самый внешний софт-глоу (широкий, низкая альфа)
        ctx.strokeStyle = rgba(proj.color, 0.18);
        ctx.lineWidth = pr * 3.6;
        ctx.shadowColor = proj.color; ctx.shadowBlur = 28;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

        // 2. Средний цветной поток
        ctx.strokeStyle = rgba(proj.color, 0.7);
        ctx.lineWidth = pr * 1.7;
        ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

        // 3. Белый ослепительный core
        ctx.strokeStyle = "rgba(255,255,255,0.98)";
        ctx.lineWidth = Math.max(2, pr * 0.65);
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

        // 4. Тонкая бегущая линия-edge для деталей
        ctx.strokeStyle = lighten(proj.color, 0.3);
        ctx.lineWidth = pr * 0.28;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

        // Бегущие «энерго-капли» (chevrons) вдоль луча
        const px = Math.cos(angle), py = Math.sin(angle);
        const nx = -py, ny = px;
        const flow = (frame * 8) % 80;
        const N = Math.floor(bLen / 80);
        for (let i = -1; i < N + 1; i++) {
          const d = flow + i * 80;
          if (d < 0 || d > bLen) continue;
          const cx = sx + px * d;
          const cy = sy + py * d;
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.moveTo(cx + px * pr * 0.8, cy + py * pr * 0.8);
          ctx.lineTo(cx - px * pr * 0.6 + nx * pr * 0.45, cy - py * pr * 0.6 + ny * pr * 0.45);
          ctx.lineTo(cx - px * pr * 0.6 - nx * pr * 0.45, cy - py * pr * 0.6 - ny * pr * 0.45);
          ctx.closePath(); ctx.fill();
        }

        // Дульная вспышка с лучами-«звездой»
        const mFlash = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 3);
        mFlash.addColorStop(0, "rgba(255,255,255,0.95)");
        mFlash.addColorStop(0.4, rgba(lighten(proj.color, 0.4), 0.7));
        mFlash.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = mFlash;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 3, 0, TAU); ctx.fill();
        // 4-лучевая звезда у дула
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 4; i++) {
          const a = i * (Math.PI / 2) + frame * 0.05;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a) * pr * 2.8, sy + Math.sin(a) * pr * 2.8);
          ctx.stroke();
        }

        // Конечный импакт-веер (искры расходятся от дальнего края луча)
        for (let i = 0; i < 5; i++) {
          const a = angle + (Math.random() - 0.5) * 0.9;
          ctx.strokeStyle = rgba(lighten(proj.color, 0.4), 0.85);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex + Math.cos(a) * pr * 2.5, ey + Math.sin(a) * pr * 2.5);
          ctx.stroke();
        }
        break;
      }

      // ── CHAIN ───────────────────────────────────────────────────────────
      // Плазменный шар с электрическими дугами-«усами», выходящими в случайных
      // направлениях, и тремя орбитальными арками-сегментами. Идеально подходит
      // для chain-lightning суперов: чувствуется, что вот-вот «прыгнет» на врага.
      case "chain": {
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;

        // Внешний плазма-ореол
        const chainGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 2.9);
        chainGlow.addColorStop(0, "rgba(255,235,59,0.55)");
        chainGlow.addColorStop(0.5, rgba(proj.color, 0.35));
        chainGlow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = chainGlow;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 2.9, 0, TAU); ctx.fill();

        // Дуги вокруг ядра — 4 шт, разной фазы
        ctx.translate(sx, sy);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + frame * (0.16 + (i % 2) * 0.04);
          ctx.strokeStyle = i % 2 === 0 ? "#FFFFFF" : lighten(proj.color, 0.4);
          ctx.lineWidth = 2.6 - (i % 2) * 0.8;
          ctx.beginPath();
          ctx.arc(0, 0, pr * (0.95 + (i % 3) * 0.18), a, a + Math.PI * 0.45);
          ctx.stroke();
        }

        // 5 случайных «электрических усов» в каждом кадре
        const fseed = (frame * 13) & 255;
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 5; i++) {
          const a = srand(fseed, i) * TAU;
          const segs = 3;
          let px2 = 0, py2 = 0;
          let cx2 = pr * 0.5, cy2 = 0;
          ctx.beginPath();
          ctx.moveTo(px2, py2);
          for (let s = 1; s <= segs; s++) {
            const t = s / segs;
            const len = pr * 2 * t;
            const wob = (srand(fseed, i * 7 + s) - 0.5) * pr * 0.8;
            const ang = a;
            cx2 = Math.cos(ang) * len + Math.cos(ang + Math.PI / 2) * wob;
            cy2 = Math.sin(ang) * len + Math.sin(ang + Math.PI / 2) * wob;
            ctx.lineTo(cx2, cy2);
          }
          ctx.stroke();
        }

        // Плазменный core
        const core = ctx.createRadialGradient(0, 0, 0, 0, 0, pr * 0.75);
        core.addColorStop(0, "#FFFFFF");
        core.addColorStop(0.4, lighten(proj.color, 0.5));
        core.addColorStop(1, proj.color);
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(0, 0, pr * 0.75, 0, TAU); ctx.fill();
        // Слабая «пиксельная» искра в центре (мерцание)
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        const fl = 1 + Math.sin(frame * 0.4) * 0.3;
        ctx.fillRect(-fl, -fl, fl * 2, fl * 2);
        break;
      }

      // ── HANA — розовый лепесток-патрон ─────────────────────────────────
      case "hanaPetal": {
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(sx, sy);
        ctx.rotate(angle + frame * 0.18);
        const petal = ctx.createRadialGradient(0, -pr * 0.35, 0, 0, 0, pr * 1.35);
        petal.addColorStop(0, "#FFFFFF");
        petal.addColorStop(0.25, "#F8BBD0");
        petal.addColorStop(0.65, proj.color);
        petal.addColorStop(1, darken(proj.color, 0.25));
        ctx.fillStyle = petal;
        ctx.beginPath();
        ctx.moveTo(0, -pr * 1.15);
        ctx.bezierCurveTo(pr * 0.95, -pr * 0.35, pr * 0.75, pr * 0.95, 0, pr * 0.6);
        ctx.bezierCurveTo(-pr * 0.75, pr * 0.95, -pr * 0.95, -pr * 0.35, 0, -pr * 1.15);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      }

      // ── ZAFKIEL TIME — серебряный хроно-диск ───────────────────────────
      case "zafkielTime": {
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(sx, sy);
        ctx.rotate(frame * 0.08);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, pr * 0.95, 0, TAU); ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * pr * 0.55, Math.sin(a) * pr * 0.55);
          ctx.lineTo(Math.cos(a) * pr * 0.85, Math.sin(a) * pr * 0.85);
          ctx.stroke();
        }
        ctx.fillStyle = "#ECEFF1";
        ctx.fillRect(-0.9, -pr * 0.65, 1.8, pr * 0.42);
        ctx.fillRect(-0.9, -0.9, 1.8, pr * 0.65);
        const core = ctx.createRadialGradient(0, 0, 0, 0, 0, pr * 0.45);
        core.addColorStop(0, "#FFFFFF");
        core.addColorStop(1, rgba(proj.color, 0));
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(0, 0, pr * 0.45, 0, TAU); ctx.fill();
        break;
      }

      // ── ZAFKIEL VOID — фиолетовая сфера-стазис ─────────────────────────
      case "zafkielVoid": {
        ctx.globalCompositeOperation = "lighter";
        const ring = 0.7 + Math.sin(frame * 0.22) * 0.12;
        const voidG = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 2.2 * ring);
        voidG.addColorStop(0, "rgba(255,255,255,0.92)");
        voidG.addColorStop(0.22, rgba(proj.color, 0.85));
        voidG.addColorStop(0.55, darken(proj.color, 0.35));
        voidG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = voidG;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 2.2 * ring, 0, TAU); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 1.05, 0, TAU); ctx.stroke();
        break;
      }

      // ── ZAFKIEL RAGE — красная игла скорости ───────────────────────────
      case "zafkielRage": {
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        const streak = ctx.createLinearGradient(-pr * 2.2, 0, pr * 1.6, 0);
        streak.addColorStop(0, "rgba(255,255,255,0)");
        streak.addColorStop(0.35, rgba(proj.color, 0.55));
        streak.addColorStop(0.75, proj.color);
        streak.addColorStop(1, "#FFFFFF");
        ctx.fillStyle = streak;
        ctx.beginPath();
        ctx.moveTo(pr * 1.8, 0);
        ctx.lineTo(-pr * 1.4, -pr * 0.35);
        ctx.lineTo(-pr * 0.8, 0);
        ctx.lineTo(-pr * 1.4, pr * 0.35);
        ctx.closePath();
        ctx.fill();
        break;
      }

      // ── ZAFKIEL SEEK — золотой наводящийся шар ───────────────────────
      case "zafkielSeek": {
        ctx.globalCompositeOperation = "lighter";
        const pulse = 0.85 + Math.sin(frame * 0.28) * 0.15;
        const orb = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 1.8 * pulse);
        orb.addColorStop(0, "#FFFFFF");
        orb.addColorStop(0.35, lighten(proj.color, 0.35));
        orb.addColorStop(0.75, proj.color);
        orb.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = orb;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 1.8 * pulse, 0, TAU); ctx.fill();
        ctx.strokeStyle = rgba(lighten(proj.color, 0.5), 0.75);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 5]);
        ctx.lineDashOffset = -frame * 1.1;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 1.25, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        break;
      }

      // ── DEV MONSTER / RAID — тёмный шип ──────────────────────────────
      case "devMonsterBolt":
      case "raidBolt": {
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        const spike = ctx.createLinearGradient(-pr * 1.5, 0, pr * 2, 0);
        spike.addColorStop(0, "rgba(0,0,0,0)");
        spike.addColorStop(0.4, darken(proj.color, 0.2));
        spike.addColorStop(0.85, proj.color);
        spike.addColorStop(1, lighten(proj.color, 0.45));
        ctx.fillStyle = spike;
        ctx.beginPath();
        ctx.moveTo(pr * 2.1, 0);
        ctx.lineTo(-pr * 0.65, -pr * 0.5);
        ctx.lineTo(-pr * 0.25, 0);
        ctx.lineTo(-pr * 0.65, pr * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath(); ctx.arc(pr * 0.55, 0, pr * 0.22, 0, TAU); ctx.fill();
        break;
      }

      default: {
        ctx.globalCompositeOperation = "lighter";
        const orb = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 1.4);
        orb.addColorStop(0, "#FFFFFF");
        orb.addColorStop(0.45, proj.color);
        orb.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = orb;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 1.1, 0, TAU); ctx.fill();
        break;
      }

      // ── VERDELETTA INVITE — green hell bolt with black smoke tail ───────
      case "verdelettaInvite": {
        ctx.globalCompositeOperation = "source-over";
        ctx.shadowColor = "#69F0AE";
        ctx.shadowBlur = 14;

        // Long smoky shadow tail
        for (let s = 7; s >= 1; s--) {
          const t = s / 7;
          const tx = sx - Math.cos(angle) * pr * 2.8 * t;
          const ty = sy - Math.sin(angle) * pr * 2.8 * t;
          const sr = pr * (0.35 + t * 0.55);
          const wisp = ctx.createRadialGradient(tx, ty, 0, tx, ty, sr);
          wisp.addColorStop(0, `rgba(0,0,0,${0.72 * (1 - t * 0.85)})`);
          wisp.addColorStop(0.45, `rgba(18,18,18,${0.55 * (1 - t)})`);
          wisp.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = wisp;
          ctx.beginPath(); ctx.arc(tx, ty, sr, 0, TAU); ctx.fill();
        }

        ctx.globalCompositeOperation = "lighter";
        // Dark core orb
        const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 2.1);
        core.addColorStop(0, "rgba(255,255,255,0.92)");
        core.addColorStop(0.12, "rgba(105,240,174,0.75)");
        core.addColorStop(0.38, "rgba(20,20,20,0.95)");
        core.addColorStop(0.72, "rgba(0,0,0,0.88)");
        core.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 2.1, 0, TAU); ctx.fill();

        // Shadow wisp ring
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + frame * 0.25;
          const orb = pr * (1.0 + Math.sin(frame * 0.3 + i) * 0.22);
          const ex = sx + Math.cos(a) * orb;
          const ey = sy + Math.sin(a) * orb;
          ctx.fillStyle = i % 2 === 0 ? "#111111" : "#69F0AE";
          ctx.beginPath(); ctx.arc(ex, ey, 2.2 + (i % 2), 0, TAU); ctx.fill();
        }

        // Elongated shadow bolt body along velocity
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        const bolt = ctx.createLinearGradient(-pr * 2, 0, pr * 2.2, 0);
        bolt.addColorStop(0, "rgba(0,0,0,0)");
        bolt.addColorStop(0.35, "rgba(0,0,0,0.95)");
        bolt.addColorStop(0.75, "rgba(105,240,174,0.55)");
        bolt.addColorStop(1, "rgba(185,246,202,0.9)");
        ctx.fillStyle = bolt;
        ctx.beginPath();
        ctx.moveTo(pr * 2.2, 0);
        ctx.lineTo(-pr * 1.2, -pr * 0.55);
        ctx.lineTo(-pr * 1.2, pr * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }

      // ── VERDELETTA SHADOW BOLT — dark shard with green edge glow ────────
      case "verdelettaShadowBolt": {
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(sx, sy);
        ctx.rotate(angle);
        ctx.shadowColor = "#69F0AE";
        ctx.shadowBlur = 16;

        for (let g = 2; g >= 1; g--) {
          ctx.save();
          ctx.globalAlpha = 0.15 * g;
          ctx.fillStyle = "#212121";
          ctx.beginPath();
          ctx.moveTo(pr * 2.2, 0);
          ctx.lineTo(-pr * 0.8, -pr * 0.45);
          ctx.lineTo(-pr * 0.8, pr * 0.45);
          ctx.closePath();
          ctx.fill();
          ctx.translate(-g * pr * 0.5, 0);
          ctx.restore();
        }

        const shard = ctx.createLinearGradient(-pr, 0, pr * 2.2, 0);
        shard.addColorStop(0, "rgba(0,0,0,0)");
        shard.addColorStop(0.35, "#212121");
        shard.addColorStop(0.7, "#424242");
        shard.addColorStop(0.9, "#69F0AE");
        shard.addColorStop(1, "#B9F6CA");
        ctx.fillStyle = shard;
        ctx.beginPath();
        ctx.moveTo(pr * 2.2, 0);
        ctx.lineTo(-pr * 0.75, -pr * 0.42);
        ctx.lineTo(-pr * 0.75, pr * 0.42);
        ctx.closePath();
        ctx.fill();
        break;
      }

      // ── MIRABEL SPARK — yellow knowledge spark from an open book ─────────
      case "mirabelSpark": {
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(sx, sy);
        const pulse = 0.82 + Math.sin(frame * 0.35) * 0.18;
        const coreR = pr * pulse;

        ctx.shadowColor = "#FFEB3B";
        ctx.shadowBlur = 0;
        const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2.6);
        halo.addColorStop(0, "rgba(255,255,255,0.95)");
        halo.addColorStop(0.35, "rgba(255,235,59,0.85)");
        halo.addColorStop(0.7, "rgba(255,152,0,0.35)");
        halo.addColorStop(1, "rgba(229,57,53,0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(0, 0, coreR * 2.6, 0, TAU); ctx.fill();

        ctx.fillStyle = "#FFF59D";
        ctx.beginPath(); ctx.arc(0, 0, coreR * 0.75, 0, TAU); ctx.fill();

        for (let i = 0; i < 4; i++) {
          const a = angle + (i / 4) * TAU + frame * 0.12;
          const len = coreR * (1.4 + (i % 2) * 0.35);
          ctx.strokeStyle = i % 2 === 0 ? "rgba(255,235,59,0.9)" : "rgba(255,112,67,0.75)";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * coreR * 0.4, Math.sin(a) * coreR * 0.4);
          ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
          ctx.stroke();
        }

        ctx.rotate(-angle);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "rgba(255,205,210,0.7)";
        ctx.fillRect(-pr * 1.1, pr * 0.35, pr * 2.2, pr * 0.55);
        ctx.globalAlpha = 1;
        break;
      }

      // ── LUMINA BEAM — golden chest ray with chain sparkles ───────────────
      case "luminaBeam": {
        const bLen = Math.min(proj.range * 0.95, proj.distanceTraveled + 40);
        const ex = sx + Math.cos(angle) * bLen;
        const ey = sy + Math.sin(angle) * bLen;
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";

        ctx.strokeStyle = "rgba(255,213,79,0.22)";
        ctx.lineWidth = pr * 3.2;
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

        ctx.strokeStyle = "rgba(255,213,79,0.85)";
        ctx.lineWidth = pr * 1.4;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = Math.max(2, pr * 0.55);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();

        const px = Math.cos(angle), py = Math.sin(angle);
        const flow = (frame * 10) % 70;
        for (let i = -1; i < Math.floor(bLen / 70) + 1; i++) {
          const d = flow + i * 70;
          if (d < 0 || d > bLen) continue;
          const cx = sx + px * d;
          const cy = sy + py * d;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, TAU); ctx.fill();
        }

        const mFlash = ctx.createRadialGradient(sx, sy, 0, sx, sy, pr * 2.8);
        mFlash.addColorStop(0, "rgba(255,255,255,0.95)");
        mFlash.addColorStop(0.35, "rgba(255,213,79,0.75)");
        mFlash.addColorStop(1, "rgba(255,213,79,0)");
        ctx.fillStyle = mFlash;
        ctx.beginPath(); ctx.arc(sx, sy, pr * 2.8, 0, TAU); ctx.fill();
        break;
      }
    }

    ctx.restore();

    // ── Homing targeting ring (Yud) — поверх всего, не зависит от типа ──
    if (proj.homing) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const pulse = 0.65 + Math.sin(frame * 0.25) * 0.25;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = "#FFA726";
      ctx.lineWidth = 2.2;
      ctx.shadowBlur = 0;
      ctx.setLineDash([6, 5]);
      ctx.lineDashOffset = -frame * 1.3;
      ctx.beginPath(); ctx.arc(sx, sy, pr * 2.2, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      // 4 «коготь»-метки целеуказателя
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "rgba(255,167,38,0.95)";
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + frame * 0.04;
        const r1 = pr * 2.05, r2 = pr * 2.55;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
        ctx.lineTo(sx + Math.cos(a) * r2, sy + Math.sin(a) * r2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  renderProjectileFalls(ctx, camX, camY);
}
