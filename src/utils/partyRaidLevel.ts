import type { UserProfile } from "./localStorageAPI";
import { getCurrentProfile } from "./localStorageAPI";
import { getBossRaidCurrentLevel } from "./bossRaidProgress";
import { getProfileByPlayerId } from "./playerGiftSend";
import { readPartyBattleRoster } from "./social/partyBattle";

export function resolvePartyMinLevel(getUnlockedLevel: (profile: UserProfile | null) => number): number {
  const roster = readPartyBattleRoster();
  if (roster.length <= 1) return getUnlockedLevel(getCurrentProfile());
  let min = Infinity;
  for (const entry of roster) {
    const prof = getProfileByPlayerId(entry.playerId);
    min = Math.min(min, getUnlockedLevel(prof));
  }
  return Math.max(1, min === Infinity ? 1 : min);
}

export function resolvePartyBossRaidLevel(bossId: string): number {
  return resolvePartyMinLevel((p) => getBossRaidCurrentLevel(p, bossId));
}