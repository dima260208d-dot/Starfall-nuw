import { getGameDayKey } from "./gameDay";
import { hasUnseenDeals } from "./dailyDealsSeen";
import { isMainDailyAvailable, isStarGuardianActive } from "./subscription";

export const DAILY_GIFT_FREE_KEY = "shop_daily_gift_free_v1";
export const DAILY_GIFT_SG_KEY = "shop_daily_gift_sg_v1";

export function getTodayStamp(): string {
  return getGameDayKey();
}

export function isDealsDailyGiftAvailable(): boolean {
  return localStorage.getItem(DAILY_GIFT_FREE_KEY) !== getTodayStamp();
}

/** Подарок подписчика в магазине — тот же цикл, что и главный подарок Star Guardian (12:00 МСК). */
export function isDealsDailyGiftStarGuardianAvailable(): boolean {
  if (!isStarGuardianActive()) return false;
  return isMainDailyAvailable();
}

export function isAnyDealsGiftAvailable(): boolean {
  return isDealsDailyGiftAvailable() || isDealsDailyGiftStarGuardianAvailable();
}

export function isShopDealsNew(): boolean {
  return hasUnseenDeals();
}

export function isShopDealsAttention(): boolean {
  return isAnyDealsGiftAvailable() || isShopDealsNew();
}

