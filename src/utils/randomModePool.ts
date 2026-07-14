import type { GameMode } from "../App";
import {
  getAccountTrophies,
  getTrophyRequirementForMode,
  isModeUnlockedByTrophies,
} from "./progression/trophyUnlocks";
import { editorModeForGameMode } from "./mapSchedule";
import { getRankedMapPoolForMode } from "./rankedMapPick";
import { pickRandomRankedMap } from "./rankedMapPick";
import { getCurrentProfile } from "./localStorageAPI";
import { BRAWLERS } from "../entities/BrawlerData";

/** Modes excluded from the random roulette pool. */
const RANDOM_EXCLUDED = new Set<GameMode>([
  "ranked",
  "training",
  "random",
  "bossraid",
]);

/** All modes that can appear in random roulette (except excluded). */
const RANDOM_CANDIDATES: GameMode[] = [
  "starstrike",
  "showdown",
  "crystals",
  "siege",
  "heist",
  "gemgrab",
  "megashowdown",
  "bounty",
  "hardcoreShowdown",
  "monsterhide",
  "monsterInvasion",
  "teamHunt",
];

export function modeHasPlayableMap(mode: GameMode): boolean {
  const editorMode = editorModeForGameMode(mode);
  if (!editorMode) return true;
  return getRankedMapPoolForMode(mode).length > 0;
}

/** All battle modes that must be unlocked before Random Mode appears (ranked excluded). */
export function getRandomModePrerequisiteModes(): GameMode[] {
  return [...RANDOM_CANDIDATES, "bossraid"];
}

export function isRandomModeFeatureUnlocked(trophies = getAccountTrophies()): boolean {
  return getRandomModePrerequisiteModes().every(
    (m) => isModeUnlockedByTrophies(m, trophies) && modeHasPlayableMap(m),
  );
}

/** Highest trophy gate still blocking random mode (for lock label). */
export function getRandomModeUnlockTrophyHint(trophies = getAccountTrophies()): number {
  let hint = 0;
  for (const m of getRandomModePrerequisiteModes()) {
    if (isModeUnlockedByTrophies(m, trophies) && modeHasPlayableMap(m)) continue;
    hint = Math.max(hint, getTrophyRequirementForMode(m));
  }
  return hint;
}

export function getRandomModePool(trophies = getAccountTrophies()): GameMode[] {
  return RANDOM_CANDIDATES.filter(
    (m) =>
      !RANDOM_EXCLUDED.has(m) &&
      isModeUnlockedByTrophies(m, trophies) &&
      modeHasPlayableMap(m),
  );
}

export function pickRandomModeFromPool(pool = getRandomModePool()): GameMode {
  if (pool.length === 0) return "showdown";
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function pickRandomMapForMode(mode: GameMode): string | null {
  return pickRandomRankedMap(mode);
}

export function getUnlockedBrawlerPool(): string[] {
  const profile = getCurrentProfile();
  const unlocked = profile?.unlockedBrawlers ?? ["hana"];
  return unlocked.filter((id) => BRAWLERS.some((b) => b.id === id));
}

export function pickRandomUnlockedBrawler(pool = getUnlockedBrawlerPool()): string {
  if (pool.length === 0) return "hana";
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function pickRandomMegaSquad(mainBrawlerId: string): string[] {
  const pool = getUnlockedBrawlerPool().filter((id) => id !== mainBrawlerId);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const extras = shuffled.slice(0, 2);
  while (extras.length < 2) {
    extras.push(pool[extras.length % Math.max(1, pool.length)] ?? "hana");
  }
  return [mainBrawlerId, extras[0]!, extras[1]!];
}
