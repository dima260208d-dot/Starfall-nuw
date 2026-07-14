import { pushInboxToUsername } from "../messages";
import { getProfileByPlayerId } from "../playerGiftSend";
import { getAllProfiles, saveProfiles } from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import { LIKE_REWARD_CHANCE, likePublishedMap } from "./playerMapRegistry";

export const MAP_REWARD_INBOX_PREFIX = "map_reward_pending_";

export type MapRewardBundle = {
  powerPoints: number;
  crystals: number;
  coins: number;
};

export interface MapRewardInboxPayload {
  bundle: MapRewardBundle;
  claimed: boolean;
  mapNames: string[];
}

function rollRewardType(): keyof MapRewardBundle {
  const r = Math.random();
  if (r < 0.34) return "powerPoints";
  if (r < 0.67) return "crystals";
  return "coins";
}

function findProfileKeyByPlayerId(playerId: string): string | null {
  const all = getAllProfiles();
  const target = normalizePlayerIdQuery(playerId);
  for (const [key, prof] of Object.entries(all)) {
    if (prof?.playerId && normalizePlayerIdQuery(prof.playerId) === target) return key;
    if (key === prof?.username) return key;
  }
  return null;
}

/** Одно консolidated-сообщение на игрока — редактируется, пока не заберут награду. */
export function upsertMapRewardInbox(
  authorId: string,
  mapName: string,
  add: Partial<MapRewardBundle>,
): void {
  const prof = getProfileByPlayerId(authorId);
  if (!prof?.username) return;

  const all = getAllProfiles();
  const key = findProfileKeyByPlayerId(authorId);
  if (!key) return;

  const raw = all[key]!;
  const inbox = [...(raw.inbox ?? [])];
  const msgId = `${MAP_REWARD_INBOX_PREFIX}${normalizePlayerIdQuery(authorId)}`;
  const idx = inbox.findIndex(m => m.id === msgId);

  const parsePayload = (body: string): MapRewardInboxPayload => {
    try {
      return JSON.parse(body) as MapRewardInboxPayload;
    } catch {
      return { bundle: { powerPoints: 0, crystals: 0, coins: 0 }, claimed: false, mapNames: [] };
    }
  };

  if (idx >= 0) {
    const existing = inbox[idx]!;
    const payload = parsePayload(existing.body);
    if (payload.claimed) {
      const fresh: MapRewardInboxPayload = {
        bundle: {
          powerPoints: add.powerPoints ?? 0,
          crystals: add.crystals ?? 0,
          coins: add.coins ?? 0,
        },
        claimed: false,
        mapNames: [mapName],
      };
      inbox[idx] = {
        ...existing,
        title: "Награда за карту",
        body: JSON.stringify(fresh),
        sentAt: Date.now(),
        read: false,
      };
    } else {
      payload.bundle.powerPoints += add.powerPoints ?? 0;
      payload.bundle.crystals += add.crystals ?? 0;
      payload.bundle.coins += add.coins ?? 0;
      if (!payload.mapNames.includes(mapName)) payload.mapNames.push(mapName);
      inbox[idx] = {
        ...existing,
        body: JSON.stringify(payload),
        sentAt: Date.now(),
        read: false,
      };
    }
  } else {
    const payload: MapRewardInboxPayload = {
      bundle: {
        powerPoints: add.powerPoints ?? 0,
        crystals: add.crystals ?? 0,
        coins: add.coins ?? 0,
      },
      claimed: false,
      mapNames: [mapName],
    };
    inbox.unshift({
      id: msgId,
      kind: "gift",
      title: "Награда за карту",
      body: JSON.stringify(payload),
      sentAt: Date.now(),
      read: false,
    });
  }

  all[key] = { ...raw, inbox };
  saveProfiles(all);
}

export function grantMapLikeReward(authorId: string, mapName: string): boolean {
  if (Math.random() >= LIKE_REWARD_CHANCE) return false;
  const type = rollRewardType();
  upsertMapRewardInbox(authorId, mapName, { [type]: 1 });
  return true;
}

export function processPlayerMapLike(publishId: string, mapName: string, authorId: string): void {
  likePublishedMap(publishId);
  grantMapLikeReward(authorId, mapName);
}

export function claimMapRewardInbox(messageId: string): boolean {
  const prof = getAllProfiles();
  const me = Object.entries(prof).find(([, p]) => p?.inbox?.some(m => m.id === messageId));
  if (!me) return false;
  const [key, profile] = me;
  const inbox = [...(profile.inbox ?? [])];
  const idx = inbox.findIndex(m => m.id === messageId);
  if (idx < 0) return false;

  let payload: MapRewardInboxPayload;
  try {
    payload = JSON.parse(inbox[idx]!.body) as MapRewardInboxPayload;
  } catch {
    return false;
  }
  if (payload.claimed) return false;

  const updated = { ...profile };
  if (payload.bundle.coins) updated.coins = (updated.coins ?? 0) + payload.bundle.coins;
  if (payload.bundle.crystals) updated.crystals = (updated.crystals ?? 0) + payload.bundle.crystals;
  if (payload.bundle.powerPoints) updated.powerPoints = (updated.powerPoints ?? 0) + payload.bundle.powerPoints;

  payload.claimed = true;
  inbox[idx] = { ...inbox[idx]!, body: JSON.stringify(payload), read: true };
  updated.inbox = inbox;
  prof[key] = updated;
  saveProfiles(prof);
  return true;
}

export function isMapRewardMessage(msg: { id: string; body: string }): boolean {
  return msg.id.startsWith(MAP_REWARD_INBOX_PREFIX);
}

export function parseMapRewardMessage(body: string): MapRewardInboxPayload | null {
  try {
    return JSON.parse(body) as MapRewardInboxPayload;
  } catch {
    return null;
  }
}

export function formatMapRewardSummary(payload: MapRewardInboxPayload): string {
  const parts: string[] = [];
  if (payload.bundle.powerPoints) parts.push(`${payload.bundle.powerPoints} поинт(ов) силы`);
  if (payload.bundle.crystals) parts.push(`${payload.bundle.crystals} кристалл(ов)`);
  if (payload.bundle.coins) parts.push(`${payload.bundle.coins} монет(ы)`);
  const maps = payload.mapNames.length ? payload.mapNames.join(", ") : "ваша карта";
  return `За карту «${maps}»: ${parts.join(", ") || "награда"}`;
}
