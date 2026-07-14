import type { GameMode } from "../App";
import {
  editorModeForGameMode,
  getActiveMap,
  getMapScheduleConfig,
  getRotatingMapId,
} from "./mapSchedule";
import { getPublishedMap, getSavedMaps } from "./mapEditorAPI";

export function getRankedMapPoolForMode(mode: GameMode): string[] {
  const editorMode = editorModeForGameMode(mode);
  if (!editorMode) return [];
  const config = getMapScheduleConfig(editorMode);
  const ids = new Set<string>();
  if (config.variant === "rotating" && config.rotatingPool?.length) {
    for (const id of config.rotatingPool) ids.add(id);
  } else {
    const active = getActiveMap(editorMode);
    if (active?.id) ids.add(active.id);
    const rotating = getRotatingMapId(editorMode);
    if (rotating) ids.add(rotating);
  }
  if (ids.size === 0) {
    const pub = getPublishedMap(editorMode);
    if (pub?.id) ids.add(pub.id);
    for (const m of getSavedMaps().filter(x => x.mode === editorMode)) {
      if (m.id) ids.add(m.id);
    }
  }
  return [...ids];
}

export function pickRandomRankedMap(mode: GameMode): string | null {
  const pool = getRankedMapPoolForMode(mode);
  if (pool.length === 0) return getActiveMap(editorModeForGameMode(mode)!)?.id ?? null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export const RANKED_SESSION_KEY = "clash_ranked_session_v1";

export interface RankedDraftParticipant {
  slotId: string;
  displayName: string;
  team: "blue" | "red";
  isPlayer: boolean;
  brawlerId: string;
  petId: string | null;
  rankedCups: number;
  powerLevel: number;
  stars: number;
}

export interface RankedBattleSession {
  active: true;
  mode: GameMode;
  mapId?: string | null;
  roster?: RankedDraftParticipant[];
}

export function setRankedBattleSession(session: RankedBattleSession | null): void {
  if (!session) {
    sessionStorage.removeItem(RANKED_SESSION_KEY);
    return;
  }
  sessionStorage.setItem(RANKED_SESSION_KEY, JSON.stringify(session));
}

export function getRankedBattleSession(): RankedBattleSession | null {
  try {
    const raw = sessionStorage.getItem(RANKED_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RankedBattleSession;
    return parsed?.active ? parsed : null;
  } catch {
    return null;
  }
}

export function clearRankedBattleSession(): void {
  sessionStorage.removeItem(RANKED_SESSION_KEY);
}

export function isRankedBattleSession(): boolean {
  return getRankedBattleSession() !== null;
}
