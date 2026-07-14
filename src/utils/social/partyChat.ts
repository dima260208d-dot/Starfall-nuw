import {
  getCurrentProfile,
  getCurrentUsername,
  getEquippedPins,
} from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import {
  PARTY_CHANGED_EVENT,
  getMyPartyRoom,
  mutateMyPartyRoom,
  type PartyChatMessage,
  PARTY_CHAT_MAX_TEXT,
} from "./party";
import {
  ASTRAL_CHAT_PLAYER_ID,
  ASTRAL_CHAT_USERNAME,
  scheduleAstralChatReply,
} from "../../ai/astralChatMention";
import { guardianAiFilterMessages, guardianModerateForSend } from "../../ai/contentGuardianAi";
import {
  GUARDIAN_NAME,
  guardianFilterChatHistory,
  isGuardianSkippableMessage,
  MODERATION_BLOCKED_CODE,
  MODERATION_CHAT_PURGED,
} from "../../ai/contentGuardian";
import { pruneChatByLimit } from "../chatLimits";
import { parsePinId } from "../../entities/PinData";
import { playPinVoice } from "../../audio/voiceLineService";

export const PARTY_CHAT_READ_EVENT = "clash_party_chat_read";
const PARTY_CHAT_READ_KEY = "clash_party_chat_last_read_v1";

function chatMsgId(): string {
  return `pc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function pruneChat(messages: PartyChatMessage[]): PartyChatMessage[] {
  return pruneChatByLimit(messages);
}

function readLastReadMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(PARTY_CHAT_READ_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeLastRead(partyCode: string, ts: number): void {
  const map = readLastReadMap();
  map[partyCode] = ts;
  localStorage.setItem(PARTY_CHAT_READ_KEY, JSON.stringify(map));
}

export function getPartyChatMessages(): readonly PartyChatMessage[] {
  return getMyPartyRoom()?.chat ?? [];
}

export function getPartyChatUnreadCount(): number {
  const room = getMyPartyRoom();
  const me = getCurrentProfile();
  if (!room || !me?.playerId || (room.members.length + 1) < 2) return 0;
  const myId = normalizePlayerIdQuery(me.playerId);
  const lastRead = readLastReadMap()[room.code] ?? 0;
  return (room.chat ?? []).filter(m =>
    m.sentAt > lastRead && normalizePlayerIdQuery(m.playerId) !== myId,
  ).length;
}

export function markPartyChatRead(): void {
  const room = getMyPartyRoom();
  if (!room) return;
  const latest = (room.chat ?? []).reduce((max, m) => Math.max(max, m.sentAt), 0);
  writeLastRead(room.code, Math.max(Date.now(), latest));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_CHAT_READ_EVENT));
  }
}

export async function sendPartyChatText(text: string): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  const me = getCurrentProfile();
  const username = getCurrentUsername();
  if (!me?.playerId || !username) return { success: false, error: "Не авторизован" };
  const trimmed = text.trim().slice(0, PARTY_CHAT_MAX_TEXT);
  if (!trimmed) return { success: false, error: "Пустое сообщение" };

  const mod = await guardianModerateForSend(trimmed, "party_chat");
  if (!mod.allowed) {
    appendPartySystemMessage(mod.userMessage);
    return { success: false, error: mod.userMessage, errorCode: MODERATION_BLOCKED_CODE };
  }

  const room = getMyPartyRoom();
  if (!room || room.members.length === 0) {
    return { success: false, error: "Нужна команда из 2+ игроков" };
  }

  const msg: PartyChatMessage = {
    id: chatMsgId(),
    sentAt: Date.now(),
    playerId: normalizePlayerIdQuery(me.playerId),
    username,
    text: trimmed,
  };

  const ok = mutateMyPartyRoom(r => ({
    ...r,
    chat: pruneChat([...(r.chat ?? []), msg]),
  }));
  if (!ok) return { success: false, error: "Нет команды" };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
  }
  scheduleGuardianAiPartyRescan(4000);

  scheduleAstralChatReply(trimmed, { channel: "party", senderUsername: username }, (replyText) => {
    appendPartyAstralMessage(replyText);
  });

  return { success: true };
}

function appendPartySystemMessage(text: string): void {
  const ok = mutateMyPartyRoom(r => ({
    ...r,
    chat: pruneChat([...(r.chat ?? []), {
      id: chatMsgId(),
      sentAt: Date.now(),
      playerId: "__guardian__",
      username: GUARDIAN_NAME,
      text,
      system: true,
    } satisfies PartyChatMessage]),
  }));
  if (!ok) return;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
  }
}

const guardianAiPartyScans = new Set<string>();
const guardianPartyRescanTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Удалить из чата команды сообщения с запрещённой лексикой (последние N). */
export function guardianPurgePartyChat(maxRecent = 40): number {
  const room = getMyPartyRoom();
  if (!room) return 0;
  const chat = room.chat ?? [];
  if (chat.length === 0) return 0;

  const head = chat.length > maxRecent ? chat.slice(0, -maxRecent) : [];
  const recent = chat.slice(-maxRecent);
  const { filtered, removedCount } = guardianFilterChatHistory(recent, "party_chat");
  if (removedCount === 0) return 0;
  const notice = removedCount === 1
    ? MODERATION_CHAT_PURGED
    : `${GUARDIAN_NAME}: удалено ${removedCount} сообщ. — недопустимая лексика.`;
  mutateMyPartyRoom(r => ({
    ...r,
    chat: pruneChat([...head, ...filtered, {
      id: chatMsgId(),
      sentAt: Date.now(),
      playerId: "__guardian__",
      username: GUARDIAN_NAME,
      text: notice,
      system: true,
    } satisfies PartyChatMessage]),
  }));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
  }
  return removedCount;
}

function runGuardianPartyRescan(): void {
  const room = getMyPartyRoom();
  if (!room || guardianAiPartyScans.has(room.code)) return;
  guardianAiPartyScans.add(room.code);
  void (async () => {
    try {
      guardianPurgePartyChat();
      const current = getMyPartyRoom();
      if (!current) return;
      const toScan = (current.chat ?? []).filter(m => !isGuardianSkippableMessage(m));
      if (toScan.length === 0) return;
      const { removed } = await guardianAiFilterMessages(
        toScan.map(m => ({ id: m.id, text: m.text ?? "" })),
        "party_chat",
      );
      if (removed.length === 0) return;
      const removedIds = new Set(removed.map(m => m.id));
      mutateMyPartyRoom(r => ({
        ...r,
        chat: pruneChat([
          ...(r.chat ?? []).filter(m => isGuardianSkippableMessage(m) || !removedIds.has(m.id)),
          {
            id: chatMsgId(),
            sentAt: Date.now(),
            playerId: "__guardian__",
            username: GUARDIAN_NAME,
            text: MODERATION_CHAT_PURGED,
            system: true,
          } satisfies PartyChatMessage,
        ]),
      }));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
      }
    } finally {
      guardianAiPartyScans.delete(room.code);
    }
  })();
}

export function scheduleGuardianAiPartyRescan(delayMs = 3000): void {
  const room = getMyPartyRoom();
  if (!room) return;
  const prev = guardianPartyRescanTimers.get(room.code);
  if (prev) clearTimeout(prev);
  guardianPartyRescanTimers.set(room.code, setTimeout(() => {
    guardianPartyRescanTimers.delete(room.code);
    runGuardianPartyRescan();
  }, delayMs));
}

function appendPartyAstralMessage(text: string): void {
  const trimmed = text.trim().slice(0, PARTY_CHAT_MAX_TEXT);
  if (!trimmed) return;
  const ok = mutateMyPartyRoom(r => ({
    ...r,
    chat: pruneChat([...(r.chat ?? []), {
      id: chatMsgId(),
      sentAt: Date.now(),
      playerId: ASTRAL_CHAT_PLAYER_ID,
      username: ASTRAL_CHAT_USERNAME,
      text: trimmed,
      astral: true,
    } satisfies PartyChatMessage]),
  }));
  if (!ok) return;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
  }
}

export function sendPartyChatPin(
  pinId: string,
  brawlerId: string,
): { success: boolean; error?: string } {
  const me = getCurrentProfile();
  const username = getCurrentUsername();
  if (!me?.playerId || !username) return { success: false, error: "Не авторизован" };
  if (!pinId) return { success: false, error: "Пин не выбран" };

  const equipped = getEquippedPins(brawlerId, me);
  if (!equipped.includes(pinId)) {
    return { success: false, error: "Пин не экипирован" };
  }

  const room = getMyPartyRoom();
  if (!room || room.members.length === 0) {
    return { success: false, error: "Нужна команда из 2+ игроков" };
  }

  const msg: PartyChatMessage = {
    id: chatMsgId(),
    sentAt: Date.now(),
    playerId: normalizePlayerIdQuery(me.playerId),
    username,
    pinId,
  };

  const ok = mutateMyPartyRoom(r => ({
    ...r,
    chat: pruneChat([...(r.chat ?? []), msg]),
  }));
  if (!ok) return { success: false, error: "Нет команды" };
  const parsed = parsePinId(pinId);
  if (parsed) playPinVoice(parsed.brawlerId, parsed.kind);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
  }
  return { success: true };
}
