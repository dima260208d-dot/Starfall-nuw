import type { ChestRarity } from "./chests";
import { CHEST_RARITY_ORDER } from "./chests";
import { getGameDayKeyInt } from "./gameDay";
import { translate } from "../i18n";

export const DAILY_WINS_SLOT_COUNT = 10;

export type DailyWinsDayType = "normal" | "lucky" | "megaLucky";

export type DailyWinsRewardType = "coins" | "gems" | "powerPoints" | "chest";

export interface DailyWinsSlot {
  type: DailyWinsRewardType;
  amount: number;
  chestRarity?: ChestRarity;
}

export interface DailyWinsState {
  dayKey: number;
  dayType: DailyWinsDayType;
  slots: DailyWinsSlot[];
  /** How many left-to-right slots were claimed today (0..10). */
  claimedCount: number;
}

export function dailyWinsDayKey(ts = Date.now()): number {
  return getGameDayKeyInt(ts);
}

export function coerceDailyWinsDayKey(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

function slotsJsonKey(slots: DailyWinsSlot[]): string {
  return JSON.stringify(slots.map(s => ({
    t: s.type,
    a: s.amount,
    r: s.chestRarity ?? "",
  })));
}

/** True when persisted blob already matches the normalized state (no re-roll needed). */
export function dailyWinsStatesEqual(raw: unknown, state: DailyWinsState): boolean {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Partial<DailyWinsState>;
  if (coerceDailyWinsDayKey(o.dayKey) !== state.dayKey) return false;
  if (o.dayType !== state.dayType) return false;
  const claimed = Math.max(0, Math.min(DAILY_WINS_SLOT_COUNT, Math.floor(Number(o.claimedCount) || 0)));
  if (claimed !== state.claimedCount) return false;
  if (!Array.isArray(o.slots) || o.slots.length !== DAILY_WINS_SLOT_COUNT) return false;
  return slotsJsonKey(
    o.slots.map(s => sanitizeSlot(s, state.dayType)).filter((s): s is DailyWinsSlot => s !== null),
  ) === slotsJsonKey(state.slots);
}

export function rollDailyWinsDayType(): DailyWinsDayType {
  const r = Math.random();
  if (r < 0.10) return "megaLucky";
  if (r < 0.40) return "lucky";
  return "normal";
}

const DAILY_WINS_DAY_KEYS: Record<DailyWinsDayType, string> = {
  normal: "dailyWins.dayNormal",
  lucky: "dailyWins.dayLucky",
  megaLucky: "dailyWins.dayMegaLucky",
};

export function getDailyWinsDayLabel(dayType: DailyWinsDayType): string {
  return translate(DAILY_WINS_DAY_KEYS[dayType]);
}

const LUCKY_CHEST_RARITIES: ChestRarity[] = ["common", "rare", "epic", "mega", "mythic", "legendary"];
const LUCKY_CHEST_WEIGHTS = [0.32, 0.26, 0.2, 0.12, 0.07, 0.03];

function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pickWeightedChest(rarities: ChestRarity[], weights: number[]): ChestRarity {
  let total = 0;
  for (const w of weights) total += w;
  let roll = Math.random() * total;
  for (let i = 0; i < rarities.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return rarities[i];
  }
  return rarities[rarities.length - 1];
}

function rollNormalSlot(): DailyWinsSlot {
  const kind = randInt(0, 2);
  if (kind === 0) return { type: "coins", amount: randInt(50, 500) };
  if (kind === 1) return { type: "powerPoints", amount: randInt(5, 50) };
  return { type: "gems", amount: randInt(1, 10) };
}

function rollLuckySlot(): DailyWinsSlot {
  return {
    type: "chest",
    amount: 1,
    chestRarity: pickWeightedChest(LUCKY_CHEST_RARITIES, LUCKY_CHEST_WEIGHTS),
  };
}

function rollMegaLuckySlot(): DailyWinsSlot {
  if (Math.random() < 0.45) {
    const rarity = pickWeightedChest(LUCKY_CHEST_RARITIES, LUCKY_CHEST_WEIGHTS);
    return { type: "chest", amount: 2, chestRarity: rarity };
  }
  const kind = randInt(0, 2);
  const double = (n: number, cap: number) => Math.min(cap, n * 2);
  if (kind === 0) {
    return { type: "coins", amount: double(randInt(25, 50), 100) };
  }
  if (kind === 1) {
    return { type: "powerPoints", amount: double(randInt(40, 100), 200) };
  }
  return { type: "gems", amount: double(randInt(8, 15), 30) };
}

export function generateDailyWinsSlots(dayType: DailyWinsDayType): DailyWinsSlot[] {
  const slots: DailyWinsSlot[] = [];
  for (let i = 0; i < DAILY_WINS_SLOT_COUNT; i++) {
    if (dayType === "normal") slots.push(rollNormalSlot());
    else if (dayType === "lucky") slots.push(rollLuckySlot());
    else slots.push(rollMegaLuckySlot());
  }
  return slots;
}

/** Once per calendar day: roll day type, then generate all 10 slots for that type only. */
export function createFreshDailyWinsState(ts = Date.now()): DailyWinsState {
  const dayType = rollDailyWinsDayType();
  return {
    dayKey: dailyWinsDayKey(ts),
    dayType,
    slots: generateDailyWinsSlots(dayType),
    claimedCount: 0,
  };
}

function sanitizeSlot(raw: unknown, dayType: DailyWinsDayType): DailyWinsSlot | null {
  if (!raw || typeof raw !== "object") return null;
  const slot = raw as DailyWinsSlot;
  if (slot.type === "chest" && slot.chestRarity && CHEST_RARITY_ORDER.includes(slot.chestRarity)) {
    const maxAmt = dayType === "megaLucky" ? 2 : 1;
    return {
      type: "chest",
      amount: Math.max(1, Math.min(maxAmt, Math.floor(slot.amount || 1))),
      chestRarity: slot.chestRarity,
    };
  }
  if (dayType === "lucky") return null;
  if (slot.type === "gems") {
    const cap = dayType === "megaLucky" ? 30 : 10;
    return { type: "gems", amount: Math.max(1, Math.min(cap, Math.floor(slot.amount || 1))) };
  }
  if (slot.type === "powerPoints") {
    const cap = dayType === "megaLucky" ? 200 : 50;
    return { type: "powerPoints", amount: Math.max(1, Math.min(cap, Math.floor(slot.amount || 1))) };
  }
  if (slot.type === "coins") {
    const cap = dayType === "megaLucky" ? 100 : 500;
    return { type: "coins", amount: Math.max(1, Math.min(cap, Math.floor(slot.amount || 1))) };
  }
  return null;
}

function slotsValidForDayType(slots: DailyWinsSlot[], dayType: DailyWinsDayType): boolean {
  if (slots.length !== DAILY_WINS_SLOT_COUNT) return false;
  if (dayType === "lucky") {
    return slots.every(s => s.type === "chest" && !!s.chestRarity);
  }
  if (dayType === "normal") {
    return slots.every(s => s.type === "coins" || s.type === "gems" || s.type === "powerPoints");
  }
  return true;
}

/**
 * Same calendar day → keep fixed dayType + claimedCount.
 * New day → new roll (type + slots). Rewards always match the locked day type.
 */
export function normalizeDailyWinsState(raw: unknown, ts = Date.now()): DailyWinsState {
  const today = dailyWinsDayKey(ts);
  if (!raw || typeof raw !== "object") return createFreshDailyWinsState(ts);
  const o = raw as Partial<DailyWinsState>;

  const storedDayKey = coerceDailyWinsDayKey(o.dayKey);
  if (storedDayKey === null || storedDayKey !== today) {
    return createFreshDailyWinsState(ts);
  }

  const dayType: DailyWinsDayType =
    o.dayType === "lucky" || o.dayType === "megaLucky" || o.dayType === "normal"
      ? o.dayType
      : "normal";
  const claimedCount = Math.max(0, Math.min(DAILY_WINS_SLOT_COUNT, Math.floor(o.claimedCount ?? 0)));

  const parsed = Array.isArray(o.slots)
    ? o.slots.map(s => sanitizeSlot(s, dayType)).filter((s): s is DailyWinsSlot => s !== null)
    : [];

  const slots = parsed.length === DAILY_WINS_SLOT_COUNT && slotsValidForDayType(parsed, dayType)
    ? parsed
    : generateDailyWinsSlots(dayType);

  return { dayKey: today, dayType, slots, claimedCount };
}

export function dailyWinsRemaining(state: DailyWinsState): number {
  return Math.max(0, DAILY_WINS_SLOT_COUNT - state.claimedCount);
}

export function dailyWinsHasClaimable(state: DailyWinsState): boolean {
  return state.claimedCount < DAILY_WINS_SLOT_COUNT;
}
