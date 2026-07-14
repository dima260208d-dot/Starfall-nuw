/**
 * Delta snapshot codec — server sends only changed fields; client merges into baseline.
 * Wire: `{ type:"state", full:1, s: NetSnapshot }` or `{ type:"state", s: DeltaPayload }`.
 */
import type {
  NetBall,
  NetBase,
  NetCube,
  NetEffect,
  NetGas,
  NetGem,
  NetGoal,
  NetProjectile,
  NetRounds,
  NetSafe,
  NetSnapshot,
  NetTurret,
  NetUnit,
} from "../net/battleTypes";

export type NetSnapshotDeltaPayload = {
  tick: number;
  time: number;
  over?: boolean;
  winner?: string | null;
  score?: { blue: number; red: number };
  countdown?: { blue: number; red: number };
  rounds?: NetRounds;
  safes?: NetSafe[];
  gas?: NetGas;
  cubes?: NetCube[];
  alive?: number;
  bases?: NetBase[];
  ball?: NetBall;
  goals?: NetGoal[];
  base?: { x: number; y: number; r: number; hp: number; mhp: number };
  boss?: { hp: number; mhp: number };
  wave?: number;
  waves?: number;
  monsters?: number;
  kills?: number;
  /** Changed units only (matched by id). */
  units?: NetUnit[];
  /** Unit ids removed since baseline (rare — showdown elimination). */
  unitRemove?: string[];
  projectiles?: NetProjectile[];
  turrets?: NetTurret[];
  fx?: NetEffect[];
  gems?: NetGem[];
};

const UNIT_KEYS: (keyof NetUnit)[] = [
  "id", "t", "b", "mon", "mt", "bot", "x", "y", "a", "hp", "mhp", "al", "bu", "rt",
  "sc", "sh", "g", "st", "pc", "lv", "k", "ig", "po", "dk",
];

function unitChanged(a: NetUnit, b: NetUnit): boolean {
  for (const k of UNIT_KEYS) {
    if ((a[k] ?? undefined) !== (b[k] ?? undefined)) return true;
  }
  return false;
}

function shallowEq<T>(a: T | undefined, b: T | undefined): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function jsonSize(v: unknown): number {
  try {
    return JSON.stringify(v).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

/** Build a delta from previous → current authoritative snapshot. Returns null if identical. */
export function computeSnapshotDelta(
  prev: NetSnapshot,
  next: NetSnapshot,
): NetSnapshotDeltaPayload | null {
  if (prev.tick >= next.tick) return null;

  const delta: NetSnapshotDeltaPayload = { tick: next.tick, time: next.time };
  let hasChange = false;

  const mark = () => { hasChange = true; };

  if (prev.over !== next.over) { delta.over = next.over; mark(); }
  if (prev.winner !== next.winner) { delta.winner = next.winner; mark(); }
  if (!shallowEq(prev.score, next.score)) { delta.score = next.score; mark(); }
  if (!shallowEq(prev.countdown, next.countdown)) { delta.countdown = next.countdown; mark(); }
  if (!shallowEq(prev.rounds, next.rounds)) { delta.rounds = next.rounds; mark(); }
  if (!shallowEq(prev.safes, next.safes)) { delta.safes = next.safes; mark(); }
  if (!shallowEq(prev.gas, next.gas)) { delta.gas = next.gas; mark(); }
  if (!shallowEq(prev.cubes, next.cubes)) { delta.cubes = next.cubes; mark(); }
  if (prev.alive !== next.alive) { delta.alive = next.alive; mark(); }
  if (!shallowEq(prev.bases, next.bases)) { delta.bases = next.bases; mark(); }
  if (!shallowEq(prev.ball, next.ball)) { delta.ball = next.ball; mark(); }
  if (!shallowEq(prev.goals, next.goals)) { delta.goals = next.goals; mark(); }
  if (!shallowEq(prev.base, next.base)) { delta.base = next.base; mark(); }
  if (!shallowEq(prev.boss, next.boss)) { delta.boss = next.boss; mark(); }
  if (prev.wave !== next.wave) { delta.wave = next.wave; mark(); }
  if (prev.waves !== next.waves) { delta.waves = next.waves; mark(); }
  if (prev.monsters !== next.monsters) { delta.monsters = next.monsters; mark(); }
  if (prev.kills !== next.kills) { delta.kills = next.kills; mark(); }
  if (!shallowEq(prev.turrets, next.turrets)) { delta.turrets = next.turrets; mark(); }
  if (!shallowEq(prev.fx, next.fx)) { delta.fx = next.fx; mark(); }
  if (!shallowEq(prev.gems, next.gems)) { delta.gems = next.gems; mark(); }

  if (!shallowEq(prev.projectiles, next.projectiles)) {
    delta.projectiles = next.projectiles;
    mark();
  }

  const prevById = new Map(prev.units.map((u) => [u.id, u]));
  const nextById = new Map(next.units.map((u) => [u.id, u]));
  const changedUnits: NetUnit[] = [];
  for (const u of next.units) {
    const p = prevById.get(u.id);
    if (!p || unitChanged(p, u)) changedUnits.push(u);
  }
  if (changedUnits.length > 0) {
    delta.units = changedUnits;
    mark();
  }

  const removed: string[] = [];
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) removed.push(id);
  }
  if (removed.length > 0) {
    delta.unitRemove = removed;
    mark();
  }

  return hasChange ? delta : null;
}

/** Pick full snapshot vs delta for wire — fall back to full when delta is not smaller. */
export function packStateWirePayload(
  prev: NetSnapshot | null,
  next: NetSnapshot,
): { full: 1; s: NetSnapshot } | { s: NetSnapshotDeltaPayload } {
  if (!prev) return { full: 1, s: next };
  const delta = computeSnapshotDelta(prev, next);
  if (!delta) return { full: 1, s: next };
  const fullSize = jsonSize(next);
  const deltaSize = jsonSize(delta);
  if (deltaSize >= fullSize * 0.92) return { full: 1, s: next };
  return { s: delta };
}

function mergeUnits(base: NetUnit[], patch: NetUnit[] | undefined, remove: string[] | undefined): NetUnit[] {
  if (!patch?.length && !remove?.length) return base;
  const byId = new Map(base.map((u) => [u.id, u]));
  for (const id of remove ?? []) byId.delete(id);
  for (const u of patch ?? []) byId.set(u.id, u);
  return [...byId.values()];
}

/** Merge delta into baseline — returns a new full NetSnapshot. */
export function applySnapshotDelta(base: NetSnapshot, delta: NetSnapshotDeltaPayload): NetSnapshot {
  const out: NetSnapshot = {
    ...base,
    tick: delta.tick,
    time: delta.time,
    units: mergeUnits(base.units, delta.units, delta.unitRemove),
    projectiles: delta.projectiles ?? base.projectiles,
    gems: delta.gems ?? base.gems,
  };

  if (delta.over !== undefined) out.over = delta.over;
  if (delta.winner !== undefined) out.winner = delta.winner;
  if (delta.score) out.score = delta.score;
  if (delta.countdown) out.countdown = delta.countdown;
  if (delta.rounds) out.rounds = delta.rounds;
  if (delta.safes) out.safes = delta.safes;
  if (delta.gas) out.gas = delta.gas;
  if (delta.cubes) out.cubes = delta.cubes;
  if (delta.alive !== undefined) out.alive = delta.alive;
  if (delta.bases) out.bases = delta.bases;
  if (delta.ball) out.ball = delta.ball;
  if (delta.goals) out.goals = delta.goals;
  if (delta.base) out.base = delta.base;
  if (delta.boss) out.boss = delta.boss;
  if (delta.wave !== undefined) out.wave = delta.wave;
  if (delta.waves !== undefined) out.waves = delta.waves;
  if (delta.monsters !== undefined) out.monsters = delta.monsters;
  if (delta.kills !== undefined) out.kills = delta.kills;
  if (delta.turrets) out.turrets = delta.turrets;
  if (delta.fx) out.fx = delta.fx;

  return out;
}

/** Decode `{ type:"state", ... }` into a full NetSnapshot (mutates/replaces baseline ref). */
export function decodeStateMessage(
  msg: Record<string, unknown>,
  baseline: NetSnapshot | null,
): NetSnapshot | null {
  const raw = msg.s;
  if (!raw || typeof raw !== "object") return null;

  if (msg.full === 1 || msg.full === true) {
    return raw as NetSnapshot;
  }

  if (msg.d === 1 && baseline) {
    return applySnapshotDelta(baseline, raw as NetSnapshotDeltaPayload);
  }

  const maybeFull = raw as NetSnapshot;
  if (
    Array.isArray(maybeFull.units)
    && Array.isArray(maybeFull.projectiles)
    && Array.isArray(maybeFull.gems)
    && maybeFull.score
    && maybeFull.countdown
    && typeof maybeFull.over === "boolean"
  ) {
    return maybeFull;
  }

  if (!baseline) return null;

  return applySnapshotDelta(baseline, raw as NetSnapshotDeltaPayload);
}
