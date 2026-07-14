import type { GameMode } from "../../App";
import { getCurrentProfile, updateProfile } from "../localStorageAPI";
import {
  detectNewlyUnlockedFeatures,
  type TrophyFeatureId,
} from "./trophyUnlocks";

export type UnlockGuidePhase =
  | "point_open"
  | "explain"
  | "point_tab"
  | "explain_tab";

export interface UnlockGuideTabStep {
  tabId: string;
  openMessageKey: string;
  explainMessageKey: string;
}

export interface UnlockGuideDefinition {
  featureId: TrophyFeatureId;
  openMessageKey: string;
  explainMessageKey: string;
  /** data-unlock-target on menu */
  menuTarget: string;
  /** Screen id after open (for explain phase) */
  screenAfterOpen?: string;
  tabs?: UnlockGuideTabStep[];
}

export const UNLOCK_GUIDE_DEFS: UnlockGuideDefinition[] = [
  {
    featureId: "clashpass",
    menuTarget: "clashpass",
    openMessageKey: "unlockGuide.clashpass.open",
    explainMessageKey: "unlockGuide.clashpass.explain",
    screenAfterOpen: "clashpass",
  },
  {
    featureId: "pets",
    menuTarget: "pets",
    openMessageKey: "unlockGuide.pets.open",
    explainMessageKey: "unlockGuide.pets.explain",
    screenAfterOpen: "pets",
  },
  {
    featureId: "quests",
    menuTarget: "quests",
    openMessageKey: "unlockGuide.quests.open",
    explainMessageKey: "unlockGuide.quests.explain",
  },
  {
    featureId: "starFeats",
    menuTarget: "starFeats",
    openMessageKey: "unlockGuide.starFeats.open",
    explainMessageKey: "unlockGuide.starFeats.explain",
    screenAfterOpen: "starFeats",
  },
  {
    featureId: "dailyWins",
    menuTarget: "dailyWins",
    openMessageKey: "unlockGuide.dailyWins.open",
    explainMessageKey: "unlockGuide.dailyWins.explain",
  },
  {
    featureId: "battleFeed",
    menuTarget: "battleFeed",
    openMessageKey: "unlockGuide.battleFeed.open",
    explainMessageKey: "unlockGuide.battleFeed.explain",
    screenAfterOpen: "battleFeed",
  },
  {
    featureId: "customization",
    menuTarget: "customization",
    openMessageKey: "unlockGuide.customization.open",
    explainMessageKey: "unlockGuide.customization.explain",
    screenAfterOpen: "customization",
    tabs: [
      { tabId: "pins", openMessageKey: "unlockGuide.customization.tab.pins.open", explainMessageKey: "unlockGuide.customization.tab.pins.explain" },
      { tabId: "icons", openMessageKey: "unlockGuide.customization.tab.icons.open", explainMessageKey: "unlockGuide.customization.tab.icons.explain" },
      { tabId: "backgrounds", openMessageKey: "unlockGuide.customization.tab.backgrounds.open", explainMessageKey: "unlockGuide.customization.tab.backgrounds.explain" },
      { tabId: "trails", openMessageKey: "unlockGuide.customization.tab.trails.open", explainMessageKey: "unlockGuide.customization.tab.trails.explain" },
      { tabId: "gifts", openMessageKey: "unlockGuide.customization.tab.gifts.open", explainMessageKey: "unlockGuide.customization.tab.gifts.explain" },
    ],
  },
  {
    featureId: "clubs",
    menuTarget: "clubs",
    openMessageKey: "unlockGuide.clubs.open",
    explainMessageKey: "unlockGuide.clubs.explain",
    screenAfterOpen: "clubs",
  },
  {
    featureId: "starstrike",
    menuTarget: "modeSelect",
    openMessageKey: "unlockGuide.mode.starstrike.open",
    explainMessageKey: "unlockGuide.mode.starstrike.explain",
    screenAfterOpen: "modeSelect",
  },
  {
    featureId: "crystals",
    menuTarget: "modeSelect",
    openMessageKey: "unlockGuide.mode.crystals.open",
    explainMessageKey: "unlockGuide.mode.crystals.explain",
    screenAfterOpen: "modeSelect",
  },
  {
    featureId: "specialEvents",
    menuTarget: "modeSelect",
    openMessageKey: "unlockGuide.mode.specialEvents.open",
    explainMessageKey: "unlockGuide.mode.specialEvents.explain",
    screenAfterOpen: "modeSelect",
  },
  {
    featureId: "monsterModes",
    menuTarget: "modeSelect",
    openMessageKey: "unlockGuide.mode.monsters.open",
    explainMessageKey: "unlockGuide.mode.monsters.explain",
    screenAfterOpen: "modeSelect",
  },
  {
    featureId: "bossraid",
    menuTarget: "modeSelect",
    openMessageKey: "unlockGuide.mode.boss.open",
    explainMessageKey: "unlockGuide.mode.boss.explain",
    screenAfterOpen: "modeSelect",
  },
  {
    featureId: "ranked",
    menuTarget: "ranked",
    openMessageKey: "unlockGuide.ranked.open",
    explainMessageKey: "unlockGuide.ranked.explain",
    screenAfterOpen: "rankedMenu",
  },
  {
    featureId: "megashowdown",
    menuTarget: "modeSelect",
    openMessageKey: "unlockGuide.mode.mega.open",
    explainMessageKey: "unlockGuide.mode.mega.explain",
    screenAfterOpen: "modeSelect",
  },
  {
    featureId: "playerMapsMode",
    menuTarget: "modeSelect",
    openMessageKey: "unlockGuide.mode.playerMaps.open",
    explainMessageKey: "unlockGuide.mode.playerMaps.explain",
    screenAfterOpen: "modeSelect",
  },
  {
    featureId: "playerMapEditor",
    menuTarget: "playerMapEditor",
    openMessageKey: "unlockGuide.playerMapEditor.open",
    explainMessageKey: "unlockGuide.playerMapEditor.explain",
  },
];

const GUIDE_BY_FEATURE = new Map(UNLOCK_GUIDE_DEFS.map(d => [d.featureId, d]));

export function getUnlockGuideDef(featureId: TrophyFeatureId): UnlockGuideDefinition | undefined {
  return GUIDE_BY_FEATURE.get(featureId);
}

function readQueue(): TrophyFeatureId[] {
  const q = getCurrentProfile()?.trophyUnlockGuideQueue;
  return Array.isArray(q) ? q.filter((x): x is TrophyFeatureId => typeof x === "string") : [];
}

function readDone(): string[] {
  const d = getCurrentProfile()?.trophyUnlockGuideDone;
  return Array.isArray(d) ? d.filter((x): x is string => typeof x === "string") : [];
}

export function getUnlockGuideQueue(): TrophyFeatureId[] {
  return readQueue();
}

export function enqueueUnlockGuides(featureIds: TrophyFeatureId[]): void {
  const p = getCurrentProfile();
  if (!p || !featureIds.length) return;
  const done = new Set(readDone());
  const existing = new Set(readQueue());
  const toAdd = featureIds.filter(id => !done.has(id) && !existing.has(id) && GUIDE_BY_FEATURE.has(id));
  if (!toAdd.length) return;
  updateProfile({ trophyUnlockGuideQueue: [...readQueue(), ...toAdd] });
  notifyUnlockGuideChanged();
}

export function syncUnlockGuidesAfterTrophyChange(prevTrophies: number, nextTrophies: number): void {
  const newly = detectNewlyUnlockedFeatures(prevTrophies, nextTrophies);
  enqueueUnlockGuides(newly);
}

export function peekUnlockGuide(): TrophyFeatureId | null {
  const q = readQueue();
  return q[0] ?? null;
}

export function completeUnlockGuideFeature(featureId: TrophyFeatureId): void {
  const q = readQueue().filter(id => id !== featureId);
  const done = new Set(readDone());
  done.add(featureId);
  updateProfile({
    trophyUnlockGuideQueue: q,
    trophyUnlockGuideDone: [...done],
  });
  notifyUnlockGuideChanged();
}

export function isModeFirstPlayHintDone(modeId: GameMode): boolean {
  const list = getCurrentProfile()?.modeFirstPlayHintsDone;
  return Array.isArray(list) && list.includes(modeId);
}

export function markModeFirstPlayHintDone(modeId: GameMode): void {
  if (isModeFirstPlayHintDone(modeId)) return;
  const prev = getCurrentProfile()?.modeFirstPlayHintsDone ?? [];
  if (prev.includes(modeId)) return;
  updateProfile({ modeFirstPlayHintsDone: [...prev, modeId] });
}

export const UNLOCK_GUIDE_CHANGED = "trophy-unlock-guide-changed";

export function notifyUnlockGuideChanged(): void {
  window.dispatchEvent(new Event(UNLOCK_GUIDE_CHANGED));
}
