// =========================================================================
// CLUBS (Гильдии) — global directory of clubs with members, chat, and
// per-cycle win rewards (5 days, 30 wins per member).
//
// Storage (all under localStorage):
//   clash_clubs_v1          — Record<clubId, Club>
//
// Per-profile we additionally stash (free-form, cast as any):
//   clubId            — current club id (string | null)
//   clubInvites       — string[] of pending club ids
//   clubCycleClaims   — Record<clubId, { cycleId, claims: Record<member, pick> }>
// =========================================================================

import {
  getCurrentProfile, getCurrentUsername, updateProfile,
  getAllProfiles, saveProfiles, findProfileStorageKey,
  type BattleHistoryParticipant,
  getEquippedPins,
} from "./localStorageAPI";
import { isProfileIconUnlocked } from "./profileIconUtils";
import { isValidPlayerIdFormat, normalizePlayerIdQuery } from "./playerId";
import { emptyClubTreasury, initTreasuryOnJoin, initTreasuryForUsername, processTreasuryLeaveRefund } from "./clubTreasury";
import {
  ASTRAL_CHAT_USERNAME,
  scheduleAstralChatReply,
} from "../ai/astralChatMention";
import {
  guardianBlockResult,
  guardianFilterChatHistory,
  isGuardianSkippableMessage,
  MODERATION_BLOCKED_CODE,
  MODERATION_CHAT_PURGED,
  GUARDIAN_NAME,
} from "../ai/contentGuardian";
import { guardianAiFilterMessages, guardianModerateForSend, guardianModerateWithBuiltIn } from "../ai/contentGuardianAi";
import * as clubCloud from "./cloud/clubCloud";

const CLUBS_KEY = "clash_clubs_v1";

export const CLUB_NAME_MAX        = 20;
import { GAME_CHAT_MAX_MESSAGES, pruneChatByLimit } from "./chatLimits";
export const CLUB_MEMBERS_MAX     = 50;
/** @deprecated use CLUB_WINS_PER_MEMBER */
export const CLUB_BATTLES_PER_REWARD = 30;
export const CLUB_WINS_PER_MEMBER = 30;
export const CLUB_CYCLE_MS        = 5 * 24 * 60 * 60 * 1000;
export const CLUB_DESC_MAX        = 100;
export const CLUB_CHAT_MAX        = 200;
export const CLUB_CHAT_MAX_MESSAGES = GAME_CHAT_MAX_MESSAGES;
export const CLUB_REWARD_COINS    = 1000;
export const CLUB_REWARD_GEMS     = 10;
export const CLUB_REWARD_PP       = 100;

/** @deprecated legacy role — use ClubRank */
export type ClubRole = "leader" | "helper" | "member";
export type ClubRank = "junior" | "middle" | "senior" | "president" | "owner";
export type ClubType = "open" | "closed";
export type ClubRewardPick = "coins" | "gems" | "pp";

export const CLUB_RANK_ORDER: ClubRank[] = ["junior", "middle", "senior", "president", "owner"];

export const CLUB_RANK_META: Record<ClubRank, {
  label: string;
  color: string;
  canEditClub: boolean;
  canSetAvatar: boolean;
  canPromote: boolean;
  canKick: boolean;
  canApproveJoin: boolean;
  canInvite: boolean;
}> = {
  junior: {
    label: "Младший", color: "#9E9E9E",
    canEditClub: false, canSetAvatar: false, canPromote: false,
    canKick: false, canApproveJoin: false, canInvite: false,
  },
  middle: {
    label: "Средний", color: "#81C784",
    canEditClub: false, canSetAvatar: false, canPromote: false,
    canKick: false, canApproveJoin: false, canInvite: true,
  },
  senior: {
    label: "Старший", color: "#40C4FF",
    canEditClub: false, canSetAvatar: false, canPromote: false,
    canKick: true, canApproveJoin: true, canInvite: true,
  },
  president: {
    label: "Президент", color: "#FFD54F",
    canEditClub: false, canSetAvatar: false, canPromote: true,
    canKick: true, canApproveJoin: true, canInvite: true,
  },
  owner: {
    label: "Хозяин", color: "#FF8A00",
    canEditClub: true, canSetAvatar: true, canPromote: true,
    canKick: true, canApproveJoin: true, canInvite: true,
  },
};

export interface ClubMember {
  username: string;
  rank: ClubRank;
  joinedAt: number;
  cycleWins: number;
  /** @deprecated */
  role?: ClubRole;
}

export function getMemberRank(m: ClubMember): ClubRank {
  return m.rank ?? "junior";
}

export function rankIndex(r: ClubRank): number {
  return CLUB_RANK_ORDER.indexOf(r);
}

export function getMyRank(club: Club): ClubRank | null {
  const me = getCurrentUsername();
  if (!me) return null;
  const m = club.members.find(x => x.username === me);
  return m ? getMemberRank(m) : null;
}

export function canManageClub(club: Club, username: string): boolean {
  const m = club.members.find(x => x.username === username);
  if (!m) return false;
  const meta = CLUB_RANK_META[getMemberRank(m)];
  return meta.canEditClub || meta.canPromote || meta.canKick || meta.canApproveJoin;
}

export interface ClubBattleSharePayload {
  replayId: string;
  mode: string;
  won: boolean;
  place: number;
  totalPlayers: number;
  trophyDelta: number;
  scoreBlue?: number;
  scoreRed?: number;
  durationSec?: number;
  teams: BattleHistoryParticipant[];
  showdownFormat?: "solo" | "duo" | "trio";
  bossId?: string;
  bossLevel?: number;
}

export interface ClubMessage {
  id: string;
  sentAt: number;
  username: string;
  text: string;
  system?: boolean;
  /** Ответ ИИ Астрала (виден всем в чате). */
  astral?: boolean;
  battleShare?: ClubBattleSharePayload;
  pinId?: string;
}

export interface JoinRequest {
  username: string;
  requestedAt: number;
}

/** Активный клубный поход на босса — виден всем участникам клуба. */
export interface ClubBossRaidState {
  bossId: string | null;
  leaderPlayerId: string | null;
  leaderUsername: string | null;
  partyCode: string | null;
  joinedPlayerIds: string[];
  updatedAt: number;
}

export interface Club {
  id: string;
  name: string;
  description: string;
  type: ClubType;
  avatarDataUrl?: string;
  avatarPreset?: string;
  avatarProfileIconId?: string;
  createdAt: number;
  createdBy: string;
  members: ClubMember[];
  pendingRequests: JoinRequest[];
  cycleStartedAt: number;
  cycleId: number;
  totalBattles: number;
  rewardsClaimed: number;
  chat: ClubMessage[];
  bossRaid?: ClubBossRaidState;
  /** Клубная сокровищница 2.0 */
  treasury?: import("./clubTreasury").ClubTreasury;
}

export const CLUB_AVATAR_PRESETS = [
  { id: "fire",      emoji: "🔥", gradient: ["#FF6B35", "#FFD23F"] },
  { id: "lightning", emoji: "⚡", gradient: ["#FFE066", "#FFB300"] },
  { id: "skull",     emoji: "💀", gradient: ["#37474F", "#90A4AE"] },
  { id: "shield",    emoji: "🛡️", gradient: ["#1976D2", "#64B5F6"] },
  { id: "sword",     emoji: "⚔️", gradient: ["#5D4037", "#A1887F"] },
  { id: "crown",     emoji: "👑", gradient: ["#FFD700", "#FF8F00"] },
  { id: "rocket",    emoji: "🚀", gradient: ["#7B1FA2", "#E040FB"] },
  { id: "dragon",    emoji: "🐉", gradient: ["#388E3C", "#AED581"] },
  { id: "alien",     emoji: "👽", gradient: ["#00897B", "#80DEEA"] },
  { id: "ghost",     emoji: "👻", gradient: ["#5C6BC0", "#C5CAE9"] },
  { id: "star",      emoji: "⭐", gradient: ["#FFB300", "#FFE082"] },
  { id: "diamond",   emoji: "💎", gradient: ["#0288D1", "#81D4FA"] },
  { id: "wolf",      emoji: "🐺", gradient: ["#455A64", "#B0BEC5"] },
  { id: "lion",      emoji: "🦁", gradient: ["#E65100", "#FFCC80"] },
  { id: "phoenix",   emoji: "🦅", gradient: ["#D81B60", "#F48FB1"] },
  { id: "trophy",    emoji: "🏆", gradient: ["#F9A825", "#FFF176"] },
] as const;

function readAll(): Record<string, Club> {
  try {
    const raw = localStorage.getItem(CLUBS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Club>) : {};
    let changed = false;
    for (const id of Object.keys(parsed)) {
      const before = JSON.stringify(parsed[id]);
      parsed[id] = normalizeClub(parsed[id]);
      if (JSON.stringify(parsed[id]) !== before) changed = true;
    }
    if (changed) writeAll(parsed);
    return parsed;
  } catch { return {}; }
}

function writeAll(clubs: Record<string, Club>): void {
  localStorage.setItem(CLUBS_KEY, JSON.stringify(clubs));
}

// ── Cloud mirror (clubs live on Cloudflare; localStorage is a synced cache) ───
// Reads stay synchronous off the local cache, which is hydrated from the cloud.
// Every mutation is mirrored to the authoritative Worker, which re-validates it;
// we then pull the fresh club back into the cache so all players converge.
export const CLUBS_UPDATED_EVENT = "clash:clubs-updated";

function emitClubsUpdated(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CLUBS_UPDATED_EVENT));
}

function mirror(run: () => Promise<unknown>, pull?: () => Promise<void>): void {
  if (!clubCloud.isClubsServerConfigured()) return;
  void run().then(() => pull?.()).then(() => emitClubsUpdated()).catch(() => { /* offline — local cache stands */ });
}

/** Merge a cloud club doc, preserving client-only fields the cloud doesn't track. */
function mergeOne(all: Record<string, Club>, cloud: Club): void {
  const prev = all[cloud.id];
  const next = normalizeClub(cloud);
  if (prev) {
    // The Worker stores no treasury or heavy base64 avatar blobs — keep ours.
    if (next.treasury === undefined && prev.treasury !== undefined) next.treasury = prev.treasury;
    if (!next.avatarDataUrl && prev.avatarDataUrl) next.avatarDataUrl = prev.avatarDataUrl;
  }
  all[cloud.id] = next;
}

export function mergeCloudClubIntoCache(club: Club | null | undefined): void {
  if (!club || !club.id) return;
  const all = readAll();
  mergeOne(all, club);
  writeAll(all);
}

export function mergeCloudClubsIntoCache(clubs: (Club | null | undefined)[]): void {
  const all = readAll();
  for (const c of clubs) if (c && c.id) mergeOne(all, c);
  writeAll(all);
}

async function pullClubToCache(id: string): Promise<void> {
  try { const { club } = await clubCloud.cloudGetClub<Club>(id); if (club) mergeCloudClubIntoCache(club); } catch { /* offline */ }
}

export async function pullMyClubToCache(): Promise<void> {
  const me = getCurrentUsername();
  if (!me || !clubCloud.isClubsServerConfigured()) return;
  try { const { club } = await clubCloud.cloudGetMyClub<Club>(me); if (club) mergeCloudClubIntoCache(club); } catch { /* offline */ }
}

function cloudActorBase(): { playerId?: string | null; trophies?: number } {
  const prof = getCurrentProfile() as { playerId?: string; trophies?: number } | null;
  return { playerId: prof?.playerId ?? null, trophies: prof?.trophies ?? 0 };
}

function defaultClubBossRaid(): ClubBossRaidState {
  return {
    bossId: null,
    leaderPlayerId: null,
    leaderUsername: null,
    partyCode: null,
    joinedPlayerIds: [],
    updatedAt: 0,
  };
}

function normalizeClub(raw: Club): Club {
  const club = { ...raw };
  if (!club.cycleStartedAt) club.cycleStartedAt = Date.now();
  if (!club.cycleId) club.cycleId = 1;
  club.bossRaid = {
    ...defaultClubBossRaid(),
    ...(club.bossRaid ?? {}),
    joinedPlayerIds: club.bossRaid?.joinedPlayerIds ?? [],
  };
  club.members = (club.members ?? []).map(m => {
    const anyM = m as ClubMember & { battlesContributed?: number; role?: ClubRole };
    const isCreator = anyM.username === club.createdBy;
    let rank: ClubRank = anyM.rank ?? "junior";
    if (!anyM.rank && anyM.role) {
      if (isCreator) rank = "owner";
      else if (anyM.role === "leader") rank = "president";
      else if (anyM.role === "helper") rank = "senior";
      else rank = "junior";
    } else if (isCreator && rank !== "owner") {
      rank = "owner";
    }
    return {
      username: anyM.username,
      rank,
      joinedAt: anyM.joinedAt,
      cycleWins: anyM.cycleWins ?? anyM.battlesContributed ?? 0,
    };
  });
  return club;
}

function rankFromLegacy(role: ClubRole | undefined, isCreator: boolean): ClubRank {
  if (isCreator) return "owner";
  if (role === "leader") return "president";
  if (role === "helper") return "senior";
  return "junior";
}

function pruneChat(club: Club): Club {
  club.chat = pruneChatByLimit(club.chat);
  return club;
}

function uid(prefix = "c"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function systemMsg(text: string): ClubMessage {
  return { id: uid("m"), sentAt: Date.now(), username: "", text, system: true };
}

function pushChat(club: Club, msg: ClubMessage): void {
  club.chat = [...club.chat, msg];
  pruneChat(club);
  emitClubChatChanged();
}

export const CLUB_CHAT_CHANGED_EVENT = "clash:club-chat-changed";

function emitClubChatChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLUB_CHAT_CHANGED_EVENT));
  }
}

const guardianAiClubScans = new Set<string>();
const guardianClubRescanTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Синхронный перескан последних сообщений чата. */
export function guardianPurgeClubChat(clubId: string, maxRecent = 40): number {
  const all = readAll();
  const c = all[clubId];
  if (!c) return 0;
  if (c.chat.length === 0) return 0;

  const head = c.chat.length > maxRecent ? c.chat.slice(0, -maxRecent) : [];
  const recent = c.chat.slice(-maxRecent);
  const { filtered, removedCount } = guardianFilterChatHistory(recent, "club_chat");
  if (removedCount === 0) return 0;

  c.chat = [...head, ...filtered];
  pushChat(c, systemMsg(
    removedCount === 1
      ? MODERATION_CHAT_PURGED
      : `${GUARDIAN_NAME}: удалено ${removedCount} сообщ. — недопустимая лексика.`,
  ));
  all[clubId] = c;
  writeAll(all);
  return removedCount;
}

function runGuardianClubRescan(clubId: string): void {
  if (guardianAiClubScans.has(clubId)) return;
  guardianAiClubScans.add(clubId);
  void (async () => {
    try {
      guardianPurgeClubChat(clubId);
      const all = readAll();
      const c = all[clubId];
      if (!c) return;
      const toScan = c.chat.filter(m => !isGuardianSkippableMessage(m)).slice(-40);
      if (toScan.length === 0) return;
      const { removed } = await guardianAiFilterMessages(
        toScan.map(m => ({ id: m.id, text: m.text })),
        "club_chat",
      );
      if (removed.length === 0) return;
      const all2 = readAll();
      const c2 = all2[clubId];
      if (!c2) return;
      const removedIds = new Set(removed.map(m => m.id));
      c2.chat = c2.chat.filter(m => isGuardianSkippableMessage(m) || !removedIds.has(m.id));
      pushChat(c2, systemMsg(MODERATION_CHAT_PURGED));
      all2[clubId] = c2;
      writeAll(all2);
    } finally {
      guardianAiClubScans.delete(clubId);
    }
  })();
}

/** Отложенный перескан чата — не блокирует UI при открытии и отправке. */
export function scheduleGuardianAiClubRescan(clubId: string, delayMs = 3000): void {
  const prev = guardianClubRescanTimers.get(clubId);
  if (prev) clearTimeout(prev);
  guardianClubRescanTimers.set(clubId, setTimeout(() => {
    guardianClubRescanTimers.delete(clubId);
    runGuardianClubRescan(clubId);
  }, delayMs));
}

export function cancelGuardianAiClubRescan(clubId: string): void {
  const prev = guardianClubRescanTimers.get(clubId);
  if (prev) clearTimeout(prev);
  guardianClubRescanTimers.delete(clubId);
}

/** Read last-read timestamp straight from storage (not via normalizeProfile). */
function getClubChatLastReadAt(): number {
  const username = getCurrentUsername();
  if (!username) return 0;
  const raw = getAllProfiles()[username];
  const ts = raw?.clubChatLastReadAt;
  return typeof ts === "number" && Number.isFinite(ts) ? ts : 0;
}

/** Unread club chat messages (from others + system) since last visit to club chat. */
export function getUnreadClubChatCount(): number {
  const club = getMyClub();
  if (!club) return 0;
  const me = getCurrentUsername();
  const lastRead = getClubChatLastReadAt();
  return club.chat.filter(m =>
    m.sentAt > lastRead && (m.system || (m.username && m.username !== me)),
  ).length;
}

export function markClubChatRead(): void {
  const club = getMyClub();
  if (!club) return;
  const prev = getClubChatLastReadAt();
  const latest = club.chat.reduce((max, m) => Math.max(max, m.sentAt), 0);
  const next = Math.max(Date.now(), latest);
  if (prev < next) {
    updateProfile({ clubChatLastReadAt: next });
  }
  emitClubChatChanged();
}

function ensureCycle(club: Club): boolean {
  if (Date.now() - club.cycleStartedAt < CLUB_CYCLE_MS) return false;
  club.cycleStartedAt = Date.now();
  club.cycleId += 1;
  for (const m of club.members) m.cycleWins = 0;
  pushChat(club, systemMsg("Начался новый 5-дневный цикл клубных наград. Цель — 30 побед каждому!"));
  return true;
}

export function memberCycleComplete(m: ClubMember): boolean {
  return m.cycleWins >= CLUB_WINS_PER_MEMBER;
}

export function allMembersCycleComplete(club: Club): boolean {
  return club.members.length > 0 && club.members.every(memberCycleComplete);
}

export function getClubCycleTimeLeft(club: Club): number {
  return Math.max(0, club.cycleStartedAt + CLUB_CYCLE_MS - Date.now());
}

export function formatClubCycleTimeLeft(ms: number): string {
  if (ms <= 0) return "скоро";
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  const rh = h % 24;
  if (d > 0) return `${d}д ${rh}ч`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${rh}ч ${m}м`;
}

type CycleClaims = Record<string, ClubRewardPick>;

function getProfileCycleClaims(clubId: string, cycleId: number): CycleClaims {
  const prof: any = getCurrentProfile();
  const entry = prof?.clubCycleClaims?.[clubId];
  if (!entry || entry.cycleId !== cycleId) return {};
  return entry.claims ?? {};
}

function saveProfileCycleClaims(clubId: string, cycleId: number, claims: CycleClaims): void {
  const prof: any = getCurrentProfile();
  const all = { ...(prof?.clubCycleClaims ?? {}) };
  all[clubId] = { cycleId, claims };
  updateProfile({ clubCycleClaims: all } as any);
}

export function getClubRewardStatus(club: Club): {
  allMembersDone: boolean;
  qualifiedMembers: string[];
  myClaims: CycleClaims;
  maxRewardSlots: number;
  slotsUsed: number;
  canClaimMore: boolean;
  cycleTimeLeftMs: number;
} {
  const allMembersDone = allMembersCycleComplete(club);
  const qualifiedMembers = club.members.filter(memberCycleComplete).map(m => m.username);
  const myClaims = getProfileCycleClaims(club.id, club.cycleId);
  const usedPicks = new Set(Object.values(myClaims));
  const maxRewardSlots = allMembersDone ? 3 : 1;
  const slotsUsed = usedPicks.size;
  const canClaimMore = slotsUsed < maxRewardSlots && qualifiedMembers.some(u => !myClaims[u]);
  return {
    allMembersDone,
    qualifiedMembers,
    myClaims,
    maxRewardSlots,
    slotsUsed,
    canClaimMore,
    cycleTimeLeftMs: getClubCycleTimeLeft(club),
  };
}

export function claimClubCycleReward(
  clubId: string,
  fromMember: string,
  pick: ClubRewardPick,
): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  if (!me) return { success: false, error: "Не авторизован" };

  const all = readAll();
  const club = all[clubId];
  if (!club) return { success: false, error: "Клуб не найден" };
  if (!club.members.some(m => m.username === me)) {
    return { success: false, error: "Только участники клуба" };
  }

  ensureCycle(club);

  const member = club.members.find(m => m.username === fromMember);
  if (!member) return { success: false, error: "Участник не найден" };
  if (!memberCycleComplete(member)) {
    return { success: false, error: "Участник ещё не набрал 30 побед" };
  }

  const claims = getProfileCycleClaims(clubId, club.cycleId);
  if (claims[fromMember]) return { success: false, error: "Награда с этого игрока уже получена" };

  const allDone = allMembersCycleComplete(club);
  const usedPicks = new Set(Object.values(claims));
  const maxSlots = allDone ? 3 : 1;

  if (usedPicks.size >= maxSlots) {
    return { success: false, error: allDone
      ? "Вы уже получили все 3 награды за цикл"
      : "Можно получить только 1 награду, пока не все выполнили цель" };
  }
  if (usedPicks.has(pick)) {
    return { success: false, error: "Этот тип награды уже выбран в этом цикле" };
  }

  const profile = getCurrentProfile();
  if (!profile) return { success: false, error: "Профиль не найден" };

  const patch: Record<string, number> = {};
  if (pick === "coins") patch.coins = profile.coins + CLUB_REWARD_COINS;
  if (pick === "gems") patch.gems = profile.gems + CLUB_REWARD_GEMS;
  if (pick === "pp") patch.powerPoints = profile.powerPoints + CLUB_REWARD_PP;
  updateProfile(patch);

  const nextClaims = { ...claims, [fromMember]: pick };
  saveProfileCycleClaims(clubId, club.cycleId, nextClaims);

  if (Object.keys(nextClaims).length >= maxSlots && allDone) {
    club.rewardsClaimed += 1;
  }

  writeAll(all);
  return { success: true };
}

export function getAllClubs(): Club[] {
  return Object.values(readAll()).map(c => {
    const club = pruneChat(normalizeClub(c));
    ensureCycle(club);
    return club;
  });
}

/** Сумма глобальных кубков всех участников клуба. */
export function getClubTotalTrophies(club: Club): number {
  const profiles = getAllProfiles();
  let total = 0;
  for (const member of club.members) {
    const p = profiles[member.username];
    if (p) total += p.trophies ?? 0;
  }
  return total;
}

export function searchClubs(query: string): Club[] {
  const q = query.trim().toLowerCase();
  const all = getAllClubs();
  if (!q) return all;
  return all.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.description.toLowerCase().includes(q),
  );
}

export function getClub(id: string): Club | null {
  const raw = readAll()[id];
  if (!raw) return null;
  const all = readAll();
  const normalized = normalizeClub(raw);
  const chatBefore = normalized.chat.length;
  const club = pruneChat(normalized);
  const cycleChanged = ensureCycle(club);
  if (cycleChanged || club.chat.length !== chatBefore) {
    all[id] = club;
    writeAll(all);
  }
  return club;
}

export function getMyClub(): Club | null {
  const prof: any = getCurrentProfile();
  if (!prof?.clubId) return null;
  const club = getClub(prof.clubId);
  if (!club) {
    updateProfile({ clubId: null } as any);
    return null;
  }
  const me = getCurrentUsername();
  if (!me || !club.members.some(m => m.username === me)) {
    updateProfile({ clubId: null } as any);
    return null;
  }
  return club;
}

export function getMyClubInvites(): Club[] {
  const prof: any = getCurrentProfile();
  const ids: string[] = prof?.clubInvites ?? [];
  return ids.map(id => getClub(id)).filter(Boolean) as Club[];
}

/** @deprecated use getMyRank */
export function getMyRole(club: Club): ClubRole | null {
  const r = getMyRank(club);
  if (!r) return null;
  if (r === "owner" || r === "president") return "leader";
  if (r === "senior") return "helper";
  return "member";
}

function addMember(club: Club, username: string, rank: ClubRank = "junior"): void {
  if (club.members.some(m => m.username === username)) return;
  const finalRank = username === club.createdBy ? "owner" : rank;
  club.members.push({ username, rank: finalRank, joinedAt: Date.now(), cycleWins: 0 });
}

export function createClub(opts: {
  name: string;
  description: string;
  type: ClubType;
  avatarDataUrl?: string;
  avatarPreset?: string;
  avatarProfileIconId?: string;
}): { success: boolean; club?: Club; error?: string } {
  const me = getCurrentUsername();
  if (!me) return { success: false, error: "Не авторизован" };
  const name = opts.name.trim().slice(0, CLUB_NAME_MAX);
  if (!name) return { success: false, error: "Название обязательно" };
  const nameMod = guardianModerateWithBuiltIn(name, "club_name");
  if (!nameMod.allowed) return guardianBlockResult("club_name", nameMod);
  const description = (opts.description ?? "").trim().slice(0, CLUB_DESC_MAX);
  if (description) {
    const descMod = guardianModerateWithBuiltIn(description, "club_description");
    if (!descMod.allowed) return guardianBlockResult("club_description", descMod);
  }
  if (getMyClub()) return { success: false, error: "Сначала покиньте текущий клуб" };

  const all = readAll();
  const id = uid("club");
  const now = Date.now();
  const club: Club = {
    id, name, description, type: opts.type,
    avatarDataUrl: opts.avatarDataUrl,
    avatarPreset: opts.avatarPreset ?? CLUB_AVATAR_PRESETS[0].id,
    avatarProfileIconId: opts.avatarProfileIconId,
    createdAt: now,
    createdBy: me,
    members: [{ username: me, rank: "owner", joinedAt: now, cycleWins: 0 }],
    pendingRequests: [],
    cycleStartedAt: now,
    cycleId: 1,
    totalBattles: 0,
    rewardsClaimed: 0,
    chat: [systemMsg("Клуб создан. За 5 дней каждому нужно 30 побед — за это можно забрать награды!")],
    treasury: emptyClubTreasury(),
  };
  all[id] = club;
  writeAll(all);
  updateProfile({ clubId: id } as any, { skipTreasury: true });
  initTreasuryOnJoin(me);
  mirror(
    () => clubCloud.cloudCreateClub({ username: me, ...cloudActorBase() }, {
      id, name, description, type: opts.type,
      avatarPreset: club.avatarPreset, avatarProfileIconId: opts.avatarProfileIconId,
    }),
    () => pullClubToCache(id),
  );
  return { success: true, club };
}

export function joinClub(clubId: string): { success: boolean; pending?: boolean; error?: string } {
  const me = getCurrentUsername();
  if (!me) return { success: false, error: "Не авторизован" };
  if (getMyClub()) return { success: false, error: "Сначала покиньте текущий клуб" };
  const all = readAll();
  const club = all[clubId];
  if (!club) return { success: false, error: "Клуб не найден" };
  if (club.members.length >= CLUB_MEMBERS_MAX) return { success: false, error: "Клуб заполнен" };

  if (club.type === "open") {
    addMember(club, me);
    pushChat(club, systemMsg(`${me} вступил(а) в клуб`));
    writeAll(all);
    updateProfile({ clubId: club.id } as any, { skipTreasury: true });
    initTreasuryOnJoin(me);
    mirror(() => clubCloud.cloudJoinClub({ username: me, ...cloudActorBase() }, club.id), () => pullClubToCache(club.id));
    return { success: true };
  }
  if (club.pendingRequests.some(r => r.username === me)) {
    return { success: false, pending: true, error: "Заявка уже отправлена" };
  }
  club.pendingRequests = [...club.pendingRequests, { username: me, requestedAt: Date.now() }];
  writeAll(all);
  mirror(() => clubCloud.cloudJoinClub({ username: me, ...cloudActorBase() }, club.id), () => pullClubToCache(club.id));
  return { success: true, pending: true };
}

export function leaveClub(): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  if (!me) return { success: false, error: "Не авторизован" };
  const club = getMyClub();
  if (!club) return { success: false, error: "Вы не в клубе" };
  const profile = getCurrentProfile();
  const refundPatch = profile ? processTreasuryLeaveRefund(profile, club.id) : null;
  const all = readAll();
  const c = all[club.id];
  if (!c) return { success: false, error: "Клуб не найден" };
  const wasOwner = me === c.createdBy;
  c.members = c.members.filter(m => m.username !== me);
  if (wasOwner && c.members.length > 0) {
    const next = [...c.members].sort(
      (a, b) => rankIndex(getMemberRank(b)) - rankIndex(getMemberRank(a)),
    )[0];
    if (next) {
      c.createdBy = next.username;
      next.rank = "owner";
      pushChat(c, systemMsg(`${next.username} стал(а) новым хозяином клуба`));
    }
  }
  pushChat(c, systemMsg(`${me} покинул(а) клуб`));
  if (c.members.length === 0) delete all[club.id];
  writeAll(all);
  const profileUpdates: Record<string, unknown> = { clubId: null, clubTreasury: undefined };
  if (refundPatch) Object.assign(profileUpdates, refundPatch);
  updateProfile(profileUpdates as Partial<import("./localStorageAPI").UserProfile>, { skipTreasury: true });
  mirror(() => clubCloud.cloudLeaveClub({ username: me, ...cloudActorBase() }), () => pullClubToCache(club.id));
  return { success: true };
}

/** Назначить текущего игрока создателем клуба (для теста / восстановления). */
export function promoteCurrentUserToClubFounder(clubId: string): boolean {
  const me = getCurrentUsername();
  if (!me) return false;
  const patched = patchClub(clubId, (c) => {
    if (c.createdBy === me) return c;
    const prevFounder = c.createdBy;
    c.createdBy = me;
    for (const m of c.members) {
      if (m.username === me) m.rank = "owner";
      else if (m.username === prevFounder && getMemberRank(m) === "owner") m.rank = "president";
    }
    pushChat(c, systemMsg(`${me} назначен(а) создателем клуба`));
    return c;
  });
  return !!patched && patched.createdBy === me;
}

export function deleteClub(clubId: string): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  const all = readAll();
  const c = all[clubId];
  if (!c) return { success: false, error: "Клуб не найден" };
  if (c.createdBy !== me) return { success: false, error: "Только создатель может удалить клуб" };

  const profiles = getAllProfiles();
  for (const m of c.members) {
    if (profiles[m.username]) (profiles[m.username] as any).clubId = null;
  }
  saveProfiles(profiles);
  delete all[clubId];
  writeAll(all);
  updateProfile({ clubId: null } as any);
  return { success: true };
}

export function kickMember(clubId: string, username: string): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  const all = readAll();
  const c = all[clubId];
  if (!c) return { success: false, error: "Клуб не найден" };
  if (c.createdBy !== me) return { success: false, error: "Только создатель клуба может выгонять" };
  if (username === c.createdBy) return { success: false, error: "Нельзя выгнать создателя" };
  if (!c.members.some(m => m.username === username)) return { success: false, error: "Не участник" };
  c.members = c.members.filter(m => m.username !== username);
  pushChat(c, systemMsg(`${username} был(а) исключён(а) лидером`));
  writeAll(all);
  const profiles = getAllProfiles();
  if (profiles[username]) {
    (profiles[username] as any).clubId = null;
    saveProfiles(profiles);
  }
  mirror(() => clubCloud.cloudKickMember(me!, clubId, username), () => pullClubToCache(clubId));
  return { success: true };
}

export function setMemberRank(clubId: string, username: string, rank: ClubRank):
{ success: boolean; error?: string } {
  const me = getCurrentUsername();
  const all = readAll();
  const c = all[clubId];
  if (!c) return { success: false, error: "Клуб не найден" };
  if (c.createdBy !== me) return { success: false, error: "Только хозяин клуба может менять звания" };
  if (username === c.createdBy) return { success: false, error: "Нельзя сменить звание хозяина" };
  if (rank === "owner") return { success: false, error: "Звание хозяина нельзя передать так" };
  const m = c.members.find(x => x.username === username);
  if (!m) return { success: false, error: "Не участник" };
  m.rank = rank;
  pushChat(c, systemMsg(`${username} получил звание «${CLUB_RANK_META[rank].label}»`));
  writeAll(all);
  mirror(() => clubCloud.cloudSetRank(me!, clubId, username, rank), () => pullClubToCache(clubId));
  return { success: true };
}

/** @deprecated use setMemberRank */
export function setMemberRole(clubId: string, username: string, role: ClubRole):
{ success: boolean; error?: string } {
  const mapped: ClubRank = role === "leader" ? "president" : role === "helper" ? "senior" : "junior";
  return setMemberRank(clubId, username, mapped);
}

export function inviteUser(clubId: string, playerIdInput: string): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  const all = readAll();
  const c = all[clubId];
  if (!c) return { success: false, error: "Клуб не найден" };
  if (c.createdBy !== me) return { success: false, error: "Только создатель может приглашать" };
  if (c.members.length >= CLUB_MEMBERS_MAX) return { success: false, error: "Клуб заполнен" };

  const idQuery = normalizePlayerIdQuery(playerIdInput);
  if (!isValidPlayerIdFormat(idQuery)) {
    return { success: false, error: "Неверный ID (12 символов: 10 букв A–Z и 2 цифры)" };
  }

  const targetKey = findProfileStorageKey(idQuery);
  if (!targetKey) return { success: false, error: "Игрок с таким ID не найден" };

  const username = targetKey;
  if (c.members.some(m => m.username === username)) return { success: false, error: "Уже в клубе" };
  const profiles = getAllProfiles();
  if (!profiles[username]) return { success: false, error: "Игрок не найден" };
  const list: string[] = (profiles[username] as any).clubInvites ?? [];
  if (list.includes(clubId)) return { success: false, error: "Уже приглашён" };
  (profiles[username] as any).clubInvites = [...list, clubId];
  saveProfiles(profiles);
  pushChat(c, systemMsg(`${username} приглашён(а) в клуб`));
  writeAll(all);
  return { success: true };
}

export function acceptInvite(clubId: string): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  if (!me) return { success: false, error: "Не авторизован" };
  if (getMyClub()) return { success: false, error: "Сначала покиньте текущий клуб" };
  const all = readAll();
  const c = all[clubId];
  if (!c) return { success: false, error: "Клуб не найден" };
  if (c.members.length >= CLUB_MEMBERS_MAX) return { success: false, error: "Клуб заполнен" };
  addMember(c, me);
  pushChat(c, systemMsg(`${me} принял(а) приглашение`));
  writeAll(all);
  const prof: any = getCurrentProfile();
  const list: string[] = prof?.clubInvites ?? [];
  updateProfile({
    clubId: c.id,
    clubInvites: list.filter(id => id !== clubId),
  } as any, { skipTreasury: true });
  initTreasuryOnJoin(me);
  mirror(() => clubCloud.cloudJoinClub({ username: me, ...cloudActorBase() }, c.id), () => pullClubToCache(c.id));
  return { success: true };
}

export function declineInvite(clubId: string): void {
  const prof: any = getCurrentProfile();
  const list: string[] = prof?.clubInvites ?? [];
  updateProfile({ clubInvites: list.filter(id => id !== clubId) } as any);
}

export function approveJoinRequest(clubId: string, username: string):
{ success: boolean; error?: string } {
  const me = getCurrentUsername();
  const all = readAll();
  const c = all[clubId];
  if (!c) return { success: false, error: "Клуб не найден" };
  const meMember = c.members.find(m => m.username === me);
  const meta = meMember ? CLUB_RANK_META[getMemberRank(meMember)] : null;
  if (!meta?.canApproveJoin) {
    return { success: false, error: "Нет прав" };
  }
  if (!c.pendingRequests.some(r => r.username === username)) {
    return { success: false, error: "Заявки нет" };
  }
  if (c.members.length >= CLUB_MEMBERS_MAX) return { success: false, error: "Клуб заполнен" };
  c.pendingRequests = c.pendingRequests.filter(r => r.username !== username);
  addMember(c, username);
  pushChat(c, systemMsg(`${username} вступил(а) в клуб`));
  writeAll(all);
  const profiles = getAllProfiles();
  if (profiles[username]) {
    (profiles[username] as any).clubId = c.id;
    initTreasuryForUsername(profiles, username);
    saveProfiles(profiles);
  }
  mirror(() => clubCloud.cloudApproveJoin(me!, clubId, username), () => pullClubToCache(clubId));
  return { success: true };
}

export function denyJoinRequest(clubId: string, username: string): void {
  const me = getCurrentUsername();
  const all = readAll();
  const c = all[clubId];
  if (!c) return;
  const meMember = c.members.find(m => m.username === me);
  const meta = meMember ? CLUB_RANK_META[getMemberRank(meMember)] : null;
  if (!meta?.canApproveJoin) return;
  c.pendingRequests = c.pendingRequests.filter(r => r.username !== username);
  writeAll(all);
  mirror(() => clubCloud.cloudDenyJoin(me!, clubId, username), () => pullClubToCache(clubId));
}

export function setClubProfileIconAvatar(clubId: string, iconId: string):
{ success: boolean; error?: string } {
  const me = getCurrentUsername();
  const profile = getCurrentProfile();
  if (!me || !profile) return { success: false, error: "Не авторизован" };
  const all = readAll();
  const c = all[clubId];
  if (!c) return { success: false, error: "Клуб не найден" };
  if (c.createdBy !== me) return { success: false, error: "Только хозяин может ставить иконку клуба" };
  if (!isProfileIconUnlocked(profile, iconId)) {
    return { success: false, error: "Эта иконка не разблокирована у вас" };
  }
  c.avatarProfileIconId = iconId;
  c.avatarDataUrl = undefined;
  writeAll(all);
  mirror(() => clubCloud.cloudUpdateClubInfo(me, clubId, { avatarProfileIconId: iconId, avatarDataUrl: null }), () => pullClubToCache(clubId));
  return { success: true };
}

export function updateClubInfo(clubId: string, patch: {
  name?: string; description?: string; type?: ClubType;
  avatarDataUrl?: string | null; avatarPreset?: string;
  avatarProfileIconId?: string | null;
}): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  const all = readAll();
  const c = all[clubId];
  if (!c) return { success: false, error: "Клуб не найден" };
  if (c.createdBy !== me) return { success: false, error: "Только хозяин клуба может изменять клуб" };
  if (patch.name !== undefined) {
    const nextName = patch.name.trim().slice(0, CLUB_NAME_MAX) || c.name;
    if (nextName !== c.name) {
      const nameMod = guardianModerateWithBuiltIn(nextName, "club_name");
      if (!nameMod.allowed) return guardianBlockResult("club_name", nameMod);
      c.name = nextName;
    }
  }
  if (patch.description !== undefined) {
    const nextDesc = patch.description.slice(0, CLUB_DESC_MAX);
    const descMod = guardianModerateWithBuiltIn(nextDesc, "club_description");
    if (!descMod.allowed) return guardianBlockResult("club_description", descMod);
    c.description = nextDesc;
  }
  if (patch.type !== undefined) c.type = patch.type;
  if (patch.avatarDataUrl !== undefined) {
    c.avatarDataUrl = patch.avatarDataUrl ?? undefined;
    if (patch.avatarDataUrl) c.avatarProfileIconId = undefined;
  }
  if (patch.avatarPreset !== undefined) c.avatarPreset = patch.avatarPreset;
  if (patch.avatarProfileIconId !== undefined) {
    c.avatarProfileIconId = patch.avatarProfileIconId ?? undefined;
    if (patch.avatarProfileIconId) c.avatarDataUrl = undefined;
  }
  writeAll(all);
  // Mirror only lightweight fields to the cloud (skip heavy base64 avatar blobs).
  const cloudPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) cloudPatch.name = c.name;
  if (patch.description !== undefined) cloudPatch.description = c.description;
  if (patch.type !== undefined) cloudPatch.type = c.type;
  if (patch.avatarPreset !== undefined) cloudPatch.avatarPreset = c.avatarPreset;
  if (patch.avatarProfileIconId !== undefined) cloudPatch.avatarProfileIconId = c.avatarProfileIconId ?? null;
  if (Object.keys(cloudPatch).length > 0) {
    mirror(() => clubCloud.cloudUpdateClubInfo(me!, clubId, cloudPatch), () => pullClubToCache(clubId));
  }
  return { success: true };
}

export function shareBattleToClub(payload: ClubBattleSharePayload): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  if (!me) return { success: false, error: "Не авторизован" };
  if (!payload.replayId) return { success: false, error: "Запись боя недоступна" };

  const club = getMyClub();
  if (!club) return { success: false, error: "Вы не состоите в клубе" };

  const all = readAll();
  const c = all[club.id];
  if (!c) return { success: false, error: "Клуб не найден" };
  if (!c.members.some(m => m.username === me)) {
    return { success: false, error: "Только участники клуба могут делиться боями" };
  }

  pushChat(c, {
    id: uid("m"),
    sentAt: Date.now(),
    username: me,
    text: "",
    battleShare: payload,
  });
  writeAll(all);
  mirror(() => clubCloud.cloudSendClubChat(me, club.id, { battleShare: payload }), () => pullClubToCache(club.id));
  return { success: true };
}

export async function sendChatMessage(clubId: string, text: string): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  const me = getCurrentUsername();
  if (!me) return { success: false, error: "Не авторизован" };
  const trimmed = text.trim().slice(0, CLUB_CHAT_MAX);
  if (!trimmed) return { success: false, error: "Пустое сообщение" };
  const all = readAll();
  const c = all[clubId];
  if (!c) return { success: false, error: "Клуб не найден" };
  if (!c.members.some(m => m.username === me)) return { success: false, error: "Только участники клуба могут писать" };
  const mod = await guardianModerateForSend(trimmed, "club_chat");
  if (!mod.allowed) {
    pushChat(c, systemMsg(mod.userMessage));
    all[clubId] = c;
    writeAll(all);
    return { success: false, error: mod.userMessage, errorCode: MODERATION_BLOCKED_CODE };
  }
  pushChat(c, { id: uid("m"), sentAt: Date.now(), username: me, text: trimmed });
  writeAll(all);
  mirror(() => clubCloud.cloudSendClubChat(me, clubId, { text: trimmed }), () => pullClubToCache(clubId));
  scheduleGuardianAiClubRescan(clubId, 4000);

  scheduleAstralChatReply(trimmed, { channel: "club", senderUsername: me, clubId }, (replyText) => {
    appendClubAstralMessage(clubId, replyText);
  });

  return { success: true };
}

export function appendClubAstralMessage(clubId: string, text: string): boolean {
  const trimmed = text.trim().slice(0, CLUB_CHAT_MAX);
  if (!trimmed) return false;
  const all = readAll();
  const c = all[clubId];
  if (!c) return false;
  pushChat(c, {
    id: uid("m"),
    sentAt: Date.now(),
    username: ASTRAL_CHAT_USERNAME,
    text: trimmed,
    astral: true,
  });
  all[clubId] = c;
  writeAll(all);
  return true;
}

export function sendClubChatPin(
  clubId: string,
  pinId: string,
  brawlerId: string,
): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  const profile = getCurrentProfile();
  if (!me || !profile) return { success: false, error: "Не авторизован" };
  if (!pinId) return { success: false, error: "Пин не выбран" };
  const equipped = getEquippedPins(brawlerId, profile);
  if (!equipped.includes(pinId)) return { success: false, error: "Пин не экипирован" };

  const all = readAll();
  const c = all[clubId];
  if (!c) return { success: false, error: "Клуб не найден" };
  if (!c.members.some(m => m.username === me)) return { success: false, error: "Только участники клуба могут писать" };
  pushChat(c, { id: uid("m"), sentAt: Date.now(), username: me, text: "", pinId });
  writeAll(all);
  mirror(() => clubCloud.cloudSendClubChat(me, clubId, { pinId }), () => pullClubToCache(clubId));
  return { success: true };
}

export function recordClubWin(username: string, mode: string, won: boolean): void {
  if (!won || mode === "training") return;
  const profiles = getAllProfiles();
  const prof: any = profiles[username];
  const clubId: string | undefined = prof?.clubId;
  if (!clubId) return;

  const all = readAll();
  const club = normalizeClub(all[clubId]);
  if (!club) return;

  ensureCycle(club);

  const me = club.members.find(m => m.username === username);
  if (!me) return;

  if (me.cycleWins < CLUB_WINS_PER_MEMBER) {
    me.cycleWins += 1;
    if (me.cycleWins === CLUB_WINS_PER_MEMBER) {
      pushChat(club, systemMsg(`${username} выполнил(а) цель цикла — 30 побед!`));
    }
  }

  club.totalBattles += 1;
  all[clubId] = club;
  writeAll(all);
  mirror(() => clubCloud.cloudRecordClubWin(username, prof?.trophies ?? 0), () => pullClubToCache(clubId));
}

export function patchClub(clubId: string, fn: (club: Club) => Club): Club | null {
  const all = readAll();
  const raw = all[clubId];
  if (!raw) return null;
  const next = fn(normalizeClub(raw));
  all[clubId] = next;
  writeAll(all);
  return next;
}

/** Системное сообщение в чат клуба (сохраняется в localStorage). */
export function appendClubSystemMessage(clubId: string, text: string): boolean {
  const all = readAll();
  const raw = all[clubId];
  if (!raw) return false;
  const club = normalizeClub(raw);
  pushChat(club, systemMsg(text));
  all[clubId] = club;
  writeAll(all);
  return true;
}

export function setClubBossRaidBoss(clubId: string, bossId: string): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  if (!me) return { success: false, error: "Не авторизован" };
  const club = getClub(clubId);
  if (!club) return { success: false, error: "Клуб не найден" };
  if (!club.members.some(m => m.username === me)) {
    return { success: false, error: "Вы не в этом клубе" };
  }
  const raid = club.bossRaid ?? defaultClubBossRaid();
  if (raid.partyCode) {
    return { success: false, error: "Сбор команды уже идёт — босса нельзя сменить" };
  }
  patchClub(clubId, c => ({
    ...c,
    bossRaid: {
      ...(c.bossRaid ?? defaultClubBossRaid()),
      bossId,
      updatedAt: Date.now(),
    },
  }));
  mirror(() => clubCloud.cloudClubBossRaid(me, clubId, { bossId, updatedAt: Date.now() }), () => pullClubToCache(clubId));
  return { success: true };
}

export function clearClubBossRaid(clubId: string): void {
  patchClub(clubId, c => ({
    ...c,
    bossRaid: { ...defaultClubBossRaid(), bossId: c.bossRaid?.bossId ?? null, updatedAt: Date.now() },
  }));
}

export const CLUB_BOSS_RAID_CHANGED_EVENT = "clash_club_boss_raid_changed";

export function findClubIdByBossRaidPartyCode(partyCode: string | null | undefined): string | null {
  if (!partyCode) return null;
  const norm = partyCode.trim().toUpperCase();
  const all = readAll();
  for (const id of Object.keys(all)) {
    const club = normalizeClub(all[id]);
    if (club.bossRaid?.partyCode?.toUpperCase() === norm) return id;
  }
  return null;
}

/** Завершить клубный сбор команды на босса (сохраняет выбранного босса). */
export function abortClubBossRaidRecruitment(clubId: string): void {
  clearClubBossRaid(clubId);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CLUB_BOSS_RAID_CHANGED_EVENT));
  }
}

export function abortClubBossRaidRecruitmentByPartyCode(partyCode: string | null | undefined): void {
  const clubId = findClubIdByBossRaidPartyCode(partyCode);
  if (clubId) abortClubBossRaidRecruitment(clubId);
}

export function syncClubBossRaidFromParty(clubId: string): void {
  const club = getClub(clubId);
  if (!club?.bossRaid?.partyCode) return;
  const code = club.bossRaid.partyCode;
  const all = readAll();
  const partiesRaw = localStorage.getItem("clash_parties_v1");
  let room: { code: string; leaderPlayerId: string; members: { playerId: string }[] } | null = null;
  try {
    const parsed = partiesRaw ? JSON.parse(partiesRaw) : {};
    room = parsed[code.toUpperCase()] ?? null;
  } catch { /* ignore */ }
  if (!room) {
    clearClubBossRaid(clubId);
    return;
  }
  const ids = [
    normalizePlayerIdQuery(room.leaderPlayerId),
    ...room.members.map(m => normalizePlayerIdQuery(m.playerId)),
  ];
  patchClub(clubId, c => ({
    ...c,
    bossRaid: {
      ...(c.bossRaid ?? defaultClubBossRaid()),
      joinedPlayerIds: [...new Set(ids)],
      updatedAt: Date.now(),
    },
  }));
}

export function findPlayerIdByUsername(username: string): string | null {
  const profiles = getAllProfiles();
  const raw = profiles[username];
  const pid = (raw as { playerId?: string } | undefined)?.playerId;
  return pid ? normalizePlayerIdQuery(pid) : null;
}

if (typeof window !== "undefined" && !(window as any).__clashClubsHookInstalled) {
  (window as any).__clashClubsHookInstalled = true;
  window.addEventListener("clash:battle-finished", (e: Event) => {
    const detail = (e as CustomEvent).detail as { username: string; mode: string; won?: boolean } | undefined;
    if (!detail) return;
    try { recordClubWin(detail.username, detail.mode, !!detail.won); } catch { /* ignore */ }
  });
}
