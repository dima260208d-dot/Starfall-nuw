import {
  getAllProfiles,
  getCurrentProfile,
  getCurrentUsername,
  saveProfiles,
  findProfileStorageKeyByPlayerId,
  normalizeProfile,
  updateProfile,
  type UserProfile,
} from "./localStorageAPI";
import { isValidPlayerIdFormat, normalizePlayerIdQuery } from "./playerId";
import type { GiftItem } from "./gifts";
import { MAX_GIFT_ITEMS, MAX_GIFT_MESSAGE, type PendingGift } from "./gifts";
import { notifyInboxPlayerGift } from "./messages";
import { trackFriendshipGift } from "./social/friendship";

const GIFT_FIELD = "pendingGifts" as const;

export function getProfileByPlayerId(playerIdInput: string): UserProfile | null {
  const key = findProfileStorageKeyByPlayerId(playerIdInput);
  if (!key) return null;
  const all = getAllProfiles();
  const raw = all[key];
  if (!raw) return null;
  return normalizeProfile(raw);
}

export function sendPlayerGiftPack(opts: {
  recipientPlayerId: string;
  items: GiftItem[];
  message: string;
  anonymous: boolean;
  payGems?: number;
  paidRub?: boolean;
}): { success: boolean; error?: string; giftId?: string } {
  const sender = getCurrentProfile();
  if (!sender) return { success: false, error: "Не авторизован" };

  const idNorm = normalizePlayerIdQuery(opts.recipientPlayerId);
  if (!isValidPlayerIdFormat(idNorm)) {
    return { success: false, error: "Введите корректный ID игрока (12 символов, как в профиле)" };
  }

  const storageKey = findProfileStorageKeyByPlayerId(idNorm);
  if (!storageKey) return { success: false, error: "Игрок с таким ID не найден" };
  const me = getCurrentUsername();
  if (me && storageKey === me) {
    return { success: false, error: "Нельзя отправить подарок самому себе" };
  }

  if (opts.items.length === 0) return { success: false, error: "Пустой набор" };
  if (opts.items.length > MAX_GIFT_ITEMS) {
    return { success: false, error: `Не более ${MAX_GIFT_ITEMS} предметов` };
  }

  if (opts.payGems != null && opts.payGems > 0) {
    if (sender.gems < opts.payGems) {
      return { success: false, error: "Недостаточно кристаллов" };
    }
    updateProfile({ gems: sender.gems - opts.payGems });
  }

  const all = getAllProfiles();
  const prof = all[storageKey] as Record<string, unknown>;
  const giftId = `pg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const message = (opts.message ?? "").slice(0, MAX_GIFT_MESSAGE);
  const stamp = Date.now();

  const gift: PendingGift = {
    id: giftId,
    message,
    items: opts.items,
    sentAt: stamp,
    fromAdmin: opts.anonymous ? "anonymous" : (sender.username || "player"),
    fromPlayer: true,
    senderName: opts.anonymous ? undefined : sender.username,
    senderPlayerId: opts.anonymous ? undefined : sender.playerId,
    anonymous: opts.anonymous,
  };

  const queue = (prof[GIFT_FIELD] as PendingGift[] | undefined) ?? [];
  queue.push(gift);
  prof[GIFT_FIELD] = queue;
  saveProfiles(all);

  const inboxOk = notifyInboxPlayerGift({
    storageKey,
    giftId,
    message,
    senderLabel: opts.anonymous ? "Анонимный игрок" : (sender.username || "Игрок"),
    anonymous: opts.anonymous,
  });

  if (!inboxOk) {
    return { success: false, error: "Подарок создан, но уведомление не доставлено" };
  }

  if (sender.playerId) {
    trackFriendshipGift(sender.playerId, idNorm);
  }

  return { success: true, giftId };
}
