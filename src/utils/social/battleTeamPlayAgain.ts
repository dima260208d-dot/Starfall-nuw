import type { GameParticipant } from "../../types/gameResult";
import { pinIdFor } from "../../entities/PinData";
import { getCurrentProfile } from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import {
  type PartyPlayAgainMemberStatus,
  type PartyPlayAgainState,
  PARTY_PLAY_AGAIN_TIMEOUT_MS,
  PARTY_CHANGED_EVENT,
} from "./party";
import { isTestFriendPlayerId } from "./seedTestFriends";
import {
  type PartyBattleRosterEntry,
  readPartyBattleRoster,
  clearPartyBattleRoster,
  type PartyPlayAgainPanelMember,
} from "./partyBattle";
import { isTeamFormatForPlayAgain } from "./playAgainFormats";
import type { ShowdownFormat } from "../../App";

export const BATTLE_TEAM_ROSTER_KEY = "clash_battle_team_roster_v1";
export const BATTLE_PLAY_AGAIN_KEY = "clash_battle_play_again_v1";

export interface BattleTeamRosterEntry {
  rosterKey: string;
  playerId: string | null;
  username: string;
  brawlerId: string;
  level: number;
  isMe: boolean;
  isHuman: boolean;
}

export function readBattleTeamRoster(): BattleTeamRosterEntry[] {
  try {
    const raw = sessionStorage.getItem(BATTLE_TEAM_ROSTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BattleTeamRosterEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearBattleTeamRoster(): void {
  sessionStorage.removeItem(BATTLE_TEAM_ROSTER_KEY);
}

/** Состав вашей стороны из боя: люди + боты-союзники. */
export function stashBattleTeamRosterFromParticipants(participants: GameParticipant[]): void {
  const player = participants.find(p => p.isPlayer);
  if (!player) return;

  const me = getCurrentProfile();
  const myId = me?.playerId ? normalizePlayerIdQuery(me.playerId) : "";
  const partyRoster = readPartyBattleRoster();
  const team = participants.filter(p => p.team === player.team);

  const entries: BattleTeamRosterEntry[] = team.map(p => {
    const partyMatch = partyRoster.find(e =>
      (p.isPlayer && e.isMe)
      || (!p.isPlayer && e.username === p.displayName && e.brawlerId === p.brawlerId)
      || (!p.isPlayer && e.username === p.displayName),
    );
    const isHuman = p.isPlayer || !!partyMatch;
    const playerId = p.isPlayer
      ? (myId || null)
      : (partyMatch ? normalizePlayerIdQuery(partyMatch.playerId) : null);
    const rosterKey = playerId ?? `bot:${p.brawlerId}:${p.displayName}`;
    return {
      rosterKey,
      playerId,
      username: p.displayName,
      brawlerId: p.brawlerId,
      level: p.level,
      isMe: p.isPlayer,
      isHuman,
    };
  });

  sessionStorage.setItem(BATTLE_TEAM_ROSTER_KEY, JSON.stringify(entries));

  const humans: PartyBattleRosterEntry[] = entries
    .filter(e => e.isHuman && e.playerId)
    .map(e => ({
      playerId: e.playerId!,
      username: e.username,
      brawlerId: e.brawlerId,
      level: e.level,
      isMe: e.isMe,
    }));
  if (humans.length > 1) {
    sessionStorage.setItem("clash_party_battle_roster_v1", JSON.stringify(humans));
  }
}

export function countBattleTeamHumans(): number {
  return readBattleTeamRoster().filter(e => e.isHuman).length;
}

export function getBattleTeamHumanIds(): string[] {
  return readBattleTeamRoster()
    .filter(e => e.isHuman && e.playerId)
    .map(e => normalizePlayerIdQuery(e.playerId!));
}

export function isBattleTeamPlayAgainEligible(mode?: string, showdownFormat?: ShowdownFormat): boolean {
  const team = readBattleTeamRoster();
  if (team.length < 2) return false;
  if (mode && !isTeamFormatForPlayAgain(mode, showdownFormat)) return false;
  return countBattleTeamHumans() >= 1;
}

function emitPlayAgainChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
  }
}

export function readBattlePlayAgainState(): PartyPlayAgainState | null {
  try {
    const raw = sessionStorage.getItem(BATTLE_PLAY_AGAIN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PartyPlayAgainState;
  } catch {
    return null;
  }
}

function writeBattlePlayAgainState(pa: PartyPlayAgainState | null): void {
  if (!pa) sessionStorage.removeItem(BATTLE_PLAY_AGAIN_KEY);
  else sessionStorage.setItem(BATTLE_PLAY_AGAIN_KEY, JSON.stringify(pa));
}

export function clearBattlePlayAgainState(): void {
  writeBattlePlayAgainState(null);
}

export function getPlayAgainState(): PartyPlayAgainState | null {
  return readBattlePlayAgainState();
}

export function isPlayAgainActive(): boolean {
  const pa = getPlayAgainState();
  return !!pa && !pa.finalized;
}

export function amIPlayAgainReady(): boolean {
  const me = getCurrentProfile();
  const pa = getPlayAgainState();
  if (!me?.playerId || !pa) return false;
  return pa.readyIds.includes(normalizePlayerIdQuery(me.playerId));
}

export function getPlayAgainSecondsLeft(): number {
  const pa = getPlayAgainState();
  if (!pa || pa.finalized) return 0;
  if (pa.readyIds.length === 0 || pa.deadlineAt <= pa.startedAt) return 0;
  return Math.max(0, Math.ceil((pa.deadlineAt - Date.now()) / 1000));
}

export function isPlayAgainTimerRunning(): boolean {
  const pa = getPlayAgainState();
  if (!pa || pa.finalized) return false;
  return pa.readyIds.length > 0 && pa.deadlineAt > pa.startedAt;
}

export function getPlayAgainMemberStatus(playerId: string): PartyPlayAgainMemberStatus {
  const pa = getPlayAgainState();
  const id = normalizePlayerIdQuery(playerId);
  if (!pa) return "pending";
  if (pa.declinedIds.includes(id)) return "declined";
  if (pa.readyIds.includes(id)) return "ready";
  if (pa.finalized) return "declined";
  return "pending";
}

function botPlayAgainStatus(): PartyPlayAgainMemberStatus {
  const pa = getPlayAgainState();
  if (!pa) return "pending";
  if (pa.finalized) {
    return shouldRematchBattlePlayAgain() ? "ready" : "declined";
  }
  const humans = getBattleTeamHumanIds();
  const allHumansReady = humans.length > 0 && humans.every(id => pa.readyIds.includes(id));
  return allHumansReady ? "ready" : "pending";
}

export function getBattleTeamPlayAgainPanelMembers(): PartyPlayAgainPanelMember[] {
  const team = readBattleTeamRoster();
  if (team.length < 2) return [];
  return team.map(entry => ({
    playerId: entry.rosterKey,
    username: entry.username,
    brawlerId: entry.brawlerId,
    pinId: pinIdFor(entry.brawlerId, "default"),
    status: entry.isHuman && entry.playerId
      ? getPlayAgainMemberStatus(entry.playerId)
      : botPlayAgainStatus(),
    isMe: entry.isMe,
  }));
}

export function pressBattlePlayAgain(mode: string): void {
  const me = getCurrentProfile();
  if (!me?.playerId) return;
  const team = readBattleTeamRoster();
  if (team.length < 2) return;
  const myId = normalizePlayerIdQuery(me.playerId);
  const now = Date.now();

  let pa = readBattlePlayAgainState();
  if (!pa) {
    pa = {
      startedAt: now,
      deadlineAt: now + PARTY_PLAY_AGAIN_TIMEOUT_MS,
      readyIds: [myId],
      declinedIds: [],
      finalized: false,
      mode,
    };
  } else if (!pa.finalized) {
    const readyIds = pa.readyIds.includes(myId) ? pa.readyIds : [...pa.readyIds, myId];
    pa = { ...pa, readyIds, mode: pa.mode || mode };
  }
  writeBattlePlayAgainState(pa);
  emitPlayAgainChanged();
  scheduleTestFriendsBattlePlayAgain();
}

function scheduleTestFriendsBattlePlayAgain(): void {
  const pa = readBattlePlayAgainState();
  if (!pa || pa.finalized) return;
  for (const id of getBattleTeamHumanIds()) {
    if (!isTestFriendPlayerId(id)) continue;
    if (pa.readyIds.includes(id) || pa.declinedIds.includes(id)) continue;
    const delay = 800 + Math.floor(Math.random() * 4000);
    window.setTimeout(() => {
      const cur = readBattlePlayAgainState();
      if (!cur || cur.finalized || cur.readyIds.includes(id)) return;
      writeBattlePlayAgainState({ ...cur, readyIds: [...cur.readyIds, id] });
      emitPlayAgainChanged();
    }, delay);
  }
}

export function clearAllPlayAgainState(): void {
  clearBattlePlayAgainState();
  clearBattleTeamRoster();
  clearPartyBattleRoster();
}

export function playAgainOnResultExit(): void {
  const me = getCurrentProfile();
  if (!me?.playerId) return;
  const myId = normalizePlayerIdQuery(me.playerId);
  const partyRoster = readPartyBattleRoster();
  const partyLobbyIds = partyRoster.length > 1
    ? partyRoster.map(e => normalizePlayerIdQuery(e.playerId))
    : [];
  const inPartyLobby = partyLobbyIds.length > 1 && partyLobbyIds.includes(myId);

  let pa = readBattlePlayAgainState();
  if (pa?.finalized) return;

  const now = Date.now();
  if (inPartyLobby) {
    const cancelIds = partyLobbyIds;
    if (!pa) {
      pa = {
        startedAt: now,
        deadlineAt: now,
        readyIds: [],
        declinedIds: cancelIds,
        finalized: true,
        mode: "",
        exitedBy: myId,
      };
    } else {
      pa = {
        ...pa,
        declinedIds: [...new Set([...pa.declinedIds, ...cancelIds])],
        readyIds: pa.readyIds.filter(id => !cancelIds.includes(id)),
        finalized: true,
        exitedBy: myId,
      };
    }
  } else {
    if (!pa) {
      pa = {
        startedAt: now,
        deadlineAt: now,
        readyIds: [],
        declinedIds: [myId],
        finalized: false,
        mode: "",
        exitedBy: myId,
      };
    } else {
      pa = {
        ...pa,
        declinedIds: [...new Set([...pa.declinedIds, myId])],
        readyIds: pa.readyIds.filter(id => id !== myId),
        exitedBy: myId,
      };
    }
  }
  writeBattlePlayAgainState(pa);
  emitPlayAgainChanged();
}

export function tickBattlePlayAgainExpired(): boolean {
  const pa = readBattlePlayAgainState();
  if (!pa || pa.finalized) return false;
  if (pa.readyIds.length === 0 || pa.deadlineAt <= pa.startedAt) return false;
  if (Date.now() < pa.deadlineAt) return false;

  const humans = getBattleTeamHumanIds();
  const pending = humans.filter(id => !pa.readyIds.includes(id) && !pa.declinedIds.includes(id));
  writeBattlePlayAgainState({
    ...pa,
    declinedIds: [...new Set([...pa.declinedIds, ...pending])],
    finalized: true,
  });
  emitPlayAgainChanged();
  return true;
}

export function shouldRematchBattlePlayAgain(): boolean {
  const me = getCurrentProfile();
  const pa = readBattlePlayAgainState();
  if (!me?.playerId || !pa?.finalized || pa.exitedBy) return false;
  const myId = normalizePlayerIdQuery(me.playerId);
  if (!pa.readyIds.includes(myId) || pa.declinedIds.includes(myId)) return false;

  const partyRoster = readPartyBattleRoster();
  const partyLobbyIds = partyRoster.length > 1
    ? partyRoster.map(e => normalizePlayerIdQuery(e.playerId))
    : [];
  if (partyLobbyIds.length > 1) {
    return partyLobbyIds.every(id => pa.readyIds.includes(id) && !pa.declinedIds.includes(id));
  }
  return true;
}

export function shouldExitAfterBattlePlayAgain(): boolean {
  const pa = readBattlePlayAgainState();
  if (!pa?.finalized) return false;
  return !shouldRematchBattlePlayAgain();
}

export function stashBattlePlayAgainRematchRoster(): void {
  const pa = readBattlePlayAgainState();
  const humans = readBattleTeamRoster().filter(e => e.isHuman && e.playerId);
  if (!pa?.finalized || humans.length < 1) return;

  const ready = new Set(pa.readyIds.map(normalizePlayerIdQuery));
  const filtered = humans
    .filter(e => ready.has(normalizePlayerIdQuery(e.playerId!)))
    .map(e => ({
      playerId: e.playerId!,
      username: e.username,
      brawlerId: e.brawlerId,
      level: e.level,
      isMe: e.isMe,
    }));
  sessionStorage.setItem("clash_party_battle_roster_v1", JSON.stringify(filtered));
}
