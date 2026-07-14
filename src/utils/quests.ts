// =========================================================================
// QUEST SYSTEM — 5 daily quests + 10 weekly quests, accumulate up to 50
// =========================================================================
import type { ChestRarity } from "./chests";
import { getGameDayKeyInt, getMsUntilGameDayReset } from "./gameDay";

// ── Kinds ────────────────────────────────────────────────────────────────────
export type QuestKind =
  // Generic match quests
  | "play_games"
  | "win_games"
  | "play_showdown"
  | "play_team"
  | "earn_trophies"
  | "open_chests"
  | "upgrade_brawler"
  | "deal_damage"
  | "kill_enemies"
  | "place_top3"
  | "place_top1_showdown"
  // Mode-specific wins
  | "win_mode_gemgrab"
  | "win_mode_heist"
  | "win_mode_bounty"
  | "win_mode_starstrike"
  | "win_mode_showdown"
  // Brawler-specific
  | "win_brawler"
  | "play_brawler"
  | "kill_brawler"
  | "damage_brawler"
  // Stat-based
  | "heal_hp"
  | "collect_powercubes"
  | "use_super"
  | "survive_showdown";   // place top-5 in showdown N times

export type QuestRewardType = "coins" | "gems" | "powerPoints" | "xp" | "chest" | "pin" | "profileIcon";

export interface QuestReward {
  type: QuestRewardType;
  amount: number;
  chestRarity?: ChestRarity;
  pinId?: string;
  iconId?: string;
  label: string;
}

// Meta attached to a quest to narrow its scope (brawler/mode specific)
export interface QuestMeta {
  brawlerId?: string;
  brawlerName?: string;   // human-readable name for the UI
  mode?: string;
  modeName?: string;
}

export interface QuestDef {
  id: string;
  kind: QuestKind;
  target: number;
  description: string;
  reward: QuestReward;
  difficulty: 1 | 2 | 3;
  meta?: QuestMeta;
}

export interface QuestState {
  id: string;
  kind: QuestKind;
  target: number;
  progress: number;
  description: string;
  reward: QuestReward;
  claimed: boolean;
  meta?: QuestMeta;
  addedAt: number;       // unix ms — when this quest was added to the pool
  isWeekly?: boolean;    // true = weekly quest
  /** Star Pass premium track — progress counts, reward needs clashPassPaid. */
  isPaid?: boolean;
}

// ── Legacy shape (still stored in profile for backward compat) ────────────────
export interface DailyQuestsState {
  generatedAt: number;
  quests: QuestState[];
}

// ── New accumulated quest pool shape ──────────────────────────────────────────
export interface QuestPool {
  activeQuests: QuestState[];   // all active + claimed quests (max 50)
  lastDailyRoll: number;        // unix ms of last daily roll
  lastWeeklyRoll: number;       // unix ms of last weekly roll
  /** unix ms of last paid-quest roll (10 quests every 2 days). */
  lastPaidRoll?: number;
}

// ── Pool of all possible quests ───────────────────────────────────────────────
const BRAWLERS_META: { id: string; name: string }[] = [
  { id: "miya",    name: "Мия"     },
  { id: "ronin",   name: "Ронин"   },
  { id: "yuki",    name: "Юки"     },
  { id: "sora",    name: "Сора"    },
  { id: "rin",     name: "Рин"     },
  { id: "hana",    name: "Хана"    },
  { id: "goro",    name: "Горо"    },
  { id: "kenji",   name: "Кендзи"  },
  { id: "taro",    name: "Таро"    },
  { id: "zafkiel", name: "Зафкиэль"},
];

const MODES_META: { id: string; name: string }[] = [
  { id: "gemgrab",   name: "Ограбление кристаллов" },
  { id: "heist",     name: "Ограбление"            },
  { id: "bounty",    name: "Охота за звёздами"     },
  { id: "starstrike",name: "Звёздный мяч"          },
  { id: "showdown",  name: "Столкновение"          },
];

// Static pool (no brawler/mode meta substitution needed here for static quests)
const STATIC_POOL: Omit<QuestDef, "id">[] = [
  // ── EASY (difficulty 1) ──────────────────────────────────────────────────
  { kind: "play_games",    target: 1,  description: "Сыграйте 1 матч",
    reward: { type: "coins", amount: 80,  label: "80 монет"  }, difficulty: 1 },
  { kind: "play_games",    target: 2,  description: "Сыграйте 2 матча",
    reward: { type: "coins", amount: 120, label: "120 монет" }, difficulty: 1 },
  { kind: "play_games",    target: 3,  description: "Сыграйте 3 матча",
    reward: { type: "xp",   amount: 80,  label: "80 очков Star Pass"  }, difficulty: 1 },
  { kind: "play_showdown", target: 1,  description: "Сыграйте 1 матч «Столкновение»",
    reward: { type: "coins", amount: 100, label: "100 монет" }, difficulty: 1 },
  { kind: "play_showdown", target: 2,  description: "Сыграйте 2 матча «Столкновение»",
    reward: { type: "powerPoints", amount: 5, label: "5 очков прокачки" }, difficulty: 1 },
  { kind: "play_team",     target: 1,  description: "Сыграйте 1 командный матч",
    reward: { type: "coins", amount: 90,  label: "90 монет"  }, difficulty: 1 },
  { kind: "play_team",     target: 2,  description: "Сыграйте 2 командных матча",
    reward: { type: "xp",   amount: 60,  label: "60 очков Star Pass"  }, difficulty: 1 },
  { kind: "kill_enemies",  target: 3,  description: "Убейте 3 врага",
    reward: { type: "coins", amount: 100, label: "100 монет" }, difficulty: 1 },
  { kind: "kill_enemies",  target: 5,  description: "Убейте 5 врагов",
    reward: { type: "xp",   amount: 70,  label: "70 очков Star Pass"  }, difficulty: 1 },
  { kind: "use_super",     target: 3,  description: "Используйте ульту 3 раза",
    reward: { type: "coins", amount: 110, label: "110 монет" }, difficulty: 1 },
  { kind: "use_super",     target: 5,  description: "Используйте ульту 5 раз",
    reward: { type: "xp",   amount: 80,  label: "80 очков Star Pass"  }, difficulty: 1 },
  { kind: "deal_damage",   target: 2000,  description: "Нанесите 2000 урона",
    reward: { type: "coins", amount: 100, label: "100 монет" }, difficulty: 1 },
  { kind: "deal_damage",   target: 4000,  description: "Нанесите 4000 урона",
    reward: { type: "powerPoints", amount: 6, label: "6 очков прокачки" }, difficulty: 1 },
  { kind: "survive_showdown", target: 2, description: "Войдите в топ-5 «Столкновения» 2 раза",
    reward: { type: "coins", amount: 130, label: "130 монет" }, difficulty: 1 },

  // ── MEDIUM (difficulty 2) ────────────────────────────────────────────────
  { kind: "win_games",     target: 2,  description: "Победите в 2 матчах",
    reward: { type: "chest", amount: 1, chestRarity: "rare", label: "Редкий сундук" }, difficulty: 2 },
  { kind: "win_games",     target: 3,  description: "Победите в 3 матчах",
    reward: { type: "xp", amount: 200, label: "200 очков Star Pass"     }, difficulty: 2 },
  { kind: "win_games",     target: 4,  description: "Победите в 4 матчах",
    reward: { type: "gems", amount: 10, label: "10 кристаллов" }, difficulty: 2 },
  { kind: "earn_trophies", target: 30, description: "Заработайте 30 трофеев",
    reward: { type: "gems", amount: 12, label: "12 кристаллов" }, difficulty: 2 },
  { kind: "earn_trophies", target: 50, description: "Заработайте 50 трофеев",
    reward: { type: "chest", amount: 1, chestRarity: "rare", label: "Редкий сундук" }, difficulty: 2 },
  { kind: "open_chests",   target: 1,  description: "Откройте 1 сундук",
    reward: { type: "profileIcon", amount: 1, label: "Иконка игрока" }, difficulty: 2 },
  { kind: "win_games",     target: 5,  description: "Одержите 5 побед",
    reward: { type: "profileIcon", amount: 1, label: "Иконка игрока" }, difficulty: 3 },
  { kind: "upgrade_brawler", target: 1, description: "Прокачайте любого бойца",
    reward: { type: "powerPoints", amount: 10, label: "10 очков прокачки" }, difficulty: 2 },
  { kind: "play_team",     target: 4,  description: "Сыграйте 4 командных матча",
    reward: { type: "xp", amount: 150, label: "150 очков Star Pass"    }, difficulty: 2 },
  { kind: "play_showdown", target: 4,  description: "Сыграйте 4 матча «Столкновение»",
    reward: { type: "coins", amount: 200, label: "200 монет"  }, difficulty: 2 },
  { kind: "kill_enemies",  target: 10, description: "Убейте 10 врагов",
    reward: { type: "xp", amount: 160, label: "160 очков Star Pass"    }, difficulty: 2 },
  { kind: "kill_enemies",  target: 15, description: "Убейте 15 врагов",
    reward: { type: "chest", amount: 1, chestRarity: "rare", label: "Редкий сундук" }, difficulty: 2 },
  { kind: "heal_hp",       target: 2000, description: "Восстановите 2000 HP",
    reward: { type: "coins", amount: 220, label: "220 монет"  }, difficulty: 2 },
  { kind: "heal_hp",       target: 4000, description: "Восстановите 4000 HP",
    reward: { type: "gems", amount: 8, label: "8 кристаллов"  }, difficulty: 2 },
  { kind: "collect_powercubes", target: 10, description: "Соберите 10 кубов силы в «Столкновении»",
    reward: { type: "xp", amount: 140, label: "140 очков Star Pass"     }, difficulty: 2 },
  { kind: "collect_powercubes", target: 20, description: "Соберите 20 кубов силы в «Столкновении»",
    reward: { type: "gems", amount: 10, label: "10 кристаллов" }, difficulty: 2 },
  { kind: "use_super",     target: 10, description: "Используйте ульту 10 раз",
    reward: { type: "xp", amount: 180, label: "180 очков Star Pass"     }, difficulty: 2 },
  { kind: "place_top3",    target: 2,  description: "Войдите в топ-3 «Столкновения» 2 раза",
    reward: { type: "chest", amount: 1, chestRarity: "rare", label: "Редкий сундук" }, difficulty: 2 },
  { kind: "deal_damage",   target: 10000, description: "Нанесите 10 000 урона",
    reward: { type: "gems", amount: 10, label: "10 кристаллов" }, difficulty: 2 },
  { kind: "win_mode_gemgrab", target: 2, description: "Победите 2 раза в «Ограблении кристаллов»",
    reward: { type: "xp", amount: 220, label: "220 очков Star Pass" },
    difficulty: 2, meta: { mode: "gemgrab", modeName: "Ограбление кристаллов" } },
  { kind: "win_mode_heist", target: 2, description: "Победите 2 раза в «Ограблении»",
    reward: { type: "gems", amount: 12, label: "12 кристаллов" },
    difficulty: 2, meta: { mode: "heist", modeName: "Ограбление" } },
  { kind: "win_mode_bounty", target: 2, description: "Победите 2 раза в «Охоте за звёздами»",
    reward: { type: "xp", amount: 180, label: "180 очков Star Pass" },
    difficulty: 2, meta: { mode: "bounty", modeName: "Охота за звёздами" } },
  { kind: "win_mode_starstrike", target: 2, description: "Победите 2 раза в «Звёздном мяче»",
    reward: { type: "gems", amount: 12, label: "12 кристаллов" },
    difficulty: 2, meta: { mode: "starstrike", modeName: "Звёздный мяч" } },
  { kind: "win_mode_showdown", target: 2, description: "Войдите в топ-3 «Столкновения» 2 раза",
    reward: { type: "chest", amount: 1, chestRarity: "rare", label: "Редкий сундук" },
    difficulty: 2, meta: { mode: "showdown", modeName: "Столкновение" } },

  // ── HARD (difficulty 3) ──────────────────────────────────────────────────
  { kind: "place_top3",    target: 3,  description: "Войдите в топ-3 «Столкновения» 3 раза",
    reward: { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" }, difficulty: 3 },
  { kind: "place_top1_showdown", target: 1, description: "Победите в «Столкновении» (1-е место)",
    reward: { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" }, difficulty: 3 },
  { kind: "place_top1_showdown", target: 2, description: "Займите 1-е место в «Столкновении» 2 раза",
    reward: { type: "chest", amount: 1, chestRarity: "mega", label: "Мега-сундук" }, difficulty: 3 },
  { kind: "win_games",     target: 5,  description: "Победите в 5 матчах",
    reward: { type: "chest", amount: 1, chestRarity: "mega", label: "Мега-сундук" }, difficulty: 3 },
  { kind: "win_games",     target: 7,  description: "Победите в 7 матчах",
    reward: { type: "pin", amount: 1, label: "Пин" }, difficulty: 3 },
  { kind: "place_top1_showdown", target: 3, description: "Займите 1-е место в «Столкновении» 3 раза",
    reward: { type: "pin", amount: 1, label: "Пин" }, difficulty: 3 },
  { kind: "earn_trophies", target: 80, description: "Заработайте 80 трофеев",
    reward: { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" }, difficulty: 3 },
  { kind: "earn_trophies", target: 120, description: "Заработайте 120 трофеев",
    reward: { type: "gems", amount: 30, label: "30 кристаллов" }, difficulty: 3 },
  { kind: "play_games",    target: 10, description: "Сыграйте 10 матчей",
    reward: { type: "gems", amount: 25, label: "25 кристаллов" }, difficulty: 3 },
  { kind: "kill_enemies",  target: 25, description: "Убейте 25 врагов",
    reward: { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" }, difficulty: 3 },
  { kind: "deal_damage",   target: 25000, description: "Нанесите 25 000 урона",
    reward: { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" }, difficulty: 3 },
  { kind: "deal_damage",   target: 50000, description: "Нанесите 50 000 урона",
    reward: { type: "gems", amount: 35, label: "35 кристаллов" }, difficulty: 3 },
  { kind: "heal_hp",       target: 10000, description: "Восстановите 10 000 HP",
    reward: { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" }, difficulty: 3 },
  { kind: "collect_powercubes", target: 50, description: "Соберите 50 кубов силы",
    reward: { type: "gems", amount: 20, label: "20 кристаллов" }, difficulty: 3 },
  { kind: "use_super",     target: 20, description: "Используйте ульту 20 раз",
    reward: { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" }, difficulty: 3 },
  { kind: "open_chests",   target: 3,  description: "Откройте 3 сундука",
    reward: { type: "gems", amount: 25, label: "25 кристаллов" }, difficulty: 3 },
  { kind: "win_mode_gemgrab", target: 4, description: "Победите 4 раза в «Ограблении кристаллов»",
    reward: { type: "gems", amount: 25, label: "25 кристаллов" },
    difficulty: 3, meta: { mode: "gemgrab", modeName: "Ограбление кристаллов" } },
  { kind: "win_mode_heist", target: 4, description: "Победите 4 раза в «Ограблении»",
    reward: { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" },
    difficulty: 3, meta: { mode: "heist", modeName: "Ограбление" } },
  { kind: "win_mode_starstrike", target: 4, description: "Победите 4 раза в «Звёздном мяче»",
    reward: { type: "chest", amount: 1, chestRarity: "epic", label: "Эпический сундук" },
    difficulty: 3, meta: { mode: "starstrike", modeName: "Звёздный мяч" } },
];

// Brawler-specific quests, generated for each brawler
function makeBrawlerQuests(): Omit<QuestDef, "id">[] {
  const out: Omit<QuestDef, "id">[] = [];
  for (const b of BRAWLERS_META) {
    out.push(
      // play 3 matches with this brawler (easy)
      { kind: "play_brawler", target: 3,
        description: `Сыграйте 3 матча за ${b.name}`,
        reward: { type: "coins", amount: 130, label: "130 монет" },
        difficulty: 1, meta: { brawlerId: b.id, brawlerName: b.name } },
      // play 5 matches (medium)
      { kind: "play_brawler", target: 5,
        description: `Сыграйте 5 матчей за ${b.name}`,
        reward: { type: "xp", amount: 150, label: "150 очков Star Pass" },
        difficulty: 2, meta: { brawlerId: b.id, brawlerName: b.name } },
      // win 2 matches (medium)
      { kind: "win_brawler", target: 2,
        description: `Победите в 2 матчах за ${b.name}`,
        reward: { type: "chest", amount: 1, chestRarity: "rare", label: "Редкий сундук" },
        difficulty: 2, meta: { brawlerId: b.id, brawlerName: b.name } },
      // win 4 matches (hard)
      { kind: "win_brawler", target: 4,
        description: `Победите в 4 матчах за ${b.name}`,
        reward: { type: "gems", amount: 20, label: "20 кристаллов" },
        difficulty: 3, meta: { brawlerId: b.id, brawlerName: b.name } },
      // kill 8 enemies (medium)
      { kind: "kill_brawler", target: 8,
        description: `Убейте 8 врагов играя за ${b.name}`,
        reward: { type: "xp", amount: 170, label: "170 очков Star Pass" },
        difficulty: 2, meta: { brawlerId: b.id, brawlerName: b.name } },
      // deal 8000 damage (medium)
      { kind: "damage_brawler", target: 8000,
        description: `Нанесите 8000 урона за ${b.name}`,
        reward: { type: "coins", amount: 240, label: "240 монет" },
        difficulty: 2, meta: { brawlerId: b.id, brawlerName: b.name } },
    );
  }
  return out;
}

const FULL_POOL: Omit<QuestDef, "id">[] = [
  ...STATIC_POOL,
  ...makeBrawlerQuests(),
];

function fullPoolForUnlocked(unlockedBrawlers?: string[]): Omit<QuestDef, "id">[] {
  if (!unlockedBrawlers || unlockedBrawlers.length === 0) return FULL_POOL;
  const allowed = new Set(unlockedBrawlers);
  return FULL_POOL.filter(q => !q.meta?.brawlerId || allowed.has(q.meta.brawlerId));
}

/** ~70% of rolled quests should grant Star Pass XP; XP amounts are ×3 at roll time. */
const QUEST_XP_POOL_SHARE = 0.7;
const QUEST_XP_AMOUNT_MULTIPLIER = 3;

function scaleQuestReward(reward: QuestReward): QuestReward {
  if (reward.type !== "xp") return reward;
  const amount = reward.amount * QUEST_XP_AMOUNT_MULTIPLIER;
  return { ...reward, amount, label: `${amount} очков Star Pass` };
}

function prepareQuestDef(q: Omit<QuestDef, "id">): Omit<QuestDef, "id"> {
  return { ...q, reward: scaleQuestReward(q.reward) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeState(
  q: Omit<QuestDef, "id">,
  idx: number,
  opts: { isWeekly?: boolean; isPaid?: boolean },
): QuestState {
  return {
    id: `q${idx}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    kind: q.kind,
    target: q.target,
    progress: 0,
    description: q.description,
    reward: q.reward,
    claimed: false,
    meta: q.meta,
    addedAt: Date.now(),
    isWeekly: !!opts.isWeekly,
    isPaid: !!opts.isPaid,
  };
}

// Pick N quests from the pool (avoid kinds already active), ~70% Star Pass XP rewards.
function pickQuests(
  count: number,
  activeKinds: Set<string>,  // "kind:brawlerId" or "kind"
  isWeekly: boolean,
  unlockedBrawlers?: string[],
  isPaid = false,
): QuestState[] {
  const key = (q: Omit<QuestDef, "id">) =>
    `${q.kind}:${q.meta?.brawlerId ?? ""}:${q.meta?.mode ?? ""}`;

  const pool = fullPoolForUnlocked(unlockedBrawlers)
    .map(prepareQuestDef)
    .filter(q => !activeKinds.has(key(q)));

  const xpPool = shuffle(pool.filter(q => q.reward.type === "xp"));
  const otherPool = shuffle(pool.filter(q => q.reward.type !== "xp"));

  const xpWant = Math.min(xpPool.length, Math.max(0, Math.round(count * QUEST_XP_POOL_SHARE)));
  const otherWant = count - xpWant;

  const takeFrom = (
    source: Omit<QuestDef, "id">[],
    n: number,
    used: Omit<QuestDef, "id">[],
  ): Omit<QuestDef, "id">[] => {
    const out: Omit<QuestDef, "id">[] = [];
    for (const q of source) {
      if (out.length >= n) break;
      if (used.some(u => key(u) === key(q))) continue;
      if (out.some(p => key(p) === key(q))) continue;
      out.push(q);
    }
    return out;
  };

  const used: Omit<QuestDef, "id">[] = [];
  const xpPicked = takeFrom(xpPool, xpWant, used);
  used.push(...xpPicked);

  let otherPicked = takeFrom(otherPool, otherWant, used);
  used.push(...otherPicked);

  const short = count - xpPicked.length - otherPicked.length;
  if (short > 0) {
    const fallback = takeFrom(
      shuffle([...xpPool, ...otherPool]),
      short,
      used,
    );
    otherPicked = [...otherPicked, ...fallback];
  }

  const merged = shuffle([...xpPicked, ...otherPicked]).slice(0, count);
  return merged.map((q, i) => makeState(q, i, { isWeekly, isPaid }));
}

// ── Public API ────────────────────────────────────────────────────────────────
export const DAILY_QUEST_COUNT  = 5;
export const WEEKLY_QUEST_COUNT = 10;
export const PAID_QUEST_COUNT   = 10;
export const MAX_ACTIVE_QUESTS  = 50;

export const ONE_DAY  = 24 * 60 * 60 * 1000;
export const TWO_DAYS = 2 * ONE_DAY;
export const ONE_WEEK =  7 * ONE_DAY;

export function buildFreshQuestPool(): QuestPool {
  return buildFreshQuestPoolForUnlocked();
}

export function buildFreshQuestPoolForUnlocked(unlockedBrawlers?: string[]): QuestPool {
  const now = Date.now();
  const daily  = pickQuests(DAILY_QUEST_COUNT,  new Set(), false, unlockedBrawlers);
  const weeklyKeys = new Set(daily.map(q => `${q.kind}:${q.meta?.brawlerId ?? ""}:${q.meta?.mode ?? ""}`));
  const weekly = pickQuests(WEEKLY_QUEST_COUNT, weeklyKeys, true, unlockedBrawlers);
  const paidKeys = new Set([
    ...weeklyKeys,
    ...weekly.map(q => `${q.kind}:${q.meta?.brawlerId ?? ""}:${q.meta?.mode ?? ""}`),
  ]);
  const paid = pickQuests(PAID_QUEST_COUNT, paidKeys, false, unlockedBrawlers, true);
  return {
    activeQuests: [...daily, ...weekly, ...paid],
    lastDailyRoll: now,
    lastWeeklyRoll: now,
    lastPaidRoll: now,
  };
}

export function addDailyQuests(pool: QuestPool): QuestPool {
  return addDailyQuestsForUnlocked(pool);
}

export function addDailyQuestsForUnlocked(pool: QuestPool, unlockedBrawlers?: string[]): QuestPool {
  const now = Date.now();
  const freeSlots = Math.max(0, MAX_ACTIVE_QUESTS - pool.activeQuests.length);
  const toAdd = Math.min(DAILY_QUEST_COUNT, freeSlots);
  if (toAdd <= 0) return { ...pool, lastDailyRoll: now };
  const activeKeys = new Set(
    pool.activeQuests
      .filter(q => !q.claimed)
      .map(q => `${q.kind}:${q.meta?.brawlerId ?? ""}:${q.meta?.mode ?? ""}`),
  );
  const fresh = pickQuests(toAdd, activeKeys, false, unlockedBrawlers);
  const all = [...pool.activeQuests, ...fresh];
  return { ...pool, activeQuests: all, lastDailyRoll: now };
}

export function addWeeklyQuests(pool: QuestPool): QuestPool {
  return addWeeklyQuestsForUnlocked(pool);
}

export function addWeeklyQuestsForUnlocked(pool: QuestPool, unlockedBrawlers?: string[]): QuestPool {
  const now = Date.now();
  const freeSlots = Math.max(0, MAX_ACTIVE_QUESTS - pool.activeQuests.length);
  const toAdd = Math.min(WEEKLY_QUEST_COUNT, freeSlots);
  if (toAdd <= 0) return { ...pool, lastWeeklyRoll: now };
  const activeKeys = new Set(
    pool.activeQuests
      .filter(q => !q.claimed)
      .map(q => `${q.kind}:${q.meta?.brawlerId ?? ""}:${q.meta?.mode ?? ""}`),
  );
  const fresh = pickQuests(toAdd, activeKeys, true, unlockedBrawlers);
  const all = [...pool.activeQuests, ...fresh];
  return { ...pool, activeQuests: all, lastWeeklyRoll: now };
}

export function addPaidQuests(pool: QuestPool): QuestPool {
  return addPaidQuestsForUnlocked(pool);
}

export function addPaidQuestsForUnlocked(pool: QuestPool, unlockedBrawlers?: string[]): QuestPool {
  const now = Date.now();
  const freeSlots = Math.max(0, MAX_ACTIVE_QUESTS - pool.activeQuests.length);
  const toAdd = Math.min(PAID_QUEST_COUNT, freeSlots);
  if (toAdd <= 0) return { ...pool, lastPaidRoll: now };
  const activeKeys = new Set(
    pool.activeQuests
      .filter(q => !q.claimed)
      .map(q => `${q.kind}:${q.meta?.brawlerId ?? ""}:${q.meta?.mode ?? ""}`),
  );
  const fresh = pickQuests(toAdd, activeKeys, false, unlockedBrawlers, true);
  const all = [...pool.activeQuests, ...fresh];
  return { ...pool, activeQuests: all, lastPaidRoll: now };
}

export function isDailyExpired(pool: QuestPool): boolean {
  if (!pool.lastDailyRoll) return true;
  return getGameDayKeyInt(pool.lastDailyRoll) !== getGameDayKeyInt();
}

export function isWeeklyExpired(pool: QuestPool): boolean {
  return Date.now() - pool.lastWeeklyRoll >= ONE_WEEK;
}

export function timeUntilDaily(_pool: QuestPool): number {
  return getMsUntilGameDayReset();
}

export function timeUntilWeekly(pool: QuestPool): number {
  return Math.max(0, ONE_WEEK - (Date.now() - pool.lastWeeklyRoll));
}

export function isPaidExpired(pool: QuestPool): boolean {
  const roll = pool.lastPaidRoll;
  if (typeof roll !== "number" || Number.isNaN(roll)) return true;
  return Date.now() - roll >= TWO_DAYS;
}

export function timeUntilPaid(pool: QuestPool): number {
  const roll = pool.lastPaidRoll ?? 0;
  return Math.max(0, TWO_DAYS - (Date.now() - roll));
}

// ── Kept for backward compat ──────────────────────────────────────────────────
export function generateDailyQuests(): DailyQuestsState {
  return { generatedAt: Date.now(), quests: pickQuests(DAILY_QUEST_COUNT, new Set(), false) };
}

export function isQuestsExpired(state: DailyQuestsState | undefined | null): boolean {
  if (!state) return true;
  return Date.now() - state.generatedAt >= ONE_DAY;
}

export function timeUntilQuestRefresh(state: DailyQuestsState | undefined | null): number {
  if (!state) return 0;
  const elapsed = Date.now() - (state?.generatedAt ?? 0);
  return Math.max(0, ONE_DAY - elapsed);
}

export function formatHmsShort(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}
