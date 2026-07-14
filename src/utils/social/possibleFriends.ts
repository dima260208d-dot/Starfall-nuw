import { getBattleHistory, getCurrentProfile } from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import { getFriendsList } from "./friends";
import { getIncomingFriendRequests, getOutgoingFriendRequests } from "./friends";

export interface PossibleFriendRow {
  playerId: string;
  username: string;
  consecutiveGames: number;
}

function isPendingWith(playerId: string): boolean {
  const id = normalizePlayerIdQuery(playerId);
  return getIncomingFriendRequests().some((r) => normalizePlayerIdQuery(r.fromPlayerId) === id)
    || getOutgoingFriendRequests().some((r) => normalizePlayerIdQuery(r.toPlayerId) === id);
}

/** Игроки из истории боёв — с кем играли подряд, но ещё не в друзьях. */
export function getPossibleFriendRows(): PossibleFriendRow[] {
  const me = getCurrentProfile();
  if (!me?.playerId) return [];

  const myId = normalizePlayerIdQuery(me.playerId);
  const friendIds = new Set(getFriendsList().map((f) => normalizePlayerIdQuery(f.playerId)));
  const history = [...getBattleHistory()].sort((a, b) => b.ts - a.ts);

  let streak = new Map<string, { username: string; count: number }>();

  for (const record of history) {
    if (!record.teams?.length) continue;

    const myPart = record.teams.find(
      (p) => p.isPlayer || (p.playerId && normalizePlayerIdQuery(p.playerId) === myId),
    );
    const myTeam = myPart?.team ?? "blue";

    const teammates = record.teams.filter(
      (p) => p.team === myTeam
        && !p.isPlayer
        && p.playerId
        && !p.isBot
        && normalizePlayerIdQuery(p.playerId!) !== myId,
    );

    const next = new Map<string, { username: string; count: number }>();
    for (const t of teammates) {
      const id = normalizePlayerIdQuery(t.playerId!);
      const prev = streak.get(id);
      next.set(id, {
        username: t.displayName || prev?.username || "Игрок",
        count: (prev?.count ?? 0) + 1,
      });
    }
    streak = next;
  }

  const rows: PossibleFriendRow[] = [];
  for (const [playerId, meta] of streak) {
    if (friendIds.has(playerId)) continue;
    if (isPendingWith(playerId)) continue;
    rows.push({
      playerId,
      username: meta.username,
      consecutiveGames: meta.count,
    });
  }

  rows.sort((a, b) => b.consecutiveGames - a.consecutiveGames);
  return rows;
}
