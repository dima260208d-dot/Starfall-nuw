/**
 * Apply one-shot live commands pushed from admin via config-server.
 */
import type { LiveCommand } from "../lib/configServerPublish";
import type { GiftItem } from "./gifts";
import { getAllProfiles, saveProfiles } from "./localStorageAPI";
import { notifyInboxGiftBroadcast, pushInboxToUsername, getThreadById, type FeedbackThread } from "./messages";
import { getCachedFeedbackThreads, isFeedbackCloudConfigured } from "./feedbackCloud";
import { pruneChatByLimit } from "./chatLimits";
import { blockPlayer, unblockPlayer } from "./playerAdmin";

const APPLIED_KEY = "clash_live_commands_applied_v1";
export const LIVE_COMMANDS_APPLIED_EVENT = "clash:live-commands-applied";

function readApplied(): Set<string> {
  try {
    const raw = localStorage.getItem(APPLIED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function writeApplied(ids: Set<string>): void {
  const arr = [...ids].slice(-500);
  localStorage.setItem(APPLIED_KEY, JSON.stringify(arr));
}

function appendGiftToProfile(profile: Record<string, unknown>, gift: {
  id: string;
  message: string;
  items: GiftItem[];
  fromAdmin: string;
  sentAt: number;
}): void {
  const list = (profile.pendingGifts as unknown[] | undefined) ?? [];
  profile.pendingGifts = [gift, ...list];
}

function applyGiftBroadcast(cmd: Extract<LiveCommand, { type: "gift_broadcast" }>): void {
  const profiles = getAllProfiles();
  const gift = {
    id: cmd.id,
    message: cmd.message,
    items: cmd.items as GiftItem[],
    fromAdmin: "developers",
    sentAt: cmd.sentAt,
  };
  let recipients = 0;
  for (const username of Object.keys(profiles)) {
    const p = profiles[username];
    if (!p) continue;
    appendGiftToProfile(p as unknown as Record<string, unknown>, gift);
    recipients += 1;
  }
  if (recipients > 0) {
    saveProfiles(profiles);
    notifyInboxGiftBroadcast({
      giftId: cmd.id,
      message: cmd.message,
      items: cmd.items as GiftItem[],
      recipients,
    });
  }
}

function applyGiftPlayer(cmd: Extract<LiveCommand, { type: "gift_player" }>): void {
  const profiles = getAllProfiles();
  const key = Object.keys(profiles).find(
    (k) => k === cmd.username || (profiles[k] as { username?: string })?.username === cmd.username,
  );
  if (!key) return;
  const p = profiles[key];
  if (!p) return;
  const gift = {
    id: cmd.id,
    message: cmd.message,
    items: cmd.items as GiftItem[],
    fromAdmin: "developers",
    sentAt: cmd.sentAt,
  };
  appendGiftToProfile(p as unknown as Record<string, unknown>, gift);
  saveProfiles(profiles);
  pushInboxToUsername(key, {
    id: `inbox_${cmd.id}_${key}`,
    kind: "gift",
    title: "Подарок от разработчиков",
    body: cmd.message.slice(0, 500),
    sentAt: cmd.sentAt,
    read: false,
    giftId: cmd.id,
  });
}

function applyNotification(cmd: Extract<LiveCommand, { type: "notification_broadcast" }>): void {
  const all = getAllProfiles();
  const attachment = cmd.link ? { kind: "link" as const, url: cmd.link } : undefined;
  for (const username of Object.keys(all)) {
    pushInboxToUsername(username, {
      id: `${cmd.id}_${username}`,
      kind: "system",
      title: cmd.title || "Сообщение от разработчиков",
      body: cmd.body,
      sentAt: cmd.sentAt,
      read: false,
      attachment,
    });
  }
}

function applyFeedbackReply(cmd: Extract<LiveCommand, { type: "feedback_reply" }>): void {
  pushInboxToUsername(cmd.username, {
    id: cmd.id,
    kind: "system",
    title: cmd.title,
    body: cmd.body,
    sentAt: cmd.sentAt,
    read: false,
    threadId: cmd.threadId,
  });
  if (!isFeedbackCloudConfigured()) return;
  try {
    const threads = getCachedFeedbackThreads();
    const idx = threads.findIndex((t) => t.id === cmd.threadId);
    const stamp = cmd.sentAt;
    const msg = {
      id: `${cmd.id}_msg`,
      from: "dev" as const,
      text: cmd.body,
      sentAt: stamp,
    };
    if (idx >= 0) {
      const t = threads[idx];
      t.messages = pruneChatByLimit([...(t.messages ?? []), msg]);
      t.updatedAt = stamp;
      t.readByDev = true;
      threads[idx] = t;
    } else {
      const existing = getThreadById(cmd.threadId);
      if (existing) {
        const updated: FeedbackThread = {
          ...existing,
          messages: pruneChatByLimit([...existing.messages, msg]),
          updatedAt: stamp,
          readByDev: true,
        };
        threads.unshift(updated);
      }
    }
    localStorage.setItem("clash_feedback_cache_v1", JSON.stringify(threads.map((t) => ({
      ...t,
      messages: pruneChatByLimit(t.messages ?? []),
    }))));
    localStorage.setItem("clash_dev_feedback_v1", JSON.stringify(threads.slice(0, 400)));
    window.dispatchEvent(new CustomEvent("clash:feedback-sync"));
  } catch { /* ignore */ }
}

function applyPlayerBlock(cmd: Extract<LiveCommand, { type: "player_block" }>): void {
  if (cmd.blocked) blockPlayer(cmd.storageKey);
  else unblockPlayer(cmd.storageKey);
}

function applyOne(cmd: LiveCommand): void {
  switch (cmd.type) {
    case "gift_broadcast":
      applyGiftBroadcast(cmd);
      break;
    case "gift_player":
      applyGiftPlayer(cmd);
      break;
    case "notification_broadcast":
      applyNotification(cmd);
      break;
    case "feedback_reply":
      applyFeedbackReply(cmd);
      break;
    case "player_block":
      applyPlayerBlock(cmd);
      break;
    default:
      break;
  }
}

/** Process new commands from config-server (skip already applied ids). */
export function processLiveCommands(commands: unknown): number {
  if (!Array.isArray(commands)) return 0;
  const applied = readApplied();
  let count = 0;
  for (const raw of commands) {
    if (!raw || typeof raw !== "object") continue;
    const cmd = raw as LiveCommand;
    if (!cmd.id || !cmd.type || applied.has(cmd.id)) continue;
    try {
      applyOne(cmd);
      applied.add(cmd.id);
      count += 1;
    } catch (e) {
      console.warn("[liveCommands] failed", cmd.id, e);
    }
  }
  if (count > 0) {
    writeApplied(applied);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(LIVE_COMMANDS_APPLIED_EVENT));
    }
  }
  return count;
}
