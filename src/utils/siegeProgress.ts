import type { UserProfile } from "./localStorageAPI";
import {
  findProfileStorageKeyByPlayerId,
  getAllProfiles,
  getCurrentProfile,
  normalizeProfile,
  saveProfiles,
  updateProfile,
} from "./localStorageAPI";
import { normalizePlayerIdQuery } from "./playerId";
import { readPartyBattleRoster } from "./social/partyBattle";
import { getProfileByPlayerId } from "./playerGiftSend";

export const SIEGE_MAX_LEVEL = 5;

export function getSiegeMaxWaves(level: number): number {
  const lv = Math.max(1, Math.min(SIEGE_MAX_LEVEL, Math.floor(level)));
  return lv * 3;
}

export function getSiegeCurrentLevel(profile: UserProfile | null): number {
  const m = profile?.siege?.maxDefeated ?? 0;
  return Math.max(1, Math.min(SIEGE_MAX_LEVEL, m + 1));
}

export function isSiegeLevelCleared(profile: UserProfile | null, level: number): boolean {
  return (profile?.siege?.maxDefeated ?? 0) >= level;
}

function stageSiegeVictoryOnPlayerId(playerId: string, level: number): void {
  const key = findProfileStorageKeyByPlayerId(playerId);
  if (!key) return;
  const all = getAllProfiles();
  const raw = all[key];
  if (!raw) return;
  const profile = normalizeProfile(raw as UserProfile);
  const prev = profile.siege?.maxDefeated ?? 0;
  profile.siege = { maxDefeated: Math.max(prev, Math.min(SIEGE_MAX_LEVEL, level)) };
  all[key] = profile;
  saveProfiles(all);
  const me = getCurrentProfile();
  if (me?.playerId && normalizePlayerIdQuery(me.playerId) === normalizePlayerIdQuery(playerId)) {
    updateProfile({ siege: profile.siege });
  }
}

export function applyPartySharedSiegeVictory(level: number): void {
  const roster = readPartyBattleRoster();
  if (roster.length <= 1) {
    const me = getCurrentProfile();
    if (me?.playerId) stageSiegeVictoryOnPlayerId(me.playerId, level);
    return;
  }
  for (const entry of roster) stageSiegeVictoryOnPlayerId(entry.playerId, level);
}

export function resolvePartySiegeLevel(): number {
  const roster = readPartyBattleRoster();
  if (roster.length <= 1) return getSiegeCurrentLevel(getCurrentProfile());
  let min = Infinity;
  for (const entry of roster) {
    const prof = getProfileByPlayerId(entry.playerId);
    min = Math.min(min, getSiegeCurrentLevel(prof));
  }
  return Math.max(1, min === Infinity ? 1 : min);
}