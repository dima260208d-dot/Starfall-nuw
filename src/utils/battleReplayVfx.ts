import type { Effect, EffectKind } from "./effects";
import { peekEffects, setReplayRenderEffects } from "./effects";
import { getOliverBugs, restoreOliverBugsSnapshot } from "./oliverBugs";
import { getVerdelettaShadows, restoreVerdelettaShadowsSnapshot } from "./verdelettaShadows";
import { snapshotCallistaMechanics, restoreCallistaMechanicsSnapshot } from "./callistaMechanics";
import { snapshotAirinMechanics, restoreAirinMechanicsSnapshot } from "./airinMechanics";
import { snapshotZephyrinMechanics, restoreZephyrinMechanicsSnapshot } from "./zephyrinMechanics";
import { snapshotElianMechanics, restoreElianMechanicsSnapshot } from "./elianMechanics";
import { snapshotOctaviaMechanics, restoreOctaviaMechanicsSnapshot } from "./octaviaMechanics";
import { snapshotSilvenMechanics, restoreSilvenMechanicsSnapshot } from "./silvenMechanics";

export interface ReplayEffectFrame {
  kind: EffectKind;
  x: number;
  y: number;
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
  damagePerTick?: number;
  tickInterval?: number;
  tickTimer?: number;
  tickRange?: number;
  seed: number;
  particleCount?: number;
  zigzag?: { x: number; y: number }[];
  linkAId?: string;
  linkBId?: string;
  luminaGraceAllies?: boolean;
  value?: number;
}

export interface ReplayVfxFrame {
  effects?: ReplayEffectFrame[];
  oliverBugs?: ReturnType<typeof getOliverBugs>[number][];
  verdelettaShadows?: ReturnType<typeof getVerdelettaShadows>[number][];
  callista?: ReturnType<typeof snapshotCallistaMechanics>;
  airin?: ReturnType<typeof snapshotAirinMechanics>;
  zephyrin?: ReturnType<typeof snapshotZephyrinMechanics>;
  elian?: ReturnType<typeof snapshotElianMechanics>;
  octavia?: ReturnType<typeof snapshotOctaviaMechanics>;
  silven?: ReturnType<typeof snapshotSilvenMechanics>;
}

function effectToFrame(e: Effect): ReplayEffectFrame {
  return {
    kind: e.kind,
    x: Math.round(e.x),
    y: Math.round(e.y),
    timer: e.timer,
    maxTimer: e.maxTimer,
    radius: e.radius,
    color: e.color,
    secondary: e.secondary,
    toX: e.toX,
    toY: e.toY,
    angle: e.angle,
    delay: e.delay,
    exploded: e.exploded,
    fallHeight: e.fallHeight,
    ownerId: e.ownerId ?? e.followBrawler?.id,
    ownerTeam: e.ownerTeam ?? e.followBrawler?.team,
    damagePerTick: e.damagePerTick,
    tickInterval: e.tickInterval,
    tickTimer: e.tickTimer,
    tickRange: e.tickRange,
    seed: e.seed,
    particleCount: e.particleCount,
    zigzag: e.zigzag?.map(p => ({ x: p.x, y: p.y })),
    linkAId: e.linkAId,
    linkBId: e.linkBId,
    luminaGraceAllies: e.luminaGraceAllies,
    value: e.value,
  };
}

function frameToEffect(f: ReplayEffectFrame): Effect {
  return {
    kind: f.kind,
    x: f.x,
    y: f.y,
    timer: f.timer,
    maxTimer: f.maxTimer,
    radius: f.radius,
    color: f.color,
    secondary: f.secondary,
    toX: f.toX,
    toY: f.toY,
    angle: f.angle,
    delay: f.delay,
    exploded: f.exploded,
    fallHeight: f.fallHeight,
    ownerId: f.ownerId,
    ownerTeam: f.ownerTeam,
    damagePerTick: f.damagePerTick,
    tickInterval: f.tickInterval,
    tickTimer: f.tickTimer,
    tickRange: f.tickRange,
    seed: f.seed,
    particleCount: f.particleCount,
    zigzag: f.zigzag,
    linkAId: f.linkAId,
    linkBId: f.linkBId,
    luminaGraceAllies: f.luminaGraceAllies,
    value: f.value,
  };
}

export function collectReplayVfxFrame(): ReplayVfxFrame | undefined {
  const liveEffects = peekEffects();
  const oliverBugs = getOliverBugs();
  const verdelettaShadows = getVerdelettaShadows();
  const callista = snapshotCallistaMechanics();
  const airin = snapshotAirinMechanics();
  const zephyrin = snapshotZephyrinMechanics();
  const elian = snapshotElianMechanics();
  const octavia = snapshotOctaviaMechanics();
  const silven = snapshotSilvenMechanics();

  const hasMechanics =
    oliverBugs.length > 0
    || verdelettaShadows.length > 0
    || callista.flasks.length > 0
    || callista.zones.length > 0
    || airin.capsules.length > 0
    || airin.zones.length > 0
    || zephyrin.tornados.length > 0
    || elian.orbs.length > 0
    || elian.trails.length > 0
    || elian.vortexes.length > 0
    || octavia.orbs.length > 0
    || octavia.inks.length > 0
    || octavia.traps.length > 0
    || silven.vines.length > 0
    || silven.trees.length > 0
    || silven.dryads.length > 0;

  if (!liveEffects.length && !hasMechanics) return undefined;

  return {
    effects: liveEffects.length ? liveEffects.map(effectToFrame) : undefined,
    oliverBugs: oliverBugs.length ? oliverBugs.map(b => ({ ...b })) : undefined,
    verdelettaShadows: verdelettaShadows.length ? verdelettaShadows.map(s => ({
      ...s,
      statusEffects: s.statusEffects.map(st => ({ ...st })),
    })) : undefined,
    callista: callista.flasks.length || callista.zones.length ? callista : undefined,
    airin: airin.capsules.length || airin.zones.length ? airin : undefined,
    zephyrin: zephyrin.tornados.length ? zephyrin : undefined,
    elian: elian.orbs.length || elian.trails.length || elian.vortexes.length ? elian : undefined,
    octavia: octavia.orbs.length || octavia.inks.length || octavia.traps.length ? octavia : undefined,
    silven: silven.vines.length || silven.trees.length || silven.dryads.length ? silven : undefined,
  };
}

export function applyReplayVfxFrame(vfx: ReplayVfxFrame | undefined): void {
  if (!vfx) {
    clearReplayVfxState();
    return;
  }

  setReplayRenderEffects(vfx.effects?.map(frameToEffect) ?? []);
  restoreOliverBugsSnapshot(vfx.oliverBugs);
  restoreVerdelettaShadowsSnapshot(vfx.verdelettaShadows);
  restoreCallistaMechanicsSnapshot(vfx.callista);
  restoreAirinMechanicsSnapshot(vfx.airin);
  restoreZephyrinMechanicsSnapshot(vfx.zephyrin);
  restoreElianMechanicsSnapshot(vfx.elian);
  restoreOctaviaMechanicsSnapshot(vfx.octavia);
  restoreSilvenMechanicsSnapshot(vfx.silven);
}

export function clearReplayVfxState(): void {
  setReplayRenderEffects(null);
  restoreOliverBugsSnapshot(undefined);
  restoreVerdelettaShadowsSnapshot(undefined);
  restoreCallistaMechanicsSnapshot(undefined);
  restoreAirinMechanicsSnapshot(undefined);
  restoreZephyrinMechanicsSnapshot(undefined);
  restoreElianMechanicsSnapshot(undefined);
  restoreOctaviaMechanicsSnapshot(undefined);
  restoreSilvenMechanicsSnapshot(undefined);
}
