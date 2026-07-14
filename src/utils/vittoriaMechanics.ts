import type { Brawler } from "../entities/Brawler";
import { TILE_CELL_SIZE } from "../game/TileMap";
import { angleTo, distance } from "./helpers";
import { spawnEffect } from "./effects";
import {
  damageEnemyShadowsInRadius,
  shadowDisplayRadius,
  getVerdelettaShadows,
} from "./verdelettaShadows";
import { damageCratesInRadius, cratesIntersectRadius, type CrateDamageOpts } from "./crateDamage";

const BASE_RANGE = TILE_CELL_SIZE * 2.5;
const STAR4_RANGE = TILE_CELL_SIZE * 3;
const BASE_LIFESTEAL = 0.3;
const STAR1_LIFESTEAL = 0.5;
const SUPER_LIFESTEAL = 0.8;
const STAR3_LIFESTEAL = 1.0;
const SUPER_DAMAGE_MULT = 1.25;
const STAR6_DAMAGE_MULT = 1.4;
const SUPER_SPEED_MULT = 1.45 * 0.85;
const STAR2_SPEED_MULT = 1.5 * 0.85;
const VAMPIRE_NIGHT_SPEED_MULT = 1.3 * 0.85;
const BLOOD_MOON_BASE = 5;
const BLOOD_MOON_MAX = 8;
const KILL_EXTEND = 1.5;

interface VittoriaState {
  bloodMoonEndCap: number;
  hadBloodMoon: boolean;
}

const states = new Map<string, VittoriaState>();

function starsOf(b: Brawler): Set<number> {
  return new Set(b.constellationStars ?? []);
}

function stateOf(b: Brawler): VittoriaState {
  let st = states.get(b.id);
  if (!st) {
    st = { bloodMoonEndCap: 0, hadBloodMoon: false };
    states.set(b.id, st);
  }
  return st;
}

export function clearVittoriaMechanics(): void {
  states.clear();
}

export function getVittoriaAttackRange(b: Brawler): number {
  return starsOf(b).has(4) ? STAR4_RANGE : BASE_RANGE;
}

export function getVittoriaOutgoingDamageMult(b: Brawler): number {
  if (b.statusEffects.some(e => e.type === "vampireNight")) return STAR6_DAMAGE_MULT;
  if (b.statusEffects.some(e => e.type === "bloodMoon")) return SUPER_DAMAGE_MULT;
  return 1;
}

export function getVittoriaBloodMoonSpeedMult(b: Brawler): number {
  return starsOf(b).has(2) ? STAR2_SPEED_MULT : SUPER_SPEED_MULT;
}

export function getVittoriaVampireNightSpeedMult(): number {
  return VAMPIRE_NIGHT_SPEED_MULT;
}

export function applyVittoriaLifesteal(b: Brawler, damageDealt: number): void {
  if (damageDealt <= 0 || !b.alive) return;
  if (b.statusEffects.some(e => e.type === "vampireNight")) return;

  const stars = starsOf(b);
  const inSuper = b.statusEffects.some(e => e.type === "bloodMoon");
  let ratio = stars.has(1) ? STAR1_LIFESTEAL : BASE_LIFESTEAL;
  if (inSuper) {
    ratio = stars.has(3) ? STAR3_LIFESTEAL : SUPER_LIFESTEAL;
  }
  b.heal(Math.floor(damageDealt * ratio));
}

export function spawnVittoriaBiteVfx(b: Brawler): void {
  const reach = getVittoriaAttackRange(b) + b.radius;
  const hx = b.x + Math.cos(b.angle) * reach * 0.55;
  const hy = b.y + Math.sin(b.angle) * reach * 0.55;
  spawnEffect({
    kind: "vittoriaBiteSlash",
    x: hx,
    y: hy,
    toX: b.x + Math.cos(b.angle) * reach,
    toY: b.y + Math.sin(b.angle) * reach,
    radius: reach * 0.45,
    color: "#B71C1C",
    secondary: "#FF5252",
    timer: 0.32,
    maxTimer: 0.32,
  });
}

export function damageVittoriaShadowsInMeleeArc(attacker: Brawler): number {
  const mult = getVittoriaOutgoingDamageMult(attacker);
  const base = attacker.scaledDamage * mult;
  const reach = getVittoriaAttackRange(attacker) + attacker.radius;
  let total = 0;
  for (const s of getVerdelettaShadows()) {
    if (!s.alive || s.team === attacker.team) continue;
    const hitR = shadowDisplayRadius(s.variant);
    const d = distance(attacker.x, attacker.y, s.x, s.y);
    if (d > reach + hitR) continue;
    const aimDiff = Math.abs(angleTo(attacker.x, attacker.y, s.x, s.y) - attacker.angle);
    if (aimDiff > Math.PI / 3.2) continue;
    const before = s.hp;
    damageEnemyShadowsInRadius(s.x, s.y, hitR, Math.floor(base), attacker.team);
    total += Math.max(0, before - s.hp);
  }
  return total;
}

export function damageVittoriaCrates(b: Brawler, crateOpts?: CrateDamageOpts): number {
  if (!crateOpts?.crates?.length) return 0;
  const reach = getVittoriaAttackRange(b) + b.radius;
  const hx = b.x + Math.cos(b.angle) * reach * 0.5;
  const hy = b.y + Math.sin(b.angle) * reach * 0.5;
  if (!cratesIntersectRadius(hx, hy, reach * 0.55, crateOpts.crates)) return 0;
  const dmg = Math.floor(b.scaledDamage * getVittoriaOutgoingDamageMult(b));
  damageCratesInRadius(hx, hy, reach * 0.55, dmg, crateOpts);
  return dmg;
}

export function activateVittoriaBloodMoon(b: Brawler): void {
  const now = performance.now() / 1000;
  const st = stateOf(b);
  st.bloodMoonEndCap = now + (starsOf(b).has(5) ? BLOOD_MOON_MAX : BLOOD_MOON_BASE);
  st.hadBloodMoon = true;
  b.addStatus("bloodMoon", BLOOD_MOON_BASE, SUPER_DAMAGE_MULT - 1);
  spawnEffect({
    kind: "vittoriaBloodMoon",
    x: b.x,
    y: b.y - b.radius - 28,
    radius: b.radius + 36,
    color: "#7B1FA2",
    secondary: "#E53935",
    timer: BLOOD_MOON_BASE,
    maxTimer: BLOOD_MOON_BASE,
    followBrawler: b,
    linkedStatus: "bloodMoon",
  });
  spawnEffect({
    kind: "vittoriaBloodEyes",
    x: b.x,
    y: b.y - 8,
    radius: b.radius + 10,
    color: "#FF1744",
    secondary: "#B71C1C",
    timer: BLOOD_MOON_BASE,
    maxTimer: BLOOD_MOON_BASE,
    followBrawler: b,
    linkedStatus: "bloodMoon",
  });
}

export function onVittoriaKill(attacker: Brawler): void {
  if (attacker.stats.id !== "vittoria") return;
  const eff = attacker.statusEffects.find(e => e.type === "bloodMoon");
  if (!eff || !starsOf(attacker).has(5)) return;
  const st = stateOf(attacker);
  const now = performance.now() / 1000;
  if (now >= st.bloodMoonEndCap) return;
  eff.duration = Math.min(eff.duration + KILL_EXTEND, st.bloodMoonEndCap - now);
}

export function tickVittoriaMechanics(all: Brawler[], dt: number): void {
  const now = performance.now() / 1000;
  for (const b of all) {
    if (b.stats.id !== "vittoria" || !b.alive) continue;
    const st = stateOf(b);
    const hasBloodMoon = b.statusEffects.some(e => e.type === "bloodMoon");
    const eff = b.statusEffects.find(e => e.type === "bloodMoon");
    if (eff && now >= st.bloodMoonEndCap) {
      eff.duration = 0;
    }
    if (st.hadBloodMoon && !hasBloodMoon && b.statusEffects.every(e => e.type !== "vampireNight")) {
      st.hadBloodMoon = false;
      if (starsOf(b).has(6)) {
        b.addStatus("vampireNight", 5, STAR6_DAMAGE_MULT - 1);
        spawnEffect({
          kind: "vittoriaNightCurse",
          x: b.x,
          y: b.y,
          radius: b.radius + 14,
          color: "#4A148C",
          secondary: "#880E4F",
          timer: 5,
          maxTimer: 5,
          followBrawler: b,
          linkedStatus: "vampireNight",
        });
      }
    }
    void dt;
  }
}
