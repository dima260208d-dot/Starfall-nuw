import type { Brawler } from "../entities/Brawler";
import { TILE_CELL_SIZE } from "../game/TileMap";
import { clamp, distance } from "./helpers";
import { spawnEffect } from "./effects";
import { applyCallistaZoneToEnemyShadows } from "./verdelettaShadows";
import { damageCratesInRadius, damageCratesAtPoint, type CrateDamageOpts } from "./crateDamage";
import { damageDevMonstersInRadius } from "./devBattleMonsters";

export type CallistaReactant = "acid" | "freeze" | "poison" | "heal";

export const CALLISTA_THROW_MIN = TILE_CELL_SIZE;
export const CALLISTA_THROW_MAX = TILE_CELL_SIZE * 4;
const THROW_RANGE = CALLISTA_THROW_MAX;
const ATTACK_ZONE_R = 100;
const SUPER_ZONE_R = 120;
const BONUS_ZONE_R = 100;
const FLASK_FLIGHT = 0.58;
const ARC_PEAK = 48;

interface CallistaFlask {
  id: string;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  t: number;
  reactant: CallistaReactant | "super";
  isSuper: boolean;
  ownerId: string;
  ownerTeam: string;
  effectMult: number;
  stars: number[];
  alive: boolean;
}

interface CallistaZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  timer: number;
  maxTimer: number;
  reactants: CallistaReactant[];
  ownerId: string;
  ownerTeam: string;
  effectMult: number;
  stars: number[];
  acidHit: Set<string>;
  tickTimer: number;
  initialized: boolean;
}

let flasks: CallistaFlask[] = [];
let zones: CallistaZone[] = [];
let nextId = 0;

const REACTANTS: CallistaReactant[] = ["acid", "freeze", "poison", "heal"];

export function clearCallistaMechanics(): void {
  flasks = [];
  zones = [];
}

function ownerOf(all: Brawler[], id: string): Brawler | null {
  return all.find(b => b.id === id) ?? null;
}

function pickReactant(): CallistaReactant {
  return REACTANTS[Math.floor(Math.random() * REACTANTS.length)];
}

function effectValues(stars: Set<number>, mult: number) {
  return {
    acid: Math.floor(750 * (stars.has(1) ? 1.2 : 1) * mult),
    poisonDps: Math.floor((350 + (stars.has(2) ? 150 : 0)) * mult),
    heal: Math.floor((800 + (stars.has(3) ? 300 : 0)) * mult),
    slow: (stars.has(4) ? 0.6 : 0.4) * mult,
    poisonDur: 4,
    freezeDur: 2,
  };
}

function reactantColor(r: CallistaReactant): string {
  switch (r) {
    case "acid": return "#76FF03";
    case "freeze": return "#81D4FA";
    case "poison": return "#AB47BC";
    case "heal": return "#66BB6A";
  }
}

function landingPoint(
  owner: Brawler,
  angle: number,
  targetX?: number,
  targetY?: number,
  mapW = 3600,
  mapH = 3600,
): { x: number; y: number } {
  let ex = owner.x + Math.cos(angle) * THROW_RANGE;
  let ey = owner.y + Math.sin(angle) * THROW_RANGE;
  if (typeof targetX === "number" && typeof targetY === "number") {
    const dx = targetX - owner.x;
    const dy = targetY - owner.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01) {
      const dist = clamp(d, CALLISTA_THROW_MIN, THROW_RANGE);
      ex = owner.x + (dx / d) * dist;
      ey = owner.y + (dy / d) * dist;
    }
  }
  return {
    x: clamp(ex, owner.radius, mapW - owner.radius),
    y: clamp(ey, owner.radius, mapH - owner.radius),
  };
}

export function resolveCallistaAimFromTarget(
  owner: { x: number; y: number; angle: number },
  targetX: number,
  targetY: number,
): { x: number; y: number; angle: number } {
  const dx = targetX - owner.x;
  const dy = targetY - owner.y;
  const d = Math.hypot(dx, dy);
  const angle = d > 0.01 ? Math.atan2(dy, dx) : owner.angle;
  const dist = d > 0.01 ? clamp(d, CALLISTA_THROW_MIN, CALLISTA_THROW_MAX) : CALLISTA_THROW_MAX;
  return {
    x: owner.x + Math.cos(angle) * dist,
    y: owner.y + Math.sin(angle) * dist,
    angle,
  };
}

export function resolveCallistaAutoAimFromUnits(
  owner: Brawler,
  units: Brawler[],
): { x: number; y: number; angle: number } | null {
  let best: Brawler | null = null;
  let bestD = Infinity;
  for (const u of units) {
    if (!u.alive || u.team === owner.team) continue;
    const d = distance(owner.x, owner.y, u.x, u.y);
    if (d <= CALLISTA_THROW_MAX + u.radius && d < bestD) {
      bestD = d;
      best = u;
    }
  }
  if (!best) return null;
  return resolveCallistaAimFromTarget(owner, best.x, best.y);
}

function spawnZone(
  x: number,
  y: number,
  radius: number,
  duration: number,
  reactants: CallistaReactant[],
  owner: Brawler,
  effectMult: number,
  stars: number[],
): void {
  zones.push({
    id: `callista_zone_${nextId++}`,
    x,
    y,
    radius,
    timer: duration,
    maxTimer: duration,
    reactants,
    ownerId: owner.id,
    ownerTeam: owner.team,
    effectMult,
    stars,
    acidHit: new Set(),
    tickTimer: 0,
    initialized: false,
  });

  const primary = reactants[0] ?? "acid";
  spawnEffect({
    kind: reactants.length > 1 ? "callistaSuperZone" : "callistaZone",
    x,
    y,
    radius,
    color: reactantColor(primary),
    secondary: reactants.length > 1 ? "#FFD54F" : reactantColor(primary),
    timer: duration,
    maxTimer: duration,
    particleCount: reactants.length > 1 ? 24 : 14,
  });

  spawnEffect({
    kind: "callistaFlaskImpact",
    x,
    y,
    radius: radius * 0.55,
    color: reactantColor(primary),
    secondary: "#FFFFFF",
    timer: 0.45,
    maxTimer: 0.45,
  });
}

function applyZoneToBrawler(
  zone: CallistaZone,
  b: Brawler,
  owner: Brawler | null,
  vals: ReturnType<typeof effectValues>,
  forceAll = false,
): void {
  if (!b.alive) return;
  if (distance(zone.x, zone.y, b.x, b.y) > zone.radius + b.radius) return;

  const reactants = forceAll ? REACTANTS : zone.reactants;

  if (reactants.includes("acid") && !zone.acidHit.has(b.id) && b.team !== zone.ownerTeam) {
    zone.acidHit.add(b.id);
    b.takeDamage(vals.acid, owner);
  }
  if (reactants.includes("freeze") && b.team !== zone.ownerTeam) {
    b.addStatus("slow", vals.freezeDur, vals.slow);
  }
  if (reactants.includes("heal") && b.team === zone.ownerTeam) {
    if (owner) b.heal(vals.heal, owner);
  }
}

function applyZoneToShadows(
  zone: CallistaZone,
  vals: ReturnType<typeof effectValues>,
  forceAll = false,
): void {
  const reactants = forceAll ? REACTANTS : zone.reactants;
  applyCallistaZoneToEnemyShadows(
    zone.x,
    zone.y,
    zone.radius,
    zone.ownerTeam,
    reactants,
    vals,
    zone.acidHit,
  );
}

function tickZone(zone: CallistaZone, all: Brawler[], dt: number, crateOpts?: CrateDamageOpts): void {
  const owner = ownerOf(all, zone.ownerId);
  const stars = new Set(zone.stars);
  const vals = effectValues(stars, zone.effectMult);

  if (!zone.initialized) {
    zone.initialized = true;
    for (const b of all) {
      applyZoneToBrawler(zone, b, owner, vals, zone.reactants.length >= 4);
    }
    applyZoneToShadows(zone, vals, zone.reactants.length >= 4);
    damageCratesInRadius(zone.x, zone.y, zone.radius, vals.acid, crateOpts);
    damageDevMonstersInRadius(zone.x, zone.y, zone.radius, vals.acid, zone.ownerTeam, owner);
  }

  if (!zone.reactants.includes("poison")) return;

  zone.tickTimer -= dt;
  if (zone.tickTimer > 0) return;
  zone.tickTimer = 1;
  for (const b of all) {
    if (!b.alive || b.team === zone.ownerTeam) continue;
    if (distance(zone.x, zone.y, b.x, b.y) > zone.radius + b.radius) continue;
    b.takeDamage(vals.poisonDps, owner, { suppressScreenFlash: true });
  }
  applyCallistaZoneToEnemyShadows(
    zone.x,
    zone.y,
    zone.radius,
    zone.ownerTeam,
    ["poison"],
    vals,
    zone.acidHit,
  );
  damageDevMonstersInRadius(zone.x, zone.y, zone.radius, vals.poisonDps, zone.ownerTeam, owner);
}

export function launchCallistaFlask(
  owner: Brawler,
  angle: number,
  isSuper: boolean,
  effectMult: number,
  targetX?: number,
  targetY?: number,
  mapW = 3600,
  mapH = 3600,
): void {
  const stars = owner.constellationStars || [];
  const land = landingPoint(owner, angle, targetX, targetY, mapW, mapH);

  spawnEffect({
    kind: "callistaFlaskLaunch",
    x: owner.x,
    y: owner.y - 8,
    radius: isSuper ? 38 : 26,
    color: isSuper ? "#FFD54F" : reactantColor(pickReactant()),
    secondary: "#43A047",
    timer: FLASK_FLIGHT + 0.1,
    maxTimer: FLASK_FLIGHT + 0.1,
    toX: land.x,
    toY: land.y,
  });

  flasks.push({
    id: `callista_flask_${nextId++}`,
    sx: owner.x + Math.cos(angle) * 16,
    sy: owner.y + Math.sin(angle) * 16 - 10,
    ex: land.x,
    ey: land.y,
    t: 0,
    reactant: isSuper ? "super" : pickReactant(),
    isSuper,
    ownerId: owner.id,
    ownerTeam: owner.team,
    effectMult,
    stars: [...stars],
    alive: true,
  });
}

export function updateCallistaMechanics(dt: number, all: Brawler[], crateOpts?: CrateDamageOpts): void {
  for (let i = flasks.length - 1; i >= 0; i--) {
    const f = flasks[i];
    if (!f.alive) {
      flasks.splice(i, 1);
      continue;
    }
    f.t += dt;
    if (f.t >= FLASK_FLIGHT) {
      f.alive = false;
      const owner = ownerOf(all, f.ownerId);
      if (!owner) continue;
      const vals = effectValues(new Set(f.stars), f.effectMult);
      const impactR = f.isSuper ? SUPER_ZONE_R * 0.55 : ATTACK_ZONE_R * 0.55;
      damageCratesAtPoint(f.ex, f.ey, impactR, vals.acid, crateOpts);
      if (f.isSuper) {
        spawnZone(f.ex, f.ey, SUPER_ZONE_R, 4, [...REACTANTS], owner, f.effectMult, f.stars);
        if (new Set(f.stars).has(6)) {
          const ang = Math.random() * Math.PI * 2;
          const bx = f.ex + Math.cos(ang) * BONUS_ZONE_R;
          const by = f.ey + Math.sin(ang) * BONUS_ZONE_R;
          spawnZone(bx, by, BONUS_ZONE_R, 4, [pickReactant()], owner, f.effectMult, f.stars);
        }
      } else {
        spawnZone(f.ex, f.ey, ATTACK_ZONE_R, 2.5, [f.reactant as CallistaReactant], owner, f.effectMult, f.stars);
      }
    }
  }

  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.timer -= dt;
    tickZone(z, all, dt, crateOpts);
    if (z.timer <= 0) zones.splice(i, 1);
  }
}

export function renderCallistaFlasks(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  frame: number,
): void {
  for (const f of flasks) {
    if (!f.alive) continue;
    const p = Math.min(1, f.t / FLASK_FLIGHT);
    const x = f.sx + (f.ex - f.sx) * p;
    const y = f.sy + (f.ey - f.sy) * p - Math.sin(p * Math.PI) * ARC_PEAK;
    const sx = x - camX;
    const sy = y - camY;
    const col = f.isSuper ? "#FFD54F" : reactantColor(f.reactant as CallistaReactant);
    const spin = frame * 0.2 + f.t * 8;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(spin);

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 6, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.95;
    const g = ctx.createLinearGradient(-6, -10, 6, 8);
    g.addColorStop(0, "#E8F5E9");
    g.addColorStop(0.4, col);
    g.addColorStop(1, "#2E7D32");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#1B5E20";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-5, 6);
    ctx.lineTo(-4, -8);
    ctx.quadraticCurveTo(0, -11, 4, -8);
    ctx.lineTo(5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(-1.5, -3, 2.2, 3.5, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#795548";
    ctx.fillRect(-6, 5, 12, 3);
    ctx.restore();
  }
}

export function callistaCanUseSuper(b: Brawler): boolean {
  if (b.stats.id !== "callista") return b.superReady;
  if (b.callistaBonusSuperReady) return true;
  return b.superReady;
}

export function onCallistaSuperUsed(b: Brawler, wasBonus: boolean): void {
  const stars = new Set(b.constellationStars || []);
  if (!wasBonus && stars.has(5)) {
    b.callistaBonusSuperReady = true;
  } else if (wasBonus) {
    b.callistaBonusSuperReady = false;
  }
}

export type CallistaMechanicsSnapshot = {
  flasks: Array<Omit<CallistaFlask, "alive"> & { alive: boolean }>;
  zones: Array<Omit<CallistaZone, "acidHit"> & { acidHit: string[] }>;
};

export function snapshotCallistaMechanics(): CallistaMechanicsSnapshot {
  return {
    flasks: flasks.map(f => ({ ...f })),
    zones: zones.map(z => ({ ...z, acidHit: [...z.acidHit] })),
  };
}

export function restoreCallistaMechanicsSnapshot(snapshot: CallistaMechanicsSnapshot | undefined): void {
  if (!snapshot) {
    clearCallistaMechanics();
    return;
  }
  flasks = snapshot.flasks.map(f => ({ ...f }));
  zones = snapshot.zones.map(z => ({ ...z, acidHit: new Set(z.acidHit) }));
}
