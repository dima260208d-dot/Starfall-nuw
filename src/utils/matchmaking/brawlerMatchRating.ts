/**
 * Brawler Match Rating (MRP) — единый рейтинг силы **выбранного** бойца для подбора.
 *
 * Формула:
 *   MRP = 120 × ln(1 + T/80) + 50 × S + 32 × (P − 1)
 *
 * T — кубки на этом бойце (0…∞, логарифм сглаживает разрыв новичок/ветеран)
 * S — звёзды на бойце (0…6)
 * P — уровень силы на бойце (1…11)
 *
 * Пример: T=800, S=3, P=7 → MRP ≈ 120×ln(11) + 150 + 192 ≈ 519
 */
import {
  getBrawlerStars,
  getBrawlerTrophies,
  getCurrentProfile,
  type UserProfile,
} from "../localStorageAPI";
import { getProfileByPlayerId } from "../playerGiftSend";
import { readPartyBattleRoster } from "../social/partyBattle";

export interface BrawlerMatchAnchor {
  brawlerId: string;
  trophies: number;
  stars: number;
  powerLevel: number;
  mrp: number;
}

export interface MatchedBotLoadout {
  powerLevel: number;
  stars: number;
  trophies: number;
  mrp: number;
}

export const MRP_TROPHY_WEIGHT = 120;
export const MRP_STAR_WEIGHT = 50;
export const MRP_POWER_WEIGHT = 32;
export const MRP_TROPHY_SCALE = 80;

export function computeBrawlerMrp(trophies: number, stars: number, powerLevel: number): number {
  const T = Math.max(0, trophies);
  const S = Math.min(6, Math.max(0, stars));
  const P = Math.min(11, Math.max(1, powerLevel));
  return (
    MRP_TROPHY_WEIGHT * Math.log(1 + T / MRP_TROPHY_SCALE)
    + MRP_STAR_WEIGHT * S
    + MRP_POWER_WEIGHT * (P - 1)
  );
}

export function buildMatchAnchor(
  brawlerId: string,
  trophies: number,
  stars: number,
  powerLevel: number,
): BrawlerMatchAnchor {
  return {
    brawlerId,
    trophies: Math.max(0, trophies),
    stars: Math.min(6, Math.max(0, stars)),
    powerLevel: Math.min(11, Math.max(1, powerLevel)),
    mrp: computeBrawlerMrp(trophies, stars, powerLevel),
  };
}

function anchorFromProfile(prof: UserProfile | null, brawlerId: string, level?: number): BrawlerMatchAnchor {
  const bid = brawlerId || prof?.selectedBrawlerId || "hana";
  const trophies = getBrawlerTrophies(prof, bid);
  const stars = getBrawlerStars(prof, bid).length;
  const powerLevel = level ?? prof?.brawlerLevels?.[bid] ?? 1;
  return buildMatchAnchor(bid, trophies, stars, powerLevel);
}

/** Якорь подбора: solo — ваш выбранный боец; в команде — среднее по составу. */
export function getMatchmakingAnchor(): BrawlerMatchAnchor {
  const roster = readPartyBattleRoster();
  if (roster.length <= 1) {
    const me = getCurrentProfile();
    const bid = me?.selectedBrawlerId || "hana";
    return anchorFromProfile(me, bid);
  }

  let sumT = 0;
  let sumS = 0;
  let sumP = 0;
  for (const entry of roster) {
    const prof = getProfileByPlayerId(entry.playerId);
    sumT += getBrawlerTrophies(prof, entry.brawlerId);
    sumS += getBrawlerStars(prof, entry.brawlerId).length;
    sumP += entry.level || prof?.brawlerLevels?.[entry.brawlerId] || 1;
  }
  const n = roster.length;
  return buildMatchAnchor(
    roster[0]!.brawlerId,
    Math.round(sumT / n),
    Math.round(sumS / n),
    Math.round(sumP / n),
  );
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function pickDelta(rng: () => number): number {
  const r = rng();
  if (r < 0.2) return -1;
  if (r < 0.8) return 0;
  return 1;
}

export const MRP_MATCH_TOLERANCE = 50;

/** Генерирует статы бота около якоря (|ΔMRP| ≤ 50). */
export function rollMatchedLoadout(anchor: BrawlerMatchAnchor, slotIndex: number): MatchedBotLoadout {
  const seed = (
    Math.imul(Math.floor(anchor.mrp * 1000), 997)
    ^ Math.imul(anchor.trophies + 1, 7919)
    ^ Math.imul(anchor.stars + 1, 104729)
    ^ Math.imul(slotIndex + 1, 1301)
  ) >>> 0;
  const rng = mulberry32(seed);
  const tolerance = MRP_MATCH_TOLERANCE;

  for (let attempt = 0; attempt < 24; attempt++) {
    const powerLevel = clamp(anchor.powerLevel + pickDelta(rng), 1, 11);
    const stars = clamp(anchor.stars + pickDelta(rng), 0, 6);
    const spread = 0.04 + rng() * 0.08;
    const rawDelta = Math.round(anchor.trophies * (rng() * 2 - 1) * spread);
    const trophyDelta = clamp(rawDelta, -250, 250);
    const trophies = Math.max(0, anchor.trophies + trophyDelta);
    const mrp = computeBrawlerMrp(trophies, stars, powerLevel);
    if (Math.abs(mrp - anchor.mrp) <= tolerance) {
      return { powerLevel, stars, trophies, mrp };
    }
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const powerLevel = clamp(anchor.powerLevel + pickDelta(rng), 1, 11);
    const stars = clamp(anchor.stars + pickDelta(rng), 0, 6);
    const trophies = Math.max(0, anchor.trophies);
    const mrp = computeBrawlerMrp(trophies, stars, powerLevel);
    if (Math.abs(mrp - anchor.mrp) <= tolerance) {
      return { powerLevel, stars, trophies, mrp };
    }
  }

  return {
    powerLevel: anchor.powerLevel,
    stars: anchor.stars,
    trophies: anchor.trophies,
    mrp: anchor.mrp,
  };
}
