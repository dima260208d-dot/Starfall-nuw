import type { ChestRarity } from "./chests";
import { CHEST_RARITY_ORDER } from "./chests";
import {
  clashPassRewardForLevel,
  paidClashPassRewardForLevel,
  ultraClashPassRewardForLevel,
  MAX_CLASHPASS_LEVEL,
  type ClashPassReward,
} from "./localStorageAPI";
import {
  PRO_STAR_PASS_FREE_REWARDS,
  PRO_STAR_PASS_PAID_REWARDS,
  PRO_STAR_PASS_MAX_LEVEL,
} from "./proStarPassRewards";

export interface PassTrackTotals {
  coins: number;
  gems: number;
  powerPoints: number;
  chests: Partial<Record<ChestRarity, number>>;
  pins: number;
  profileIcons: number;
  samplePinId?: string;
  sampleIconId?: string;
}

export function emptyPassTrackTotals(): PassTrackTotals {
  return { coins: 0, gems: 0, powerPoints: 0, chests: {}, pins: 0, profileIcons: 0 };
}

export function accumulatePassReward(totals: PassTrackTotals, reward: ClashPassReward): void {
  const amt = reward.amount || 1;
  switch (reward.type) {
    case "coins":
      totals.coins += amt;
      break;
    case "gems":
      totals.gems += amt;
      break;
    case "powerPoints":
      totals.powerPoints += amt;
      break;
    case "chest":
      if (reward.chestRarity) {
        totals.chests[reward.chestRarity] = (totals.chests[reward.chestRarity] ?? 0) + amt;
      }
      break;
    case "pin":
      totals.pins += amt;
      if (reward.pinId && !totals.samplePinId) totals.samplePinId = reward.pinId;
      break;
    case "profileIcon":
      totals.profileIcons += amt;
      if (reward.iconId && !totals.sampleIconId) totals.sampleIconId = reward.iconId;
      break;
    default:
      break;
  }
}

export function aggregatePassRewards(rewards: ClashPassReward[]): PassTrackTotals {
  const totals = emptyPassTrackTotals();
  for (const r of rewards) accumulatePassReward(totals, r);
  return totals;
}

export function chestEntries(totals: PassTrackTotals): { rarity: ChestRarity; count: number }[] {
  return CHEST_RARITY_ORDER
    .map((rarity) => ({ rarity, count: totals.chests[rarity] ?? 0 }))
    .filter((e) => e.count > 0);
}

export function totalChestCount(totals: PassTrackTotals): number {
  return chestEntries(totals).reduce((s, e) => s + e.count, 0);
}

export interface PassTrackSummaryRow {
  trackKey: string;
  totals: PassTrackTotals;
}

export function clashPassTrackSummaries(): PassTrackSummaryRow[] {
  const free: ClashPassReward[] = [];
  const paid: ClashPassReward[] = [];
  const ultra: ClashPassReward[] = [];
  for (let lvl = 1; lvl <= MAX_CLASHPASS_LEVEL; lvl++) {
    free.push(clashPassRewardForLevel(lvl));
    paid.push(paidClashPassRewardForLevel(lvl));
    ultra.push(ultraClashPassRewardForLevel(lvl));
  }
  return [
    { trackKey: "pass.details.trackFree", totals: aggregatePassRewards(free) },
    { trackKey: "pass.details.trackPremium", totals: aggregatePassRewards(paid) },
    { trackKey: "pass.details.trackUltra", totals: aggregatePassRewards(ultra) },
  ];
}

export function proStarPassTrackSummaries(): PassTrackSummaryRow[] {
  const free = PRO_STAR_PASS_FREE_REWARDS.slice(0, PRO_STAR_PASS_MAX_LEVEL);
  const paid = PRO_STAR_PASS_PAID_REWARDS.slice(0, PRO_STAR_PASS_MAX_LEVEL);
  return [
    { trackKey: "proPass.details.trackFree", totals: aggregatePassRewards(free) },
    { trackKey: "proPass.details.trackPaid", totals: aggregatePassRewards(paid) },
  ];
}
