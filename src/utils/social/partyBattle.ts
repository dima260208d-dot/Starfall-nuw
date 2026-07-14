import { Bot } from "../../entities/Bot";
import { isHeadlessSim } from "../../ai/aiHeadlessContext";
import { BRAWLERS, getBrawlerById } from "../../entities/BrawlerData";
import {
  getBrawlerStars,
  getCurrentProfile,
  getCurrentUsername,
  recordGameResult,
  setCurrentUsername,
} from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import { getProfileByPlayerId } from "../playerGiftSend";
import { pinIdFor } from "../../entities/PinData";
import {
  getMyPartyRoom,
  getPartyPlayAgainMemberStatus,
  getPartyPlayAgainState,
  type PartyPlayAgainMemberStatus,
} from "./party";
import { trackFriendshipPartyBattle } from "./friendship";

export const PARTY_BATTLE_ROSTER_KEY = "clash_party_battle_roster_v1";

export interface PartyBattleRosterEntry {
  playerId: string;
  username: string;
  brawlerId: string;
  level: number;
  isMe: boolean;
}

export function buildPartyBattleRoster(): PartyBattleRosterEntry[] {
  const me = getCurrentProfile();
  const room = getMyPartyRoom();
  if (!me?.playerId) return [];

  const myId = normalizePlayerIdQuery(me.playerId);
  const roster: PartyBattleRosterEntry[] = [{
    playerId: myId,
    username: me.username,
    brawlerId: me.selectedBrawlerId || "hana",
    level: me.brawlerLevels?.[me.selectedBrawlerId || "hana"] || 1,
    isMe: true,
  }];

  if (!room) return roster;

  const add = (playerId: string, brawlerId: string) => {
    const id = normalizePlayerIdQuery(playerId);
    if (id === myId) return;
    const prof = getProfileByPlayerId(id);
    if (!prof) return;
    const bid = brawlerId || prof.selectedBrawlerId || "hana";
    roster.push({
      playerId: id,
      username: prof.username,
      brawlerId: bid,
      level: prof.brawlerLevels?.[bid] || 1,
      isMe: false,
    });
  };

  if (normalizePlayerIdQuery(room.leaderPlayerId) !== myId) {
    const leader = getProfileByPlayerId(room.leaderPlayerId);
    add(room.leaderPlayerId, leader?.selectedBrawlerId || "hana");
  }
  const slotOrder = ["left", "right", "back1_left", "back1_right", "back2_left", "back2_right"] as const;
  const sortedMembers = [...room.members].sort((a, b) => {
    const ia = slotOrder.indexOf(a.slot as typeof slotOrder[number]);
    const ib = slotOrder.indexOf(b.slot as typeof slotOrder[number]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  for (const m of sortedMembers) add(m.playerId, m.brawlerId);

  return roster;
}

export function stashPartyBattleRoster(): void {
  const roster = buildPartyBattleRoster();
  if (roster.length <= 1) {
    sessionStorage.removeItem(PARTY_BATTLE_ROSTER_KEY);
    return;
  }
  sessionStorage.setItem(PARTY_BATTLE_ROSTER_KEY, JSON.stringify(roster));
}

export function readPartyBattleRoster(): PartyBattleRosterEntry[] {
  try {
    const raw = sessionStorage.getItem(PARTY_BATTLE_ROSTER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PartyBattleRosterEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Состав команды для «Ещё раз»: кэш боя или актуальная команда из меню. */
export function resolvePlayAgainRoster(): PartyBattleRosterEntry[] {
  const cached = readPartyBattleRoster();
  if (cached.length > 1) return cached;
  const live = buildPartyBattleRoster();
  if (live.length > 1) {
    sessionStorage.setItem(PARTY_BATTLE_ROSTER_KEY, JSON.stringify(live));
    return live;
  }
  return cached.length > 0 ? cached : live;
}

export function clearPartyBattleRoster(): void {
  sessionStorage.removeItem(PARTY_BATTLE_ROSTER_KEY);
}

export interface PartyPlayAgainPanelMember {
  playerId: string;
  username: string;
  brawlerId: string;
  pinId: string;
  status: PartyPlayAgainMemberStatus;
  isMe: boolean;
}

/** Участники команды для панели «Ещё раз» (по составу прошлого боя). */
export function getPartyPlayAgainPanelMembers(
  roster: PartyBattleRosterEntry[] = resolvePlayAgainRoster(),
): PartyPlayAgainPanelMember[] {
  if (roster.length <= 1) return [];
  return roster.map(entry => ({
    playerId: entry.playerId,
    username: entry.username,
    brawlerId: entry.brawlerId,
    pinId: pinIdFor(entry.brawlerId, "default"),
    status: getPartyPlayAgainMemberStatus(entry.playerId),
    isMe: entry.isMe,
  }));
}

/** Сохранить в session только тех, кто проголосовал «Ещё раз». */
export function stashPartyPlayAgainRematchRoster(): void {
  const pa = getPartyPlayAgainState();
  const roster = readPartyBattleRoster();
  if (!pa?.finalized || roster.length <= 1) return;

  const ready = new Set(pa.readyIds.map(normalizePlayerIdQuery));
  const filtered = roster.filter(e => ready.has(normalizePlayerIdQuery(e.playerId)));
  sessionStorage.setItem(PARTY_BATTLE_ROSTER_KEY, JSON.stringify(filtered));
}

/** Бот-союзник с бойцом и именем из меню команды. */
export function createPartyAllyBot(
  entry: PartyBattleRosterEntry,
  x: number,
  y: number,
  teamId: string,
): Bot {
  const stats = getBrawlerById(entry.brawlerId) || BRAWLERS[0];
  const bot = new Bot(stats, entry.level, x, y, teamId);
  bot.setIdentity(entry.username, false);
  const prof = getProfileByPlayerId(entry.playerId);
  if (prof) {
    bot.constellationStars = getBrawlerStars(prof, entry.brawlerId);
  }
  return bot;
}

export function getClubBossRaidClubIdFromRoster(roster: PartyBattleRosterEntry[]): string | null {
  if (roster.length === 0) return null;
  const prof = getProfileByPlayerId(roster[0].playerId);
  return prof?.clubId ?? null;
}

export function isFullClubPartyForBossRaid(
  roster: PartyBattleRosterEntry[],
  clubId: string,
): boolean {
  if (roster.length <= 1) return false;
  for (const entry of roster) {
    const prof = getProfileByPlayerId(entry.playerId);
    if (!prof?.clubId || prof.clubId !== clubId) return false;
  }
  return true;
}

/** Союзники из команды (без текущего игрока), в порядке очереди. */
export function getPartyAllyEntries(): PartyBattleRosterEntry[] {
  if (isHeadlessSim()) return [];
  const me = getCurrentProfile();
  if (!me?.playerId) return [];
  const myId = normalizePlayerIdQuery(me.playerId);
  return readPartyBattleRoster().filter(e => !e.isMe && normalizePlayerIdQuery(e.playerId) !== myId);
}

function isPlayerPartyLeader(playerId: string): boolean {
  const room = getMyPartyRoom();
  if (!room || !playerId) return false;
  return normalizePlayerIdQuery(room.leaderPlayerId) === normalizePlayerIdQuery(playerId);
}

function recordGameResultForPlayerId(
  playerId: string,
  opts: Parameters<typeof recordGameResult>[0],
): void {
  const prof = getProfileByPlayerId(playerId);
  if (!prof?.username) return;
  const active = getCurrentUsername();
  setCurrentUsername(prof.username);
  try {
    recordGameResult({
      ...opts,
      brawlerId: opts.brawlerId,
      isPartyLeader: isPlayerPartyLeader(playerId),
    });
  } finally {
    setCurrentUsername(active);
  }
}

/** Общий исход боя для всех в команде; награды считаются по профилю каждого. */
export function applyPartySharedBattleResult(
  opts: Parameters<typeof recordGameResult>[0],
): ReturnType<typeof recordGameResult> {
  if (isHeadlessSim()) {
    return undefined as ReturnType<typeof recordGameResult>;
  }
  const roster = readPartyBattleRoster();
  const me = getCurrentProfile();
  const myId = me?.playerId ? normalizePlayerIdQuery(me.playerId) : "";
  const myEntry = roster.find(e => e.isMe || normalizePlayerIdQuery(e.playerId) === myId);
  const myBrawler = myEntry?.brawlerId ?? opts.brawlerId ?? me?.selectedBrawlerId;

  const result = recordGameResult({
    ...opts,
    brawlerId: myBrawler,
    isPartyLeader: myId ? isPlayerPartyLeader(myId) : false,
  });

  if (roster.length <= 1) {
    clearPartyBattleRoster();
    return result;
  }

  for (const entry of roster) {
    if (entry.isMe || normalizePlayerIdQuery(entry.playerId) === myId) continue;
    recordGameResultForPlayerId(entry.playerId, {
      ...opts,
      brawlerId: entry.brawlerId,
      killCount: 0,
      damageDealt: 0,
      healingDone: 0,
      superUses: 0,
      powerCubesCollected: 0,
      monsterKillTrophyBonus: 0,
    });
  }

  if (roster.length > 1) {
    trackFriendshipPartyBattle(!!opts.won, roster.map(e => e.playerId));
  }

  // Roster нужен на экране результата для «Ещё раз» — не очищаем здесь.
  return result;
}

export { getPartyRoomAllPlayerIds } from "./party";
