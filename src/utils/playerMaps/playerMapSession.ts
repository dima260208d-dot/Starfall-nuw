import type { GameMode } from "../../App";
import type { EditorMode } from "../mapEditorAPI";
import { editorModeForGameMode } from "../mapSchedule";
import {
  getPublishedPlayerMapById,
  pickRandomPlayerMap,
  publishedToMapSave,
  type PublishedPlayerMap,
} from "./playerMapRegistry";
import type { MapSave } from "../mapEditorAPI";

export const PLAYER_MAP_BATTLE_KEY = "clash_player_map_battle_v1";
export const MAP_SOURCE_KEY = "clash_map_source_v1";

export type MapSourceCategory = "regular" | "playermaps";

export interface PlayerMapBattleSession {
  active: true;
  mode: GameMode;
  publishId: string;
  mapName: string;
  authorName: string;
  authorId: string;
  voted?: "like" | "dislike" | null;
}

export function setMapSourceCategory(cat: MapSourceCategory): void {
  sessionStorage.setItem(MAP_SOURCE_KEY, cat);
}

export function getMapSourceCategory(): MapSourceCategory {
  try {
    const v = sessionStorage.getItem(MAP_SOURCE_KEY);
    return v === "playermaps" ? "playermaps" : "regular";
  } catch {
    return "regular";
  }
}

export function clearMapSourceCategory(): void {
  sessionStorage.removeItem(MAP_SOURCE_KEY);
}

export function isPlayerMapsModeSelected(): boolean {
  return getMapSourceCategory() === "playermaps";
}

/** Режимы, доступные во вкладке «Карты игроков» (без мега-шоудауна и без режимов без редактора). */
export function isPlayerMapGameMode(modeId: string): boolean {
  if (modeId === "megashowdown") return false;
  return editorModeForGameMode(modeId) !== null;
}

export function setPlayerMapBattleSession(session: PlayerMapBattleSession | null): void {
  if (!session) {
    sessionStorage.removeItem(PLAYER_MAP_BATTLE_KEY);
    return;
  }
  sessionStorage.setItem(PLAYER_MAP_BATTLE_KEY, JSON.stringify(session));
}

export function getPlayerMapBattleSession(): PlayerMapBattleSession | null {
  try {
    const raw = sessionStorage.getItem(PLAYER_MAP_BATTLE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerMapBattleSession;
    return parsed?.active ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPlayerMapBattleSession(): void {
  sessionStorage.removeItem(PLAYER_MAP_BATTLE_KEY);
}

export function isPlayerMapBattleSession(): boolean {
  return getPlayerMapBattleSession() !== null;
}

export function markPlayerMapVote(vote: "like" | "dislike"): void {
  const s = getPlayerMapBattleSession();
  if (!s) return;
  setPlayerMapBattleSession({ ...s, voted: vote });
}

/** Выбирает случайную карту игрока и сохраняет сессию боя. */
export function beginPlayerMapBattle(mode: GameMode): PublishedPlayerMap | null {
  const editorMode = editorModeForGameMode(mode);
  if (!editorMode) return null;
  const picked = pickRandomPlayerMap(editorMode);
  if (!picked) return null;
  setPlayerMapBattleSession({
    active: true,
    mode,
    publishId: picked.publishId,
    mapName: picked.name,
    authorName: picked.authorName,
    authorId: picked.authorId,
    voted: null,
  });
  return picked;
}

export function resolvePlayerMapForBattle(editorMode: EditorMode): MapSave | null {
  const session = getPlayerMapBattleSession();
  if (!session) return null;
  const pub = getPublishedPlayerMapById(session.publishId);
  if (pub) return publishedToMapSave(pub);
  const picked = pickRandomPlayerMap(editorMode);
  if (!picked) return null;
  setPlayerMapBattleSession({
    ...session,
    publishId: picked.publishId,
    mapName: picked.name,
    authorName: picked.authorName,
    authorId: picked.authorId,
  });
  return publishedToMapSave(picked);
}
