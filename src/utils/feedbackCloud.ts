/**
 * Cloud sync for player ↔ developer feedback threads via config-server.
 */
import { getConfigServerUrl, isConfigServerConfigured } from "../lib/runtimeConfig";
import { getConfigBaseUrl, getConfigToken } from "../adminDesktop/configServerAuth";
import { pruneChatByLimit } from "./chatLimits";
import type { FeedbackThread, ThreadMessage, FeedbackCategory } from "./messages";

export const FEEDBACK_SYNC_EVENT = "clash:feedback-sync";

const CACHE_KEY = "clash_feedback_cache_v1";

function normalizeThread(t: FeedbackThread): FeedbackThread {
  return {
    ...t,
    messages: pruneChatByLimit(t.messages ?? []),
  };
}

function readCache(): FeedbackThread[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FeedbackThread[];
    return Array.isArray(parsed) ? parsed.map(normalizeThread) : [];
  } catch {
    return [];
  }
}

function writeCache(threads: FeedbackThread[]): void {
  const normalized = threads.map(normalizeThread);
  localStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
  localStorage.setItem("clash_dev_feedback_v1", JSON.stringify(normalized.slice(0, 400)));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(FEEDBACK_SYNC_EVENT));
  }
}

function mergeThreads(local: FeedbackThread[], remote: FeedbackThread[]): FeedbackThread[] {
  const byId = new Map<string, FeedbackThread>();
  for (const t of local) byId.set(t.id, normalizeThread(t));
  for (const t of remote) {
    const prev = byId.get(t.id);
    const next = normalizeThread(t);
    if (!prev || (next.updatedAt ?? 0) >= (prev.updatedAt ?? 0)) byId.set(t.id, next);
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

function cfgBase(): string | null {
  const fromRuntime = getConfigServerUrl();
  if (fromRuntime) return fromRuntime.replace(/\/$/, "");
  try {
    const admin = getConfigBaseUrl();
    if (admin) return admin.replace(/\/$/, "");
  } catch { /* not admin */ }
  return null;
}

export function isFeedbackCloudConfigured(): boolean {
  return isConfigServerConfigured() || Boolean(cfgBase());
}

export function getCachedFeedbackThreads(): FeedbackThread[] {
  return readCache();
}

export async function fetchPlayerFeedback(username: string): Promise<FeedbackThread[]> {
  const base = cfgBase();
  if (!base || !username.trim()) return readCache().filter(
    (t) => t.username.toLowerCase() === username.toLowerCase(),
  );
  try {
    const res = await fetch(
      `${base}/feedback/mine?username=${encodeURIComponent(username)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return readCache().filter((t) => t.username.toLowerCase() === username.toLowerCase());
    const data = await res.json() as { threads?: FeedbackThread[] };
    const remote = (data.threads ?? []).map(normalizeThread);
    const mine = readCache().filter((t) => t.username.toLowerCase() === username.toLowerCase());
    const others = readCache().filter((t) => t.username.toLowerCase() !== username.toLowerCase());
    const merged = [...others, ...mergeThreads(mine, remote)];
    writeCache(merged);
    return remote;
  } catch {
    return readCache().filter((t) => t.username.toLowerCase() === username.toLowerCase());
  }
}

export async function fetchAdminFeedback(): Promise<FeedbackThread[]> {
  const base = cfgBase();
  const token = getConfigToken();
  if (!base || !token) return readCache();
  try {
    const res = await fetch(`${base}/admin/feedback`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return readCache();
    const data = await res.json() as { threads?: FeedbackThread[] };
    const remote = (data.threads ?? []).map(normalizeThread);
    writeCache(remote);
    return remote;
  } catch {
    return readCache();
  }
}

export async function cloudSubmitFeedback(opts: {
  id: string;
  username: string;
  category: FeedbackCategory;
  subject: string;
  text: string;
  attachment?: ThreadMessage["attachment"];
}): Promise<{ ok: boolean; thread?: FeedbackThread }> {
  const base = cfgBase();
  if (!base) return { ok: false };
  try {
    const res = await fetch(`${base}/feedback/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json() as { thread?: FeedbackThread };
    if (data.thread) {
      const merged = mergeThreads(readCache(), [normalizeThread(data.thread)]);
      writeCache(merged);
    }
    return { ok: true, thread: data.thread };
  } catch {
    return { ok: false };
  }
}

export async function cloudPlayerReply(opts: {
  username: string;
  threadId: string;
  text: string;
  attachment?: ThreadMessage["attachment"];
}): Promise<boolean> {
  const base = cfgBase();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/feedback/reply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts),
    });
    if (!res.ok) return false;
    const data = await res.json() as { thread?: FeedbackThread };
    if (data.thread) {
      const merged = mergeThreads(readCache(), [normalizeThread(data.thread)]);
      writeCache(merged);
    }
    return true;
  } catch {
    return false;
  }
}

export async function cloudAdminReply(threadId: string, reply: string): Promise<FeedbackThread | null> {
  const base = cfgBase();
  const token = getConfigToken();
  if (!base || !token) return null;
  try {
    const res = await fetch(`${base}/admin/feedback/reply`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ threadId, reply }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { thread?: FeedbackThread };
    if (data.thread) {
      const merged = mergeThreads(readCache(), [normalizeThread(data.thread)]);
      writeCache(merged);
      return data.thread;
    }
    return null;
  } catch {
    return null;
  }
}

export async function cloudMarkFeedbackRead(threadId?: string): Promise<void> {
  const base = cfgBase();
  const token = getConfigToken();
  if (!base || !token) return;
  try {
    await fetch(`${base}/admin/feedback/read`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(threadId ? { threadId } : {}),
    });
    if (threadId) {
      writeCache(readCache().map((t) => (t.id === threadId ? { ...t, readByDev: true } : t)));
    } else {
      writeCache(readCache().map((t) => ({ ...t, readByDev: true })));
    }
  } catch { /* offline */ }
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startFeedbackCloudPoll(username: string | null, intervalMs = 12_000): () => void {
  if (!isFeedbackCloudConfigured() || !username) return () => {};
  const tick = () => { void fetchPlayerFeedback(username); };
  tick();
  pollTimer = setInterval(tick, intervalMs);
  return () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  };
}

export function startAdminFeedbackPoll(intervalMs = 8_000): () => void {
  if (!getConfigToken()) return () => {};
  const tick = () => { void fetchAdminFeedback(); };
  tick();
  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
