// =========================================================================
// GIFTS — admin broadcast & per-player claim queue.
// Admin sends a multi-item gift package; the package is appended to every
// registered profile's pending-gift queue. Players claim them one-by-one
// from the main menu.
// =========================================================================

import { CHESTS, type ChestRarity } from "./chests";
import { getEffectiveBrawlerGemCost, getEffectivePetGemCost } from "./characterBalance";
import { PETS } from "../entities/PetData";
import { BRAWLERS } from "../entities/BrawlerData";
import { COLLECTIBLE_PINS, getCollectiblePin, PIN_DUPLICATE_COINS } from "../entities/CollectiblePinData";
import {
  getCurrentProfile, getAllProfiles, saveProfiles, updateProfile, grantPin,
  type UserProfile,
} from "./localStorageAPI";
import { PROFILE_ICON_BY_ID, PROFILE_ICON_DISPLAY_LABEL } from "../data/profileIcons";
import { DEVELOPER_TITLE_ID, grantExclusiveTitle } from "../data/exclusiveTitles";
import { getMasteryTitleText } from "../data/brawlerMastery";
import { grantProfileIcon, PROFILE_ICON_GEM_COST } from "./profileIconUtils";
import { notifyInboxGiftBroadcast } from "./messages";

export type GiftItem =
  | { kind: "coins";       amount: number }
  | { kind: "gems";        amount: number }
  | { kind: "powerPoints"; amount: number }
  | { kind: "chest";       rarity: ChestRarity; count: number }
  | { kind: "pet";         petId: string }
  | { kind: "brawler";     brawlerId: string }
  | { kind: "pin";         pinId: string }
  | { kind: "profileIcon"; iconId: string }
  | { kind: "exclusiveTitle"; titleId: string };

export interface PendingGift {
  id: string;
  message: string;        // up to 200 chars
  items: GiftItem[];      // up to 5
  sentAt: number;
  fromAdmin: string;      // "developers" / admin display name / "anonymous"
  fromPlayer?: boolean;
  senderName?: string;
  senderPlayerId?: string;
  anonymous?: boolean;
}

export function getGiftSenderTitle(gift: PendingGift): string {
  if (gift.fromPlayer) {
    if (gift.anonymous) return "Подарок от игрока";
    return gift.senderName ? `Подарок от ${gift.senderName}` : "Подарок от игрока";
  }
  if (gift.fromAdmin === "developers") return "Подарок от разработчиков";
  return "Подарок";
}

export const MAX_GIFT_ITEMS    = 5;
export const MAX_GIFT_MESSAGE  = 200;
export const MAX_AMOUNT_GEMS   = 10000;
export const MAX_AMOUNT_COINS  = 10000;
export const MAX_AMOUNT_PP     = 10000;
export const MAX_AMOUNT_CHEST  = 50;

const GIFT_FIELD = "pendingGifts" as const; // stored on UserProfile (free-form)

// ── Read pending gifts ───────────────────────────────────────────────────
export function getPendingGifts(): PendingGift[] {
  const p = getCurrentProfile();
  if (!p) return [];
  return (p.pendingGifts as unknown as PendingGift[] | undefined) ?? [];
}

// ── Broadcast to all users ───────────────────────────────────────────────
export function broadcastGift(opts: {
  items: GiftItem[];
  message: string;
  fromAdmin?: string;
}): { success: boolean; recipients: number; error?: string } {
  if (opts.items.length === 0) return { success: false, recipients: 0, error: "Нет предметов" };
  if (opts.items.length > MAX_GIFT_ITEMS) {
    return { success: false, recipients: 0, error: `Не более ${MAX_GIFT_ITEMS} предметов` };
  }
  const message = (opts.message ?? "").slice(0, MAX_GIFT_MESSAGE);
  const all = getAllProfiles();
  const id = `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const stamp = Date.now();
  let recipients = 0;
  for (const username of Object.keys(all)) {
    const prof = all[username] as any;
    const queue: PendingGift[] = prof[GIFT_FIELD] ?? [];
    queue.push({
      id,
      message,
      items: opts.items,
      sentAt: stamp,
      fromAdmin: opts.fromAdmin ?? "developers",
    });
    prof[GIFT_FIELD] = queue;
    recipients += 1;
  }
  saveProfiles(all);
  notifyInboxGiftBroadcast({
    giftId: id,
    message,
    items: opts.items,
    recipients,
  });
  return { success: true, recipients };
}

/** Подарок одному игроку (используется в панели разработчика). */
export { sendGiftToPlayer } from "./playerAdmin";

// ── Claim a gift ─────────────────────────────────────────────────────────
export function claimGift(giftId: string): { success: boolean; error?: string; gift?: PendingGift } {
  const p = getCurrentProfile();
  if (!p) return { success: false, error: "Не авторизован" };
  const queue: PendingGift[] = (p.pendingGifts as unknown as PendingGift[] | undefined) ?? [];
  const gift = queue.find(g => g.id === giftId);
  if (!gift) return { success: false, error: "Подарок не найден" };

  // Apply each item to a fresh patch on top of the current profile.
  let patch: Partial<UserProfile> & Record<string, any> = {};
  const cur = { ...p } as UserProfile & Record<string, any>;
  // Apply items one-by-one, mutating cur+patch so subsequent items see the
  // up-to-date totals (used when multiple coins/gems items are bundled).
  for (const it of gift.items) {
    applyGiftItem(it, cur, patch);
  }
  // Remove the claimed gift from the queue.
  patch[GIFT_FIELD] = queue.filter(g => g.id !== giftId);
  const inbox = (p.inbox ?? []).map((m) =>
    m.giftId === giftId ? { ...m, read: true } : m,
  );
  if (inbox.length) patch.inbox = inbox;
  updateProfile(patch);
  return { success: true, gift: { ...gift } };
}

function applyGiftItem(
  it: GiftItem,
  cur: UserProfile & Record<string, any>,
  patch: Partial<UserProfile> & Record<string, any>,
): void {
  switch (it.kind) {
    case "coins": {
      const next = (patch.coins ?? cur.coins) + Math.max(0, it.amount);
      patch.coins = next; cur.coins = next;
      break;
    }
    case "gems": {
      const next = (patch.gems ?? cur.gems) + Math.max(0, it.amount);
      patch.gems = next; cur.gems = next;
      break;
    }
    case "powerPoints": {
      const next = (patch.powerPoints ?? cur.powerPoints) + Math.max(0, it.amount);
      patch.powerPoints = next; cur.powerPoints = next;
      break;
    }
    case "chest": {
      const baseInv = patch.chestInventory ?? cur.chestInventory;
      const nextInv = {
        ...baseInv,
        [it.rarity]: (baseInv[it.rarity] || 0) + Math.max(0, it.count),
      };
      patch.chestInventory = nextInv; cur.chestInventory = nextInv;
      break;
    }
    case "pet": {
      const owned = (patch.unlockedPets ?? cur.unlockedPets ?? []) as string[];
      if (owned.includes(it.petId)) {
        const def = PETS.find(p => p.id === it.petId);
        if (def) {
          const refund = Math.round(getEffectivePetGemCost(def.rarity) * 0.5);
          const nextG = (patch.gems ?? cur.gems) + refund;
          patch.gems = nextG; cur.gems = nextG;
        }
      } else {
        const nextOwned = [...owned, it.petId];
        const nextNew = [...((patch.newPets ?? cur.newPets ?? []) as string[]), it.petId];
        patch.unlockedPets = nextOwned; cur.unlockedPets = nextOwned;
        patch.newPets = nextNew; cur.newPets = nextNew;
      }
      break;
    }
    case "brawler": {
      const owned = (patch.unlockedBrawlers ?? cur.unlockedBrawlers) as string[];
      if (owned.includes(it.brawlerId)) {
        const def = BRAWLERS.find(b => b.id === it.brawlerId);
        if (def) {
          const refund = Math.round(getEffectiveBrawlerGemCost(def.rarity) * 0.5);
          const nextG = (patch.gems ?? cur.gems) + refund;
          patch.gems = nextG; cur.gems = nextG;
        }
      } else {
        const nextOwned = [...owned, it.brawlerId];
        const nextNew = [...((patch.newBrawlers ?? cur.newBrawlers ?? []) as string[]), it.brawlerId];
        patch.unlockedBrawlers = nextOwned; cur.unlockedBrawlers = nextOwned;
        patch.newBrawlers = nextNew; cur.newBrawlers = nextNew;
      }
      break;
    }
    case "pin": {
      const ownedPins = (patch.ownedPins ?? cur.ownedPins ?? []) as string[];
      if (ownedPins.includes(it.pinId)) {
        const def = getCollectiblePin(it.pinId);
        const refund = def ? PIN_DUPLICATE_COINS[def.rarity] : 100;
        const nextC = (patch.coins ?? cur.coins) + refund;
        patch.coins = nextC; cur.coins = nextC;
      } else {
        const next = [...ownedPins, it.pinId];
        patch.ownedPins = next;
        cur.ownedPins = next;
      }
      break;
    }
    case "profileIcon": {
      const stored = (patch.unlockedProfileIcons ?? cur.unlockedProfileIcons ?? []) as string[];
      if (!stored.includes(it.iconId)) {
        const next = grantProfileIcon(cur as UserProfile, it.iconId);
        patch.unlockedProfileIcons = next;
        cur.unlockedProfileIcons = next;
      } else {
        const refund = PROFILE_ICON_GEM_COST;
        const nextG = (patch.gems ?? cur.gems) + refund;
        patch.gems = nextG;
        cur.gems = nextG;
      }
      break;
    }
    case "exclusiveTitle": {
      const curTitles = (patch.masteryTitlesUnlocked ?? cur.masteryTitlesUnlocked ?? []) as string[];
      const nextTitles = grantExclusiveTitle(curTitles, it.titleId);
      patch.masteryTitlesUnlocked = nextTitles;
      cur.masteryTitlesUnlocked = nextTitles;
      break;
    }
  }
}

// ── Helpers for the admin UI ─────────────────────────────────────────────
export function describeGiftItem(it: GiftItem): string {
  switch (it.kind) {
    case "coins":       return `${it.amount} монет`;
    case "gems":        return `${it.amount} кристаллов`;
    case "powerPoints": return `${it.amount} очков силы`;
    case "chest":       return `${CHESTS[it.rarity].name} ×${it.count}`;
    case "pet":         return `Питомец «${PETS.find(p => p.id === it.petId)?.name ?? it.petId}»`;
    case "brawler":     return `Боец «${BRAWLERS.find(b => b.id === it.brawlerId)?.name ?? it.brawlerId}»`;
    case "pin":         return "Пин";
    case "profileIcon": return PROFILE_ICON_DISPLAY_LABEL;
    case "exclusiveTitle": return `Титул «${getMasteryTitleText(it.titleId) ?? it.titleId}»`;
  }
}

export function listGiftExclusiveTitleOptions(): { id: string; label: string }[] {
  return [{ id: DEVELOPER_TITLE_ID, label: "РАЗРАБОТЧИК" }];
}

export function listGiftProfileIconOptions(): { id: string; label: string }[] {
  return [...PROFILE_ICON_BY_ID.values()]
    .filter(i => i.category === "misc")
    .map(i => ({ id: i.id, label: PROFILE_ICON_DISPLAY_LABEL }));
}

export function listGiftPinOptions(): { id: string; label: string }[] {
  return COLLECTIBLE_PINS.map(p => ({ id: p.id, label: `${p.label} (${p.rarity})` }));
}
