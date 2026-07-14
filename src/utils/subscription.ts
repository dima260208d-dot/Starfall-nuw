// ─── Star Guardian (monthly subscription) ──────────────────────────────────
// 299₽/month "premium" stub: real money is mocked with a confirm dialog.
// While active the player gets:
//   • Daily main reward (popup in main menu + manual claim with drop animation; once per game day at 12:00 MSK)
//   • Daily secondary reward — pick 1 of 3 (rolled fresh each day)
//   • A "Power-Up Token" every 3 days (instant-level item for any brawler)
//   • The Astral assistant unlocks autoplay, in-battle tips and chat commands
//   • 15 shimmering premium name colors (profile color picker)
//
// Persistence lives on UserProfile.starGuardian and UserProfile.astralSettings
// so the standard saveProfiles flow auto-persists everything.

import { MAX_BRAWLER_LEVEL } from "../entities/BrawlerData";
import { getCurrentProfile, updateProfile, addCoins, addGems, recordPurchase, type UserProfile } from "./localStorageAPI";
import { gameDaysBetween, getGameDayKeyInt, getMsUntilGameDayReset } from "./gameDay";
import { normalizePlayerIdQuery } from "./playerId";

const SG_MAIN_CLAIM_STORAGE_PREFIX = "sg_main_daily_claim_v3";

export const STAR_GUARDIAN_PRICE_RUB = 299;
export const STAR_GUARDIAN_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// One-shot item that bumps any unlocked brawler by exactly 1 level for free.
// Stored as a count on the subscription state; consumed via consumePowerUpToken.
export const SPECIAL_REWARD_INTERVAL_DAYS = 3;

export type SecondaryRewardType = "coins" | "gems" | "powerPoints";
export interface SecondaryRewardOption {
  type: SecondaryRewardType;
  amount: number;
}

export interface StarGuardianState {
  activeUntil: number;            // unix ms (0 = never bought, past = expired)
  /** @deprecated используйте lastMainClaimDay — unix ms больше не участвует в логике. */
  lastMainClaimAt?: number;
  /** Ключ игрового дня (YYYYMMDD, граница 12:00 МСК) последнего получения главного подарка. */
  lastMainClaimDay: number;
  lastSecondaryClaimDay: number;
  lastSpecialClaimDay: number;
  // Day-key when the secondary options were last rolled (kept stable for the day).
  secondaryRolledDay: number;
  secondaryOptions: SecondaryRewardOption[];
  // Unconsumed "Power-Up Tokens" — give +1 level to any brawler (no resource cost).
  powerUpTokens: number;
  // Lifetime stats (cosmetic — shown in subscription details panel).
  totalSubscriptionsBought: number;
}

export interface AstralSettings {
  enabled: boolean;
  battleTipsEnabled: boolean;
  menuTipsEnabled: boolean;
  voice: 0 | 1 | 2;
  /** Полностью отключить подсказки и команды Астрала в бою. */
  battleCommandsDisabled?: boolean;
}

export const DEFAULT_ASTRAL_SETTINGS: AstralSettings = {
  enabled: true,
  battleTipsEnabled: true,
  menuTipsEnabled: true,
  voice: 0,
  battleCommandsDisabled: false,
};

/** YYYYMMDD as int for stable per-game-day comparisons (12:00 MSK). */
export function dayKey(ts = Date.now()): number {
  return getGameDayKeyInt(ts);
}

function emptyState(): StarGuardianState {
  return {
    activeUntil: 0,
    lastMainClaimDay: 0,
    lastSecondaryClaimDay: 0,
    lastSpecialClaimDay: 0,
    secondaryRolledDay: 0,
    secondaryOptions: [],
    powerUpTokens: 0,
    totalSubscriptionsBought: 0,
  };
}

function dayKeyNum(v: unknown): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function mainClaimStorageKey(): string | null {
  const pid = getCurrentProfile()?.playerId;
  if (!pid) return null;
  return `${SG_MAIN_CLAIM_STORAGE_PREFIX}_${normalizePlayerIdQuery(pid)}`;
}

function readMainClaimDayFromStorage(): number {
  const key = mainClaimStorageKey();
  if (!key || typeof localStorage === "undefined") return 0;
  return dayKeyNum(localStorage.getItem(key));
}

function writeMainClaimDayToStorage(day: number): void {
  const key = mainClaimStorageKey();
  if (!key || typeof localStorage === "undefined") return;
  localStorage.setItem(key, String(day));
}

/** Нормализация + миграция со старого lastMainClaimAt (без накопления пропущенных дней). */
export function normalizeStarGuardianState(raw: unknown): StarGuardianState {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return emptyState();
    }
  }
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<StarGuardianState>;

  let lastMainClaimDay = dayKeyNum(s.lastMainClaimDay);
  if (!lastMainClaimDay && s.lastMainClaimAt) {
    lastMainClaimDay = dayKey(s.lastMainClaimAt);
  }

  return {
    ...base,
    ...s,
    activeUntil: typeof s.activeUntil === "number" ? s.activeUntil : 0,
    lastMainClaimDay,
    lastSecondaryClaimDay: dayKeyNum(s.lastSecondaryClaimDay),
    lastSpecialClaimDay: dayKeyNum(s.lastSpecialClaimDay),
    secondaryRolledDay: dayKeyNum(s.secondaryRolledDay),
    secondaryOptions: Array.isArray(s.secondaryOptions) ? s.secondaryOptions : [],
    powerUpTokens: typeof s.powerUpTokens === "number" ? s.powerUpTokens : 0,
    totalSubscriptionsBought: typeof s.totalSubscriptionsBought === "number" ? s.totalSubscriptionsBought : 0,
    lastMainClaimAt: undefined,
  };
}

/** Слияние локального и облачного состояния подписки (без отката уже полученных наград). */
export function mergeStarGuardianState(
  local: StarGuardianState,
  cloud: StarGuardianState,
): StarGuardianState {
  const l = normalizeStarGuardianState(local);
  const c = normalizeStarGuardianState(cloud);
  const today = dayKey();
  const rolledDay = Math.max(l.secondaryRolledDay, c.secondaryRolledDay);
  const useLocalRoll = l.secondaryRolledDay === rolledDay && l.secondaryOptions.length === 3;
  const useCloudRoll = c.secondaryRolledDay === rolledDay && c.secondaryOptions.length === 3;

  return normalizeStarGuardianState({
    ...c,
    ...l,
    activeUntil: Math.max(l.activeUntil, c.activeUntil),
    lastMainClaimDay: Math.max(l.lastMainClaimDay, c.lastMainClaimDay, readMainClaimDayFromStorage()),
    lastSecondaryClaimDay: Math.max(l.lastSecondaryClaimDay, c.lastSecondaryClaimDay),
    lastSpecialClaimDay: Math.max(l.lastSpecialClaimDay, c.lastSpecialClaimDay),
    powerUpTokens: Math.max(l.powerUpTokens, c.powerUpTokens),
    totalSubscriptionsBought: Math.max(l.totalSubscriptionsBought, c.totalSubscriptionsBought),
    secondaryRolledDay: rolledDay || today,
    secondaryOptions: useLocalRoll ? l.secondaryOptions : useCloudRoll ? c.secondaryOptions : [],
  });
}

export function getStarGuardian(): StarGuardianState {
  const p = getCurrentProfile();
  const normalized = normalizeStarGuardianState(p?.starGuardian);
  const storedDay = readMainClaimDayFromStorage();
  if (storedDay > normalized.lastMainClaimDay) {
    return { ...normalized, lastMainClaimDay: storedDay };
  }
  return normalized;
}

export function isStarGuardianActive(): boolean {
  const s = getStarGuardian();
  return s.activeUntil > Date.now();
}

export function getStarGuardianDaysRemaining(): number {
  const s = getStarGuardian();
  if (!isStarGuardianActive()) return 0;
  return Math.max(0, Math.ceil((s.activeUntil - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function getAstralSettings(): AstralSettings {
  const p = getCurrentProfile();
  return { ...DEFAULT_ASTRAL_SETTINGS, ...((p?.astralSettings as Partial<AstralSettings> | undefined) ?? {}) };
}

export function updateAstralSettings(patch: Partial<AstralSettings>): void {
  const cur = getAstralSettings();
  updateProfile({ astralSettings: { ...cur, ...patch } } as any);
}

function patchSubscription(patch: Partial<StarGuardianState>): void {
  const cur = getStarGuardian();
  const next = normalizeStarGuardianState({ ...cur, ...patch });
  updateProfile({ starGuardian: next } as any);
}

// ── Purchase ───────────────────────────────────────────────────────────────

/** Mock purchase — extends the activeUntil timestamp by 30 days from
 *  whichever is later: now or the existing expiry date (so re-buying while
 *  still active stacks instead of overwriting). */
export function purchaseStarGuardian(): { success: true; daysRemaining: number } {
  const cur = getStarGuardian();
  const base = Math.max(Date.now(), cur.activeUntil);
  const next: StarGuardianState = {
    ...cur,
    activeUntil: base + STAR_GUARDIAN_DURATION_MS,
    totalSubscriptionsBought: cur.totalSubscriptionsBought + 1,
  };
  updateProfile({ starGuardian: next } as any);
  recordPurchase({
    category: "subscription",
    title: "Star Guardian",
    priceRub: STAR_GUARDIAN_PRICE_RUB,
    rewardSummary: "30 days",
  });
  return { success: true, daysRemaining: getStarGuardianDaysRemaining() };
}

// ── Daily main reward ──────────────────────────────────────────────────────

export const MAIN_DAILY_COINS = 500;
export const MAIN_DAILY_GEMS = 20;
export const MAIN_DAILY_POWER = 100;

export interface MainDailyClaimResult {
  claimed: boolean;
  coins: number;
  gems: number;
  powerPoints: number;
}

/** Главный подарок доступен один раз за текущий игровой день (12:00 МСК). Пропущенные дни не копятся. */
export function isMainDailyAvailable(): boolean {
  if (!isStarGuardianActive()) return false;
  const today = dayKey();
  if (readMainClaimDayFromStorage() === today) return false;
  const claimedDay = getStarGuardian().lastMainClaimDay;
  if (!claimedDay) return true;
  return claimedDay !== today;
}

/** До следующего главного подарка (до 12:00 МСК следующего игрового дня). */
export function getMsUntilMainDaily(): number {
  if (!isStarGuardianActive()) return 0;
  if (isMainDailyAvailable()) return 0;
  return getMsUntilGameDayReset();
}

/** Grants the main daily reward when the player taps «Получить».
 *  Returns the claim result so the UI can run the drop animation. */
export function claimMainDaily(): MainDailyClaimResult {
  const today = dayKey();
  if (!isMainDailyAvailable()) {
    return { claimed: false, coins: 0, gems: 0, powerPoints: 0 };
  }
  const profile = getCurrentProfile();
  if (!profile) return { claimed: false, coins: 0, gems: 0, powerPoints: 0 };

  // Сначала фиксируем день (до наград и до событий синхронизации).
  writeMainClaimDayToStorage(today);
  const nextSg = normalizeStarGuardianState({
    ...getStarGuardian(),
    lastMainClaimDay: today,
    lastMainClaimAt: undefined,
  });

  updateProfile({
    coins: profile.coins + MAIN_DAILY_COINS,
    gems: profile.gems + MAIN_DAILY_GEMS,
    powerPoints: profile.powerPoints + MAIN_DAILY_POWER,
    starGuardian: nextSg,
  } as Partial<UserProfile>);

  return { claimed: true, coins: MAIN_DAILY_COINS, gems: MAIN_DAILY_GEMS, powerPoints: MAIN_DAILY_POWER };
}

// ── Daily secondary reward (3-choice) ──────────────────────────────────────

const SECONDARY_POOL: SecondaryRewardOption[] = [
  { type: "coins",       amount: 500 },
  { type: "gems",        amount: 10 },
  { type: "powerPoints", amount: 50 },
];

/** Returns the 3 secondary options for today, rolling them once per day
 *  and persisting the roll so the choice menu is stable on refresh. */
export function getDailySecondaryOptions(): SecondaryRewardOption[] {
  const today = dayKey();
  const cur = getStarGuardian();
  if (cur.secondaryRolledDay === today && cur.secondaryOptions.length === 3) {
    return cur.secondaryOptions;
  }
  // Always offer all three pool entries (one of each kind), in a shuffled order.
  const shuffled = [...SECONDARY_POOL].sort(() => Math.random() - 0.5);
  patchSubscription({ secondaryRolledDay: today, secondaryOptions: shuffled });
  return shuffled;
}

export function isSecondaryDailyAvailable(): boolean {
  if (!isStarGuardianActive()) return false;
  const claimed = getStarGuardian().lastSecondaryClaimDay;
  if (!claimed) return true;
  return claimed !== dayKey();
}

export function claimSecondaryDaily(index: 0 | 1 | 2): { claimed: boolean; option?: SecondaryRewardOption } {
  if (!isSecondaryDailyAvailable()) return { claimed: false };
  const opts = getDailySecondaryOptions();
  const opt = opts[index];
  if (!opt) return { claimed: false };
  if (opt.type === "coins") addCoins(opt.amount);
  else if (opt.type === "gems") addGems(opt.amount);
  else {
    const p = getCurrentProfile();
    if (!p) return { claimed: false };
    updateProfile({ powerPoints: p.powerPoints + opt.amount });
  }
  patchSubscription({ lastSecondaryClaimDay: dayKey() });
  return { claimed: true, option: opt };
}

// ── Special "Power-Up Token" (every 3 days) ────────────────────────────────

export function isSpecialDailyAvailable(): boolean {
  if (!isStarGuardianActive()) return false;
  const s = getStarGuardian();
  const last = s.lastSpecialClaimDay;
  if (!last) return true;
  const elapsed = gameDaysBetween(last, dayKey());
  return elapsed >= SPECIAL_REWARD_INTERVAL_DAYS;
}

export function getMsUntilSpecialDaily(): number {
  if (!isStarGuardianActive()) return 0;
  const s = getStarGuardian();
  if (s.lastSpecialClaimDay === 0) return 0;
  const elapsed = gameDaysBetween(s.lastSpecialClaimDay, dayKey());
  if (elapsed >= SPECIAL_REWARD_INTERVAL_DAYS) return 0;
  const daysLeft = SPECIAL_REWARD_INTERVAL_DAYS - elapsed;
  return Math.max(0, (daysLeft - 1) * 24 * 60 * 60 * 1000 + getMsUntilGameDayReset());
}

export function claimSpecialDaily(): { claimed: boolean; tokens?: number } {
  if (!isSpecialDailyAvailable()) return { claimed: false };
  const cur = getStarGuardian();
  patchSubscription({
    lastSpecialClaimDay: dayKey(),
    powerUpTokens: cur.powerUpTokens + 1,
  });
  return { claimed: true, tokens: cur.powerUpTokens + 1 };
}

/** Spend one Power-Up Token to bump a brawler by +1 level.
 *  Returns false if no tokens, brawler not unlocked, or already max. */
const DEV_POWER_TOKEN_KEY = "sg_dev_power_token_v1";

/** Одноразово выдать тестовый токен прокачки (для проверки UI). */
export function ensureDevPowerUpToken(): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(DEV_POWER_TOKEN_KEY)) return;
  const sg = getStarGuardian();
  patchSubscription({ powerUpTokens: sg.powerUpTokens + 1 });
  localStorage.setItem(DEV_POWER_TOKEN_KEY, "1");
}

export function consumePowerUpToken(brawlerId: string): { success: boolean; newLevel?: number; error?: string } {
  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Нет профиля" };
  const sg = getStarGuardian();
  if (sg.powerUpTokens <= 0) return { success: false, error: "Нет токенов прокачки" };
  if (!profile.unlockedBrawlers.includes(brawlerId)) {
    return { success: false, error: "Этот боец ещё не открыт" };
  }
  const cur = profile.brawlerLevels[brawlerId] || 1;
  if (cur >= MAX_BRAWLER_LEVEL) return { success: false, error: "Боец уже на максимальном уровне" };
  updateProfile({
    brawlerLevels: { ...profile.brawlerLevels, [brawlerId]: cur + 1 },
  });
  patchSubscription({ powerUpTokens: sg.powerUpTokens - 1 });
  return { success: true, newLevel: cur + 1 };
}
