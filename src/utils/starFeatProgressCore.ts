import {
  STAR_FEAT_DEFS,
  tierFeatIds,
  type StarFeatDef,
  type StarFeatKind,
  type StarFeatTier,
} from "../data/starFeatsData";

export type StarFeatProgressMap = Record<string, number>;

export type StarFeatProfileSlice = {
  starFeatProgress?: StarFeatProgressMap;
  starFeatTierBadges?: number[];
  starFeatClaimed?: Record<string, boolean>;
  trophies?: number;
  unlockedBrawlers?: string[];
  clashPassLevel?: number;
  clubId?: string | null;
  clashPassPaid?: boolean;
};

const PEAK_KINDS = new Set<StarFeatKind>([
  "earn_trophies",
  "brawlers_unlocked",
  "clash_pass_level",
  "join_club",
]);

function readProgress(profile: StarFeatProfileSlice): StarFeatProgressMap {
  return { ...(profile.starFeatProgress ?? {}) };
}

export function peakValue(profile: StarFeatProfileSlice, kind: StarFeatKind): number {
  switch (kind) {
    case "earn_trophies":
      return profile.trophies ?? 0;
    case "brawlers_unlocked":
      return profile.unlockedBrawlers?.length ?? 0;
    case "clash_pass_level":
      return profile.clashPassLevel ?? 1;
    case "join_club":
      return profile.clubId ? 1 : 0;
    default:
      return 0;
  }
}

function awardTierBadges(profile: StarFeatProfileSlice, prog: StarFeatProgressMap): number[] {
  const earned = new Set(profile.starFeatTierBadges ?? []);
  for (let tier = 1 as StarFeatTier; tier <= 6; tier++) {
    const ids = tierFeatIds(tier);
    const done = ids.every(id => {
      const def = STAR_FEAT_DEFS.find(f => f.id === id);
      if (!def) return true;
      return (prog[id] ?? 0) >= def.target;
    });
    if (done) earned.add(tier);
  }
  return Array.from(earned).sort((a, b) => a - b);
}

export function mergeStarFeatPeaksIntoProfile<T extends StarFeatProfileSlice>(profile: T): T {
  const prog = readProgress(profile);
  let changed = false;
  for (const def of STAR_FEAT_DEFS) {
    if (!PEAK_KINDS.has(def.kind)) continue;
    const v = peakValue(profile, def.kind);
    if ((prog[def.id] ?? 0) < v) {
      prog[def.id] = v;
      changed = true;
    }
  }
  if (!changed) return profile;
  const badges = awardTierBadges(profile, prog);
  return {
    ...profile,
    starFeatProgress: prog,
    starFeatTierBadges: badges,
  };
}

export function getStarFeatProgress(def: StarFeatDef, profile: StarFeatProfileSlice | null | undefined): number {
  if (!profile) return 0;
  if (PEAK_KINDS.has(def.kind)) return Math.min(def.target, peakValue(profile, def.kind));
  return Math.min(def.target, profile.starFeatProgress?.[def.id] ?? 0);
}

export function isStarFeatComplete(def: StarFeatDef, profile: StarFeatProfileSlice | null | undefined): boolean {
  return getStarFeatProgress(def, profile) >= def.target;
}

export function isStarFeatClaimed(def: StarFeatDef, profile: StarFeatProfileSlice | null | undefined): boolean {
  return !!profile?.starFeatClaimed?.[def.id];
}

export function tierCompletionRatio(
  tier: StarFeatTier,
  profile: StarFeatProfileSlice | null | undefined,
): { done: number; total: number } {
  const feats = STAR_FEAT_DEFS.filter(f => f.tier === tier);
  const done = feats.filter(f => isStarFeatComplete(f, profile)).length;
  return { done, total: feats.length };
}

export function hasStarFeatTierBadge(tier: StarFeatTier, profile: StarFeatProfileSlice | null | undefined): boolean {
  return (profile?.starFeatTierBadges ?? []).includes(tier);
}

function isShowdownMode(mode?: string): boolean {
  return mode === "showdown" || mode === "megashowdown" || mode === "monsterhide" || mode === "teamHunt";
}

function metaMatches(def: StarFeatDef, opts?: { brawlerId?: string; mode?: string }): boolean {
  if (def.meta?.mode && opts?.mode !== def.meta.mode) return false;
  if (def.meta?.brawlerId && opts?.brawlerId !== def.meta.brawlerId) return false;
  return true;
}

function kindMatches(def: StarFeatDef, kind: StarFeatKind, opts?: { won?: boolean; mode?: string; place?: number }): boolean {
  if (def.kind !== kind) return false;
  if (!metaMatches(def, opts)) return false;

  if (kind === "win_games" || kind === "win_team" || kind === "win_showdown" || kind === "win_mode" || kind === "win_brawler") {
    if (!opts?.won) return false;
  }
  if (kind === "win_showdown" && !isShowdownMode(opts?.mode)) return false;
  if (kind === "win_team" && (isShowdownMode(opts?.mode) || opts?.mode === "training")) return false;
  if (kind === "win_mode" && def.meta?.mode && opts?.mode !== def.meta.mode) return false;
  if (kind === "place_showdown_top4" && (!isShowdownMode(opts?.mode) || (opts?.place ?? 99) > 4)) return false;
  if (kind === "place_top3" && (!isShowdownMode(opts?.mode) || (opts?.place ?? 99) > 3)) return false;
  if (kind === "place_top1_showdown" && (!isShowdownMode(opts?.mode) || opts?.place !== 1)) return false;
  if (kind === "play_showdown" && !isShowdownMode(opts?.mode)) return false;
  if (kind === "play_team" && (isShowdownMode(opts?.mode) || opts?.mode === "training")) return false;

  return true;
}

export function applyStarFeatIncrement(
  profile: StarFeatProfileSlice,
  kind: StarFeatKind,
  amount: number,
  opts?: { brawlerId?: string; mode?: string; place?: number; won?: boolean },
): StarFeatProfileSlice | null {
  if (amount <= 0) return null;

  const prog = readProgress(profile);
  let changed = false;

  for (const def of STAR_FEAT_DEFS) {
    if (!kindMatches(def, kind, opts)) continue;
    if (PEAK_KINDS.has(kind)) continue;

    const prev = prog[def.id] ?? 0;
    const next = Math.min(def.target, prev + amount);
    if (next !== prev) {
      prog[def.id] = next;
      changed = true;
    }
  }

  if (!changed) {
    const peaked = mergeStarFeatPeaksIntoProfile(profile);
    return peaked === profile ? null : peaked;
  }

  const merged: StarFeatProfileSlice = {
    ...profile,
    starFeatProgress: prog,
    starFeatTierBadges: awardTierBadges(profile, prog),
  };
  return mergeStarFeatPeaksIntoProfile(merged);
}

export type StarFeatBattleContext = {
  won: boolean;
  mode: string;
  place: number;
  killCount: number;
  damageDealt: number;
  healingDone: number;
  superUses: number;
  powerCubesCollected: number;
  trophyDelta: number;
  monsterKills: number;
  brawlerId: string;
};

export function applyStarFeatsFromBattle(
  profile: StarFeatProfileSlice,
  ctx: StarFeatBattleContext,
): StarFeatProfileSlice {
  let p = profile;
  const opts = { mode: ctx.mode, brawlerId: ctx.brawlerId, won: ctx.won, place: ctx.place };
  const steps: Array<[StarFeatKind, number]> = [
    ["play_games", 1],
    ["play_brawler", 1],
    ["play_mode", 1],
  ];

  if (ctx.mode !== "training") {
    if (isShowdownMode(ctx.mode)) steps.push(["play_showdown", 1]);
    else steps.push(["play_team", 1]);
  }

  if (ctx.won) {
    steps.push(["win_games", 1], ["win_brawler", 1], ["win_mode", 1]);
    if (isShowdownMode(ctx.mode)) steps.push(["win_showdown", 1]);
    else if (ctx.mode !== "training") steps.push(["win_team", 1]);
  }

  if (isShowdownMode(ctx.mode)) {
    if (ctx.place <= 4) steps.push(["place_showdown_top4", 1]);
    if (ctx.place <= 3) steps.push(["place_top3", 1]);
    if (ctx.place === 1) steps.push(["place_top1_showdown", 1]);
  }

  if (ctx.killCount > 0) {
    steps.push(["kill_enemies", ctx.killCount], ["kill_brawler", ctx.killCount]);
  }
  if (ctx.damageDealt > 0) steps.push(["deal_damage", ctx.damageDealt]);
  if (ctx.healingDone > 0) steps.push(["heal_hp", ctx.healingDone]);
  if (ctx.superUses > 0) steps.push(["use_super", ctx.superUses]);
  if (ctx.powerCubesCollected > 0) steps.push(["collect_powercubes", ctx.powerCubesCollected]);
  if (ctx.monsterKills > 0) steps.push(["kill_monsters", ctx.monsterKills]);

  for (const [kind, amount] of steps) {
    const next = applyStarFeatIncrement(p, kind, amount, opts);
    if (next) p = next;
  }
  return mergeStarFeatPeaksIntoProfile(p);
}

export function countUnclaimedStarFeatRewards(profile: StarFeatProfileSlice | null | undefined): number {
  if (!profile) return 0;
  const synced = mergeStarFeatPeaksIntoProfile(profile);
  let n = 0;
  for (const def of STAR_FEAT_DEFS) {
    if (!isStarFeatComplete(def, synced)) continue;
    if (!isStarFeatClaimed(def, synced)) n++;
  }
  return n;
}

export function countUnclaimedStarFeatRewardsForTier(
  tier: StarFeatTier,
  profile: StarFeatProfileSlice | null | undefined,
): number {
  if (!profile) return 0;
  const synced = mergeStarFeatPeaksIntoProfile(profile);
  let n = 0;
  for (const def of STAR_FEAT_DEFS) {
    if (def.tier !== tier) continue;
    if (!isStarFeatComplete(def, synced)) continue;
    if (!isStarFeatClaimed(def, synced)) n++;
  }
  return n;
}

export function getStarFeatMenuBadgeCount(profile: StarFeatProfileSlice | null | undefined): number | undefined {
  if (!profile) return undefined;
  const unclaimed = countUnclaimedStarFeatRewards(profile);
  if (unclaimed > 0) return unclaimed;
  const synced = mergeStarFeatPeaksIntoProfile(profile);
  let near = 0;
  for (const def of STAR_FEAT_DEFS) {
    if (isStarFeatComplete(def, synced)) continue;
    const cur = getStarFeatProgress(def, synced);
    if (cur >= def.target * 0.85) near++;
  }
  return near > 0 ? near : undefined;
}
