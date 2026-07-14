import type { RewardInfo } from "../components/RewardDropModal";

const KEY = "pending_menu_daily_wins_fx";

export function queueMenuDailyWinsFx(reward: RewardInfo): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(reward));
}

export function consumeMenuDailyWinsFx(): RewardInfo | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RewardInfo;
  } catch {
    return null;
  }
}
