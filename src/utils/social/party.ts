import {
  getCurrentProfile,
  getCurrentUsername,
  updateProfile,
  getAllProfiles,
  saveProfiles,
  findProfileStorageKeyByPlayerId,
  normalizeProfile,
  type UserProfile,
} from "../localStorageAPI";
import { GAME_CHAT_MAX_MESSAGES, pruneChatByLimit } from "../chatLimits";
import { getProfileByPlayerId } from "../playerGiftSend";
import { getFriendRows, isFriend } from "./friends";
import { getBattleModeForPlayerId } from "./presence";
import {
  getPresenceForPlayerId,
  MENU_ACTIVITY_DEMO_CYCLE,
  type MenuActivityId,
} from "./presence";
import { getTestFriendSpec, isTestFriendPlayerId } from "./seedTestFriends";
import {
  getMaxPartySize,
  getPartyCount,
  memberSlotsForMaxParty,
  partyModeFromProfile,
  type PartyModeSelection,
  type PartySlotId,
} from "./partyConfig";
import { playAgainOnResultExit } from "./battleTeamPlayAgain";
import { isLeftPartySlot } from "./partyMenuFormation";
import {
  abortClubBossRaidRecruitment,
  findClubIdByBossRaidPartyCode,
} from "../clubs";
import { normalizePlayerIdQuery } from "../playerId";
import { getRemotePartyCodeForPlayer } from "../cloud/remotePresenceCache";
import {
  checkRankedPartyLeagueCompatibility,
  formatRankedPartyLeagueError,
  type RankedPartyLeagueCheck,
} from "../rankedPartyLeague";
import { translate } from "../../i18n/core";

export const PARTY_CHANGED_EVENT = "clash_party_changed";

export type PartySlot = PartySlotId;

export interface PartyMember {
  playerId: string;
  username: string;
  brawlerId: string;
  slot: PartySlot;
  joinedAt: number;
}

export interface PartyInviteIncoming {
  code: string;
  fromPlayerId: string;
  fromUsername: string;
  sentAt: number;
}

/** Заявка на вступление в команду (лидер принимает / отклоняет). */
export interface PartyJoinRequest {
  playerId: string;
  username: string;
  brawlerId: string;
  sentAt: number;
}

export const PARTY_JOIN_REQUEST_EVENT = "clash_party_join_request";

/** Предложение сменить бойца в команде (локально, одно на команду). */
export interface PartyBrawlerSuggestion {
  fromPlayerId: string;
  fromUsername: string;
  toPlayerId: string;
  toUsername: string;
  brawlerId: string;
  sentAt: number;
}

/** Очередь «Играть» — все должны нажать готов до старта боя. */
export interface PartyPlayReadyState {
  startedAt: number;
  deadlineAt: number;
  readyIds: string[];
}

/** Очередь «Ещё раз» на экране результата — голосование команды за рематч. */
export interface PartyPlayAgainState {
  startedAt: number;
  deadlineAt: number;
  readyIds: string[];
  declinedIds: string[];
  finalized: boolean;
  mode: string;
  /** Кто нажал «Выйти» — отменяет рематч для всей команды. */
  exitedBy?: string | null;
}

/** Предложение сменить режим (не лидер → лидер). */
export interface PartyModeSuggestion {
  fromPlayerId: string;
  fromUsername: string;
  modeId: string;
  sentAt: number;
}

export interface PartyRoom {
  code: string;
  leaderPlayerId: string;
  members: PartyMember[];
  createdAt: number;
  brawlerSuggestion?: PartyBrawlerSuggestion | null;
  modeSuggestion?: PartyModeSuggestion | null;
  playReady?: PartyPlayReadyState | null;
  playAgain?: PartyPlayAgainState | null;
  /** Подбор противников — синхронизация команды. */
  matchmaking?: PartyMatchmakingState | null;
  /** Командный чат (текст и пины). */
  chat?: PartyChatMessage[];
  /** Ожидающие заявки на вступление (лидер решает). */
  joinRequests?: PartyJoinRequest[];
  /** Режим лидера — для проверки вместимости у игроков без локального профиля лидера. */
  leaderModeSelection?: PartyModeSelection;
}

export type PartyMatchmakingStatus = "searching" | "complete" | "cancelled";

export interface PartyMatchmakingState {
  sessionId: string;
  startedAt: number;
  seed: number;
  totalPlayers: number;
  initialFound: number;
  foundPlayers: number;
  status: PartyMatchmakingStatus;
  leaderPlayerId: string;
  cancelledBy?: string | null;
}

export interface PartyChatMessage {
  id: string;
  sentAt: number;
  playerId: string;
  username: string;
  text?: string;
  pinId?: string;
  /** Synced menu / lobby voice line. */
  voiceBrawlerId?: string;
  voiceCategory?: string;
  voiceVariant?: 0 | 1;
  /** Предложение режима (картинка + текст в чате). */
  modeId?: string;
  modeSuggest?: boolean;
  /** Ответ ИИ Астрала (виден всем в чате команды). */
  astral?: boolean;
  /** Системное сообщение (модерация, уведомления). */
  system?: boolean;
}

export const PARTY_CHAT_MAX_TEXT = 120;
export const PARTY_CHAT_MAX_MESSAGES = GAME_CHAT_MAX_MESSAGES;

export interface OutgoingPartyInvite {
  targetPlayerId: string;
  targetUsername: string;
  sentAt: number;
  side: PartySlot;
}

export const PARTY_INVITE_DECLINED_EVENT = "clash_party_invite_declined";

const PARTIES_KEY = "clash_parties_v1";
/** Сколько ждём, пока все нажмут «Играть», прежде чем сбросить очередь. */
export const PARTY_PLAY_READY_TIMEOUT_MS = 60_000;
/** Голосование «Ещё раз» на экране результата. */
export const PARTY_PLAY_AGAIN_TIMEOUT_MS = 15_000;

function emitPartyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
  }
}

function readParties(): Record<string, PartyRoom> {
  try {
    const raw = localStorage.getItem(PARTIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeParties(all: Record<string, PartyRoom>) {
  const me = getCurrentProfile();
  const myId = me?.playerId ? normalizePlayerIdQuery(me.playerId) : "";
  const stamped: Record<string, PartyRoom> = {};
  for (const [code, room] of Object.entries(all)) {
    let r = room;
    if (myId && normalizePlayerIdQuery(r.leaderPlayerId) === myId && me) {
      r = { ...r, leaderModeSelection: partyModeFromProfile(me) };
    }
    stamped[code] = r;
  }
  localStorage.setItem(PARTIES_KEY, JSON.stringify(stamped));
  emitPartyChanged();
  if (typeof window !== "undefined") {
    void import("../cloud/partyServerBootstrap").then(({ onPartiesWritten }) => onPartiesWritten(stamped));
  }
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function syncProfilePartyCode(playerId: string, code: string | null) {
  const key = findProfileStorageKeyByPlayerId(playerId);
  if (!key) return;
  const all = getAllProfiles();
  const raw = all[key];
  if (!raw) return;
  all[key] = { ...raw, partyCode: code };
  saveProfiles(all);
}

function pushInviteToPlayer(targetPlayerId: string, invite: PartyInviteIncoming) {
  const key = findProfileStorageKeyByPlayerId(targetPlayerId);
  if (!key) return;
  const all = getAllProfiles();
  const raw = all[key];
  if (!raw) return;
  all[key] = { ...raw, partyInviteIncoming: invite };
  saveProfiles(all);
}

function clearInviteOnPlayer(playerId: string) {
  const key = findProfileStorageKeyByPlayerId(playerId);
  if (!key) return;
  const all = getAllProfiles();
  const raw = all[key];
  if (!raw) return;
  const { partyInviteIncoming: _, ...rest } = raw as any;
  all[key] = rest;
  saveProfiles(all);
}

export function getMyPartyCode(): string | null {
  const p = getCurrentProfile();
  return (p as any)?.partyCode ?? null;
}

export function getPartyRoom(code: string | null | undefined): PartyRoom | null {
  if (!code) return null;
  const all = readParties();
  return all[code.toUpperCase()] ?? null;
}

export function getMyPartyRoom(): PartyRoom | null {
  const code = getMyPartyCode();
  if (!code) return null;
  const room = getPartyRoom(code);
  if (!room) return null;
  const balanced = rebalancePartyMemberSlots(room);
  const slotsChanged = balanced.members.some((m, i) => m.slot !== room.members[i]?.slot);
  const chatOverLimit = (balanced.chat?.length ?? 0) > GAME_CHAT_MAX_MESSAGES;
  const next: PartyRoom = chatOverLimit
    ? { ...balanced, chat: pruneChatByLimit(balanced.chat ?? []) }
    : balanced;
  if (slotsChanged || chatOverLimit) {
    patchPartyRoom(code, () => next);
  }
  return next;
}

/** Слоты напарников: left → right → back1_left → … по порядку приглашений. */
export function rebalancePartyMemberSlots(room: PartyRoom): PartyRoom {
  const allowed = memberSlotsForMaxParty(maxMembersForRoom(room));
  const sorted = [...room.members].sort((a, b) => a.joinedAt - b.joinedAt);
  const members = sorted.map((m, i) => ({
    ...m,
    slot: allowed[i] ?? normalizePartySlot(m.slot),
  }));
  return { ...room, members };
}

export function getPartyForPlayer(playerId: string): PartyRoom | null {
  const key = findProfileStorageKeyByPlayerId(playerId);
  if (!key) return null;
  const raw = getAllProfiles()[key];
  const code = (raw as any)?.partyCode;
  return getPartyRoom(code);
}

export function amPartyLeader(): boolean {
  const me = getCurrentProfile();
  const room = getMyPartyRoom();
  if (!me?.playerId || !room) return false;
  return normalizePlayerIdQuery(room.leaderPlayerId) === normalizePlayerIdQuery(me.playerId);
}

export function getOutgoingInvites(): OutgoingPartyInvite[] {
  const p = getCurrentProfile();
  const multi = (p as { outgoingPartyInvites?: OutgoingPartyInvite[] })?.outgoingPartyInvites;
  if (multi?.length) return multi.map(x => ({ ...x, side: x.side ?? "left" }));
  const raw = (p as { outgoingPartyInvite?: OutgoingPartyInvite })?.outgoingPartyInvite;
  if (raw) return [{ ...raw, side: raw.side ?? "left" }];
  return [];
}

export function getOutgoingInvite(): OutgoingPartyInvite | null {
  return getOutgoingInvites()[0] ?? null;
}

export function getOutgoingInviteForSide(side: PartySlot): OutgoingPartyInvite | null {
  return getOutgoingInvites().find(i => i.side === side) ?? null;
}

export function getOutgoingInviteTo(targetPlayerId: string): OutgoingPartyInvite | null {
  const tid = normalizePlayerIdQuery(targetPlayerId);
  return getOutgoingInvites().find(i => normalizePlayerIdQuery(i.targetPlayerId) === tid) ?? null;
}

export function isInAnyParty(): boolean {
  return !!getMyPartyCode();
}

export function getIncomingInvite(): PartyInviteIncoming | null {
  const p = getCurrentProfile();
  return (p as any)?.partyInviteIncoming ?? null;
}

export function getOrCreateMyParty(): PartyRoom {
  return ensureMyParty();
}

function ensureMyParty(): PartyRoom {
  const me = getCurrentProfile();
  if (!me?.playerId) throw new Error("Не авторизован");
  const myId = normalizePlayerIdQuery(me.playerId);
  let room = getMyPartyRoom();
  if (room) return room;

  const all = readParties();
  let code = randomCode();
  while (all[code]) code = randomCode();

  room = {
    code,
    leaderPlayerId: myId,
    members: [],
    createdAt: Date.now(),
    leaderModeSelection: partyModeFromProfile(me),
  };
  all[code] = room;
  writeParties(all);
  updateProfile({ partyCode: code } as any);
  syncProfilePartyCode(myId, code);
  return room;
}

function normalizePartySlot(slot: string | undefined): PartySlot {
  if (slot === "left" || slot === "right") return slot;
  const allowed: PartySlot[] = ["back1_left", "back1_right", "back2_left", "back2_right"];
  if (allowed.includes(slot as PartySlot)) return slot as PartySlot;
  return "left";
}

function maxMembersForRoom(room: PartyRoom): number {
  if (room.leaderModeSelection) {
    return getMaxPartySize(room.leaderModeSelection);
  }
  const leader = getProfileByPlayerId(room.leaderPlayerId);
  if (leader) return getMaxPartySize(partyModeFromProfile(leader));
  return 3;
}

function roomIsFull(room: PartyRoom): boolean {
  return getPartyCount(room.members.length) >= maxMembersForRoom(room);
}

/** Команда заполнена по лимиту выбранного режима лидера. */
export function isPartyRoomAtCapacity(room: PartyRoom): boolean {
  return roomIsFull(room);
}

export function isOnlinePartyGroupJoinable(
  group: Pick<OnlinePartyGroup, "isFull" | "currentSize" | "maxSize" | "hasMyPendingRequest">,
  inMyParty: boolean,
  inAnotherTeam = false,
): boolean {
  if (inMyParty || group.hasMyPendingRequest || inAnotherTeam) return false;
  if (group.isFull) return false;
  return group.currentSize < group.maxSize;
}

function nextFreeSlot(room: PartyRoom, _preferred?: PartySlot): PartySlot | null {
  const allowed = memberSlotsForMaxParty(maxMembersForRoom(room));
  const used = new Set(room.members.map(m => normalizePartySlot(m.slot)));
  for (const s of allowed) {
    if (!used.has(s)) return s;
  }
  return null;
}

export function getPartyMemberCount(): number {
  const room = getMyPartyRoom();
  return getPartyCount(room?.members.length ?? 0);
}

export function getPartyRoomAllPlayerIds(room: PartyRoom): string[] {
  const ids = [normalizePlayerIdQuery(room.leaderPlayerId)];
  for (const m of room.members) ids.push(normalizePlayerIdQuery(m.playerId));
  return ids;
}

/** Ранговый бой в команде: разница лиг между любыми двумя игроками ≤ 1. */
export function checkMyPartyRankedLeague(): RankedPartyLeagueCheck {
  const room = getMyPartyRoom();
  if (!room || room.members.length === 0) return { ok: true };
  return checkRankedPartyLeagueCompatibility(getPartyRoomAllPlayerIds(room));
}

function rankedPartyLeagueError(check: RankedPartyLeagueCheck): string {
  return formatRankedPartyLeagueError(check, (key, params) => translate(key, params));
}

export function getPartyPlayReadyState(): PartyPlayReadyState | null {
  const room = getMyPartyRoom();
  const pr = room?.playReady;
  if (!pr?.readyIds?.length) return null;
  return pr;
}

export function isPartyPlayReadyActive(): boolean {
  return getPartyPlayReadyState() !== null;
}

export function isPartyMemberPlayReady(playerId: string): boolean {
  const pr = getPartyPlayReadyState();
  if (!pr) return false;
  return pr.readyIds.includes(normalizePlayerIdQuery(playerId));
}

export function amIPartyPlayReady(): boolean {
  const me = getCurrentProfile();
  if (!me?.playerId) return false;
  return isPartyMemberPlayReady(me.playerId);
}

export function allPartyMembersPlayReady(room: PartyRoom): boolean {
  const pr = room.playReady;
  if (!pr?.readyIds.length) return false;
  const need = getPartyRoomAllPlayerIds(room);
  return need.every(id => pr.readyIds.includes(id));
}

function clearPartyPlayReadyOnRoom(room: PartyRoom): PartyRoom {
  return { ...room, playReady: null };
}

export function clearPartyPlayReady(): void {
  const code = getMyPartyCode();
  if (!code) return;
  patchPartyRoom(code, clearPartyPlayReadyOnRoom);
}

/** Сброс очереди по таймауту. Возвращает true, если очередь была сброшена. */
export function tickPartyPlayReadyExpired(): boolean {
  const room = getMyPartyRoom();
  const pr = room?.playReady;
  if (!pr) return false;
  if (Date.now() < pr.deadlineAt) return false;
  clearPartyPlayReady();
  return true;
}

function scheduleTestFriendsPartyPlayReady(code: string): void {
  const room = getPartyRoom(code);
  if (!room?.playReady) return;
  for (const id of getPartyRoomAllPlayerIds(room)) {
    if (!isTestFriendPlayerId(id)) continue;
    const spec = getTestFriendSpec(id);
    if (!spec) continue;
    if (room.playReady.readyIds.includes(id)) continue;
    if (spec.presence !== "menu" && !spec.autoAcceptParty) continue;
    const delay = 500 + Math.floor(Math.random() * 1200);
    window.setTimeout(() => {
      const current = getPartyRoom(code);
      if (!current?.playReady) return;
      if (current.playReady.readyIds.includes(id)) return;
      patchPartyRoom(code, r => {
        if (!r.playReady || r.playReady.readyIds.includes(id)) return r;
        return {
          ...r,
          playReady: { ...r.playReady, readyIds: [...r.playReady.readyIds, id] },
        };
      });
    }, delay);
  }
}

/** Нажатие «Играть» в команде — отметить себя готовым. */
export function pressPartyPlayReady(): boolean {
  const me = getCurrentProfile();
  const code = getMyPartyCode();
  if (!me?.playerId || !code) return false;
  const myId = normalizePlayerIdQuery(me.playerId);

  patchPartyRoom(code, r => {
    const now = Date.now();
    let pr = r.playReady;
    if (!pr) {
      pr = {
        startedAt: now,
        deadlineAt: now + PARTY_PLAY_READY_TIMEOUT_MS,
        readyIds: [myId],
      };
    } else if (!pr.readyIds.includes(myId)) {
      pr = { ...pr, readyIds: [...pr.readyIds, myId] };
    }
    return { ...r, playReady: pr };
  });

  scheduleTestFriendsPartyPlayReady(code);
  const room = getMyPartyRoom();
  return !!room && allPartyMembersPlayReady(room);
}

/** Отмена своей готовности (кнопка «Отмена»). */
export function cancelMyPartyPlayReady(): void {
  const me = getCurrentProfile();
  const code = getMyPartyCode();
  if (!me?.playerId || !code) return;
  const myId = normalizePlayerIdQuery(me.playerId);
  patchPartyRoom(code, r => {
    if (!r.playReady) return r;
    const readyIds = r.playReady.readyIds.filter(id => id !== myId);
    if (readyIds.length === 0) return clearPartyPlayReadyOnRoom(r);
    return { ...r, playReady: { ...r.playReady, readyIds } };
  });
}

function uidMatchmaking(): string {
  return `mm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Лидер команды начинает сессию подбора (синхронизация для всех участников). */
export function beginPartyMatchmaking(totalPlayers: number, initialFound: number): PartyMatchmakingState | null {
  const me = getCurrentProfile();
  const code = getMyPartyCode();
  if (!me?.playerId || !code) return null;
  if (!amPartyLeader()) return getPartyMatchmaking();

  const now = Date.now();
  const state: PartyMatchmakingState = {
    sessionId: uidMatchmaking(),
    startedAt: now,
    seed: (now ^ Math.floor(Math.random() * 1e9)) >>> 0,
    totalPlayers,
    initialFound,
    foundPlayers: initialFound,
    status: "searching",
    leaderPlayerId: normalizePlayerIdQuery(me.playerId),
  };

  patchPartyRoom(code, r => ({ ...r, matchmaking: state }));
  return state;
}

export function getPartyMatchmaking(): PartyMatchmakingState | null {
  const room = getMyPartyRoom();
  return room?.matchmaking ?? null;
}

export function amIMatchmakingLeader(): boolean {
  const me = getCurrentProfile();
  const mm = getPartyMatchmaking();
  if (!me?.playerId || !mm) return true;
  return normalizePlayerIdQuery(me.playerId) === normalizePlayerIdQuery(mm.leaderPlayerId);
}

export function syncPartyMatchmakingFound(foundPlayers: number): void {
  const code = getMyPartyCode();
  if (!code || !amIMatchmakingLeader()) return;
  patchPartyRoom(code, r => {
    const mm = r.matchmaking;
    if (!mm || mm.status !== "searching") return r;
    return {
      ...r,
      matchmaking: {
        ...mm,
        foundPlayers: Math.min(mm.totalPlayers, Math.max(mm.initialFound, foundPlayers)),
      },
    };
  });
}

export function completePartyMatchmaking(): void {
  const code = getMyPartyCode();
  if (!code || !amIMatchmakingLeader()) return;
  patchPartyRoom(code, r => {
    const mm = r.matchmaking;
    if (!mm || mm.status !== "searching") return r;
    return {
      ...r,
      matchmaking: {
        ...mm,
        foundPlayers: mm.totalPlayers,
        status: "complete",
      },
    };
  });
}

/** Отмена подбора — любой участник команды; выходит вся команда. */
export function cancelPartyMatchmaking(): void {
  const me = getCurrentProfile();
  const code = getMyPartyCode();
  if (!code) return;
  const myId = me?.playerId ? normalizePlayerIdQuery(me.playerId) : null;
  patchPartyRoom(code, r => {
    const mm = r.matchmaking;
    if (!mm || mm.status !== "searching") return r;
    return {
      ...r,
      matchmaking: {
        ...mm,
        status: "cancelled",
        cancelledBy: myId,
      },
    };
  });
  clearPartyPlayReady();
}

export function clearPartyMatchmaking(): void {
  const code = getMyPartyCode();
  if (!code) return;
  patchPartyRoom(code, r => ({ ...r, matchmaking: null }));
}

// ── «Ещё раз» на экране результата (команда из меню) ───────────────────────

function clearPartyPlayAgainOnRoom(room: PartyRoom): PartyRoom {
  return { ...room, playAgain: null };
}

export function clearPartyPlayAgain(): void {
  const code = getMyPartyCode();
  if (!code) return;
  patchPartyRoom(code, clearPartyPlayAgainOnRoom);
}

export function getPartyPlayAgainState(): PartyPlayAgainState | null {
  return getMyPartyRoom()?.playAgain ?? null;
}

export function isPartyPlayAgainActive(): boolean {
  const pa = getPartyPlayAgainState();
  return !!pa && !pa.finalized;
}

export function amIPartyPlayAgainReady(): boolean {
  const me = getCurrentProfile();
  const pa = getPartyPlayAgainState();
  if (!me?.playerId || !pa) return false;
  return pa.readyIds.includes(normalizePlayerIdQuery(me.playerId));
}

export function getPartyPlayAgainSecondsLeft(): number {
  const pa = getPartyPlayAgainState();
  if (!pa || pa.finalized) return 0;
  return Math.max(0, Math.ceil((pa.deadlineAt - Date.now()) / 1000));
}

export type PartyPlayAgainMemberStatus = "pending" | "ready" | "declined";

export function getPartyPlayAgainMemberStatus(playerId: string): PartyPlayAgainMemberStatus {
  const pa = getPartyPlayAgainState();
  const id = normalizePlayerIdQuery(playerId);
  if (!pa) return "pending";
  if (pa.declinedIds.includes(id)) return "declined";
  if (pa.readyIds.includes(id)) return "ready";
  if (pa.finalized) return "declined";
  return "pending";
}

/** Нажатие «Ещё раз» — запускает 15с таймер для всей команды. */
export function pressPartyPlayAgain(mode: string): void {
  const me = getCurrentProfile();
  const code = getMyPartyCode();
  if (!me?.playerId || !code) return;
  const myId = normalizePlayerIdQuery(me.playerId);
  const now = Date.now();

  patchPartyRoom(code, r => {
    let pa = r.playAgain;
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
    return { ...r, playAgain: pa };
  });

  scheduleTestFriendsPartyPlayAgain(code);
}

function scheduleTestFriendsPartyPlayAgain(code: string): void {
  const room = getPartyRoom(code);
  const pa = room?.playAgain;
  if (!pa || pa.finalized) return;
  for (const id of getPartyRoomAllPlayerIds(room)) {
    if (!isTestFriendPlayerId(id)) continue;
    if (pa.readyIds.includes(id) || pa.declinedIds.includes(id)) continue;
    const delay = 800 + Math.floor(Math.random() * 4000);
    window.setTimeout(() => {
      const current = getPartyRoom(code);
      const cur = current?.playAgain;
      if (!cur || cur.finalized) return;
      if (cur.readyIds.includes(id)) return;
      patchPartyRoom(code, r => {
        if (!r.playAgain || r.playAgain.finalized || r.playAgain.readyIds.includes(id)) return r;
        return {
          ...r,
          playAgain: { ...r.playAgain, readyIds: [...r.playAgain.readyIds, id] },
        };
      });
    }, delay);
  }
}

/** Кто-то нажал «Выйти» — у всей команды крестик, рематч отменён. */
export function partyPlayAgainOnResultExit(): void {
  const me = getCurrentProfile();
  const code = getMyPartyCode();
  const room = getMyPartyRoom();
  if (!me?.playerId || !code || !room) return;
  const myId = normalizePlayerIdQuery(me.playerId);
  const allIds = getPartyRoomAllPlayerIds(room);

  patchPartyRoom(code, r => {
    const pa = r.playAgain;
    if (pa?.finalized) return r;
    if (!pa) {
      return {
        ...r,
        playAgain: {
          startedAt: Date.now(),
          deadlineAt: Date.now(),
          readyIds: [],
          declinedIds: allIds,
          finalized: true,
          exitedBy: myId,
          mode: "",
        },
      };
    }
    return {
      ...r,
      playAgain: {
        ...pa,
        declinedIds: [...new Set([...pa.declinedIds, ...allIds])],
        finalized: true,
        exitedBy: myId,
      },
    };
  });
}

function abortPartyPlayAgainForAllOnRoom(room: PartyRoom): PartyRoom {
  const pa = room.playAgain;
  if (!pa || pa.finalized) return room;
  const allIds = getPartyRoomAllPlayerIds(room);
  return {
    ...room,
    playAgain: {
      ...pa,
      declinedIds: [...new Set([...pa.declinedIds, ...allIds])],
      finalized: true,
    },
  };
}

/** Таймер истёк — кто не нажал, получает крестик. */
export function tickPartyPlayAgainExpired(): boolean {
  const code = getMyPartyCode();
  const room = getMyPartyRoom();
  const pa = room?.playAgain;
  if (!pa || pa.finalized) return false;
  if (Date.now() < pa.deadlineAt) return false;

  const allIds = getPartyRoomAllPlayerIds(room!);
  const pending = allIds.filter(id => !pa.readyIds.includes(id) && !pa.declinedIds.includes(id));
  patchPartyRoom(code!, r => ({
    ...r,
    playAgain: {
      ...pa,
      declinedIds: [...new Set([...pa.declinedIds, ...pending])],
      finalized: true,
    },
  }));
  return true;
}

export function shouldRematchAfterPartyPlayAgain(): boolean {
  const me = getCurrentProfile();
  const pa = getPartyPlayAgainState();
  if (!me?.playerId || !pa?.finalized || pa.exitedBy) return false;
  const myId = normalizePlayerIdQuery(me.playerId);
  return pa.readyIds.includes(myId) && !pa.declinedIds.includes(myId);
}

export function shouldExitAfterPartyPlayAgain(): boolean {
  const pa = getPartyPlayAgainState();
  if (!pa?.finalized) return false;
  return !shouldRematchAfterPartyPlayAgain();
}

export function getMaxPartySizeForMenu(): number {
  const me = getCurrentProfile();
  const room = getMyPartyRoom();
  if (room) {
    const leader = getProfileByPlayerId(room.leaderPlayerId);
    return getMaxPartySize(partyModeFromProfile(leader ?? me));
  }
  return getMaxPartySize(partyModeFromProfile(me));
}

function emitPartyInviteDeclined(username: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PARTY_INVITE_DECLINED_EVENT, { detail: { username } }));
  }
}

function scheduleTestFriendPartyResponse(
  targetId: string,
  _targetUsername: string,
  invite: PartyInviteIncoming,
  _leaderPlayerId: string,
) {
  if (!isTestFriendPlayerId(targetId)) return;
  const spec = getTestFriendSpec(targetId);
  if (!spec) return;

  const shouldAccept = spec.autoAcceptParty || spec.presence === "menu";
  if (!shouldAccept) return;

  window.setTimeout(() => {
    const still = getProfileByPlayerId(targetId) as UserProfile | null;
    if (!still || (still as any).partyCode) return;
    const incoming = (still as any).partyInviteIncoming as PartyInviteIncoming | undefined;
    if (!incoming || incoming.code !== invite.code) return;
    acceptPartyInviteForPlayer(targetId, invite);
  }, 800);
}

export function inviteFriendToParty(
  targetPlayerId: string,
  fromSide: PartySlot,
): { success: boolean; error?: string } {
  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: "Не авторизован" };

  const targetId = normalizePlayerIdQuery(targetPlayerId);
  if (!isFriend(targetId)) {
    return { success: false, error: "Можно приглашать только друзей" };
  }

  const target = getProfileByPlayerId(targetId);
  if (!target) return { success: false, error: "Игрок не найден" };

  if ((target as any).partyCode || getRemotePartyCodeForPlayer(targetId)) {
    return { success: false, error: "Игрок уже в команде" };
  }

  const room = ensureMyParty();
  if (roomIsFull(room)) {
    return { success: false, error: "Команда заполнена" };
  }
  const slot = nextFreeSlot(room);
  if (!slot) {
    return { success: false, error: "Нет свободных мест в команде" };
  }

  const myId = normalizePlayerIdQuery(me.playerId);
  if (room.members.some(m => normalizePlayerIdQuery(m.playerId) === targetId)) {
    return { success: false, error: "Игрок уже в вашей команде" };
  }

  const invite: PartyInviteIncoming = {
    code: room.code,
    fromPlayerId: myId,
    fromUsername: me.username,
    sentAt: Date.now(),
  };
  pushInviteToPlayer(targetId, invite);
  if (typeof window !== "undefined") {
    void import("../cloud/presenceServerSync").then(({ isOnlinePresenceSyncEnabled, pushPartyInviteToServer }) => {
      if (!isOnlinePresenceSyncEnabled()) return;
      void pushPartyInviteToServer({
        toPlayerId: targetId,
        fromPlayerId: myId,
        fromUsername: me.username,
        code: room.code,
        sentAt: invite.sentAt,
      });
    });
  }
  const existing = getOutgoingInvites();
  const filtered = existing.filter(i => normalizePlayerIdQuery(i.targetPlayerId) !== targetId);
  updateProfile({
    outgoingPartyInvites: [
      ...filtered,
      {
        targetPlayerId: targetId,
        targetUsername: target.username,
        sentAt: Date.now(),
        side: fromSide,
      },
    ],
    outgoingPartyInvite: undefined,
  } as any);
  emitPartyChanged();

  scheduleTestFriendPartyResponse(targetId, target.username, invite, myId);

  return { success: true };
}

/** Принять приглашение от имени другого профиля (тест-боты). */
export function acceptPartyInviteForPlayer(
  playerId: string,
  invite: PartyInviteIncoming,
): { success: boolean; error?: string } {
  const key = findProfileStorageKeyByPlayerId(playerId);
  if (!key) return { success: false, error: "Игрок не найден" };

  const all = getAllProfiles();
  const raw = all[key];
  if (!raw) return { success: false, error: "Профиль не найден" };
  if ((raw as any).partyCode) return { success: false, error: "Уже в команде" };

  const room = getPartyRoom(invite.code);
  if (!room) return { success: false, error: "Команда не найдена" };
  if (roomIsFull(room)) return { success: false, error: "Команда заполнена" };

  const prof = normalizeProfile(raw as UserProfile);
  const myId = normalizePlayerIdQuery(playerId);
  const leaderProf = getProfileByPlayerId(room.leaderPlayerId);
  const out = leaderProf ? (leaderProf as any).outgoingPartyInvite as OutgoingPartyInvite | undefined : undefined;
  const slot = nextFreeSlot(room) ?? "left";
  const member: PartyMember = {
    playerId: myId,
    username: prof.username,
    brawlerId: prof.selectedBrawlerId || "hana",
    slot,
    joinedAt: Date.now(),
  };
  if (!addMemberToRoom(room, member)) {
    return { success: false, error: "Нет мест" };
  }

  all[key] = {
    ...raw,
    partyCode: room.code,
    partyInviteIncoming: undefined,
  };
  saveProfiles(all);
  syncProfilePartyCode(myId, room.code);
  clearOutgoingOnLeader(room.leaderPlayerId);
  emitPartyChanged();
  return { success: true };
}

function addMemberToRoom(room: PartyRoom, member: PartyMember) {
  const all = readParties();
  const slot = nextFreeSlot(room);
  if (!slot) return false;
  const updated = rebalancePartyMemberSlots({
    ...room,
    members: [...room.members, { ...member, slot, joinedAt: member.joinedAt || Date.now() }],
  });
  all[room.code] = updated;
  writeParties(all);
  if (roomIsFull(updated)) {
    purgeOverflowPartyInvites(updated);
  }
  if (isTestFriendPlayerId(member.playerId) && !isTestFriendPlayerId(updated.leaderPlayerId)) {
    scheduleTestBotModeSuggestAfterJoin(updated.code, member.playerId);
  }
  return true;
}

export function acceptPartyInvite(): { success: boolean; error?: string } {
  const me = getCurrentProfile();
  const inv = getIncomingInvite();
  if (!me?.playerId || !inv) return { success: false, error: "Нет приглашения" };

  if ((me as any).partyCode) {
    clearIncomingInvite();
    return { success: false, error: "Вы уже в команде" };
  }

  return acceptPartyInviteInternal(inv);
}

async function ensurePartyRoomAvailable(code: string): Promise<PartyRoom | null> {
  let room = getPartyRoom(code);
  if (room) return room;

  const { isOnlinePartySyncEnabled, hydratePartyFromServer, wakePartyServer } = await import("../cloud/partyServerSync");
  if (!isOnlinePartySyncEnabled()) return null;

  await wakePartyServer(45_000);
  for (let i = 0; i < 3; i++) {
    if (await hydratePartyFromServer(code)) {
      room = getPartyRoom(code);
      if (room) return room;
    }
    if (i < 2) await new Promise((r) => setTimeout(r, 1200));
  }
  return null;
}

function acceptPartyInviteInternal(inv: PartyInviteIncoming): { success: boolean; error?: string } {
  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: "Не авторизован" };

  const room = getPartyRoom(inv.code);
  if (!room) {
    void ensurePartyRoomAvailable(inv.code).then((hydrated) => {
      if (hydrated) {
        acceptPartyInviteInternal(inv);
        emitPartyChanged();
      }
    });
    return { success: false, error: "Загрузка команды с сервера…" };
  }
  if (roomIsFull(room)) {
    clearIncomingInvite();
    return { success: false, error: "Команда заполнена" };
  }

  const myId = normalizePlayerIdQuery(me.playerId);
  const slot = nextFreeSlot(room) ?? "left";
  const member: PartyMember = {
    playerId: myId,
    username: me.username,
    brawlerId: me.selectedBrawlerId || "hana",
    slot,
    joinedAt: Date.now(),
  };
  if (!addMemberToRoom(room, member)) {
    clearIncomingInvite();
    return { success: false, error: "Нет свободных мест" };
  }

  updateProfile({ partyCode: room.code, partyInviteIncoming: undefined, outgoingPartyInvite: undefined } as any);
  syncProfilePartyCode(myId, room.code);
  clearIncomingInvite();
  clearOutgoingOnLeader(room.leaderPlayerId);
  emitPartyChanged();
  return { success: true };
}

function setOutgoingInvitesOnPlayer(playerId: string, invites: OutgoingPartyInvite[]): void {
  const key = findProfileStorageKeyByPlayerId(playerId);
  if (!key) return;
  const all = getAllProfiles();
  const raw = all[key];
  if (!raw) return;
  all[key] = { ...raw, outgoingPartyInvites: invites, outgoingPartyInvite: undefined };
  saveProfiles(all);
}

function purgeOverflowPartyInvites(room: PartyRoom): void {
  if (!roomIsFull(room)) return;
  const leaderId = normalizePlayerIdQuery(room.leaderPlayerId);
  const leaderProf = getProfileByPlayerId(leaderId);
  const invites = (() => {
    const multi = (leaderProf as { outgoingPartyInvites?: OutgoingPartyInvite[] })?.outgoingPartyInvites;
    if (multi?.length) return multi;
    const single = (leaderProf as { outgoingPartyInvite?: OutgoingPartyInvite })?.outgoingPartyInvite;
    return single ? [single] : [];
  })();
  for (const inv of invites) {
    clearInviteOnPlayer(inv.targetPlayerId);
  }
  setOutgoingInvitesOnPlayer(leaderId, []);
  patchPartyRoom(room.code, r => ({
    ...r,
    joinRequests: [],
  }));
  emitPartyChanged();
}

function clearIncomingInvite() {
  const inv = getIncomingInvite();
  updateProfile({ partyInviteIncoming: undefined } as any);
  const me = getCurrentProfile();
  if (me?.playerId) clearInviteOnPlayer(me.playerId);
  if (inv?.code && typeof window !== "undefined") {
    void import("../cloud/presenceServerBootstrap").then(({ clearRemotePartyInvite }) => {
      void clearRemotePartyInvite(inv.code);
    });
  }
}

export function declinePartyInvite(): void {
  clearIncomingInvite();
  emitPartyChanged();
}

export function declinePartyInviteForPlayer(playerId: string): void {
  clearInviteOnPlayer(playerId);
  emitPartyChanged();
}

export function cancelOutgoingInviteForTarget(targetPlayerId: string): void {
  const tid = normalizePlayerIdQuery(targetPlayerId);
  clearInviteOnPlayer(tid);
  const me = getCurrentProfile();
  if (!me?.playerId) return;
  const remaining = getOutgoingInvites().filter(
    i => normalizePlayerIdQuery(i.targetPlayerId) !== tid,
  );
  updateProfile({ outgoingPartyInvites: remaining, outgoingPartyInvite: undefined } as any);
  emitPartyChanged();
}

export function cancelOutgoingInvite(): void {
  const invites = getOutgoingInvites();
  if (!invites.length) return;
  for (const inv of invites) {
    clearInviteOnPlayer(inv.targetPlayerId);
  }
  updateProfile({ outgoingPartyInvites: [], outgoingPartyInvite: undefined } as any);
  emitPartyChanged();
}

function clearOutgoingOnLeader(leaderPlayerId?: string) {
  const lid = leaderPlayerId ? normalizePlayerIdQuery(leaderPlayerId) : getCurrentProfile()?.playerId;
  if (!lid) return;
  setOutgoingInvitesOnPlayer(lid, []);
  const me = getCurrentProfile();
  if (me?.playerId && normalizePlayerIdQuery(me.playerId) === lid) {
    updateProfile({ outgoingPartyInvites: [], outgoingPartyInvite: undefined } as any);
  }
}

export async function joinPartyByCode(codeInput: string): Promise<{ success: boolean; error?: string }> {
  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: "Не авторизован" };

  const code = codeInput.trim().toUpperCase();
  if (code.length < 4) return { success: false, error: "Введите код команды" };

  const { isOnlinePartySyncEnabled, hydratePartyFromServer, wakePartyServer } = await import("../cloud/partyServerSync");
  if (isOnlinePartySyncEnabled()) {
    const awake = await wakePartyServer(45_000);
    if (!awake) {
      return { success: false, error: "Сервер команд не отвечает. Подождите минуту и попробуйте снова." };
    }
    let hydrated = false;
    for (let i = 0; i < 3; i++) {
      if (await hydratePartyFromServer(code)) {
        hydrated = true;
        break;
      }
      if (i < 2) await new Promise((r) => setTimeout(r, 1500));
    }
    if (!hydrated) {
      return { success: false, error: "Команда не найдена на сервере. Попросите лидера пересоздать команду." };
    }
  }

  if ((me as any).partyCode) {
    return { success: false, error: "Сначала выйдите из текущей команды" };
  }

  const room = getPartyRoom(code);
  if (!room) return { success: false, error: "Команда не найдена" };
  if (roomIsFull(room)) return { success: false, error: "Команда заполнена" };

  const myId = normalizePlayerIdQuery(me.playerId);
  if (normalizePlayerIdQuery(room.leaderPlayerId) === myId) {
    return { success: false, error: "Вы уже лидер этой команды" };
  }

  const member: PartyMember = {
    playerId: myId,
    username: me.username,
    brawlerId: me.selectedBrawlerId || "hana",
    slot: "left",
    joinedAt: Date.now(),
  };
  if (!addMemberToRoom(room, member)) {
    return { success: false, error: "Нет свободных мест" };
  }

  updateProfile({ partyCode: room.code, partyInviteIncoming: undefined } as any);
  syncProfilePartyCode(myId, room.code);
  emitPartyChanged();
  void import("../../audio/partyVoice").then(({ playExistingPartyMemberLines }) => {
    playExistingPartyMemberLines(room, myId);
  });
  return { success: true };
}

function disbandPartyRoom(room: PartyRoom): void {
  const all = readParties();
  const clearProfileParty = (playerId: string) => {
    syncProfilePartyCode(playerId, null);
    const k = findProfileStorageKeyByPlayerId(playerId);
    if (!k) return;
    const profiles = getAllProfiles();
    const r = profiles[k];
    if (!r) return;
    profiles[k] = { ...r, partyCode: null, outgoingPartyInvite: undefined };
    saveProfiles(profiles);
  };

  for (const m of room.members) clearProfileParty(m.playerId);
  clearProfileParty(room.leaderPlayerId);
  delete all[room.code];
  writeParties(all);
}

export function leaveParty(): void {
  const me = getCurrentProfile();
  if (!me?.playerId) return;
  const myId = normalizePlayerIdQuery(me.playerId);
  const code = (me as any).partyCode;
  const room = getPartyRoom(code);
  const clubRaidClubId = findClubIdByBossRaidPartyCode(code);
  const isLeader = room ? normalizePlayerIdQuery(room.leaderPlayerId) === myId : false;

  if (room && clubRaidClubId && !isLeader) {
    disbandPartyRoom(room);
    abortClubBossRaidRecruitment(clubRaidClubId);
    updateProfile({
      partyCode: null,
      outgoingPartyInvite: undefined,
      partyInviteIncoming: undefined,
    } as any);
    syncProfilePartyCode(myId, null);
    playAgainOnResultExit();
    emitPartyChanged();
    return;
  }

  if (room) {
    const all = readParties();
    const isLeader = normalizePlayerIdQuery(room.leaderPlayerId) === myId;
    if (isLeader && room.members.length > 0 && !clubRaidClubId) {
      const sorted = [...room.members].sort((a, b) => a.joinedAt - b.joinedAt);
      const promoted = sorted[0]!;
      const newLeaderId = normalizePlayerIdQuery(promoted.playerId);
      const remaining = sorted.slice(1);
      const updated: PartyRoom = rebalancePartyMemberSlots({
        ...clearPartyPlayReadyOnRoom(room),
        leaderPlayerId: newLeaderId,
        members: remaining,
        brawlerSuggestion: null,
        playAgain: null,
        joinRequests: room.joinRequests ?? [],
      });
      all[room.code] = updated;
      writeParties(all);
    } else if (isLeader) {
      for (const m of room.members) {
        syncProfilePartyCode(m.playerId, null);
        const k = findProfileStorageKeyByPlayerId(m.playerId);
        if (k) {
          const profiles = getAllProfiles();
          const r = profiles[k];
          if (r) {
            profiles[k] = { ...r, partyCode: null, outgoingPartyInvite: undefined };
          }
          saveProfiles(profiles);
        }
      }
      delete all[room.code];
      writeParties(all);
    } else {
      room.members = room.members.filter(
        m => normalizePlayerIdQuery(m.playerId) !== myId,
      );
      all[room.code] = abortPartyPlayAgainForAllOnRoom(clearPartyPlayReadyOnRoom(room));
      writeParties(all);
    }
  }

  updateProfile({
    partyCode: null,
    outgoingPartyInvite: undefined,
    partyInviteIncoming: undefined,
  } as any);
  syncProfilePartyCode(myId, null);
  playAgainOnResultExit();
  if (clubRaidClubId) abortClubBossRaidRecruitment(clubRaidClubId);
  emitPartyChanged();
}

export interface PartyTeammateView {
  playerId: string;
  username: string;
  brawlerId: string;
  slot: PartySlot;
}

export function getTeammatesForMenu(): PartyTeammateView[] {
  const me = getCurrentProfile();
  const room = getMyPartyRoom();
  if (!me?.playerId || !room) return [];
  const myId = normalizePlayerIdQuery(me.playerId);
  const isLeader = normalizePlayerIdQuery(room.leaderPlayerId) === myId;

  if (isLeader) {
    return room.members.map(m => ({
      playerId: m.playerId,
      username: m.username,
      brawlerId: m.brawlerId,
      slot: m.slot,
    }));
  }

  const out: PartyTeammateView[] = [];
  const leader = getProfileByPlayerId(room.leaderPlayerId);
  const myMember = room.members.find(m => normalizePlayerIdQuery(m.playerId) === myId);
  if (leader) {
    const leaderSlot: PartySlot = myMember && isLeftPartySlot(myMember.slot) ? "right" : "left";
    out.push({
      playerId: room.leaderPlayerId,
      username: leader.username,
      brawlerId: leader.selectedBrawlerId || "hana",
      slot: leaderSlot,
    });
  }
  for (const m of room.members) {
    if (normalizePlayerIdQuery(m.playerId) === myId) continue;
    out.push({
      playerId: m.playerId,
      username: m.username,
      brawlerId: m.brawlerId,
      slot: m.slot,
    });
  }
  return out;
}

export function syncMyPartyBrawler(brawlerId: string) {
  const me = getCurrentProfile();
  if (!me?.playerId) return;
  const myId = normalizePlayerIdQuery(me.playerId);
  const room = getMyPartyRoom();
  if (!room) return;

  const all = readParties();
  const isLeader = normalizePlayerIdQuery(room.leaderPlayerId) === myId;
  if (isLeader) {
    return;
  }
  const idx = room.members.findIndex(m => normalizePlayerIdQuery(m.playerId) === myId);
  if (idx >= 0) {
    room.members[idx] = { ...room.members[idx], brawlerId };
    all[room.code] = room;
    writeParties(all);
  }
}

export interface PartyFriendRow {
  playerId: string;
  username: string;
  brawlerId: string;
  profileIconId?: string;
  trophies: number;
  statusText: string;
  screen: import("./presence").PresenceScreen;
  online: boolean;
  inMyParty: boolean;
  battleMode?: string | null;
}

/** Друг уже в вашей команде (тот же код / слот в party room). */
export function isFriendInMyParty(friendPlayerId: string): boolean {
  const me = getCurrentProfile();
  if (!me?.playerId) return false;
  const code = getMyPartyCode();
  if (!code) return false;

  const fid = normalizePlayerIdQuery(friendPlayerId);
  const myId = normalizePlayerIdQuery(me.playerId);
  if (fid === myId) return false;

  const room = getMyPartyRoom();
  if (room?.members.some(m => normalizePlayerIdQuery(m.playerId) === fid)) {
    return true;
  }

  const friend = getProfileByPlayerId(fid);
  const friendCode = friend ? (friend as { partyCode?: string | null }).partyCode : null;
  return !!friendCode && String(friendCode).toUpperCase() === String(code).toUpperCase();
}

export function getAllFriendsForParty(): PartyFriendRow[] {
  return getFriendRows()
    .map(r => ({
      playerId: r.entry.playerId,
      username: r.entry.username,
      brawlerId: r.brawlerId,
      profileIconId: r.profileIconId,
      trophies: r.trophies,
      statusText: r.statusText,
      screen: r.screen,
      online: r.online,
      inMyParty: isFriendInMyParty(r.entry.playerId),
      battleMode: getBattleModeForPlayerId(r.entry.playerId),
    }))
    .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || a.username.localeCompare(b.username, "ru"));
}

/** Только друзья в сети — для панели «+». */
export function getOnlineFriendsForParty(): PartyFriendRow[] {
  return getAllFriendsForParty().filter(f => f.online);
}

function patchPartyRoom(code: string, patch: (room: PartyRoom) => PartyRoom): void {
  const all = readParties();
  const room = all[code];
  if (!room) return;
  all[code] = patch(room);
  writeParties(all);
}

/** Изменить текущую комнату команды (если игрок в команде). */
export function mutateMyPartyRoom(mutator: (room: PartyRoom) => PartyRoom): boolean {
  const code = getMyPartyCode();
  if (!code) return false;
  patchPartyRoom(code, mutator);
  return true;
}

function setMemberBrawler(room: PartyRoom, playerId: string, brawlerId: string): void {
  const id = normalizePlayerIdQuery(playerId);
  const idx = room.members.findIndex(m => normalizePlayerIdQuery(m.playerId) === id);
  if (idx >= 0) room.members[idx] = { ...room.members[idx], brawlerId };
}

function normalizePartyBrawlerSuggestion(
  raw: PartyBrawlerSuggestion | null | undefined,
): PartyBrawlerSuggestion | null {
  if (!raw?.fromPlayerId || !raw?.toPlayerId || !raw?.brawlerId) return null;
  const fromProf = getProfileByPlayerId(raw.fromPlayerId);
  const toProf = getProfileByPlayerId(raw.toPlayerId);
  return {
    ...raw,
    fromPlayerId: normalizePlayerIdQuery(raw.fromPlayerId),
    toPlayerId: normalizePlayerIdQuery(raw.toPlayerId),
    fromUsername: fromProf?.username ?? raw.fromUsername,
    toUsername: toProf?.username ?? raw.toUsername,
  };
}

/** Имя получателя предложения (кому предлагают бойца) — показывается в пузырьке. */
export function getPartySuggestionRecipientName(suggestion: PartyBrawlerSuggestion): string {
  const prof = getProfileByPlayerId(suggestion.toPlayerId);
  return prof?.username ?? suggestion.toUsername ?? "Игрок";
}

export function getPartyBrawlerSuggestion(): PartyBrawlerSuggestion | null {
  const room = getMyPartyRoom();
  return normalizePartyBrawlerSuggestion(room?.brawlerSuggestion);
}

export function getIncomingBrawlerSuggestionForMe(): PartyBrawlerSuggestion | null {
  const me = getCurrentProfile();
  const sug = getPartyBrawlerSuggestion();
  if (!me?.playerId || !sug) return null;
  if (normalizePlayerIdQuery(sug.toPlayerId) !== normalizePlayerIdQuery(me.playerId)) return null;
  return sug;
}

export function getOutgoingBrawlerSuggestionFromMe(): PartyBrawlerSuggestion | null {
  const me = getCurrentProfile();
  const sug = getPartyBrawlerSuggestion();
  if (!me?.playerId || !sug) return null;
  if (normalizePlayerIdQuery(sug.fromPlayerId) !== normalizePlayerIdQuery(me.playerId)) return null;
  return sug;
}

export function clearPartyBrawlerSuggestion(): void {
  const code = getMyPartyCode();
  if (!code) return;
  patchPartyRoom(code, r => ({ ...r, brawlerSuggestion: null }));
}

/** Сброс предложения, если получатель сменил бойца вручную. */
export function clearPartyBrawlerSuggestionIfRecipientChangedBrawler(
  newBrawlerId: string,
): void {
  const sug = getIncomingBrawlerSuggestionForMe();
  if (!sug) return;
  if (sug.brawlerId === newBrawlerId) {
    acceptPartyBrawlerSuggestion();
    return;
  }
  clearPartyBrawlerSuggestion();
}

export function sendPartyBrawlerSuggestion(
  toPlayerId: string,
  brawlerId: string,
): { success: boolean; error?: string } {
  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: "Не авторизован" };
  const room = getMyPartyRoom();
  if (!room) return { success: false, error: "Вы не в команде" };

  const myId = normalizePlayerIdQuery(me.playerId);
  const targetId = normalizePlayerIdQuery(toPlayerId);
  if (targetId === myId) return { success: false, error: "Нельзя предложить себе" };

  const inParty =
    normalizePlayerIdQuery(room.leaderPlayerId) === targetId
    || room.members.some(m => normalizePlayerIdQuery(m.playerId) === targetId);
  if (!inParty) return { success: false, error: "Игрок не в вашей команде" };

  if (!me.unlockedBrawlers.includes(brawlerId)) {
    return { success: false, error: "Боец не открыт" };
  }

  const target = getProfileByPlayerId(targetId);
  if (!target) return { success: false, error: "Игрок не найден" };

  if (!target.unlockedBrawlers.includes(brawlerId)) {
    return { success: false, error: "У игрока нет этого бойца" };
  }

  const suggestion: PartyBrawlerSuggestion = {
    fromPlayerId: myId,
    fromUsername: me.username,
    toPlayerId: targetId,
    toUsername: target.username,
    brawlerId,
    sentAt: Date.now(),
  };

  patchPartyRoom(room.code, r => ({ ...r, brawlerSuggestion: suggestion }));
  scheduleTestBrawlerSuggestionResponse(targetId, suggestion);
  return { success: true };
}

function scheduleTestBrawlerSuggestionResponse(
  targetId: string,
  suggestion: PartyBrawlerSuggestion,
) {
  if (!isTestFriendPlayerId(targetId)) return;
  const spec = getTestFriendSpec(targetId);
  if (!spec || (spec.presence !== "menu" && !spec.autoAcceptParty)) return;

  window.setTimeout(() => {
    const target = getProfileByPlayerId(targetId);
    const code = (target as { partyCode?: string | null })?.partyCode;
    if (!code) return;
    const room = getPartyRoom(code);
    if (!room?.brawlerSuggestion) return;
    if (room.brawlerSuggestion.sentAt !== suggestion.sentAt) return;
    applyPartyBrawlerSuggestionForPlayer(targetId, suggestion.brawlerId);
  }, 1200);
}

function applyPartyBrawlerSuggestionForPlayer(playerId: string, brawlerId: string): void {
  const key = findProfileStorageKeyByPlayerId(playerId);
  if (!key) return;
  const all = getAllProfiles();
  const raw = all[key];
  if (!raw) return;
  const prof = normalizeProfile(raw as UserProfile);
  const owned = prof.unlockedBrawlers.includes(brawlerId) ? brawlerId : prof.selectedBrawlerId;
  all[key] = { ...raw, selectedBrawlerId: owned };
  saveProfiles(all);

  const code = (raw as { partyCode?: string }).partyCode;
  if (code) {
    patchPartyRoom(code, r => {
      setMemberBrawler(r, playerId, owned);
      return { ...r, brawlerSuggestion: null };
    });
  }
  emitPartyChanged();
}

export function acceptPartyBrawlerSuggestion(): { success: boolean; error?: string } {
  const sug = getIncomingBrawlerSuggestionForMe();
  if (!sug) return { success: false, error: "Нет предложения" };

  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: "Не авторизован" };

  const pick = me.unlockedBrawlers.includes(sug.brawlerId)
    ? sug.brawlerId
    : me.selectedBrawlerId || "hana";

  updateProfile({ selectedBrawlerId: pick } as Partial<UserProfile>);
  syncMyPartyBrawler(pick);

  const code = getMyPartyCode();
  if (code) {
    patchPartyRoom(code, r => {
      setMemberBrawler(r, me.playerId!, pick);
      return { ...r, brawlerSuggestion: null };
    });
  } else {
    clearPartyBrawlerSuggestion();
  }

  emitPartyChanged();
  return { success: true };
}

export function declinePartyBrawlerSuggestion(): void {
  clearPartyBrawlerSuggestion();
}

function partyChatMsgId(): string {
  return `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getPartyModeSuggestion(): PartyModeSuggestion | null {
  return getMyPartyRoom()?.modeSuggestion ?? null;
}

export function sendPartyModeSuggestion(modeId: string): { success: boolean; error?: string } {
  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: "Не авторизован" };
  if (amPartyLeader()) return { success: false, error: "Лидер выбирает режим сам" };
  const room = getMyPartyRoom();
  if (!room) return { success: false, error: "Вы не в команде" };

  if (modeId === "ranked") {
    const leagueCheck = checkRankedPartyLeagueCompatibility(getPartyRoomAllPlayerIds(room));
    if (!leagueCheck.ok) {
      return { success: false, error: rankedPartyLeagueError(leagueCheck) };
    }
  }

  const ok = applyPartyModeSuggestionFromPlayer(room.code, me.playerId, modeId);
  return ok ? { success: true } : { success: false, error: "Не удалось предложить режим" };
}

/** Записать предложение режима от конкретного игрока (бот / напарник). */
export function applyPartyModeSuggestionFromPlayer(
  roomCode: string,
  fromPlayerId: string,
  modeId: string,
): boolean {
  const room = getPartyRoom(roomCode);
  if (!room) return false;

  const fromId = normalizePlayerIdQuery(fromPlayerId);
  if (fromId === normalizePlayerIdQuery(room.leaderPlayerId)) return false;

  const inParty =
    fromId === normalizePlayerIdQuery(room.leaderPlayerId)
    || room.members.some(m => normalizePlayerIdQuery(m.playerId) === fromId);
  if (!inParty) return false;

  const prof = getProfileByPlayerId(fromId);
  if (!prof) return false;

  const suggestion: PartyModeSuggestion = {
    fromPlayerId: fromId,
    fromUsername: prof.username,
    modeId,
    sentAt: Date.now(),
  };

  const msg: PartyChatMessage = {
    id: partyChatMsgId(),
    sentAt: Date.now(),
    playerId: fromId,
    username: prof.username,
    modeId,
    modeSuggest: true,
  };

  patchPartyRoom(roomCode, r => ({
    ...r,
    modeSuggestion: suggestion,
    chat: pruneChatByLimit([...(r.chat ?? []), msg]),
  }));
  emitPartyChanged();
  return true;
}

export function cancelPartyModeSuggestion(): void {
  const me = getCurrentProfile();
  const room = getMyPartyRoom();
  if (!room?.modeSuggestion || !me?.playerId) return;
  if (normalizePlayerIdQuery(room.modeSuggestion.fromPlayerId) !== normalizePlayerIdQuery(me.playerId)) return;
  patchPartyRoom(room.code, r => ({ ...r, modeSuggestion: null }));
  emitPartyChanged();
}

export function acceptPartyModeSuggestion(): { success: boolean; error?: string } {
  if (!amPartyLeader()) return { success: false, error: "Только лидер может принять" };
  const room = getMyPartyRoom();
  const sug = room?.modeSuggestion;
  if (!room || !sug) return { success: false, error: "Нет предложения" };

  if (sug.modeId === "ranked") {
    const leagueCheck = checkRankedPartyLeagueCompatibility(getPartyRoomAllPlayerIds(room));
    if (!leagueCheck.ok) {
      return { success: false, error: rankedPartyLeagueError(leagueCheck) };
    }
  }

  const leaderId = normalizePlayerIdQuery(room.leaderPlayerId);
  const key = findProfileStorageKeyByPlayerId(leaderId);
  if (key) {
    const all = getAllProfiles();
    const raw = all[key];
    if (raw) {
      all[key] = { ...raw, selectedMode: sug.modeId as UserProfile["selectedMode"] };
      saveProfiles(all);
    }
  }
  const me = getCurrentProfile();
  if (me?.playerId && normalizePlayerIdQuery(me.playerId) === leaderId) {
    updateProfile({ selectedMode: sug.modeId as UserProfile["selectedMode"] });
  }
  patchPartyRoom(room.code, r => ({ ...r, modeSuggestion: null }));
  emitPartyChanged();
  return { success: true };
}

export function declinePartyModeSuggestion(): void {
  if (!amPartyLeader()) return;
  const room = getMyPartyRoom();
  if (!room) return;
  patchPartyRoom(room.code, r => ({ ...r, modeSuggestion: null }));
  emitPartyChanged();
  scheduleTestBotModeSuggestAfterJoin(room.code);
}

/** Последнее сообщение игрока для «облачка» над головой (не системное). */
export function getLatestPartySpeechForPlayer(playerId: string): PartyChatMessage | null {
  const room = getMyPartyRoom();
  if (!room?.chat?.length) return null;
  const pid = normalizePlayerIdQuery(playerId);
  for (let i = room.chat.length - 1; i >= 0; i--) {
    const m = room.chat[i]!;
    if (m.system || m.astral || m.modeSuggest) continue;
    if (normalizePlayerIdQuery(m.playerId) === pid) return m;
  }
  return null;
}

export function kickPartyMember(targetPlayerId: string): { success: boolean; error?: string } {
  if (!amPartyLeader()) return { success: false, error: "Только лидер может выгнать" };

  const me = getCurrentProfile();
  const room = getMyPartyRoom();
  if (!me?.playerId || !room) return { success: false, error: "Нет команды" };

  const targetId = normalizePlayerIdQuery(targetPlayerId);
  const myId = normalizePlayerIdQuery(me.playerId);
  if (targetId === myId) return { success: false, error: "Нельзя выгнать себя" };
  if (normalizePlayerIdQuery(room.leaderPlayerId) === targetId) {
    return { success: false, error: "Нельзя выгнать лидера" };
  }

  const all = readParties();
  room.members = room.members.filter(m => normalizePlayerIdQuery(m.playerId) !== targetId);
  room.brawlerSuggestion = null;
  all[room.code] = clearPartyPlayReadyOnRoom(room);
  writeParties(all);

  const key = findProfileStorageKeyByPlayerId(targetId);
  if (key) {
    const profiles = getAllProfiles();
    const r = profiles[key];
    if (r) {
      profiles[key] = {
        ...r,
        partyCode: null,
        partyInviteIncoming: undefined,
        outgoingPartyInvite: undefined,
      };
    }
    saveProfiles(profiles);
  }
  syncProfilePartyCode(targetId, null);
  emitPartyChanged();
  return { success: true };
}

const TEST_BOT_MODE_SUGGEST_COOLDOWN_MS = 9000;
const DEMO_MODE_POOL = ["gemgrab", "showdown", "heist", "bounty", "siege", "starstrike", "bossraid"] as const;
let testBotModeSuggestRound = 0;
let testBotModeSuggestLastAt = 0;
const pendingTestBotModeSuggestTimers = new Map<string, number>();

function pickAlternateModeForBot(fromPlayerId: string, currentMode: string): string {
  const spec = getTestFriendSpec(fromPlayerId);
  if (spec?.battleMode && spec.battleMode !== currentMode) return spec.battleMode;
  const alt = DEMO_MODE_POOL.filter(m => m !== currentMode);
  if (!alt.length) return "gemgrab";
  const h = stableHash(`${fromPlayerId}:${testBotModeSuggestRound}:${currentMode}`);
  return alt[h % alt.length]!;
}

function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function scheduleTestBotModeSuggestAfterJoin(roomCode: string, preferredFromId?: string): void {
  if (typeof window === "undefined") return;
  const prev = pendingTestBotModeSuggestTimers.get(roomCode);
  if (prev) window.clearTimeout(prev);
  const delay = preferredFromId ? 2200 + Math.floor(Math.random() * 1800) : 8000 + Math.floor(Math.random() * 4000);
  const timer = window.setTimeout(() => {
    pendingTestBotModeSuggestTimers.delete(roomCode);
    maybeOfferTestBotModeSuggest(preferredFromId);
  }, delay);
  pendingTestBotModeSuggestTimers.set(roomCode, timer);
}

/** Тест-боты в команде предлагают лидеру другой режим (демо UI). */
export function maybeOfferTestBotModeSuggest(preferredFromId?: string): void {
  const me = getCurrentProfile();
  if (!me?.playerId || !amPartyLeader()) return;
  if (isTestFriendPlayerId(me.playerId)) return;

  const room = getMyPartyRoom();
  if (!room || room.code !== getMyPartyCode()) return;
  if (room.modeSuggestion) return;
  if (isPartyPlayReadyActive()) return;

  const testMembers = room.members.filter(m => isTestFriendPlayerId(m.playerId));
  if (!testMembers.length) return;

  const now = Date.now();
  if (now - testBotModeSuggestLastAt < TEST_BOT_MODE_SUGGEST_COOLDOWN_MS) return;

  const currentMode = partyModeFromProfile(me);
  let fromMember = preferredFromId
    ? testMembers.find(m => normalizePlayerIdQuery(m.playerId) === normalizePlayerIdQuery(preferredFromId))
    : undefined;
  if (!fromMember) {
    fromMember = testMembers[testBotModeSuggestRound % testMembers.length];
  }
  if (!fromMember) return;

  testBotModeSuggestRound += 1;
  const modeId = pickAlternateModeForBot(fromMember.playerId, currentMode);
  if (modeId === currentMode) return;

  const ok = applyPartyModeSuggestionFromPlayer(room.code, fromMember.playerId, modeId);
  if (ok) testBotModeSuggestLastAt = now;
}

const DEMO_BRAWLER_SUGGEST_KEY = "clash_demo_brawler_suggest_v1";

/** Тест: напарник в команде предлагает вам бойца (для проверки входящего предложения). */
export function maybeOfferDemoIncomingBrawlerSuggest(): void {
  try {
    if (localStorage.getItem(DEMO_BRAWLER_SUGGEST_KEY) === "1") return;
  } catch { return; }

  const me = getCurrentProfile();
  if (!me?.playerId || !(me as UserProfile).partyCode) return;

  const room = getMyPartyRoom();
  if (!room || room.brawlerSuggestion) return;

  const myId = normalizePlayerIdQuery(me.playerId);
  let fromId: string | null = null;
  let fromName = "";

  const leaderId = normalizePlayerIdQuery(room.leaderPlayerId);
  if (leaderId !== myId && isTestFriendPlayerId(leaderId)) {
    fromId = leaderId;
    fromName = getProfileByPlayerId(leaderId)?.username ?? "Test";
  }
  if (!fromId) {
    for (const m of room.members) {
      const mid = normalizePlayerIdQuery(m.playerId);
      if (mid !== myId && isTestFriendPlayerId(mid)) {
        fromId = mid;
        fromName = m.username;
        break;
      }
    }
  }
  if (!fromId) return;

  const myBrawlers = me.unlockedBrawlers || ["hana"];
  const fromProf = getProfileByPlayerId(fromId);
  const shared = fromProf
    ? myBrawlers.filter(id => fromProf.unlockedBrawlers.includes(id))
    : myBrawlers;
  const pick = shared[0] ?? myBrawlers[0] ?? "hana";

  const suggestion: PartyBrawlerSuggestion = {
    fromPlayerId: fromId,
    fromUsername: fromName,
    toPlayerId: myId,
    toUsername: me.username,
    brawlerId: pick,
    sentAt: Date.now(),
  };

  patchPartyRoom(room.code, r => ({ ...r, brawlerSuggestion: suggestion }));

  try {
    localStorage.setItem(DEMO_BRAWLER_SUGGEST_KEY, "1");
  } catch { /* ignore */ }

  emitPartyChanged();
}

/** Демо: тест-друзья в команде по очереди показывают разные плашки активности (каждые 5 с). */
export function cyclePartyTestFriendsMenuActivity(round: number): boolean {
  const room = getMyPartyRoom();
  if (!room || room.members.length < 1) return false;

  const all = getAllProfiles();
  const now = Date.now();
  let changed = false;
  let testIdx = 0;

  for (const member of room.members) {
    if (!isTestFriendPlayerId(member.playerId)) continue;
    const idNorm = normalizePlayerIdQuery(member.playerId);
    let key = findProfileStorageKeyByPlayerId(idNorm);
    if (!key) {
      for (const [uname, raw] of Object.entries(all)) {
        if (normalizePlayerIdQuery((raw as { playerId?: string }).playerId ?? "") === idNorm) {
          key = uname;
          break;
        }
      }
    }
    if (!key || !all[key]) continue;

    const activity: MenuActivityId =
      MENU_ACTIVITY_DEMO_CYCLE[(round + testIdx) % MENU_ACTIVITY_DEMO_CYCLE.length];
    testIdx += 1;

    all[key] = {
      ...normalizeProfile(all[key] as UserProfile),
      socialPresence: {
        screen: "menu",
        updatedAt: now,
        menuActivity: activity,
      },
    } as UserProfile;
    changed = true;
  }

  if (changed) {
    saveProfiles(all);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("clash_presence_changed"));
    }
  }
  return changed;
}

function emitJoinRequestEvent() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_JOIN_REQUEST_EVENT));
  }
}

function partyCodeForPlayer(playerId: string): string | null {
  const remote = getRemotePartyCodeForPlayer(playerId);
  if (remote) return remote;
  const p = getProfileByPlayerId(playerId);
  const code = (p as { partyCode?: string | null } | null)?.partyCode;
  return code ? String(code).toUpperCase() : null;
}

export function isPartyMemberOnline(playerId: string): boolean {
  const id = normalizePlayerIdQuery(playerId);
  const me = getCurrentProfile();
  if (me?.playerId && normalizePlayerIdQuery(me.playerId) === id) {
    return true;
  }

  const pr = getPresenceForPlayerId(id);
  return pr.online && pr.screen !== "offline";
}

/** Есть ли в команде участник не в сети (блокирует старт). */
export function hasOfflinePartyMember(): boolean {
  const room = getMyPartyRoom();
  if (!room) return false;
  for (const id of getPartyRoomAllPlayerIds(room)) {
    if (!isPartyMemberOnline(id)) return true;
  }
  return false;
}

export function isPartyLeaderPlayerId(playerId: string, room?: PartyRoom | null): boolean {
  const r = room ?? getMyPartyRoom();
  if (!r) return false;
  return normalizePlayerIdQuery(r.leaderPlayerId) === normalizePlayerIdQuery(playerId);
}

/** Первая ожидающая заявка на вступление (только для лидера). */
export function getPendingJoinRequestForLeader(): (PartyJoinRequest & { code: string }) | null {
  if (!amPartyLeader()) return null;
  const room = getMyPartyRoom();
  if (!room?.joinRequests?.length) return null;
  const req = room.joinRequests[0]!;
  return { ...req, code: room.code };
}

/** Отправить заявку на вступление в команду по коду (лидер принимает). */
export async function requestJoinParty(codeInput: string): Promise<{ success: boolean; error?: string }> {
  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: "Не авторизован" };

  const code = codeInput.trim().toUpperCase();
  if (code.length < 4) return { success: false, error: "Неверный код команды" };

  if ((me as { partyCode?: string | null }).partyCode) {
    return { success: false, error: "Сначала выйдите из текущей команды" };
  }

  const { isOnlinePartySyncEnabled, hydratePartyFromServer, wakePartyServer } = await import("../cloud/partyServerSync");
  if (isOnlinePartySyncEnabled()) {
    const awake = await wakePartyServer(45_000);
    if (!awake) {
      return { success: false, error: "Сервер команд не отвечает. Подождите минуту и попробуйте снова." };
    }
    let hydrated = false;
    for (let i = 0; i < 3; i++) {
      if (await hydratePartyFromServer(code)) {
        hydrated = true;
        break;
      }
      if (i < 2) await new Promise((r) => setTimeout(r, 1200));
    }
    if (!hydrated && !getPartyRoom(code)) {
      return { success: false, error: "Команда не найдена на сервере" };
    }
  }

  const room = getPartyRoom(code);
  if (!room) return { success: false, error: "Команда не найдена" };
  if (roomIsFull(room)) return { success: false, error: "Команда заполнена" };

  const myId = normalizePlayerIdQuery(me.playerId);
  if (normalizePlayerIdQuery(room.leaderPlayerId) === myId) {
    return { success: false, error: "Вы уже лидер этой команды" };
  }
  if (room.members.some(m => normalizePlayerIdQuery(m.playerId) === myId)) {
    return { success: false, error: "Вы уже в этой команде" };
  }

  const existing = room.joinRequests ?? [];
  if (existing.some(r => normalizePlayerIdQuery(r.playerId) === myId)) {
    return { success: false, error: "Заявка уже отправлена" };
  }

  const req: PartyJoinRequest = {
    playerId: myId,
    username: me.username,
    brawlerId: me.selectedBrawlerId || "hana",
    sentAt: Date.now(),
  };

  patchPartyRoom(code, r => ({
    ...r,
    joinRequests: [...(r.joinRequests ?? []), req],
  }));

  emitJoinRequestEvent();
  emitPartyChanged();
  scheduleTestLeaderAcceptJoinRequest(code, req);
  return { success: true };
}

export function acceptPartyJoinRequest(fromPlayerId: string): { success: boolean; error?: string } {
  if (!amPartyLeader()) return { success: false, error: "Только лидер может принимать заявки" };
  const room = getMyPartyRoom();
  if (!room) return { success: false, error: "Нет команды" };
  return acceptJoinRequestInRoom(room.code, fromPlayerId);
}

function acceptJoinRequestInRoom(code: string, fromPlayerId: string): { success: boolean; error?: string } {
  const room = getPartyRoom(code);
  if (!room) return { success: false, error: "Нет команды" };
  if (roomIsFull(room)) return { success: false, error: "Команда заполнена" };

  const fid = normalizePlayerIdQuery(fromPlayerId);
  const req = room.joinRequests?.find(r => normalizePlayerIdQuery(r.playerId) === fid);
  if (!req) return { success: false, error: "Заявка не найдена" };

  const prof = getProfileByPlayerId(fid);
  if (prof && (prof as { partyCode?: string | null }).partyCode) {
    patchPartyRoom(room.code, r => ({
      ...r,
      joinRequests: (r.joinRequests ?? []).filter(x => normalizePlayerIdQuery(x.playerId) !== fid),
    }));
    return { success: false, error: "Игрок уже в другой команде" };
  }

  const member: PartyMember = {
    playerId: fid,
    username: prof?.username ?? req.username,
    brawlerId: prof?.selectedBrawlerId || req.brawlerId || "hana",
    slot: "left",
    joinedAt: Date.now(),
  };
  if (!addMemberToRoom(room, member)) {
    return { success: false, error: "Нет свободных мест" };
  }

  const key = findProfileStorageKeyByPlayerId(fid);
  if (key) {
    const all = getAllProfiles();
    const raw = all[key];
    if (raw) {
      all[key] = { ...raw, partyCode: room.code, partyInviteIncoming: undefined };
      saveProfiles(all);
    }
  }
  syncProfilePartyCode(fid, room.code);

  patchPartyRoom(room.code, r => ({
    ...r,
    joinRequests: (r.joinRequests ?? []).filter(x => normalizePlayerIdQuery(x.playerId) !== fid),
  }));

  emitPartyChanged();
  return { success: true };
}

export function declinePartyJoinRequest(fromPlayerId: string): void {
  if (!amPartyLeader()) return;
  const room = getMyPartyRoom();
  if (!room) return;
  const fid = normalizePlayerIdQuery(fromPlayerId);
  patchPartyRoom(room.code, r => ({
    ...r,
    joinRequests: (r.joinRequests ?? []).filter(x => normalizePlayerIdQuery(x.playerId) !== fid),
  }));
  emitPartyChanged();
}

export function hasPendingJoinRequestForParty(code: string): boolean {
  const me = getCurrentProfile();
  if (!me?.playerId) return false;
  const myId = normalizePlayerIdQuery(me.playerId);
  const room = getPartyRoom(code);
  return !!room?.joinRequests?.some(r => normalizePlayerIdQuery(r.playerId) === myId);
}

/** Отменить свою заявку на вступление в команду по коду. */
export function cancelMyPartyJoinRequest(codeInput: string): { success: boolean; error?: string } {
  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: "Не авторизован" };

  const code = codeInput.trim().toUpperCase();
  const room = getPartyRoom(code);
  if (!room) return { success: false, error: "Команда не найдена" };

  const myId = normalizePlayerIdQuery(me.playerId);
  const hasReq = (room.joinRequests ?? []).some(r => normalizePlayerIdQuery(r.playerId) === myId);
  if (!hasReq) return { success: false, error: "Заявка не найдена" };

  patchPartyRoom(code, r => ({
    ...r,
    joinRequests: (r.joinRequests ?? []).filter(x => normalizePlayerIdQuery(x.playerId) !== myId),
  }));
  emitPartyChanged();
  return { success: true };
}

export interface OnlinePartyGroupMember {
  playerId: string;
  username: string;
  brawlerId: string;
  profileIconId?: string | null;
  trophies: number;
  online: boolean;
  isLeader: boolean;
}

export interface OnlinePartyGroup {
  code: string;
  modeId: string;
  leaderPlayerId: string;
  members: OnlinePartyGroupMember[];
  currentSize: number;
  maxSize: number;
  isFull: boolean;
  hasMyPendingRequest: boolean;
  /** Превью-карточка для UI (не настоящая команда). */
  isDemo?: boolean;
}

export const DEMO_PARTY_PREVIEW_CODE = "DEM00X";
export const DEMO_PARTY_FULL_CODE = "DEM00Y";

/** Пример: есть свободные места — кнопка «Вступить» видна. */
export function getDemoOnlinePartyGroup(): OnlinePartyGroup {
  return {
    code: DEMO_PARTY_PREVIEW_CODE,
    modeId: "gemgrab",
    leaderPlayerId: "01YUKIFROSTX",
    members: [
      {
        playerId: "01YUKIFROSTX",
        username: "Test_Yuki",
        brawlerId: "yuki",
        trophies: 4200,
        online: true,
        isLeader: true,
      },
      {
        playerId: "02RONINBLADE",
        username: "Test_Ronin",
        brawlerId: "ronin",
        trophies: 3100,
        online: true,
        isLeader: false,
      },
    ],
    currentSize: 2,
    maxSize: 3,
    isFull: false,
    hasMyPendingRequest: false,
    isDemo: true,
  };
}

/** Пример: команда заполнена для режима — без кнопки «Вступить». */
export function getDemoOnlinePartyGroupFull(): OnlinePartyGroup {
  return {
    code: DEMO_PARTY_FULL_CODE,
    modeId: "gemgrab",
    leaderPlayerId: "01YUKIFROSTX",
    members: [
      {
        playerId: "01YUKIFROSTX",
        username: "Test_Yuki",
        brawlerId: "yuki",
        trophies: 4200,
        online: true,
        isLeader: true,
      },
      {
        playerId: "02RONINBLADE",
        username: "Test_Ronin",
        brawlerId: "ronin",
        trophies: 3100,
        online: true,
        isLeader: false,
      },
      {
        playerId: "05GOROCRUSHX",
        username: "Test_Goro",
        brawlerId: "goro",
        trophies: 2900,
        online: false,
        isLeader: false,
      },
    ],
    currentSize: 3,
    maxSize: 3,
    isFull: true,
    hasMyPendingRequest: false,
    isDemo: true,
  };
}

export function getOnlinePartyGroupsForPanel(): {
  groups: OnlinePartyGroup[];
  soloFriends: PartyFriendRow[];
} {
  const friends = getOnlineFriendsForParty();
  const codeToFriendIds = new Map<string, Set<string>>();
  for (const f of friends) {
    const code = partyCodeForPlayer(f.playerId);
    if (!code) continue;
    if (!codeToFriendIds.has(code)) codeToFriendIds.set(code, new Set());
    codeToFriendIds.get(code)!.add(normalizePlayerIdQuery(f.playerId));
  }

  const groupedFriendIds = new Set<string>();
  const groups: OnlinePartyGroup[] = [];

  for (const [code] of codeToFriendIds) {
    const room = getPartyRoom(code);
    if (!room) continue;

    const leaderProf = getProfileByPlayerId(room.leaderPlayerId);
    const modeSel = partyModeFromProfile(leaderProf);
    const maxSize = getMaxPartySize(modeSel);
    const currentSize = getPartyCount(room.members.length);
    if (currentSize < 2) continue;

    const members: OnlinePartyGroupMember[] = [];
    const leaderId = normalizePlayerIdQuery(room.leaderPlayerId);

    const pushMember = (playerId: string, isLeader: boolean) => {
      const fid = normalizePlayerIdQuery(playerId);
      const fr = friends.find(f => normalizePlayerIdQuery(f.playerId) === fid);
      const prof = getProfileByPlayerId(fid);
      if (!fr && !prof) return;
      const pres = getPresenceForPlayerId(fid);
      members.push({
        playerId: fid,
        username: fr?.username ?? prof?.username ?? "?",
        brawlerId: fr?.brawlerId ?? prof?.selectedBrawlerId ?? "hana",
        profileIconId: fr?.profileIconId ?? prof?.profileIconId,
        trophies: fr?.trophies ?? prof?.trophies ?? 0,
        online: pres.online,
        isLeader,
      });
      if (fr) groupedFriendIds.add(fid);
    };

    pushMember(room.leaderPlayerId, true);
    const sortedMembers = [...room.members].sort((a, b) => a.joinedAt - b.joinedAt);
    for (const m of sortedMembers) {
      pushMember(m.playerId, false);
    }

    if (members.length < 2) continue;

    groups.push({
      code,
      modeId: modeSel.mode,
      leaderPlayerId: leaderId,
      members,
      currentSize,
      maxSize,
      isFull: roomIsFull(room),
      hasMyPendingRequest: hasPendingJoinRequestForParty(code),
    });
  }

  const soloFriends = friends.filter(f => {
    const fid = normalizePlayerIdQuery(f.playerId);
    if (groupedFriendIds.has(fid)) return false;
    const code = partyCodeForPlayer(f.playerId);
    if (!code) return true;
    const room = getPartyRoom(code);
    if (!room) return true;
    return getPartyCount(room.members.length) < 2;
  });

  groups.sort((a, b) => b.currentSize - a.currentSize || a.code.localeCompare(b.code));
  return { groups, soloFriends };
}

function scheduleTestLeaderAcceptJoinRequest(code: string, req: PartyJoinRequest): void {
  const room = getPartyRoom(code);
  if (!room) return;
  const leaderId = normalizePlayerIdQuery(room.leaderPlayerId);
  if (!isTestFriendPlayerId(leaderId)) return;
  const spec = getTestFriendSpec(leaderId);
  if (!spec?.autoAcceptParty) return;
  window.setTimeout(() => {
    const current = getPartyRoom(code);
    if (!current?.joinRequests?.some(r => normalizePlayerIdQuery(r.playerId) === normalizePlayerIdQuery(req.playerId))) {
      return;
    }
    acceptJoinRequestInRoom(code, req.playerId);
  }, 1200);
}