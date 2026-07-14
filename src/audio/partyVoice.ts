/**
 * Party / menu voice sync — replays remote lines when party chat updates.
 */
import {
  getCurrentProfile,
  getCurrentUsername,
} from "../utils/localStorageAPI";
import { getProfileByPlayerId } from "../utils/playerGiftSend";
import { normalizePlayerIdQuery } from "../utils/playerId";
import {
  mutateMyPartyRoom,
  getMyPartyRoom,
  PARTY_CHANGED_EVENT,
  type PartyChatMessage,
  type PartyRoom,
} from "../utils/social/party";
import { parsePinId } from "../entities/PinData";
import {
  playMenuVoice,
  playPinVoice,
  playVoiceLine,
  pickMenuCategory,
  pickVariant,
  type VoiceCategory,
} from "../audio/voiceLineService";

const playedChatIds = new Set<string>();

function chatVoiceId(): string {
  return `pv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Menu voice + optional party broadcast (allies in lobby hear via chat sync). */
export function broadcastPartyMenuVoice(
  brawlerId: string,
  category?: VoiceCategory,
): void {
  const cat = category ?? pickMenuCategory();
  const variant = pickVariant();
  playMenuVoice(brawlerId, cat);

  const me = getCurrentProfile();
  const username = getCurrentUsername();
  const room = getMyPartyRoom();
  if (!me?.playerId || !username || !room || room.members.length === 0) return;

  mutateMyPartyRoom((r: PartyRoom) => ({
    ...r,
    chat: [
      ...(r.chat ?? []),
      {
        id: chatVoiceId(),
        sentAt: Date.now(),
        playerId: normalizePlayerIdQuery(me.playerId!),
        username,
        voiceBrawlerId: brawlerId,
        voiceCategory: cat,
        voiceVariant: variant,
      } satisfies PartyChatMessage,
    ],
  }));
}

export function playExistingPartyMemberLines(room: PartyRoom, excludePlayerId?: string): void {
  let delay = 0;
  const excluded = excludePlayerId ? normalizePlayerIdQuery(excludePlayerId) : null;
  const leaderId = normalizePlayerIdQuery(room.leaderPlayerId);
  if (excluded !== leaderId) {
    const leaderProf = getProfileByPlayerId(room.leaderPlayerId);
    setTimeout(() => playMenuVoice(leaderProf?.selectedBrawlerId ?? "hana"), delay);
    delay += 900;
  }
  for (const m of room.members) {
    const id = normalizePlayerIdQuery(m.playerId);
    if (excluded === id) continue;
    setTimeout(() => playMenuVoice(m.brawlerId || "hana"), delay);
    delay += 900;
  }
}

function handleChatMessage(msg: PartyChatMessage, myId: string): void {
  if (playedChatIds.has(msg.id)) return;
  if (normalizePlayerIdQuery(msg.playerId) === myId) return;
  playedChatIds.add(msg.id);
  if (playedChatIds.size > 400) playedChatIds.clear();

  if (msg.voiceBrawlerId && msg.voiceCategory) {
    playVoiceLine(
      msg.voiceBrawlerId,
      msg.voiceCategory as VoiceCategory,
      msg.voiceVariant === 1 ? 1 : 0,
    );
    return;
  }

  if (msg.pinId) {
    const parsed = parsePinId(msg.pinId);
    if (parsed) playPinVoice(parsed.brawlerId, parsed.kind);
  }
}

export function initPartyVoiceListener(): void {
  if (typeof window === "undefined") return;

  const scan = () => {
    const me = getCurrentProfile();
    if (!me?.playerId) return;
    const myId = normalizePlayerIdQuery(me.playerId);
    const room = getMyPartyRoom();
    if (!room?.chat?.length) return;
    for (const msg of room.chat) {
      if (msg.voiceBrawlerId || msg.pinId) handleChatMessage(msg, myId);
    }
  };

  window.addEventListener(PARTY_CHANGED_EVENT, scan);
  scan();
}
