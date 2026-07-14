import { getCurrentProfile } from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import { getPresenceForPlayerId } from "./presence";
import { getMyPartyRoom, getPartyMemberCount } from "./party";
import { getProfileByPlayerId } from "../playerGiftSend";

/** Первый участник команды, за чьим боем можно наблюдать. */
export function getPartySpectateTarget(): string | null {
  const me = getCurrentProfile();
  const room = getMyPartyRoom();
  if (!me?.playerId || !room || getPartyMemberCount() <= 1) return null;

  const candidates: string[] = [];
  if (room.leaderPlayerId) {
    candidates.push(normalizePlayerIdQuery(room.leaderPlayerId));
  }
  for (const m of room.members) {
    const id = normalizePlayerIdQuery(m.playerId);
    if (!candidates.includes(id)) candidates.push(id);
  }

  for (const id of candidates) {
    const pr = getPresenceForPlayerId(id);
    if (pr.online && pr.screen === "battle") return id;
  }
  return null;
}

export function canPartyObserveBattle(): boolean {
  return getPartySpectateTarget() !== null;
}

export function canSpectatePlayer(playerId: string): boolean {
  const pr = getPresenceForPlayerId(playerId);
  return pr.online && pr.screen === "battle";
}

export function getPlayerBattleMode(playerId: string): string | null {
  const prof = getProfileByPlayerId(playerId);
  const pr = (prof as { socialPresence?: { battleMode?: string; screen?: string } })?.socialPresence;
  if (!pr || pr.screen !== "battle") return null;
  return pr.battleMode ?? null;
}
