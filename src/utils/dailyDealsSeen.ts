import { getGameDayKey } from "./gameDay";
import { getTodayDealsSnapshotEpoch, getTodaysDeals, regenerateTodayDeals } from "./dailyDeals";

const REVEALED_KEY = "clash_revealed_deal_instances_v2";
const DEALS_PREVIEW_BUMP_KEY = "clash_deals_preview_bump_v3";

export const NEW_DEALS_PASS_XP = 10;

interface RevealedState {
  date: string;
  generatedAt: number;
  ids: string[];
}

function readRevealed(): RevealedState {
  try {
    const raw = localStorage.getItem(REVEALED_KEY);
    if (!raw) return { date: "", generatedAt: 0, ids: [] };
    const parsed = JSON.parse(raw) as RevealedState;
    if (!parsed || typeof parsed.date !== "string" || !Array.isArray(parsed.ids)) {
      return { date: "", generatedAt: 0, ids: [] };
    }
    return {
      date: parsed.date,
      generatedAt: typeof parsed.generatedAt === "number" ? parsed.generatedAt : 0,
      ids: parsed.ids,
    };
  } catch {
    return { date: "", generatedAt: 0, ids: [] };
  }
}

function writeRevealed(state: RevealedState): void {
  localStorage.setItem(REVEALED_KEY, JSON.stringify(state));
}

function revealedForToday(): RevealedState {
  const today = getGameDayKey();
  const epoch = getTodayDealsSnapshotEpoch() ?? 0;
  const cur = readRevealed();
  if (cur.date !== today || cur.generatedAt !== epoch) {
    return { date: today, generatedAt: epoch, ids: [] };
  }
  return cur;
}

export function isDealUnseen(instanceId: string): boolean {
  const revealed = revealedForToday();
  return !revealed.ids.includes(instanceId);
}

export function hasUnseenDeals(): boolean {
  const deals = getTodaysDeals();
  return deals.some(d => isDealUnseen(d.instanceId));
}

/** Открыть одну акцию и вернуть true, если награда XP выдана. */
export function revealDeal(instanceId: string): boolean {
  const today = getGameDayKey();
  const epoch = getTodayDealsSnapshotEpoch() ?? 0;
  const cur = revealedForToday();
  if (cur.ids.includes(instanceId)) return false;
  writeRevealed({ date: today, generatedAt: epoch, ids: [...cur.ids, instanceId] });
  return true;
}

/** Однократно после обновления: новые акции + сброс «НОВОЕ» для проверки. */
export function bumpDealsPreviewIfNeeded(): void {
  if (localStorage.getItem(DEALS_PREVIEW_BUMP_KEY) === "1") return;
  regenerateTodayDeals();
  localStorage.removeItem(REVEALED_KEY);
  localStorage.setItem(DEALS_PREVIEW_BUMP_KEY, "1");
}
