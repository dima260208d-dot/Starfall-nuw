import type { ChestRarity } from "../utils/chests";
import { buildStarFeatCatalog } from "./starFeatsCatalog";

export type StarFeatTier = 1 | 2 | 3 | 4 | 5 | 6;

export type StarFeatKind =
  | "play_games" | "win_games" | "open_chests" | "deal_damage" | "kill_enemies" | "kill_monsters"
  | "heal_hp" | "use_super" | "collect_powercubes" | "earn_trophies"
  | "place_showdown_top4" | "place_top3" | "place_top1_showdown"
  | "win_team" | "win_showdown" | "play_showdown" | "play_team"
  | "play_mode" | "win_mode"
  | "play_brawler" | "win_brawler" | "kill_brawler"
  | "brawlers_unlocked" | "clash_pass_level" | "join_club" | "upgrade_brawler";

export type { StarFeatReward } from "../utils/starFeatRewards";
import type { StarFeatReward } from "../utils/starFeatRewards";

export interface StarFeatMeta {
  mode?: string;
  brawlerId?: string;
}

export interface StarFeatDef {
  id: string;
  tier: StarFeatTier;
  kind: StarFeatKind;
  target: number;
  borderColor: string;
  titleKey: string;
  descKey: string;
  meta?: StarFeatMeta;
  reward: StarFeatReward;
}

export const FEATS_PER_STAR_TIER = 15;

export const STAR_FEAT_TIER_COLORS: Record<StarFeatTier, string> = {
  1: "#90A4AE",
  2: "#66BB6A",
  3: "#42A5F5",
  4: "#AB47BC",
  5: "#FFA726",
  6: "#FFD700",
};

/** Max reward per tier (individual feats scale within these caps). */
export const STAR_FEAT_TIER_REWARD_CAPS: Record<
  StarFeatTier,
  { coins: number; gems: number; powerPoints: number; maxChest: ChestRarity }
> = {
  1: { coins: 200, gems: 3, powerPoints: 10, maxChest: "common" },
  2: { coins: 500, gems: 8, powerPoints: 30, maxChest: "rare" },
  3: { coins: 750, gems: 15, powerPoints: 40, maxChest: "epic" },
  4: { coins: 1000, gems: 30, powerPoints: 50, maxChest: "mega" },
  5: { coins: 1200, gems: 45, powerPoints: 75, maxChest: "mythic" },
  6: { coins: 1500, gems: 60, powerPoints: 100, maxChest: "legendary" },
};

export const STAR_FEAT_DEFS: StarFeatDef[] = buildStarFeatCatalog();

export function starFeatTabImg(tier: StarFeatTier): string {
  return `ui/feat-tab-${tier}.png`;
}

export function starFeatBadgeImg(tier: StarFeatTier): string {
  return `ui/feat-badge-${tier}.png`;
}

export function featsForTier(tier: StarFeatTier): StarFeatDef[] {
  return STAR_FEAT_DEFS.filter(f => f.tier === tier);
}

export function tierFeatIds(tier: StarFeatTier): string[] {
  return featsForTier(tier).map(f => f.id);
}

export function getStarFeatDef(id: string): StarFeatDef | undefined {
  return STAR_FEAT_DEFS.find(f => f.id === id);
}
