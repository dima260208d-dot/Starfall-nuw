// =========================================================================
// PLAYER ADMIN — поиск игроков, блокировка, удаление, персональные подарки.
// =========================================================================

import {
  getAllProfiles,
  saveProfiles,
  getCurrentUsername,
  setCurrentUsername,
  normalizeProfile,
  findProfileStorageKey,
  type UserProfile,
  type BattleRecord,
} from "./localStorageAPI";
import { formatPlayerIdDisplay, normalizePlayerIdQuery } from "./playerId";
import type { GiftItem } from "./gifts";
import { notifyInboxGiftToPlayer } from "./messages";
import { isLiveOpsAdminSession, appendLiveCommand, newLiveCommandId } from "../lib/configServerPublish";

export interface PlayerAdminSummary {
  storageKey: string;
  username: string;
  playerId: string;
  blocked: boolean;
  blockedAt?: number;
  createdAt: number;
  coins: number;
  gems: number;
  powerPoints: number;
  trophies: number;
  totalGamesPlayed: number;
  totalWins: number;
  totalLosses: number;
  clashPassLevel: number;
  unlockedBrawlers: number;
  pendingGifts: number;
  inboxUnread: number;
  battleHistory: BattleRecord[];
  modeStats: UserProfile["modeStats"];
  unlockedBrawlerIds: string[];
  chestInventory: UserProfile["chestInventory"];
  masteryTitlesUnlocked: string[];
}

export function listAllPlayerKeys(): string[] {
  return Object.keys(getAllProfiles()).sort((a, b) => a.localeCompare(b, "ru"));
}

export function searchPlayerKeys(query: string, limit = 30): string[] {
  const q = query.trim().toLowerCase();
  const idQ = normalizePlayerIdQuery(query);
  const all = getAllProfiles();
  const keys = listAllPlayerKeys();
  if (!q) return keys.slice(0, limit);
  return keys.filter(k => {
    if (k.toLowerCase().includes(q)) return true;
    const raw = all[k];
    if (!raw) return false;
    const pid = normalizeProfile(raw).playerId;
    if (pid && pid.toLowerCase().includes(idQ)) return true;
    return false;
  }).slice(0, limit);
}

export function playerSearchLabel(storageKey: string): string {
  const all = getAllProfiles();
  const raw = all[storageKey];
  if (!raw) return storageKey;
  const norm = normalizeProfile(raw);
  const pid = norm.playerId ? formatPlayerIdDisplay(norm.playerId) : "";
  return pid ? `${norm.username} · ${pid}` : norm.username;
}

export function getPlayerAdminSummary(storageKey: string): PlayerAdminSummary | null {
  const all = getAllProfiles();
  const raw = all[storageKey];
  if (!raw) return null;
  const p = normalizeProfile(raw);
  const inbox = p.inbox ?? [];
  const pending = (p.pendingGifts as unknown[] | undefined) ?? [];
  return {
    storageKey,
    username: p.username,
    playerId: p.playerId ?? "",
    blocked: !!p.accountBlocked,
    blockedAt: p.blockedAt,
    createdAt: p.createdAt,
    coins: p.coins,
    gems: p.gems,
    powerPoints: p.powerPoints,
    trophies: p.trophies,
    totalGamesPlayed: p.totalGamesPlayed,
    totalWins: p.totalWins,
    totalLosses: p.totalLosses,
    clashPassLevel: p.clashPassLevel,
    unlockedBrawlers: p.unlockedBrawlers.length,
    pendingGifts: pending.length,
    inboxUnread: inbox.filter(m => !m.read).length,
    battleHistory: [...(p.battleHistory ?? [])].sort((a, b) => b.ts - a.ts),
    modeStats: p.modeStats,
    unlockedBrawlerIds: p.unlockedBrawlers,
    chestInventory: p.chestInventory,
    masteryTitlesUnlocked: p.masteryTitlesUnlocked ?? [],
  };
}

export function isAccountBlocked(storageKey: string): boolean {
  const all = getAllProfiles();
  const raw = all[storageKey];
  return !!raw?.accountBlocked;
}

export function blockPlayer(storageKey: string): { success: boolean; error?: string } {
  const all = getAllProfiles();
  if (!all[storageKey]) return { success: false, error: "Игрок не найден" };
  all[storageKey] = {
    ...all[storageKey],
    accountBlocked: true,
    blockedAt: Date.now(),
  };
  saveProfiles(all);
  const current = getCurrentUsername();
  if (current && findProfileStorageKey(current) === storageKey) {
    setCurrentUsername(null);
  }
  return { success: true };
}

export function unblockPlayer(storageKey: string): { success: boolean; error?: string } {
  const all = getAllProfiles();
  if (!all[storageKey]) return { success: false, error: "Игрок не найден" };
  all[storageKey] = {
    ...all[storageKey],
    accountBlocked: false,
    blockedAt: undefined,
  };
  saveProfiles(all);
  return { success: true };
}

export function deletePlayer(storageKey: string): { success: boolean; error?: string } {
  const all = getAllProfiles();
  if (!all[storageKey]) return { success: false, error: "Игрок не найден" };
  delete all[storageKey];
  saveProfiles(all);
  const current = getCurrentUsername();
  if (current && findProfileStorageKey(current) === storageKey) {
    setCurrentUsername(null);
  }
  return { success: true };
}

const GIFT_FIELD = "pendingGifts" as const;

export function sendGiftToPlayer(opts: {
  storageKey: string;
  items: GiftItem[];
  message: string;
}): { success: boolean; error?: string } {
  const all = getAllProfiles();
  const prof = all[opts.storageKey] as Record<string, unknown> | undefined;
  if (!prof) return { success: false, error: "Игрок не найден" };
  if (!opts.items.length) return { success: false, error: "Добавьте хотя бы один предмет" };

  const giftId = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const message = (opts.message ?? "Подарок от разработчиков").slice(0, 200);
  const stamp = Date.now();
  const queue = (prof[GIFT_FIELD] as unknown[] | undefined) ?? [];
  queue.push({
    id: giftId,
    message,
    items: opts.items,
    sentAt: stamp,
    fromAdmin: "developers",
  });
  prof[GIFT_FIELD] = queue;
  saveProfiles(all);

  const notified = notifyInboxGiftToPlayer(opts.storageKey, giftId, message);
  if (!notified) {
    return { success: false, error: "Подарок в очередь добавлен, но входящее не создано" };
  }
  if (isLiveOpsAdminSession()) {
    void appendLiveCommand({
      type: "gift_player",
      id: giftId,
      sentAt: stamp,
      username: opts.storageKey,
      items: opts.items,
      message,
    });
  }
  return { success: true };
}
