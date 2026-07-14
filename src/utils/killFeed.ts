/** Kill-feed events emitted from Brawler death (all battle modes). */

export interface KillFeedEvent {
  id: string;
  killerBrawlerId: string;
  killerName: string;
  victimBrawlerId: string;
  victimName: string;
  /** true = killer on local player's team (blue bar). */
  isFriendly: boolean;
}

export interface KillFeedEmitPayload {
  killerBrawlerId: string;
  killerName: string;
  victimBrawlerId: string;
  victimName: string;
  killerTeam: string;
  /** Local human player got the kill — always show blue bar. */
  killerIsPlayer?: boolean;
}

type KillFeedListener = (event: KillFeedEvent) => void;

let playerTeam = "blue";
const listeners = new Set<KillFeedListener>();

export function setKillFeedPlayerTeam(team: string): void {
  playerTeam = team || "blue";
}

export function resetKillFeedBus(): void {
  playerTeam = "blue";
}

export function subscribeKillFeed(listener: KillFeedListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitKillFeed(payload: KillFeedEmitPayload): void {
  if (!payload.killerBrawlerId || !payload.victimBrawlerId) return;
  if (payload.killerBrawlerId === payload.victimBrawlerId) return;
  const killerName = payload.killerName.trim() || "?";
  const victimName = payload.victimName.trim() || "?";
  const isFriendly = payload.killerTeam === playerTeam || !!payload.killerIsPlayer;
  const event: KillFeedEvent = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    killerBrawlerId: payload.killerBrawlerId,
    killerName,
    victimBrawlerId: payload.victimBrawlerId,
    victimName,
    isFriendly,
  };
  for (const fn of listeners) fn(event);
}
