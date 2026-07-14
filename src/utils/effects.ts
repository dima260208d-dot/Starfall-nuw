// ─────────────────────────────────────────────────────────────────────────────
// effects.ts — система боевых VFX (полная переработка под 3D-сцену).
//
// Все эффекты рисуются 2D-оверлеем поверх tilted-3D-сцены боя (камера
// CAM_TILT_DEG ≈ 30° от вертикали). Из-за этого:
//   • Ground-эффекты (зоны, ground-кольца, скорчи) рисуются сплющенными по
//     Y эллипсами (`GROUND_TILT ≈ 0.38`) — выглядят как круги, лежащие на полу.
//   • Воздушные эффекты (купола, ауры, лучи) получают «подъём» по экранному Y
//     и часто рисуются с тенью на полу — это даёт ощущение объёма.
//   • Каждый эффект собран из 4–6 слоёв: ground-skirt → body → highlights →
//     particles → embers. Они идут разными composite-режимами (`lighter` для
//     энергетики, `source-over` для атмосферы / дыма), что и даёт «киношный»
//     punch как у Brawl Stars.
//
// Публичный API ПОЛНОСТЬЮ совместим со старым: spawnEffect, clearEffects,
// peekEffects, updateEffects, renderEffects, removeTurretsForOwner,
// spawnTaroTurretEffect, makeZigzag, ensureStatusAura. Все типы эффектов
// (`EffectKind`) и поля `Effect` сохранены, ничего из вызывающего кода менять
// не нужно. Добавлен один новый kind — `passiveHealAura` (мягкая аура для
// пассивного лечения), который можно использовать наряду с `healPulse`.
// ─────────────────────────────────────────────────────────────────────────────

import type { Brawler } from "../entities/Brawler";
import type { Projectile } from "../entities/Projectile";
import type { Crate } from "../game/MapRenderer";
import type { TileGrid } from "../game/TileMap";
import { TileType, getTile, destroyTile, TILE_CELL_SIZE, TILE_PROPS, tileShouldShakeOnHit } from "../game/TileMap";
import { updateBattleScreenFX } from "../game/battleScreenFX";
import { isBattle3DActive } from "../game/battle3DWorld";
import {
  WORLD_VFX_CANVAS_SCALE,
  getBattleGroundTilt,
  groundEllipsePath,
  brawlerFootWorldDy,
} from "../game/battleVisualScale";
import {
  clearMotionTrails,
  tickMotionTrails,
  renderMotionTrailsGround,
  renderMotionTrailsAir,
} from "../game/motionTrailSystem";
import {
  clearVerdelettaShadows,
  registerVerdelettaShadowEffectSpawner,
  updateVerdelettaShadows,
} from "./verdelettaShadows";
import { clearDevBattleMonsters } from "./devBattleMonsters";
import { clearLuminaMechanics, clampLuminaLinkPositions, updateLuminaMechanics } from "./luminaMechanics";
import {
  clearOliverBugs,
  registerOliverBugVfx,
  renderOliverBugs,
  updateOliverBugs,
} from "./oliverBugs";
import { updateOliverMechanics } from "./oliverMechanics";
import {
  clearCallistaMechanics,
  renderCallistaFlasks,
  updateCallistaMechanics,
} from "./callistaMechanics";
import {
  clearAirinMechanics,
  renderAirinCapsules,
  updateAirinMechanics,
} from "./airinMechanics";
import {
  clearElianMechanics,
  renderElianOrbs,
  renderElianVortexes,
  updateElianMechanics,
} from "./elianMechanics";
import {
  clearSilvenMechanics,
  renderSilvenDryads,
  renderSilvenTrees,
  renderSilvenVines,
  updateSilvenMechanics,
} from "./silvenMechanics";
import {
  clearVittoriaMechanics,
  tickVittoriaMechanics,
} from "./vittoriaMechanics";
import {
  clearOctaviaMechanics,
  renderOctaviaOrbs,
  updateOctaviaMechanics,
} from "./octaviaMechanics";
import {
  clearZephyrinMechanics,
  renderZephyrinTornados,
  updateZephyrinMechanics,
} from "./zephyrinMechanics";
import { spawnDamageNumber } from "./damageNumbers";
import { clearProjectileFalls } from "./projectileFallVfx";

export interface EffectUpdateOpts {
  crates?: Crate[];
  onCrateDestroyed?: (crate: Crate, cx: number, cy: number) => void;
  /** Server battle bridge: animate VFX only — no damage, zones, or mechanics. */
  visualOnly?: boolean;
}

export type EffectKind =
  // ── базовые боевые VFX ──
  | "burst"          // быстрая вспышка-импакт (попадание, муззл, мини-взрыв)
  | "shockwave"      // широкая ground-волна (мета-импакт, объявление супера)
  | "spark"          // одиночная искра-комета
  | "trail"          // светящаяся линия энергии между двумя точками
  | "muzzleFlash"    // дульная вспышка ствола (форма-капля по направлению)
  | "bulletImpact"   // мини-вспышка-звезда при попадании пули
  | "explosion"      // полноценный AOE-взрыв (огонь+дым+ground scorch)
  | "killExplosion"  // эффектный death-взрыв бойца (большой)
  | "healPulse"      // активное лечение: тёплый радиальный пульс с «плюсами»
  | "passiveHealAura" // ★ NEW: мягкая зелёная аура для пассивной регенерации
  // ── зоны/действия суперов ──
  | "snowZone"       // Юки супер — ледяная арена
  | "lightCage"      // Кендзи супер — электрическая клетка
  | "petalZone"      // Хана супер — лепестковая зона лечения
  | "poisonZone"     // Рин супер — токсичный туман
  | "meteor"         // Сора супер — падающий метеор с warning-marker
  | "lightningBolt"  // одиночный молниевый разряд (зигзаг)
  | "turret"         // Таро супер — турель
  // ── ауры, привязанные к бойцу ──
  | "shieldDome"     // защитный купол (любой цвет — золото/серебро/радуга)
  | "berserkAura"    // огненная аура (Горо, баф ярости)
  | "teleportFlash"  // воронка телепортации
  | "freezeAura"     // ледяная глыба вокруг бойца (заморозка)
  | "rootAura"       // корни/лианы у ног (root)
  | "smokeBlindAura" // дымная пелена (слепота)
  | "allyBlindAura"  // союзный дым — лёгкая дымка
  | "hellBrandBody"  // тёмно-зелёная метка на теле (hellBrand)
  | "slowAura"       // голубая водяная рябь у ног (замедление)
  | "stunAura"       // звёзды-кружение над головой (стан)
  | "poisonAura"     // зелёный токсичный туман поверх отравленного
  | "vulnerableAura" // фиолетовая «треснутая» маркировка-цель
  | "speedAura"      // бирюзовые шлейфы скорости у ног
  | "damageAura"     // багровая агрессивная аура (баф силы)
  | "reloadAura"     // жёлтые шестерёнки-ускорение перезарядки
  | "hellBrandMark"  // Verdeletta — зелёная метка над врагом
  | "verdelettaSuper"       // Verdeletta ult — hell portal / shadow ritual
  | "verdelettaMuzzle"      // Verdeletta attack muzzle flash
  | "verdelettaImpact"      // Verdeletta bolt impact
  | "verdelettaShadowMuzzle"
  | "verdelettaShadowImpact"
  | "verdelettaShadowSpawn"
  | "luminaChain"
  | "luminaDome"
  | "luminaMuzzle"
  | "luminaBeam"
  | "luminaSuperCast"
  | "oliverBugLaunch"
  | "oliverBugImpact"
  | "oliverReplicator"
  | "callistaFlaskLaunch"
  | "callistaFlaskImpact"
  | "callistaZone"
  | "callistaSuperZone"
  | "airinCapsuleLaunch"
  | "airinCapsuleImpact"
  | "airinSmokeZone"
  | "airinSmokeLinger"
  | "airinEvacSigil"
  | "airinEvacSmoke"
  | "elianStarLaunch"
  | "elianStarBurst"
  | "elianGravityVortex"
  | "elianMiniVortex"
  | "elianVortexBurst"
  | "elianSuperCast"
  | "silvenVineLaunch"
  | "silvenVineImpact"
  | "silvenIvyWrap"
  | "silvenSuperCast"
  | "silvenTreeFade"
  | "silvenDryadSpawn"
  | "silvenDryadStrike"
  | "silvenDryadFade"
  | "vittoriaBiteSlash"
  | "vittoriaBloodMoon"
  | "vittoriaBloodEyes"
  | "vittoriaNightCurse"
  | "octaviaInkOrb"
  | "octaviaInkSplash"
  | "octaviaInkStrip"
  | "octaviaTentacleBurst"
  | "octaviaTentacleZone"
  | "zephyrinTornadoLaunch"
  | "zephyrinTornadoHit"
  | "zephyrinTornadoFade"
  | "zephyrinWhirlwindCast"
  | "zephyrinGaleAura"
  | "zephyrinSuperCast"
  | "zephyrinStormBurst"
  | "mirabelSparkCast"
  | "mirabelLearningAura"
  | "mirabelSuperCast"
  // ── индикаторы состояния бойца ──
  | "superReadyStars" // ★ NEW: вращающиеся жёлтые звёзды над бойцом с готовым супером
  | "shieldHP"        // ★ NEW: голубой щит с числом HP над бойцом (tempShieldHp)
  // ── жизненный цикл ──
  | "respawnBeam"    // вертикальный луч-возрождение
  | "reviveColumn"   // колонна-вспышка феникса (pet revive)
  | "boneDebris";    // костяной блок — разлёт косточек

export type LinkedStatus =
  | "stun" | "berserker" | "slow" | "poison" | "vulnerable"
  | "freeze" | "root" | "speedBoost" | "damageBoost" | "reloadBoost" | "hellBrand"
  | "smokeBlind" | "allyBlind"
  | "bloodMoon" | "vampireNight" | "zephyrinGale";

export interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  /** Если задано — на каждом тике координаты подтягиваются за бойцом. */
  followBrawler?: Brawler | null;

  timer: number;
  maxTimer: number;

  radius: number;
  color: string;
  secondary?: string;

  toX?: number;
  toY?: number;
  angle?: number;

  delay?: number;
  exploded?: boolean;
  fallHeight?: number;

  ownerId?: string;
  ownerTeam?: string;
  /** Brawler stats id for sprite VFX (miya, yuki, …). */
  damagePerTick?: number;
  tickInterval?: number;
  tickTimer?: number;
  tickRange?: number;

  seed: number;
  particleCount?: number;
  zigzag?: { x: number; y: number }[];

  /** Если задано — эффект автоматически удаляется, как только у бойца исчезает
   *  соответствующий статус. Используется для аур-привязок. */
  linkedStatus?: LinkedStatus;

  /** Числовое значение для отображения (например, HP щита). Обновляется
   *  каждый кадр в авто-привязке `autoAttachBrawlerAuras`. */
  value?: number;

  /** Кендзи: id бойцов, попавших в клетку при старте (не могут выйти до конца). */
  cagePrisoners?: string[];
  /** Кулдаун урона от «стены» клетки по id бойца. */
  cageWallHitCd?: Record<string, number>;
  /** Lumina chain endpoints (updated each tick). */
  linkAId?: string;
  linkBId?: string;
  /** Lumina star 3 — allies inside dome are not slowed and gain shield. */
  luminaGraceAllies?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC API (совместимо со старым)
// ─────────────────────────────────────────────────────────────────────────────

const effects: Effect[] = [];
let replayRenderEffects: Effect[] | null = null;
let seedCounter = 1;
const nextSeed = () => (seedCounter = (seedCounter * 9301 + 49297) & 0x7fffffff);

/** Replay-only: render VFX from a captured snapshot instead of live battle state. */
export function setReplayRenderEffects(snapshot: Effect[] | null): void {
  replayRenderEffects = snapshot;
}

export function spawnEffect(eff: Omit<Effect, "seed"> & { seed?: number }): Effect {
  const e: Effect = { seed: eff.seed ?? nextSeed(), ...eff } as Effect;
  effects.push(e);
  return e;
}

/** Костяной блок (DECORATION) — взрыв на кучу разлетающихся косточек. */
export function spawnBoneBlockShatter(wx: number, wy: number): void {
  spawnEffect({
    kind: "boneDebris",
    x: wx,
    y: wy,
    timer: 1.15,
    maxTimer: 1.15,
    radius: 46,
    color: "#E8E0D4",
    secondary: "#A1887F",
    particleCount: 18,
  });
  spawnEffect({
    kind: "burst",
    x: wx,
    y: wy,
    timer: 0.28,
    maxTimer: 0.28,
    radius: 24,
    color: "#D7CCC8",
    secondary: "#8D6E63",
  });
}

/** Уничтожить destructible-тайл с VFX (кости, забор и т.д.). */
export function destroyDestructibleTileAt(grid: TileGrid, tx: number, ty: number): void {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return;
  const type = getTile(grid, tx, ty);
  const C = grid.cellSize ?? TILE_CELL_SIZE;
  const wx = (tx + 0.5) * C;
  const wy = (ty + 0.5) * C;
  destroyTile(grid, tx, ty);
  if (type === TileType.DECORATION) {
    spawnBoneBlockShatter(wx, wy);
  } else if (type !== TileType.GRASS && TILE_PROPS[type]?.destructible) {
    spawnEffect({
      kind: "burst",
      x: wx,
      y: wy,
      timer: 0.22,
      maxTimer: 0.22,
      radius: 18,
      color: "#BCAAA4",
      secondary: "#6D4C41",
    });
  }
}

// ── Hit shake (банки, декоративные тайлы) ───────────────────────────────────
interface ShakeEntry {
  timer: number;
  maxTimer: number;
  magnitude: number;
  seed: number;
}

const hitShakes = new Map<string, ShakeEntry>();

export function triggerHitShake(
  x: number,
  y: number,
  key?: string,
  magnitude = 5,
  duration = 0.24,
): void {
  const k = key ?? `p:${Math.round(x / 12)}:${Math.round(y / 12)}`;
  hitShakes.set(k, {
    timer: duration,
    maxTimer: duration,
    magnitude,
    seed: (k.charCodeAt(0) * 17 + Math.round(x + y)) % 997,
  });
}

export function triggerCrateHitShake(crate: { x: number; y: number; w: number; h: number }): void {
  const cx = crate.x + crate.w / 2;
  const cy = crate.y + crate.h / 2;
  triggerHitShake(cx, cy, `crate:${Math.round(crate.x)}:${Math.round(crate.y)}`, 6, 0.26);
}

export function triggerTileHitShake(tx: number, ty: number, cellSize: number, tileType?: number): void {
  if (tileType != null && !tileShouldShakeOnHit(tileType)) return;
  const wx = (tx + 0.5) * cellSize;
  const wy = (ty + 0.5) * cellSize;
  triggerHitShake(wx, wy, `tile:${tx},${ty}`, 4.5, 0.22);
}

/** Обработка попадания снаряда в тайл: тряска + разрушение destructible. */
export function handleProjectileTileImpact(grid: TileGrid, tx: number, ty: number): void {
  const type = getTile(grid, tx, ty);
  if (tileShouldShakeOnHit(type)) triggerTileHitShake(tx, ty, grid.cellSize, type);
  if (TILE_PROPS[type]?.destructible) destroyDestructibleTileAt(grid, tx, ty);
}

function updateHitShakes(dt: number): void {
  for (const [k, s] of hitShakes) {
    s.timer -= dt;
    if (s.timer <= 0) hitShakes.delete(k);
  }
}

export function getHitShakeOffset(x: number, y: number, key?: string): { ox: number; oy: number } {
  const k = key ?? `p:${Math.round(x / 12)}:${Math.round(y / 12)}`;
  const s = hitShakes.get(k);
  if (!s || s.timer <= 0) return { ox: 0, oy: 0 };
  const t = s.timer / s.maxTimer;
  const phase = (1 - t) * 34 + s.seed * 0.07;
  const amp = s.magnitude * t;
  return {
    ox: Math.sin(phase) * amp,
    oy: Math.cos(phase * 1.17) * amp * 0.65,
  };
}

export function getCrateShakeOffset(crate: { x: number; y: number }): { ox: number; oy: number } {
  return getHitShakeOffset(crate.x, crate.y, `crate:${Math.round(crate.x)}:${Math.round(crate.y)}`);
}

export function getTileShakeOffset(tx: number, ty: number, cellSize: number): { ox: number; oy: number } {
  const wx = (tx + 0.5) * cellSize;
  const wy = (ty + 0.5) * cellSize;
  return getHitShakeOffset(wx, wy, `tile:${tx},${ty}`);
}

export function clearEffects(): void {
  effects.length = 0;
  clearVerdelettaShadows();
  clearDevBattleMonsters();
  clearLuminaMechanics();
  clearOliverBugs();
  clearCallistaMechanics();
  clearAirinMechanics();
  clearElianMechanics();
  clearSilvenMechanics();
  clearVittoriaMechanics();
  clearOctaviaMechanics();
  clearZephyrinMechanics();
  clearProjectileFalls();
  clearMotionTrails();
}

/** Снимок для логики боя (например «дождаться долёта снарядов босса»). Не мутировать. */
export function peekEffects(): readonly Effect[] {
  return effects;
}

export function removeTurretsForOwner(ownerKey: string): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    if (e.kind === "turret" && e.ownerId === ownerKey) effects.splice(i, 1);
  }
}

/** Одна турель на ownerKey: старая снимается, новая ставится. */
export function spawnTaroTurretEffect(
  ownerKey: string,
  ownerTeam: string,
  eff: Omit<Effect, "seed" | "kind" | "ownerId" | "ownerTeam"> & { seed?: number },
): Effect {
  removeTurretsForOwner(ownerKey);
  return spawnEffect({
    kind: "turret",
    ownerId: ownerKey,
    ownerTeam,
    ...eff,
  } as Omit<Effect, "seed"> & { seed?: number });
}

export function makeZigzag(
  x1: number, y1: number, x2: number, y2: number,
  segments = 6, jitter = 18,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [{ x: x1, y: y1 }];
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.max(1, Math.hypot(dx, dy));
  const px = -dy / len, py = dx / len;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const cx = x1 + dx * t, cy = y1 + dy * t;
    const j = (Math.random() * 2 - 1) * jitter;
    pts.push({ x: cx + px * j, y: cy + py * j });
  }
  pts.push({ x: x2, y: y2 });
  return pts;
}

/** Гарантирует, что у бойца висит одна аура заданного типа: если есть — продлевает,
 *  если нет — создаёт. Используется в Brawler.addStatus для авто-привязки визуала. */
export function ensureStatusAura(
  b: Brawler,
  status: LinkedStatus,
  kind: EffectKind,
  duration: number,
  defaults: { radius?: number; color?: string; secondary?: string; particleCount?: number } = {},
): void {
  for (const e of effects) {
    if (e.followBrawler === b && e.linkedStatus === status && e.kind === kind) {
      if (duration > e.timer) { e.timer = duration; e.maxTimer = Math.max(e.maxTimer, duration); }
      return;
    }
  }
  spawnEffect({
    kind,
    followBrawler: b,
    linkedStatus: status,
    x: b.x, y: b.y,
    radius: defaults.radius ?? (b.radius + 14),
    color: defaults.color ?? "#FFFFFF",
    secondary: defaults.secondary,
    timer: duration,
    maxTimer: duration,
    particleCount: defaults.particleCount,
  });
}

/**
 * Гарантирует, что у бойца висит эффект `kind` БЕЗ привязки к статусу — это
 * используется для индикаторов (звёзды над готовым супером, щит-HP). Эффект
 * автоматически продлевается каждый тик, пока условие истинно, и удаляется
 * по таймауту, если перестали продлевать. Поле `value` обновляется текущее.
 */
function ensureBrawlerIndicator(
  b: Brawler,
  kind: EffectKind,
  defaults: { radius?: number; color?: string; value?: number } = {},
): void {
  for (const e of effects) {
    if (e.followBrawler === b && e.linkedStatus === undefined && e.kind === kind) {
      e.timer = 0.4; e.maxTimer = 0.4; // постоянно продлеваем
      if (defaults.value !== undefined) e.value = defaults.value;
      return;
    }
  }
  spawnEffect({
    kind,
    followBrawler: b,
    x: b.x, y: b.y,
    radius: defaults.radius ?? (b.radius + 14),
    color: defaults.color ?? "#FFFFFF",
    timer: 0.4, maxTimer: 0.4,
    value: defaults.value,
  });
}

/**
 * Снимает все эффекты данного kind, привязанные к данному бойцу. Используется
 * когда условие индикатора пропало (super-ready снят, shield-HP = 0).
 */
function removeBrawlerIndicator(b: Brawler, kind: EffectKind): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    if (e.followBrawler === b && e.linkedStatus === undefined && e.kind === kind) {
      effects.splice(i, 1);
    }
  }
}

/**
 * Каждый кадр пробегает по всем живым бойцам и автоматически привязывает
 * статусные ауры (poison/slow/stun/berserker/vulnerable/freeze) и индикаторы
 * состояния (super-ready stars, shield HP). Это решает проблему, что раньше
 * статусы добавлялись через `Brawler.addStatus`, но визуал не появлялся.
 */
function autoAttachBrawlerAuras(allBrawlers: Brawler[]): void {
  for (const b of allBrawlers) {
    if (!b.alive) continue;

    // ── статусные ауры (получают timer = duration статуса + 0.1 на запас) ──
    for (const s of b.statusEffects) {
      const dur = Math.max(s.duration, 0.3);
      switch (s.type) {
        case "stun":      ensureStatusAura(b, "stun",       "stunAura",       dur, { radius: b.radius + 12 }); break;
        case "slow":      ensureStatusAura(b, "slow",       "slowAura",       dur, { radius: b.radius + 24 }); break;
        case "poison":    ensureStatusAura(b, "poison",     "poisonAura",     dur, { radius: b.radius + 18 }); break;
        case "berserker": ensureStatusAura(b, "berserker",  "berserkAura",    dur, { radius: b.radius + 18 }); break;
        case "vulnerable":ensureStatusAura(b, "vulnerable", "vulnerableAura", dur, { radius: b.radius + 16 }); break;
        case "speedBoost": ensureStatusAura(b, "speedBoost", "speedAura",       dur, { radius: b.radius + 20, color: "#69F0AE" }); break;
        case "root":       ensureStatusAura(b, "root",       "rootAura",       dur, { radius: b.radius + 16, color: "#8D6E63", secondary: "#558B2F" }); break;
        case "smokeBlind": ensureStatusAura(b, "smokeBlind", "smokeBlindAura", dur, { radius: b.radius + 22, color: "#78909C" }); break;
        case "allyBlind":  ensureStatusAura(b, "allyBlind",  "allyBlindAura",  dur, { radius: b.radius + 18, color: "#A5D6A7" }); break;
        case "hellBrand":  ensureStatusAura(b, "hellBrand",  "hellBrandBody",  dur, { radius: b.radius + 14, color: "#69F0AE", secondary: "#111111" }); break;
      }
    }

    // ── super-ready stars ──
    if (b.superReady) {
      ensureBrawlerIndicator(b, "superReadyStars", { radius: b.radius + 6, color: "#FFD740" });
    } else {
      removeBrawlerIndicator(b, "superReadyStars");
    }

    // ── spawn / respawn immunity dome (no linkedStatus — not Ronin super) ──
    syncSpawnImmunityDome(b);

    // ── shield HP индикатор (показывает оставшийся tempShieldHp) ──
    if (b.tempShieldHp > 0) {
      ensureBrawlerIndicator(b, "shieldHP", { radius: b.radius + 8, color: "#80D8FF", value: b.tempShieldHp });
    } else {
      removeBrawlerIndicator(b, "shieldHP");
    }
  }
}

/** Купол неуязвимости при первом появлении и после респавна. */
function syncSpawnImmunityDome(b: Brawler): void {
  if (b.invulnerable && b.invulnerableTimer > 0) {
    let found = false;
    for (const e of effects) {
      if (e.followBrawler === b && e.kind === "shieldDome" && e.linkedStatus === undefined) {
        e.timer = b.invulnerableTimer;
        e.maxTimer = Math.max(e.maxTimer, b.invulnerableTimer);
        found = true;
        break;
      }
    }
    if (!found) {
      spawnEffect({
        kind: "shieldDome",
        x: b.x,
        y: b.y,
        radius: b.radius + 14,
        color: "#80D8FF",
        timer: b.invulnerableTimer,
        maxTimer: b.invulnerableTimer,
        followBrawler: b,
      });
    }
    return;
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    if (e.followBrawler === b && e.kind === "shieldDome" && e.linkedStatus === undefined) {
      effects.splice(i, 1);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

/** Снижает shadowBlur у VFX без удаления эффектов. */
function applyVfxShadow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  if (blur <= 0) {
    ctx.shadowBlur = 0;
    return;
  }
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.min(12, blur * 0.42);
}

/** Ground contact pad for zone/dome ults in 3D battles (ellipse on floor + soft tint). */
function drawUltGroundPad(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  R: number,
  color: string,
  fade: number,
  alpha = 0.4,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha * fade;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  groundEllipsePath(ctx, sx, sy + 3, R * 1.04);
  ctx.fill();
  const pad = ctx.createRadialGradient(sx, sy, R * 0.06, sx, sy, R);
  pad.addColorStop(0, rgba(color, 0.5));
  pad.addColorStop(0.62, rgba(color, 0.16));
  pad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = pad;
  groundEllipsePath(ctx, sx, sy, R);
  ctx.fill();
  ctx.restore();
}
/** Сплющивание по Y для ground-эллипсов (под tilted-камеру). */
/**
 * Сжатие по экранной Y для эффектов, «лежащих на полу» (поля ульт, скорчи,
 * ground-кольца, тени-эллипсы). Раньше это была константа
 * `BRAWLER_FLOOR_HALO_RY_OVER_RX ≈ 0.38` — соответствующая тому, как 2D-кольца
 * команды под бойцом рисуются на 2D-канвасе.
 *
 * В 3D-режиме боя (`battle3DWorld`) кольцо команды под бойцом — это уже
 * настоящий `RingGeometry` под ortho-камерой с компенсацией frustum'а
 * (`frustum_h = camH·cos(θ)`), поэтому горизонтальный круг на земле виден
 * как ПОЧТИ ПОЛНЫЙ КРУГ (ratio ≈ 1). Чтобы 2D-эффекты на canvas-оверлее
 * совпадали с 3D-кольцом, в этом режиме используем tilt = 1.
 *
 * Все `case`-ветки renderEffects берут актуальный tilt из локальной
 * переменной `GROUND_TILT`, которая вычисляется в начале кадра — это
 * сохраняет старый стиль кода и позволяет избежать вызова `isBattle3DActive`
 * сотни раз внутри одного кадра.
 */
const GROUND_TILT_2D = 0.38; // legacy 2D-only battle modes

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutQuad  = (t: number) => t * (2 - t);
const easeInQuad   = (t: number) => t * t;
const easeInOut    = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const clamp01      = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;

function hexToRgb(hex: string): [number, number, number] {
  if (!hex) return [255, 255, 255];
  if (hex.startsWith("rgb")) {
    const m = hex.match(/\d+/g);
    if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
    return [255, 255, 255];
  }
  const h = hex.replace("#", "");
  if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
  if (h.length >= 6) return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  return [255, 255, 255];
}
function rgba(c: string, a: number): string {
  const [r,g,b] = hexToRgb(c);
  return `rgba(${r},${g},${b},${a})`;
}
function lighten(c: string, frac: number): string {
  const [r,g,b] = hexToRgb(c);
  return `rgb(${(r + (255-r)*frac)|0},${(g + (255-g)*frac)|0},${(b + (255-b)*frac)|0})`;
}
function darken(c: string, frac: number): string {
  const [r,g,b] = hexToRgb(c);
  return `rgb(${(r*(1-frac))|0},${(g*(1-frac))|0},${(b*(1-frac))|0})`;
}

/** Стабильный псевдо-случайный 0..1 от (seed, i) — частицы не дрожат покадрово. */
function srand(seed: number, i: number): number {
  const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Ground VFX anchored to brawler feet in 2D; in 3D `sy` already matches the floor. */
function followBrawlerGroundSy(sy: number, e: Effect): number {
  if (!e.followBrawler) return sy;
  if (isBattle3DActive()) return sy;
  return sy + brawlerFootWorldDy(e.followBrawler.stats.id, e.followBrawler.radius);
}

/**
 * Рисует ground-«пятно»-подложку с конусным затуханием — используется как
 * базовый «скорч» под взрывами / зонами / куполами, чтобы эффект не висел
 * в пустоте, а имел контакт с полом.
 */
function drawGroundDisk(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  rx: number,
  innerColor: string,
  alpha: number,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, rgba(innerColor, 0.55));
  g.addColorStop(0.7, rgba(innerColor, 0.22));
  g.addColorStop(1, rgba(innerColor, 0));
  ctx.fillStyle = g;
  groundEllipsePath(ctx, cx, cy, rx);
  ctx.fill();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE — игровая логика эффектов (тики урона / таймеры / follow-by-brawler)
// ─────────────────────────────────────────────────────────────────────────────

function isLightCageEnemy(b: Brawler, e: Effect): boolean {
  if (!b.alive || !e.ownerTeam) return false;
  if (e.ownerId && b.id === e.ownerId) return false;
  return b.team !== e.ownerTeam;
}

function initLightCagePrisoners(e: Effect, allBrawlers: Brawler[]): void {
  if (e.kind !== "lightCage" || e.cagePrisoners || !e.ownerTeam) return;
  const R = e.tickRange ?? e.radius;
  const R2 = R * R;
  e.cagePrisoners = [];
  for (const b of allBrawlers) {
    if (!isLightCageEnemy(b, e)) continue;
    const dx = b.x - e.x;
    const dy = b.y - e.y;
    if (dx * dx + dy * dy <= R2) e.cagePrisoners.push(b.id);
  }
}

/** Не даёт заключённым выйти из клетки Кендзи; урон при ударе о границу. */
function applyLightCageWalls(e: Effect, allBrawlers: Brawler[], dt: number): void {
  if (e.kind !== "lightCage" || e.timer <= 0 || !e.cagePrisoners?.length) return;
  const R = (e.tickRange ?? e.radius) * 0.9;
  const R2 = R * R;
  for (const b of allBrawlers) {
    if (!b.alive || !e.cagePrisoners.includes(b.id)) continue;
    const dx = b.x - e.x;
    const dy = b.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= R2) continue;
    const d = Math.sqrt(d2) || 1;
    b.x = e.x + (dx / d) * R;
    b.y = e.y + (dy / d) * R;
    if (!e.damagePerTick) continue;
    e.cageWallHitCd = e.cageWallHitCd ?? {};
    const cd = e.cageWallHitCd[b.id] ?? 0;
    if (cd <= 0) {
      b.takeDamage(e.damagePerTick, null, { suppressScreenFlash: true });
      e.cageWallHitCd[b.id] = 0.4;
    } else {
      e.cageWallHitCd[b.id] = cd - dt;
    }
  }
}

export function updateEffects(
  dt: number,
  allBrawlers: Brawler[],
  projectiles: Projectile[] = [],
  tileGrid?: TileGrid,
  opts?: EffectUpdateOpts,
): void {
  if ((globalThis as { __HEADLESS_BATTLE_SERVER?: boolean }).__HEADLESS_BATTLE_SERVER && !opts?.visualOnly) {
    opts = { ...opts, visualOnly: true };
  }
  if (opts?.visualOnly) {
    tickEffectsVisual(dt, allBrawlers);
    return;
  }
  updateHitShakes(dt);
  updateBattleScreenFX(dt);

  // Авто-привязка визуала к статусам и состоянию бойца (super-ready, shield-HP).
  // Делается ДО тиков, чтобы только что созданные ауры тоже корректно
  // прожили один кадр (timer уже выше dt).
  autoAttachBrawlerAuras(allBrawlers);

  tickMotionTrails(dt, allBrawlers);

  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.timer -= dt;

    // follow + auto-removal по статусу
    if (e.followBrawler) {
      if (!e.followBrawler.alive) { effects.splice(i, 1); continue; }
      e.x = e.followBrawler.x;
      e.y = e.followBrawler.y;
      if (e.kind === "hellBrandMark") {
        e.y = e.followBrawler.y - e.followBrawler.radius - 22;
      }
      if (e.linkedStatus && !e.followBrawler.statusEffects.some(s => s.type === e.linkedStatus)) {
        effects.splice(i, 1); continue;
      }
    }

    // ── meteor warning → impact ──
    if (e.kind === "meteor") {
      if (e.delay !== undefined && !e.exploded) {
        e.delay -= dt;
        if (e.delay <= 0) {
          e.exploded = true;
          if (e.damagePerTick && e.tickRange && e.ownerTeam) {
            for (const b of allBrawlers) {
              if (!b.alive || b.team === e.ownerTeam) continue;
              const dx = b.x - e.x, dy = b.y - e.y;
              if (dx*dx + dy*dy <= e.tickRange * e.tickRange) {
                b.takeDamage(e.damagePerTick, null);
              }
            }
          }
          // Полноценный AOE-взрыв на месте удара.
          spawnEffect({
            kind: "explosion",
            x: e.x, y: e.y,
            radius: e.tickRange ?? 60,
            color: e.color,
            timer: 0.95, maxTimer: 0.95,
          });
        }
      }
    }

    if (e.kind === "lightCage") {
      initLightCagePrisoners(e, allBrawlers);
      applyLightCageWalls(e, allBrawlers, dt);
    }

    // ── damage-ticking zones (poisonZone, lightCage, …) ──
    if (e.damagePerTick && e.tickInterval && e.tickRange && e.ownerTeam && e.kind !== "meteor" && e.kind !== "turret") {
      e.tickTimer = (e.tickTimer ?? 0) - dt;
      if (e.tickTimer <= 0) {
        e.tickTimer = e.tickInterval;
        for (const b of allBrawlers) {
          if (!b.alive || b.team === e.ownerTeam) continue;
          if (e.kind === "lightCage") {
            if (!e.cagePrisoners?.includes(b.id)) continue;
          }
          const dx = b.x - e.x, dy = b.y - e.y;
          if (dx*dx + dy*dy <= e.tickRange * e.tickRange) {
            b.takeDamage(e.damagePerTick, null, { suppressScreenFlash: true });
          }
        }
      }
    }

    // ── turret behaviour ──
    if (e.kind === "turret" && e.tickInterval && e.ownerTeam) {
      e.tickTimer = (e.tickTimer ?? 0) - dt;
      if (e.tickTimer <= 0) {
        e.tickTimer = e.tickInterval;
        let best: Brawler | null = null;
        let bestD2 = (e.tickRange ?? 250) ** 2;
        for (const b of allBrawlers) {
          if (!b.alive || b.team === e.ownerTeam) continue;
          const dx = b.x - e.x, dy = b.y - e.y;
          const d2 = dx*dx + dy*dy;
          if (d2 < bestD2) { bestD2 = d2; best = b; }
        }
        if (best && e.damagePerTick) {
          best.takeDamage(e.damagePerTick, null, { suppressScreenFlash: true });
          // Быстрый луч + импакт.
          spawnEffect({
            kind: "trail", x: e.x, y: e.y - 14, toX: best.x, toY: best.y,
            radius: 3, color: "#FFEB3B", secondary: "#FF6F00",
            timer: 0.16, maxTimer: 0.16,
          });
          spawnEffect({
            kind: "bulletImpact", x: best.x, y: best.y,
            radius: 14, color: "#FFEB3B",
            timer: 0.28, maxTimer: 0.28,
          });
        }
      }
    }

    if (e.timer <= 0) effects.splice(i, 1);
  }

  let mapW = tileGrid ? tileGrid.width * tileGrid.cellSize : 3600;
  let mapH = tileGrid ? tileGrid.height * tileGrid.cellSize : 3600;
  if (!tileGrid) {
    for (const b of allBrawlers) {
      mapW = Math.max(mapW, b.x + 400);
      mapH = Math.max(mapH, b.y + 400);
    }
  }
  updateVerdelettaShadows(dt, allBrawlers, projectiles, mapW, mapH, tileGrid);
  updateLuminaMechanics(dt, allBrawlers, effects, mapW, mapH, tileGrid);
  updateOliverBugs(dt, allBrawlers, projectiles, mapW, mapH, tileGrid, opts?.crates ? {
    crates: opts.crates,
    onCrateDamaged: (crate, damage) => {
      triggerCrateHitShake(crate);
      spawnDamageNumber(crate.x + crate.w / 2, crate.y + crate.h / 2 - 32, Math.floor(damage), "damage");
    },
    onCrateDestroyed: opts.onCrateDestroyed,
  } : undefined);
  updateOliverMechanics(dt, allBrawlers);
  updateCallistaMechanics(dt, allBrawlers, opts?.crates ? {
    crates: opts.crates,
    onCrateDamaged: (crate, damage) => {
      triggerCrateHitShake(crate);
      spawnDamageNumber(crate.x + crate.w / 2, crate.y + crate.h / 2 - 32, Math.floor(damage), "damage");
    },
    onCrateDestroyed: opts.onCrateDestroyed,
  } : undefined);
  updateAirinMechanics(dt, allBrawlers, opts?.crates ? {
    crates: opts.crates,
    onCrateDamaged: (crate, damage) => {
      triggerCrateHitShake(crate);
      spawnDamageNumber(crate.x + crate.w / 2, crate.y + crate.h / 2 - 32, Math.floor(damage), "damage");
    },
    onCrateDestroyed: opts.onCrateDestroyed,
  } : undefined);
  updateElianMechanics(dt, allBrawlers, mapW, mapH, opts?.crates ? {
    crates: opts.crates,
    onCrateDamaged: (crate, damage) => {
      triggerCrateHitShake(crate);
      spawnDamageNumber(crate.x + crate.w / 2, crate.y + crate.h / 2 - 32, Math.floor(damage), "damage");
    },
    onCrateDestroyed: opts.onCrateDestroyed,
  } : undefined);
  updateSilvenMechanics(dt, allBrawlers, projectiles, mapW, mapH, opts?.crates ? {
    crates: opts.crates,
    onCrateDamaged: (crate, damage) => {
      triggerCrateHitShake(crate);
      spawnDamageNumber(crate.x + crate.w / 2, crate.y + crate.h / 2 - 32, Math.floor(damage), "damage");
    },
    onCrateDestroyed: opts.onCrateDestroyed,
  } : undefined);
  tickVittoriaMechanics(allBrawlers, dt);
  updateOctaviaMechanics(allBrawlers, dt, opts?.crates ? {
    crates: opts.crates,
    onCrateDamaged: (crate, damage) => {
      triggerCrateHitShake(crate);
      spawnDamageNumber(crate.x + crate.w / 2, crate.y + crate.h / 2 - 32, Math.floor(damage), "damage");
    },
    onCrateDestroyed: opts.onCrateDestroyed,
  } : undefined);
  updateZephyrinMechanics(allBrawlers, dt, mapW, mapH, {
    crates: opts?.crates,
    onCrateDamaged: opts?.crates ? (crate, damage) => {
      triggerCrateHitShake(crate);
      spawnDamageNumber(crate.x + crate.w / 2, crate.y + crate.h / 2 - 32, Math.floor(damage), "damage");
    } : undefined,
    onCrateDestroyed: opts?.onCrateDestroyed,
    tileGrid,
  });
  clampLuminaLinkPositions(allBrawlers);
}

/** Server-authoritative battles: tick effect timers/positions without simulating combat. */
export function tickEffectsVisual(dt: number, allBrawlers: Brawler[]): void {
  updateHitShakes(dt);
  updateBattleScreenFX(dt);
  autoAttachBrawlerAuras(allBrawlers);
  tickMotionTrails(dt, allBrawlers);

  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.timer -= dt;

    if (e.followBrawler) {
      if (!e.followBrawler.alive) {
        effects.splice(i, 1);
        continue;
      }
      e.x = e.followBrawler.x;
      e.y = e.followBrawler.y;
      if (e.kind === "hellBrandMark") {
        e.y = e.followBrawler.y - e.followBrawler.radius - 22;
      }
      if (e.linkedStatus && !e.followBrawler.statusEffects.some((s) => s.type === e.linkedStatus)) {
        effects.splice(i, 1);
        continue;
      }
    }

    if (e.timer <= 0) effects.splice(i, 1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────────────────────

export function renderEffects(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
  viewerTeam?: string,
): void {
  // Один раз на кадр выбираем 3D-/2D-tilt — все ground-эффекты ниже используют
  // эту локальную переменную через имя `GROUND_TILT` (см. computeGroundTilt).
  const GROUND_TILT = getBattleGroundTilt();
  // Trails: 2D overlay coords (same space as other VFX). 3D Vector3.project was unstable in battle.
  renderMotionTrailsGround(ctx, camX, camY);
  const vfxList = replayRenderEffects ?? effects;
  for (const e of vfxList) {
    const sx = e.x - camX;
    const sy = e.y - camY;
    const lifeT = 1 - e.timer / e.maxTimer;       // 0..1 от рождения к смерти
    const fade  = clamp01(e.timer / e.maxTimer);
    const R     = e.radius * WORLD_VFX_CANVAS_SCALE;

    ctx.save();

    switch (e.kind) {

      // ────────────────────────────────────────────────────────────────────
      //  BURST — короткая punch-вспышка (импакт пули / попадание супера)
      // ────────────────────────────────────────────────────────────────────
      case "burst": {
        const t = easeOutCubic(lifeT);
        const r = R * (0.25 + t * 1.65);
        ctx.globalCompositeOperation = "lighter";

        // 1. Слепящая центральная вспышка
        applyVfxShadow(ctx, e.color, 26 * fade);
        const flash = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        flash.addColorStop(0, `rgba(255,255,255,${0.98 * fade})`);
        flash.addColorStop(0.18, rgba(lighten(e.color, 0.55), 0.92 * fade));
        flash.addColorStop(0.55, rgba(e.color, 0.42 * fade));
        flash.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = flash;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();

        // 2. Двойное расходящееся кольцо (внешнее цветное, внутреннее белое)
        ctx.lineWidth = Math.max(1.3, 5.5 * fade);
        ctx.strokeStyle = e.color;
        ctx.globalAlpha = fade * 0.95;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.stroke();
        ctx.lineWidth = Math.max(0.9, 2.6 * fade);
        ctx.strokeStyle = `rgba(255,255,255,${fade})`;
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.72, 0, TAU); ctx.stroke();

        // 3. Ground scorch — тонкий тёмный эллипс под вспышкой (даёт «контакт»)
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = fade * 0.35;
        const scorch = ctx.createRadialGradient(sx, sy + 3, r * 0.1, sx, sy + 3, r);
        scorch.addColorStop(0, rgba(darken(e.color, 0.4), 0.55));
        scorch.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = scorch;
        groundEllipsePath(ctx, sx, sy + 3, r);
        ctx.fill();

        // 4. 12 радиальных искр-лучей с разной длиной (live-feel)
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fade * 0.88;
        ctx.lineCap = "round";
        const nSpk = 12;
        for (let i = 0; i < nSpk; i++) {
          const a = (i / nSpk) * TAU + e.seed * 0.01 + frame * 0.02;
          const len = r * (0.7 + srand(e.seed, i) * 0.65);
          const x0 = sx + Math.cos(a) * r * 0.4;
          const y0 = sy + Math.sin(a) * r * 0.4;
          const x1 = sx + Math.cos(a) * len;
          const y1 = sy + Math.sin(a) * len;
          ctx.strokeStyle = i % 2 === 0 ? "#FFFFFF" : lighten(e.color, 0.4);
          ctx.lineWidth = 2.4 * fade;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }

        // 5. Дополнительные «шарики-осколки» в полу-объёмной траектории
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + srand(e.seed, i + 33) * 0.6;
          const d = r * (0.55 + srand(e.seed, i + 17) * 0.5) * easeOutQuad(lifeT);
          const px = sx + Math.cos(a) * d;
          const py = sy + Math.sin(a) * d + easeInQuad(lifeT) * 7;
          ctx.globalAlpha = fade * (1 - lifeT * 0.6);
          ctx.fillStyle = i % 2 === 0 ? "#FFFFFF" : lighten(e.color, 0.3);
          ctx.beginPath(); ctx.arc(px, py, 1.8 + srand(e.seed, i) * 1.2, 0, TAU); ctx.fill();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  BONE DEBRIS — костяной блок рассыпается на кучу косточек
      // ────────────────────────────────────────────────────────────────────
      case "boneDebris": {
        const count = e.particleCount ?? 16;
        ctx.globalCompositeOperation = "source-over";
        for (let i = 0; i < count; i++) {
          const rnd = srand(e.seed, i);
          const rnd2 = srand(e.seed, i + 41);
          const ang = rnd * TAU;
          const spd = 55 + rnd2 * 130;
          const vx = Math.cos(ang) * spd;
          const vy = Math.sin(ang) * spd * 0.55 - 40 - rnd * 25;
          const grav = 210 * lifeT * lifeT;
          const px = sx + vx * easeOutCubic(lifeT);
          const py = sy + vy * easeOutCubic(lifeT) + grav;
          const rot = ang + lifeT * (4 + rnd * 5);
          const boneLen = (5 + rnd2 * 7) * WORLD_VFX_CANVAS_SCALE;
          const boneW = (1.8 + rnd * 1.6) * WORLD_VFX_CANVAS_SCALE;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(rot);
          ctx.globalAlpha = fade * (1 - lifeT * 0.35);
          ctx.fillStyle = i % 3 === 0 ? "#FFF8E1" : (e.color ?? "#E8E0D4");
          ctx.strokeStyle = e.secondary ?? "#8D6E63";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.fillRect(-boneLen * 0.5, -boneW * 0.5, boneLen, boneW);
          ctx.fill();
          ctx.strokeRect(-boneLen * 0.5, -boneW * 0.5, boneLen, boneW);
          ctx.beginPath();
          ctx.arc(-boneLen * 0.38, 0, boneW * 0.85, 0, TAU);
          ctx.arc(boneLen * 0.38, 0, boneW * 0.85, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
        ctx.globalAlpha = fade * 0.45 * (1 - lifeT);
        const dust = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * (0.4 + lifeT));
        dust.addColorStop(0, "rgba(215,204,200,0.55)");
        dust.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = dust;
        groundEllipsePath(ctx, sx, sy, R * 0.7);
        ctx.fill();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  SHOCKWAVE — широкая ground-волна (старт супера, big-impact)
      // ────────────────────────────────────────────────────────────────────
      case "shockwave": {
        const t = easeOutCubic(lifeT);
        const r = R * (0.32 + t * 2.1);
        drawUltGroundPad(ctx, sx, sy, r * 0.55, e.color, fade, 0.22);
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, e.color, 14);

        // Основная цветная волна
        ctx.globalAlpha = fade * 0.88;
        ctx.strokeStyle = e.color; ctx.lineWidth = 6 * fade + 1;
        groundEllipsePath(ctx, sx, sy, r);
        ctx.stroke();

        // Ярко-белая внутренняя волна
        ctx.globalAlpha = fade * 0.9;
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2.4 * fade;
        groundEllipsePath(ctx, sx, sy, r * 0.85);
        ctx.stroke();

        // Эхо-волна снаружи
        ctx.globalAlpha = fade * 0.38;
        ctx.strokeStyle = e.color; ctx.lineWidth = 2.2;
        groundEllipsePath(ctx, sx, sy, r * 1.15);
        ctx.stroke();

        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = fade * 0.18;
        const haze = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 1.05);
        haze.addColorStop(0, rgba(e.color, 0));
        haze.addColorStop(0.55, rgba(e.color, 0.35));
        haze.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = haze;
        groundEllipsePath(ctx, sx, sy, r * 1.05);
        ctx.fill();

        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fade * 0.75;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + e.seed * 0.001;
          const r0 = r * 0.95;
          const r1 = r * (1.04 + Math.sin(frame * 0.5 + i) * 0.04);
          const x0 = sx + Math.cos(a) * r0;
          const y0 = sy + Math.sin(a) * r0 * GROUND_TILT;
          const x1 = sx + Math.cos(a) * r1;
          const y1 = sy + Math.sin(a) * r1 * GROUND_TILT;
          ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.8 * fade; ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  SPARK — летящая комета-частица между двумя точками
      // ────────────────────────────────────────────────────────────────────
      case "spark": {
        const tx = (e.toX ?? e.x) - camX;
        const ty = (e.toY ?? e.y) - camY;
        const t = easeOutCubic(lifeT);
        const px = sx + (tx - sx) * t;
        const py = sy + (ty - sy) * t;
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, e.color, 16);

        // Лента-хвост (мягкая)
        ctx.strokeStyle = rgba(e.color, 0.55 * fade);
        ctx.lineWidth = R * 1.15 * fade;
        ctx.lineCap = "round";
        const tailT = clamp01(t - 0.22);
        const tailX = sx + (tx - sx) * tailT;
        const tailY = sy + (ty - sy) * tailT;
        ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(px, py); ctx.stroke();

        // Корона + ядро
        const cR = R * 2.5 * fade;
        const cg = ctx.createRadialGradient(px, py, 0, px, py, cR);
        cg.addColorStop(0, rgba(lighten(e.color, 0.7), 0.85));
        cg.addColorStop(0.45, rgba(e.color, 0.42));
        cg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.arc(px, py, cR, 0, TAU); ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(px, py, R * 0.72 * fade, 0, TAU); ctx.fill();

        // Мини-«звезда» из 4 лучей у головы
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.1;
        for (let i = 0; i < 4; i++) {
          const a = i * (Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(a) * R * 0.8 * fade, py + Math.sin(a) * R * 0.8 * fade);
          ctx.lineTo(px + Math.cos(a) * R * 1.7 * fade, py + Math.sin(a) * R * 1.7 * fade);
          ctx.stroke();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  TRAIL — широкая энерго-лента (chain/laser-сегменты, турель-выстрел)
      // ────────────────────────────────────────────────────────────────────
      case "trail": {
        const tx = (e.toX ?? e.x) - camX;
        const ty = (e.toY ?? e.y) - camY;
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        applyVfxShadow(ctx, e.color, 20);

        // 1) Внешний софт-глоу
        ctx.strokeStyle = rgba(e.color, 0.32 * fade);
        ctx.lineWidth = R * 3.4;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();

        // 2) Основной поток с бегущими полосами
        ctx.strokeStyle = e.color;
        ctx.lineWidth = R * 1.5 * fade;
        ctx.setLineDash([14, 9]);
        ctx.lineDashOffset = -frame * 3.2;
        ctx.globalAlpha = fade;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;

        // 3) Вторичный цветной слой (если задан)
        if (e.secondary) {
          ctx.strokeStyle = e.secondary;
          ctx.lineWidth = R * 0.55 * fade;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
        }

        // 4) Белый ярчайший керн
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = Math.max(1.2, R * 0.32 * fade);
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();

        // 5) Конечный мини-импакт-крест в (tx, ty)
        ctx.shadowBlur = 10;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1.6 * fade;
        const len = R * 1.6 * fade;
        ctx.beginPath();
        ctx.moveTo(tx - len, ty); ctx.lineTo(tx + len, ty);
        ctx.moveTo(tx, ty - len); ctx.lineTo(tx, ty + len);
        ctx.stroke();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  MUZZLE FLASH — отключено по запросу: никаких эффектов выстрела
      //  от персонажа. Если кто-то ещё спавнит этот kind — просто не рисуем.
      // ────────────────────────────────────────────────────────────────────
      case "muzzleFlash": {
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  BULLET IMPACT — мини звёздочный пунч при попадании пули
      // ────────────────────────────────────────────────────────────────────
      case "bulletImpact": {
        const t = easeOutCubic(lifeT);
        const r = R * (0.4 + t * 1.2);
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, e.color, 20);

        // Микро-вспышка
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, `rgba(255,255,255,${fade})`);
        g.addColorStop(0.4, rgba(e.color, 0.75 * fade));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();

        // 8 коротких лучей-обломков
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 1.6 * fade;
        ctx.lineCap = "round";
        ctx.globalAlpha = fade;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + (e.seed % 7);
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * r * 0.32, sy + Math.sin(a) * r * 0.32);
          ctx.lineTo(sx + Math.cos(a) * r * 1.05, sy + Math.sin(a) * r * 1.05);
          ctx.stroke();
        }

        // Цветное эхо-кольцо
        ctx.strokeStyle = rgba(e.color, fade * 0.8);
        ctx.lineWidth = 1.6 * fade;
        ctx.beginPath(); ctx.arc(sx, sy, r * 1.05, 0, TAU); ctx.stroke();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  EXPLOSION — настоящий большой AoE-взрыв (4 фазы)
      //  фаза 0–0.3: ослепительная белая вспышка + ударное кольцо
      //  фаза 0.0–1.0: турбулентный огненный шар (5 смещённых сфер)
      //  фаза 0.4–1.0: серо-чёрный дым поднимается вверх
      //  всё время: ground scorch + разлетающиеся осколки + кольцо-shockwave
      // ────────────────────────────────────────────────────────────────────
      case "explosion": {
        const t = lifeT;
        const tCubic = easeOutCubic(t);
        const r = R * (0.55 + tCubic * 2.0);

        // 1) ОСЛЕПИТЕЛЬНАЯ начальная вспышка (только первые 25%)
        ctx.globalCompositeOperation = "lighter";
        if (t < 0.3) {
          const flashA = (1 - t / 0.3) * 0.98;
          const fg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.25);
          fg.addColorStop(0, `rgba(255,255,255,${flashA})`);
          fg.addColorStop(0.35, `rgba(255,220,150,${flashA * 0.7})`);
          fg.addColorStop(0.7, `rgba(255,140,40,${flashA * 0.45})`);
          fg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(sx, sy, r * 1.25, 0, TAU); ctx.fill();
        }

        // 2) Огненная сфера — 6 хаотично смещённых градиентов = турбулентность
        ctx.globalAlpha = fade;
        for (let k = 0; k < 6; k++) {
          const ox = Math.sin(frame * 0.18 + k * 0.9 + e.seed) * r * 0.22;
          const oy = Math.cos(frame * 0.21 + k * 1.2 + e.seed) * r * 0.22;
          const rr = r * (0.5 + k * 0.13);
          const fg = ctx.createRadialGradient(sx + ox, sy + oy, 0, sx + ox, sy + oy, rr);
          fg.addColorStop(0, `rgba(255,250,200,${0.55 * fade})`);
          fg.addColorStop(0.25, rgba(lighten(e.color, 0.4), 0.6 * fade));
          fg.addColorStop(0.6, rgba(e.color, 0.35 * fade));
          fg.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(sx + ox, sy + oy, rr, 0, TAU); ctx.fill();
        }

        // 3) Чёрно-серый дым поднимается вверх (только после 40% lifetime)
        if (t > 0.35) {
          ctx.globalCompositeOperation = "source-over";
          const smokeA = Math.min(0.55, (t - 0.35) / 0.65) * 0.75;
          for (let i = 0; i < 8; i++) {
            const rand = srand(e.seed, i);
            const sxo = sx + (rand - 0.5) * r * 1.0;
            const syo = sy + (rand * 0.4 + 0.1) * r * 0.4 - (t - 0.35) * r * 1.1;
            const sr = r * (0.25 + rand * 0.22);
            const sg = ctx.createRadialGradient(sxo, syo, 0, sxo, syo, sr);
            sg.addColorStop(0, `rgba(45,32,28,${smokeA})`);
            sg.addColorStop(0.6, `rgba(60,45,40,${smokeA * 0.55})`);
            sg.addColorStop(1, "rgba(20,15,12,0)");
            ctx.fillStyle = sg;
            ctx.beginPath(); ctx.arc(sxo, syo, sr, 0, TAU); ctx.fill();
          }
        }

        // 4) Ground scorch — тёмное обугленное пятно на полу (sticks longer)
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = Math.min(0.6, fade + 0.3);
        const scorch = ctx.createRadialGradient(sx, sy + 5, 0, sx, sy + 5, r * 1.1);
        scorch.addColorStop(0, "rgba(0,0,0,0.7)");
        scorch.addColorStop(0.6, "rgba(20,10,5,0.35)");
        scorch.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = scorch;
        groundEllipsePath(ctx, sx, sy + 5, r * 1.1);
        ctx.fill();

        // 5) Ударное кольцо (shockwave)
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fade * 0.95;
        ctx.strokeStyle = lighten(e.color, 0.5);
        ctx.lineWidth = 5 * fade + 1.2;
        applyVfxShadow(ctx, e.color, 26);
        groundEllipsePath(ctx, sx, sy + 4, r * 1.2);
        ctx.stroke();
        // Тонкое белое внутреннее
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2 * fade + 0.5;
        groundEllipsePath(ctx, sx, sy + 4, r * 1.05);
        ctx.stroke();

        // 6) 18 разлетающихся осколков с лёгкой «гравитацией»
        const debris = 18;
        for (let i = 0; i < debris; i++) {
          const a = (i / debris) * TAU + srand(e.seed, i) * 0.6;
          const d = r * (0.85 + srand(e.seed, i + 13) * 0.55) * easeOutQuad(t);
          const px = sx + Math.cos(a) * d;
          const py = sy + Math.sin(a) * d + easeInQuad(t) * 11;
          ctx.fillStyle = i % 3 === 0 ? "#FFFFFF" : i % 3 === 1 ? "#FFE0A8" : lighten(e.color, 0.35);
          ctx.globalAlpha = fade * (1 - t * 0.6);
          applyVfxShadow(ctx, e.color, 10);
          const sz = 2.4 + srand(e.seed, i + 33) * 1.8;
          ctx.beginPath(); ctx.arc(px, py, sz, 0, TAU); ctx.fill();
          // мини-хвост за каждым осколком (даёт движение)
          ctx.strokeStyle = rgba(e.color, fade * 0.5);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(px - Math.cos(a) * sz * 2, py - Math.sin(a) * sz * 2);
          ctx.lineTo(px, py);
          ctx.stroke();
        }

        // 7) 4 крупных «языка пламени» во все стороны (только в первой половине)
        if (t < 0.55) {
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + frame * 0.06;
            const fl = r * 0.85;
            const flA = (0.55 - t) * 1.6;
            const fg = ctx.createRadialGradient(
              sx + Math.cos(a) * fl, sy + Math.sin(a) * fl, 0,
              sx + Math.cos(a) * fl, sy + Math.sin(a) * fl, r * 0.4,
            );
            fg.addColorStop(0, `rgba(255,235,150,${flA})`);
            fg.addColorStop(0.5, `rgba(255,140,40,${flA * 0.55})`);
            fg.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = fg;
            ctx.beginPath(); ctx.arc(sx + Math.cos(a) * fl, sy + Math.sin(a) * fl, r * 0.4, 0, TAU); ctx.fill();
          }
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  KILL EXPLOSION — большой death-эффект бойца (камера-флаг)
      // ────────────────────────────────────────────────────────────────────
      case "killExplosion": {
        const t = easeOutCubic(lifeT);
        const r = R * (0.6 + t * 2.4);
        ctx.globalCompositeOperation = "lighter";

        // Огромная световая вспышка
        const flashA = (1 - lifeT) * 0.78;
        const fg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.5);
        fg.addColorStop(0, `rgba(255,255,255,${flashA + fade * 0.3})`);
        fg.addColorStop(0.25, rgba(lighten(e.color, 0.45), 0.78 * fade));
        fg.addColorStop(0.6, rgba(e.color, 0.42 * fade));
        fg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fg;
        ctx.beginPath(); ctx.arc(sx, sy, r * 1.5, 0, TAU); ctx.fill();

        // Тройное ударное кольцо
        applyVfxShadow(ctx, e.color, 30);
        for (let k = 0; k < 3; k++) {
          const rr = r * (0.75 + k * 0.42);
          ctx.globalAlpha = fade * (0.9 - k * 0.22);
          ctx.lineWidth = 5.5 - k * 1.4;
          ctx.strokeStyle = k === 0 ? "#FFFFFF" : k === 1 ? lighten(e.color, 0.4) : e.color;
          groundEllipsePath(ctx, sx, sy + 2, rr);
          ctx.stroke();
        }

        // 22 разлетающихся искры с длинным хвостом
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * TAU + srand(e.seed, i) * 0.4;
          const d = r * (0.5 + srand(e.seed, i + 11) * 1.1) * easeOutQuad(lifeT);
          const px = sx + Math.cos(a) * d;
          const py = sy + Math.sin(a) * d + lifeT * lifeT * 14;
          ctx.globalAlpha = fade;
          ctx.fillStyle = i % 3 === 0 ? "#FFFFFF" : i % 3 === 1 ? lighten(e.color, 0.4) : e.color;
          applyVfxShadow(ctx, e.color, 14);
          ctx.beginPath(); ctx.arc(px, py, 2.8 + srand(e.seed, i + 5) * 2.0, 0, TAU); ctx.fill();

          // Хвост-полоска за каждой искрой
          ctx.strokeStyle = rgba(lighten(e.color, 0.3), fade * 0.6);
          ctx.lineWidth = 1.4;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(px - Math.cos(a) * 7, py - Math.sin(a) * 7);
          ctx.lineTo(px, py);
          ctx.stroke();
        }

        // 8 «душ»-частиц поднимаются вверх (мистический touch)
        for (let i = 0; i < 8; i++) {
          const sa = (i / 8) * TAU;
          const rT = (frame * 0.012 + i * 0.18 + srand(e.seed, i + 91) * 0.5) % 1;
          const sxS = sx + Math.cos(sa) * r * 0.4 + Math.sin(rT * 6) * 3;
          const syS = sy - rT * r * 0.9;
          ctx.globalAlpha = fade * (1 - rT);
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          applyVfxShadow(ctx, lighten(e.color, 0.5), 12);
          ctx.beginPath(); ctx.arc(sxS, syS, 2.4 + srand(e.seed, i + 5) * 1.2, 0, TAU); ctx.fill();
        }

        // Ground scorch
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = fade * 0.45;
        const sc = ctx.createRadialGradient(sx, sy + 5, 0, sx, sy + 5, r * 1.3);
        sc.addColorStop(0, "rgba(0,0,0,0.65)");
        sc.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sc;
        groundEllipsePath(ctx, sx, sy + 5, r * 1.3);
        ctx.fill();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  HEAL PULSE — активное лечение (упрощённый: один пульс + 4 плюса)
      // ────────────────────────────────────────────────────────────────────
      case "healPulse": {
        const t = easeOutCubic(lifeT);
        const r = R * (0.3 + t * 1.5);
        ctx.globalCompositeOperation = "lighter";

        // Тёплый свет
        const g = ctx.createRadialGradient(sx, sy - 6, 0, sx, sy - 6, r);
        g.addColorStop(0, `rgba(255,255,220,${0.7 * fade})`);
        g.addColorStop(0.45, `rgba(180,255,160,${0.45 * fade})`);
        g.addColorStop(1, "rgba(76,175,80,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy - 6, r, 0, TAU); ctx.fill();

        // Ground ring
        applyVfxShadow(ctx, "#A5D6A7", 14);
        ctx.strokeStyle = "rgba(165,214,167,0.85)";
        ctx.lineWidth = 2 * fade + 0.6;
        ctx.globalAlpha = fade * 0.8;
        groundEllipsePath(ctx, sx, sy + 2, r * 0.85);
        ctx.stroke();

        // 4 плавающих «плюса» (вместо 8)
        const n = 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + frame * 0.05;
          const rr = r * 0.55;
          const px = sx + Math.cos(a) * rr;
          const py = sy + Math.sin(a) * rr * GROUND_TILT - lifeT * 16 - 4;
          ctx.globalAlpha = fade * 0.9;
          ctx.strokeStyle = "rgba(46,125,50,0.95)";
          ctx.lineWidth = 2.4;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(px - 5, py); ctx.lineTo(px + 5, py);
          ctx.moveTo(px, py - 5); ctx.lineTo(px, py + 5);
          ctx.stroke();
          ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(px - 4, py); ctx.lineTo(px + 4, py);
          ctx.moveTo(px, py - 4); ctx.lineTo(px, py + 4);
          ctx.stroke();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  PASSIVE HEAL AURA — спокойная зелёная аура (упрощённая, минимум)
      // ────────────────────────────────────────────────────────────────────
      case "passiveHealAura": {
        const breathe = 0.6 + Math.sin(frame * 0.12) * 0.2;
        ctx.globalCompositeOperation = "lighter";

        // Тонкое ground-кольцо
        ctx.globalAlpha = breathe * 0.55;
        ctx.strokeStyle = "rgba(165,214,167,0.85)";
        ctx.lineWidth = 1.6;
        groundEllipsePath(ctx, sx, sy + 4, R * 0.9);
        ctx.stroke();

        // 3 поднимающиеся капли-«частицы жизни»
        for (let i = 0; i < 3; i++) {
          const rt = (frame * 0.012 + i * 0.33 + srand(e.seed, i) * 0.5) % 1;
          const a = (i / 3) * TAU + e.seed * 0.001;
          const px = sx + Math.cos(a) * R * 0.4;
          const py = sy + 4 - rt * R * 0.9;
          ctx.globalAlpha = (1 - rt) * 0.75;
          ctx.fillStyle = "rgba(220,255,180,0.9)";
          applyVfxShadow(ctx, "#69F0AE", 6);
          ctx.beginPath(); ctx.arc(px, py, 1.8, 0, TAU); ctx.fill();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  SNOW ZONE — Юки супер: ледяная арена (упрощённый вариант)
      // ────────────────────────────────────────────────────────────────────
      case "snowZone": {
        ctx.globalCompositeOperation = "source-over";
        drawUltGroundPad(ctx, sx, sy, R, e.color, fade, 0.38);

        // Ground заливка (льдяной диск)
        ctx.globalAlpha = fade * 0.45;
        const floor = ctx.createRadialGradient(sx, sy, R * 0.15, sx, sy, R);
        floor.addColorStop(0, "rgba(225,245,254,0.75)");
        floor.addColorStop(0.55, "rgba(129,212,250,0.32)");
        floor.addColorStop(1, "rgba(2,136,209,0)");
        ctx.fillStyle = floor;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.fill();

        // 2 ледяных кольца
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.globalAlpha = fade * 0.75;
        ctx.strokeStyle = "#E1F5FE"; ctx.lineWidth = 2;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.stroke();
        ctx.globalAlpha = fade * 0.5;
        ctx.strokeStyle = "rgba(129,212,250,0.85)"; ctx.lineWidth = 1.2;
        ctx.setLineDash([12, 7]); ctx.lineDashOffset = -frame * 1.6;
        groundEllipsePath(ctx, sx, sy, R * 0.68);
        ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;

        ctx.globalAlpha = fade * 0.85;
        const count = Math.min(e.particleCount ?? 8, 10);
        for (let i = 0; i < count; i++) {
          const rnd = srand(e.seed, i);
          const orbit = (i / count) * TAU + frame * 0.013 * (1 + (i % 3) * 0.3) + e.seed * 0.001;
          const radOff = R * (0.18 + rnd * 0.75);
          const bob = Math.sin(frame * 0.05 + i) * 4;
          const px = sx + Math.cos(orbit) * radOff;
          const py = sy + Math.sin(orbit) * radOff * GROUND_TILT - bob - 6;
          const fs = 2.2 + (i % 3) * 0.6;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(frame * 0.04 + i);
          ctx.strokeStyle = "rgba(225,245,254,0.92)";
          ctx.lineWidth = 1;
          for (let arm = 0; arm < 4; arm++) {
            const a = (arm / 4) * TAU;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * fs * 1.6, Math.sin(a) * fs * 1.6);
            ctx.stroke();
          }
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath(); ctx.arc(0, 0, fs * 0.4, 0, TAU); ctx.fill();
          ctx.restore();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  PETAL ZONE — Хана супер: лепестковая зона лечения (упрощённый)
      // ────────────────────────────────────────────────────────────────────
      case "petalZone": {
        drawUltGroundPad(ctx, sx, sy, R, e.color, fade, 0.36);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = fade * 0.44;
        const floor = ctx.createRadialGradient(sx, sy, R * 0.1, sx, sy, R);
        floor.addColorStop(0, "rgba(255,182,193,0.75)");
        floor.addColorStop(0.55, "rgba(244,143,177,0.3)");
        floor.addColorStop(1, "rgba(194,24,91,0)");
        ctx.fillStyle = floor;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.fill();

        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.globalAlpha = fade * (0.6 + Math.sin(frame * 0.18) * 0.12);
        ctx.strokeStyle = "#FF80AB"; ctx.lineWidth = 2;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.stroke();

        ctx.globalCompositeOperation = "source-over";
        const count = Math.min(e.particleCount ?? 9, 12);
        const palette = [
          "rgba(255,128,171,0.9)", "rgba(252,228,236,0.9)",
          "rgba(255,64,129,0.85)", "rgba(255,182,193,0.9)",
        ];
        for (let i = 0; i < count; i++) {
          const rnd = srand(e.seed, i);
          const orbit = (i / count) * TAU + frame * 0.012 + e.seed * 0.001;
          const radOff = R * (0.22 + rnd * 0.7);
          const bob = Math.sin(frame * 0.05 + i * 1.3) * 5;
          const px = sx + Math.cos(orbit) * radOff;
          const py = sy + Math.sin(orbit) * radOff * GROUND_TILT + bob - 5;
          const petalAng = orbit * 1.4 + frame * 0.04 + rnd * 6;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(petalAng);
          ctx.globalAlpha = fade * 0.85;
          ctx.fillStyle = palette[i % palette.length];
          ctx.shadowBlur = 0;
          const pw = 5 + (i % 3) * 0.8, ph = 3 + (i % 2) * 0.7;
          ctx.beginPath();
          ctx.moveTo(0, -ph);
          ctx.bezierCurveTo(pw, -ph * 0.6, pw, ph * 0.6, 0, ph);
          ctx.bezierCurveTo(-pw, ph * 0.6, -pw, -ph * 0.6, 0, -ph);
          ctx.fill();
          ctx.restore();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  POISON ZONE — токсичная зона (Рин супер / босс) — упрощённый
      // ────────────────────────────────────────────────────────────────────
      case "poisonZone": {
        ctx.globalCompositeOperation = "source-over";
        drawUltGroundPad(ctx, sx, sy, R, e.color, fade, 0.34);

        ctx.globalAlpha = fade * 0.48;
        const floor = ctx.createRadialGradient(sx, sy, R * 0.05, sx, sy, R);
        floor.addColorStop(0, "rgba(118,255,3,0.7)");
        floor.addColorStop(0.5, "rgba(76,175,80,0.32)");
        floor.addColorStop(1, "rgba(27,94,32,0)");
        ctx.fillStyle = floor;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.fill();

        // 2 вращающихся слоя тумана (вместо 4) — лёгкое клубление
        for (let layer = 0; layer < 2; layer++) {
          const la = frame * (0.012 + layer * 0.005) + e.seed * 0.001 + layer * 1.7;
          const lw = R * (0.6 + layer * 0.22);
          const lh = lw * GROUND_TILT;
          ctx.globalAlpha = fade * (0.18 - layer * 0.06);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(la);
          ctx.fillStyle = "rgba(100,240,150,0.55)";
          ctx.beginPath(); ctx.ellipse(0, 0, lw, lh, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }

        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.globalAlpha = fade * (0.7 + Math.sin(frame * 0.15) * 0.12);
        ctx.strokeStyle = "rgba(139,195,74,0.95)"; ctx.lineWidth = 2;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.stroke();

        ctx.globalCompositeOperation = "source-over";
        const count = Math.min(e.particleCount ?? 7, 9);
        for (let i = 0; i < count; i++) {
          const rnd = srand(e.seed, i);
          const a = (i / count) * TAU + e.seed * 0.001;
          const baseRad = R * (0.15 + rnd * 0.7);
          const rise = (frame * 0.035 + i * 0.6) % 1;
          const bx = sx + Math.cos(a) * baseRad;
          const by = sy + Math.sin(a) * baseRad * GROUND_TILT - rise * R * 0.85;
          const bs = 2.4 + (i % 3) * 0.9;
          ctx.globalAlpha = fade * (1 - rise) * 0.85;
          const bg = ctx.createRadialGradient(bx - bs * 0.3, by - bs * 0.3, 0, bx, by, bs);
          bg.addColorStop(0, "rgba(255,255,255,0.85)");
          bg.addColorStop(0.5, "rgba(105,240,174,0.7)");
          bg.addColorStop(1, "rgba(46,125,50,0.15)");
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.arc(bx, by, bs, 0, TAU); ctx.fill();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  LIGHT CAGE — Кендзи супер: электрическая клетка (упрощённый)
      // ────────────────────────────────────────────────────────────────────
      case "lightCage": {
        drawUltGroundPad(ctx, sx, sy, R, e.color, fade, 0.32);
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;

        ctx.globalAlpha = fade * 0.38;
        const floor = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
        floor.addColorStop(0, "rgba(255,255,180,0.55)");
        floor.addColorStop(0.6, "rgba(255,193,7,0.2)");
        floor.addColorStop(1, "rgba(255,111,0,0)");
        ctx.fillStyle = floor;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.fill();

        // Кольцо клетки
        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = "#FFEB3B"; ctx.lineWidth = 2.6;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.stroke();

        // 6 молниевых прутьев (вместо 10), упрощённые
        const bars = 6;
        for (let i = 0; i < bars; i++) {
          const a = (i / bars) * TAU + frame * 0.005;
          const bx = sx + Math.cos(a) * R * 0.97;
          const by = sy + Math.sin(a) * R * 0.97 * GROUND_TILT;
          const topY = by - R * 0.9;
          const segs = 4;
          const pts: { x: number; y: number }[] = [{ x: bx, y: by }];
          for (let s = 1; s < segs; s++) {
            const t = s / segs;
            const wob = (srand(e.seed, i * 7 + s) - 0.5) * 5;
            pts.push({ x: bx + wob, y: by + (topY - by) * t });
          }
          pts.push({ x: bx, y: topY });

          // 2-слойный (haze + core)
          ctx.strokeStyle = "rgba(255,235,59,0.55)";
          ctx.lineWidth = 2.8 * (0.7 + Math.sin(frame * 0.3 + i) * 0.3);
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
          ctx.stroke();
        }

        // Купол сверху (тонкая арка вокруг вершин прутьев)
        ctx.globalAlpha = fade * 0.5;
        ctx.strokeStyle = "rgba(255,235,59,0.85)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(sx, sy - R * 0.5, R * 0.97, R * 0.4, 0, 0, TAU);
        ctx.stroke();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  LIGHTNING BOLT — зигзаг-молния между двумя точками (4 слоя)
      // ────────────────────────────────────────────────────────────────────
      case "lightningBolt": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, e.color, 12);

        const pts = e.zigzag ?? [];
        if (pts.length > 1) {
          const jx: number[] = [], jy: number[] = [];
          const amp = 7 * fade;
          for (let i = 0; i < pts.length; i++) {
            if (i === 0 || i === pts.length - 1) {
              jx.push(pts[i].x - camX); jy.push(pts[i].y - camY);
            } else {
              const t = frame * 0.6 + e.seed * 0.001 + i * 1.37;
              jx.push(pts[i].x - camX + Math.sin(t) * amp + Math.sin(t * 2.1) * amp * 0.35);
              jy.push(pts[i].y - camY + Math.cos(t * 0.88) * amp * 0.75);
            }
          }
          const stroke = (style: string, lw: number, a: number) => {
            ctx.strokeStyle = style;
            ctx.lineWidth = lw;
            ctx.globalAlpha = a;
            ctx.lineCap = "round"; ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(jx[0], jy[0]);
            for (let i = 1; i < jx.length; i++) ctx.lineTo(jx[i], jy[i]);
            ctx.stroke();
          };
          stroke(rgba(e.color, 0.35), 12, fade * 0.35);                          // широкий haze
          stroke(rgba(e.color, 0.92), 6, fade * 0.9);                            // средний
          stroke(lighten(e.color, 0.5), 3, fade);                                // светлый
          stroke("rgba(255,255,255,0.98)", 1.8 + Math.sin(frame * 0.6) * 0.5, fade); // белый core

          // Мелкие ответвления-разряды от каждой средней точки
          ctx.strokeStyle = "rgba(255,255,255,0.65)";
          ctx.lineWidth = 1.1;
          for (let i = 1; i < jx.length - 1; i++) {
            const branches = 1 + (i % 2);
            for (let k = 0; k < branches; k++) {
              const dx = (srand(e.seed, i * 7 + k) - 0.5) * 22;
              const dy = (srand(e.seed, i * 11 + k + 17) - 0.5) * 22;
              ctx.beginPath();
              ctx.moveTo(jx[i], jy[i]);
              ctx.lineTo(jx[i] + dx, jy[i] + dy);
              ctx.stroke();
              // мини-кончик
              ctx.fillStyle = "rgba(255,255,255,0.8)";
              ctx.beginPath(); ctx.arc(jx[i] + dx, jy[i] + dy, 1.3, 0, TAU); ctx.fill();
            }
          }

          // Импакт-вспышка в концевой точке
          const lastX = jx[jx.length - 1], lastY = jy[jy.length - 1];
          const ig = ctx.createRadialGradient(lastX, lastY, 0, lastX, lastY, 22);
          ig.addColorStop(0, `rgba(255,255,255,${fade})`);
          ig.addColorStop(0.5, rgba(lighten(e.color, 0.4), fade * 0.6));
          ig.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = ig;
          ctx.beginPath(); ctx.arc(lastX, lastY, 22, 0, TAU); ctx.fill();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  METEOR — Сора супер (warning ring → падающий камень → AOE-impact)
      // ────────────────────────────────────────────────────────────────────
      case "meteor": {
        if (!e.exploded) {
          const impactR = e.tickRange ?? 60;
          drawUltGroundPad(ctx, sx, sy, impactR, e.color, fade, 0.28);
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = 0.55 + Math.sin(frame * 0.35) * 0.25;
          ctx.strokeStyle = e.color; ctx.lineWidth = 2.6;
          ctx.shadowBlur = 0;
          ctx.setLineDash([14, 8]); ctx.lineDashOffset = -frame * 2;
          groundEllipsePath(ctx, sx, sy, impactR);
          ctx.stroke();
          ctx.setLineDash([]); ctx.lineDashOffset = 0;

          ctx.globalAlpha = 0.18 + Math.sin(frame * 0.35) * 0.08;
          const warn = ctx.createRadialGradient(sx, sy, 0, sx, sy, impactR);
          warn.addColorStop(0, "rgba(255,120,0,0.55)");
          warn.addColorStop(0.5, "rgba(255,60,0,0.28)");
          warn.addColorStop(1, "rgba(255,0,0,0)");
          ctx.fillStyle = warn;
          groundEllipsePath(ctx, sx, sy, impactR);
          ctx.fill();

          ctx.globalAlpha = 0.5 + Math.sin(frame * 0.35) * 0.2;
          ctx.strokeStyle = e.color; ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(sx - impactR * 1.15, sy); ctx.lineTo(sx + impactR * 1.15, sy);
          ctx.moveTo(sx, sy - impactR * 1.15 * GROUND_TILT); ctx.lineTo(sx, sy + impactR * 1.15 * GROUND_TILT);
          ctx.stroke();

          const warnDur = 0.65;
          const fall = Math.max(0, Math.min(1, (e.delay ?? 0) / warnDur));
          const fh = e.fallHeight ?? 380;
          const my = sy - fall * fh;

          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 0.38 + (1 - fall) * 0.28;
          const shsh = Math.max(1, 6 + (1 - fall) * 12);
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          groundEllipsePath(ctx, sx, sy + 4, shsh * 1.1);
          ctx.fill();

          ctx.globalCompositeOperation = "lighter";
          ctx.shadowBlur = 0;
          for (let seg = 6; seg >= 1; seg--) {
            const t = seg / 6;
            const tailY = my + (sy - my) * (1 - t * 0.88);
            const tailA = (1 - t) * 0.65;
            const tailW = 4 + (1 - t) * 12;
            ctx.globalAlpha = tailA;
            ctx.strokeStyle = t < 0.35 ? "#FFFDE7" : t < 0.6 ? "#FF9800" : "rgba(183,28,28,0.65)";
            ctx.lineWidth = tailW; ctx.lineCap = "round";
            const nextY = my + (sy - my) * (1 - (seg - 1) / 6 * 0.88);
            const offX = Math.sin(seg * 0.7 + e.seed * 0.001) * 3;
            ctx.beginPath();
            ctx.moveTo(sx + offX, tailY);
            ctx.lineTo(sx + offX * 0.7, nextY);
            ctx.stroke();
          }

          const rockR = 20;
          const rockG = ctx.createRadialGradient(sx - 5, my - 6, 0, sx, my, rockR);
          rockG.addColorStop(0, "#FFFDE7");
          rockG.addColorStop(0.2, "#FFCA28");
          rockG.addColorStop(0.5, e.color);
          rockG.addColorStop(0.85, "#5D1A1A");
          rockG.addColorStop(1, "#1A0500");
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = rockG;
          ctx.beginPath(); ctx.arc(sx, my, rockR, 0, TAU); ctx.fill();

          ctx.strokeStyle = "rgba(255,200,50,0.8)";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(sx - 7, my - 9); ctx.lineTo(sx + 4, my + 7);
          ctx.moveTo(sx + 8, my - 6); ctx.lineTo(sx - 3, my + 8);
          ctx.stroke();

          for (let k = 0; k < 4; k++) {
            const a = frame * 0.22 + k * 1.2;
            const px = sx + Math.cos(a) * rockR * 1.4;
            const py = my + Math.sin(a) * rockR * 1.4;
            ctx.fillStyle = k % 2 === 0 ? "#FFE082" : "#FF6D00";
            ctx.beginPath(); ctx.arc(px, py, 2, 0, TAU); ctx.fill();
          }
        } else {
          // ПОСТИМПАКТ: тлеющий кратер с лавовыми трещинами
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = fade * 0.85;
          const impactR = e.tickRange ?? 60;
          const sc = ctx.createRadialGradient(sx, sy + 3, 0, sx, sy + 3, impactR * 1.35);
          sc.addColorStop(0, "rgba(80,0,0,0.78)");
          sc.addColorStop(0.5, "rgba(40,15,5,0.45)");
          sc.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = sc;
          groundEllipsePath(ctx, sx, sy + 3, impactR * 1.35);
          ctx.fill();

          // Лавовые трещины (8 шт.)
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = fade * (0.5 + Math.sin(frame * 0.2) * 0.2);
          ctx.strokeStyle = "rgba(255,90,20,0.95)";
          applyVfxShadow(ctx, "#FF6D00", 12);
          ctx.lineWidth = 2;
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU + e.seed * 0.001;
            ctx.beginPath();
            ctx.moveTo(sx + Math.cos(a) * impactR * 0.15, sy + Math.sin(a) * impactR * 0.15 * GROUND_TILT);
            ctx.lineTo(sx + Math.cos(a) * impactR * 0.9, sy + Math.sin(a) * impactR * 0.9 * GROUND_TILT);
            ctx.stroke();
          }
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  TURRET — Таро супер (3D-ish модель с вращающимся стволом)
      // ────────────────────────────────────────────────────────────────────
      case "turret": {
        const lifeFrac = Math.max(0, e.timer / e.maxTimer);
        applyVfxShadow(ctx, "#FFEB3B", 18);

        // Тень под турелью
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        groundEllipsePath(ctx, sx + 3, sy + R * 0.6, R * 0.85);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Основание-платформа (металлическая)
        const baseG = ctx.createRadialGradient(sx, sy + R * 0.05, R * 0.1, sx, sy + R * 0.05, R * 0.72);
        baseG.addColorStop(0, "#546E7A");
        baseG.addColorStop(0.8, "#37474F");
        baseG.addColorStop(1, "#1B262C");
        ctx.fillStyle = baseG;
        groundEllipsePath(ctx, sx, sy + R * 0.05, R * 0.72);
        ctx.fill();
        ctx.strokeStyle = "#1B262C"; ctx.lineWidth = 2;
        groundEllipsePath(ctx, sx, sy + R * 0.05, R * 0.72);
        ctx.stroke();
        // Жёлтое кольцо-обводка
        ctx.strokeStyle = "#FFC107"; ctx.lineWidth = 2.8;
        groundEllipsePath(ctx, sx, sy + R * 0.05, R * 0.6);
        ctx.stroke();
        // Заклёпки по периметру
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          const rx = sx + Math.cos(a) * R * 0.62;
          const ry = sy + R * 0.05 + Math.sin(a) * R * 0.62 * GROUND_TILT;
          ctx.fillStyle = "#FFC107";
          ctx.beginPath(); ctx.arc(rx, ry, 1.6, 0, TAU); ctx.fill();
        }

        // Верхний корпус — сферический, с радиальным светом
        const bodyG = ctx.createRadialGradient(sx - R * 0.2, sy - R * 0.2, 0, sx, sy, R * 0.55);
        bodyG.addColorStop(0, "#FFECB3");
        bodyG.addColorStop(0.4, "#CD9B39");
        bodyG.addColorStop(0.85, "#5D4037");
        bodyG.addColorStop(1, "#1A0E0A");
        ctx.fillStyle = bodyG;
        ctx.beginPath(); ctx.arc(sx, sy, R * 0.55, 0, TAU); ctx.fill();
        // Обводка корпуса
        ctx.strokeStyle = "#3E2723"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx, sy, R * 0.55, 0, TAU); ctx.stroke();

        // Вращающийся ствол
        const ang = frame * 0.07;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        // Тень ствола
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(-4 + 1.5, -R * 1.05 + 1, 8, R * 1.05);
        // Сам ствол с металлическим градиентом
        const barrelG = ctx.createLinearGradient(-5, 0, 5, 0);
        barrelG.addColorStop(0, "#1B262C");
        barrelG.addColorStop(0.4, "#90A4AE");
        barrelG.addColorStop(0.5, "#ECEFF1");
        barrelG.addColorStop(0.6, "#90A4AE");
        barrelG.addColorStop(1, "#1B262C");
        ctx.fillStyle = barrelG;
        ctx.fillRect(-4.5, -R * 1.05, 9, R * 1.05);
        // Кольца на стволе
        ctx.strokeStyle = "#37474F"; ctx.lineWidth = 1;
        for (let s = 1; s <= 3; s++) {
          ctx.beginPath();
          ctx.moveTo(-4.5, -R * 1.05 + s * R * 0.22);
          ctx.lineTo(4.5, -R * 1.05 + s * R * 0.22);
          ctx.stroke();
        }
        // Дуло — пышное золотое свечение
        ctx.fillStyle = "#FFEB3B";
        applyVfxShadow(ctx, "#FFEB3B", 16);
        ctx.beginPath(); ctx.arc(0, -R * 1.05, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = "#FF6F00";
        ctx.beginPath(); ctx.arc(0, -R * 1.05, 3, 0, TAU); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(0, -R * 1.05, 1.4, 0, TAU); ctx.fill();
        ctx.restore();

        // Центральный хаб
        const hubG = ctx.createRadialGradient(sx - 2, sy - 2, 0, sx, sy, R * 0.25);
        hubG.addColorStop(0, "#FFFDE7");
        hubG.addColorStop(0.5, "#FFD740");
        hubG.addColorStop(1, "#5D4037");
        ctx.fillStyle = hubG;
        ctx.beginPath(); ctx.arc(sx, sy, R * 0.25, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#3E2723"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx, sy, R * 0.25, 0, TAU); ctx.stroke();

        // Кольцо дальности (пунктир)
        ctx.globalAlpha = 0.22 + Math.sin(frame * 0.08) * 0.06;
        ctx.strokeStyle = "#FFEB3B"; ctx.lineWidth = 1.3;
        applyVfxShadow(ctx, "#FFEB3B", 8);
        ctx.setLineDash([8, 9]); ctx.lineDashOffset = -frame * 0.8;
        groundEllipsePath(ctx, sx, sy + 4, e.tickRange ?? 250);
        ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;

        // Sweep-таймер по дуге (показывает оставшееся время жизни).
        // Рисуем как ЭЛЛИПС на земле с тем же наклоном, что и круг под бойцом
        // (GROUND_TILT ≈ 0.38 == BRAWLER_FLOOR_HALO_RY_OVER_RX).
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = "#FFEB3B"; ctx.lineWidth = 3;
        applyVfxShadow(ctx, "#FFEB3B", 10);
        ctx.beginPath();
        ctx.ellipse(
          sx, sy + R * 0.05,
          R * 0.78, R * 0.78 * GROUND_TILT,
          0,
          -Math.PI / 2, -Math.PI / 2 + TAU * lifeFrac,
        );
        ctx.stroke();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  BERSERK AURA — огненная ярость (упрощённый)
      // ────────────────────────────────────────────────────────────────────
      case "berserkAura": {
        applyVfxShadow(ctx, "#FF3D00", 18);
        const gy = followBrawlerGroundSy(sy, e);

        // Ground scorch
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.45;
        const ground = ctx.createRadialGradient(sx, gy, 0, sx, gy, R * 1.3);
        ground.addColorStop(0, "rgba(255,87,34,0.65)");
        ground.addColorStop(0.6, "rgba(255,30,0,0.22)");
        ground.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = ground;
        groundEllipsePath(ctx, sx, gy, R * 1.3);
        ctx.fill();

        // Огненное кольцо
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = "rgba(255,87,34,0.95)"; ctx.lineWidth = 2.4;
        groundEllipsePath(ctx, sx, gy, R * 1.1);
        ctx.stroke();

        // 9 пламя-теардропов (вместо 16)
        const flames = 9;
        for (let i = 0; i < flames; i++) {
          const a = (i / flames) * TAU + frame * 0.18;
          const rr = R * (0.82 + Math.sin(frame * 0.32 + i * 1.1) * 0.18);
          const fx = sx + Math.cos(a) * rr;
          const fy = gy + Math.sin(a) * rr * GROUND_TILT;
          const fh = 11 + (i % 3) * 3 + Math.sin(frame * 0.4 + i) * 2.5;
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(a + Math.PI * 1.5);
          const flameG = ctx.createLinearGradient(0, 0, 0, -fh);
          flameG.addColorStop(0, "#FF3D00");
          flameG.addColorStop(0.55, "#FFB300");
          flameG.addColorStop(1, "rgba(255,235,59,0)");
          ctx.fillStyle = flameG;
          applyVfxShadow(ctx, "#FF6D00", 10);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(fh * 0.5, -fh * 0.5, 0, -fh);
          ctx.quadraticCurveTo(-fh * 0.5, -fh * 0.5, 0, 0);
          ctx.fill();
          ctx.restore();
        }

        // 6 эмберов (вместо 14)
        for (let i = 0; i < 6; i++) {
          const t = (frame * 0.014 + i * 0.18) % 1;
          const a = (i / 6) * TAU + e.seed * 0.001;
          const eRad = R * 0.42 + t * R * 0.5;
          const ex = sx + Math.cos(a) * eRad;
          const ey = gy - t * 30 + Math.sin(a) * eRad * GROUND_TILT;
          ctx.globalAlpha = (1 - t) * 0.85;
          ctx.fillStyle = i % 2 === 0 ? "#FFD740" : "#FF6D00";
          applyVfxShadow(ctx, "#FF6D00", 6);
          ctx.beginPath(); ctx.arc(ex, ey, 1.6 + srand(e.seed, i) * 1.1, 0, TAU); ctx.fill();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  SHIELD DOME — энергетический купол (Ронин, spawn-щит)
      //
      //  Намеренно ОЧЕНЬ прозрачный: куполочный «пузырь» чуть-чуть подкрашен,
      //  основной визуал — это рим и две бегущие арки. Бойца внутри отлично
      //  видно. Используется обычным `source-over` (никакого `lighter`,
      //  иначе цвета складываются и сфера засвечивается в белое).
      // ────────────────────────────────────────────────────────────────────
      case "shieldDome": {
        const cy = sy - 8;
        ctx.globalCompositeOperation = "source-over";

        // 1. Лёгкое ground-кольцо у ног (eq sphere shadow)
        ctx.globalAlpha = 0.25 * fade;
        ctx.strokeStyle = rgba(e.color, 0.7);
        ctx.lineWidth = 1.8;
        groundEllipsePath(ctx, sx, sy + 4, R * 0.95);
        ctx.stroke();

        // 2. Сфера-«мыльный пузырь» — почти прозрачная заливка
        ctx.globalAlpha = 0.18 * fade;
        const dome = ctx.createRadialGradient(sx, cy - R * 0.3, R * 0.05, sx, cy, R);
        dome.addColorStop(0, rgba(lighten(e.color, 0.6), 0));
        dome.addColorStop(0.7, rgba(e.color, 0.08));
        dome.addColorStop(1, rgba(e.color, 0.28));
        ctx.fillStyle = dome;
        ctx.beginPath(); ctx.arc(sx, cy, R, 0, TAU); ctx.fill();

        // 3. Чёткий рим
        ctx.shadowBlur = 0;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = (0.68 + Math.sin(frame * 0.18) * 0.12) * fade;
        ctx.beginPath(); ctx.arc(sx, cy, R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        ctx.globalAlpha = fade * 0.55;
        ctx.beginPath(); ctx.arc(sx, cy, R * 0.97, 0, TAU); ctx.stroke();

        for (let i = 0; i < 2; i++) {
          const a = frame * 0.05 + (i / 2) * TAU + e.seed * 0.001;
          ctx.strokeStyle = i === 0 ? rgba(lighten(e.color, 0.4), 0.8)
                                   : rgba("#FFFFFF", 0.65);
          ctx.lineWidth = i === 0 ? 1.6 : 1.1;
          ctx.globalAlpha = fade;
          ctx.beginPath();
          ctx.arc(sx, cy, R * (0.85 + i * 0.08), a, a + Math.PI * 0.45);
          ctx.stroke();
        }

        // 5. Лёгкий specular-блик (намёк на стеклянную сферу)
        ctx.globalAlpha = 0.2 * fade;
        ctx.shadowBlur = 0;
        const spec = ctx.createRadialGradient(
          sx - R * 0.28, cy - R * 0.45, 0,
          sx - R * 0.28, cy - R * 0.45, R * 0.4,
        );
        spec.addColorStop(0, "rgba(255,255,255,0.7)");
        spec.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = spec;
        ctx.beginPath(); ctx.arc(sx - R * 0.28, cy - R * 0.45, R * 0.4, 0, TAU); ctx.fill();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  TELEPORT FLASH — фиолетовый вихрь телепортации
      // ────────────────────────────────────────────────────────────────────
      case "teleportFlash": {
        const warp = 1 + 0.14 * Math.sin(frame * 0.22 + e.seed * 0.001) * (1 - lifeT);
        const r = R * (0.25 + easeOutCubic(lifeT) * 1.3) * warp;
        drawUltGroundPad(ctx, sx, sy, r * 0.85, e.color, fade, 0.25);
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;

        ctx.globalAlpha = fade * 0.65;
        const voidG = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 1.15);
        voidG.addColorStop(0, "rgba(20,0,40,0.85)");
        voidG.addColorStop(0.55, rgba(e.color, 0.4));
        voidG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = voidG;
        ctx.beginPath(); ctx.arc(sx, sy, r * 1.15, 0, TAU); ctx.fill();

        ctx.globalAlpha = fade * 0.85;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + frame * 0.22 + e.seed * 0.001;
          const r0 = r * 0.18;
          const r1 = r * (0.78 + (i % 2) * 0.15);
          ctx.strokeStyle = i % 3 === 0 ? "#FFFFFF" : i % 3 === 1 ? e.color : rgba(lighten(e.color, 0.5), 0.9);
          ctx.lineWidth = i % 2 === 0 ? 2.2 : 1.4;
          const cpA = a + Math.PI * 0.25;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0 * GROUND_TILT);
          ctx.quadraticCurveTo(
            sx + Math.cos(cpA) * r * 0.55,
            sy + Math.sin(cpA) * r * 0.55 * GROUND_TILT,
            sx + Math.cos(a + 0.5) * r1,
            sy + Math.sin(a + 0.5) * r1 * GROUND_TILT,
          );
          ctx.stroke();
        }

        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2;
        ctx.globalAlpha = fade * (0.5 + Math.sin(frame * 0.4) * 0.3);
        groundEllipsePath(ctx, sx, sy, r);
        ctx.stroke();
        ctx.strokeStyle = e.color; ctx.lineWidth = 1.2;
        groundEllipsePath(ctx, sx, sy, r * 0.93);
        ctx.stroke();

        ctx.globalAlpha = fade * (1 - lifeT * 0.55);
        const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.48);
        core.addColorStop(0, "rgba(255,255,255,1)");
        core.addColorStop(0.4, rgba(lighten(e.color, 0.4), 0.9));
        core.addColorStop(1, rgba(e.color, 0));
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.48, 0, TAU); ctx.fill();

        for (let i = 0; i < 4; i++) {
          const t = ((frame * 0.025 + i * 0.12 + srand(e.seed, i) * 0.5) % 1);
          const a = (i / 4) * TAU;
          const px = sx + Math.cos(a) * r * 0.5 * (1 - t);
          const py = sy + Math.sin(a) * r * 0.5 * (1 - t) * GROUND_TILT - t * r * 0.7;
          ctx.globalAlpha = (1 - t) * fade;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.shadowBlur = 0;
          ctx.beginPath(); ctx.arc(px, py, 1.4 + (1 - t) * 1.2, 0, TAU); ctx.fill();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  FREEZE AURA — ледяной кристалл вокруг бойца (упрощённый)
      //  Полупрозрачный, чтобы боец оставался виден сквозь кристалл.
      // ────────────────────────────────────────────────────────────────────
      case "freezeAura": {
        const top = sy - R * 1.2;
        ctx.globalCompositeOperation = "source-over";

        // Ground frost
        ctx.globalAlpha = 0.4;
        const frost = ctx.createRadialGradient(sx, sy + 6, 0, sx, sy + 6, R);
        frost.addColorStop(0, "rgba(225,245,254,0.78)");
        frost.addColorStop(0.6, "rgba(129,212,250,0.32)");
        frost.addColorStop(1, "rgba(2,136,209,0)");
        ctx.fillStyle = frost;
        groundEllipsePath(ctx, sx, sy + 6, R);
        ctx.fill();

        // Прозрачный ледяной кристалл (восьмиугольник)
        ctx.globalAlpha = 0.32;
        const ice = ctx.createLinearGradient(sx, top, sx, sy + R * 0.2);
        ice.addColorStop(0, "rgba(255,255,255,0.7)");
        ice.addColorStop(0.5, "rgba(129,212,250,0.4)");
        ice.addColorStop(1, "rgba(2,136,209,0.3)");
        ctx.fillStyle = ice;
        const w = R * 1.0, h = R * 1.35;
        const cy = (top + sy) / 2;
        ctx.beginPath();
        ctx.moveTo(sx - w * 0.6, cy - h * 0.45);
        ctx.lineTo(sx - w,        cy);
        ctx.lineTo(sx - w * 0.6, cy + h * 0.45);
        ctx.lineTo(sx + w * 0.6, cy + h * 0.45);
        ctx.lineTo(sx + w,        cy);
        ctx.lineTo(sx + w * 0.6, cy - h * 0.45);
        ctx.closePath();
        ctx.fill();

        // Граненая обводка (более яркая, чем заливка — даёт контур)
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.lineWidth = 1.8;
        applyVfxShadow(ctx, "#80D8FF", 10);
        ctx.stroke();

        // Снежинки сверху-вокруг (3 шт)
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.85;
        for (let i = 0; i < 3; i++) {
          const t = (frame * 0.013 + i * 0.33) % 1;
          const px = sx + Math.sin(t * Math.PI * 2 + i * 1.7) * R * 0.6;
          const py = top - 2 + t * (h + 8);
          ctx.fillStyle = "#FFFFFF";
          ctx.beginPath(); ctx.arc(px, py, 1.4, 0, TAU); ctx.fill();
          ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(px - 2, py); ctx.lineTo(px + 2, py);
          ctx.moveTo(px, py - 2); ctx.lineTo(px, py + 2);
          ctx.stroke();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  ROOT AURA — корни/лианы у ног (обездвиживание)
      // ────────────────────────────────────────────────────────────────────
      case "rootAura": {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.72;
        const sec = e.secondary || "#558B2F";
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + frame * 0.01;
          const len = R * (0.55 + (i % 2) * 0.2);
          ctx.strokeStyle = i % 2 === 0 ? e.color : sec;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * R * 0.2, sy + Math.sin(a) * R * 0.12 + 4);
          ctx.quadraticCurveTo(
            sx + Math.cos(a) * len * 0.6,
            sy + Math.sin(a) * len * 0.35 + 8,
            sx + Math.cos(a) * len,
            sy + Math.sin(a) * len * 0.45 + 6,
          );
          ctx.stroke();
        }
        ctx.globalAlpha = 0.35;
        const moss = ctx.createRadialGradient(sx, sy + 6, 0, sx, sy + 6, R);
        moss.addColorStop(0, rgba(sec, 0.45));
        moss.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = moss;
        groundEllipsePath(ctx, sx, sy + 6, R);
        ctx.fill();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  SMOKE BLIND — серая дымка вокруг цели
      // ────────────────────────────────────────────────────────────────────
      case "smokeBlindAura": {
        ctx.globalCompositeOperation = "source-over";
        const puff = 0.55 + Math.sin(frame * 0.07) * 0.12;
        ctx.globalAlpha = 0.38 * puff;
        const fog = ctx.createRadialGradient(sx, sy - 4, R * 0.1, sx, sy - 4, R * 1.15);
        fog.addColorStop(0, "rgba(120,144,156,0.55)");
        fog.addColorStop(0.55, "rgba(96,125,139,0.35)");
        fog.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fog;
        ctx.beginPath(); ctx.arc(sx, sy - 4, R * 1.15, 0, TAU); ctx.fill();
        break;
      }

      case "allyBlindAura": {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.28;
        const allyFog = ctx.createRadialGradient(sx, sy, R * 0.15, sx, sy, R);
        allyFog.addColorStop(0, "rgba(165,214,167,0.45)");
        allyFog.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = allyFog;
        groundEllipsePath(ctx, sx, sy + 4, R * 0.85);
        ctx.fill();
        break;
      }

      case "hellBrandBody": {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.55 + Math.sin(frame * 0.09) * 0.12;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        groundEllipsePath(ctx, sx, sy + 2, R * 0.72);
        ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = e.secondary || "#111111";
        ctx.beginPath(); ctx.arc(sx, sy - R * 0.35, R * 0.22, 0, TAU); ctx.fill();
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  SLOW AURA — голубая рябь у ног (упрощённый: 2 волны + вязкий обруч)
      // ────────────────────────────────────────────────────────────────────
      case "slowAura": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#42A5F5", 12);

        // 2 расходящиеся ground-волны (вместо 4)
        for (let i = 0; i < 2; i++) {
          const t = (frame * 0.022 + i * 0.5) % 1;
          const rr = R * (0.4 + t * 0.95);
          ctx.globalAlpha = (1 - t) * 0.65;
          ctx.strokeStyle = "rgba(66,165,245,0.95)";
          ctx.lineWidth = 1.8;
          groundEllipsePath(ctx, sx, sy + 4, rr);
          ctx.stroke();
        }

        // Вязкий «обруч»-dash (главный индикатор замедления)
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = "rgba(13,71,161,0.9)";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 5]);
        ctx.lineDashOffset = -frame * 1.4;
        groundEllipsePath(ctx, sx, sy + 4, R * 0.75);
        ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  STUN AURA — звёздочки-кружение над головой (стан)
      // ────────────────────────────────────────────────────────────────────
      case "stunAura": {
        const headY = sy - R * 1.0;
        ctx.globalCompositeOperation = "lighter";

        // Тонкая эллипс-орбита у головы (одна, не двойная)
        ctx.globalAlpha = 0.4 + Math.sin(frame * 0.25) * 0.15;
        applyVfxShadow(ctx, "#FFD740", 10);
        ctx.strokeStyle = "rgba(255,215,64,0.85)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(sx, headY, R * 0.75, R * 0.22, 0, 0, TAU); ctx.stroke();

        // 4 звёздочки по орбите (вместо 5) — звёзды лежат на правильном эллипсе
        const n = 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + frame * 0.14;
          const px = sx + Math.cos(a) * R * 0.75;
          const py = headY + Math.sin(a) * R * 0.22;
          const isBack = Math.sin(a) < 0;
          const baseSc = (1.1 + Math.sin(frame * 0.3 + i) * 0.25) * (isBack ? 0.75 : 1);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(frame * 0.08 + i);
          ctx.fillStyle = isBack ? "#FFD54F" : "#FFEB3B";
          applyVfxShadow(ctx, "#FFC107", 8);
          ctx.globalAlpha = isBack ? 0.6 : 1;
          ctx.beginPath();
          for (let k = 0; k < 5; k++) {
            const ang = (k / 5) * TAU - Math.PI / 2;
            ctx.lineTo(Math.cos(ang) * 4.5 * baseSc, Math.sin(ang) * 4.5 * baseSc);
            const ang2 = ang + Math.PI / 5;
            ctx.lineTo(Math.cos(ang2) * 1.9 * baseSc, Math.sin(ang2) * 1.9 * baseSc);
          }
          ctx.closePath(); ctx.fill();
          ctx.restore();
        }

        // Одна dizzy-синусоида над головой (без двойника)
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let k = 0; k <= 20; k++) {
          const t = k / 20;
          const px = sx - R * 0.4 + R * 0.8 * t;
          const py = headY - R * 0.35 + Math.sin(t * Math.PI * 3 + frame * 0.2) * 3;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  HELL BRAND — Verdeletta mark above enemy
      // ────────────────────────────────────────────────────────────────────
      case "hellBrandMark": {
        const pulse = 0.78 + Math.sin(frame * 0.18) * 0.22;
        const spin = frame * 0.04;
        const r = R * 1.15;
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = fade * 0.55;
        const halo = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 1.35);
        halo.addColorStop(0, "rgba(0,0,0,0.75)");
        halo.addColorStop(0.55, "rgba(105,240,174,0.22)");
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(sx, sy, r * 1.35, 0, TAU); ctx.fill();

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(spin);
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#69F0AE", 22);
        ctx.globalAlpha = fade * pulse;

        // Outer arcane ring
        ctx.strokeStyle = "#69F0AE";
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = "rgba(185,246,202,0.85)";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);

        // Hex rune frame
        ctx.fillStyle = "rgba(8,12,10,0.82)";
        ctx.strokeStyle = "#B9F6CA";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + i * TAU / 6;
          const px = Math.cos(a) * r * 0.62;
          const py = Math.sin(a) * r * 0.62;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner sigil — eye + crossing strokes
        ctx.strokeStyle = "#69F0AE";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.28, 0); ctx.lineTo(r * 0.28, 0);
        ctx.moveTo(0, -r * 0.28); ctx.lineTo(0, r * 0.28);
        ctx.moveTo(-r * 0.18, -r * 0.18); ctx.lineTo(r * 0.18, r * 0.18);
        ctx.moveTo(r * 0.18, -r * 0.18); ctx.lineTo(-r * 0.18, r * 0.18);
        ctx.stroke();

        ctx.fillStyle = "#B9F6CA";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.11, 0, TAU); ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, TAU); ctx.stroke();

        // Rune ticks on outer ring
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          const x0 = Math.cos(a) * r * 0.88;
          const y0 = Math.sin(a) * r * 0.88;
          const x1 = Math.cos(a) * r * 1.02;
          const y1 = Math.sin(a) * r * 1.02;
          ctx.strokeStyle = i % 2 === 0 ? "#FFFFFF" : "#69F0AE";
          ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        }
        ctx.restore();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  VERDELETTA SUPER — hell portal ritual (not generic shockwave)
      // ────────────────────────────────────────────────────────────────────
      case "verdelettaSuper": {
        const t = easeOutCubic(lifeT);
        const r = R * (0.35 + t * 2.0);
        const spin = frame * 0.06 + e.seed * 0.001;

        ctx.globalCompositeOperation = "source-over";
        drawUltGroundPad(ctx, sx, sy, r * 1.1, e.color, fade, 0.45);
        ctx.globalAlpha = fade * 0.42;
        const groundDark = ctx.createRadialGradient(sx, sy, r * 0.15, sx, sy, r * 1.15);
        groundDark.addColorStop(0, "rgba(0,0,0,0.88)");
        groundDark.addColorStop(0.5, "rgba(20,8,8,0.55)");
        groundDark.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = groundDark;
        groundEllipsePath(ctx, sx, sy, r * 1.15);
        ctx.fill();

        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        for (let ring = 0; ring < 3; ring++) {
          const rr = r * (0.55 + ring * 0.28);
          ctx.globalAlpha = fade * (0.88 - ring * 0.2);
          ctx.strokeStyle = ring === 0 ? "#B9F6CA" : e.color;
          ctx.lineWidth = (4 - ring) * fade;
          groundEllipsePath(ctx, sx, sy, rr);
          ctx.stroke();
        }

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(spin);
        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = e.secondary || "#1B5E20";
        ctx.lineWidth = 2.2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35 * GROUND_TILT);
          ctx.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05 * GROUND_TILT);
          ctx.stroke();
        }
        ctx.restore();

        ctx.globalAlpha = fade * 0.65;
        const beamW = r * 0.18;
        const beam = ctx.createLinearGradient(sx, sy - r * 1.5, sx, sy + r * 0.2);
        beam.addColorStop(0, "rgba(105,240,174,0)");
        beam.addColorStop(0.35, "rgba(105,240,174,0.45)");
        beam.addColorStop(0.7, "rgba(0,0,0,0.75)");
        beam.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = beam;
        ctx.fillRect(sx - beamW, sy - r * 1.5, beamW * 2, r * 1.7);

        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + spin * 1.4;
          const d = r * (0.45 + Math.sin(frame * 0.2 + i) * 0.12);
          const px = sx + Math.cos(a) * d;
          const py = sy + Math.sin(a) * d * GROUND_TILT - t * (18 + i * 2);
          ctx.globalAlpha = fade * (0.4 + Math.sin(frame * 0.28 + i) * 0.3);
          ctx.fillStyle = i % 3 === 0 ? "#69F0AE" : "#111111";
          ctx.beginPath();
          ctx.moveTo(px, py + 8);
          ctx.quadraticCurveTo(px - 4, py - 6, px, py - 14 - (i % 2) * 3);
          ctx.quadraticCurveTo(px + 4, py - 6, px, py + 8);
          ctx.fill();
        }
        for (let i = 0; i < 5; i++) {
          const ft = ((frame * 0.05 + i * 0.11) % 1);
          const a = (i / 5) * TAU + spin;
          const px = sx + Math.cos(a) * r * (0.3 + ft * 0.65);
          const py = sy + Math.sin(a) * r * (0.3 + ft * 0.65) * GROUND_TILT - ft * 24;
          ctx.globalAlpha = fade * (1 - ft);
          ctx.fillStyle = i % 2 ? "#B9F6CA" : "#69F0AE";
          ctx.beginPath(); ctx.arc(px, py, 1.6 + (1 - ft) * 1.6, 0, TAU); ctx.fill();
        }
        break;
      }

      case "verdelettaMuzzle":
      case "verdelettaShadowMuzzle": {
        const isShadow = e.kind === "verdelettaShadowMuzzle";
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, isShadow ? "#69F0AE" : "#111111", 18);
        ctx.globalAlpha = fade;
        const mg = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 1.6);
        mg.addColorStop(0, isShadow ? "rgba(105,240,174,0.95)" : "rgba(255,255,255,0.85)");
        mg.addColorStop(0.25, isShadow ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.9)");
        mg.addColorStop(0.65, rgba(e.secondary || "#69F0AE", 0.55));
        mg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(sx, sy, R * 1.6, 0, TAU); ctx.fill();
        ctx.strokeStyle = e.secondary || "#69F0AE";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sx, sy, R * 0.62, 0, TAU);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + frame * 0.2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a) * R * 1.1, sy + Math.sin(a) * R * 1.1);
          ctx.stroke();
        }
        break;
      }

      case "verdelettaImpact":
      case "verdelettaShadowImpact": {
        const isShadow = e.kind === "verdelettaShadowImpact";
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, e.color, 18);
        const burstR = R * (0.5 + lifeT * 1.4);
        ctx.globalAlpha = fade;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = isShadow ? 3 : 4.5;
        ctx.beginPath(); ctx.arc(sx, sy, burstR, 0, TAU); ctx.stroke();
        ctx.globalAlpha = fade * 0.7;
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + e.seed * 0.01;
          ctx.strokeStyle = i % 2 ? (e.secondary || "#212121") : e.color;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a) * burstR * 0.9, sy + Math.sin(a) * burstR * 0.9);
          ctx.stroke();
        }
        break;
      }

      case "verdelettaShadowSpawn": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, e.color, 16);
        const t = easeOutCubic(lifeT);
        const r = R * (0.3 + t * 1.2);
        ctx.globalAlpha = fade * 0.9;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3.5 * fade;
        groundEllipsePath(ctx, sx, sy, r);
        ctx.stroke();
        ctx.globalAlpha = fade * 0.45;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        groundEllipsePath(ctx, sx, sy, r * 0.65);
        ctx.fill();
        break;
      }

      case "luminaMuzzle": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#FFD54F", 24);
        ctx.globalAlpha = fade;
        const mg = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 2.2);
        mg.addColorStop(0, "rgba(255,255,255,0.98)");
        mg.addColorStop(0.25, "rgba(255,213,79,0.9)");
        mg.addColorStop(0.65, "rgba(255,193,7,0.4)");
        mg.addColorStop(1, "rgba(255,213,79,0)");
        ctx.fillStyle = mg;
        ctx.beginPath(); ctx.arc(sx, sy, R * 2.2, 0, TAU); ctx.fill();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + frame * 0.12;
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a) * R * 1.4, sy + Math.sin(a) * R * 1.4);
          ctx.stroke();
        }
        break;
      }

      case "luminaBeam": {
        if (e.toX == null || e.toY == null) break;
        const tx = e.toX - camX;
        const ty = e.toY - camY;
        const len = Math.hypot(tx - sx, ty - sy) || 1;
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#FFD54F", 22);
        ctx.lineCap = "round";

        ctx.strokeStyle = "rgba(255,213,79,0.28)";
        ctx.lineWidth = R * 2.8;
        ctx.shadowColor = "#FFD54F";
        ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();

        ctx.strokeStyle = "rgba(255,213,79,0.92)";
        ctx.lineWidth = Math.max(3, R * 0.75);
        ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();

        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = Math.max(1.5, R * 0.28);
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();

        const links = Math.max(3, Math.floor(len / 28));
        for (let i = 0; i <= links; i++) {
          const t = i / links;
          const lx = sx + (tx - sx) * t;
          const ly = sy + (ty - sy) * t;
          ctx.fillStyle = i % 2 === 0 ? "#FFFFFF" : "#FFD54F";
          ctx.beginPath();
          ctx.arc(lx, ly, 2.2, 0, TAU);
          ctx.fill();
        }
        break;
      }

      case "luminaSuperCast": {
        drawUltGroundPad(ctx, sx, sy, R, "#FFD54F", fade, 0.3);
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.globalAlpha = fade;
        const rise = 1 - fade;
        const cy = sy - rise * R * 0.28 - 6;
        const pulse = 0.85 + Math.sin(frame * 0.22) * 0.12;

        const pillar = ctx.createRadialGradient(sx, cy, 0, sx, cy, R * 1.05 * pulse);
        pillar.addColorStop(0, "rgba(255,255,255,0.92)");
        pillar.addColorStop(0.35, "rgba(255,213,79,0.68)");
        pillar.addColorStop(0.75, "rgba(255,193,7,0.2)");
        pillar.addColorStop(1, "rgba(255,213,79,0)");
        ctx.fillStyle = pillar;
        ctx.beginPath(); ctx.arc(sx, cy, R * 1.05 * pulse, 0, TAU); ctx.fill();

        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, cy, R * 0.9 * pulse, 0, TAU); ctx.stroke();

        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + frame * 0.08;
          const rx = sx + Math.cos(a) * R * 0.72;
          const ry = cy + Math.sin(a) * R * 0.72;
          ctx.fillStyle = i % 2 === 0 ? "#FFC107" : "#FFFFFF";
          ctx.beginPath();
          ctx.arc(rx, ry, 2.4, 0, TAU);
          ctx.fill();
        }
        break;
      }

      case "luminaChain": {
        if (e.toX == null || e.toY == null) break;
        const tx = e.toX - camX;
        const ty = e.toY - camY;
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#FFD54F", 16);
        ctx.lineCap = "round";

        ctx.strokeStyle = "rgba(255,213,79,0.35)";
        ctx.lineWidth = R * 0.9;
        ctx.shadowColor = "#FFD54F";
        ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();

        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = Math.max(2, R * 0.22);
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();

        const midX = (sx + tx) * 0.5;
        const midY = (sy + ty) * 0.5;
        const len = Math.hypot(tx - sx, ty - sy) || 1;
        const links = Math.max(2, Math.floor(len / 42));
        for (let i = 0; i <= links; i++) {
          const t = i / links;
          const lx = sx + (tx - sx) * t;
          const ly = sy + (ty - sy) * t;
          const wob = Math.sin(frame * 0.2 + i + e.seed) * 4;
          const nx = -(ty - sy) / len;
          const ny = (tx - sx) / len;
          ctx.fillStyle = i % 2 === 0 ? "#FFD54F" : "#FFFFFF";
          ctx.beginPath();
          ctx.arc(lx + nx * wob, ly + ny * wob, 2.5, 0, TAU);
          ctx.fill();
        }

        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = "#FFC107";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(midX, midY, R * 0.55, 0, TAU); ctx.stroke();
        break;
      }

      case "luminaDome": {
        const cy = sy - 10;
        drawUltGroundPad(ctx, sx, sy, R, "#FFD54F", fade, 0.38);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.28 * fade;
        const floor = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
        floor.addColorStop(0, "rgba(255,213,79,0.65)");
        floor.addColorStop(0.55, "rgba(255,193,7,0.24)");
        floor.addColorStop(1, "rgba(255,152,0,0)");
        ctx.fillStyle = floor;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.fill();

        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.24 * fade;
        const dome = ctx.createRadialGradient(sx, cy - R * 0.25, R * 0.05, sx, cy, R);
        dome.addColorStop(0, "rgba(255,255,255,0.08)");
        dome.addColorStop(0.65, "rgba(255,213,79,0.2)");
        dome.addColorStop(1, "rgba(255,193,7,0.42)");
        ctx.fillStyle = dome;
        ctx.beginPath(); ctx.arc(sx, cy, R, 0, TAU); ctx.fill();

        ctx.strokeStyle = "#FFD54F";
        ctx.lineWidth = 2.6;
        ctx.globalAlpha = (0.82 + Math.sin(frame * 0.14) * 0.08) * fade;
        ctx.beginPath(); ctx.arc(sx, cy, R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(sx, cy, R * 0.97, 0, TAU); ctx.stroke();

        ctx.globalAlpha = fade * 0.65;
        for (let i = 0; i < 5; i++) {
          const a = (i / 8) * TAU + frame * 0.03 + e.seed * 0.001;
          const rx = sx + Math.cos(a) * R * 0.82;
          const ry = cy + Math.sin(a) * R * 0.82;
          ctx.strokeStyle = i % 2 === 0 ? "#FFC107" : "#FFFFFF";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + Math.cos(a + 0.6) * 8, ry + Math.sin(a + 0.6) * 8);
          ctx.stroke();
        }

        ctx.globalAlpha = fade * 0.45;
        ctx.strokeStyle = "rgba(255,235,59,0.85)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.ellipse(sx, cy - R * 0.45, R * 0.96, R * 0.38, 0, 0, TAU);
        ctx.stroke();
        break;
      }

      case "oliverBugLaunch": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#FFB74D", 18);
        ctx.globalAlpha = fade * 0.9;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + frame * 0.15 + e.seed * 0.01;
          const dist = R * (0.35 + (1 - fade) * 0.9);
          const bx = sx + Math.cos(a) * dist;
          const by = sy + Math.sin(a) * dist;
          ctx.fillStyle = i % 2 === 0 ? "#FFD54F" : "#8D6E63";
          ctx.beginPath(); ctx.arc(bx, by, 4 + (1 - fade) * 2, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = "rgba(66,165,245,0.65)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx, sy, R * 0.55, 0, TAU); ctx.stroke();
        break;
      }

      case "oliverBugImpact": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, e.color, 14);
        ctx.globalAlpha = fade;
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(sx, sy, R * (0.5 + (1 - fade)), 0, TAU); ctx.fill();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + e.seed;
          ctx.strokeStyle = e.secondary ?? "#795548";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a) * R * 0.8, sy + Math.sin(a) * R * 0.8);
          ctx.stroke();
        }
        break;
      }

      case "callistaFlaskLaunch": {
        if (e.toX != null && e.toY != null) {
          const tx = e.toX - camX;
          const ty = e.toY - camY;
          const prog = 1 - fade;
          ctx.globalAlpha = fade * 0.55;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo((sx + tx) / 2, (sy + ty) / 2 - 40, tx, ty);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }

      case "callistaFlaskImpact": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, e.color, 16);
        ctx.globalAlpha = fade;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + e.seed;
          ctx.fillStyle = i % 2 === 0 ? e.color : (e.secondary ?? "#FFFFFF");
          ctx.beginPath();
          ctx.arc(sx + Math.cos(a) * R * (0.4 + (1 - fade)), sy + Math.sin(a) * R * (0.4 + (1 - fade)), 3, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath(); ctx.arc(sx, sy, R * 0.35 * fade, 0, TAU); ctx.fill();
        break;
      }

      case "callistaZone":
      case "callistaSuperZone": {
        const multi = e.kind === "callistaSuperZone";
        ctx.globalAlpha = fade * 0.45;
        const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, R);
        g.addColorStop(0, multi ? "rgba(255,213,79,0.55)" : `${e.color}88`);
        g.addColorStop(0.55, multi ? "rgba(171,71,188,0.35)" : `${e.color}33`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.fill();
        ctx.globalAlpha = fade * 0.75;
        ctx.strokeStyle = multi ? "#FFD54F" : e.color;
        ctx.lineWidth = multi ? 2.4 : 1.8;
        groundEllipsePath(ctx, sx, sy, R * 0.92);
        ctx.stroke();
        if (multi) {
          const cols = ["#76FF03", "#81D4FA", "#AB47BC", "#66BB6A"];
          for (let i = 0; i < 4; i++) {
            const a = frame * 0.04 + (i / 4) * TAU;
            ctx.fillStyle = cols[i];
            ctx.beginPath();
            ctx.arc(sx + Math.cos(a) * R * 0.55, sy + Math.sin(a) * R * 0.35, 4, 0, TAU);
            ctx.fill();
          }
        }
        break;
      }

      case "airinCapsuleLaunch": {
        if (e.toX != null && e.toY != null) {
          const tx = e.toX - camX;
          const ty = e.toY - camY;
          ctx.globalAlpha = fade * 0.5;
          ctx.strokeStyle = e.secondary ?? "#37474F";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo((sx + tx) / 2, (sy + ty) / 2 - 42, tx, ty);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }

      case "airinCapsuleImpact": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#78909C", 14);
        ctx.globalAlpha = fade * 0.85;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + e.seed;
          ctx.fillStyle = i % 2 === 0 ? "#558B2F" : "#B0BEC5";
          ctx.beginPath();
          ctx.arc(sx + Math.cos(a) * R * (0.35 + (1 - fade) * 0.5), sy + Math.sin(a) * R * (0.35 + (1 - fade) * 0.5), 2.8, 0, TAU);
          ctx.fill();
        }
        break;
      }

      case "airinSmokeZone":
      case "airinSmokeLinger": {
        const linger = e.kind === "airinSmokeLinger";
        ctx.globalAlpha = fade * (linger ? 0.55 : 0.42);
        const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, R);
        g.addColorStop(0, "rgba(176,190,197,0.55)");
        g.addColorStop(0.45, "rgba(85,139,47,0.35)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.fill();
        ctx.globalAlpha = fade * 0.65;
        for (let i = 0; i < (linger ? 6 : 4); i++) {
          const a = frame * 0.03 + (i / 6) * TAU;
          const wob = Math.sin(frame * 0.08 + i) * 4;
          ctx.fillStyle = `rgba(120,144,156,${0.25 + 0.15 * Math.sin(frame * 0.1 + i)})`;
          ctx.beginPath();
          ctx.arc(sx + Math.cos(a) * R * 0.45 + wob, sy + Math.sin(a) * R * 0.28, linger ? 8 : 6, 0, TAU);
          ctx.fill();
        }
        break;
      }

      case "airinEvacSigil": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#ECEFF1", 24);
        ctx.globalAlpha = fade * 0.9;
        ctx.strokeStyle = "#ECEFF1";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU - Math.PI / 2 + frame * 0.02;
          const x1 = sx + Math.cos(a) * R * 0.35;
          const y1 = sy + Math.sin(a) * R * 0.35;
          const x2 = sx + Math.cos(a) * R * 0.75;
          const y2 = sy + Math.sin(a) * R * 0.75;
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
        }
        ctx.stroke();
        ctx.fillStyle = "rgba(236,239,241,0.75)";
        ctx.beginPath();
        ctx.arc(sx, sy, R * 0.22 * fade, 0, TAU);
        ctx.fill();
        break;
      }

      case "airinEvacSmoke": {
        ctx.globalAlpha = fade * 0.5;
        const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, R);
        g.addColorStop(0, "rgba(207,216,220,0.65)");
        g.addColorStop(0.6, "rgba(84,110,122,0.25)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.fill();
        break;
      }

      case "elianStarLaunch": {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fade * 0.8;
        const tx = (e.toX ?? e.x) - camX;
        const ty = (e.toY ?? e.y) - camY;
        ctx.strokeStyle = "rgba(129,212,250,0.75)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = "rgba(227,242,253,0.9)";
        ctx.beginPath();
        ctx.arc(sx, sy, R * 0.35, 0, TAU);
        ctx.fill();
        break;
      }

      case "elianStarBurst": {
        ctx.globalCompositeOperation = "lighter";
        const t = easeOutCubic(lifeT);
        const r = R * (0.3 + t * 1.4);
        ctx.globalAlpha = fade * 0.75;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(0.35, e.color || "#64B5F6");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, TAU);
        ctx.fill();
        break;
      }

      case "elianVortexBurst": {
        ctx.globalCompositeOperation = "lighter";
        const t = easeOutCubic(lifeT);
        const r = R * (0.35 + t * 1.55);
        ctx.globalAlpha = fade * 0.9;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.25, "#B388FF");
        g.addColorStop(0.5, "#42A5F5");
        g.addColorStop(0.75, "#1565C0");
        g.addColorStop(1, "rgba(255,213,79,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, TAU);
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + frame * 0.05;
          ctx.strokeStyle = "rgba(255,213,79,0.85)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a) * r * 0.9, sy + Math.sin(a) * r * 0.9);
          ctx.stroke();
        }
        break;
      }

      case "elianGravityVortex":
      case "elianMiniVortex": {
        const linger = e.kind === "elianMiniVortex";
        drawUltGroundPad(ctx, sx, sy, R * 1.1, "#42A5F5", fade, linger ? 0.28 : 0.38);
        const spin = frame * 0.09 + lifeT * 8;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(spin);
        ctx.globalAlpha = fade * (linger ? 0.45 : 0.58);
        const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R * 1.15);
        g.addColorStop(0, "rgba(179,136,255,0.9)");
        g.addColorStop(0.3, "rgba(66,165,245,0.65)");
        g.addColorStop(0.55, "rgba(21,101,192,0.42)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        groundEllipsePath(ctx, 0, 0, R * 1.1);
        ctx.fill();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,213,79,0.65)";
        ctx.lineWidth = linger ? 1.4 : 2.2;
        groundEllipsePath(ctx, 0, 0, R * 0.62);
        ctx.stroke();
        for (let i = 0; i < (linger ? 4 : 8); i++) {
          const a = (i / (linger ? 4 : 8)) * TAU;
          ctx.fillStyle = i % 2 ? "#FFD54F" : "#E3F2FD";
          ctx.beginPath();
          ctx.arc(Math.cos(a) * R * 0.4, Math.sin(a) * R * 0.4 * GROUND_TILT, linger ? 1.8 : 3, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
        break;
      }

      case "elianSuperCast": {
        drawUltGroundPad(ctx, sx, sy, R, "#42A5F5", fade, 0.32);
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.globalAlpha = fade * 0.8;
        const pulse = 0.85 + Math.sin(frame * 0.2) * 0.12;
        const g = ctx.createRadialGradient(sx, sy - 8, 2, sx, sy, R * pulse);
        g.addColorStop(0, "rgba(255,255,255,0.92)");
        g.addColorStop(0.45, "rgba(100,181,246,0.5)");
        g.addColorStop(1, "rgba(21,101,192,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy - 6, R * pulse, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,213,79,0.65)";
        ctx.lineWidth = 1.8;
        groundEllipsePath(ctx, sx, sy, R * 0.72 * pulse);
        ctx.stroke();
        break;
      }

      case "silvenVineLaunch": {
        if (e.toX != null && e.toY != null) {
          const tx = e.toX - camX;
          const ty = e.toY - camY;
          ctx.globalAlpha = fade * 0.65;
          ctx.strokeStyle = e.color;
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 6]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          for (let i = 1; i <= 6; i++) {
            const t = i / 6;
            const wob = Math.sin(t * 8 + e.seed) * 8;
            const px = -Math.sin(Math.atan2(ty - sy, tx - sx)) * wob;
            const py = Math.cos(Math.atan2(ty - sy, tx - sx)) * wob;
            ctx.lineTo(sx + (tx - sx) * t + px, sy + (ty - sy) * t + py);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }

      case "silvenVineImpact": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, e.color, 14);
        ctx.globalAlpha = fade;
        for (let i = 0; i < (e.particleCount ?? 8); i++) {
          const a = (i / 8) * TAU + e.seed;
          ctx.fillStyle = i % 2 === 0 ? e.color : (e.secondary ?? "#A5D6A7");
          ctx.beginPath();
          ctx.arc(sx + Math.cos(a) * R * (0.5 + (1 - fade)), sy + Math.sin(a) * R * (0.5 + (1 - fade)), 3, 0, TAU);
          ctx.fill();
        }
        break;
      }

      case "silvenIvyWrap": {
        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2.2;
        for (let i = 0; i < 4; i++) {
          const a = frame * 0.08 + (i / 4) * TAU;
          ctx.beginPath();
          ctx.arc(sx + Math.cos(a) * R * 0.55, sy + Math.sin(a) * R * 0.35, R * 0.35, a, a + Math.PI * 1.2);
          ctx.stroke();
        }
        break;
      }

      case "silvenSuperCast": {
        drawUltGroundPad(ctx, sx, sy, R, e.color, fade, 0.34);
        if (e.toX != null && e.toY != null) {
          const tx = e.toX - camX;
          const ty = e.toY - camY;
          ctx.globalAlpha = fade * 0.6;
          ctx.strokeStyle = e.secondary ?? "#AED581";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.globalAlpha = fade * 0.85;
        const g = ctx.createRadialGradient(sx, sy - 4, 2, sx, sy, R * 1.15);
        g.addColorStop(0, "rgba(174,213,129,0.85)");
        g.addColorStop(0.5, "rgba(67,160,71,0.38)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.fill();
        break;
      }

      case "silvenTreeFade": {
        ctx.globalAlpha = fade * 0.55;
        const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, R);
        g.addColorStop(0, "rgba(189,189,189,0.5)");
        g.addColorStop(0.6, "rgba(129,199,132,0.25)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.fill();
        break;
      }

      case "silvenDryadSpawn":
      case "silvenDryadStrike":
      case "silvenDryadFade": {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fade * 0.8;
        const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, R);
        g.addColorStop(0, "rgba(255,255,255,0.85)");
        g.addColorStop(0.45, rgba(e.color, 0.55 * fade));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, R, 0, TAU);
        ctx.fill();
        break;
      }

      case "vittoriaBiteSlash": {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fade * 0.9;
        ctx.strokeStyle = e.secondary ?? "#FF5252";
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        if (e.toX != null && e.toY != null) {
          const tx = e.toX - camX;
          const ty = e.toY - camY;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
        const slashG = ctx.createRadialGradient(sx, sy, 2, sx, sy, R);
        slashG.addColorStop(0, "rgba(255,82,82,0.85)");
        slashG.addColorStop(0.5, "rgba(183,28,28,0.35)");
        slashG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = slashG;
        ctx.beginPath();
        ctx.arc(sx, sy, R, 0, TAU);
        ctx.fill();
        break;
      }

      case "vittoriaBloodMoon": {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fade * 0.75;
        const moonR = R * (0.95 + Math.sin(frame * 0.06) * 0.05);
        const moonG = ctx.createRadialGradient(sx, sy, moonR * 0.2, sx, sy, moonR);
        moonG.addColorStop(0, "rgba(229,57,53,0.95)");
        moonG.addColorStop(0.55, "rgba(123,31,162,0.55)");
        moonG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = moonG;
        ctx.beginPath();
        ctx.arc(sx, sy, moonR, 0, TAU);
        ctx.fill();
        break;
      }

      case "vittoriaBloodEyes": {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fade * (0.65 + Math.sin(frame * 0.2) * 0.25);
        ctx.fillStyle = "#FF1744";
        ctx.beginPath();
        ctx.arc(sx - R * 0.22, sy - R * 0.05, R * 0.12, 0, TAU);
        ctx.arc(sx + R * 0.22, sy - R * 0.05, R * 0.12, 0, TAU);
        ctx.fill();
        break;
      }

      case "vittoriaNightCurse": {
        ctx.globalAlpha = fade * 0.45;
        const curseG = ctx.createRadialGradient(sx, sy, 2, sx, sy, R * 1.2);
        curseG.addColorStop(0, "rgba(74,20,140,0.55)");
        curseG.addColorStop(0.6, "rgba(136,14,79,0.25)");
        curseG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = curseG;
        groundEllipsePath(ctx, sx, sy, R * 1.2);
        ctx.fill();
        break;
      }

      case "octaviaInkOrb": {
        if (e.toX != null && e.toY != null) {
          const tx = e.toX - camX;
          const ty = e.toY - camY;
          ctx.globalAlpha = fade * 0.55;
          ctx.strokeStyle = e.secondary ?? "#EC407A";
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo((sx + tx) / 2, (sy + ty) / 2 - 36, tx, ty);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = fade * 0.7;
          ctx.fillStyle = "#1A0033";
          groundEllipsePath(ctx, tx, ty, R * 0.45);
          ctx.fill();
          ctx.fillStyle = e.secondary ?? "#EC407A";
          ctx.globalAlpha = fade * 0.35;
          groundEllipsePath(ctx, tx, ty, R * 0.75);
          ctx.fill();
        }
        break;
      }

      case "octaviaInkSplash": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#4A148C", 14);
        ctx.globalAlpha = fade * 0.9;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + e.seed;
          const dist = R * (0.5 + (1 - fade));
          const px = sx + Math.cos(a) * dist;
          const py = sy + Math.sin(a) * dist * GROUND_TILT;
          ctx.fillStyle = i % 2 === 0 ? "#311B92" : (e.secondary ?? "#EC407A");
          groundEllipsePath(ctx, px, py, 4 + (1 - fade) * 3);
          ctx.fill();
        }
        break;
      }

      case "octaviaInkStrip": {
        const ang = e.angle ?? 0;
        const halfL = R;
        const halfW = R * 0.28;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(ang);
        ctx.globalAlpha = fade * 0.5;
        const stripG = ctx.createLinearGradient(-halfL, 0, halfL, 0);
        stripG.addColorStop(0, "rgba(26,0,51,0)");
        stripG.addColorStop(0.2, "rgba(49,27,146,0.75)");
        stripG.addColorStop(0.5, "rgba(123,31,162,0.85)");
        stripG.addColorStop(0.8, "rgba(49,27,146,0.75)");
        stripG.addColorStop(1, "rgba(26,0,51,0)");
        ctx.fillStyle = stripG;
        const hw = halfW * GROUND_TILT;
        ctx.beginPath();
        ctx.moveTo(-halfL, -hw);
        ctx.lineTo(halfL, -hw);
        ctx.lineTo(halfL, hw);
        ctx.lineTo(-halfL, hw);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = fade * 0.7;
        ctx.strokeStyle = e.secondary ?? "#EC407A";
        ctx.lineWidth = 1.6;
        ctx.strokeRect(-halfL * 0.92, -hw * 0.92, halfL * 1.84, hw * 1.84);
        ctx.restore();
        break;
      }

      case "octaviaTentacleBurst": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#EC407A", 18);
        ctx.globalAlpha = fade;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + frame * 0.04;
          const len = R * (0.55 + (1 - fade) * 0.35);
          ctx.strokeStyle = i % 2 === 0 ? "#F48FB1" : "#AD1457";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(
            sx + Math.cos(a) * len * 0.5,
            sy + Math.sin(a) * len * 0.35 - 18,
            sx + Math.cos(a) * len,
            sy + Math.sin(a) * len * 0.45,
          );
          ctx.stroke();
        }
        break;
      }

      case "octaviaTentacleZone": {
        ctx.globalAlpha = fade * 0.35;
        const tg = ctx.createRadialGradient(sx, sy, 2, sx, sy, R);
        tg.addColorStop(0, "rgba(236,64,122,0.45)");
        tg.addColorStop(0.55, "rgba(136,14,79,0.28)");
        tg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = tg;
        groundEllipsePath(ctx, sx, sy, R);
        ctx.fill();
        ctx.globalAlpha = fade * (0.55 + Math.sin(frame * 0.08 + e.seed) * 0.15);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + frame * 0.03 + e.seed;
          ctx.strokeStyle = "#F8BBD0";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * R * 0.15, sy + Math.sin(a) * R * 0.08);
          ctx.quadraticCurveTo(
            sx + Math.cos(a) * R * 0.55,
            sy + Math.sin(a) * R * 0.25 - 10,
            sx + Math.cos(a) * R * 0.85,
            sy + Math.sin(a) * R * 0.35,
          );
          ctx.stroke();
        }
        break;
      }

      case "zephyrinTornadoLaunch":
      case "zephyrinTornadoHit":
      case "zephyrinTornadoFade": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#CFD8DC", 16);
        ctx.globalAlpha = fade * 0.85;
        const spin = frame * 0.22 + e.seed;
        for (let ring = 0; ring < 3; ring++) {
          const rr = R * (0.35 + ring * 0.22);
          const rot = spin + ring * 0.75;
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(rot);
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            ctx.strokeStyle = i % 2 === 0 ? "#FFFFFF" : "#B0BEC5";
            ctx.lineWidth = i === 0 ? 3 : 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(
              Math.cos(a) * rr * 0.45,
              Math.sin(a) * rr * 0.2,
              Math.cos(a + 0.5) * rr * 0.95,
              Math.sin(a + 0.5) * rr * 0.38,
            );
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.globalAlpha = fade * 0.45;
        ctx.fillStyle = "#ECEFF1";
        groundEllipsePath(ctx, sx, sy, R * 0.55);
        ctx.fill();
        break;
      }

      case "zephyrinWhirlwindCast": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#ECEFF1", 14);
        const baseAngle = e.angle ?? 0;
        const spin = frame * 0.28 + e.seed;
        for (let ring = 0; ring < 3; ring++) {
          const rr = R * (0.45 + ring * 0.18) * (0.85 + (1 - fade) * 0.2);
          ctx.globalAlpha = fade * (0.75 - ring * 0.12);
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(spin + ring * 0.9);
          for (let i = 0; i < 5; i++) {
            const a = baseAngle + (i / 5) * TAU;
            ctx.strokeStyle = i % 2 === 0 ? "#FFFFFF" : "#CFD8DC";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(
              Math.cos(a) * rr * 0.35,
              Math.sin(a) * rr * 0.15,
              Math.cos(a + 0.45) * rr,
              Math.sin(a + 0.45) * rr * 0.32,
            );
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.globalAlpha = fade * 0.35;
        ctx.fillStyle = "rgba(236,239,241,0.55)";
        groundEllipsePath(ctx, sx, sy, R * 0.7);
        ctx.fill();
        break;
      }

      case "zephyrinGaleAura": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#E1BEE7", 20);
        const pulse = 0.92 + Math.sin(frame * 0.12 + e.seed) * 0.08;
        ctx.globalAlpha = fade * 0.42;
        const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, R * pulse);
        g.addColorStop(0, "rgba(255,255,255,0.55)");
        g.addColorStop(0.45, "rgba(171,71,188,0.28)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        groundEllipsePath(ctx, sx, sy, R * pulse);
        ctx.fill();
        ctx.globalAlpha = fade * 0.65;
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.8;
        groundEllipsePath(ctx, sx, sy, R * 0.82 * pulse);
        ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = frame * 0.05 + (i / 6) * TAU + e.seed;
          ctx.globalAlpha = fade * 0.35;
          ctx.strokeStyle = "#E1BEE7";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(a) * R * 0.2, sy + Math.sin(a) * R * 0.1);
          ctx.lineTo(sx + Math.cos(a) * R * 0.75, sy + Math.sin(a) * R * 0.35 - 8);
          ctx.stroke();
        }
        break;
      }

      case "zephyrinSuperCast": {
        drawUltGroundPad(ctx, sx, sy, R, "#CE93D8", fade, 0.36);
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.globalAlpha = fade;
        for (let ring = 0; ring < 3; ring++) {
          const rr = R * (0.55 + ring * 0.22) * (1 + (1 - fade) * 0.12);
          ctx.strokeStyle = ring === 0 ? "#FFFFFF" : "#CE93D8";
          ctx.lineWidth = 2.4 - ring * 0.5;
          groundEllipsePath(ctx, sx, sy, rr);
          ctx.stroke();
        }
        ctx.globalAlpha = fade * 0.48;
        ctx.fillStyle = "rgba(255,255,255,0.65)";
        groundEllipsePath(ctx, sx, sy, R * 0.32);
        ctx.fill();
        break;
      }

      case "zephyrinStormBurst": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#E1BEE7", 22);
        ctx.globalAlpha = fade * 0.8;
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU + frame * 0.04;
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a) * R * (0.6 + (1 - fade) * 0.35), sy + Math.sin(a) * R * 0.28);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(225,190,231,0.45)";
        groundEllipsePath(ctx, sx, sy, R * 0.5);
        ctx.fill();
        break;
      }

      case "mirabelSparkCast": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#FFEB3B", 16);
        ctx.globalAlpha = fade;
        const bx = sx + Math.cos(frame * 0.05) * 2;
        const by = sy - R * 0.2;
        ctx.fillStyle = "rgba(255,205,210,0.85)";
        ctx.fillRect(bx - R * 0.55, by, R * 1.1, R * 0.35);
        ctx.fillStyle = "#E53935";
        ctx.fillRect(bx - 2, by - R * 0.05, 4, R * 0.45);
        const spark = ctx.createRadialGradient(bx + R * 0.35, by - R * 0.05, 0, bx + R * 0.35, by - R * 0.05, R * 0.55);
        spark.addColorStop(0, "rgba(255,255,255,0.95)");
        spark.addColorStop(0.4, "rgba(255,235,59,0.9)");
        spark.addColorStop(1, "rgba(255,112,67,0)");
        ctx.fillStyle = spark;
        ctx.beginPath(); ctx.arc(bx + R * 0.35, by - R * 0.05, R * 0.55, 0, TAU); ctx.fill();
        break;
      }

      case "mirabelLearningAura": {
        const headY = sy - R * 1.05;
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#FFEB3B", 14);
        ctx.globalAlpha = fade * 0.9;
        const bob = Math.sin(frame * 0.08) * 3;
        const bookY = headY + bob;
        ctx.fillStyle = "rgba(255,205,210,0.75)";
        ctx.fillRect(sx - R * 0.5, bookY, R, R * 0.38);
        ctx.fillStyle = "#E53935";
        ctx.fillRect(sx - 2, bookY - R * 0.05, 4, R * 0.48);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + frame * 0.06;
          const rx = sx + Math.cos(a) * R * 0.65;
          const ry = bookY + Math.sin(a) * R * 0.22;
          ctx.fillStyle = i % 2 === 0 ? "#FFEB3B" : "#FF7043";
          ctx.beginPath(); ctx.arc(rx, ry, 2.2, 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = "rgba(255,235,59,0.55)";
        ctx.lineWidth = 1.5;
        groundEllipsePath(ctx, sx, sy + 4, R * 0.75);
        ctx.stroke();
        break;
      }

      case "mirabelSuperCast": {
        drawUltGroundPad(ctx, sx, sy, R, "#FFEB3B", fade, 0.28);
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.globalAlpha = fade;
        const rise = 1 - fade;
        const cy = sy - rise * R * 0.35 - 4;
        const pulse = 0.88 + Math.sin(frame * 0.2) * 0.1;
        const pillar = ctx.createRadialGradient(sx, cy, 0, sx, cy, R * 1.1 * pulse);
        pillar.addColorStop(0, "rgba(255,255,255,0.9)");
        pillar.addColorStop(0.35, "rgba(255,235,59,0.65)");
        pillar.addColorStop(0.75, "rgba(229,57,53,0.18)");
        pillar.addColorStop(1, "rgba(255,205,210,0)");
        ctx.fillStyle = pillar;
        ctx.beginPath(); ctx.arc(sx, cy, R * 1.1 * pulse, 0, TAU); ctx.fill();
        ctx.fillStyle = "rgba(255,205,210,0.85)";
        ctx.fillRect(sx - R * 0.58, cy - R * 0.1, R * 1.16, R * 0.38);
        ctx.fillStyle = "#E53935";
        ctx.fillRect(sx - 2, cy - R * 0.18, 4, R * 0.5);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + frame * 0.07;
          ctx.fillStyle = i % 2 === 0 ? "#FFEB3B" : "#FF7043";
          ctx.beginPath();
          ctx.arc(sx + Math.cos(a) * R * 0.75, cy + Math.sin(a) * R * 0.75, 2.2, 0, TAU);
          ctx.fill();
        }
        break;
      }

      case "oliverReplicator": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#42A5F5", 22);
        ctx.globalAlpha = fade * 0.85;
        const pulse = 0.9 + Math.sin(frame * 0.25) * 0.1;
        const g = ctx.createRadialGradient(sx, sy - 8, 2, sx, sy, R * pulse);
        g.addColorStop(0, "rgba(255,255,255,0.9)");
        g.addColorStop(0.4, "rgba(66,165,245,0.55)");
        g.addColorStop(1, "rgba(255,213,79,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, R * pulse, 0, TAU); ctx.fill();

        ctx.strokeStyle = "#FFD54F";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy - 6, R * 0.55 * pulse, 0, TAU); ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU - frame * 0.06;
          ctx.fillStyle = i % 2 === 0 ? "#FFB74D" : "#42A5F5";
          ctx.fillRect(sx + Math.cos(a) * R * 0.72 - 2, sy + Math.sin(a) * R * 0.72 - 2, 4, 4);
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  POISON AURA — зелёный токсичный туман поверх отравленного
      // ────────────────────────────────────────────────────────────────────
      case "poisonAura": {
        // 1. Ground-пятно — ИМЕННО эллипс (раньше был ctx.arc — стояло вертикально, неверный наклон)
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.32 + Math.sin(frame * 0.12) * 0.1;
        const fg = ctx.createRadialGradient(sx, sy + 4, 0, sx, sy + 4, R);
        fg.addColorStop(0, "rgba(129,199,132,0.78)");
        fg.addColorStop(0.55, "rgba(76,175,80,0.4)");
        fg.addColorStop(1, "rgba(27,94,32,0)");
        ctx.fillStyle = fg;
        groundEllipsePath(ctx, sx, sy + 4, R);
        ctx.fill();

        // 2. Тонкое зелёное кольцо-индикатор
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.7;
        applyVfxShadow(ctx, "#69F0AE", 10);
        ctx.strokeStyle = "rgba(118,255,3,0.9)"; ctx.lineWidth = 1.8;
        groundEllipsePath(ctx, sx, sy + 4, R * 0.95);
        ctx.stroke();

        // 3. 5 пузырей поднимаются (вместо 8, без блика)
        for (let i = 0; i < 5; i++) {
          const t = (frame * 0.022 + i * 0.2) % 1;
          const a = (i / 5) * TAU + e.seed * 0.001;
          const px = sx + Math.cos(a) * R * 0.4 + Math.sin(t * 6 + i) * 2;
          const py = sy - 4 - t * R * 0.85;
          ctx.globalAlpha = (1 - t) * 0.85;
          ctx.fillStyle = "rgba(118,255,3,0.92)";
          ctx.shadowBlur = 6;
          ctx.beginPath(); ctx.arc(px, py, 2.2 + srand(e.seed, i) * 1.1, 0, TAU); ctx.fill();
        }

        // 4. Маленькая капля-«пузырёк» над головой (заменяет череп — легче и не лезет)
        ctx.globalAlpha = 0.7 + Math.sin(frame * 0.2) * 0.2;
        const dropY = sy - R * 0.95 + Math.sin(frame * 0.15) * 2;
        const dropG = ctx.createRadialGradient(sx, dropY, 0, sx, dropY, 4);
        dropG.addColorStop(0, "rgba(255,255,255,0.9)");
        dropG.addColorStop(0.5, "rgba(118,255,3,0.9)");
        dropG.addColorStop(1, "rgba(46,125,50,0.4)");
        ctx.fillStyle = dropG;
        ctx.beginPath(); ctx.ellipse(sx, dropY, 2.6, 3.8, 0, 0, TAU); ctx.fill();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  VULNERABLE AURA — фиолетовая «треснутая» цель-маркировка
      // ────────────────────────────────────────────────────────────────────
      case "vulnerableAura": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#BA68C8", 14);

        // Дальномерное dash-кольцо у ног (одно)
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = "rgba(186,104,200,0.95)"; ctx.lineWidth = 2;
        ctx.setLineDash([10, 6]);
        ctx.lineDashOffset = -frame * 1.6;
        groundEllipsePath(ctx, sx, sy + 4, R);
        ctx.stroke();
        ctx.setLineDash([]); ctx.lineDashOffset = 0;

        // Целеуказатель над головой (крест с точкой)
        const tx = sx, ty = sy - R * 1.0;
        ctx.strokeStyle = "rgba(186,104,200,0.95)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tx - 8, ty); ctx.lineTo(tx + 8, ty);
        ctx.moveTo(tx, ty - 8); ctx.lineTo(tx, ty + 8);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(tx, ty, 4, 0, TAU); ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(tx, ty, 1.4, 0, TAU); ctx.fill();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  SPEED AURA — бирюзовые шлейфы скорости у ног (баф скорости)
      // ────────────────────────────────────────────────────────────────────
      case "speedAura": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#00E5FF", 12);

        // 2 расходящиеся ground-волны
        for (let i = 0; i < 2; i++) {
          const t = (frame * 0.045 + i * 0.5) % 1;
          const rr = R * (0.4 + t * 0.95);
          ctx.globalAlpha = (1 - t) * 0.65;
          ctx.strokeStyle = "rgba(0,229,255,0.95)";
          ctx.lineWidth = 1.8;
          groundEllipsePath(ctx, sx, sy + 4, rr);
          ctx.stroke();
        }

        // Шлейф-«ветер» позади (5 шт, вместо 12)
        const facing = e.followBrawler?.moveAngle ?? 0;
        const back = facing + Math.PI;
        for (let i = 0; i < 5; i++) {
          const t = (frame * 0.06 + i * 0.2) % 1;
          const off = i * 6;
          const dx = Math.cos(back) * (10 + t * 28 + off);
          const dy = Math.sin(back) * (10 + t * 28 + off);
          const px = sx + dx;
          const py = sy + dy + Math.sin(i + frame * 0.12) * 3;
          ctx.globalAlpha = (1 - t) * 0.7;
          ctx.strokeStyle = i % 2 === 0 ? "rgba(0,229,255,0.95)" : "rgba(178,235,242,0.9)";
          ctx.lineWidth = 1.6;
          ctx.lineCap = "round";
          const len = 12;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - Math.cos(back) * len, py - Math.sin(back) * len);
          ctx.stroke();
        }

        // 3 искры по орбите вокруг бойца (вместо 5)
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU + frame * 0.08;
          const r0 = R * 0.45 + Math.sin(frame * 0.2 + i) * 3;
          const px = sx + Math.cos(a) * r0;
          const py = sy - R * 0.3 + Math.sin(a) * r0 * 0.45;
          ctx.fillStyle = "rgba(178,235,242,0.95)";
          applyVfxShadow(ctx, "#00E5FF", 5);
          ctx.beginPath(); ctx.arc(px, py, 1.4, 0, TAU); ctx.fill();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  DAMAGE AURA — баф силы (упрощённый)
      // ────────────────────────────────────────────────────────────────────
      case "damageAura": {
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#FF1744", 16);

        // Ground angry circle
        ctx.globalAlpha = 0.5 + Math.sin(frame * 0.2) * 0.12;
        const fg = ctx.createRadialGradient(sx, sy + 4, R * 0.1, sx, sy + 4, R);
        fg.addColorStop(0, "rgba(255,23,68,0.55)");
        fg.addColorStop(0.6, "rgba(213,0,0,0.25)");
        fg.addColorStop(1, "rgba(74,0,0,0)");
        ctx.fillStyle = fg;
        groundEllipsePath(ctx, sx, sy + 4, R);
        ctx.fill();

        // 6 «клыков»-всплесков (вместо 10)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + frame * 0.07;
          const r0 = R * 0.5;
          const r1 = R * (0.88 + Math.sin(frame * 0.32 + i) * 0.15);
          const px0 = sx + Math.cos(a) * r0;
          const py0 = sy + Math.sin(a) * r0 * GROUND_TILT;
          const px1 = sx + Math.cos(a) * r1;
          const py1 = sy + Math.sin(a) * r1 * GROUND_TILT;
          ctx.strokeStyle = "rgba(255,82,82,0.95)";
          ctx.lineWidth = 2.4;
          ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(px0, py0); ctx.lineTo(px1, py1); ctx.stroke();
        }

        // Внутреннее «дыхание»-кольцо
        ctx.globalAlpha = 0.5 + Math.sin(frame * 0.3) * 0.18;
        ctx.strokeStyle = "rgba(255,82,82,0.9)"; ctx.lineWidth = 1.6;
        groundEllipsePath(ctx, sx, sy + 4, R * 0.65);
        ctx.stroke();
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  RELOAD AURA — жёлтые шестерёнки-ускорение перезарядки
      // ────────────────────────────────────────────────────────────────────
      case "reloadAura": {
        const headY = sy - R * 0.95;
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#FFD740", 18);

        // Ground-волны (быстрые, частые)
        for (let i = 0; i < 3; i++) {
          const t = (frame * 0.03 + i * 0.33) % 1;
          const rr = R * (0.35 + t * 0.85);
          ctx.globalAlpha = (1 - t) * 0.78;
          ctx.strokeStyle = "rgba(255,215,64,0.95)";
          ctx.lineWidth = 2;
          groundEllipsePath(ctx, sx, sy + 4, rr);
          ctx.stroke();
        }

        // 3 шестерёнки у головы (разные направления вращения)
        for (let g = 0; g < 3; g++) {
          const a = (g / 3) * TAU + frame * 0.05;
          const dist = R * 0.6;
          const gx = sx + Math.cos(a) * dist;
          const gy = headY + Math.sin(a) * dist * 0.45;
          ctx.save();
          ctx.translate(gx, gy);
          ctx.rotate(frame * (0.07 + g * 0.025) * (g % 2 === 0 ? 1 : -1));
          ctx.globalAlpha = 0.92;
          // Корпус шестерёнки
          const teeth = 10;
          const rIn = 4, rOut = 6.5;
          ctx.fillStyle = "#FFD740";
          applyVfxShadow(ctx, "#FF9800", 12);
          ctx.beginPath();
          for (let k = 0; k < teeth * 2; k++) {
            const ang = (k / (teeth * 2)) * TAU;
            const r = k % 2 === 0 ? rOut : rIn;
            ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
          }
          ctx.closePath(); ctx.fill();
          // Внутреннее тёмное кольцо
          ctx.fillStyle = "#FF6F00";
          ctx.beginPath(); ctx.arc(0, 0, rIn * 0.6, 0, TAU); ctx.fill();
          // Центральный болт
          ctx.fillStyle = "#FFFDE7";
          ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, TAU); ctx.fill();
          // 4 спицы внутри
          ctx.strokeStyle = "#FF8F00"; ctx.lineWidth = 1.4;
          for (let s = 0; s < 4; s++) {
            const sa = (s / 4) * TAU;
            ctx.beginPath();
            ctx.moveTo(Math.cos(sa) * 1.5, Math.sin(sa) * 1.5);
            ctx.lineTo(Math.cos(sa) * rIn * 0.85, Math.sin(sa) * rIn * 0.85);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Бегущие «спид-линии» по бокам (имитация быстрой перезарядки)
        ctx.globalAlpha = 0.7;
        for (let side = -1; side <= 1; side += 2) {
          const xx = sx + side * R * 0.85;
          ctx.strokeStyle = "rgba(255,215,64,0.85)";
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 3; i++) {
            const t = (frame * 0.06 + i * 0.33) % 1;
            const yy = sy - R * 0.5 + t * R * 0.9;
            ctx.beginPath();
            ctx.moveTo(xx, yy - 5);
            ctx.lineTo(xx, yy + 5);
            ctx.stroke();
          }
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  SUPER READY STARS — ★ NEW: вращающиеся жёлтые звёзды над бойцом,
      //  у которого готов супер. Brawl-Stars-style индикатор. 3 звезды
      //  по горизонтальной орбите (правильно сплющенной под камеру),
      //  пульсируют и вращаются.
      // ────────────────────────────────────────────────────────────────────
      case "superReadyStars": {
        // Orbital ring остаётся НАД ГОЛОВОЙ. Сжатие подбираем так же, как
        // у `drawConstellationOrbit` в Brawler: в 3D-режиме боя team-ring под
        // бойцом виден как RingGeometry под ortho-камерой с компенсацией
        // (≈ полный круг), поэтому орбита — тоже круг (TILT = 1.0). В 2D
        // fallback используется обычный ground-tilt.
        const headY = sy - R * 1.05;
        const breathe = 0.85 + Math.sin(frame * 0.2) * 0.15;
        const rx = R * 0.7;
        const ry = rx * GROUND_TILT;

        // Полу-кольцо: задняя дуга (через destination-over — уходит за бойца)
        ctx.save();
        ctx.globalCompositeOperation = "destination-over";
        applyVfxShadow(ctx, "#FFD740", 8);
        ctx.globalAlpha = 0.3 * breathe;
        ctx.strokeStyle = "rgba(255,215,64,0.75)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(sx, headY, rx, ry, 0, Math.PI, TAU);
        ctx.stroke();
        ctx.restore();

        // Передняя дуга — обычным проходом
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, "#FFD740", 12);
        ctx.globalAlpha = 0.35 * breathe;
        ctx.strokeStyle = "rgba(255,215,64,0.85)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(sx, headY, rx, ry, 0, 0, Math.PI);
        ctx.stroke();

        // 3 звезды по орбите — все одинаково яркие (без затемнения «задних»)
        const n = 3;
        const drawStar = (px: number, py: number, sc: number) => {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          applyVfxShadow(ctx, "#FFAB00", 14);
          ctx.globalAlpha = breathe;
          ctx.translate(px, py);
          ctx.rotate(frame * 0.04 + e.seed * 0.001);
          ctx.fillStyle = "#FFEB3B";
          ctx.beginPath();
          for (let k = 0; k < 5; k++) {
            const ang = (k / 5) * TAU - Math.PI / 2;
            ctx.lineTo(Math.cos(ang) * 5.5 * sc, Math.sin(ang) * 5.5 * sc);
            const ang2 = ang + Math.PI / 5;
            ctx.lineTo(Math.cos(ang2) * 2.4 * sc, Math.sin(ang2) * 2.4 * sc);
          }
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#FF6F00";
          ctx.lineWidth = 0.9;
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.arc(0, 0, 1.6 * sc, 0, TAU);
          ctx.fill();
          ctx.restore();
        };

        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + frame * 0.1;
          const px = sx + Math.cos(a) * rx;
          const py = headY + Math.sin(a) * ry;
          const sc = 1.4 + Math.sin(frame * 0.35 + i) * 0.18;
          drawStar(px, py, sc);
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  SHIELD HP — ★ NEW: маленький щит-индикатор с числом HP над бойцом.
      //  Показывает оставшееся `tempShieldHp`. Тонкий, не закрывает бойца.
      // ────────────────────────────────────────────────────────────────────
      case "shieldHP": {
        const hp = Math.max(0, Math.round(e.value ?? 0));
        if (hp <= 0) break;
        const iconY = sy - R * 1.25;
        const pulse = 0.88 + Math.sin(frame * 0.2) * 0.12;
        ctx.globalCompositeOperation = "source-over";

        // 1. Лёгкий ground-halo (показывает что щит активен)
        ctx.globalAlpha = 0.25;
        applyVfxShadow(ctx, "#80D8FF", 10);
        ctx.strokeStyle = "rgba(128,216,255,0.85)"; ctx.lineWidth = 1.5;
        groundEllipsePath(ctx, sx, sy + 4, R * 0.85);
        ctx.stroke();

        // 2. Иконка щита — голубой shield-shape с обводкой
        const sw = 11, sh = 13;
        const shieldX = sx, shieldY = iconY;
        ctx.shadowBlur = 6;
        ctx.globalAlpha = pulse;
        // Тёмная подложка
        ctx.fillStyle = "rgba(13,71,161,0.92)";
        ctx.beginPath();
        ctx.moveTo(shieldX, shieldY - sh * 0.55);
        ctx.lineTo(shieldX + sw * 0.55, shieldY - sh * 0.3);
        ctx.lineTo(shieldX + sw * 0.55, shieldY + sh * 0.1);
        ctx.quadraticCurveTo(shieldX + sw * 0.4, shieldY + sh * 0.55, shieldX, shieldY + sh * 0.7);
        ctx.quadraticCurveTo(shieldX - sw * 0.4, shieldY + sh * 0.55, shieldX - sw * 0.55, shieldY + sh * 0.1);
        ctx.lineTo(shieldX - sw * 0.55, shieldY - sh * 0.3);
        ctx.closePath();
        ctx.fill();
        // Светлая верхняя половина (даёт «3D»-объём)
        ctx.fillStyle = "rgba(128,216,255,0.95)";
        ctx.beginPath();
        ctx.moveTo(shieldX, shieldY - sh * 0.55);
        ctx.lineTo(shieldX + sw * 0.55, shieldY - sh * 0.3);
        ctx.lineTo(shieldX + sw * 0.55, shieldY);
        ctx.lineTo(shieldX - sw * 0.55, shieldY);
        ctx.lineTo(shieldX - sw * 0.55, shieldY - sh * 0.3);
        ctx.closePath();
        ctx.fill();
        // Обводка
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(shieldX, shieldY - sh * 0.55);
        ctx.lineTo(shieldX + sw * 0.55, shieldY - sh * 0.3);
        ctx.lineTo(shieldX + sw * 0.55, shieldY + sh * 0.1);
        ctx.quadraticCurveTo(shieldX + sw * 0.4, shieldY + sh * 0.55, shieldX, shieldY + sh * 0.7);
        ctx.quadraticCurveTo(shieldX - sw * 0.4, shieldY + sh * 0.55, shieldX - sw * 0.55, shieldY + sh * 0.1);
        ctx.lineTo(shieldX - sw * 0.55, shieldY - sh * 0.3);
        ctx.closePath();
        ctx.stroke();

        // 3. Число HP справа от иконки
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const txt = String(hp);
        const textX = shieldX + sw * 0.7;
        // Контур текста
        ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.lineWidth = 3;
        ctx.strokeText(txt, textX, shieldY);
        ctx.fillStyle = "#80D8FF";
        ctx.fillText(txt, textX, shieldY);
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  RESPAWN BEAM — вертикальный луч-возрождение
      // ────────────────────────────────────────────────────────────────────
      case "respawnBeam": {
        const beamH = R * 5.5;
        const top = sy - beamH;
        const t = lifeT;
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, e.color, 36);

        // Широкая шапка-«источник света» наверху (как если бы свет шёл из неба)
        ctx.globalAlpha = fade * 0.65;
        const sky = ctx.createRadialGradient(sx, top, 0, sx, top, R * 1.2);
        sky.addColorStop(0, `rgba(255,255,255,${0.85 * fade})`);
        sky.addColorStop(0.6, rgba(lighten(e.color, 0.5), 0.55 * fade));
        sky.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sky;
        ctx.beginPath(); ctx.arc(sx, top, R * 1.2, 0, TAU); ctx.fill();

        // Широкий световой столб (трапеция)
        ctx.globalAlpha = fade * 0.85;
        const beam = ctx.createLinearGradient(sx, top, sx, sy);
        beam.addColorStop(0, rgba(e.color, 0));
        beam.addColorStop(0.35, rgba(lighten(e.color, 0.5), 0.45));
        beam.addColorStop(0.85, rgba(e.color, 0.78));
        beam.addColorStop(1, "rgba(255,255,255,0.92)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.65, top);
        ctx.lineTo(sx + R * 0.65, top);
        ctx.lineTo(sx + R * 1.05, sy + 2);
        ctx.lineTo(sx - R * 1.05, sy + 2);
        ctx.closePath(); ctx.fill();

        // Ярко-белый core-столб
        ctx.globalAlpha = fade;
        const core = ctx.createLinearGradient(sx, top, sx, sy);
        core.addColorStop(0, "rgba(255,255,255,0)");
        core.addColorStop(0.55, "rgba(255,255,255,0.75)");
        core.addColorStop(1, "rgba(255,255,255,1)");
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.2, top);
        ctx.lineTo(sx + R * 0.2, top);
        ctx.lineTo(sx + R * 0.32, sy + 2);
        ctx.lineTo(sx - R * 0.32, sy + 2);
        ctx.closePath(); ctx.fill();

        // Бегущие искры внутри столба (10 шт, вместо 18)
        for (let i = 0; i < 10; i++) {
          const pt = ((frame * 0.028 + i * 0.28 + srand(e.seed, i) * 0.5) % 1);
          const ox = (srand(e.seed, i + 99) - 0.5) * R * 0.7;
          const px = sx + ox;
          const py = sy - pt * beamH;
          ctx.globalAlpha = fade * (1 - pt) * 0.9;
          ctx.fillStyle = i % 2 === 0 ? "#FFFFFF" : lighten(e.color, 0.5);
          ctx.beginPath(); ctx.arc(px, py, 1.6 + srand(e.seed, i) * 1.2, 0, TAU); ctx.fill();
        }

        // Ground ring (расширяется)
        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = lighten(e.color, 0.3); ctx.lineWidth = 2.4;
        groundEllipsePath(ctx, sx, sy + 4, R * (0.75 + t * 0.7));
        ctx.stroke();

        // 3 рунические эллипса вокруг столба (вместо 5)
        for (let k = 0; k < 3; k++) {
          const yy = sy - (k + 1) * R * 1.2;
          const a = frame * 0.025 + k;
          ctx.strokeStyle = rgba(e.color, 0.7);
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.ellipse(sx, yy, R * (0.42 + Math.sin(a) * 0.06), R * 0.12, 0, 0, TAU);
          ctx.stroke();
        }
        break;
      }

      // ────────────────────────────────────────────────────────────────────
      //  REVIVE COLUMN — phoenix-style возрождение (более «фейерверочное»)
      // ────────────────────────────────────────────────────────────────────
      case "reviveColumn": {
        const beamH = R * 6;
        const top = sy - beamH;
        ctx.globalCompositeOperation = "lighter";
        applyVfxShadow(ctx, e.color, 40);

        // Золотой пылающий столб
        ctx.globalAlpha = fade;
        const beam = ctx.createLinearGradient(sx, top, sx, sy);
        beam.addColorStop(0, "rgba(255,255,200,0)");
        beam.addColorStop(0.35, rgba(lighten(e.color, 0.5), 0.7));
        beam.addColorStop(0.8, rgba(e.color, 0.9));
        beam.addColorStop(1, "rgba(255,255,255,1)");
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(sx - R * 0.5, top);
        ctx.lineTo(sx + R * 0.5, top);
        ctx.lineTo(sx + R * 1.2, sy + 2);
        ctx.lineTo(sx - R * 1.2, sy + 2);
        ctx.closePath(); ctx.fill();

        // Феникс-«крылья» сверху столба
        ctx.globalAlpha = fade * 0.85;
        for (let side = -1; side <= 1; side += 2) {
          const wx = sx;
          const wy = top + R * 1.2;
          ctx.fillStyle = rgba(lighten(e.color, 0.4), 0.85);
          applyVfxShadow(ctx, e.color, 18);
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          // 4 пера-сегмента
          for (let f = 0; f < 4; f++) {
            const fL = R * (1.3 + f * 0.3);
            const fA = -Math.PI / 6 - f * 0.18;
            const tx = wx + side * Math.cos(fA) * fL;
            const ty = wy + Math.sin(fA) * fL;
            const cx = wx + side * Math.cos(fA - 0.1) * fL * 0.6;
            const cy = wy + Math.sin(fA - 0.1) * fL * 0.6;
            ctx.quadraticCurveTo(cx, cy, tx, ty);
          }
          // обратный путь
          for (let f = 3; f >= 0; f--) {
            const fL = R * (1.2 + f * 0.3);
            const fA = -Math.PI / 6 - f * 0.18 + 0.06;
            const tx = wx + side * Math.cos(fA) * fL;
            const ty = wy + Math.sin(fA) * fL;
            ctx.lineTo(tx, ty);
          }
          ctx.closePath(); ctx.fill();
        }

        // 14 «перьев» феникса по кругу у ног
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU + frame * 0.07;
          const r0 = R * 0.42, r1 = R * (1.15 + Math.sin(frame * 0.22 + i) * 0.18);
          const x0 = sx + Math.cos(a) * r0;
          const y0 = sy + Math.sin(a) * r0 * GROUND_TILT;
          const x1 = sx + Math.cos(a) * r1;
          const y1 = sy + Math.sin(a) * r1 * GROUND_TILT;
          ctx.strokeStyle = i % 2 === 0 ? "#FFFDE7" : lighten(e.color, 0.4);
          ctx.lineWidth = 2.6;
          ctx.lineCap = "round";
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          // мини-сферка на конце пера
          ctx.fillStyle = lighten(e.color, 0.5);
          ctx.beginPath(); ctx.arc(x1, y1, 2, 0, TAU); ctx.fill();
        }

        // Ground shockwave (расширяется)
        const t = easeOutCubic(lifeT);
        ctx.globalAlpha = fade * 0.95;
        ctx.strokeStyle = lighten(e.color, 0.5);
        ctx.lineWidth = 4.5 + (1 - t) * 3;
        groundEllipsePath(ctx, sx, sy + 4, R * (0.6 + t * 1.5));
        ctx.stroke();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.8;
        groundEllipsePath(ctx, sx, sy + 4, R * (0.5 + t * 1.3));
        ctx.stroke();

        // Эмберы поднимаются вверх по столбу
        for (let i = 0; i < 20; i++) {
          const pt = ((frame * 0.025 + i * 0.13 + srand(e.seed, i) * 0.4) % 1);
          const ox = (srand(e.seed, i + 23) - 0.5) * R * 0.9;
          const px = sx + ox + Math.sin(pt * 8 + i) * 3;
          const py = sy - pt * beamH;
          ctx.globalAlpha = fade * (1 - pt) * 0.95;
          ctx.fillStyle = i % 2 === 0 ? "#FFFFFF" : lighten(e.color, 0.4);
          applyVfxShadow(ctx, e.color, 10);
          ctx.beginPath(); ctx.arc(px, py, 1.8 + srand(e.seed, i + 17) * 1.5, 0, TAU); ctx.fill();
        }
        break;
      }
    }

    ctx.restore();
  }

  renderOliverBugs(ctx, camX, camY, frame);
  renderCallistaFlasks(ctx, camX, camY, frame);
  renderOctaviaOrbs(ctx, camX, camY, frame);
  renderZephyrinTornados(ctx, camX, camY, frame);
  renderAirinCapsules(ctx, camX, camY, frame);
  renderElianOrbs(ctx, camX, camY, frame);
  renderElianVortexes(ctx, camX, camY, frame);
  renderSilvenVines(ctx, camX, camY, frame);
  renderSilvenTrees(ctx, camX, camY, frame, viewerTeam);
  renderSilvenDryads(ctx, camX, camY, frame);
  renderMotionTrailsAir(ctx, camX, camY);
}

registerVerdelettaShadowEffectSpawner(spawnEffect);
registerOliverBugVfx((eff) => {
  spawnEffect({ ...eff, kind: eff.kind as EffectKind });
});
