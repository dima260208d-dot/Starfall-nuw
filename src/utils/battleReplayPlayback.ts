import { Brawler } from "../entities/Brawler";
import { getBrawlerById } from "../entities/BrawlerData";
import { getPetById } from "../entities/PetData";
import type { Projectile } from "../entities/Projectile";
import type { ReplayActorFrame, ReplayFrame, ReplayProjectileFrame } from "./battleReplayStore";
import { lerpReplayHud, lerpReplayWorld } from "./battleReplayWorld";

function lerpAngle(a: number, b: number, u: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * u;
}

function inferAngleFromDelta(dx: number, dy: number): number | null {
  if (Math.hypot(dx, dy) < 1.5) return null;
  return Math.atan2(dy, dx);
}

function inferAnimState(a: ReplayActorFrame, b: ReplayActorFrame, u: number): "idle" | "run" | "attack" {
  if ((a.attackAnim ?? 0) > 0.12 || (b.attackAnim ?? 0) > 0.12) return "attack";
  if ((a.superAnim ?? 0) > 0.12 || (b.superAnim ?? 0) > 0.12) return "attack";
  if (a.animState === "attack" || b.animState === "attack") {
    return u > 0.35 ? (b.animState ?? "attack") : (a.animState ?? "attack");
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.hypot(dx, dy) > 2.5) return "run";
  if (a.animState === "run" || b.animState === "run") {
    return u > 0.5 ? (b.animState ?? "run") : (a.animState ?? "run");
  }
  return u > 0.5 ? (b.animState ?? "idle") : (a.animState ?? "idle");
}

function lerpActor(a: ReplayActorFrame, b: ReplayActorFrame, u: number): ReplayActorFrame {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const deltaAngle = inferAngleFromDelta(dx, dy);
  const attackAnim = Math.max(
    (a.attackAnim ?? 0) + ((b.attackAnim ?? 0) - (a.attackAnim ?? 0)) * u,
    (a.attackAnim ?? 0) > 0.1 || (b.attackAnim ?? 0) > 0.1 ? 0.7 : 0,
  );
  const superAnim = Math.max(
    (a.superAnim ?? 0) + ((b.superAnim ?? 0) - (a.superAnim ?? 0)) * u,
    (a.superAnim ?? 0) > 0.1 || (b.superAnim ?? 0) > 0.1 ? 0.75 : 0,
  );

  let angle = lerpAngle(a.angle ?? a.moveAngle ?? 0, b.angle ?? b.moveAngle ?? a.angle ?? 0, u);
  let moveAngle = lerpAngle(a.moveAngle ?? a.angle ?? 0, b.moveAngle ?? b.angle ?? a.angle ?? 0, u);
  if (deltaAngle != null && (a.angle == null && b.angle == null)) {
    angle = deltaAngle;
    moveAngle = deltaAngle;
  } else if (deltaAngle != null && inferAnimState(a, b, u) === "run") {
    moveAngle = deltaAngle;
  }

  return {
    ...a,
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    hp: a.hp + (b.hp - a.hp) * u,
    alive: b.alive,
    angle,
    moveAngle,
    attackAnim,
    superAnim,
    animState: inferAnimState(a, b, u),
    inBush: u > 0.5 ? b.inBush : a.inBush,
    bushRevealTimer: (a.bushRevealTimer ?? 0) + ((b.bushRevealTimer ?? 0) - (a.bushRevealTimer ?? 0)) * u,
    attackCharges: u > 0.5 ? (b.attackCharges ?? a.attackCharges) : a.attackCharges,
    maxAttackCharges: b.maxAttackCharges ?? a.maxAttackCharges,
    superCharge: (a.superCharge ?? 0) + ((b.superCharge ?? 0) - (a.superCharge ?? 0)) * u,
    superReady: u > 0.5 ? b.superReady : a.superReady,
    pinId: u > 0.5 ? b.pinId : a.pinId,
    pinUntilT: u > 0.5 ? b.pinUntilT : a.pinUntilT,
    petId: u > 0.5 ? b.petId : a.petId,
    petFollowX: (a.petFollowX ?? a.x) + ((b.petFollowX ?? b.x) - (a.petFollowX ?? a.x)) * u,
    petFollowY: (a.petFollowY ?? a.y) + ((b.petFollowY ?? b.y) - (a.petFollowY ?? a.y)) * u,
  };
}

function lerpProjectile(a: ReplayProjectileFrame, b: ReplayProjectileFrame, u: number): ReplayProjectileFrame {
  return {
    ...a,
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    vx: a.vx + (b.vx - a.vx) * u,
    vy: a.vy + (b.vy - a.vy) * u,
  };
}

const brawlerCache = new Map<string, Brawler>();
const prevActorPos = new Map<string, { x: number; y: number }>();
const lerpFrameCache = { frames: null as ReplayFrame[] | null, idx: 0 };

export function resetLerpReplayCache(): void {
  lerpFrameCache.frames = null;
  lerpFrameCache.idx = 0;
}

export function lerpReplayFrame(frames: ReplayFrame[], t: number): ReplayFrame {
  if (frames.length === 0) return { t: 0, actors: [], camX: 0, camY: 0 };
  if (t <= frames[0].t) return frames[0];
  const last = frames[frames.length - 1];
  if (t >= last.t) return last;

  if (lerpFrameCache.frames !== frames) {
    lerpFrameCache.frames = frames;
    lerpFrameCache.idx = 0;
  }
  let i = Math.min(lerpFrameCache.idx, frames.length - 2);
  if (t < frames[i].t) {
    while (i > 0 && frames[i].t > t) i--;
  } else {
    while (i < frames.length - 1 && frames[i + 1].t < t) i++;
  }
  lerpFrameCache.idx = i;

  const a = frames[i];
  const b = frames[i + 1];
  const u = (t - a.t) / Math.max(0.001, b.t - a.t);

  const bActorMap = new Map(b.actors.map(act => [act.id, act]));
  const actors = a.actors.map(act => {
    const next = bActorMap.get(act.id);
    return next ? lerpActor(act, next, u) : act;
  });

  const projectiles: ReplayProjectileFrame[] = [];
  const bProjs = b.projectiles ?? [];
  for (const p of a.projectiles ?? []) {
    const idx = bProjs.findIndex(
      bp => Math.hypot(bp.x - p.x, bp.y - p.y) < 80 && bp.type === p.type && bp.ownerTeam === p.ownerTeam,
    );
    if (idx >= 0) {
      projectiles.push(lerpProjectile(p, bProjs[idx], u));
    } else if (u < 0.5) {
      projectiles.push(p);
    }
  }
  for (const bp of bProjs) {
    const matched = (a.projectiles ?? []).some(
      ap => Math.hypot(bp.x - ap.x, bp.y - ap.y) < 80 && bp.type === ap.type && bp.ownerTeam === ap.ownerTeam,
    );
    if (!matched && u > 0.5) projectiles.push(bp);
  }

  // If a brawler just fired (projectile appeared), boost attack anim on nearest actor
  for (const bp of bProjs) {
    const wasInPrev = (a.projectiles ?? []).some(
      ap => ap.type === bp.type && ap.ownerTeam === bp.ownerTeam && Math.hypot(ap.x - bp.x, ap.y - bp.y) < 120,
    );
    if (wasInPrev) continue;
    for (const act of actors) {
      if (act.team !== bp.ownerTeam) continue;
      if (Math.hypot(act.x - bp.x, act.y - bp.y) > 220) continue;
      act.attackAnim = Math.max(act.attackAnim ?? 0, 0.85);
      act.animState = "attack";
      break;
    }
  }

  for (const act of actors) {
    if (act.pinUntilT != null && act.pinUntilT <= t) {
      act.pinId = undefined;
      act.pinUntilT = undefined;
    }
  }

  return {
    t,
    actors,
    camX: a.camX + (b.camX - a.camX) * u,
    camY: a.camY + (b.camY - a.camY) * u,
    projectiles,
    world: lerpReplayWorld(a.world, b.world, u),
    hud: lerpReplayHud(a.hud, b.hud, u),
    vfx: u > 0.5 ? (b.vfx ?? a.vfx) : (a.vfx ?? b.vfx),
  };
}

function resolveAnimState(act: ReplayActorFrame): "idle" | "run" | "attack" {
  if (act.animState) return act.animState;
  if ((act.attackAnim ?? 0) > 0.08 || (act.superAnim ?? 0) > 0.08) return "attack";
  const prev = prevActorPos.get(act.id);
  if (prev && Math.hypot(act.x - prev.x, act.y - prev.y) > 2) return "run";
  return "idle";
}

function applyActorToBrawler(b: Brawler, act: ReplayActorFrame): void {
  const prev = prevActorPos.get(act.id);
  let angle = act.angle ?? act.moveAngle ?? 0;
  let moveAngle = act.moveAngle ?? act.angle ?? 0;
  if (prev) {
    const inferred = inferAngleFromDelta(act.x - prev.x, act.y - prev.y);
    if (inferred != null) {
      if (act.angle == null) angle = inferred;
      moveAngle = inferred;
    }
  }
  prevActorPos.set(act.id, { x: act.x, y: act.y });

  const animState = resolveAnimState(act);
  const attackAnim = act.attackAnim ?? (animState === "attack" ? 0.85 : 0);
  const superAnim = act.superAnim ?? 0;

  b.x = act.x;
  b.y = act.y;
  b.hp = act.hp;
  b.maxHp = act.maxHp;
  b.alive = act.alive;
  b.angle = angle;
  b.moveAngle = moveAngle;
  b.attackAnim = attackAnim;
  b.superAnim = superAnim;
  b.inBush = act.inBush ?? false;
  b.bushRevealTimer = act.bushRevealTimer ?? 0;
  b.isAttacking = attackAnim > 0.02 || superAnim > 0.02 || animState === "attack";
  b.displayName = act.name;
  if (act.attackCharges != null) b.attackCharges = act.attackCharges;
  if (act.maxAttackCharges != null) b.maxAttackCharges = act.maxAttackCharges;
  if (act.superCharge != null) b.superCharge = act.superCharge;
  if (act.superReady != null) b.superReady = act.superReady;
  const rb = b as Brawler & { _replayPinId?: string; _replayPinUntilT?: number };
  if (act.pinId && act.pinUntilT != null) {
    rb._replayPinId = act.pinId;
    rb._replayPinUntilT = act.pinUntilT;
  } else {
    delete rb._replayPinId;
    delete rb._replayPinUntilT;
  }
  (b as Brawler & { _smoothMoveAngle?: number })._smoothMoveAngle = moveAngle;

  const pet = act.petId ? getPetById(act.petId) ?? null : null;
  if (pet?.id !== b.equippedPet?.id) b.setEquippedPet(pet);
  if (act.petFollowX != null && act.petFollowY != null) {
    b.petFollowX = act.petFollowX;
    b.petFollowY = act.petFollowY;
  } else if (pet) {
    b.petFollowX = act.x - 32;
    b.petFollowY = act.y + 14;
  }
  const ownerDelta = prev ? Math.hypot(act.x - prev.x, act.y - prev.y) : 0;
  b.petOwnerHasMoveInput = animState === "run" || ownerDelta > 1.5;
  if (b.petOwnerHasMoveInput) {
    b.petOwnerMovingSmoothed = 1;
  } else {
    b.petOwnerMovingSmoothed *= 0.5;
  }
}

export function replayActorsToBrawlers(actors: ReplayActorFrame[]): Brawler[] {
  const out: Brawler[] = [];
  for (const act of actors) {
    let b = brawlerCache.get(act.id);
    if (!b) {
      const stats = getBrawlerById(act.brawlerId);
      if (!stats) continue;
      b = new Brawler(stats, 1, act.x, act.y, act.team, act.isPlayer);
      b.id = act.id;
      b.turretPlacementId = act.id;
      b.maxHp = act.maxHp;
      b.hp = act.hp;
      b.invulnerable = false;
      b.invulnerableTimer = 0;
      b.attackCharges = act.attackCharges ?? stats.attackCharges;
      b.maxAttackCharges = act.maxAttackCharges ?? stats.attackCharges;
      applyActorToBrawler(b, act);
      brawlerCache.set(act.id, b);
    } else {
      applyActorToBrawler(b, act);
    }
    out.push(b);
  }
  return out;
}

export function replayProjectilesToRenderables(projs: ReplayProjectileFrame[] | undefined): Projectile[] {
  if (!projs?.length) return [];
  return projs.map((p, i) => ({
    id: p.ownerId ? `replay_proj_${p.ownerId}_${i}` : `replay_proj_${i}`,
    x: p.x,
    y: p.y,
    vx: p.vx,
    vy: p.vy,
    radius: p.radius,
    damage: 0,
    speed: Math.hypot(p.vx, p.vy),
    range: 9999,
    distanceTraveled: 0,
    ownerId: p.ownerId ?? "",
    ownerTeam: p.ownerTeam,
    color: p.color,
    type: p.type as Projectile["type"],
    active: true,
    piercing: false,
    hitIds: new Set<string>(),
    homing: p.homing,
    poison: p.poison,
    slow: p.slow,
    hellBrand: p.hellBrand,
    explosionRadius: p.explosionRadius,
    chargeSuper: p.chargeSuper,
  }));
}

export function clearReplayBrawlerCache(): void {
  brawlerCache.clear();
  prevActorPos.clear();
  resetLerpReplayCache();
}

export function resetReplayMeshMotionHints(): void {
  prevActorPos.clear();
}
