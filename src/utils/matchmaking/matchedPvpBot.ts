import type { BrawlerStats } from "../../entities/BrawlerData";
import { getBrawlerById } from "../../entities/BrawlerData";
import { Bot } from "../../entities/Bot";
import type { Brawler } from "../../entities/Brawler";
import type { Team } from "../../entities/Brawler";
import { PETS } from "../../entities/PetData";
import { isHeadlessSim } from "../../ai/aiHeadlessContext";
import { randomInt } from "../helpers";
import {
  getBrawlerTrophies,
  getCurrentProfile,
} from "../localStorageAPI";
import { getProfileRankedCups } from "../rankedProgress";
import {
  getRankedBattleSession,
  isRankedBattleSession,
  type RankedDraftParticipant,
} from "../rankedMapPick";
import { createPartyAllyBot, type PartyBattleRosterEntry } from "../social/partyBattle";
import {
  getMatchmakingAnchor,
  rollMatchedLoadout,
  type MatchedBotLoadout,
} from "./brawlerMatchRating";

function applyBotLoadout(bot: Bot, loadout: MatchedBotLoadout): void {
  bot.level = loadout.powerLevel;
  bot.constellationStars = Array.from({ length: loadout.stars }, (_, i) => i + 1);
  bot.matchTrophies = loadout.trophies;
}

function findRankedParticipant(slotId: string): RankedDraftParticipant | null {
  const roster = getRankedBattleSession()?.roster;
  if (!roster?.length) return null;
  return roster.find(r => r.slotId === slotId) ?? null;
}

/** Бот из рангового драфта с реальными силой, звёздами и ранговыми кубками. */
export function createRankedDraftBot(
  slotId: string,
  fallbackStats: BrawlerStats,
  x: number,
  y: number,
  team: Team,
): Bot | null {
  const draft = findRankedParticipant(slotId);
  if (!draft) return null;

  const stats = getBrawlerById(draft.brawlerId) || fallbackStats;
  const bot = new Bot(stats, draft.powerLevel, x, y, team);
  bot.setIdentity(draft.displayName, true);
  bot.constellationStars = Array.from({ length: draft.stars }, (_, i) => i + 1);
  bot.matchRankedCups = draft.rankedCups;
  bot.matchTrophies = draft.rankedCups;

  if (draft.petId) {
    const pet = PETS.find(p => p.id === draft.petId);
    bot.setEquippedPet(pet ?? null);
  } else {
    bot.setEquippedPet(null);
  }
  return bot;
}

/** Бот-соперник / союзник, подобранный по MRP игрока (или из рангового драфта). */
export function createMatchedPvpBot(
  stats: BrawlerStats,
  x: number,
  y: number,
  team: Team,
  slotIndex: number,
  rankedSlotId?: string,
): Bot {
  if (isHeadlessSim()) {
    return new Bot(stats, randomInt(1, 5), x, y, team);
  }

  if (rankedSlotId) {
    const rankedBot = createRankedDraftBot(rankedSlotId, stats, x, y, team);
    if (rankedBot) return rankedBot;
  }

  const anchor = getMatchmakingAnchor();
  const loadout = rollMatchedLoadout(anchor, slotIndex);
  const bot = new Bot(stats, loadout.powerLevel, x, y, team);
  applyBotLoadout(bot, loadout);
  return bot;
}

export function legacyFakeBotTrophies(name: string): number {
  return 300 + ((name.charCodeAt(0) * 37 + (name.charCodeAt(1) || 5) * 13) % 1700);
}

export function trophiesForBattleParticipant(b: Brawler, isPlayer: boolean): number {
  if (isRankedBattleSession()) {
    if (isPlayer) {
      const prof = getCurrentProfile();
      return getProfileRankedCups(prof!);
    }
    if (b.matchRankedCups != null) return b.matchRankedCups;
  }
  if (isPlayer) {
    const prof = getCurrentProfile();
    return getBrawlerTrophies(prof, b.stats.id);
  }
  if (b.matchTrophies != null) return b.matchTrophies;
  return legacyFakeBotTrophies(b.displayName || "B");
}

/** Союзник: человек из команды или бот по MRP / ранговому драфту. */
export function createPvpAllyBot(
  slotIndex: number,
  partyEntry: PartyBattleRosterEntry | undefined,
  fallbackStats: BrawlerStats,
  x: number,
  y: number,
): Bot {
  if (partyEntry) {
    return createPartyAllyBot(partyEntry, x, y, "blue");
  }
  const rankedSlotId = isRankedBattleSession() ? `b${slotIndex}` : undefined;
  return createMatchedPvpBot(fallbackStats, x, y, "blue", slotIndex, rankedSlotId);
}

/** Соперник по MRP / ранговому драфту. */
export function createPvpEnemyBot(
  enemyIndex: number,
  fallbackStats: BrawlerStats,
  x: number,
  y: number,
  mrpSlotIndex: number,
): Bot {
  const rankedSlotId = isRankedBattleSession() ? `r${enemyIndex}` : undefined;
  return createMatchedPvpBot(fallbackStats, x, y, "red", mrpSlotIndex, rankedSlotId);
}
