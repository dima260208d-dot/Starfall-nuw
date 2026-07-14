// =========================================================================
// MESSAGES — inbox for players + threaded feedback to developers.
// =========================================================================

import { getAllProfiles, getCurrentProfile, getCurrentUsername, saveProfiles, updateProfile } from "./localStorageAPI";
import { guardianBlockResult } from "../ai/contentGuardian";
import { guardianModerateWithBuiltIn } from "../ai/contentGuardianAi";
import type { GiftItem } from "./gifts";
import { describeGiftItem } from "./gifts";
import { pruneChatByLimit } from "./chatLimits";
import {
  cloudAdminReply,
  cloudMarkFeedbackRead,
  cloudPlayerReply,
  cloudSubmitFeedback,
  getCachedFeedbackThreads,
  isFeedbackCloudConfigured,
} from "./feedbackCloud";

const THREADS_KEY = "clash_dev_feedback_v1";
const BROADCAST_LOG_KEY = "clash_dev_broadcast_log_v1";

export const MAX_INBOX_MESSAGE = 500;
export const MAX_FEEDBACK_TEXT = 800;
export const MAX_ATTACHMENT_URL = 2000;
export const FEEDBACK_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

export type MessageAttachment = { kind: "image" | "link"; url: string };

export type FeedbackCategory = "bug" | "balance" | "account" | "suggestion" | "question" | "other";

export interface FeedbackCategoryInfo {
  id: FeedbackCategory;
  label: string;
  icon: string;
  color: string;
}

export const FEEDBACK_CATEGORIES: FeedbackCategoryInfo[] = [
  { id: "bug",        label: "Баг / ошибка",       icon: "🐛", color: "#FF5252" },
  { id: "balance",    label: "Баланс и геймплей",  icon: "⚖️", color: "#FFB74D" },
  { id: "account",    label: "Аккаунт и прогресс", icon: "👤", color: "#64B5F6" },
  { id: "suggestion", label: "Предложение",        icon: "💡", color: "#76FF03" },
  { id: "question",   label: "Вопрос",             icon: "❓", color: "#CE93D8" },
  { id: "other",      label: "Другое",             icon: "📋", color: "#90A4AE" },
];

export const MAX_FEEDBACK_SUBJECT = 80;
export const MAX_DEV_REPLY = 500;

export function getFeedbackCategoryInfo(id: FeedbackCategory): FeedbackCategoryInfo {
  return FEEDBACK_CATEGORIES.find(c => c.id === id) ?? FEEDBACK_CATEGORIES[FEEDBACK_CATEGORIES.length - 1];
}

export interface InboxMessage {
  id: string;
  kind: "system" | "gift";
  title: string;
  body: string;
  sentAt: number;
  read: boolean;
  giftId?: string;
  threadId?: string;
  attachment?: MessageAttachment;
}

export interface ThreadMessage {
  id: string;
  from: "player" | "dev";
  text: string;
  sentAt: number;
  attachment?: MessageAttachment;
}

export interface FeedbackThread {
  id: string;
  username: string;
  category: FeedbackCategory;
  subject: string;
  messages: ThreadMessage[];
  updatedAt: number;
  readByDev: boolean;
}

/** @deprecated use FeedbackThread */
export interface PlayerFeedback {
  id: string;
  username: string;
  category: FeedbackCategory;
  subject: string;
  text: string;
  sentAt: number;
  read: boolean;
  attachment?: MessageAttachment;
  devReply?: string;
  repliedAt?: number;
}

export interface DevBroadcastRecord {
  id: string;
  kind: "system" | "gift";
  title: string;
  message: string;
  sentAt: number;
  recipients: number;
  itemsSummary?: string[];
}

const INBOX_FIELD = "inbox" as const;

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, data: unknown): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function findProfileKey(all: Record<string, unknown>, username: string): string | null {
  if (all[username]) return username;
  const lower = username.toLowerCase();
  for (const key of Object.keys(all)) {
    if (key.toLowerCase() === lower) return key;
  }
  return null;
}

export function pushInboxToUsername(username: string, msg: InboxMessage): boolean {
  const all = getAllProfiles() as Record<string, unknown>;
  const key = findProfileKey(all, username);
  if (!key) return false;
  const prof = all[key] as Record<string, unknown>;
  const list = (prof[INBOX_FIELD] as InboxMessage[] | undefined) ?? [];
  list.push(msg);
  prof[INBOX_FIELD] = list;
  saveProfiles(all as ReturnType<typeof getAllProfiles>);
  if (getCurrentUsername() === username) {
    void import("../audio/gameSfxService").then((m) => m.playMessageSfx());
  }
  return true;
}

// ── Player inbox ─────────────────────────────────────────────────────────

export function getInboxMessages(): InboxMessage[] {
  const p = getCurrentProfile();
  if (!p) return [];
  const list: InboxMessage[] = p.inbox ?? [];
  return [...list].sort((a, b) => b.sentAt - a.sentAt);
}

export function getUnreadInboxCount(): number {
  return getInboxMessages().filter(m => !m.read).length;
}

export function markInboxRead(messageId: string): void {
  const list = getInboxMessages().map(m => (m.id === messageId ? { ...m, read: true } : m));
  updateProfile({ inbox: list });
}

export function markAllInboxRead(): void {
  updateProfile({ inbox: getInboxMessages().map(m => ({ ...m, read: true })) });
}

/** Системное уведомление всем игрокам + запись в лог разработчика. */
export function broadcastSystemNotification(opts: {
  title: string;
  body: string;
  attachment?: MessageAttachment;
}): { success: boolean; recipients: number; error?: string } {
  const title = (opts.title ?? "Уведомление").trim().slice(0, 120);
  const body = (opts.body ?? "").trim().slice(0, MAX_INBOX_MESSAGE);
  if (!title && !body) return { success: false, recipients: 0, error: "Пустое сообщение" };

  const all = getAllProfiles();
  const id = newId("sys");
  const stamp = Date.now();
  let recipients = 0;

  for (const username of Object.keys(all)) {
    const ok = pushInboxToUsername(username, {
      id: `${id}_${username}`,
      kind: "system",
      title: title || "Сообщение от разработчиков",
      body,
      sentAt: stamp,
      read: false,
      attachment: opts.attachment,
    });
    if (ok) recipients += 1;
  }

  appendDevBroadcast({
    id,
    kind: "system",
    title: title || "Сообщение",
    message: body,
    sentAt: stamp,
    recipients,
  });

  return { success: true, recipients };
}

/** Добавить запись во входящие при рассылке подарка (вызывается из gifts.ts). */
export function notifyInboxGiftBroadcast(opts: {
  giftId: string;
  message: string;
  items: GiftItem[];
  recipients: number;
}): void {
  const title = "Подарок от разработчиков";
  const body = (opts.message || "Вам отправлен подарок! Заберите его в разделе сообщений или на главном экране.").slice(0, MAX_INBOX_MESSAGE);
  const itemsSummary = opts.items.map(describeGiftItem);

  appendDevBroadcast({
    id: opts.giftId,
    kind: "gift",
    title,
    message: body,
    sentAt: Date.now(),
    recipients: opts.recipients,
    itemsSummary,
  });

  const stamp = Date.now();
  const all = getAllProfiles();
  for (const username of Object.keys(all)) {
    pushInboxToUsername(username, {
      id: `inbox_${opts.giftId}_${username}`,
      kind: "gift",
      title,
      body,
      sentAt: stamp,
      read: false,
      giftId: opts.giftId,
    });
  }
}

// ── Threads (player ↔ developer) ─────────────────────────────────────────

function migrateLegacyFeedback(raw: unknown): FeedbackThread | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (Array.isArray(o.messages)) {
    const t = o as unknown as FeedbackThread;
    if (!t.id || !t.username) return null;
    return normalizeThread(t);
  }
  const legacy = o as Partial<PlayerFeedback> & { id?: string; username?: string; text?: string };
  if (!legacy.id || !legacy.username || !legacy.text) return null;
  const category = FEEDBACK_CATEGORIES.some(c => c.id === legacy.category) ? legacy.category! : "other";
  const messages: ThreadMessage[] = [{
    id: `${legacy.id}_p0`,
    from: "player",
    text: legacy.text,
    sentAt: legacy.sentAt ?? Date.now(),
    attachment: legacy.attachment,
  }];
  if (legacy.devReply) {
    messages.push({
      id: `${legacy.id}_d0`,
      from: "dev",
      text: legacy.devReply,
      sentAt: legacy.repliedAt ?? legacy.sentAt ?? Date.now(),
    });
  }
  return {
    id: legacy.id,
    username: legacy.username,
    category,
    subject: (legacy.subject ?? "").trim() || legacy.text.slice(0, 60) || "Без темы",
    messages,
    updatedAt: legacy.repliedAt ?? legacy.sentAt ?? Date.now(),
    readByDev: legacy.read ?? false,
  };
}

function normalizeThread(t: FeedbackThread): FeedbackThread {
  const category = FEEDBACK_CATEGORIES.some(c => c.id === t.category) ? t.category : "other";
  return {
    id: t.id,
    username: t.username,
    category,
    subject: (t.subject ?? "").trim().slice(0, MAX_FEEDBACK_SUBJECT) || "Без темы",
    messages: pruneChatByLimit(Array.isArray(t.messages) ? t.messages : []),
    updatedAt: t.updatedAt ?? Date.now(),
    readByDev: t.readByDev ?? false,
  };
}

function loadThreads(): FeedbackThread[] {
  if (isFeedbackCloudConfigured()) {
    const cached = getCachedFeedbackThreads();
    if (cached.length > 0) return cached.map(normalizeThread);
  }
  const raw = loadJson<unknown[]>(THREADS_KEY, []);
  return raw.map(migrateLegacyFeedback).filter((t): t is FeedbackThread => !!t).map(normalizeThread);
}

function saveThreads(threads: FeedbackThread[]): void {
  const normalized = threads.map(normalizeThread).slice(0, 400);
  saveJson(THREADS_KEY, normalized);
  try {
    localStorage.setItem("clash_feedback_cache_v1", JSON.stringify(normalized));
  } catch { /* quota */ }
}

export function getFeedbackThreads(): FeedbackThread[] {
  return loadThreads().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getPlayerFeedbackByCategory(category: FeedbackCategory | "all"): FeedbackThread[] {
  const all = getFeedbackThreads();
  if (category === "all") return all;
  return all.filter(t => t.category === category);
}

/** @deprecated alias */
export function getPlayerFeedback(): PlayerFeedback[] {
  return getFeedbackThreads().map(threadToLegacy);
}

function threadToLegacy(t: FeedbackThread): PlayerFeedback {
  const first = t.messages.find(m => m.from === "player");
  const lastDev = [...t.messages].reverse().find(m => m.from === "dev");
  return {
    id: t.id,
    username: t.username,
    category: t.category,
    subject: t.subject,
    text: first?.text ?? "",
    sentAt: first?.sentAt ?? t.updatedAt,
    read: t.readByDev,
    attachment: first?.attachment,
    devReply: lastDev?.text,
    repliedAt: lastDev?.sentAt,
  };
}

export function getMyThreads(): FeedbackThread[] {
  const u = getCurrentUsername();
  if (!u) return [];
  return getFeedbackThreads().filter(t => t.username.toLowerCase() === u.toLowerCase());
}

export function getThreadById(threadId: string): FeedbackThread | null {
  return getFeedbackThreads().find(t => t.id === threadId) ?? null;
}

export function getUnreadFeedbackCount(): number {
  return getFeedbackThreads().filter(t => !t.readByDev).length;
}

export function sendFeedbackToDevelopers(opts: {
  category: FeedbackCategory;
  subject: string;
  text: string;
  attachment?: MessageAttachment;
}): { success: boolean; threadId?: string; error?: string } {
  const username = getCurrentUsername();
  if (!username) return { success: false, error: "Не авторизован" };

  if (!FEEDBACK_CATEGORIES.some(c => c.id === opts.category)) {
    return { success: false, error: "Выберите категорию обращения" };
  }

  const subject = (opts.subject ?? "").trim().slice(0, MAX_FEEDBACK_SUBJECT);
  if (subject.length < 3) {
    return { success: false, error: "Тема должна быть не короче 3 символов" };
  }
  const subjectMod = guardianModerateWithBuiltIn(subject, "feedback");
  if (!subjectMod.allowed) return guardianBlockResult("feedback", subjectMod);

  const text = (opts.text ?? "").trim().slice(0, MAX_FEEDBACK_TEXT);
  const link = opts.attachment?.kind === "link" ? (opts.attachment.url ?? "").trim().slice(0, MAX_ATTACHMENT_URL) : "";
  const image = opts.attachment?.kind === "image" ? opts.attachment.url : undefined;

  if (text.length < 10 && !link && !image) {
    return { success: false, error: "Опишите проблему (минимум 10 символов) или прикрепите файл" };
  }
  if (text) {
    const textMod = guardianModerateWithBuiltIn(text, "feedback");
    if (!textMod.allowed) return guardianBlockResult("feedback", textMod);
  }

  let attachment: MessageAttachment | undefined;
  if (image) attachment = { kind: "image", url: image };
  else if (link) {
    const linkMod = guardianModerateWithBuiltIn(link, "feedback");
    if (!linkMod.allowed) return guardianBlockResult("feedback", linkMod);
    if (!/^https?:\/\//i.test(link)) {
      return { success: false, error: "Ссылка должна начинаться с http:// или https://" };
    }
    attachment = { kind: "link", url: link };
  }

  const threadId = newId("fb");
  const stamp = Date.now();
  const threads = loadThreads();
  const newThread: FeedbackThread = {
    id: threadId,
    username,
    category: opts.category,
    subject,
    messages: [{
      id: newId("msg"),
      from: "player",
      text: text || (attachment?.kind === "link" ? link : "(вложение)"),
      sentAt: stamp,
      attachment,
    }],
    updatedAt: stamp,
    readByDev: false,
  };
  threads.unshift(newThread);
  saveThreads(threads);
  if (isFeedbackCloudConfigured()) {
    void cloudSubmitFeedback({
      id: threadId,
      username,
      category: opts.category,
      subject,
      text: text || (attachment?.kind === "link" ? link : "(вложение)"),
      attachment,
    });
  }
  return { success: true, threadId };
}

export function playerReplyToThread(
  threadId: string,
  opts: { text: string; attachment?: MessageAttachment },
): { success: boolean; error?: string } {
  const username = getCurrentUsername();
  if (!username) return { success: false, error: "Не авторизован" };

  const threads = loadThreads();
  const idx = threads.findIndex(t => t.id === threadId);
  if (idx < 0) return { success: false, error: "Диалог не найден" };

  const thread = threads[idx];
  if (thread.username.toLowerCase() !== username.toLowerCase()) {
    return { success: false, error: "Нет доступа к этому диалогу" };
  }

  const lastDev = [...thread.messages].reverse().find(m => m.from === "dev");
  if (!lastDev) {
    return { success: false, error: "Разработчик ещё не отвечал — дождитесь ответа" };
  }

  const text = (opts.text ?? "").trim().slice(0, MAX_FEEDBACK_TEXT);
  if (text.length < 2) return { success: false, error: "Напишите сообщение" };

  const stamp = Date.now();
  thread.messages.push({
    id: newId("msg"),
    from: "player",
    text,
    sentAt: stamp,
    attachment: opts.attachment,
  });
  thread.updatedAt = stamp;
  thread.readByDev = false;
  threads[idx] = normalizeThread(thread);
  saveThreads(threads);
  if (isFeedbackCloudConfigured()) {
    void cloudPlayerReply({ username, threadId, text, attachment: opts.attachment });
  }
  return { success: true };
}

/** Ответ разработчика — добавляет сообщение в диалог и уведомляет игрока. */
export function replyToFeedback(threadId: string, reply: string): { success: boolean; error?: string } {
  const replyText = (reply ?? "").trim().slice(0, MAX_DEV_REPLY);
  if (!replyText) return { success: false, error: "Напишите текст ответа" };

  const threads = loadThreads();
  const idx = threads.findIndex(t => t.id === threadId);
  if (idx < 0) return { success: false, error: "Сообщение не найдено" };

  const thread = threads[idx];
  const stamp = Date.now();
  thread.messages.push({
    id: newId("msg"),
    from: "dev",
    text: replyText,
    sentAt: stamp,
  });
  thread.updatedAt = stamp;
  thread.readByDev = true;
  threads[idx] = normalizeThread(thread);
  saveThreads(threads);

  if (isFeedbackCloudConfigured()) {
    void cloudAdminReply(threadId, replyText);
  }

  const cat = getFeedbackCategoryInfo(thread.category);
  const delivered = pushInboxToUsername(thread.username, {
    id: `reply_${threadId}_${stamp}`,
    kind: "system",
    threadId,
    title: `Ответ: ${thread.subject}`,
    body: `${cat.icon} ${cat.label}\n\n${replyText}`,
    sentAt: stamp,
    read: false,
  });

  if (!delivered) {
    return { success: false, error: `Профиль «${thread.username}» не найден` };
  }

  return { success: true };
}

export function markFeedbackRead(threadId: string): void {
  const threads = loadThreads().map(t =>
    t.id === threadId ? { ...t, readByDev: true } : t,
  );
  saveThreads(threads);
  void cloudMarkFeedbackRead(threadId);
}

export function markAllFeedbackRead(): void {
  saveThreads(loadThreads().map(t => ({ ...t, readByDev: true })));
  void cloudMarkFeedbackRead();
}

// ── Dev broadcast log ────────────────────────────────────────────────────

export function getDevBroadcastLog(): DevBroadcastRecord[] {
  return loadJson<DevBroadcastRecord[]>(BROADCAST_LOG_KEY, []);
}

function appendDevBroadcast(rec: DevBroadcastRecord): void {
  const log = getDevBroadcastLog();
  log.unshift(rec);
  saveJson(BROADCAST_LOG_KEY, log.slice(0, 100));
}

/** Подарок одному игроку — запись во входящие. */
export function notifyInboxGiftToPlayer(username: string, giftId: string, message: string): boolean {
  const body = (message || "Вам отправлен подарок! Заберите его в разделе сообщений.").slice(0, MAX_INBOX_MESSAGE);
  return pushInboxToUsername(username, {
    id: `inbox_${giftId}_${username}`,
    kind: "gift",
    title: "Подарок от разработчиков",
    body,
    sentAt: Date.now(),
    read: false,
    giftId,
  });
}

/** Подарок от другого игрока — запись во входящие. */
export function notifyInboxPlayerGift(opts: {
  storageKey: string;
  giftId: string;
  message: string;
  senderLabel: string;
  anonymous: boolean;
}): boolean {
  const body = (opts.message || "Вам отправили подарок! Откройте его в сообщениях.").slice(0, MAX_INBOX_MESSAGE);
  const title = opts.anonymous ? "Анонимный подарок" : `Подарок от ${opts.senderLabel}`;
  return pushInboxToUsername(opts.storageKey, {
    id: `inbox_${opts.giftId}_${opts.storageKey}`,
    kind: "gift",
    title,
    body,
    sentAt: Date.now(),
    read: false,
    giftId: opts.giftId,
  });
}

export function fileToFeedbackImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Нужен файл изображения"));
  }
  if (file.size > FEEDBACK_IMAGE_MAX_BYTES) {
    return Promise.reject(new Error(`Изображение не больше ${Math.round(FEEDBACK_IMAGE_MAX_BYTES / 1024 / 1024)} МБ`));
  }
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error ?? new Error("Не удалось прочитать файл"));
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(file);
  });
}
