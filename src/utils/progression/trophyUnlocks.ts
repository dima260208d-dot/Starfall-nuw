import type { GameMode } from "../../App";
import { getCurrentProfile } from "../localStorageAPI";

/** Menu / feature ids gated by account trophies. */
export type TrophyFeatureId =
  | "clashpass"
  | "starstrike"
  | "dailyWins"
  | "pets"
  | "quests"
  | "starFeats"
  | "battleFeed"
  | "customization"
  | "crystals"
  | "specialEvents"
  | "monsterModes"
  | "clubs"
  | "bossraid"
  | "ranked"
  | "megashowdown"
  | "playerMapsMode"
  | "playerMapEditor";

const FEATURE_TROPHIES: Record<TrophyFeatureId, number> = {
  clashpass: 8,
  starstrike: 20,
  dailyWins: 50,
  pets: 50,
  quests: 40,
  starFeats: 40,
  battleFeed: 100,
  customization: 150,
  crystals: 100,
  specialEvents: 300,
  monsterModes: 400,
  clubs: 325,
  bossraid: 500,
  ranked: 1000,
  megashowdown: 1000,
  playerMapsMode: 1000,
  playerMapEditor: 1000,
};

const SPECIAL_EVENT_MODES = new Set<GameMode>(["gemgrab", "heist", "siege"]);
const MONSTER_MODES = new Set<GameMode>(["monsterhide", "monsterInvasion", "teamHunt"]);

export function getAccountTrophies(): number {
  return getCurrentProfile()?.trophies ?? 0;
}

export function getFeatureTrophyRequirement(featureId: TrophyFeatureId): number {
  return FEATURE_TROPHIES[featureId] ?? 0;
}

export function isFeatureUnlocked(featureId: TrophyFeatureId, trophies = getAccountTrophies()): boolean {
  return trophies >= getFeatureTrophyRequirement(featureId);
}

export function getTrophyRequirementForMode(modeId: GameMode): number {
  if (modeId === "starstrike") return FEATURE_TROPHIES.starstrike;
  if (modeId === "bounty") return FEATURE_TROPHIES.specialEvents;
  if (modeId === "crystals") return FEATURE_TROPHIES.crystals;
  if (SPECIAL_EVENT_MODES.has(modeId)) return FEATURE_TROPHIES.specialEvents;
  if (modeId === "hardcoreShowdown") return FEATURE_TROPHIES.bossraid;
  if (MONSTER_MODES.has(modeId)) return FEATURE_TROPHIES.monsterModes;
  if (modeId === "bossraid") return FEATURE_TROPHIES.bossraid;
  if (modeId === "ranked") return FEATURE_TROPHIES.ranked;
  if (modeId === "megashowdown") return FEATURE_TROPHIES.megashowdown;
  return 0;
}

export function isModeUnlockedByTrophies(modeId: GameMode, trophies = getAccountTrophies()): boolean {
  return trophies >= getTrophyRequirementForMode(modeId);
}

export function isModeCategoryUnlocked(
  category: "ranked" | "monsters" | "boss" | "playermaps",
  trophies = getAccountTrophies(),
): boolean {
  switch (category) {
    case "ranked": return isFeatureUnlocked("ranked", trophies);
    case "monsters": return isFeatureUnlocked("monsterModes", trophies);
    case "boss": return isFeatureUnlocked("bossraid", trophies);
    case "playermaps": return isFeatureUnlocked("playerMapsMode", trophies);
    default: return true;
  }
}

/** Newly crossed thresholds (sorted by trophy count). */
export function detectNewlyUnlockedFeatures(prevTrophies: number, nextTrophies: number): TrophyFeatureId[] {
  if (nextTrophies <= prevTrophies) return [];
  const out: TrophyFeatureId[] = [];
  for (const [id, req] of Object.entries(FEATURE_TROPHIES) as [TrophyFeatureId, number][]) {
    if (prevTrophies < req && nextTrophies >= req) out.push(id);
  }
  out.sort((a, b) => getFeatureTrophyRequirement(a) - getFeatureTrophyRequirement(b));
  return out;
}

export const ALL_TROPHY_FEATURES = Object.keys(FEATURE_TROPHIES) as TrophyFeatureId[];
