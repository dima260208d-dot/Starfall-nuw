import type { Brawler } from "../entities/Brawler";
import type { Projectile } from "../entities/Projectile";
import { createProjectile } from "../entities/Projectile";
import { spawnEffect } from "./effects";
import { distance, clamp } from "./helpers";
import { getScaledStats } from "../entities/BrawlerData";

const ALLY_CD_RADIUS = 100;
const SUPER_RADIUS_DEFAULT = 500;
const LEARNING_DURATION = 5;

export function mirabelSparkDamage(owner: Brawler): number {
  const stars = new Set(owner.constellationStars || []);
  const base = getScaledStats(owner.stats, owner.level).attackDamage;
  return base + (stars.has(1) ? 350 : 0);
}

export function mirabelAllyCooldownReduction(owner: Brawler): number {
  const stars = new Set(owner.constellationStars || []);
  return stars.has(2) ? 0.5 : 0.3;
}

export function mirabelSuperRadius(owner: Brawler, mapW: number, mapH: number): number {
  const stars = new Set(owner.constellationStars || []);
  if (stars.has(3)) return Math.hypot(mapW, mapH) + 200;
  return SUPER_RADIUS_DEFAULT;
}

export function mirabelLearningAttackCount(owner: Brawler): number {
  const stars = new Set(owner.constellationStars || []);
  return stars.has(4) ? 2 : 1;
}

function mirabelLearningSpeedBonus(owner: Brawler): number {
  const stars = new Set(owner.constellationStars || []);
  return stars.has(5) ? 0.2 : 0;
}

function mirabelLearningDamageBonus(owner: Brawler): number {
  const stars = new Set(owner.constellationStars || []);
  return stars.has(6) ? 0.15 : 0;
}

export function tickMirabelLearning(b: Brawler, dt: number): void {
  if (b.mirabelLearningTimer <= 0) return;
  b.mirabelLearningTimer -= dt;
  if (b.mirabelLearningTimer <= 0) {
    b.mirabelLearningAttacksLeft = 0;
    b.mirabelLearningDamageMult = 1;
    b.statusEffects = b.statusEffects.filter(e => e.type !== "speedBoost" || e.value < 0.19);
  }
}

export function applyMirabelAllyCooldownNearHit(
  attacker: Brawler,
  victim: Brawler,
  allies: Brawler[],
): void {
  if (attacker.stats.id !== "mirabel" || !victim.alive) return;
  const reduce = mirabelAllyCooldownReduction(attacker);
  for (const ally of allies) {
    if (!ally.alive || ally.team !== attacker.team) continue;
    if (distance(ally.x, ally.y, victim.x, victim.y) > ALLY_CD_RADIUS) continue;
    ally.reduceAttackCooldown(reduce);
  }
}

function consumeMirabelLearningCharge(owner: Brawler): void {
  if (owner.mirabelLearningAttacksLeft <= 0) return;
  owner.mirabelLearningAttacksLeft--;
  if (owner.mirabelLearningAttacksLeft <= 0) {
    owner.mirabelLearningTimer = 0;
    owner.mirabelLearningDamageMult = 1;
    owner.statusEffects = owner.statusEffects.filter(e => e.type !== "speedBoost" || e.value < 0.19);
  }
}

export function expandMirabelLearningVolley(
  owner: Brawler,
  projs: ReturnType<typeof createProjectile>[],
): ReturnType<typeof createProjectile>[] {
  if (owner.mirabelLearningAttacksLeft <= 0 || projs.length === 0) return projs;
  consumeMirabelLearningCharge(owner);
  const spread = 0.08;
  const dup: ReturnType<typeof createProjectile>[] = [];
  for (const p of projs) {
    const baseAng = Math.atan2(p.vy, p.vx);
    const spd = Math.hypot(p.vx, p.vy) || p.speed;
    const a = baseAng + spread;
    dup.push(createProjectile({
      x: p.x,
      y: p.y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      radius: p.radius,
      damage: p.damage,
      speed: p.speed,
      range: p.range,
      ownerId: p.ownerId,
      ownerTeam: p.ownerTeam,
      color: p.color,
      type: p.type,
      piercing: p.piercing,
      poison: p.poison,
      slow: p.slow,
      explosionRadius: p.explosionRadius,
    }));
  }
  return [...projs, ...dup];
}

export function fireMirabelSparkAttack(
  owner: Brawler,
  angle: number,
): ReturnType<typeof createProjectile>[] {
  const dmg = Math.floor(mirabelSparkDamage(owner) * (owner.mirabelLearningDamageMult || 1));
  const range = owner.stats.attackRange;
  const spd = 520;
  const a = angle;
  spawnEffect({
    kind: "mirabelSparkCast",
    x: owner.x + Math.cos(a) * 12,
    y: owner.y + Math.sin(a) * 12 - 10,
    radius: 20,
    color: "#FFEB3B",
    secondary: "#E53935",
    timer: 0.42,
    maxTimer: 0.42,
    followBrawler: owner,
  });
  const base = createProjectile({
    x: owner.x + Math.cos(a) * 18,
    y: owner.y + Math.sin(a) * 18 - 8,
    vx: Math.cos(a) * spd,
    vy: Math.sin(a) * spd,
    radius: 7,
    damage: dmg,
    speed: spd,
    range,
    ownerId: owner.id,
    ownerTeam: owner.team,
    color: "#FFEB3B",
    type: "mirabelSpark",
    piercing: false,
  });
  return expandMirabelLearningVolley(owner, [base]);
}

export function activateMirabelAcceleratedLearning(
  caster: Brawler,
  allies: Brawler[],
  mapW: number,
  mapH: number,
): void {
  const radius = mirabelSuperRadius(caster, mapW, mapH);
  const attacks = mirabelLearningAttackCount(caster);
  const speedBonus = mirabelLearningSpeedBonus(caster);
  const damageMult = 1 + mirabelLearningDamageBonus(caster);

  for (const ally of allies) {
    if (!ally.alive || ally.team !== caster.team) continue;
    if (distance(caster.x, caster.y, ally.x, ally.y) > radius) continue;

    ally.mirabelLearningAttacksLeft = attacks;
    ally.mirabelLearningTimer = LEARNING_DURATION;
    ally.mirabelLearningDamageMult = damageMult;

    if (speedBonus > 0) {
      ally.addStatus("speedBoost", LEARNING_DURATION, speedBonus);
    }

    spawnEffect({
      kind: "mirabelLearningAura",
      x: ally.x,
      y: ally.y - 12,
      radius: ally.radius + 22,
      color: "#FFEB3B",
      secondary: "#E53935",
      timer: LEARNING_DURATION,
      maxTimer: LEARNING_DURATION,
      followBrawler: ally,
    });
  }

  spawnEffect({
    kind: "mirabelSuperCast",
    x: caster.x,
    y: caster.y - 28,
    radius: 52,
    color: "#FFEB3B",
    secondary: "#FFCDD2",
    timer: 1.35,
    maxTimer: 1.35,
    followBrawler: caster,
  });
}

export function applyMirabelOnHit(
  attacker: Brawler | null,
  victim: Brawler,
  proj: Projectile,
  allies: Brawler[],
): void {
  if (!attacker?.alive || proj.type !== "mirabelSpark") return;
  applyMirabelAllyCooldownNearHit(attacker, victim, allies);
}
