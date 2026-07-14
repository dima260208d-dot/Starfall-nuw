import { isSubscriberNameColor } from "../data/subscriberNameColors";
import { grantExclusiveTitle, DEVELOPER_TITLE_ID } from "../data/exclusiveTitles";
import { isDeveloperUsername } from "./developerAccounts";
import { PETS, getPetById } from "../entities/PetData";
import type { ChestRarity } from "./chests";
import { applyTreasuryOnResourceGrant } from "./clubTreasury";
import { guardianBlockResult } from "../ai/contentGuardian";
import { guardianModerateWithBuiltIn } from "../ai/contentGuardianAi";
import { CHESTS, CHEST_RARITY_ORDER, rollChestRewards, type ChestRoll } from "./chests";
import { DAILY_LADDER, getRewardForDay } from "./dailyLadder";
import { getGameDayKeyInt, getMsUntilGameDayReset } from "./gameDay";
import { getLuckyRushBattleBonuses, luckyRushCoinMultiplier, isLuckyRushActive } from "./luckyRush";
import {
  normalizeDailyWinsState,
  dailyWinsHasClaimable,
  dailyWinsStatesEqual,
  type DailyWinsState,
} from "./dailyWins";
import { rewardInfoFromDailyWinsSlot, dailyWinsSlotProfilePatch } from "./dailyWinsRewards";
import { queueMenuDailyWinsFx } from "./dailyWinsMenuFx";
import type { RewardInfo } from "../components/RewardDropModal";
import {
  generateDailyQuests, isQuestsExpired,
  buildFreshQuestPoolForUnlocked, addDailyQuestsForUnlocked, addWeeklyQuestsForUnlocked,
  addPaidQuestsForUnlocked,
  isDailyExpired, isWeeklyExpired, isPaidExpired,
  DAILY_QUEST_COUNT, WEEKLY_QUEST_COUNT, PAID_QUEST_COUNT,
  type DailyQuestsState, type QuestKind, type QuestPool, type QuestMeta, type QuestState,
} from "./quests";
import { getStarFeatDef } from "../data/starFeatsData";
import {
  applyStarFeatIncrement,
  applyStarFeatsFromBattle,
  isStarFeatClaimed,
  isStarFeatComplete,
  mergeStarFeatPeaksIntoProfile,
  type StarFeatBattleContext,
  type StarFeatKind,
} from "./starFeatProgressCore";
import {
  BRAWLERS,
  BRAWLER_GEM_COST,
  MAX_BRAWLER_LEVEL,
  brawlerCanDropFromChestTier,
  pickWeightedBrawlerFromPool,
} from "../entities/BrawlerData";
import {
  CHEST_PROFILE_ICON_DROP_CHANCE,
  grantProfileIcon,
  isProfileIconUnlocked,
  pickRandomLockedStoredIcon,
  PROFILE_ICON_GEM_COST,
  canBuyProfileIconInShop,
} from "./profileIconUtils";
import { PROFILE_ICON_BY_ID, REMOVED_PROFILE_ICON_IDS } from "../data/profileIcons";
import {
  DEFAULT_PORTRAIT_BACKGROUND_ID,
  PORTRAIT_BACKGROUND_BY_ID,
  PORTRAIT_BG_GEM_COST,
} from "../data/portraitBackgrounds";
import { BRAWLER_TRAIL_BY_ID, TRAIL_GEM_COST } from "../data/brawlerTrails";
import { getEquippedTrailForBrawler, isTrailOwned } from "./trailEquip";
import {
  ensureDefaultPortraitBackgroundUnlocked,
  isPortraitBackgroundUnlocked,
} from "./portraitBackgroundUtils";
import {
  getIntroDisplayIconIds,
  normalizeIntroDisplayIconIds,
  type IntroDisplayIconSlot,
} from "./introDisplayIcons";
import {
  applyProfileIconRewardToUpdates,
  buildProfileIconReward,
  profileIconIdForSlot,
  profileIconRewardLabel,
} from "./profileIconRewards";
import {
  collectUsedPlayerIds,
  generateUniquePlayerId,
  isValidPlayerIdFormat,
  normalizePlayerIdQuery,
} from "./playerId";

export { MAX_BRAWLER_LEVEL };
import {
  PETS, PET_GEM_COST, CHEST_PET_DROP_CHANCE, CHEST_PET_RARITY_WEIGHTS,
  type PetRarity,
} from "../entities/PetData";
import {
  getEffectiveBrawlerGemCost,
  getEffectiveChestPrices,
  getEffectiveConstellation,
  getEffectivePetGemCost,
  getEffectiveStarCosts,
  getEffectiveUpgradeCost,
} from "./characterBalance";
import {
  getEffectiveChestDrops,
  getEffectiveExtraDrops,
  getEffectivePetDropChance,
  getEffectivePinDropChance,
  getEffectiveProfileIconDropChance,
  isChestRollTypeDisabled,
  rollEffectiveChestBrawlerTier,
} from "./chestBalance";
import {
  BRAWLER_CONSTELLATIONS,
  MAX_STARS_PER_BRAWLER,
  STAR_COST_GEMS,
  STAR_PACK3_COST_GEMS,
  type BrawlerStarDef,
} from "./constellations";
import {
  defaultPinsForBrawler, defaultUniversalPins, defaultEquippedPins,
  isUniversalPinId, isCollectiblePinId, parsePinId, pinCostGems, getCollectiblePin,
  PIN_EQUIP_SLOTS, slotAcceptsPin, migrateEquippedPinSlots,
} from "../entities/PinData";
import {
  COLLECTIBLE_PINS,
  REMOVED_PIN_IDS,
  CHEST_PIN_DROP_CHANCE,
  CHEST_PIN_RARITY_WEIGHTS,
  STAR_PASS_FREE_PIN_LEVELS,
  STAR_PASS_FREE_PIN_IDS,
  STAR_PASS_FREE_ICON_LEVELS,
  STAR_PASS_PAID_PIN_LEVELS,
  STAR_PASS_PAID_PIN_IDS,
  DAILY_LADDER_PIN_DAYS,
  BRAWLER_RANK_PIN_REWARDS,
  PIN_DUPLICATE_COINS,
  COMMON_COLLECTIBLE_PIN_IDS,
  type CollectiblePinRarity,
  PIN_PUBLIC_LABEL,
} from "../entities/CollectiblePinData";
import { isPassExclusivePin, STAR_PASS_FREE_ICON_IDS } from "./passExclusiveCollectibles";

export interface BattleHistoryParticipant {
  brawlerId: string;
  displayName: string;
  team: "blue" | "red";
  rawTeam?: string;
  isPlayer: boolean;
  level: number;
  trophies: number;
  rank: number;
  starCount: number;
  playerId?: string;
  isBot?: boolean;
}

export interface BattleRecord {
  id: string;                  // uuid-like timestamp+random
  ts: number;                  // unix ms
  mode: string;
  brawlerId: string;           // player brawler used
  won: boolean;
  place: number;
  totalPlayers: number;
  trophyDelta: number;
  xpGained: number;
  coinsEarned: number;
  durationSec?: number;
  enemies: Array<{ id: string; name: string; isBot: boolean }>;
  /** Full roster with stats for history cards. */
  teams?: BattleHistoryParticipant[];
  scoreBlue?: number;
  scoreRed?: number;
  replayId?: string;
  mapId?: string;
  myTeam?: string;
  showdownFormat?: "solo" | "duo" | "trio";
  bossId?: string;
  bossLevel?: number;
  wavesCleared?: number;
}

/** Stored on `UserProfile.bossRaid`. */
export interface BossRaidProfileSlice {
  byBoss: Record<string, { maxDefeated: number; claimedLevels: number[] }>;
}

/** Stored on `UserProfile.siege`. */
export interface SiegeProfileSlice {
  maxDefeated: number;
}

export type PurchaseCategory =
  | "donate_gems"
  | "donate_coins"
  | "donate_power"
  | "gem_exchange"
  | "pass"
  | "pass_ultra"
  | "subscription";

export interface PurchaseRecord {
  id: string;
  ts: number;
  category: PurchaseCategory;
  title: string;
  priceRub?: number;
  gemsSpent?: number;
  rewardSummary?: string;
}

export interface UserProfile {
  username: string;
  /** Уникальный ID аккаунта (12 символов без #; в UI — с #). */
  playerId?: string;
  /** E-mail для зарегистрированного аккаунта (локально). */
  email?: string;
  passwordHash: string;
  coins: number;
  gems: number;
  powerPoints: number;
  brawlerLevels: Record<string, number>;
  brawlerSkins: Record<string, string[]>;
  lastDailyBonus: number;
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  trophies: number;
  /** Highest account trophy total ever reached. */
  trophyPeak?: number;
  xp: number;
  clashPassLevel: number;
  clashPassClaimed: number[];
  // Premium (paid) Star Pass — unlocked once via mock 450₽ purchase.
  // While false, paid-track rewards are visually locked and cannot be claimed.
  // Once true, the user may retroactively claim every paid reward up to the
  // current clashPassLevel.
  clashPassPaid?: boolean;
  clashPassClaimedPaid?: number[];
  /** Ultra track (699₽) — chests/resources only. */
  clashPassUltraPaid?: boolean;
  clashPassClaimedUltra?: number[];
  /** Claimed infinite tiers (1-based), after level 100. */
  clashPassInfiniteClaimed?: number[];
  passDailyBattleDay?: number;
  passDailyBattleFreeLeft?: number;
  passDailyBattlePaidLeft?: number;
  trophyRoadClaimed: number[];
  modeStats: Record<string, { games: number; wins: number; losses: number }>;
  favoriteBrawlerId: string;
  /** Pin shown on the profile favorite-brawler card (must be in ownedPins). */
  favoritePinId?: string;
  /** Player profile icon (brawler avatar or misc collectible). */
  profileIconId?: string;
  /** Two icons on intro / favorite-card name bar (slots 0–1). */
  introDisplayIconIds?: string[];
  /** Extra profile icons unlocked from chests (misc with unlock.type stored). */
  unlockedProfileIcons?: string[];
  /** Portrait frame backgrounds for favorite / battle intro cards. */
  unlockedPortraitBackgrounds?: string[];
  equippedPortraitBackgroundId?: string;
  /** Purchased motion trail cosmetics (200 gems each). */
  ownedMotionTrails?: string[];
  /** Global trail for all brawlers (when mode is global). */
  equippedMotionTrailGlobalId?: string | null;
  /** Per-brawler trail override id. */
  equippedMotionTrailByBrawler?: Record<string, string>;
  /** global = use equippedMotionTrailGlobalId; individual = per-brawler id. */
  brawlerTrailMode?: Record<string, "global" | "individual">;
  /** Display name color in profile UI only — battle always shows white. */
  usernameColor?: string;
  /** Timestamp (ms) of last viewed club chat message — drives nav badge. */
  clubChatLastReadAt?: number;
  selectedBrawlerId: string;
  selectedMode: string;
  selectedShowdownFormat?: "solo" | "duo" | "trio";
  selectedStarStrikeFormat?: "3v3" | "5v5";
  lastResult?: {
    place: number;
    trophyDelta: number;
    xpGained: number;
    mode: string;
    won: boolean;
    winStreak?: number;
    winStreakBonus?: number;
    masteryXpGained?: number;
    masteryLeaderBonus?: number;
    /** Monster Hide: +1 trophy per monster killed (shown separately on results). */
    monsterKillTrophyBonus?: number;
    /** Ranked battle cup change (not trophy road). */
    rankedCupDelta?: number;
    rankedBattle?: boolean;
    /** Player-created map battle (no trophies). */
    playerMapBattle?: boolean;
    /** Pro Star Pass tokens gained this match (after ×2 if paid). */
    proStarPassTokensGained?: number;
  };
  /** Последняя успешная синхронизация профиля с облаком (ms). */
  cloudSyncedAt?: number;
  /** Локальное изменение профиля (ms) — для облачной синхронизации. */
  profileLocalRev?: number;
  battleHistory?: BattleRecord[];
  createdAt: number;

  // Daily ladder (rotating 30-day rewards)
  dailyLadderDay: number;            // current day (1..30, then loops back to 1)
  dailyLadderLastClaim: number;      // unix ms of last claim (legacy)
  /** Игровой день (YYYYMMDD), когда последний раз брали ежедневный бонус. */
  dailyLadderClaimedDayKey?: number;

  // Daily quests (legacy, kept for backward compat)
  dailyQuests?: DailyQuestsState;
  // New accumulated quest pool (daily + weekly, max 50)
  questPool?: QuestPool;

  /** Progress for star feats (feat id -> current value). */
  starFeatProgress?: Record<string, number>;
  /** Earned tier badges (1..6) when all feats in tier are complete. */
  starFeatTierBadges?: number[];
  /** Claimed per-feat rewards (feat id -> true). */
  starFeatClaimed?: Record<string, boolean>;

  // Chest inventory: how many of each rarity the player owns (unopened)
  chestInventory: Record<ChestRarity, number>;

  // List of brawler IDs the player has unlocked. Locked brawlers can still
  // be tried in Training mode but cannot be set as the active brawler.
  unlockedBrawlers: string[];

  // Per-brawler trophy count (0..MAX_BRAWLER_TROPHIES). Awarded alongside
  // the global trophy count on every match end, scoped to whichever brawler
  // the player used. Drives the per-brawler rank ladder (1..100).
  brawlerTrophies: Record<string, number>;
  /** Peak per-brawler trophies (for rank bar ghost fill after losses). */
  brawlerTrophyPeak?: Record<string, number>;
  /** Current win streak per brawler (trophy modes only). */
  brawlerWinStreak?: Record<string, number>;
  /** Best win streak record per brawler (never decreases). */
  brawlerWinStreakPeak?: Record<string, number>;
  // Per-brawler list of claimed rank rewards (rank numbers 1..100).
  brawlerRankClaimed: Record<string, number[]>;

  /** Per-brawler mastery XP (0..3000). */
  brawlerMasteryXp?: Record<string, number>;
  /** Claimed mastery level rewards per brawler (1..27). */
  brawlerMasteryClaimed?: Record<string, number[]>;
  /** Unlocked mastery title ids (`mastery_title:brawlerId`). */
  masteryTitlesUnlocked?: string[];
  /** Equipped mastery title shown under username in profile and results. */
  equippedMasteryTitle?: string;

  // "pc": keyboard + mouse. "mobile": on-screen joysticks (move / attack /
  // super). Defaults to "mobile" on touch devices, "pc" otherwise.
  controlMode: "pc" | "mobile";

  // IDs of brawlers recently unlocked but not yet viewed in the collection.
  newBrawlers?: string[];
  // Per-brawler unlocked star indices (1..6).
  brawlerStars?: Record<string, number[]>;
  /** Free star from duplicate brawler chest drop — player picks slot in collection. */
  pendingBrawlerStarPicks?: string[];

  /** Daily win streak rewards (10 slots per calendar day). */
  dailyWins?: DailyWinsState;

  // ── Pets ───────────────────────────────────────────────────────────────────
  // Pets drop from chests in parallel with brawlers (independent roll) and
  // can be bought in the shop with gems. The equipped pet appears as a
  // follower in battle and grants a passive effect.
  unlockedPets?: string[];
  equippedPetId?: string | null;
  /** Per-pet custom nicknames set by the player (petId → name). */
  petCustomNames?: Record<string, string>;
  newPets?: string[]; // pets recently obtained, not yet viewed in pets page

  // ── Pins (emotes) ──────────────────────────────────────────────────────────
  // Owned pin ids (universal "u_*" or character "pin:<brawlerId>:<kind>") and
  // the per-brawler equipped quick-use slots used by the in-battle messenger.
  ownedPins?: string[];
  equippedPinsBy?: Record<string, string[]>; // brawlerId -> up to PIN_EQUIP_SLOTS ids

  // ── Star Guardian subscription + Astral assistant ─────────────────────────
  // Free-form payload; the canonical shape lives in src/utils/subscription.ts
  // and src/ai/AstralAssistant.ts. Both are optional so legacy profiles keep
  // working without migration.
  starGuardian?: unknown;
  astralSettings?: unknown;
  /** Guest onboarding training (move / attack / super) completed once. */
  onboardingTutorialCompleted?: boolean;
  /** Battle tutorial finished; post-battle character guide may follow. */
  onboardingBattleTutorialCompleted?: boolean;
  onboardingPostBattleGuideActive?: boolean;
  onboardingPostBattleGuideStep?: string;
  /** Trophy unlock guide: features already explained by Astral. */
  trophyUnlockGuideDone?: string[];
  /** Queue of newly unlocked features waiting for Astral guide (one at a time). */
  trophyUnlockGuideQueue?: string[];
  /** Modes where first-play in-battle hints were shown. */
  modeFirstPlayHintsDone?: string[];
  /** Lucky 10 Minutes daily rush schedule. */
  luckyRushCycleIndex?: number;
  luckyRushOfferDayKey?: number;
  luckyRushActivatedDayKey?: number;
  luckyRushActiveType?: string;
  luckyRushActiveUntil?: number;
  luckyRushRestUntil?: number;
  donateFlags?: unknown;
  /** История покупок за рубли / донат (локально). */
  purchaseHistory?: PurchaseRecord[];

  /** Цепочка подарков для зарегистрированных новичков (16 наград, 24 ч между). */
  newcomerGifts?: import("./newcomerGifts").NewcomerGiftsState;

  // ── Boss raid (PvE) ───────────────────────────────────────────────────────
  /** Per-boss progress: max defeated level, first-clear claims for levels 1–5. */
  bossRaid?: BossRaidProfileSlice;
  /** Прогресс режима осады (уровни 1–5). */
  siege?: SiegeProfileSlice;

  // ── Ranked battle ─────────────────────────────────────────────────────────
  /** Total ranked cups (league ladder; separate from trophies). */
  rankedCups?: number;
  /** Highest ranked cups ever reached (for best-league profile stat). */
  rankedPeakCups?: number;
  rankedGames?: number;
  rankedWins?: number;
  rankedLosses?: number;
  /** Per-brawler ranked cups for brawler ranked rank display. */
  brawlerRankedCups?: Record<string, number>;
  /** Last ranked match result for results screen. */
  lastRankedResult?: {
    delta: number;
    won: boolean;
    mode: string;
    beforeLeagueId: string;
    afterLeagueId: string;
  };

  /** Pro Star Pass (ranked battle menu). */
  proStarPassTokens?: number;
  proStarPassClaimed?: number[];
  proStarPassPaid?: boolean;
  proStarPassClaimedPaid?: number[];
  /** Global tier indices (0-based) for which tier-up bonus was already granted. */
  proStarPassTierBonusesClaimed?: string[];
  /** Legacy combined infinite claim count. */
  proStarPassInfiniteClaimed?: number;
  proStarPassInfiniteClaimedFree?: number;
  proStarPassInfiniteClaimedPaid?: number;
  /** Очередь наград рейда (для напарников в клубном походе). */
  bossRaidPending?: import("./bossRaidRewards").BossRaidPendingEntry[];

  // ── Clubs (guilds) ─────────────────────────────────────────────────────────
  // Kept directly on the user profile so club membership survives reloads.
  clubId?: string | null;
  clubInvites?: string[];
  clubRewardLog?: string[];
  /** Клубная сокровищница — % отчислений и история. */
  clubTreasury?: import("./clubTreasury").ClubTreasuryProfileState;

  // ── Friends & party ────────────────────────────────────────────────────────
  friends?: Array<{ playerId: string; username: string; addedAt: number }>;
  /** Per-friend bond: XP, claimed level rewards, friendship title. */
  friendships?: Record<string, {
    xp: number;
    claimedLevels: number[];
    titleProposal?: string;
    titleVote?: string;
    confirmedTitle?: string;
    titlePromptDismissed?: boolean;
  }>;
  pendingFriendshipLevelUps?: Array<{
    friendPlayerId: string;
    friendUsername: string;
    level: number;
  }>;
  socialPresence?: { screen: "menu" | "results" | "battle" | "offline"; updatedAt: number };
  partyCode?: string | null;
  partyInviteIncoming?: {
    code: string;
    fromPlayerId: string;
    fromUsername: string;
    sentAt: number;
  };
  outgoingPartyInvite?: {
    targetPlayerId: string;
    targetUsername: string;
    sentAt: number;
    side?: "left" | "right";
  };
  outgoingPartyInvites?: Array<{
    targetPlayerId: string;
    targetUsername: string;
    sentAt: number;
    side?: "left" | "right" | "back1_left" | "back1_right" | "back2_left" | "back2_right";
  }>;
  /** Dev/test: бот-друг автоматически принимает приглашение в команду. */
  socialTestAutoAcceptParty?: boolean;

  /** Входящие: подарки, рассылки и ответы разработчиков (см. messages.ts). */
  inbox?: Array<{
    id: string;
    kind: "system" | "gift";
    title: string;
    body: string;
    sentAt: number;
    read: boolean;
    giftId?: string;
    threadId?: string;
    attachment?: { kind: "image" | "link"; url: string };
  }>;
  /** Очередь подарков от администратора (см. gifts.ts). */
  pendingGifts?: Array<{
    id: string;
    message: string;
    items: unknown[];
    sentAt: number;
    fromAdmin: string;
  }>;

  /** Заблокирован администратором — вход в аккаунт запрещён. */
  accountBlocked?: boolean;
  blockedAt?: number;

  /** Покупки акций дня (instanceId за сегодня). */
  boughtDeals?: import("./dailyDeals").DealsBoughtRecord;
  /** Персональный набор акций на сегодня. */
  dailyShopDeals?: import("./dailyDeals").DailyShopDealsSnapshot;
}

export type ControlMode = "pc" | "mobile";

function detectDefaultControlMode(): ControlMode {
  if (typeof window === "undefined") return "pc";
  // Keep in sync with platform auto-detection (see src/platform/platformDetect.ts).
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const touch =
    "ontouchstart" in window ||
    (typeof navigator !== "undefined" && (navigator as any).maxTouchPoints > 0);
  if (shortSide <= 520 && touch) return "mobile";
  if (shortSide <= 900 || (touch && shortSide <= 1024)) return "mobile";
  return "pc";
}

export function getControlMode(): ControlMode {
  return getCurrentProfile()?.controlMode ?? detectDefaultControlMode();
}

export function setControlMode(mode: ControlMode): void {
  updateProfile({ controlMode: mode });
}

export const MAX_TROPHIES = 100000;
export const MAX_CLASHPASS_LEVEL = 100;
/** Pass XP per level after reaching level 100 (infinite track). */
export const INFINITE_PASS_XP_PER_LEVEL = 2000;
export const SKIP_PASS_LEVEL_GEM_COST = 45;
export const CLASH_PASS_ULTRA_PRICE_RUB = 699;
/** From this level onward each step requires 1000 pass XP. */
export const CLASHPASS_XP_CAP_LEVEL = 50;
export const RENAME_GEM_COST = 50;

/** Daily Star Pass XP from battle wins (resets each calendar day). */
export const PASS_DAILY_BATTLE_XP_FREE = 500;
export const PASS_DAILY_BATTLE_XP_PAID = 1000;
export const PASS_DAILY_BATTLE_XP_WIN_MIN = 50;
export const PASS_DAILY_BATTLE_XP_WIN_MAX = 100;

export function clashPassXpForLevel(level: number): number {
  if (level < 1) return 150;
  if (level >= MAX_CLASHPASS_LEVEL) return INFINITE_PASS_XP_PER_LEVEL;
  if (level >= CLASHPASS_XP_CAP_LEVEL) return 1000;
  return Math.round(150 + ((level - 1) / (CLASHPASS_XP_CAP_LEVEL - 2)) * (1000 - 150));
}

export function clashPassInfiniteTier(level: number): number {
  return Math.max(0, level - MAX_CLASHPASS_LEVEL);
}

export function isClashPassInfinite(level: number): boolean {
  return level > MAX_CLASHPASS_LEVEL;
}

function passDailyBattleDayKey(ts = Date.now()): number {
  return getGameDayKeyInt(ts);
}

function ensurePassDailyBattleState(profile: UserProfile): {
  dayKey: number;
  freeLeft: number;
  paidLeft: number;
} {
  const today = passDailyBattleDayKey();
  const storedDay = profile.passDailyBattleDay ?? 0;
  if (storedDay !== today) {
    return {
      dayKey: today,
      freeLeft: PASS_DAILY_BATTLE_XP_FREE,
      paidLeft: profile.clashPassPaid ? PASS_DAILY_BATTLE_XP_PAID : 0,
    };
  }
  return {
    dayKey: today,
    freeLeft: Math.max(0, profile.passDailyBattleFreeLeft ?? PASS_DAILY_BATTLE_XP_FREE),
    paidLeft: profile.clashPassPaid
      ? Math.max(0, profile.passDailyBattlePaidLeft ?? PASS_DAILY_BATTLE_XP_PAID)
      : 0,
  };
}

export function getPassDailyBattleXpStatus(profile: UserProfile | null = getCurrentProfile()) {
  if (!profile) {
    return {
      freeLeft: 0, freeMax: PASS_DAILY_BATTLE_XP_FREE,
      paidLeft: 0, paidMax: PASS_DAILY_BATTLE_XP_PAID,
      hasPaid: false,
    };
  }
  const s = ensurePassDailyBattleState(profile);
  if ((profile.passDailyBattleDay ?? 0) !== s.dayKey) {
    updateProfile({
      passDailyBattleDay: s.dayKey,
      passDailyBattleFreeLeft: s.freeLeft,
      passDailyBattlePaidLeft: s.paidLeft,
    });
  }
  return {
    freeLeft: s.freeLeft,
    freeMax: PASS_DAILY_BATTLE_XP_FREE,
    paidLeft: s.paidLeft,
    paidMax: PASS_DAILY_BATTLE_XP_PAID,
    hasPaid: !!profile.clashPassPaid,
  };
}

function applyClashPassXpToProfile(
  profile: UserProfile,
  amount: number,
): { newXp: number; newLevel: number; clashPassUp: boolean } {
  let newXp = profile.xp + amount;
  let newLevel = profile.clashPassLevel;
  let clashPassUp = false;
  while (newXp >= clashPassXpForLevel(newLevel)) {
    newXp -= clashPassXpForLevel(newLevel);
    newLevel++;
    clashPassUp = true;
  }
  return { newXp, newLevel, clashPassUp };
}

/** Grant 50–100 pass XP per win until daily pools (500 free / +1000 paid) are empty. */
export function grantPassDailyBattleXpOnWin(
  profile: UserProfile,
): { granted: number; freeUsed: number; paidUsed: number; clashPassUp: boolean } {
  const state = ensurePassDailyBattleState(profile);
  let freeLeft = state.freeLeft;
  let paidLeft = state.paidLeft;
  let granted = 0;

  const rollChunk = () =>
    Math.floor(PASS_DAILY_BATTLE_XP_WIN_MIN
      + Math.random() * (PASS_DAILY_BATTLE_XP_WIN_MAX - PASS_DAILY_BATTLE_XP_WIN_MIN + 1));

  if (freeLeft > 0) {
    const chunk = Math.min(freeLeft, rollChunk());
    granted += chunk;
    freeLeft -= chunk;
  }
  if (paidLeft > 0) {
    const chunk = Math.min(paidLeft, rollChunk());
    granted += chunk;
    paidLeft -= chunk;
  }

  const clashPassUp = granted > 0;
  return {
    granted,
    freeUsed: state.freeLeft - freeLeft,
    paidUsed: state.paidLeft - paidLeft,
    clashPassUp,
  };
}

function flatPassResourceReward(level: number): ClashPassReward {
  if (level === 100) return { type: "gems", amount: 100, label: "100 кристаллов" };
  if (level === 95) return { type: "coins", amount: 2500, label: "2500 монет" };
  if (level === 90) return { type: "gems", amount: 50, label: "50 кристаллов" };
  if (level === 85) return { type: "powerPoints", amount: 200, label: "200 очков прокачки" };
  if (level === 80) return { type: "coins", amount: 2500, label: "2500 монет" };
  if (level === 75) return { type: "powerPoints", amount: 100, label: "100 очков прокачки" };
  if (level === 70) return { type: "powerPoints", amount: 100, label: "100 очков прокачки" };

  const pos = (level - 1) % 5;
  const cycle = Math.floor((level - 1) / 5) % 3;
  const coinPool = [400, 600, 800, 1000, 1200, 1500];
  const gemPool = [15, 20, 25, 35, 45, 50];
  const ppPool = [20, 30, 40, 50];

  if (pos === 4) {
    const amt = gemPool[cycle % gemPool.length];
    return { type: "gems", amount: amt, label: `${amt} кристаллов` };
  }
  if (pos === 1 || pos === 2) {
    const amt = ppPool[(cycle + pos) % ppPool.length];
    return { type: "powerPoints", amount: amt, label: `${amt} очков прокачки` };
  }
  const amt = coinPool[(cycle + pos) % coinPool.length];
  return { type: "coins", amount: amt, label: `${amt} монет` };
}

function clashPassResourceReward(_level: number): ClashPassReward {
  return flatPassResourceReward(_level);
}

/** Levels 51–100: same flat resource pool as 1–50. */
function clashPassResourceRewardExtended(level: number): ClashPassReward {
  return flatPassResourceReward(level);
}

export interface TrophyRoadReward {
  trophies: number;
  type: "coins" | "gems" | "powerPoints" | "brawler" | "chest" | "profileIcon";
  amount: number;
  label: string;
  chestRarity?: ChestRarity;
  iconId?: string;
}

function buildTrophyRoad(): TrophyRoadReward[] {
  const thresholds: number[] = [];
  for (let t = 50; t <= 2000; t += 50) thresholds.push(t);
  for (let t = 2200; t <= 10000; t += 200) thresholds.push(t);
  for (let t = 10500; t <= 30000; t += 500) thresholds.push(t);
  for (let t = 31000; t <= 60000; t += 1000) thresholds.push(t);
  for (let t = 62000; t <= 100000; t += 2000) thresholds.push(t);

  return thresholds.map((trophies, i): TrophyRoadReward => {
    if (trophies === 100000) return { trophies, type: "chest", amount: 1, chestRarity: "mythic", label: "Мифический сундук" };
    if (trophies === 75000) return { trophies, type: "chest", amount: 1, chestRarity: "legendary", label: "Легендарный сундук" };
    if (trophies === 50000) return { trophies, type: "chest", amount: 1, chestRarity: "mega", label: "Мега-сундук" };
    if (trophies === 25000) return { trophies, type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" };
    if (trophies === 10000) return { trophies, type: "chest", amount: 1, chestRarity: "mythic", label: "Мифический сундук" };
    if (trophies === 5000)  return { trophies, type: "chest", amount: 1, chestRarity: "legendary", label: "Легендарный сундук" };
    if (trophies === 3000)  return { trophies, type: "chest", amount: 1, chestRarity: "mega", label: "Мега-сундук" };
    if (trophies === 1000)  return { trophies, type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" };

    if (i > 0 && i % 12 === 0) {
      const rarity: ChestRarity =
        i >= 80 ? "legendary" : i >= 55 ? "mega" : i >= 30 ? "epic" : i >= 18 ? "rare" : "common";
      const labelMap: Record<ChestRarity, string> = {
        common: "Обычный сундук", rare: "Редкий сундук", epic: "Эпический сундук",
        mega: "Мега-сундук", legendary: "Легендарный сундук", mythic: "Мифический сундук",
        ultralegendary: "Ультралегендарный сундук",
      };
      return { trophies, type: "chest", amount: 1, chestRarity: rarity, label: labelMap[rarity] };
    }

    // 5-tier rotation: coin, coin, pp, coin, gem (только ресурсы — без пинов и иконок)
    const cycle = i % 5;
    if (cycle === 4) {
      const amount = Math.max(5, Math.round(trophies / 80));
      return { trophies, type: "gems", amount, label: `${amount} кристаллов` };
    }
    if (cycle === 2) {
      const amount = Math.max(3, Math.round(trophies / 60));
      return { trophies, type: "powerPoints", amount, label: `${amount} очков прокачки` };
    }
    const amount = Math.max(40, Math.round((trophies * 0.5) / 10) * 10);
    return { trophies, type: "coins", amount, label: `${amount} монет` };
  });
}

export const TROPHY_ROAD: TrophyRoadReward[] = buildTrophyRoad();

export interface ClashPassReward {
  type: "coins" | "gems" | "powerPoints" | "chest" | "pin" | "profileIcon";
  amount: number;
  label: string;
  chestRarity?: ChestRarity;
  pinId?: string;
  iconId?: string;
  goldenPinFrame?: boolean;
}

function clashPassFreeChestForLevel(level: number): ClashPassReward | null {
  if (level === 50 || level === 100) {
    return { type: "chest", amount: 1, chestRarity: "mythic", label: "Мифический сундук" };
  }
  if (level === 40 || level === 90) {
    return { type: "chest", amount: 1, chestRarity: "legendary", label: "Легендарный сундук" };
  }
  if (level === 30 || level === 80) {
    return { type: "chest", amount: 1, chestRarity: "mega", label: "Мега-сундук" };
  }
  if (level === 20 || level === 70) {
    return { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" };
  }
  if (level === 10 || level === 60) {
    return { type: "chest", amount: 1, chestRarity: "rare", label: "Редкий сундук" };
  }
  return null;
}

export function clashPassRewardForLevel(level: number): ClashPassReward {
  if (level > 50) {
    const chest = clashPassFreeChestForLevel(level);
    if (chest) return chest;
    return clashPassResourceRewardExtended(level);
  }

  const freePinIdx = STAR_PASS_FREE_PIN_LEVELS.indexOf(level as typeof STAR_PASS_FREE_PIN_LEVELS[number]);
  if (freePinIdx >= 0) {
    const pinId = STAR_PASS_FREE_PIN_IDS[freePinIdx];
    const def = getCollectiblePin(pinId);
    return {
      type: "pin",
      amount: 1,
      pinId,
      label: PIN_PUBLIC_LABEL,
    };
  }

  const iconIdx = STAR_PASS_FREE_ICON_LEVELS.indexOf(level as typeof STAR_PASS_FREE_ICON_LEVELS[number]);
  if (iconIdx >= 0) {
    const iconId = STAR_PASS_FREE_ICON_IDS[iconIdx];
    if (iconId) {
      return {
        type: "profileIcon",
        amount: 1,
        iconId,
        label: profileIconRewardLabel(iconId),
      };
    }
  }

  const chest = clashPassFreeChestForLevel(level);
  if (chest) return chest;

  return clashPassResourceReward(level);
}

// =========================================================================
// PAID (Premium) Star Pass — mocked purchase for 450 ₽
// =========================================================================

export const CLASH_PASS_PRICE_RUB = 450;

const CHEST_BUMP: Record<ChestRarity, ChestRarity> = {
  common: "rare",
  rare: "epic",
  epic: "mega",
  mega: "legendary",
  legendary: "mythic",
  mythic: "ultralegendary",
  ultralegendary: "ultralegendary",
};

const CHEST_LABEL: Record<ChestRarity, string> = {
  common: "Обычный сундук",
  rare: "Редкий сундук",
  epic: "Эпический сундук",
  mega: "Мега-сундук",
  legendary: "Легендарный сундук",
  mythic: "Мифический сундук",
  ultralegendary: "Ультралегендарный сундук",
};

/**
 * Premium Star Pass reward for a given level. Always strictly better than the
 * free track:
 *   • coins / powerPoints / gems → x2 the amount
 *   • chest                      → bumped one rarity tier higher
 * On every 5th level we also boost gems-style rewards a bit further to honour
 * the "more gems / boosters" promise from the product description.
 */
function rawPaidClashPassRewardForLevel(level: number): ClashPassReward {
  const paidPinIdx = STAR_PASS_PAID_PIN_LEVELS.indexOf(level as typeof STAR_PASS_PAID_PIN_LEVELS[number]);
  if (paidPinIdx >= 0) {
    const pinId = STAR_PASS_PAID_PIN_IDS[paidPinIdx];
    const def = getCollectiblePin(pinId);
    return {
      type: "pin",
      amount: 1,
      pinId,
      goldenPinFrame: true,
      label: PIN_PUBLIC_LABEL,
    };
  }

  const paidPinLevels = new Set(STAR_PASS_PAID_PIN_LEVELS as unknown as number[]);
  if (!paidPinLevels.has(level) && level % 5 === 1) {
    const tier = Math.floor((level - 1) / 10);
    const chestRarities: ChestRarity[] = ["rare", "epic", "epic", "mega", "legendary"];
    const chestRarity = chestRarities[Math.min(tier, chestRarities.length - 1)];
    return { type: "chest", amount: 1, chestRarity, label: CHEST_LABEL[chestRarity] };
  }
  if (!paidPinLevels.has(level) && level % 6 === 2) {
    const amt = level >= 90 ? 50 : 35;
    return { type: "gems", amount: amt, label: `${amt} кристаллов` };
  }
  if (!paidPinLevels.has(level) && level % 4 === 3) {
    const pp = level >= 85 ? 100 : 50;
    return { type: "powerPoints", amount: pp, label: `${pp} очков прокачки` };
  }

  const free = clashPassRewardForLevel(level);
  if (free.type === "profileIcon") {
    if (level % 2 === 0) {
      const amt = level >= 95 ? 100 : 50;
      return { type: "gems", amount: amt, label: `${amt} кристаллов` };
    }
    const chestRarities: ChestRarity[] = ["rare", "epic", "mega", "legendary", "mythic"];
    const chestRarity = chestRarities[Math.min(Math.floor((level - 1) / 20), chestRarities.length - 1)];
    return { type: "chest", amount: 1, chestRarity, label: CHEST_LABEL[chestRarity] };
  }
  if (free.type === "pin") {
    const amt = 50;
    return { type: "gems", amount: amt, label: `${amt} кристаллов` };
  }
  if (free.type === "chest" && free.chestRarity) {
    const bumped = CHEST_BUMP[free.chestRarity];
    return { type: "chest", amount: 1, chestRarity: bumped, label: CHEST_LABEL[bumped] };
  }
  if (free.type === "gems") {
    const amt = Math.min(100, free.amount * 3);
    return { type: "gems", amount: amt, label: `${amt} кристаллов` };
  }
  if (free.type === "coins") {
    const amt = Math.min(2500, free.amount * 2);
    return { type: "coins", amount: amt, label: `${amt} монет` };
  }
  if (free.type === "powerPoints") {
    const amt = Math.min(200, free.amount * 2);
    return { type: "powerPoints", amount: amt, label: `${amt} очков прокачки` };
  }
  return free;
}

/** Половина легендарных сундуков заменяется на мифические. */
function halveLegendaryChestsInRewards(rewards: ClashPassReward[]): ClashPassReward[] {
  const out = rewards.map((r) => ({ ...r }));
  const legendaryIdx: number[] = [];
  out.forEach((r, i) => {
    if (r.type === "chest" && r.chestRarity === "legendary") legendaryIdx.push(i);
  });
  const convertCount = Math.floor(legendaryIdx.length / 2);
  for (let k = 0; k < convertCount; k++) {
    const i = legendaryIdx[legendaryIdx.length - 1 - k]!;
    out[i] = {
      type: "chest",
      amount: 1,
      chestRarity: "mythic",
      label: CHEST_LABEL.mythic,
    };
  }
  return out;
}

function buildPaidClashPassRewards(): ClashPassReward[] {
  const raw = Array.from({ length: MAX_CLASHPASS_LEVEL }, (_, i) =>
    rawPaidClashPassRewardForLevel(i + 1),
  );
  return halveLegendaryChestsInRewards(raw);
}

const PAID_CLASH_PASS_REWARDS: ClashPassReward[] = buildPaidClashPassRewards();

export function paidClashPassRewardForLevel(level: number): ClashPassReward {
  if (level <= 0) return PAID_CLASH_PASS_REWARDS[0]!;
  if (level <= MAX_CLASHPASS_LEVEL) return PAID_CLASH_PASS_REWARDS[level - 1]!;
  return rawPaidClashPassRewardForLevel(level);
}

// =========================================================================
// ULTRA (Third) Star Pass — 699 ₽, chests/resources only
// =========================================================================

const ULTRA_CHEST_BONUS = 1.4;
/** Монеты и очки силы на доп. дорожке — на 70% меньше базовых. */
const ULTRA_RESOURCE_SCALE = 0.3;

const ULTRA_EXTRA_CHEST_RARITIES: ChestRarity[] = [
  "epic", "epic", "mega", "mega", "mythic", "mythic",
  "legendary", "legendary", "legendary", "ultralegendary",
];

function mapPaidChestToUltraRarity(rarity: ChestRarity): ChestRarity {
  if (rarity === "common" || rarity === "rare") return "epic";
  return rarity;
}

function scaleUltraResourceReward(reward: ClashPassReward): ClashPassReward {
  if (reward.type === "coins") {
    const amount = Math.max(1, Math.round(reward.amount * ULTRA_RESOURCE_SCALE));
    return { ...reward, amount, label: `${amount} монет` };
  }
  if (reward.type === "powerPoints") {
    const amount = Math.max(1, Math.round(reward.amount * ULTRA_RESOURCE_SCALE));
    return { ...reward, amount, label: `${amount} очков прокачки` };
  }
  return reward;
}

function pickSpreadChestLevels(existing: Set<number>, count: number): number[] {
  if (count <= 0) return [];
  const candidates = Array.from({ length: MAX_CLASHPASS_LEVEL }, (_, i) => i + 1)
    .filter((level) => !existing.has(level));
  if (candidates.length === 0) return [];
  const picked: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.min(
      candidates.length - 1,
      Math.floor(((i + 0.5) * candidates.length) / count),
    );
    picked.push(candidates[idx]!);
  }
  return picked;
}

function buildUltraClashPassRewards(): ClashPassReward[] {
  const paidChestSlots: { level: number; rarity: ChestRarity }[] = [];
  for (let level = 1; level <= MAX_CLASHPASS_LEVEL; level++) {
    const reward = PAID_CLASH_PASS_REWARDS[level - 1]!;
    if (reward.type === "chest" && reward.chestRarity) {
      paidChestSlots.push({
        level,
        rarity: mapPaidChestToUltraRarity(reward.chestRarity),
      });
    }
  }

  const targetChestCount = Math.ceil(paidChestSlots.length * ULTRA_CHEST_BONUS);
  const chestByLevel = new Map<number, ChestRarity>();
  for (const slot of paidChestSlots) {
    chestByLevel.set(slot.level, slot.rarity);
  }

  const extraNeeded = Math.max(0, targetChestCount - paidChestSlots.length);
  const extraLevels = pickSpreadChestLevels(new Set(chestByLevel.keys()), extraNeeded);
  extraLevels.forEach((level, i) => {
    chestByLevel.set(level, ULTRA_EXTRA_CHEST_RARITIES[i] ?? "epic");
  });

  return Array.from({ length: MAX_CLASHPASS_LEVEL }, (_, i) => {
    const level = i + 1;
    const chestRarity = chestByLevel.get(level);
    if (chestRarity) {
      return {
        type: "chest",
        amount: 1,
        chestRarity,
        label: CHEST_LABEL[chestRarity],
      };
    }
    return scaleUltraResourceReward(flatPassResourceReward(level));
  });
}

const ULTRA_CLASH_PASS_REWARDS: ClashPassReward[] =
  halveLegendaryChestsInRewards(buildUltraClashPassRewards());

export function ultraClashPassRewardForLevel(level: number): ClashPassReward {
  if (level <= 0) return ULTRA_CLASH_PASS_REWARDS[0]!;
  if (level <= MAX_CLASHPASS_LEVEL) return ULTRA_CLASH_PASS_REWARDS[level - 1]!;
  return {
    type: "chest",
    amount: 1,
    chestRarity: "ultralegendary",
    label: CHEST_LABEL.ultralegendary,
  };
}

export function buyClashPassUltra(): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (profile.clashPassUltraPaid) return { success: false, error: "Доп. дорожка уже куплена" };
  updateProfile({ clashPassUltraPaid: true });
  void import("./cloud/profileCloud").then((m) => m.pushCurrentProfileToCloud());
  recordPurchase({
    category: "pass_ultra",
    title: "Star Pass Ultra",
    priceRub: CLASH_PASS_ULTRA_PRICE_RUB,
    rewardSummary: "Ultra track",
  });
  return { success: true };
}

export function claimUltraClashPassReward(level: number): { success: boolean; reward?: ClashPassReward; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (level < 1 || level > MAX_CLASHPASS_LEVEL) return { success: false, error: "Неверный уровень" };
  if (!profile.clashPassUltraPaid) return { success: false, error: "Доп. дорожка не куплена" };
  if (profile.clashPassLevel < level) return { success: false, error: "Уровень не достигнут" };
  const claimed = profile.clashPassClaimedUltra || [];
  if (claimed.includes(level)) return { success: false, error: "Уже получено" };
  const reward = ultraClashPassRewardForLevel(level);
  const updates: Partial<UserProfile> = {
    clashPassClaimedUltra: [...claimed, level],
  };
  if (reward.type === "coins") updates.coins = profile.coins + reward.amount;
  else if (reward.type === "gems") updates.gems = profile.gems + reward.amount;
  else if (reward.type === "powerPoints") updates.powerPoints = profile.powerPoints + reward.amount;
  else if (reward.type === "chest" && reward.chestRarity) {
    updates.chestInventory = {
      ...profile.chestInventory,
      [reward.chestRarity]: (profile.chestInventory[reward.chestRarity] || 0) + reward.amount,
    };
  }
  updateProfile(updates);
  return { success: true, reward };
}

// =========================================================================
// Infinite Star Pass — after level 100, every 2000 XP
// =========================================================================

export type InfinitePassChoice = "free" | "deal";

function infiniteRewardSeed(tier: number, slot: number): number {
  return (tier * 9973 + slot * 7919) >>> 0;
}

/** Random free infinite reward — resources and chests only (no pins/icons). */
export function rollInfinitePassFreeReward(tier: number): ClashPassReward {
  const roll = infiniteRewardSeed(tier, 1) % 100;
  if (roll < 32) {
    const amounts = [400, 600, 800, 1000, 1200, 1500];
    const coins = amounts[infiniteRewardSeed(tier, 2) % amounts.length];
    return { type: "coins", amount: coins, label: `${coins} монет` };
  }
  if (roll < 52) {
    const amounts = [15, 20, 25, 35, 45, 50];
    const amt = amounts[infiniteRewardSeed(tier, 3) % amounts.length];
    return { type: "gems", amount: amt, label: `${amt} кристаллов` };
  }
  if (roll < 72) {
    const amounts = [20, 30, 40, 50];
    const pp = amounts[infiniteRewardSeed(tier, 4) % amounts.length];
    return { type: "powerPoints", amount: pp, label: `${pp} очков прокачки` };
  }
  const chests: ChestRarity[] = ["common", "rare", "epic", "mega", "legendary"];
  const chestRarity = chests[infiniteRewardSeed(tier, 5) % chests.length];
  return { type: "chest", amount: 1, chestRarity, label: CHEST_LABEL[chestRarity] };
}

export function infinitePassFreeReward(tier: number): ClashPassReward {
  return rollInfinitePassFreeReward(tier);
}

export function infinitePassDealReward(tier: number): { reward: ClashPassReward; gemCost: number } {
  const gemCost = 25 + (tier % 5) * 5;
  const mod = tier % 3;
  if (mod === 0) {
    return { gemCost, reward: { type: "chest", amount: 1, chestRarity: "mythic", label: CHEST_LABEL.mythic } };
  }
  if (mod === 1) {
    return { gemCost, reward: { type: "chest", amount: 1, chestRarity: "legendary", label: CHEST_LABEL.legendary } };
  }
  const amt = Math.min(100, 50 + (tier % 4) * 12);
  return { gemCost, reward: { type: "gems", amount: amt, label: `${amt} кристаллов` } };
}

export function getNextClaimableInfiniteTier(profile: UserProfile): number | null {
  const reachedTier = clashPassInfiniteTier(profile.clashPassLevel);
  if (reachedTier <= 0) return null;
  const claimed = new Set(profile.clashPassInfiniteClaimed || []);
  for (let tier = 1; tier <= reachedTier; tier++) {
    if (!claimed.has(tier)) return tier;
  }
  return null;
}

export function claimInfinitePassReward(
  tier: number,
  choice: InfinitePassChoice,
): { success: boolean; reward?: ClashPassReward; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (tier < 1) return { success: false, error: "Неверный уровень" };
  if (clashPassInfiniteTier(profile.clashPassLevel) < tier) {
    return { success: false, error: "Уровень не достигнут" };
  }
  const claimed = profile.clashPassInfiniteClaimed || [];
  if (claimed.includes(tier)) return { success: false, error: "Уже получено" };

  let reward: ClashPassReward;
  const updates: Partial<UserProfile> = {
    clashPassInfiniteClaimed: [...claimed, tier],
  };

  if (choice === "free") {
    reward = infinitePassFreeReward(tier);
  } else {
    const deal = infinitePassDealReward(tier);
    if (profile.gems < deal.gemCost) return { success: false, error: "Недостаточно кристаллов" };
    reward = deal.reward;
    updates.gems = profile.gems - deal.gemCost;
  }

  if (reward.type === "coins") updates.coins = (updates.coins ?? profile.coins) + reward.amount;
  else if (reward.type === "gems") updates.gems = (updates.gems ?? profile.gems) + reward.amount;
  else if (reward.type === "powerPoints") updates.powerPoints = profile.powerPoints + reward.amount;
  else if (reward.type === "chest" && reward.chestRarity) {
    updates.chestInventory = {
      ...profile.chestInventory,
      [reward.chestRarity]: (profile.chestInventory[reward.chestRarity] || 0) + reward.amount,
    };
  }
  updateProfile(updates);
  return { success: true, reward };
}

export function skipClashPassLevel(): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (profile.gems < SKIP_PASS_LEVEL_GEM_COST) {
    return { success: false, error: "Недостаточно кристаллов" };
  }
  updateProfile({
    gems: profile.gems - SKIP_PASS_LEVEL_GEM_COST,
    clashPassLevel: profile.clashPassLevel + 1,
    xp: 0,
  });
  return { success: true };
}

/**
 * Mock purchase — no real money changes hands. Flips clashPassPaid=true and
 * unlocks retroactive claiming of every premium reward up to the current
 * clashPassLevel. Returns success even if already purchased (idempotent).
 */
export function buyClashPass(): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (profile.clashPassPaid) return { success: false, error: "Star Pass уже куплен" };
  const today = passDailyBattleDayKey();
  const patch: Partial<UserProfile> = { clashPassPaid: true };
  if ((profile.passDailyBattleDay ?? 0) === today) {
    patch.passDailyBattlePaidLeft = PASS_DAILY_BATTLE_XP_PAID;
  }
  updateProfile(patch);
  void import("./cloud/profileCloud").then((m) => m.pushCurrentProfileToCloud());
  recordPurchase({
    category: "pass",
    title: "Star Pass",
    priceRub: CLASH_PASS_PRICE_RUB,
    rewardSummary: "Premium track",
  });
  return { success: true };
}

export function claimPaidClashPassReward(level: number): { success: boolean; reward?: ClashPassReward; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (level < 1 || level > MAX_CLASHPASS_LEVEL) return { success: false, error: "Неверный уровень" };
  if (!profile.clashPassPaid) return { success: false, error: "Star Pass не куплен" };
  if (profile.clashPassLevel < level) return { success: false, error: "Уровень не достигнут" };
  const claimed = profile.clashPassClaimedPaid || [];
  if (claimed.includes(level)) return { success: false, error: "Уже получено" };
  const reward = paidClashPassRewardForLevel(level);
  const updates: Partial<UserProfile> = {
    clashPassClaimedPaid: [...claimed, level],
  };
  if (reward.type === "coins") updates.coins = profile.coins + reward.amount;
  else if (reward.type === "gems") updates.gems = profile.gems + reward.amount;
  else if (reward.type === "powerPoints") updates.powerPoints = profile.powerPoints + reward.amount;
  else if (reward.type === "chest" && reward.chestRarity) {
    updates.chestInventory = {
      ...profile.chestInventory,
      [reward.chestRarity]: (profile.chestInventory[reward.chestRarity] || 0) + reward.amount,
    };
  } else if (reward.type === "pin" && reward.pinId) {
    applyPinRewardToUpdates(profile, updates, reward.pinId);
  } else if (reward.type === "profileIcon" && reward.iconId) {
    applyProfileIconRewardToUpdates(profile, updates, reward.iconId);
  }
  updateProfile(updates);
  return { success: true, reward };
}

const PROFILES_KEY = "clashArena_profiles";
const CURRENT_USER_KEY = "clashArena_currentUser";

export function hashAccountPassword(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h.toString(16);
}

function simpleHash(s: string): string {
  return hashAccountPassword(s);
}

/** Выдать ID только если нет; существующий валидный ID никогда не перезаписываем. */
function migrateProfilesPlayerIds(raw: Record<string, UserProfile>): Record<string, UserProfile> {
  const out: Record<string, UserProfile> = {};
  for (const [key, v] of Object.entries(raw)) {
    out[key] = { ...v };
  }

  const used = collectUsedPlayerIds(out);
  let dirty = false;

  for (const [key, v] of Object.entries(out)) {
    const current = v.playerId ? normalizePlayerIdQuery(v.playerId) : "";
    if (current && isValidPlayerIdFormat(current)) continue;
    const playerId = generateUniquePlayerId(used);
    out[key] = { ...v, playerId };
    dirty = true;
  }

  const ownerById = new Map<string, string>();
  for (const [key, v] of Object.entries(out)) {
    const pid = v.playerId ? normalizePlayerIdQuery(v.playerId) : "";
    if (!pid) continue;
    if (!ownerById.has(pid)) ownerById.set(pid, key);
    else {
      const playerId = generateUniquePlayerId(used);
      out[key] = { ...out[key], playerId };
      dirty = true;
    }
  }

  if (dirty) {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(out));
  }
  return out;
}

export function getAllProfiles(): Record<string, UserProfile> {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}") as Record<string, UserProfile>;
    return migrateProfilesPlayerIds(raw);
  } catch {
    return {};
  }
}

export function saveProfiles(profiles: Record<string, UserProfile>): void {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("clash-profile-local-changed"));
  }
}

export function getCurrentUsername(): string | null {
  return localStorage.getItem(CURRENT_USER_KEY);
}

export function setCurrentUsername(username: string | null): void {
  if (username === null) {
    localStorage.removeItem(CURRENT_USER_KEY);
  } else {
    localStorage.setItem(CURRENT_USER_KEY, username);
  }
}

function defaultChestInventory(): Record<ChestRarity, number> {
  return { common: 0, rare: 0, epic: 0, mega: 0, legendary: 0, mythic: 0, ultralegendary: 0 };
}

export function normalizeProfile(p: UserProfile): UserProfile {
  const defaultLevels = { miya: 1, ronin: 1, yuki: 1, kenji: 1, hana: 1, goro: 1, sora: 1, rin: 1, taro: 1 };

  // Resolve unlocked brawlers first, so selected/favorite IDs can be validated
  // against the unlocked set and locked picks can never persist as the active
  // pick (which would otherwise let players enter ranked matches with locked
  // brawlers — see character-lock requirement).
  const unlockedBrawlers = (() => {
    const ids = new Set<string>(p.unlockedBrawlers || []);
    ids.add("hana"); // Always guarantee the starter brawler.
    return Array.from(ids);
  })();

  const safeSelected = (id: string | undefined) =>
    id && unlockedBrawlers.includes(id) ? id : "hana";

  const result: UserProfile = {
    username: p.username,
    playerId: p.playerId ? normalizePlayerIdQuery(p.playerId) : undefined,
    email: p.email?.trim() || undefined,
    passwordHash: p.passwordHash || "",
    coins: p.coins ?? 500,
    gems: p.gems ?? 50,
    powerPoints: p.powerPoints ?? 10,
    brawlerLevels: { ...defaultLevels, ...(p.brawlerLevels || {}) },
    brawlerSkins: p.brawlerSkins || {},
    lastDailyBonus: p.lastDailyBonus ?? 0,
    totalGamesPlayed: p.totalGamesPlayed ?? 0,
    totalWins: p.totalWins ?? 0,
    totalLosses: p.totalLosses ?? 0,
    trophies: p.trophies ?? 0,
    xp: p.xp ?? 0,
    clashPassLevel: p.clashPassLevel ?? 1,
    clashPassClaimed: p.clashPassClaimed || [],
    clashPassPaid: p.clashPassPaid ?? false,
    clashPassClaimedPaid: p.clashPassClaimedPaid || [],
    clashPassUltraPaid: p.clashPassUltraPaid ?? false,
    clashPassClaimedUltra: p.clashPassClaimedUltra || [],
    clashPassInfiniteClaimed: p.clashPassInfiniteClaimed || [],
    passDailyBattleDay: p.passDailyBattleDay ?? 0,
    passDailyBattleFreeLeft: p.passDailyBattleFreeLeft ?? PASS_DAILY_BATTLE_XP_FREE,
    passDailyBattlePaidLeft: p.passDailyBattlePaidLeft ?? (p.clashPassPaid ? PASS_DAILY_BATTLE_XP_PAID : 0),
    trophyRoadClaimed: (() => {
      // Stored as trophy thresholds. Filter out anything not in current ladder
      // (handles migration from older index-based storage).
      const validThresholds = new Set(TROPHY_ROAD.map(r => r.trophies));
      return (p.trophyRoadClaimed || []).filter((v: number) => validThresholds.has(v));
    })(),
    modeStats: p.modeStats || {},
    favoriteBrawlerId: safeSelected(p.favoriteBrawlerId),
    favoritePinId: typeof p.favoritePinId === "string" ? p.favoritePinId : undefined,
    profileIconId: (() => {
      const id = p.profileIconId || "gen:001";
      if (id.startsWith("misc:")) return "gen:001";
      return PROFILE_ICON_BY_ID.has(id) ? id : "gen:001";
    })(),
    introDisplayIconIds: normalizeIntroDisplayIconIds(p),
    unlockedProfileIcons: (p.unlockedProfileIcons || []).filter(
      (id: string) => !id.startsWith("misc:") && !REMOVED_PROFILE_ICON_IDS.has(id) && PROFILE_ICON_BY_ID.has(id),
    ),
    unlockedPortraitBackgrounds: ensureDefaultPortraitBackgroundUnlocked({
      ...p,
      unlockedPortraitBackgrounds: (p.unlockedPortraitBackgrounds || []).filter(
        (id: string) => PORTRAIT_BACKGROUND_BY_ID.has(id),
      ),
    }),
    equippedPortraitBackgroundId: (() => {
      const id = p.equippedPortraitBackgroundId ?? DEFAULT_PORTRAIT_BACKGROUND_ID;
      return PORTRAIT_BACKGROUND_BY_ID.has(id) ? id : DEFAULT_PORTRAIT_BACKGROUND_ID;
    })(),
    ownedMotionTrails: (p.ownedMotionTrails || []).filter(
      (id: string) => BRAWLER_TRAIL_BY_ID.has(id),
    ),
    equippedMotionTrailGlobalId: (() => {
      const id = p.equippedMotionTrailGlobalId ?? null;
      if (!id || !BRAWLER_TRAIL_BY_ID.has(id)) return null;
      return id;
    })(),
    equippedMotionTrailByBrawler: Object.fromEntries(
      Object.entries(p.equippedMotionTrailByBrawler || {}).filter(
        ([bid, tid]) => typeof bid === "string" && BRAWLER_TRAIL_BY_ID.has(tid),
      ),
    ),
    brawlerTrailMode: Object.fromEntries(
      Object.entries(p.brawlerTrailMode || {}).filter(
        ([bid, mode]) => typeof bid === "string" && (mode === "global" || mode === "individual"),
      ),
    ),
    usernameColor: p.usernameColor || "#FFFFFF",
    selectedBrawlerId: safeSelected(p.selectedBrawlerId),
    selectedMode: p.selectedMode || "showdown",
    selectedShowdownFormat: p.selectedShowdownFormat === "duo" || p.selectedShowdownFormat === "trio" ? p.selectedShowdownFormat : "solo",
    selectedStarStrikeFormat: p.selectedStarStrikeFormat === "5v5" ? "5v5" : "3v3",
    lastResult: p.lastResult,
    createdAt: p.createdAt || Date.now(),
    dailyLadderDay: p.dailyLadderDay ?? 1,
    dailyLadderLastClaim: p.dailyLadderLastClaim ?? 0,
    dailyLadderClaimedDayKey: p.dailyLadderClaimedDayKey ?? 0,
    cloudSyncedAt: typeof p.cloudSyncedAt === "number" ? p.cloudSyncedAt : undefined,
    profileLocalRev: typeof p.profileLocalRev === "number" ? p.profileLocalRev : undefined,
    dailyQuests: p.dailyQuests,
    questPool: p.questPool,
    starFeatProgress: { ...(p.starFeatProgress || {}) },
    starFeatTierBadges: Array.isArray(p.starFeatTierBadges) ? [...p.starFeatTierBadges] : [],
    starFeatClaimed: { ...(p.starFeatClaimed || {}) },
    chestInventory: { ...defaultChestInventory(), ...(p.chestInventory || {}) },
    unlockedBrawlers,
    brawlerTrophies: { ...(p.brawlerTrophies || {}) },
    brawlerTrophyPeak: (() => {
      const peaks: Record<string, number> = { ...(p.brawlerTrophyPeak || {}) };
      for (const [id, t] of Object.entries(p.brawlerTrophies || {})) {
        peaks[id] = Math.max(peaks[id] ?? 0, t);
      }
      return peaks;
    })(),
    brawlerWinStreak: (() => {
      const out: Record<string, number> = {};
      for (const [id, v] of Object.entries(p.brawlerWinStreak || {})) {
        if (!unlockedBrawlers.includes(id)) continue;
        const n = Math.max(0, Math.floor(Number(v) || 0));
        if (n > 0) out[id] = n;
      }
      return Object.keys(out).length ? out : undefined;
    })(),
    brawlerWinStreakPeak: (() => {
      const streaks = p.brawlerWinStreak || {};
      const peaks: Record<string, number> = { ...(p.brawlerWinStreakPeak || {}) };
      for (const [id, v] of Object.entries(streaks)) {
        if (!unlockedBrawlers.includes(id)) continue;
        peaks[id] = Math.max(peaks[id] ?? 0, Math.floor(Number(v) || 0));
      }
      for (const [id, v] of Object.entries(peaks)) {
        if (!unlockedBrawlers.includes(id)) delete peaks[id];
        else peaks[id] = Math.max(0, Math.floor(Number(v) || 0));
      }
      const cleaned = Object.fromEntries(Object.entries(peaks).filter(([, v]) => v > 0));
      return Object.keys(cleaned).length ? cleaned : undefined;
    })(),
    brawlerRankClaimed: { ...(p.brawlerRankClaimed || {}) },
    brawlerMasteryXp: { ...(p.brawlerMasteryXp || {}) },
    brawlerMasteryClaimed: { ...(p.brawlerMasteryClaimed || {}) },
    masteryTitlesUnlocked: (() => {
      let titles = [...(p.masteryTitlesUnlocked || [])];
      if (isDeveloperUsername(p.username)) {
        titles = grantExclusiveTitle(titles, DEVELOPER_TITLE_ID);
      }
      return titles;
    })(),
    equippedMasteryTitle: p.equippedMasteryTitle,
    controlMode: p.controlMode === "mobile" || p.controlMode === "pc"
      ? p.controlMode
      : detectDefaultControlMode(),
    newBrawlers: p.newBrawlers || [],
    brawlerStars: p.brawlerStars || {},
    unlockedPets: (p.unlockedPets || []).filter((id: string) => PETS.some(pet => pet.id === id)),
    equippedPetId: (() => {
      const id = p.equippedPetId ?? null;
      if (!id) return null;
      return PETS.some(pet => pet.id === id) ? id : null;
    })(),
    newPets: (p.newPets || []).filter((id: string) => PETS.some(pet => pet.id === id)),
    petCustomNames: (() => {
      const owned = new Set(
        (p.unlockedPets || []).filter((id: string) => PETS.some(pet => pet.id === id)),
      );
      const raw = p.petCustomNames || {};
      const out: Record<string, string> = {};
      for (const [id, name] of Object.entries(raw)) {
        if (!owned.has(id) || typeof name !== "string") continue;
        const trimmed = name.trim();
        if (trimmed.length >= 2 && trimmed.length <= 16) out[id] = trimmed;
      }
      return Object.keys(out).length ? out : undefined;
    })(),
    ownedPins: (() => {
      // Every account starts with all universal pins + the default face pin
      // for every unlocked brawler. We merge with whatever was stored before.
      const set = new Set<string>(
        (p.ownedPins || []).filter(id => !REMOVED_PIN_IDS.has(id)),
      );
      for (const id of defaultUniversalPins()) set.add(id);
      for (const bId of unlockedBrawlers) {
        for (const id of defaultPinsForBrawler(bId)) set.add(id);
      }
      return Array.from(set);
    })(),
    equippedPinsBy: (() => {
      const out: Record<string, string[]> = { ...(p.equippedPinsBy || {}) };
      for (const bId of unlockedBrawlers) {
        const existing = out[bId];
        if (!Array.isArray(existing) || existing.length === 0) {
          out[bId] = defaultEquippedPins(bId).slice(0, PIN_EQUIP_SLOTS);
        } else if (existing.length < PIN_EQUIP_SLOTS) {
          out[bId] = migrateEquippedPinSlots(existing, bId);
        } else {
          out[bId] = existing.slice(0, PIN_EQUIP_SLOTS);
        }
      }
      for (const bId of Object.keys(out)) {
        out[bId] = out[bId].filter(id => !REMOVED_PIN_IDS.has(id));
      }
      return out;
    })(),
    starGuardian: p.starGuardian,
    astralSettings: p.astralSettings,
    onboardingTutorialCompleted: p.onboardingTutorialCompleted === true,
    onboardingBattleTutorialCompleted: p.onboardingBattleTutorialCompleted === true,
    onboardingPostBattleGuideActive: p.onboardingPostBattleGuideActive === true,
    onboardingPostBattleGuideStep: typeof p.onboardingPostBattleGuideStep === "string"
      ? p.onboardingPostBattleGuideStep
      : undefined,
    trophyUnlockGuideDone: Array.isArray(p.trophyUnlockGuideDone) ? p.trophyUnlockGuideDone.filter((x): x is string => typeof x === "string") : [],
    trophyUnlockGuideQueue: Array.isArray(p.trophyUnlockGuideQueue) ? p.trophyUnlockGuideQueue.filter((x): x is string => typeof x === "string") : [],
    modeFirstPlayHintsDone: Array.isArray(p.modeFirstPlayHintsDone) ? p.modeFirstPlayHintsDone.filter((x): x is string => typeof x === "string") : [],
    donateFlags: p.donateFlags,
    purchaseHistory: Array.isArray(p.purchaseHistory) ? p.purchaseHistory : [],
    clubId: p.clubId ?? null,
    clubInvites: p.clubInvites || [],
    clubChatLastReadAt: typeof p.clubChatLastReadAt === "number" ? p.clubChatLastReadAt : undefined,
    clubRewardLog: p.clubRewardLog || [],
    friends: Array.isArray(p.friends) ? p.friends : [],
    socialPresence: p.socialPresence,
    partyCode: p.partyCode ?? null,
    partyInviteIncoming: p.partyInviteIncoming,
    outgoingPartyInvite: p.outgoingPartyInvite,
    outgoingPartyInvites: (() => {
      const multi = p.outgoingPartyInvites;
      if (Array.isArray(multi) && multi.length) return multi;
      if (p.outgoingPartyInvite) return [p.outgoingPartyInvite];
      return undefined;
    })(),
    socialTestAutoAcceptParty: p.socialTestAutoAcceptParty,
    bossRaid: (() => {
      const raw = p.bossRaid;
      if (!raw || typeof raw !== "object" || !raw.byBoss) return { byBoss: {} as BossRaidProfileSlice["byBoss"] };
      return { byBoss: { ...raw.byBoss } };
    })(),
    siege: (() => {
      const raw = p.siege;
      if (!raw || typeof raw !== "object") return { maxDefeated: 0 };
      const m = Math.floor(Number(raw.maxDefeated) || 0);
      return { maxDefeated: Math.max(0, Math.min(5, m)) };
    })(),
    rankedCups: Math.max(0, Math.floor(Number(p.rankedCups) || 0)),
    rankedPeakCups: Math.max(
      0,
      Math.floor(Number(p.rankedPeakCups) || Number(p.rankedCups) || 0),
    ),
    rankedGames: Math.max(0, Math.floor(Number(p.rankedGames) || 0)),
    rankedWins: Math.max(0, Math.floor(Number(p.rankedWins) || 0)),
    rankedLosses: Math.max(0, Math.floor(Number(p.rankedLosses) || 0)),
    brawlerRankedCups: (() => {
      const out: Record<string, number> = {};
      for (const [id, v] of Object.entries(p.brawlerRankedCups || {})) {
        if (!unlockedBrawlers.includes(id)) continue;
        out[id] = Math.max(0, Math.floor(Number(v) || 0));
      }
      return Object.keys(out).length ? out : undefined;
    })(),
    lastRankedResult: p.lastRankedResult,
    proStarPassTokens: Math.max(0, Math.floor(Number(p.proStarPassTokens) || 0)),
    proStarPassClaimed: Array.isArray(p.proStarPassClaimed) ? p.proStarPassClaimed : [],
    proStarPassPaid: p.proStarPassPaid ?? false,
    proStarPassClaimedPaid: Array.isArray(p.proStarPassClaimedPaid) ? p.proStarPassClaimedPaid : [],
    proStarPassTierBonusesClaimed: Array.isArray(p.proStarPassTierBonusesClaimed) ? p.proStarPassTierBonusesClaimed : [],
    proStarPassInfiniteClaimed: Math.max(0, Math.floor(Number(p.proStarPassInfiniteClaimed) || 0)),
    proStarPassInfiniteClaimedFree: Math.max(
      0,
      Math.floor(Number(p.proStarPassInfiniteClaimedFree) || Number(p.proStarPassInfiniteClaimed) || 0),
    ),
    proStarPassInfiniteClaimedPaid: Math.max(0, Math.floor(Number(p.proStarPassInfiniteClaimedPaid) || 0)),
    bossRaidPending: Array.isArray(p.bossRaidPending) ? p.bossRaidPending : undefined,
    inbox: Array.isArray(p.inbox) ? p.inbox : [],
    pendingGifts: Array.isArray(p.pendingGifts) ? p.pendingGifts : [],
    accountBlocked: !!p.accountBlocked,
    blockedAt: typeof p.blockedAt === "number" ? p.blockedAt : undefined,
    boughtDeals: p.boughtDeals,
    dailyShopDeals: p.dailyShopDeals,
    pendingBrawlerStarPicks: Array.isArray(p.pendingBrawlerStarPicks)
      ? p.pendingBrawlerStarPicks.filter(id => typeof id === "string")
      : [],
    battleHistory: Array.isArray(p.battleHistory) ? p.battleHistory : [],
    newcomerGifts: (() => {
      const raw = p.newcomerGifts;
      if (!raw || typeof raw !== "object") return undefined;
      const claimedCount = Math.min(16, Math.max(0, Math.floor(Number(raw.claimedCount) || 0)));
      return {
        brawlerId: typeof raw.brawlerId === "string" ? raw.brawlerId : undefined,
        previewBrawlerId: typeof raw.previewBrawlerId === "string" ? raw.previewBrawlerId : undefined,
        claimedCount,
        lastClaimAt: typeof raw.lastClaimAt === "number" ? raw.lastClaimAt : undefined,
      };
    })(),
    clubTreasury: (() => {
      const raw = p.clubTreasury;
      if (!raw || typeof raw !== "object") return undefined;
      const contributionPct = Math.max(0, Math.min(15, Math.floor(Number(raw.contributionPct) || 0)));
      return {
        contributionPct,
        pctChangedAt: typeof raw.pctChangedAt === "number" ? raw.pctChangedAt : 0,
        clubJoinedAt: typeof raw.clubJoinedAt === "number" ? raw.clubJoinedAt : Date.now(),
        avgContributionPct: typeof raw.avgContributionPct === "number" ? raw.avgContributionPct : contributionPct,
        pctWeightedSum: typeof raw.pctWeightedSum === "number" ? raw.pctWeightedSum : 0,
        pctWeightedMs: typeof raw.pctWeightedMs === "number" ? raw.pctWeightedMs : 0,
      };
    })(),
  };
  if (result.favoritePinId && !(result.ownedPins || []).includes(result.favoritePinId)) {
    delete result.favoritePinId;
  }
  return result;
}

/** Roll / fix daily wins from localStorage only — never from in-memory normalize. */
export function ensureDailyWinsState(): DailyWinsState {
  const username = getCurrentUsername();
  if (!username) return normalizeDailyWinsState(null);
  const profiles = getAllProfiles();
  const rawDw = profiles[username]?.dailyWins;
  const state = normalizeDailyWinsState(rawDw);
  if (!dailyWinsStatesEqual(rawDw, state)) {
    updateProfile({ dailyWins: state });
  }
  return state;
}

export function getDailyWinsState(): DailyWinsState {
  return ensureDailyWinsState();
}

/** Next slot reward on win — returns profile patch (caller applies via updateProfile). */
export function buildDailyWinVictoryPatch(
  profile: UserProfile,
  mode: string,
  opts?: { queueMenuAnimation?: boolean },
): { patch: Partial<UserProfile>; granted: boolean; slotIndex?: number } {
  if (mode === "training" || mode === "bossraid") {
    return { patch: {}, granted: false };
  }
  const state = normalizeDailyWinsState(profile.dailyWins);
  if (!dailyWinsHasClaimable(state)) return { patch: {}, granted: false };

  const slot = state.slots[state.claimedCount];
  if (!slot) return { patch: {}, granted: false };

  const slotIndex = state.claimedCount;
  const nextState: DailyWinsState = {
    ...state,
    claimedCount: slotIndex + 1,
  };

  const resourcePatch = dailyWinsSlotProfilePatch(profile, slot);
  const patch: Partial<UserProfile> = { ...resourcePatch, dailyWins: nextState };

  if (opts?.queueMenuAnimation !== false) {
    queueMenuDailyWinsFx(rewardInfoFromDailyWinsSlot(slot));
  }
  return { patch, granted: true, slotIndex };
}

/** Ключ профиля: по ID игрока (без #) или никнейму. */
export function findProfileStorageKey(query: string): string | null {
  const all = getAllProfiles();
  const q = query.trim();
  if (!q) return null;

  const idQuery = normalizePlayerIdQuery(q);
  if (isValidPlayerIdFormat(idQuery)) {
    for (const [key, raw] of Object.entries(all)) {
      const pid = raw.playerId ? normalizePlayerIdQuery(raw.playerId) : normalizeProfile(raw).playerId;
      if (pid === idQuery) return key;
    }
    return null;
  }

  if (all[q]) return q;
  const lower = q.toLowerCase();
  for (const key of Object.keys(all)) {
    if (key.toLowerCase() === lower) return key;
  }
  return null;
}

/** Ключ профиля по e-mail (без учёта регистра). */
export function findProfileStorageKeyByEmail(email: string): string | null {
  const norm = email.trim().toLowerCase();
  if (!norm.includes("@")) return null;
  for (const [key, raw] of Object.entries(getAllProfiles())) {
    const em = raw.email?.trim().toLowerCase();
    if (em && em === norm) return key;
  }
  return null;
}

/** Локальный профиль, привязанный к облачному аккаунту (playerId / email / ник). */
export function findLocalProfileKeyForCloudAccount(input: {
  playerId: string;
  email?: string | null;
  username: string;
}): string | null {
  const byId = findProfileStorageKeyByPlayerId(input.playerId);
  if (byId) return byId;
  if (input.email) {
    const byEmail = findProfileStorageKeyByEmail(input.email);
    if (byEmail) return byEmail;
  }
  return findProfileStorageKey(input.username);
}

/** Ключ профиля только по уникальному ID игрока (никнейм не используется). */
export function findProfileStorageKeyByPlayerId(playerIdInput: string): string | null {
  const idQuery = normalizePlayerIdQuery(playerIdInput);
  if (!isValidPlayerIdFormat(idQuery)) return null;
  const all = getAllProfiles();
  for (const [key, raw] of Object.entries(all)) {
    const pid = raw.playerId ? normalizePlayerIdQuery(raw.playerId) : normalizeProfile(raw).playerId;
    if (pid === idQuery) return key;
  }
  return null;
}

// =========================================================================
// Per-brawler trophy ranks (1..100)
// =========================================================================

export const MAX_BRAWLER_RANK = 100;
export const MAX_BRAWLER_TROPHIES = 5000;

export interface BrawlerRankReward {
  rank: number;
  trophies: number; // cumulative trophies needed to reach this rank
  type: "coins" | "gems" | "powerPoints" | "chest" | "pin" | "profileIcon";
  amount: number;
  label: string;
  chestRarity?: ChestRarity;
  pinId?: string;
  iconId?: string;
}

function buildBrawlerRankTable(): BrawlerRankReward[] {
  const out: BrawlerRankReward[] = [];
  for (let rank = 1; rank <= MAX_BRAWLER_RANK; rank++) {
    // Cumulative trophy threshold: gentle early curve, steeper late game.
    // rank 1 → 10, rank 10 → ~135, rank 50 → ~1525, rank 100 → ~5000.
    const trophies = Math.round(10 * rank + 0.4 * rank * rank);

    let reward: Omit<BrawlerRankReward, "rank" | "trophies">;
    const rankPinId = BRAWLER_RANK_PIN_REWARDS[rank];
    if (rankPinId) {
      const def = getCollectiblePin(rankPinId);
      reward = {
        type: "pin",
        amount: 1,
        pinId: rankPinId,
        label: PIN_PUBLIC_LABEL,
      };
    } else if (rank === MAX_BRAWLER_RANK) {
      reward = { type: "chest", amount: 1, chestRarity: "mythic", label: "Мифический сундук" };
    } else if (rank === 75) {
      reward = { type: "chest", amount: 1, chestRarity: "legendary", label: "Легендарный сундук" };
    } else if (rank === 50) {
      reward = { type: "chest", amount: 1, chestRarity: "mega", label: "Мега-сундук" };
    } else if (rank === 25) {
      reward = { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" };
    } else if (rank % 15 === 0 && rank % 10 !== 0) {
      const iconId = profileIconIdForSlot(`br_rank_${rank}`);
      reward = {
        type: "profileIcon",
        amount: 1,
        iconId,
        label: profileIconRewardLabel(iconId),
      };
    } else if (rank % 10 === 0) {
      const rarity: ChestRarity = rank >= 60 ? "epic" : rank >= 30 ? "rare" : "common";
      const labelMap: Record<ChestRarity, string> = {
        common: "Обычный сундук", rare: "Редкий сундук", epic: "Эпический сундук",
        mega: "Мега-сундук", legendary: "Легендарный сундук", mythic: "Мифический сундук",
        ultralegendary: "Ультралегендарный сундук",
      };
      reward = { type: "chest", amount: 1, chestRarity: rarity, label: labelMap[rarity] };
    } else {
      // Rotate gems / power points / coins.
      const cycle = rank % 5;
      if (cycle === 0) {
        const amount = 5 + Math.floor(rank / 5);
        reward = { type: "gems", amount, label: `${amount} кристаллов` };
      } else if (cycle === 3) {
        const amount = 3 + Math.floor(rank / 4);
        reward = { type: "powerPoints", amount, label: `${amount} очков прокачки` };
      } else {
        const amount = 30 + rank * 5;
        reward = { type: "coins", amount, label: `${amount} монет` };
      }
    }
    out.push({ rank, trophies, ...reward });
  }
  return out;
}

export const BRAWLER_RANK_TABLE: BrawlerRankReward[] = buildBrawlerRankTable();

export function getBrawlerTrophies(profile: UserProfile | null, brawlerId: string): number {
  if (!profile) return 0;
  return profile.brawlerTrophies[brawlerId] || 0;
}

export function getBrawlerRank(trophies: number): number {
  // Highest rank whose trophy threshold is satisfied. Rank 0 if no rank yet.
  let rank = 0;
  for (const r of BRAWLER_RANK_TABLE) {
    if (trophies >= r.trophies) rank = r.rank;
    else break;
  }
  return rank;
}

export function getBrawlerRankClaimed(profile: UserProfile | null, brawlerId: string): number[] {
  if (!profile) return [];
  return profile.brawlerRankClaimed[brawlerId] || [];
}

export function getUnclaimedBrawlerRankCount(profile: UserProfile | null, brawlerId: string): number {
  if (!profile) return 0;
  const trophies = getBrawlerTrophies(profile, brawlerId);
  const rank = getBrawlerRank(trophies);
  const claimed = new Set(getBrawlerRankClaimed(profile, brawlerId));
  let n = 0;
  for (let r = 1; r <= rank; r++) if (!claimed.has(r)) n++;
  return n;
}

export function getTotalUnclaimedBrawlerRankCount(profile: UserProfile | null): number {
  if (!profile) return 0;
  let total = 0;
  for (const id of Object.keys(profile.brawlerTrophies)) {
    total += getUnclaimedBrawlerRankCount(profile, id);
  }
  return total;
}

export function claimBrawlerRankReward(
  brawlerId: string,
  rank: number,
): { success: boolean; reward?: BrawlerRankReward; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (rank < 1 || rank > MAX_BRAWLER_RANK) return { success: false, error: "Неверный ранг" };
  const reward = BRAWLER_RANK_TABLE[rank - 1];
  const trophies = getBrawlerTrophies(profile, brawlerId);
  if (trophies < reward.trophies) return { success: false, error: "Недостаточно кубков" };
  const claimed = new Set(getBrawlerRankClaimed(profile, brawlerId));
  if (claimed.has(rank)) return { success: false, error: "Уже получено" };
  claimed.add(rank);
  const updates: Partial<UserProfile> = {
    brawlerRankClaimed: {
      ...profile.brawlerRankClaimed,
      [brawlerId]: Array.from(claimed),
    },
  };
  if (reward.type === "coins") updates.coins = profile.coins + reward.amount;
  else if (reward.type === "gems") updates.gems = profile.gems + reward.amount;
  else if (reward.type === "powerPoints") updates.powerPoints = profile.powerPoints + reward.amount;
  else if (reward.type === "chest" && reward.chestRarity) {
    updates.chestInventory = {
      ...profile.chestInventory,
      [reward.chestRarity]: (profile.chestInventory[reward.chestRarity] || 0) + reward.amount,
    };
  } else if (reward.type === "pin" && reward.pinId) {
    applyPinRewardToUpdates(profile, updates, reward.pinId);
  } else if (reward.type === "profileIcon" && reward.iconId) {
    applyProfileIconRewardToUpdates(profile, updates, reward.iconId);
  }
  updateProfile(updates);
  return { success: true, reward };
}

export function claimBrawlerMasteryReward(
  brawlerId: string,
  level: number,
): { success: boolean; reward?: MasteryReward; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (level < 1 || level > MAX_MASTERY_LEVEL) return { success: false, error: "Неверный уровень" };
  const reward = getMasteryReward(level, brawlerId);
  if (!reward) return { success: false, error: "Награда не найдена" };
  const xp = getBrawlerMasteryXp(profile, brawlerId);
  const currentLevel = getMasteryLevel(xp);
  if (currentLevel < level) return { success: false, error: "Недостаточно опыта мастерства" };
  const claimed = new Set(getBrawlerMasteryClaimed(profile, brawlerId));
  if (claimed.has(level)) return { success: false, error: "Уже получено" };
  claimed.add(level);
  const updates: Partial<UserProfile> = {
    brawlerMasteryClaimed: {
      ...(profile.brawlerMasteryClaimed || {}),
      [brawlerId]: Array.from(claimed),
    },
  };
  if (reward.type === "coins") updates.coins = profile.coins + (reward.amount ?? 0);
  else if (reward.type === "gems") updates.gems = profile.gems + (reward.amount ?? 0);
  else if (reward.type === "powerPoints") updates.powerPoints = profile.powerPoints + (reward.amount ?? 0);
  else if (reward.type === "chest" && reward.chestRarity) {
    updates.chestInventory = {
      ...profile.chestInventory,
      [reward.chestRarity]: (profile.chestInventory[reward.chestRarity] || 0) + (reward.amount ?? 1),
    };
  } else if (reward.type === "pin" && reward.pinId) {
    applyPinRewardToUpdates(profile, updates, reward.pinId);
  } else if (reward.type === "title" && reward.titleId) {
    const unlocked = new Set(profile.masteryTitlesUnlocked || []);
    unlocked.add(reward.titleId);
    updates.masteryTitlesUnlocked = Array.from(unlocked);
  }
  updateProfile(updates);
  return { success: true, reward };
}

export function setEquippedMasteryTitle(titleId: string | null): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (titleId && !(profile.masteryTitlesUnlocked || []).includes(titleId)) {
    return { success: false, error: "Титул не разблокирован" };
  }
  updateProfile({ equippedMasteryTitle: titleId || undefined });
  return { success: true };
}

export {
  getBrawlerMasteryXp,
  getBrawlerMasteryClaimed,
  getUnclaimedBrawlerMasteryCount,
  getTotalUnclaimedBrawlerMasteryCount,
} from "./brawlerMasteryStorage";

// ─── Notification badges ────────────────────────────────────────────────────
// Helpers that return the number of *unclaimed* / *unread* items in each
// reward source so the lobby can show a red "1" badge on the corresponding
// menu entry.

export function getUnclaimedTrophyRoadCount(profile: UserProfile | null): number {
  if (!profile) return 0;
  const claimed = new Set(profile.trophyRoadClaimed);
  let count = 0;
  for (const r of TROPHY_ROAD) {
    if (r.trophies <= profile.trophies && !claimed.has(r.trophies)) count++;
  }
  return count;
}

export function getUnclaimedClashPassCount(profile: UserProfile | null): number {
  if (!profile) return 0;
  const claimedFree = new Set(profile.clashPassClaimed);
  const claimedPaid = new Set(profile.clashPassClaimedPaid || []);
  const claimedUltra = new Set(profile.clashPassClaimedUltra || []);
  const claimedInfinite = new Set(profile.clashPassInfiniteClaimed || []);
  const hasPaid = !!profile.clashPassPaid;
  const hasUltra = !!profile.clashPassUltraPaid;
  let count = 0;
  const finiteLevel = Math.min(profile.clashPassLevel, MAX_CLASHPASS_LEVEL);
  for (let lvl = 1; lvl <= finiteLevel; lvl++) {
    if (!claimedFree.has(lvl)) count++;
    if (hasPaid && !claimedPaid.has(lvl)) count++;
    if (hasUltra && !claimedUltra.has(lvl)) count++;
  }
  const reachedInfiniteTier = clashPassInfiniteTier(profile.clashPassLevel);
  for (let tier = 1; tier <= reachedInfiniteTier; tier++) {
    if (!claimedInfinite.has(tier)) count++;
  }
  return count;
}

export function getUnopenedChestCount(profile: UserProfile | null): number {
  if (!profile) return 0;
  return Object.values(profile.chestInventory || {}).reduce((a, b) => a + b, 0);
}

export function getClaimableQuestCount(profile: UserProfile | null): number {
  if (!profile) return 0;
  const pool = profile.questPool;
  if (!pool) return 0;
  if (profile.clashPassPaid) return 0;
  return pool.activeQuests.filter(
    q => !!q.isPaid && !q.claimed && q.progress >= q.target,
  ).length;
}

export function getLockedPaidQuestCount(profile: UserProfile | null): number {
  return getClaimableQuestCount(profile);
}

export function getActiveQuestCount(profile: UserProfile | null): number {
  if (!profile) return 0;
  const pool = profile.questPool;
  if (!pool) return 0;
  return pool.activeQuests.filter(q => !q.claimed).length;
}

export function isBrawlerUnlocked(profile: UserProfile | null, brawlerId: string): boolean {
  if (!profile) return false;
  return profile.unlockedBrawlers.includes(brawlerId);
}

export function getCurrentProfile(): UserProfile | null {
  const username = getCurrentUsername();
  if (!username) return null;
  const profiles = getAllProfiles();
  const raw = profiles[username];
  if (!raw) return null;
  const normalized = normalizeProfile(raw);
  const dailyWins = ensureDailyWinsState();
  return { ...normalized, dailyWins };
}

export function createProfile(username: string, password: string, email?: string): { success: boolean; error?: string; errorCode?: string } {
  const trimmed = username.trim();
  if (!trimmed || trimmed.length < 2) {
    return { success: false, error: "Username must be at least 2 characters" };
  }
  const nameMod = guardianModerateWithBuiltIn(trimmed, "player_name");
  if (!nameMod.allowed) return guardianBlockResult("player_name", nameMod);
  if (!password || password.length < 3) {
    return { success: false, error: "Password must be at least 3 characters" };
  }
  const trimmedEmail = email?.trim();
  if (trimmedEmail && !trimmedEmail.includes("@")) {
    return { success: false, error: "Invalid email" };
  }
  const profiles = getAllProfiles();
  if (profiles[trimmed]) {
    return { success: false, error: "Username already taken" };
  }
  const usedIds = collectUsedPlayerIds(profiles);
  const now = Date.now();
  const newProfile: UserProfile = normalizeProfile({
    username: trimmed,
    playerId: generateUniquePlayerId(usedIds),
    passwordHash: simpleHash(password),
    email: trimmedEmail || undefined,
    createdAt: now,
    profileLocalRev: now,
  } as UserProfile);
  profiles[trimmed] = newProfile;
  saveProfiles(profiles);
  setCurrentUsername(trimmed);
  return { success: true };
}

export function loginProfile(username: string, password: string): { success: boolean; error?: string } {
  const profiles = getAllProfiles();
  const key = findProfileStorageKey(username);
  if (!key) {
    return { success: false, error: "User not found" };
  }
  const profile = profiles[key];
  if (profile.accountBlocked) {
    return { success: false, error: "Аккаунт заблокирован администратором" };
  }
  if (profile.passwordHash !== simpleHash(password)) {
    return { success: false, error: "Wrong password" };
  }
  setCurrentUsername(key);
  return { success: true };
}

export function createGuestProfile(): void {
  const guestName = `Guest_${Math.floor(Math.random() * 9999)}`;
  const profiles = getAllProfiles();
  const usedIds = collectUsedPlayerIds(profiles);
  const now = Date.now();
  profiles[guestName] = normalizeProfile({
    username: guestName,
    playerId: generateUniquePlayerId(usedIds),
    passwordHash: "",
    coins: 200,
    gems: 10,
    powerPoints: 5,
    createdAt: now,
    profileLocalRev: now,
  } as UserProfile);
  saveProfiles(profiles);
  setCurrentUsername(guestName);
}

export function updateProfile(updates: Partial<UserProfile>, opts?: { skipTreasury?: boolean }): void {
  const username = getCurrentUsername();
  if (!username) return;
  const profiles = getAllProfiles();
  if (!profiles[username]) return;
  const { playerId: _immutable, ...safe } = updates;
  const current = profiles[username];
  let merged = { ...safe } as Partial<UserProfile>;
  if (!opts?.skipTreasury) {
    merged = applyTreasuryOnResourceGrant(current, merged);
  }
  profiles[username] = mergeStarFeatPeaksIntoProfile({ ...current, ...merged });
  const touched = profiles[username];
  if (typeof safe.trophies === "number" && safe.trophies !== current.trophies) {
    import("./progression/unlockGuideState").then(({ syncUnlockGuidesAfterTrophyChange }) => {
      syncUnlockGuidesAfterTrophyChange(current.trophies ?? 0, safe.trophies as number);
    }).catch(() => {});
  }
  profiles[username] = { ...touched, profileLocalRev: Date.now() };
  saveProfiles(profiles);
}

export function syncStarFeatPeaks(profile?: UserProfile | null): boolean {
  const p = profile ?? getCurrentProfile();
  if (!p) return false;
  const merged = mergeStarFeatPeaksIntoProfile(p);
  const changed =
    JSON.stringify(merged.starFeatProgress) !== JSON.stringify(p.starFeatProgress) ||
    JSON.stringify(merged.starFeatTierBadges) !== JSON.stringify(p.starFeatTierBadges);
  if (!changed) return false;
  updateProfile({
    starFeatProgress: merged.starFeatProgress,
    starFeatTierBadges: merged.starFeatTierBadges,
  });
  return true;
}

export function trackStarFeatProgress(
  kind: StarFeatKind,
  amount: number,
  opts?: { brawlerId?: string; mode?: string; place?: number; won?: boolean },
): void {
  const profile = getCurrentProfile();
  if (!profile || amount <= 0) return;
  const next = applyStarFeatIncrement(profile, kind, amount, opts);
  if (!next) return;
  updateProfile({
    starFeatProgress: next.starFeatProgress,
    starFeatTierBadges: next.starFeatTierBadges,
  });
}

export function trackStarFeatsFromBattle(ctx: StarFeatBattleContext): void {
  const profile = getCurrentProfile();
  if (!profile) return;
  const merged = applyStarFeatsFromBattle(profile, ctx);
  updateProfile({
    starFeatProgress: merged.starFeatProgress,
    starFeatTierBadges: merged.starFeatTierBadges,
  });
}

export function claimStarFeatReward(featId: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  const def = getStarFeatDef(featId);
  if (!def) return { success: false, error: "Подвиг не найден" };

  const synced = mergeStarFeatPeaksIntoProfile(profile);
  if (!isStarFeatComplete(def, synced)) return { success: false, error: "Подвиг ещё не выполнен" };
  if (isStarFeatClaimed(def, synced)) return { success: false, error: "Награда уже получена" };

  const r = def.reward;
  const patch: Partial<UserProfile> = {
    starFeatClaimed: { ...(synced.starFeatClaimed ?? {}), [featId]: true },
  };

  switch (r.kind) {
    case "coins":
      patch.coins = profile.coins + r.amount;
      break;
    case "gems":
      patch.gems = profile.gems + r.amount;
      break;
    case "powerPoints":
      patch.powerPoints = profile.powerPoints + r.amount;
      break;
    case "chest":
      patch.chestInventory = {
        ...profile.chestInventory,
        [r.chest]: (profile.chestInventory[r.chest] || 0) + 1,
      };
      break;
  }

  updateProfile(patch);
  return { success: true };
}

export function logout(): void {
  setCurrentUsername(null);
}

export function isGuestProfile(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return profile.username.startsWith("Guest_") && !profile.passwordHash;
}

export interface LocalAccountSummary {
  username: string;
  email?: string;
  playerId?: string;
  isGuest: boolean;
  isCurrent: boolean;
  totalGamesPlayed: number;
  totalWins: number;
  coins: number;
  trophies: number;
  createdAt: number;
}

export function listLocalAccounts(): LocalAccountSummary[] {
  const profiles = getAllProfiles();
  const current = getCurrentUsername();
  return Object.entries(profiles)
    .map(([key, p]) => ({
      username: key,
      email: p.email,
      playerId: p.playerId,
      isGuest: isGuestProfile(p),
      isCurrent: key === current,
      totalGamesPlayed: p.totalGamesPlayed,
      totalWins: p.totalWins,
      coins: p.coins,
      trophies: p.trophies,
      createdAt: p.createdAt,
    }))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
}

export function upgradeGuestToRegistered(
  username: string,
  password: string,
  email?: string,
): { success: boolean; error?: string; errorCode?: string } {
  const current = getCurrentUsername();
  if (!current) return { success: false, error: "Not logged in" };
  const profiles = getAllProfiles();
  const profile = profiles[current];
  if (!profile || !isGuestProfile(profile)) {
    return { success: false, error: "Only guest profiles can be upgraded here" };
  }
  const trimmed = username.trim();
  if (!trimmed || trimmed.length < 2) {
    return { success: false, error: "Username must be at least 2 characters" };
  }
  const nameMod = guardianModerateWithBuiltIn(trimmed, "player_name");
  if (!nameMod.allowed) return guardianBlockResult("player_name", nameMod);
  if (!password || password.length < 3) {
    return { success: false, error: "Password must be at least 3 characters" };
  }
  const trimmedEmail = email?.trim();
  if (trimmedEmail && !trimmedEmail.includes("@")) {
    return { success: false, error: "Invalid email" };
  }
  if (profiles[trimmed] && trimmed !== current) {
    return { success: false, error: "Username already taken" };
  }
  const updated = normalizeProfile({
    ...profile,
    username: trimmed,
    passwordHash: simpleHash(password),
    email: trimmedEmail || undefined,
  });
  delete profiles[current];
  profiles[trimmed] = updated;
  saveProfiles(profiles);
  setCurrentUsername(trimmed);
  return { success: true };
}

export function switchToAccount(username: string): { success: boolean; error?: string } {
  const profiles = getAllProfiles();
  const profile = profiles[username];
  if (!profile) return { success: false, error: "Account not found" };
  if (profile.accountBlocked) {
    return { success: false, error: "Аккаунт заблокирован администратором" };
  }
  setCurrentUsername(username);
  return { success: true };
}

export function deleteLocalAccount(username: string): { success: boolean; error?: string } {
  const profiles = getAllProfiles();
  if (!profiles[username]) return { success: false, error: "Account not found" };
  delete profiles[username];
  saveProfiles(profiles);
  if (getCurrentUsername() === username) {
    setCurrentUsername(null);
  }
  return { success: true };
}

export function changeAccountPassword(
  currentPassword: string,
  newPassword: string,
): { success: boolean; error?: string } {
  const username = getCurrentUsername();
  if (!username) return { success: false, error: "Not logged in" };
  const profiles = getAllProfiles();
  const profile = profiles[username];
  if (!profile || isGuestProfile(profile)) {
    return { success: false, error: "Guest accounts have no password" };
  }
  if (profile.passwordHash !== simpleHash(currentPassword)) {
    return { success: false, error: "Wrong password" };
  }
  if (!newPassword || newPassword.length < 3) {
    return { success: false, error: "Password must be at least 3 characters" };
  }
  profiles[username] = { ...profile, passwordHash: simpleHash(newPassword) };
  saveProfiles(profiles);
  return { success: true };
}

export function changeAccountEmail(newEmail: string): { success: boolean; error?: string } {
  const username = getCurrentUsername();
  if (!username) return { success: false, error: "Not logged in" };
  const profiles = getAllProfiles();
  const profile = profiles[username];
  if (!profile || isGuestProfile(profile)) {
    return { success: false, error: "Register the account first" };
  }
  const email = newEmail.trim();
  if (email && !email.includes("@")) {
    return { success: false, error: "Invalid email" };
  }
  profiles[username] = { ...profile, email: email || undefined };
  saveProfiles(profiles);
  return { success: true };
}

export function recordPurchase(entry: Omit<PurchaseRecord, "id" | "ts">): void {
  const username = getCurrentUsername();
  if (!username) return;
  const profiles = getAllProfiles();
  const profile = profiles[username];
  if (!profile) return;
  const history = profile.purchaseHistory ?? [];
  const record: PurchaseRecord = {
    ...entry,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  };
  profiles[username] = { ...profile, purchaseHistory: [record, ...history].slice(0, 120) };
  saveProfiles(profiles);
}

export function claimDailyBonus(): { success: boolean; coins?: number } {
  // Legacy entry point — re-routed through the new daily ladder so existing
  // callers (e.g. ShopPage's "+50 monet" daily bonus card) keep working.
  const r = claimDailyLadderReward();
  if (!r.success) return { success: false };
  if (r.reward?.type === "coins") return { success: true, coins: r.reward.amount };
  return { success: true, coins: 0 };
}

export function openBox(): { type: string; amount: number } {
  const profile = getCurrentProfile();
  if (!profile || profile.coins < 100) return { type: "error", amount: 0 };
  const roll = Math.random();
  let reward: { type: string; amount: number };
  if (roll < 0.70) {
    const coins = Math.floor(Math.random() * 151) + 50;
    reward = { type: "coins", amount: coins };
    updateProfile({ coins: profile.coins - 100 + coins });
  } else if (roll < 0.95) {
    const pp = Math.floor(Math.random() * 5) + 1;
    reward = { type: "powerPoints", amount: pp };
    updateProfile({ coins: profile.coins - 100, powerPoints: profile.powerPoints + pp });
  } else {
    const gems = Math.floor(Math.random() * 3) + 1;
    reward = { type: "gems", amount: gems };
    updateProfile({ coins: profile.coins - 100, gems: profile.gems + gems });
  }
  return reward;
}

export function upgradeBrawlerCost(level: number): { coins: number; powerPoints: number } {
  return getEffectiveUpgradeCost(level);
}

export function upgradeBrawler(id: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  const level = profile.brawlerLevels[id] || 1;
  if (level >= MAX_BRAWLER_LEVEL) return { success: false, error: "Max level reached" };
  const cost = upgradeBrawlerCost(level);
  const costCoins = cost.coins;
  const costPP = cost.powerPoints;
  if (profile.coins < costCoins) return { success: false, error: `Need ${costCoins} coins` };
  if (profile.powerPoints < costPP) return { success: false, error: `Need ${costPP} power points` };
  const newLevels = { ...profile.brawlerLevels, [id]: level + 1 };
  updateProfile({
    coins: profile.coins - costCoins,
    powerPoints: profile.powerPoints - costPP,
    brawlerLevels: newLevels,
  });
  trackQuestProgress("upgrade_brawler", 1);
  trackStarFeatProgress("upgrade_brawler", 1);
  void import("../audio/gameSfxService").then((m) => m.playBrawlerLevelUpSfx());
  return { success: true };
}

export function addCoins(amount: number, opts?: { skipTreasury?: boolean }): void {
  const profile = getCurrentProfile();
  if (!profile) return;
  updateProfile({ coins: profile.coins + amount }, opts);
}

export function addGems(amount: number, opts?: { skipTreasury?: boolean }): void {
  const profile = getCurrentProfile();
  if (!profile) return;
  updateProfile({ gems: profile.gems + amount }, opts);
}

/**
 * Apply rewards that were computed authoritatively by the battle server.
 * The client does NOT decide the amounts — it only applies what the server sent
 * (anti-cheat). Persistent server-side wallet is the next hardening step.
 */
export function applyOnlineBattleRewards(reward: {
  brawlerId: string;
  trophyDelta: number;
  coins: number;
  xp: number;
}): { trophies: number; brawlerTrophies: number } | null {
  const profile = getCurrentProfile();
  if (!profile) return null;
  const newTrophies = Math.max(0, (profile.trophies || 0) + (reward.trophyDelta || 0));
  const curBr = profile.brawlerTrophies[reward.brawlerId] || 0;
  const newBr = Math.max(0, curBr + (reward.trophyDelta || 0));
  updateProfile({
    trophies: newTrophies,
    xp: (profile.xp || 0) + Math.max(0, reward.xp || 0),
    brawlerTrophies: { ...profile.brawlerTrophies, [reward.brawlerId]: newBr },
  });
  if (reward.coins) addCoins(Math.max(0, reward.coins));
  return { trophies: newTrophies, brawlerTrophies: newBr };
}

import { computeModeTrophyDelta, getModeTrophyTable } from "./trophyTables";
import {
  computeMonsterInvasionTrophyDelta,
  rollMonsterInvasionCompletionBonus,
} from "./monsterInvasionRewards";
import { applyWinStreakAfterMatch, isWinStreakVisible } from "./winStreak";
import { getBattleAfkWinTrophySuppressed } from "../game/battleAfk";
import { isRankedBattleSession } from "./rankedMapPick";
import { isPlayerMapBattleSession } from "./playerMaps/playerMapSession";
import { applyRankedCupDelta } from "./rankedProgress";
import {
  getMasteryLevel,
  getMasteryReward,
  MAX_MASTERY_LEVEL,
  type MasteryReward,
} from "../data/brawlerMastery";
import {
  computeMasteryXpGain,
  getBrawlerMasteryClaimed,
  getBrawlerMasteryXp,
} from "./brawlerMasteryStorage";

export function getBattleHistory(): BattleRecord[] {
  return getCurrentProfile()?.battleHistory ?? [];
}

type QuestTrackContext = {
  won: boolean;
  mode: string;
  place: number;
  actualDelta: number;
  brawlerId: string;
  killCount: number;
  damageDealt: number;
  healingDone: number;
  superUses: number;
  powerCubesCollected: number;
};

function trackQuestsByContext(ctx: QuestTrackContext): void {
  const bMeta: QuestMeta = { brawlerId: ctx.brawlerId };
  const modeMeta: QuestMeta = { mode: ctx.mode };
  const isShowdownLike = ctx.mode === "showdown" || ctx.mode === "megashowdown";

  const trackers: Array<() => void> = [
    () => trackQuestProgress("play_games", 1),
    () => trackQuestProgress("play_brawler", 1, bMeta),
    () => { if (ctx.won) trackQuestProgress("win_games", 1); },
    () => { if (ctx.won) trackQuestProgress("win_brawler", 1, bMeta); },
    () => { if (ctx.won && ctx.mode === "gemgrab") trackQuestProgress("win_mode_gemgrab", 1, modeMeta); },
    () => { if (ctx.won && ctx.mode === "heist") trackQuestProgress("win_mode_heist", 1, modeMeta); },
    () => { if (ctx.won && ctx.mode === "bounty") trackQuestProgress("win_mode_bounty", 1, modeMeta); },
    () => { if (ctx.won && ctx.mode === "starstrike") trackQuestProgress("win_mode_starstrike", 1, modeMeta); },
    () => { if (ctx.won && isShowdownLike) trackQuestProgress("win_mode_showdown", 1, { mode: "showdown" }); },
    () => {
      if (isShowdownLike) trackQuestProgress("play_showdown", 1);
      else if (ctx.mode !== "training") trackQuestProgress("play_team", 1);
    },
    () => { if (isShowdownLike && ctx.place <= 5) trackQuestProgress("survive_showdown", 1); },
    () => { if (isShowdownLike && ctx.place <= 3) trackQuestProgress("place_top3", 1); },
    () => { if (isShowdownLike && ctx.place === 1) trackQuestProgress("place_top1_showdown", 1); },
    () => { if (ctx.actualDelta > 0) trackQuestProgress("earn_trophies", ctx.actualDelta); },
    () => {
      if (ctx.killCount > 0) {
        trackQuestProgress("kill_enemies", ctx.killCount);
        trackQuestProgress("kill_brawler", ctx.killCount, bMeta);
      }
    },
    () => {
      if (ctx.damageDealt > 0) {
        trackQuestProgress("deal_damage", ctx.damageDealt);
        trackQuestProgress("damage_brawler", ctx.damageDealt, bMeta);
      }
    },
    () => { if (ctx.healingDone > 0) trackQuestProgress("heal_hp", ctx.healingDone); },
    () => { if (ctx.superUses > 0) trackQuestProgress("use_super", ctx.superUses); },
    () => { if (ctx.powerCubesCollected > 0) trackQuestProgress("collect_powercubes", ctx.powerCubesCollected); },
  ];
  for (const t of trackers) t();
}

export function recordRankedBattleOnlyResult(opts: {
  won: boolean;
  mode: string;
  brawlerId?: string;
  place?: number;
  durationSec?: number;
  killCount?: number;
  damageDealt?: number;
  healingDone?: number;
  superUses?: number;
  powerCubesCollected?: number;
}): ReturnType<typeof recordGameResult> {
  const profile = getCurrentProfile();
  if (!profile) {
    return { trophyDelta: 0, xpGained: 0, coinsEarned: 0, place: 0, clashPassUp: false, winStreak: 0, winStreakBonus: 0, masteryXpGained: 0, masteryLeaderBonus: 0 };
  }
  const usedId = opts.brawlerId || profile.selectedBrawlerId;
  const place = opts.place ?? (opts.won ? 1 : 2);
  const change = applyRankedCupDelta(profile.rankedCups ?? 0, opts.won);
  const newRankedCups = Math.max(0, (profile.rankedCups ?? 0) + change.delta);
  const newRankedPeakCups = Math.max(profile.rankedPeakCups ?? newRankedCups, newRankedCups);
  const brCups = { ...(profile.brawlerRankedCups || {}) };
  brCups[usedId] = Math.max(0, (brCups[usedId] ?? 0) + change.delta);
  const coinsEarned = opts.won ? 12 : 4;
  const xpGained = opts.won ? 20 : 8;

  const proPassPaid = !!profile.proStarPassPaid;
  const proPassMult = proPassPaid ? 2 : 1;
  let proStarPassTokens = profile.proStarPassTokens ?? 0;
  let proStarPassTierBonusesClaimed = [...(profile.proStarPassTierBonusesClaimed ?? [])];
  let proStarPassTokensGained = 0;
  if (opts.won) {
    const winAdd = 25 * proPassMult;
    proStarPassTokens += winAdd;
    proStarPassTokensGained += winAdd;
  }
  const beforeG = change.before.globalTier;
  const afterG = change.after.globalTier;
  if (afterG > beforeG) {
    const claimedSet = new Set(proStarPassTierBonusesClaimed);
    for (let g = beforeG + 1; g <= afterG; g++) {
      const key = String(g);
      if (claimedSet.has(key)) continue;
      claimedSet.add(key);
      proStarPassTierBonusesClaimed.push(key);
      const tierAdd = 200 * proPassMult;
      proStarPassTokens += tierAdd;
      proStarPassTokensGained += tierAdd;
    }
  }

  const newRecord: BattleRecord = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    mode: `ranked:${opts.mode}`,
    brawlerId: usedId,
    won: opts.won,
    place,
    totalPlayers: 6,
    trophyDelta: 0,
    xpGained,
    coinsEarned,
    durationSec: opts.durationSec,
    enemies: [],
  };
  const newHistory = [newRecord, ...(profile.battleHistory ?? [])].slice(0, 20);

  updateProfile({
    rankedCups: newRankedCups,
    rankedPeakCups: newRankedPeakCups,
    rankedGames: (profile.rankedGames ?? 0) + 1,
    rankedWins: opts.won ? (profile.rankedWins ?? 0) + 1 : profile.rankedWins ?? 0,
    rankedLosses: !opts.won ? (profile.rankedLosses ?? 0) + 1 : profile.rankedLosses ?? 0,
    brawlerRankedCups: brCups,
    coins: profile.coins + coinsEarned,
    xp: profile.xp + xpGained,
    proStarPassTokens,
    proStarPassTierBonusesClaimed,
    totalGamesPlayed: profile.totalGamesPlayed + 1,
    totalWins: opts.won ? profile.totalWins + 1 : profile.totalWins,
    totalLosses: !opts.won ? profile.totalLosses + 1 : profile.totalLosses,
    lastResult: {
      place,
      trophyDelta: 0,
      xpGained,
      mode: opts.mode,
      won: opts.won,
      rankedCupDelta: change.delta,
      rankedBattle: true,
      proStarPassTokensGained: proStarPassTokensGained > 0 ? proStarPassTokensGained : undefined,
    },
    lastRankedResult: {
      delta: change.delta,
      won: opts.won,
      mode: opts.mode,
      beforeLeagueId: change.before.leagueId,
      afterLeagueId: change.after.leagueId,
    },
    battleHistory: newHistory,
  });

  trackQuestsByContext({
    won: opts.won,
    mode: opts.mode,
    place,
    actualDelta: 0,
    brawlerId: usedId,
    killCount: opts.killCount ?? 0,
    damageDealt: opts.damageDealt ?? 0,
    healingDone: opts.healingDone ?? 0,
    superUses: opts.superUses ?? 0,
    powerCubesCollected: opts.powerCubesCollected ?? 0,
  });

  return {
    trophyDelta: 0,
    xpGained,
    coinsEarned,
    place,
    clashPassUp: false,
    winStreak: 0,
    winStreakBonus: 0,
    masteryXpGained: 0,
    masteryLeaderBonus: 0,
  };
}

function recordPlayerMapBattleOnlyResult(opts: {
  won: boolean;
  mode: string;
  brawlerId?: string;
  place?: number;
  totalPlayers?: number;
  enemies?: Array<{ id: string; name: string; isBot: boolean }>;
  durationSec?: number;
  killCount?: number;
  damageDealt?: number;
  healingDone?: number;
  superUses?: number;
  powerCubesCollected?: number;
}): ReturnType<typeof recordGameResult> {
  const profile = getCurrentProfile();
  if (!profile) {
    return { trophyDelta: 0, xpGained: 0, coinsEarned: 0, place: 0, clashPassUp: false, winStreak: 0, winStreakBonus: 0, masteryXpGained: 0, masteryLeaderBonus: 0 };
  }
  const usedId = opts.brawlerId || profile.selectedBrawlerId;
  const place = opts.place ?? (opts.won ? 1 : 2);
  const xpGained = opts.won ? 14 : 6;
  const coinsEarned = opts.won ? 10 : 4;
  const newRecord: BattleRecord = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    mode: opts.mode,
    brawlerId: usedId,
    won: opts.won,
    place,
    totalPlayers: opts.totalPlayers ?? 6,
    trophyDelta: 0,
    xpGained,
    coinsEarned,
    durationSec: opts.durationSec,
    enemies: opts.enemies ?? [],
  };
  const newHistory = [newRecord, ...(profile.battleHistory ?? [])].slice(0, 20);
  updateProfile({
    coins: profile.coins + coinsEarned,
    xp: profile.xp + xpGained,
    totalGamesPlayed: profile.totalGamesPlayed + 1,
    totalWins: opts.won ? profile.totalWins + 1 : profile.totalWins,
    totalLosses: !opts.won ? profile.totalLosses + 1 : profile.totalLosses,
    lastResult: {
      place,
      trophyDelta: 0,
      xpGained,
      mode: opts.mode,
      won: opts.won,
      playerMapBattle: true,
    },
    battleHistory: newHistory,
  });
  trackQuestsByContext({
    won: opts.won,
    mode: opts.mode,
    place,
    actualDelta: 0,
    brawlerId: usedId,
    killCount: opts.killCount ?? 0,
    damageDealt: opts.damageDealt ?? 0,
    healingDone: opts.healingDone ?? 0,
    superUses: opts.superUses ?? 0,
    powerCubesCollected: opts.powerCubesCollected ?? 0,
  });
  return {
    trophyDelta: 0,
    xpGained,
    coinsEarned,
    place,
    clashPassUp: false,
    winStreak: 0,
    winStreakBonus: 0,
    masteryXpGained: 0,
    masteryLeaderBonus: 0,
  };
}

export function recordGameResult(opts: {
  won: boolean;
  mode: string;
  brawlerId?: string;
  place?: number; // 1..10 for showdown, 1 or 2 for team modes
  totalPlayers?: number;
  enemies?: Array<{ id: string; name: string; isBot: boolean }>;
  durationSec?: number;
  // Per-match stats for quest tracking
  killCount?: number;
  damageDealt?: number;
  healingDone?: number;
  superUses?: number;
  powerCubesCollected?: number;
  petBonusCoins?: number;
  /** Whether this player is the party leader (for mastery XP bonus). */
  isPartyLeader?: boolean;
  /** Monster Hide: extra trophies per monster kill (+1 each). */
  monsterKillTrophyBonus?: number;
  // Multiplier applied to coins, XP, and trophy delta. Used by special modes
  // such as Mega Star Battle (×1.5) to reward higher-stakes play.
  rewardMultiplier?: number;
  wavesCleared?: number;
}): {
  trophyDelta: number;
  xpGained: number;
  coinsEarned: number;
  place: number;
  clashPassUp: boolean;
  winStreak: number;
  winStreakBonus: number;
  masteryXpGained: number;
  masteryLeaderBonus: number;
} {
  const profile = getCurrentProfile();
  if (!profile) {
    return { trophyDelta: 0, xpGained: 0, coinsEarned: 0, place: 0, clashPassUp: false, winStreak: 0, winStreakBonus: 0, masteryXpGained: 0, masteryLeaderBonus: 0 };
  }
  if (isRankedBattleSession()) {
    return recordRankedBattleOnlyResult(opts);
  }
  if (isPlayerMapBattleSession()) {
    return recordPlayerMapBattleOnlyResult(opts);
  }
  const { won, mode } = opts;
  if (mode === "bossraid") {
    const usedId = opts.brawlerId || profile.selectedBrawlerId;
    const place = won ? 1 : 2;
    const newRecord: BattleRecord = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
      mode,
      brawlerId: usedId,
      won,
      place,
      totalPlayers: 6,
      trophyDelta: 0,
      xpGained: 0,
      coinsEarned: 0,
      durationSec: opts.durationSec,
      enemies: opts.enemies ?? [],
    };
    const prevHistory = profile.battleHistory ?? [];
    const newHistory = [newRecord, ...prevHistory].slice(0, 20);
    updateProfile({
      totalGamesPlayed: profile.totalGamesPlayed + 1,
      lastResult: { place, trophyDelta: 0, xpGained: 0, mode, won },
      battleHistory: newHistory,
    });
    return { trophyDelta: 0, xpGained: 0, coinsEarned: 0, place, clashPassUp: false, winStreak: 0, winStreakBonus: 0, masteryXpGained: 0, masteryLeaderBonus: 0 };
  }
  const rewardMul = opts.rewardMultiplier && opts.rewardMultiplier > 0 ? opts.rewardMultiplier : 1;
  const lucky = getLuckyRushBattleBonuses(won);
  // Mega Star Battle is showdown-style (free-for-all with placement).
  const isShowdownLike = mode === "showdown" || mode === "megashowdown" || mode === "hardcoreShowdown" || mode === "teamHunt";
  const place = opts.place ?? (won ? 1 : 2);
  const totalPlayers = opts.totalPlayers ?? (isShowdownLike ? 10 : 2);
  const showdownFormat = opts.showdownFormat ?? profile.selectedShowdownFormat ?? "solo";
  const starStrikeFormat = opts.starStrikeFormat ?? profile.selectedStarStrikeFormat ?? "3v3";

  const usedId = opts.brawlerId || profile.selectedBrawlerId;
  const prevBrawlerTrophies = profile.brawlerTrophies[usedId] || 0;

  const trophyMode = mode === "monsterInvasion"
    ? true
    : !!getModeTrophyTable(mode, { showdownFormat, starStrikeFormat });
  const invasionWaves = mode === "monsterInvasion"
    ? Math.max(0, Math.floor(opts.wavesCleared ?? 0))
    : 0;
  const baseTrophyDelta = mode === "monsterInvasion"
    ? computeMonsterInvasionTrophyDelta(invasionWaves)
    : computeModeTrophyDelta({
      mode,
      brawlerTrophies: prevBrawlerTrophies,
      place,
      won,
      showdownFormat,
      starStrikeFormat,
      rewardMultiplier: rewardMul,
    });

  const streakBefore = profile.brawlerWinStreak?.[usedId] ?? 0;
  const peakBefore = profile.brawlerWinStreakPeak?.[usedId] ?? 0;
  const streakApply = applyWinStreakAfterMatch({
    trophyMode,
    baseTrophyDelta: baseTrophyDelta,
    currentStreak: streakBefore,
    currentPeak: peakBefore,
  });

  const monsterKillBonus = Math.max(0, opts.monsterKillTrophyBonus ?? 0);
  // Trophy road uses admin table values only (+ monster-hide kill bonus). Win-streak bonus is shown separately.
  let trophyDelta = Math.round((baseTrophyDelta + monsterKillBonus) * lucky.trophyMul);
  if (won && getBattleAfkWinTrophySuppressed() && trophyDelta > 0) {
    trophyDelta = 0;
  }
  const winStreak = streakApply.newStreak;
  const winStreakBonus = streakApply.streakBonus;
  const newTrophies = Math.max(0, Math.min(MAX_TROPHIES, profile.trophies + trophyDelta));
  const actualDelta = newTrophies - profile.trophies;

  // XP
  let xpGained: number;
  if (isShowdownLike) {
    xpGained = Math.max(8, 50 - (place - 1) * 6);
  } else {
    xpGained = won ? 40 : 12;
  }
  xpGained = Math.round(xpGained * rewardMul);

  let dailyBattleXp = 0;
  let passDailyPatch: Partial<UserProfile> = {};
  if (won) {
    const daily = grantPassDailyBattleXpOnWin(profile);
    dailyBattleXp = daily.granted;
    const state = ensurePassDailyBattleState(profile);
    passDailyPatch = {
      passDailyBattleDay: state.dayKey,
      passDailyBattleFreeLeft: state.freeLeft - daily.freeUsed,
      passDailyBattlePaidLeft: state.paidLeft - daily.paidUsed,
    };
  }

  const xpFromBattle = xpGained + dailyBattleXp;
  const passApply = applyClashPassXpToProfile(profile, xpFromBattle);
  let newXp = passApply.newXp;
  let newLevel = passApply.newLevel;
  let clashPassUp = passApply.clashPassUp;

  const coinsEarned = 0;
  let invasionBonusCoins = 0;
  let invasionBonusGems = 0;
  let invasionBonusPP = 0;
  let invasionBonusChest: ChestRarity | null = null;
  if (mode === "monsterInvasion" && won && invasionWaves >= 10) {
    const bonus = rollMonsterInvasionCompletionBonus();
    invasionBonusCoins = bonus.coins;
    invasionBonusGems = bonus.gems;
    invasionBonusPP = bonus.powerPoints;
    invasionBonusChest = bonus.chestRarity;
  }
  if (lucky.extraChest) invasionBonusChest = lucky.extraChest;
  let ppBonus = 0;
  if (isShowdownLike) {
    const basePp = Math.max(1, 7 - (place - 1));
    ppBonus = Math.round(basePp * 1.5);
  } else {
    ppBonus = Math.round((won ? 4 : 1) * 1.5);
  }
  ppBonus = Math.round(ppBonus * rewardMul * lucky.ppMul) + lucky.extraPP;
  invasionBonusPP = Math.round(invasionBonusPP * lucky.ppMul);
  if (isLuckyRushActive("gems")) invasionBonusGems = Math.round(invasionBonusGems * 2);
  invasionBonusGems += lucky.extraGems;
  invasionBonusCoins = Math.round(invasionBonusCoins * luckyRushCoinMultiplier()) + lucky.extraCoins;

  // Mode stats
  const ms = profile.modeStats[mode] || { games: 0, wins: 0, losses: 0 };
  const newModeStats = {
    ...profile.modeStats,
    [mode]: {
      games: ms.games + 1,
      wins: won ? ms.wins + 1 : ms.wins,
      losses: !won ? ms.losses + 1 : ms.losses,
    },
  };

  const newBrawlerTrophies = Math.max(
    0,
    Math.min(MAX_BRAWLER_TROPHIES, prevBrawlerTrophies + actualDelta),
  );
  const updatedBrawlerTrophies = {
    ...profile.brawlerTrophies,
    [usedId]: newBrawlerTrophies,
  };
  const prevPeak = profile.brawlerTrophyPeak?.[usedId] ?? prevBrawlerTrophies;
  const updatedBrawlerTrophyPeak = {
    ...(profile.brawlerTrophyPeak || {}),
    [usedId]: Math.max(prevPeak, newBrawlerTrophies),
  };

  const newRecord: BattleRecord = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    mode,
    brawlerId: usedId,
    won,
    place,
    totalPlayers,
    trophyDelta: actualDelta,
    xpGained,
    coinsEarned,
    durationSec: opts.durationSec,
    enemies: opts.enemies ?? [],
    showdownFormat: mode === "showdown" ? showdownFormat : undefined,
    wavesCleared: typeof opts.wavesCleared === "number" ? opts.wavesCleared : undefined,
  };
  const prevHistory = profile.battleHistory ?? [];
  const newHistory = [newRecord, ...prevHistory].slice(0, 20);

  // Bump the player's club battle counter (no-op if not in a club or training).
  // We dispatch a window event instead of importing clubs.ts directly to
  // avoid a circular ESM dependency. clubs.ts subscribes on first import.
  if (profile.username && typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("clash:battle-finished", {
        detail: { username: profile.username, mode, won },
      }));
    } catch { /* ignore */ }
  }

  const dailyWin = won && actualDelta > 0
    ? buildDailyWinVictoryPatch(profile, mode)
    : { patch: {} as Partial<UserProfile>, granted: false };

  let masteryXpGained = 0;
  let masteryLeaderBonus = 0;
  let masteryPatch: Partial<UserProfile> = {};
  if (won && mode !== "training") {
    const prevMasteryXp = profile.brawlerMasteryXp?.[usedId] ?? 0;
    const gain = computeMasteryXpGain(prevMasteryXp, !!opts.isPartyLeader);
    masteryXpGained = gain.gained;
    masteryLeaderBonus = gain.leaderBonus;
    if (masteryXpGained > 0) {
      masteryPatch = {
        brawlerMasteryXp: {
          ...(profile.brawlerMasteryXp || {}),
          [usedId]: gain.newXp,
        },
      };
    }
  }

  updateProfile({
    totalGamesPlayed: profile.totalGamesPlayed + 1,
    totalWins: won ? profile.totalWins + 1 : profile.totalWins,
    totalLosses: !won ? profile.totalLosses + 1 : profile.totalLosses,
    coins: dailyWin.patch.coins ?? profile.coins + coinsEarned + invasionBonusCoins,
    gems: dailyWin.patch.gems ?? profile.gems + invasionBonusGems,
    powerPoints: dailyWin.patch.powerPoints ?? profile.powerPoints + ppBonus + invasionBonusPP,
    ...(invasionBonusChest ? {
      chestInventory: {
        ...profile.chestInventory,
        [invasionBonusChest]: (profile.chestInventory[invasionBonusChest] || 0) + 1,
      },
    } : {}),
    trophies: newTrophies,
    trophyPeak: Math.max(profile.trophyPeak ?? profile.trophies, newTrophies),
    xp: newXp,
    clashPassLevel: newLevel,
    modeStats: newModeStats,
    brawlerTrophies: updatedBrawlerTrophies,
    brawlerTrophyPeak: updatedBrawlerTrophyPeak,
    ...(trophyMode ? {
      brawlerWinStreak: { ...(profile.brawlerWinStreak || {}), [usedId]: winStreak },
      brawlerWinStreakPeak: {
        ...(profile.brawlerWinStreakPeak || {}),
        [usedId]: streakApply.newPeak,
      },
    } : {}),
    lastResult: {
      place,
      trophyDelta: actualDelta,
      xpGained: xpFromBattle,
      mode,
      won,
      ...(isWinStreakVisible(winStreak) ? { winStreak } : {}),
      ...(winStreakBonus > 0 ? { winStreakBonus } : {}),
      ...(masteryXpGained > 0 ? { masteryXpGained } : {}),
      ...(masteryLeaderBonus > 0 ? { masteryLeaderBonus } : {}),
      ...(monsterKillBonus > 0 ? { monsterKillTrophyBonus: monsterKillBonus } : {}),
      ...(mode === "monsterInvasion" && invasionWaves > 0 ? { wavesCleared: invasionWaves } : {}),
      ...(invasionBonusChest ? { invasionCompletionChest: invasionBonusChest } : {}),
      ...(invasionBonusCoins > 0 ? { invasionBonusCoins } : {}),
      ...(invasionBonusGems > 0 ? { invasionBonusGems } : {}),
      ...(invasionBonusPP > 0 ? { invasionBonusPP } : {}),
    },
    battleHistory: newHistory,
    ...passDailyPatch,
    ...masteryPatch,
    ...(dailyWin.patch.chestInventory ? { chestInventory: dailyWin.patch.chestInventory } : {}),
    ...(dailyWin.patch.dailyWins ? { dailyWins: dailyWin.patch.dailyWins } : {}),
  });

  // Track quest progress via dedicated per-quest trackers.
  trackQuestsByContext({
    won,
    mode,
    place,
    actualDelta,
    brawlerId: usedId,
    killCount: opts.killCount ?? 0,
    damageDealt: opts.damageDealt ?? 0,
    healingDone: opts.healingDone ?? 0,
    superUses: opts.superUses ?? 0,
    powerCubesCollected: opts.powerCubesCollected ?? 0,
  });

  const monsterKills = opts.monsterKillTrophyBonus ?? 0;
  trackStarFeatsFromBattle({
    won,
    mode,
    place,
    brawlerId: usedId,
    killCount: opts.killCount ?? 0,
    damageDealt: opts.damageDealt ?? 0,
    healingDone: opts.healingDone ?? 0,
    superUses: opts.superUses ?? 0,
    powerCubesCollected: opts.powerCubesCollected ?? 0,
    trophyDelta: actualDelta > 0 ? actualDelta : 0,
    monsterKills,
  });

  return {
    trophyDelta: actualDelta,
    xpGained: xpFromBattle,
    coinsEarned,
    place,
    clashPassUp,
    winStreak,
    winStreakBonus,
    masteryXpGained,
    masteryLeaderBonus,
  };
  void totalPlayers;
}

export function setSelectedBrawler(id: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (!profile.unlockedBrawlers.includes(id)) {
    return { success: false, error: "Боец заблокирован" };
  }
  updateProfile({ selectedBrawlerId: id });
  return { success: true };
}

// Unlock a brawler in the shop using gems.
export function unlockBrawlerWithGems(brawlerId: string): { success: boolean; error?: string; cost?: number } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  const brawler = BRAWLERS.find(b => b.id === brawlerId);
  if (!brawler) return { success: false, error: "Боец не найден" };
  if (profile.unlockedBrawlers.includes(brawlerId)) {
    return { success: false, error: "Уже разблокирован" };
  }
  const cost = getEffectiveBrawlerGemCost(brawler.rarity);
  if (profile.gems < cost) {
    return { success: false, error: `Нужно ${cost} кристаллов`, cost };
  }
  const newBrawlers = [...(profile.newBrawlers || [])];
  if (!newBrawlers.includes(brawlerId)) newBrawlers.push(brawlerId);
  updateProfile({
    gems: profile.gems - cost,
    unlockedBrawlers: [...profile.unlockedBrawlers, brawlerId],
    newBrawlers,
  });
  return { success: true, cost };
}

export function getBrawlerStarsCount(profile: UserProfile | null, brawlerId: string): number {
  if (!profile) return 0;
  return profile.brawlerStars?.[brawlerId]?.length || 0;
}

export function getBrawlerStars(profile: UserProfile | null, brawlerId: string): number[] {
  if (!profile) return [];
  return profile.brawlerStars?.[brawlerId] || [];
}

export function getBrawlerConstellationDefs(brawlerId: string): BrawlerStarDef[] {
  return getEffectiveConstellation(brawlerId);
}

export function buyBrawlerStarWithGems(brawlerId: string, starIndex: number): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  const defs = getEffectiveConstellation(brawlerId);
  if (!defs.some(s => s.index === starIndex)) return { success: false, error: "Звезда не найдена" };
  if (!profile.unlockedBrawlers.includes(brawlerId)) return { success: false, error: "Сначала открой бойца" };
  const had = new Set(profile.brawlerStars?.[brawlerId] || []);
  if (had.has(starIndex)) return { success: false, error: "Уже открыто" };
  if (had.size >= MAX_STARS_PER_BRAWLER) return { success: false, error: "Все звезды уже открыты" };
  const starCost = getEffectiveStarCosts().singleGems;
  if (profile.gems < starCost) return { success: false, error: `Нужно ${starCost} кристаллов` };
  had.add(starIndex);
  updateProfile({
    gems: profile.gems - starCost,
    brawlerStars: { ...(profile.brawlerStars || {}), [brawlerId]: Array.from(had).sort((a, b) => a - b) },
  });
  return { success: true };
}

export function getPendingBrawlerStarPicks(profile: UserProfile | null = getCurrentProfile()): string[] {
  return profile?.pendingBrawlerStarPicks ?? [];
}

export function hasPendingBrawlerStarPick(
  brawlerId: string,
  profile: UserProfile | null = getCurrentProfile(),
): boolean {
  return (profile?.pendingBrawlerStarPicks ?? []).includes(brawlerId);
}

export function getUnownedStarIndices(profile: UserProfile, brawlerId: string): number[] {
  const owned = new Set(profile.brawlerStars?.[brawlerId] ?? []);
  return (getEffectiveConstellation(brawlerId))
    .map(s => s.index)
    .filter(i => !owned.has(i));
}

/** Grant one constellation star from a duplicate-brawler chest drop (free). */
export function claimPendingBrawlerStar(
  brawlerId: string,
  starIndex: number,
): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (!hasPendingBrawlerStarPick(brawlerId, profile)) {
    return { success: false, error: "Нет бесплатной звезды для этого бойца" };
  }
  const defs = getEffectiveConstellation(brawlerId) ?? [];
  if (!defs.some(s => s.index === starIndex)) return { success: false, error: "Звезда не найдена" };
  const had = new Set(profile.brawlerStars?.[brawlerId] ?? []);
  if (had.has(starIndex)) return { success: false, error: "Звезда уже открыта" };
  had.add(starIndex);
  const pending = (profile.pendingBrawlerStarPicks ?? []).filter(id => id !== brawlerId);
  updateProfile({
    brawlerStars: { ...(profile.brawlerStars ?? {}), [brawlerId]: Array.from(had).sort((a, b) => a - b) },
    pendingBrawlerStarPicks: pending,
  });
  return { success: true };
}

export function buyBrawlerStarsPackWithGems(brawlerId: string): { success: boolean; gained?: number[]; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (!profile.unlockedBrawlers.includes(brawlerId)) return { success: false, error: "Сначала открой бойца" };
  const defs = getEffectiveConstellation(brawlerId) || [];
  const had = new Set(profile.brawlerStars?.[brawlerId] || []);
  const missing = defs.map(s => s.index).filter(i => !had.has(i));
  if (missing.length === 0) return { success: false, error: "Все звезды уже открыты" };
  if (missing.length < 3) return { success: false, error: `Для пакета нужно минимум 3 неоткрытые звезды (осталось ${missing.length})` };
  const packCost = getEffectiveStarCosts().pack3Gems;
  if (profile.gems < packCost) return { success: false, error: `Нужно ${packCost} кристаллов` };
  const picks = missing.slice(0, 3);
  for (const p of picks) had.add(p);
  updateProfile({
    gems: profile.gems - packCost,
    brawlerStars: { ...(profile.brawlerStars || {}), [brawlerId]: Array.from(had).sort((a, b) => a - b) },
  });
  return { success: true, gained: picks };
}

// Mark a brawler as seen in the collection (removes the "NEW" badge).
export function markBrawlerSeen(brawlerId: string): void {
  const profile = getCurrentProfile();
  if (!profile) return;
  const newBrawlers = (profile.newBrawlers || []).filter(id => id !== brawlerId);
  updateProfile({ newBrawlers });
}

// Get the list of newly unlocked brawlers not yet viewed in the collection.
export function getNewBrawlers(): string[] {
  return getCurrentProfile()?.newBrawlers || [];
}

// Directly grant a brawler unlock (used by chest drops).
export function grantBrawlerUnlock(brawlerId: string): { success: boolean } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false };
  if (profile.unlockedBrawlers.includes(brawlerId)) return { success: false };
  const newBrawlers = [...(profile.newBrawlers || [])];
  if (!newBrawlers.includes(brawlerId)) newBrawlers.push(brawlerId);
  updateProfile({ unlockedBrawlers: [...profile.unlockedBrawlers, brawlerId], newBrawlers });
  return { success: true };
}

// =========================================================================
// PETS
// =========================================================================

export function unlockPetWithGems(petId: string): { success: boolean; error?: string; cost?: number } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  const pet = PETS.find(p => p.id === petId);
  if (!pet) return { success: false, error: "Питомец не найден" };
  if ((profile.unlockedPets || []).includes(petId)) {
    return { success: false, error: "Уже разблокирован" };
  }
  const cost = getEffectivePetGemCost(pet.rarity);
  if (profile.gems < cost) {
    return { success: false, error: `Нужно ${cost} кристаллов`, cost };
  }
  const newPets = [...(profile.newPets || [])];
  if (!newPets.includes(petId)) newPets.push(petId);
  updateProfile({
    gems: profile.gems - cost,
    unlockedPets: [...(profile.unlockedPets || []), petId],
    newPets,
  });
  return { success: true, cost };
}

export function grantPetUnlock(petId: string): { success: boolean } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false };
  if ((profile.unlockedPets || []).includes(petId)) return { success: false };
  const newPets = [...(profile.newPets || [])];
  if (!newPets.includes(petId)) newPets.push(petId);
  updateProfile({
    unlockedPets: [...(profile.unlockedPets || []), petId],
    newPets,
  });
  return { success: true };
}

export function equipPet(petId: string | null): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (petId !== null && !(profile.unlockedPets || []).includes(petId)) {
    return { success: false, error: "Питомец не разблокирован" };
  }
  updateProfile({ equippedPetId: petId });
  return { success: true };
}

export function markPetSeen(petId: string): void {
  const profile = getCurrentProfile();
  if (!profile) return;
  const newPets = (profile.newPets || []).filter(id => id !== petId);
  updateProfile({ newPets });
}

/** Custom nickname for a pet, or null if not set. */
export function getPetCustomName(petId: string, profile?: UserProfile | null): string | null {
  const p = profile ?? getCurrentProfile();
  const name = p?.petCustomNames?.[petId]?.trim();
  if (!name || name.length < 2) return null;
  return name;
}

/** Display name: custom nickname if set, otherwise the provided fallback (usually i18n name). */
export function getPetDisplayName(petId: string, fallback: string, profile?: UserProfile | null): string {
  return getPetCustomName(petId, profile) ?? fallback;
}

/** Whether this pet already has a custom name (subsequent renames cost gems). */
export function petHasCustomName(petId: string, profile?: UserProfile | null): boolean {
  return getPetCustomName(petId, profile) !== null;
}

/** First naming is free; changing an existing name costs RENAME_GEM_COST gems. */
export function renamePet(petId: string, newName: string): { success: boolean; error?: string; errorCode?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (!(profile.unlockedPets || []).includes(petId)) {
    return { success: false, error: "Питомец не разблокирован" };
  }
  const trimmed = newName.trim();
  if (trimmed.length < 2 || trimmed.length > 16) {
    return { success: false, error: "Имя должно быть 2-16 символов" };
  }
  const nameMod = guardianModerateWithBuiltIn(trimmed, "pet_name");
  if (!nameMod.allowed) return guardianBlockResult("pet_name", nameMod);
  const existing = profile.petCustomNames?.[petId];
  if (existing === trimmed) {
    return { success: false, error: "Это уже имя питомца" };
  }
  const isFirstName = !existing;
  if (!isFirstName && profile.gems < RENAME_GEM_COST) {
    return { success: false, error: `Нужно ${RENAME_GEM_COST} кристаллов` };
  }
  const petCustomNames = { ...(profile.petCustomNames || {}), [petId]: trimmed };
  const updates: Partial<UserProfile> = { petCustomNames };
  if (!isFirstName) updates.gems = profile.gems - RENAME_GEM_COST;
  updateProfile(updates);
  return { success: true };
}

/** Equip the profile's pet on a brawler, including any custom nickname. */
export function applyProfilePetToBrawler(b: Brawler, profile?: UserProfile | null): void {
  const p = profile ?? getCurrentProfile();
  const petId = p?.equippedPetId ?? null;
  const pet = getPetById(petId);
  const customName = petId ? getPetCustomName(petId, p) : null;
  b.setEquippedPet(pet, customName);
  b.setMotionTrail(getEquippedTrailForBrawler(p, b.stats.id));
}

/** @deprecated Use applyProfilePetToBrawler — trail is applied together. */
export function applyProfileTrailToBrawler(b: Brawler, profile?: UserProfile | null): void {
  const p = profile ?? getCurrentProfile();
  b.setMotionTrail(getEquippedTrailForBrawler(p, b.stats.id));
}

export function getNewPets(): string[] {
  return getCurrentProfile()?.newPets || [];
}

// =========================================================================
// PINS (emotes)
// =========================================================================

/** Returns the flat set of pin ids the player owns. */
export function getOwnedPins(profile?: UserProfile | null): string[] {
  const p = profile ?? getCurrentProfile();
  return p?.ownedPins ?? [];
}

export function isPinOwned(pinId: string, profile?: UserProfile | null): boolean {
  return getOwnedPins(profile).includes(pinId);
}

/** Returns the equipped pin slots for a given brawler. Always returns
 *  exactly PIN_EQUIP_SLOTS entries (empty string for empty slots). */
export function getEquippedPins(brawlerId: string, profile?: UserProfile | null): string[] {
  const p = profile ?? getCurrentProfile();
  const raw = (p?.equippedPinsBy ?? {})[brawlerId] ?? [];
  const slots = raw.slice(0, PIN_EQUIP_SLOTS);
  while (slots.length < PIN_EQUIP_SLOTS) slots.push("");
  return slots;
}

/** Purchase a pin with gems. Validates ownership / cost / unlock prereqs. */
export function purchasePinWithGems(pinId: string): { success: boolean; error?: string; cost?: number } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if ((profile.ownedPins || []).includes(pinId)) {
    return { success: false, error: "Пин уже куплен" };
  }
  if (isUniversalPinId(pinId)) {
    return { success: false, error: "Этот пин выдаётся бесплатно" };
  }
  if (isCollectiblePinId(pinId)) {
    if (!getCollectiblePin(pinId)) return { success: false, error: "Неизвестный пин" };
    const cost = pinCostGems(pinId);
    if (cost <= 0) return { success: false, error: "Пин недоступен" };
    if (profile.gems < cost) return { success: false, error: `Нужно ${cost} 💎`, cost };
    updateProfile({
      gems: profile.gems - cost,
      ownedPins: [...(profile.ownedPins || []), pinId],
    });
    return { success: true, cost };
  }
  const parsed = parsePinId(pinId);
  if (!parsed) return { success: false, error: "Неизвестный пин" };
  if (!profile.unlockedBrawlers.includes(parsed.brawlerId)) {
    return { success: false, error: "Сначала откройте этого бойца" };
  }
  const cost = pinCostGems(pinId);
  if (cost <= 0) return { success: false, error: "Пин бесплатный" };
  if (profile.gems < cost) return { success: false, error: `Нужно ${cost} 💎`, cost };
  updateProfile({
    gems: profile.gems - cost,
    ownedPins: [...(profile.ownedPins || []), pinId],
  });
  return { success: true, cost };
}

/** Equip a pin into a given slot (0..PIN_EQUIP_SLOTS-1) for a brawler.
 *  Passing an empty string clears that slot. */
export function equipPin(
  brawlerId: string,
  slot: number,
  pinId: string,
): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (slot < 0 || slot >= PIN_EQUIP_SLOTS) {
    return { success: false, error: "Слот вне диапазона" };
  }
  if (pinId && !(profile.ownedPins || []).includes(pinId)) {
    return { success: false, error: "Пин не куплен" };
  }
  if (pinId && !slotAcceptsPin(slot, pinId)) {
    return {
      success: false,
      error: isUniversalPinId(pinId)
        ? "Общий пин — только в правые 4 слота"
        : "Пин персонажа — только в левые 4 слота",
    };
  }
  const current = getEquippedPins(brawlerId, profile);
  // Allow swapping: if the chosen pin is already in another slot, swap the
  // two so the player keeps a useful 4-pin loadout.
  const otherSlot = current.indexOf(pinId);
  if (pinId && otherSlot !== -1 && otherSlot !== slot) {
    current[otherSlot] = current[slot];
  }
  current[slot] = pinId;
  const byBrawler = { ...(profile.equippedPinsBy || {}), [brawlerId]: current };
  updateProfile({ equippedPinsBy: byBrawler });
  return { success: true };
}

/** Grant pin or compensate coins if already owned. */
export function grantPin(pinId: string): {
  success: boolean;
  duplicate?: boolean;
  coins?: number;
} {
  if (REMOVED_PIN_IDS.has(pinId)) return { success: false };
  const profile = getCurrentProfile();
  if (!profile) return { success: false };
  const owned = profile.ownedPins || [];
  if (owned.includes(pinId)) {
    const def = getCollectiblePin(pinId);
    const coins = def ? PIN_DUPLICATE_COINS[def.rarity] : 100;
    updateProfile({ coins: profile.coins + coins });
    return { success: true, duplicate: true, coins };
  }
  updateProfile({ ownedPins: [...owned, pinId] });
  return { success: true };
}

// Pick a random locked pet weighted by chest tier. Returns null if the player
// already owns every pet that this chest can drop.
function pickLockedPetForChest(profile: UserProfile, chestRarity: ChestRarity): string | null {
  const owned = new Set(profile.unlockedPets || []);
  const weights = CHEST_PET_RARITY_WEIGHTS[chestRarity];

  // Build the cumulative pool: only rarities with at least one locked pet.
  const buckets: { rarity: PetRarity; weight: number; pets: string[] }[] = [];
  for (const [rarity, w] of Object.entries(weights)) {
    if (!w) continue;
    const lockedAtRarity = PETS
      .filter(p => p.rarity === (rarity as PetRarity) && !owned.has(p.id))
      .map(p => p.id);
    if (lockedAtRarity.length > 0) {
      buckets.push({ rarity: rarity as PetRarity, weight: w, pets: lockedAtRarity });
    }
  }
  if (buckets.length === 0) return null;

  const totalWeight = buckets.reduce((s, b) => s + b.weight, 0);
  let r = Math.random() * totalWeight;
  for (const b of buckets) {
    r -= b.weight;
    if (r <= 0) return b.pets[Math.floor(Math.random() * b.pets.length)];
  }
  const last = buckets[buckets.length - 1];
  return last.pets[Math.floor(Math.random() * last.pets.length)];
}

function pickLockedCollectiblePinForChest(profile: UserProfile, chestRarity: ChestRarity): string | null {
  const owned = new Set(profile.ownedPins || []);
  const weights = CHEST_PIN_RARITY_WEIGHTS[chestRarity];
  const buckets: { weight: number; pins: string[] }[] = [];
  for (const [rarity, w] of Object.entries(weights)) {
    if (!w) continue;
    const locked = COLLECTIBLE_PINS
      .filter(p => p.rarity === (rarity as CollectiblePinRarity) && !owned.has(p.id) && !isPassExclusivePin(p.id))
      .map(p => p.id);
    if (locked.length > 0) buckets.push({ weight: w, pins: locked });
  }
  if (buckets.length === 0) return null;
  const total = buckets.reduce((s, b) => s + b.weight, 0);
  let r = Math.random() * total;
  for (const b of buckets) {
    r -= b.weight;
    if (r <= 0) return b.pins[Math.floor(Math.random() * b.pins.length)];
  }
  const last = buckets[buckets.length - 1];
  return last.pins[Math.floor(Math.random() * last.pins.length)];
}

/** Random unowned collectible pin (daily ladder / quests / chest fallback). */
export function pickRandomUnownedCollectiblePin(
  minRarity?: CollectiblePinRarity,
  commonOnly = false,
): string | null {
  const profile = getCurrentProfile();
  if (!profile) return null;
  const owned = new Set(profile.ownedPins || []);
  const order: CollectiblePinRarity[] = ["common", "rare", "epic", "unique", "golden"];
  const minIdx = minRarity ? order.indexOf(minRarity) : 0;
  let pool = COLLECTIBLE_PINS.filter(p => !owned.has(p.id) && order.indexOf(p.rarity) >= minIdx && !isPassExclusivePin(p.id));
  if (commonOnly) pool = pool.filter(p => p.rarity === "common");
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/** Random unowned common pin (free track sources). */
export function pickRandomUnownedCommonPin(): string | null {
  const profile = getCurrentProfile();
  if (!profile) return null;
  const owned = new Set(profile.ownedPins || []);
  const pool = COMMON_COLLECTIBLE_PIN_IDS.filter(id => !owned.has(id) && !isPassExclusivePin(id));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function brawlerStarCount(profile: UserProfile, brawlerId: string): number {
  return profile.brawlerStars?.[brawlerId]?.length ?? 0;
}

/** Brawler can drop from chest: new unlock OR duplicate with a free star slot left. */
export function canBrawlerDropFromChest(profile: UserProfile, chestRarity: ChestRarity): boolean {
  return BRAWLERS.some(b => {
    if (!brawlerCanDropFromChestTier(b.rarity, chestRarity)) return false;
    if (!profile.unlockedBrawlers.includes(b.id)) return true;
    return brawlerStarCount(profile, b.id) < MAX_STARS_PER_BRAWLER;
  });
}

/** New unlock or duplicate (free star pick) from chest brawler roll. */
function pickBrawlerDropForChest(
  profile: UserProfile,
  chestRarity: ChestRarity,
  forcedTier?: ChestRarity,
): { brawlerId: string; isDuplicate: boolean } | null {
  const tierOk = (b: (typeof BRAWLERS)[number]) =>
    brawlerCanDropFromChestTier(b.rarity, chestRarity)
    && (!forcedTier || b.rarity === forcedTier);

  const canUnlock = BRAWLERS.filter(b => tierOk(b) && !profile.unlockedBrawlers.includes(b.id));
  const canDuplicate = BRAWLERS.filter(b =>
    tierOk(b)
    && profile.unlockedBrawlers.includes(b.id)
    && brawlerStarCount(profile, b.id) < MAX_STARS_PER_BRAWLER,
  );

  if (canUnlock.length === 0 && canDuplicate.length === 0) return null;

  const wantDuplicate = canDuplicate.length > 0
    && (canUnlock.length === 0 || Math.random() < 0.5);

  if (wantDuplicate) {
    const pick = pickWeightedBrawlerFromPool(canDuplicate, chestRarity);
    if (!pick) return null;
    return { brawlerId: pick.id, isDuplicate: true };
  }

  const pick = pickWeightedBrawlerFromPool(canUnlock, chestRarity);
  if (!pick) return null;
  return { brawlerId: pick.id, isDuplicate: false };
}

export function setSelectedMode(mode: string): void {
  updateProfile({ selectedMode: mode });
}

export function setSelectedShowdownFormat(format: "solo" | "duo" | "trio"): void {
  updateProfile({ selectedShowdownFormat: format });
}

export function setSelectedStarStrikeFormat(format: "3v3" | "5v5"): void {
  updateProfile({ selectedStarStrikeFormat: format });
}

export function setFavoriteBrawler(id: string): void {
  updateProfile({ favoriteBrawlerId: id });
}

/** Pin shown on profile card; null if unset or no longer owned. */
export function getFavoritePinId(profile?: UserProfile | null): string | null {
  const p = profile ?? getCurrentProfile();
  const id = p?.favoritePinId;
  if (!id || !isPinOwned(id, p)) return null;
  return id;
}

export function setFavoritePin(pinId: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (!pinId) {
    updateProfile({ favoritePinId: undefined });
    return { success: true };
  }
  if (!isPinOwned(pinId, profile)) {
    return { success: false, error: "Пин недоступен" };
  }
  updateProfile({ favoritePinId: pinId });
  return { success: true };
}

export function setProfileIcon(iconId: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (!isProfileIconUnlocked(profile, iconId)) {
    return { success: false, error: "Иконка ещё не открыта" };
  }
  updateProfile({ profileIconId: iconId });
  return { success: true };
}

export function setIntroDisplayIcon(
  slot: IntroDisplayIconSlot,
  iconId: string,
): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (!isProfileIconUnlocked(profile, iconId)) {
    return { success: false, error: "Иконка ещё не открыта" };
  }
  const ids = [...getIntroDisplayIconIds(profile)];
  ids[slot] = iconId;
  updateProfile({ introDisplayIconIds: ids });
  return { success: true };
}

export { getIntroDisplayIconIds };

export function setUsernameColor(color: string): void {
  if (isSubscriberNameColor(color)) {
    const profile = getCurrentProfile();
    const until = (profile?.starGuardian as { activeUntil?: number } | undefined)?.activeUntil ?? 0;
    if (until <= Date.now()) return;
  }
  updateProfile({ usernameColor: color });
}

export function purchaseProfileIcon(iconId: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (!canBuyProfileIconInShop(profile, iconId)) {
    return { success: false, error: "Иконка недоступна для покупки" };
  }
  if (profile.gems < PROFILE_ICON_GEM_COST) {
    return { success: false, error: `Нужно ${PROFILE_ICON_GEM_COST} кристаллов` };
  }
  const unlockedProfileIcons = grantProfileIcon(profile, iconId);
  updateProfile({
    gems: profile.gems - PROFILE_ICON_GEM_COST,
    unlockedProfileIcons,
  });
  return { success: true };
}

export function grantProfileIconToPlayer(iconId: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  const def = PROFILE_ICON_BY_ID.get(iconId);
  if (!def) return { success: false, error: "Неизвестная иконка" };
  if (def.unlock.type === "brawler") {
    if (!profile.unlockedBrawlers.includes(def.unlock.brawlerId)) {
      return { success: false, error: "Сначала откройте бойца" };
    }
    return { success: true };
  }
  if (def.unlock.type === "stored") {
    updateProfile({ unlockedProfileIcons: grantProfileIcon(profile, iconId) });
    return { success: true };
  }
  return { success: true };
}

export function purchasePortraitBackground(backgroundId: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  const def = PORTRAIT_BACKGROUND_BY_ID.get(backgroundId);
  if (!def) return { success: false, error: "Неизвестный фон" };
  if (def.free) return { success: false, error: "Фон уже доступен" };
  if (isPortraitBackgroundUnlocked(profile, backgroundId)) {
    return { success: false, error: "Фон уже куплен" };
  }
  if (profile.gems < PORTRAIT_BG_GEM_COST) {
    return { success: false, error: `Нужно ${PORTRAIT_BG_GEM_COST} кристаллов` };
  }
  const unlocked = new Set(profile.unlockedPortraitBackgrounds ?? []);
  unlocked.add(backgroundId);
  updateProfile({
    gems: profile.gems - PORTRAIT_BG_GEM_COST,
    unlockedPortraitBackgrounds: ensureDefaultPortraitBackgroundUnlocked({
      ...profile,
      unlockedPortraitBackgrounds: [...unlocked],
    }),
  });
  return { success: true };
}

export function setEquippedPortraitBackground(backgroundId: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (!PORTRAIT_BACKGROUND_BY_ID.has(backgroundId)) {
    return { success: false, error: "Неизвестный фон" };
  }
  if (!isPortraitBackgroundUnlocked(profile, backgroundId)) {
    return { success: false, error: "Сначала купите фон" };
  }
  updateProfile({ equippedPortraitBackgroundId: backgroundId });
  return { success: true };
}

export function purchaseMotionTrail(trailId: string): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (!BRAWLER_TRAIL_BY_ID.has(trailId)) return { success: false, error: "Неизвестный след" };
  if (isTrailOwned(profile, trailId)) return { success: false, error: "След уже куплен" };
  if (profile.gems < TRAIL_GEM_COST) {
    return { success: false, error: `Нужно ${TRAIL_GEM_COST} кристаллов` };
  }
  const owned = new Set(profile.ownedMotionTrails ?? []);
  owned.add(trailId);
  updateProfile({
    gems: profile.gems - TRAIL_GEM_COST,
    ownedMotionTrails: [...owned],
  });
  return { success: true };
}

export function setGlobalEquippedMotionTrail(trailId: string | null): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (trailId && (!BRAWLER_TRAIL_BY_ID.has(trailId) || !isTrailOwned(profile, trailId))) {
    return { success: false, error: "Сначала купите след" };
  }
  updateProfile({ equippedMotionTrailGlobalId: trailId });
  return { success: true };
}

export function setBrawlerTrailMode(
  brawlerId: string,
  mode: "global" | "individual",
): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (!BRAWLERS.some(b => b.id === brawlerId)) return { success: false, error: "Неизвестный боец" };
  const brawlerTrailMode = { ...(profile.brawlerTrailMode || {}), [brawlerId]: mode };
  const patch: Partial<UserProfile> = { brawlerTrailMode };
  if (mode === "global") {
    const by = { ...(profile.equippedMotionTrailByBrawler || {}) };
    delete by[brawlerId];
    patch.equippedMotionTrailByBrawler = by;
  }
  updateProfile(patch);
  return { success: true };
}

export function setBrawlerIndividualMotionTrail(
  brawlerId: string,
  trailId: string | null,
): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Не авторизован" };
  if (!BRAWLERS.some(b => b.id === brawlerId)) return { success: false, error: "Неизвестный боец" };
  if (trailId && (!BRAWLER_TRAIL_BY_ID.has(trailId) || !isTrailOwned(profile, trailId))) {
    return { success: false, error: "Сначала купите след" };
  }
  const equippedMotionTrailByBrawler = { ...(profile.equippedMotionTrailByBrawler || {}) };
  if (trailId) equippedMotionTrailByBrawler[brawlerId] = trailId;
  else delete equippedMotionTrailByBrawler[brawlerId];
  updateProfile({
    brawlerTrailMode: { ...(profile.brawlerTrailMode || {}), [brawlerId]: "individual" },
    equippedMotionTrailByBrawler,
  });
  return { success: true };
}

export function renamePlayer(newName: string): { success: boolean; error?: string; errorCode?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  const trimmed = newName.trim();
  if (trimmed.length < 2 || trimmed.length > 16) {
    return { success: false, error: "Имя должно быть 2-16 символов" };
  }
  const nameMod = guardianModerateWithBuiltIn(trimmed, "player_name");
  if (!nameMod.allowed) return guardianBlockResult("player_name", nameMod);
  if (trimmed === profile.username) {
    return { success: false, error: "Это уже ваше имя" };
  }
  if (profile.gems < RENAME_GEM_COST) {
    return { success: false, error: `Нужно ${RENAME_GEM_COST} кристаллов` };
  }
  const profiles = getAllProfiles();
  if (profiles[trimmed]) return { success: false, error: "Имя занято" };
  // Move profile under new key
  delete profiles[profile.username];
  profiles[trimmed] = { ...profile, username: trimmed, gems: profile.gems - RENAME_GEM_COST };
  saveProfiles(profiles);
  setCurrentUsername(trimmed);
  return { success: true };
}

export function claimTrophyRoadReward(idx: number): { success: boolean; reward?: TrophyRoadReward; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (idx < 0 || idx >= TROPHY_ROAD.length) return { success: false, error: "Неверная награда" };
  const reward = TROPHY_ROAD[idx];
  if (profile.trophies < reward.trophies) return { success: false, error: "Недостаточно кубков" };
  if (profile.trophyRoadClaimed.includes(reward.trophies)) return { success: false, error: "Уже получено" };
  const updates: Partial<UserProfile> = {
    trophyRoadClaimed: [...profile.trophyRoadClaimed, reward.trophies],
  };
  if (reward.type === "coins") updates.coins = profile.coins + reward.amount;
  else if (reward.type === "gems") updates.gems = profile.gems + reward.amount;
  else if (reward.type === "powerPoints") updates.powerPoints = profile.powerPoints + reward.amount;
  else if (reward.type === "chest" && reward.chestRarity) {
    updates.chestInventory = {
      ...profile.chestInventory,
      [reward.chestRarity]: (profile.chestInventory[reward.chestRarity] || 0) + reward.amount,
    };
  } else if (reward.type === "pin" && reward.pinId) {
    const owned = profile.ownedPins || [];
    if (!owned.includes(reward.pinId)) {
      updates.ownedPins = [...owned, reward.pinId];
    }
  } else if (reward.type === "profileIcon" && reward.iconId) {
    applyProfileIconRewardToUpdates(profile, updates, reward.iconId);
  }
  updateProfile(updates);
  return { success: true, reward };
}

function applyPinRewardToUpdates(
  profile: UserProfile,
  updates: Partial<UserProfile>,
  pinId: string,
): void {
  const owned = (updates.ownedPins ?? profile.ownedPins ?? []) as string[];
  if (owned.includes(pinId)) {
    const def = getCollectiblePin(pinId);
    const coins = def ? PIN_DUPLICATE_COINS[def.rarity] : 100;
    updates.coins = (updates.coins ?? profile.coins) + coins;
    return;
  }
  updates.ownedPins = [...owned, pinId];
}

export function claimClashPassReward(level: number): { success: boolean; reward?: ClashPassReward; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (level < 1 || level > MAX_CLASHPASS_LEVEL) return { success: false, error: "Неверный уровень" };
  if (profile.clashPassLevel < level) return { success: false, error: "Уровень не достигнут" };
  if (profile.clashPassClaimed.includes(level)) return { success: false, error: "Уже получено" };
  const reward = clashPassRewardForLevel(level);
  const updates: Partial<UserProfile> = {
    clashPassClaimed: [...profile.clashPassClaimed, level],
  };
  if (reward.type === "coins") updates.coins = profile.coins + reward.amount;
  else if (reward.type === "gems") updates.gems = profile.gems + reward.amount;
  else if (reward.type === "powerPoints") updates.powerPoints = profile.powerPoints + reward.amount;
  else if (reward.type === "chest" && reward.chestRarity) {
    updates.chestInventory = {
      ...profile.chestInventory,
      [reward.chestRarity]: (profile.chestInventory[reward.chestRarity] || 0) + reward.amount,
    };
  } else if (reward.type === "pin" && reward.pinId) {
    applyPinRewardToUpdates(profile, updates, reward.pinId);
  } else if (reward.type === "profileIcon" && reward.iconId) {
    applyProfileIconRewardToUpdates(profile, updates, reward.iconId);
  }
  updateProfile(updates);
  return { success: true, reward };
}

export function buyXp(xpAmount: number, gemCost: number): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (profile.gems < gemCost) return { success: false, error: "Недостаточно кристаллов" };
  const { newXp, newLevel } = applyClashPassXpToProfile(profile, xpAmount);
  updateProfile({ gems: profile.gems - gemCost, xp: newXp, clashPassLevel: newLevel });
  return { success: true };
}

/** Начислить опыт Star Pass (новая карта, бонусы). */
export function grantClashPassXp(amount: number): boolean {
  const profile = getCurrentProfile();
  if (!profile || amount <= 0) return false;
  const { newXp, newLevel } = applyClashPassXpToProfile(profile, amount);
  updateProfile({ xp: newXp, clashPassLevel: newLevel });
  return true;
}

// =========================================================================
// CHESTS — buy, grant, open, with rolled rewards
// =========================================================================

export function buyChest(rarity: ChestRarity, currency: "coins" | "gems" = "gems"): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (currency === "coins") {
    return { success: false, error: "Сундуки покупаются только за кристаллы" };
  }
  const priceGems = getEffectiveChestPrices(rarity).priceGems;
  if (profile.gems < priceGems) return { success: false, error: "Недостаточно кристаллов" };
  updateProfile({
    gems: profile.gems - priceGems,
    chestInventory: { ...profile.chestInventory, [rarity]: (profile.chestInventory[rarity] || 0) + 1 },
  });
  return { success: true };
}

export function grantChest(rarity: ChestRarity, count = 1): void {
  const profile = getCurrentProfile();
  if (!profile) return;
  updateProfile({
    chestInventory: {
      ...profile.chestInventory,
      [rarity]: (profile.chestInventory[rarity] || 0) + count,
    },
  });
}

export function openChest(rarity: ChestRarity): { success: boolean; rolls?: ChestRoll[]; xpGained?: number; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if ((profile.chestInventory[rarity] || 0) < 1) return { success: false, error: "Нет такого сундука" };

  const rolls = rollChestRewards(rarity, getEffectiveChestDrops(rarity));

  // Brawler bonus: tier roll (getChestBrawlerTierChances), then pick
  // unlock or duplicate within that tier (≤ chest tier; common caps at rare).
  let brawlerDrop: { brawlerId: string; isDuplicate: boolean } | null = null;
  if (!isChestRollTypeDisabled(rarity, "brawler") && canBrawlerDropFromChest(profile, rarity)) {
    const tier = rollEffectiveChestBrawlerTier(rarity);
    if (tier) {
      brawlerDrop = pickBrawlerDropForChest(profile, rarity, tier);
      if (!brawlerDrop) {
        brawlerDrop = pickBrawlerDropForChest(profile, rarity);
      }
    }
    if (brawlerDrop) {
      const replaceIdx = Math.floor(Math.random() * rolls.length);
      rolls[replaceIdx] = {
        type: "brawler",
        amount: 1,
        brawlerId: brawlerDrop.brawlerId,
        brawlerDuplicate: brawlerDrop.isDuplicate,
      };
    }
  }

  // ── Independent pet roll ──────────────────────────────────────────────────
  // Pets drop on a separate per-chest probability table so a single chest may
  // yield both a brawler and a pet, mirroring the spec's "parallel" loot.
  const petDropChance = getEffectivePetDropChance(rarity);
  let petUnlockId: string | null = null;
  if (!isChestRollTypeDisabled(rarity, "pet") && Math.random() < petDropChance) {
    petUnlockId = pickLockedPetForChest(profile, rarity);
    if (petUnlockId) {
      // Replace a different roll (avoid clobbering the brawler if any).
      const candidates = rolls
        .map((r, i) => ({ r, i }))
        .filter(x => x.r.type !== "brawler");
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        rolls[pick.i] = { type: "pet", amount: 1, petId: petUnlockId };
      } else {
        // All rolls already taken by brawler — append the pet as a bonus roll.
        rolls.push({ type: "pet", amount: 1, petId: petUnlockId });
      }
    }
  }

  const iconDropChance = getEffectiveProfileIconDropChance(rarity);
  let profileIconUnlockId: string | null = null;
  if (!isChestRollTypeDisabled(rarity, "profileIcon") && Math.random() < iconDropChance) {
    profileIconUnlockId = pickRandomLockedStoredIcon(profile);
    if (profileIconUnlockId) {
      const candidates = rolls
        .map((r, i) => ({ r, i }))
        .filter(x => x.r.type !== "brawler" && x.r.type !== "pet");
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        rolls[pick.i] = { type: "profileIcon", amount: 1, profileIconId: profileIconUnlockId };
      } else {
        rolls.push({ type: "profileIcon", amount: 1, profileIconId: profileIconUnlockId });
      }
    }
  }

  const pinDropChance = getEffectivePinDropChance(rarity);
  let pinUnlockId: string | null = null;
  if (!isChestRollTypeDisabled(rarity, "pin") && Math.random() < pinDropChance) {
    pinUnlockId = pickLockedCollectiblePinForChest(profile, rarity);
    if (pinUnlockId) {
      const candidates = rolls
        .map((r, i) => ({ r, i }))
        .filter(x => x.r.type !== "brawler" && x.r.type !== "pet");
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        rolls[pick.i] = { type: "pin", amount: 1, pinId: pinUnlockId };
      } else {
        rolls.push({ type: "pin", amount: 1, pinId: pinUnlockId });
      }
    }
  }

  for (const extra of getEffectiveExtraDrops(rarity)) {
    if (Math.random() >= extra.chance) continue;
    if (isChestRollTypeDisabled(rarity, extra.type)) continue;
    const amount = extra.amountMin != null && extra.amountMax != null
      ? Math.floor(extra.amountMin + Math.random() * (extra.amountMax - extra.amountMin + 1))
      : (extra.amountMin ?? 1);
    if (extra.type === "brawler" || extra.type === "pet" || extra.type === "pin" || extra.type === "profileIcon") {
      rolls.push({ type: extra.type, amount: 1 });
    } else {
      rolls.push({ type: extra.type, amount });
    }
  }

  let coinsGain = 0, gemsGain = 0, ppGain = 0;
  let unlockedBrawlers = profile.unlockedBrawlers;
  let newBrawlers = [...(profile.newBrawlers || [])];
  let unlockedPets = profile.unlockedPets || [];
  let newPets = [...(profile.newPets || [])];
  let ownedPins = [...(profile.ownedPins || [])];
  let unlockedProfileIcons = [...(profile.unlockedProfileIcons || [])];
  let pendingBrawlerStarPicks = [...(profile.pendingBrawlerStarPicks || [])];
  if (profileIconUnlockId) {
    unlockedProfileIcons = grantProfileIcon(profile, profileIconUnlockId);
  }
  for (const r of rolls) {
    if (r.type === "coins") coinsGain += r.amount;
    else if (r.type === "gems") gemsGain += r.amount;
    else if (r.type === "powerPoints") ppGain += r.amount;
    else if (r.type === "brawler" && r.brawlerId) {
      if (r.brawlerDuplicate) {
        if (!pendingBrawlerStarPicks.includes(r.brawlerId)) {
          pendingBrawlerStarPicks.push(r.brawlerId);
        }
      } else if (!unlockedBrawlers.includes(r.brawlerId)) {
        unlockedBrawlers = [...unlockedBrawlers, r.brawlerId];
        if (!newBrawlers.includes(r.brawlerId)) newBrawlers.push(r.brawlerId);
      }
    } else if (r.type === "pet" && r.petId && !unlockedPets.includes(r.petId)) {
      unlockedPets = [...unlockedPets, r.petId];
      if (!newPets.includes(r.petId)) newPets.push(r.petId);
    } else if (r.type === "pin" && r.pinId) {
      if (!ownedPins.includes(r.pinId)) {
        ownedPins = [...ownedPins, r.pinId];
      } else {
        const def = getCollectiblePin(r.pinId);
        coinsGain += def ? PIN_DUPLICATE_COINS[def.rarity] : 100;
      }
    }
  }

  const xpGain = CHESTS[rarity].drops.xp;
  const passApply = applyClashPassXpToProfile(profile, xpGain);

  updateProfile({
    coins: profile.coins + coinsGain,
    gems: profile.gems + gemsGain,
    powerPoints: profile.powerPoints + ppGain,
    xp: passApply.newXp,
    clashPassLevel: passApply.newLevel,
    chestInventory: {
      ...profile.chestInventory,
      [rarity]: profile.chestInventory[rarity] - 1,
    },
    unlockedBrawlers,
    newBrawlers,
    unlockedPets,
    newPets,
    ownedPins,
    unlockedProfileIcons,
    pendingBrawlerStarPicks,
  });
  trackQuestProgress("open_chests", 1);
  trackStarFeatProgress("open_chests", 1);
  return { success: true, rolls, xpGained: xpGain };
}

// =========================================================================
// DAILY LADDER (rotating 30-day rewards)
// =========================================================================

function dailyLadderClaimedDayKey(profile: UserProfile): number {
  if (profile.dailyLadderClaimedDayKey) return profile.dailyLadderClaimedDayKey;
  if (profile.dailyLadderLastClaim > 1e11) return getGameDayKeyInt(profile.dailyLadderLastClaim);
  return 0;
}

export function canClaimDailyLadder(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return dailyLadderClaimedDayKey(profile) !== getGameDayKeyInt();
}

export function dailyLadderTimeLeft(_profile: UserProfile | null): number {
  return getMsUntilGameDayReset();
}

export function claimDailyLadderReward(): { success: boolean; reward?: ReturnType<typeof getRewardForDay>; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Not logged in" };
  if (!canClaimDailyLadder(profile)) return { success: false, error: "Награда уже получена" };
  const reward = getRewardForDay(profile.dailyLadderDay);
  applyReward(profile, reward.type, reward.amount, reward.chestRarity);
  // Read profile again because applyReward mutated coins/etc
  const updated = getCurrentProfile();
  if (!updated) return { success: false, error: "Profile gone" };
  updateProfile({
    dailyLadderLastClaim: Date.now(),
    dailyLadderClaimedDayKey: getGameDayKeyInt(),
    dailyLadderDay: (updated.dailyLadderDay % DAILY_LADDER.length) + 1,
  });
  return { success: true, reward };
}

function applyReward(
  profile: UserProfile,
  type: "coins" | "gems" | "powerPoints" | "chest" | "xp" | "pin" | "profileIcon",
  amount: number,
  chestRarity?: ChestRarity,
  pinId?: string,
  iconId?: string,
): void {
  if (type === "coins") {
    updateProfile({ coins: profile.coins + amount });
  } else if (type === "gems") {
    updateProfile({ gems: profile.gems + amount });
  } else if (type === "powerPoints") {
    updateProfile({ powerPoints: profile.powerPoints + amount });
  } else if (type === "chest" && chestRarity) {
    updateProfile({
      chestInventory: {
        ...profile.chestInventory,
        [chestRarity]: (profile.chestInventory[chestRarity] || 0) + amount,
      },
    });
  } else if (type === "xp") {
    const { newXp, newLevel } = applyClashPassXpToProfile(profile, amount);
    updateProfile({ xp: newXp, clashPassLevel: newLevel });
  } else if (type === "pin" && pinId) {
    grantPin(pinId);
  } else if (type === "profileIcon") {
    const id = iconId || profileIconIdForSlot(`reward_${Date.now()}`);
    const stored = grantProfileIcon(profile, id);
    updateProfile({ unlockedProfileIcons: stored });
  }
}

// =========================================================================
// DAILY QUESTS
// =========================================================================

// ── Quest pool helpers ────────────────────────────────────────────────────────
function ensureQuestPool(profile: UserProfile): QuestPool {
  let pool = profile.questPool;
  if (!pool) {
    pool = buildFreshQuestPoolForUnlocked(profile.unlockedBrawlers);
    updateProfile({ questPool: pool });
    return pool;
  }
  let changed = false;
  const unlocked = new Set(profile.unlockedBrawlers || []);

  // Remove stale brawler-specific quests for locked/unowned brawlers.
  // This fixes legacy pools that were created before unlocked filtering.
  const filteredQuests = pool.activeQuests.filter(q => {
    const bid = q.meta?.brawlerId;
    return !bid || unlocked.has(bid);
  });
  if (filteredQuests.length !== pool.activeQuests.length) {
    pool = { ...pool, activeQuests: filteredQuests };
    changed = true;
  }

  // Backfill missing roll timestamps for legacy pools so expiry math works.
  if (typeof pool.lastDailyRoll !== "number" || Number.isNaN(pool.lastDailyRoll)) {
    pool = { ...pool, lastDailyRoll: 0 };
    changed = true;
  }
  if (typeof pool.lastWeeklyRoll !== "number" || Number.isNaN(pool.lastWeeklyRoll)) {
    pool = { ...pool, lastWeeklyRoll: 0 };
    changed = true;
  }

  // Top up missing pools (e.g. legacy profiles created before weekly quests existed).
  const hasAnyDaily  = pool.activeQuests.some(q => !q.isWeekly && !q.isPaid);
  const hasAnyWeekly = pool.activeQuests.some(q =>  q.isWeekly);
  const hasAnyPaid   = pool.activeQuests.some(q =>  q.isPaid);
  if (!hasAnyDaily)  { pool = addDailyQuestsForUnlocked(pool, profile.unlockedBrawlers);  changed = true; }
  if (!hasAnyWeekly) { pool = addWeeklyQuestsForUnlocked(pool, profile.unlockedBrawlers); changed = true; }
  if (!hasAnyPaid)   { pool = addPaidQuestsForUnlocked(pool, profile.unlockedBrawlers);   changed = true; }

  if (typeof pool.lastPaidRoll !== "number" || Number.isNaN(pool.lastPaidRoll)) {
    pool = { ...pool, lastPaidRoll: pool.lastWeeklyRoll || Date.now() };
    changed = true;
  }

  // Keep a healthy amount of quests after filtering stale entries.
  const dailyActive = pool.activeQuests.filter(q => !q.isWeekly && !q.isPaid && !q.claimed).length;
  const weeklyActive = pool.activeQuests.filter(q => q.isWeekly && !q.claimed).length;
  const paidActive = pool.activeQuests.filter(q => q.isPaid && !q.claimed).length;
  if (dailyActive < DAILY_QUEST_COUNT) {
    pool = addDailyQuestsForUnlocked(pool, profile.unlockedBrawlers);
    changed = true;
  }
  if (weeklyActive < WEEKLY_QUEST_COUNT) {
    pool = addWeeklyQuestsForUnlocked(pool, profile.unlockedBrawlers);
    changed = true;
  }
  if (paidActive < PAID_QUEST_COUNT) {
    pool = addPaidQuestsForUnlocked(pool, profile.unlockedBrawlers);
    changed = true;
  }

  if (isDailyExpired(pool))  { pool = addDailyQuestsForUnlocked(pool, profile.unlockedBrawlers);  changed = true; }
  if (isWeeklyExpired(pool)) { pool = addWeeklyQuestsForUnlocked(pool, profile.unlockedBrawlers); changed = true; }
  if (isPaidExpired(pool))   { pool = addPaidQuestsForUnlocked(pool, profile.unlockedBrawlers);   changed = true; }
  if (changed) updateProfile({ questPool: pool });
  return pool;
}

// Kept for backward-compat (QuestsModal may still call this)
export function getOrRollDailyQuests(): DailyQuestsState {
  const profile = getCurrentProfile();
  if (!profile) return generateDailyQuests();
  const pool = ensureQuestPool(profile);
  // Return a legacy-shaped object of the first 5 non-weekly quests
  const quests = pool.activeQuests.filter(q => !q.isWeekly && !q.isPaid).slice(0, 5);
  return { generatedAt: pool.lastDailyRoll, quests };
}

export function getQuestPool(): QuestPool | null {
  const profile = getCurrentProfile();
  if (!profile) return null;
  return ensureQuestPool(profile);
}

export function trackQuestProgress(kind: QuestKind, amount: number, meta?: QuestMeta): void {
  const profile = getCurrentProfile();
  if (!profile || amount <= 0) return;
  const pool = ensureQuestPool(profile);
  let changed = false;
  const updatedQuests = pool.activeQuests.map(q => {
    if (q.kind !== kind || q.claimed) return q;
    // Meta matching — if quest has brawlerId, caller must provide matching id
    if (q.meta?.brawlerId && q.meta.brawlerId !== meta?.brawlerId) return q;
    // mode meta check
    if (q.meta?.mode && q.meta.mode !== meta?.mode) return q;
    const newProgress = Math.min(q.target, q.progress + amount);
    if (newProgress !== q.progress) { changed = true; return { ...q, progress: newProgress }; }
    return q;
  });
  if (changed) {
    updateProfile({ questPool: { ...pool, activeQuests: updatedQuests } });
  }
}

export function claimQuestReward(questId: string): { success: boolean; error?: string; rewardLabel?: string; iconId?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Нет квестов" };
  const pool = ensureQuestPool(profile);
  const q = pool.activeQuests.find(x => x.id === questId);
  if (!q) return { success: false, error: "Квест не найден" };
  if (q.claimed) return { success: false, error: "Уже получено" };
  if (q.progress < q.target) return { success: false, error: "Цель не достигнута" };
  if (q.isPaid && !profile.clashPassPaid) {
    return { success: false, error: "Нужен платный Star Pass" };
  }

  let rewardLabel = q.reward.label;
  if (q.reward.type === "pin") {
    const pinId = q.reward.pinId ?? pickRandomUnownedCollectiblePin("rare");
    if (pinId) {
      grantPin(pinId);
      const def = getCollectiblePin(pinId);
      if (def) rewardLabel = PIN_PUBLIC_LABEL;
    } else {
      applyReward(profile, "gems", 20);
      rewardLabel = "20 кристаллов (все пины собраны)";
    }
  } else if (q.reward.type === "profileIcon") {
    const iconId = q.reward.iconId ?? profileIconIdForSlot(`quest_${questId}`);
    applyReward(profile, "profileIcon", 1, undefined, undefined, iconId);
    rewardLabel = profileIconRewardLabel(iconId);
    const updated = getCurrentProfile();
    if (!updated) return { success: false };
    const updPool = updated.questPool ?? pool;
    updateProfile({
      questPool: {
        ...updPool,
        activeQuests: updPool.activeQuests.filter(x => x.id !== questId),
      },
    });
    return { success: true, rewardLabel, iconId };
  } else {
    applyReward(profile, q.reward.type, q.reward.amount, q.reward.chestRarity, q.reward.pinId, q.reward.iconId);
  }

  const updated = getCurrentProfile();
  if (!updated) return { success: false };
  const updPool = updated.questPool ?? pool;
  updateProfile({
    questPool: {
      ...updPool,
      activeQuests: updPool.activeQuests.filter(x => x.id !== questId),
    },
  });
  return { success: true, rewardLabel };
}

function questStateToRewardInfo(
  q: QuestState,
  rewardLabel?: string,
  iconId?: string,
): RewardInfo {
  return {
    type: q.reward.type as RewardInfo["type"],
    amount: q.reward.amount,
    chestRarity: q.reward.chestRarity,
    pinId: q.reward.pinId,
    iconId: iconId ?? q.reward.iconId,
    label: rewardLabel ?? q.reward.label,
  };
}

/** Auto-collect all completed quests (regular + paid when pass owned). Returns drop queue for menu FX. */
export function collectAutoClaimableQuests(): RewardInfo[] {
  const profile = getCurrentProfile();
  if (!profile) return [];
  const pool = ensureQuestPool(profile);
  const hasPaidPass = !!profile.clashPassPaid;
  const eligible = pool.activeQuests.filter(
    q => !q.claimed && q.progress >= q.target && (!q.isPaid || hasPaidPass),
  );
  const rewards: RewardInfo[] = [];
  for (const q of eligible) {
    const preview = questStateToRewardInfo(q);
    const r = claimQuestReward(q.id);
    if (r.success) {
      rewards.push({
        ...preview,
        label: r.rewardLabel ?? preview.label,
        iconId: r.iconId ?? preview.iconId,
      });
    }
  }
  return rewards;
}
