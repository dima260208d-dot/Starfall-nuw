import { getProfileByPlayerId } from "./playerGiftSend";
import { getProfileRankedCups, rankedStandingFromTotalCups, RANKED_LEAGUES } from "./rankedProgress";
import type { UserProfile } from "./localStorageAPI";

export const RANKED_PARTY_MAX_LEAGUE_GAP = 1;

export interface RankedPartyLeagueCheck {
  ok: boolean;
  reasonKey?: string;
  params?: Record<string, string | number>;
}

export function rankedLeagueIndexFromProfile(profile: UserProfile | null | undefined): number {
  if (!profile) return 0;
  return rankedStandingFromTotalCups(getProfileRankedCups(profile)).leagueIndex;
}

export function rankedLeagueGap(a: number, b: number): number {
  return Math.abs(a - b);
}

export function areRankedLeaguesCompatible(leagueA: number, leagueB: number): boolean {
  return rankedLeagueGap(leagueA, leagueB) <= RANKED_PARTY_MAX_LEAGUE_GAP;
}

export function rankedLeagueNameKey(leagueIndex: number): string {
  const id = RANKED_LEAGUES[Math.max(0, Math.min(RANKED_LEAGUES.length - 1, leagueIndex))]?.id ?? "shattered";
  return `ranked.league.${id}`;
}

/** Все игроки могут играть ranked вместе, если разница лиг между любыми двумя ≤ 1. */
export function checkRankedPartyLeagueCompatibility(playerIds: string[]): RankedPartyLeagueCheck {
  if (playerIds.length <= 1) return { ok: true };

  const entries: { playerId: string; username: string; leagueIndex: number }[] = [];
  for (const playerId of playerIds) {
    const prof = getProfileByPlayerId(playerId);
    if (!prof) {
      return { ok: false, reasonKey: "ranked.party.profileMissing" };
    }
    entries.push({
      playerId,
      username: prof.username,
      leagueIndex: rankedLeagueIndexFromProfile(prof),
    });
  }

  let worstGap = 0;
  let worstA = entries[0]!;
  let worstB = entries[1]!;

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      const gap = rankedLeagueGap(a.leagueIndex, b.leagueIndex);
      if (gap > RANKED_PARTY_MAX_LEAGUE_GAP) {
        return {
          ok: false,
          reasonKey: "ranked.party.leagueGapTooLarge",
          params: {
            name1: a.username,
            league1: rankedLeagueNameKey(a.leagueIndex),
            name2: b.username,
            league2: rankedLeagueNameKey(b.leagueIndex),
            gap,
            maxGap: RANKED_PARTY_MAX_LEAGUE_GAP,
          },
        };
      }
      if (gap >= worstGap) {
        worstGap = gap;
        worstA = a;
        worstB = b;
      }
    }
  }

  return { ok: true };
}

export function formatRankedPartyLeagueError(
  check: RankedPartyLeagueCheck,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (check.ok || !check.reasonKey) return "";
  const params = { ...check.params };
  if (typeof params.league1 === "string" && params.league1.startsWith("ranked.")) {
    params.league1 = t(params.league1);
  }
  if (typeof params.league2 === "string" && params.league2.startsWith("ranked.")) {
    params.league2 = t(params.league2);
  }
  return t(check.reasonKey, params);
}
