import type { ChestRarity } from "./chests";
import {
  updateProfile,
  getCurrentProfile,
  getAllProfiles,
  saveProfiles,
  findProfileStorageKeyByPlayerId,
  normalizeProfile,
  type UserProfile,
} from "./localStorageAPI";
import { defaultBossRaidSlice } from "./bossRaidProgress";
import { BRAWLERS } from "../entities/BrawlerData";
import { normalizePlayerIdQuery } from "./playerId";
import {
  getClubBossRaidClubIdFromRoster,
  isFullClubPartyForBossRaid,
  readPartyBattleRoster,
} from "./social/partyBattle";

export interface BossRaidLevelReward {
  coins: number;
  powerPoints: number;
  chest?: { rarity: ChestRarity; count: number };
}

export interface BossRaidPendingEntry {
  bossId: string;
  level: number;
  reward: BossRaidLevelReward;
}

export interface MergedBossRaidReward {
  coins: number;
  powerPoints: number;
  chests: Array<{ rarity: ChestRarity; count: number }>;
}

export const BOSS_RAID_PENDING_KEY = "bossRaidPendingClaimV1";

function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Монеты и сила (в 2 раза меньше прежних значений), без гемов. */
const BOSS_RAID_RESOURCE_TIER: Record<number, { coins: number; powerPoints: number }> = {
  1: { coins: 200, powerPoints: 8 },
  2: { coins: 325, powerPoints: 13 },
  3: { coins: 450, powerPoints: 20 },
  4: { coins: 600, powerPoints: 28 },
  5: { coins: 900, powerPoints: 40 },
};

const BOSS_RAID_CHEST_RARITY: Record<number, ChestRarity> = {
  1: "common",
  2: "rare",
  3: "rare",
  4: "epic",
  5: "epic",
};

/**
 * Награда за первое прохождение уровня 1–5 для конкретного босса.
 * Уровни 1–2: только монеты + сила.
 * Уровни 3–5: строго одно из двух — либо те же ресурсы, либо только сундук (не оба сразу);
 * ветка фиксирована для пары (bossId, level), чтобы в UI и при выдаче совпадало.
 */
export function scaleBossRaidLevelReward(
  reward: BossRaidLevelReward,
  multiplier: number,
): BossRaidLevelReward {
  if (multiplier <= 1) return reward;
  return {
    coins: Math.floor(reward.coins * multiplier),
    powerPoints: Math.floor(reward.powerPoints * multiplier),
    chest: reward.chest
      ? { rarity: reward.chest.rarity, count: reward.chest.count * multiplier }
      : undefined,
  };
}

export function getBossRaidLevelReward(
  bossId: string,
  level: number,
  multiplier = 1,
): BossRaidLevelReward {
  const res = BOSS_RAID_RESOURCE_TIER[level];
  const rarity = BOSS_RAID_CHEST_RARITY[level];
  if (!res || !rarity) return { coins: 0, powerPoints: 0 };

  let base: BossRaidLevelReward;
  if (level <= 2) {
    base = { coins: res.coins, powerPoints: res.powerPoints };
  } else {
    const pickChest = (strHash(`${bossId}:${level}:bossRaidReward`) & 1) === 0;
    base = pickChest
      ? { coins: 0, powerPoints: 0, chest: { rarity, count: 1 } }
      : { coins: res.coins, powerPoints: res.powerPoints };
  }
  return scaleBossRaidLevelReward(base, multiplier);
}

export function mergeBossRaidLevelRewards(list: BossRaidLevelReward[]): MergedBossRaidReward {
  let coins = 0;
  let powerPoints = 0;
  const chestMap = new Map<ChestRarity, number>();
  for (const r of list) {
    coins += r.coins;
    powerPoints += r.powerPoints;
    if (r.chest) {
      chestMap.set(r.chest.rarity, (chestMap.get(r.chest.rarity) || 0) + r.chest.count);
    }
  }
  return {
    coins,
    powerPoints,
    chests: [...chestMap.entries()].map(([rarity, count]) => ({ rarity, count })),
  };
}

function readPendingRaw(): BossRaidPendingEntry[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(BOSS_RAID_PENDING_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [];
    return p.filter(
      (x): x is BossRaidPendingEntry =>
        x && typeof x === "object" && typeof (x as BossRaidPendingEntry).bossId === "string" &&
        typeof (x as BossRaidPendingEntry).level === "number" &&
        (x as BossRaidPendingEntry).reward &&
        typeof (x as BossRaidPendingEntry).reward === "object",
    );
  } catch {
    return [];
  }
}

function writePendingRaw(entries: BossRaidPendingEntry[]) {
  if (typeof sessionStorage === "undefined") return;
  if (entries.length === 0) sessionStorage.removeItem(BOSS_RAID_PENDING_KEY);
  else sessionStorage.setItem(BOSS_RAID_PENDING_KEY, JSON.stringify(entries));
}

function readProfilePending(profile: UserProfile | null | undefined): BossRaidPendingEntry[] {
  const raw = (profile as UserProfile & { bossRaidPending?: BossRaidPendingEntry[] })?.bossRaidPending;
  return Array.isArray(raw) ? raw : [];
}

function mergePendingLists(...lists: BossRaidPendingEntry[][]): BossRaidPendingEntry[] {
  const out: BossRaidPendingEntry[] = [];
  for (const list of lists) {
    for (const e of list) {
      if (!out.some(x => x.bossId === e.bossId && x.level === e.level)) out.push(e);
    }
  }
  return out;
}

/** Удаляет из очереди уровни, за которые награда уже записана в профиль. */
export function reconcileBossRaidPendingWithProfile(profile: UserProfile | null): void {
  const raw = readPendingRaw();
  const profPending = readProfilePending(profile);
  if (raw.length === 0 && profPending.length === 0) return;
  const filterFn = (e: BossRaidPendingEntry) => {
    const cl = profile?.bossRaid?.byBoss?.[e.bossId]?.claimedLevels ?? [];
    return !cl.includes(e.level);
  };
  writePendingRaw(raw.filter(filterFn));
  if (profile && profPending.length > 0) {
    const next = profPending.filter(filterFn);
    if (next.length !== profPending.length) {
      updateProfile({ bossRaidPending: next.length ? next : undefined } as Parameters<typeof updateProfile>[0]);
    }
  }
}

function appendPendingUnique(entry: BossRaidPendingEntry): boolean {
  const q = readPendingRaw();
  if (q.some((e) => e.bossId === entry.bossId && e.level === entry.level)) return false;
  q.push(entry);
  writePendingRaw(q);
  return true;
}

export function bossRaidBossDisplayName(bossId: string): string {
  return BRAWLERS.find((b) => b.id === bossId)?.name ?? bossId;
}

const RU_CHEST_RARITY: Record<ChestRarity, string> = {
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
  mythic: "Мистический",
  mega: "Мега",
  ultralegendary: "Ультра",
};

export function formatMergedBossRaidRewardRu(merged: MergedBossRaidReward): string {
  const parts: string[] = [];
  if (merged.coins > 0) parts.push(`+${merged.coins} монет`);
  if (merged.powerPoints > 0) parts.push(`+${merged.powerPoints} силы`);
  for (const c of merged.chests) {
    if (c.count > 0) parts.push(`сундук ${RU_CHEST_RARITY[c.rarity] ?? c.rarity} ×${c.count}`);
  }
  return parts.length ? parts.join(", ") : "—";
}

export interface BossRaidPendingMenuSnapshot {
  /** Строки для модалки (заголовок + по боссам + сумма). */
  lines: string[];
  merged: MergedBossRaidReward;
  validEntries: BossRaidPendingEntry[];
}

export function buildBossRaidPendingMenuSnapshot(profile: UserProfile | null): BossRaidPendingMenuSnapshot | null {
  reconcileBossRaidPendingWithProfile(profile);
  const raw = mergePendingLists(readPendingRaw(), readProfilePending(profile));
  if (raw.length === 0) return null;

  const valid: BossRaidPendingEntry[] = [];
  for (const e of raw) {
    const cl = profile?.bossRaid?.byBoss?.[e.bossId]?.claimedLevels ?? [];
    if (!cl.includes(e.level)) valid.push(e);
  }
  if (valid.length === 0) return null;

  const merged = mergeBossRaidLevelRewards(valid.map((v) => v.reward));
  const byBoss = new Map<string, number[]>();
  for (const e of valid) {
    const arr = byBoss.get(e.bossId) ?? [];
    arr.push(e.level);
    byBoss.set(e.bossId, arr);
  }
  const lines: string[] = [
    "За пройденные уровни рейда вам положена награда (первое прохождение уровней 1–5):",
  ];
  for (const [bossId, levels] of [...byBoss.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const sorted = [...new Set(levels)].sort((a, b) => a - b);
    lines.push(`${bossRaidBossDisplayName(bossId)}: уровни ${sorted.join(", ")}.`);
  }
  lines.push(`Суммарно: ${formatMergedBossRaidRewardRu(merged)}.`);

  return { lines, merged, validEntries: valid };
}

export interface GrantBossRaidRewardResult {
  granted: boolean;
  reward?: BossRaidLevelReward;
  reason?: string;
  clubDouble?: boolean;
}

function applyBossRaidVictoryToProfileObject(
  profile: UserProfile,
  bossId: string,
  level: number,
  multiplier: number,
  appendPending: (entry: BossRaidPendingEntry) => void,
): GrantBossRaidRewardResult {
  const raid = profile.bossRaid ?? defaultBossRaidSlice();
  const per = raid.byBoss[bossId] ?? { maxDefeated: 0, claimedLevels: [] };
  const maxDefeated = Math.max(per.maxDefeated, level);

  let preview: BossRaidLevelReward | undefined;
  let granted = false;

  if (level >= 1 && level <= 5 && !per.claimedLevels.includes(level)) {
    const def = getBossRaidLevelReward(bossId, level, multiplier);
    if (def.coins > 0 || def.powerPoints > 0 || def.chest) {
      granted = true;
      preview = def;
      appendPending({ bossId, level, reward: def });
    }
  }

  profile.bossRaid = {
    ...raid,
    byBoss: {
      ...raid.byBoss,
      [bossId]: { ...per, maxDefeated },
    },
  };

  return granted
    ? { granted: true, reward: preview, clubDouble: multiplier > 1 }
    : { granted: false, reason: "repeat_or_no_tier", clubDouble: multiplier > 1 };
}

function stageBossRaidVictoryOnPlayerId(
  playerId: string,
  bossId: string,
  level: number,
  multiplier: number,
): GrantBossRaidRewardResult {
  const key = findProfileStorageKeyByPlayerId(playerId);
  if (!key) return { granted: false, reason: "no_profile" };
  const all = getAllProfiles();
  const raw = all[key];
  if (!raw) return { granted: false, reason: "no_profile" };

  const profile = normalizeProfile(raw as UserProfile);
  const profPending = [...readProfilePending(profile)];
  let appended: BossRaidPendingEntry | null = null;

  const result = applyBossRaidVictoryToProfileObject(
    profile,
    bossId,
    level,
    multiplier,
    entry => {
      if (!profPending.some(e => e.bossId === entry.bossId && e.level === entry.level)) {
        profPending.push(entry);
        appended = entry;
      }
    },
  );

  (profile as UserProfile & { bossRaidPending?: BossRaidPendingEntry[] }).bossRaidPending =
    profPending.length ? profPending : undefined;
  all[key] = profile;
  saveProfiles(all);

  const me = getCurrentProfile();
  if (me?.playerId && normalizePlayerIdQuery(me.playerId) === normalizePlayerIdQuery(playerId)) {
    updateProfile({
      bossRaid: profile.bossRaid,
      bossRaidPending: profPending.length ? profPending : undefined,
    } as Parameters<typeof updateProfile>[0]);
    if (appended) appendPendingUnique(appended);
  }

  return result;
}

/**
 * Победа в рейде: сохраняем maxDefeated; награду за 1–5 уровень кладём в очередь до «Забрать» в главном меню.
 */
export function stageBossRaidVictory(
  bossId: string,
  level: number,
  multiplier = 1,
): GrantBossRaidRewardResult {
  const profile = getCurrentProfile();
  if (!profile?.playerId) return { granted: false, reason: "no_profile" };
  return stageBossRaidVictoryOnPlayerId(profile.playerId, bossId, level, multiplier);
}

/** Победа в клубном/командном рейде — награды всем в составе; ×2 если вся команда из одного клуба. */
export function applyPartySharedBossRaidVictory(
  bossId: string,
  level: number,
): GrantBossRaidRewardResult {
  const roster = readPartyBattleRoster();
  const clubId = getClubBossRaidClubIdFromRoster(roster);
  const multiplier =
    clubId && isFullClubPartyForBossRaid(roster, clubId) ? 2 : 1;

  if (roster.length <= 1) {
    return stageBossRaidVictory(bossId, level, multiplier);
  }

  let primary: GrantBossRaidRewardResult = { granted: false, reason: "no_profile" };
  for (const entry of roster) {
    const r = stageBossRaidVictoryOnPlayerId(entry.playerId, bossId, level, multiplier);
    if (entry.isMe) primary = r;
  }
  return { ...primary, clubDouble: multiplier > 1 };
}

/** @deprecated Используйте stageBossRaidVictory */
export const finalizeBossRaidVictory = stageBossRaidVictory;

/**
 * Выдаёт награды из очереди в профиль, очищает sessionStorage.
 * @returns данные для анимаций или null, если забирать нечего.
 */
export function claimBossRaidPendingRewards(): {
  merged: MergedBossRaidReward;
  validEntries: BossRaidPendingEntry[];
} | null {
  const profile = getCurrentProfile();
  if (!profile) return null;
  reconcileBossRaidPendingWithProfile(profile);
  const raw = mergePendingLists(readPendingRaw(), readProfilePending(profile));
  if (raw.length === 0) return null;

  const p2 = getCurrentProfile();
  if (!p2) return null;

  const valid: BossRaidPendingEntry[] = [];
  for (const e of raw) {
    const cl = p2.bossRaid?.byBoss?.[e.bossId]?.claimedLevels ?? [];
    if (!cl.includes(e.level)) valid.push(e);
  }
  if (valid.length === 0) {
    writePendingRaw([]);
    return null;
  }

  const merged = mergeBossRaidLevelRewards(valid.map((v) => v.reward));
  let coins = p2.coins + merged.coins;
  let powerPoints = p2.powerPoints + merged.powerPoints;
  const chestInv = { ...p2.chestInventory };
  for (const c of merged.chests) {
    chestInv[c.rarity] = (chestInv[c.rarity] || 0) + c.count;
  }

  const raid = p2.bossRaid ?? defaultBossRaidSlice();
  const byBoss = { ...raid.byBoss };
  for (const e of valid) {
    const per = byBoss[e.bossId] ?? p2.bossRaid?.byBoss?.[e.bossId] ?? { maxDefeated: 0, claimedLevels: [] };
    const claimedLevels = per.claimedLevels.includes(e.level)
      ? [...per.claimedLevels]
      : [...per.claimedLevels, e.level].sort((a, b) => a - b);
    byBoss[e.bossId] = { ...per, claimedLevels };
  }

  updateProfile({
    coins,
    powerPoints,
    chestInventory: chestInv,
    bossRaid: { ...raid, byBoss },
    bossRaidPending: undefined,
  });
  writePendingRaw([]);

  return { merged, validEntries: valid };
}
