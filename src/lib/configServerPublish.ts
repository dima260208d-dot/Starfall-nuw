/**
 * Admin-side client for config-server draft + publish.
 * Used by the desktop admin panel to push live-ops to all game clients.
 */
import { getConfigBaseUrl, getConfigToken } from "../adminDesktop/configServerAuth";

export type PublishResult = { ok: boolean; message: string; version?: number };

function authHeaders(): Record<string, string> | null {
  const token = getConfigToken();
  if (!token) return null;
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };
}

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = getConfigBaseUrl().replace(/\/$/, "");
  const headers = authHeaders();
  if (!headers) throw new Error("no_admin_session");
  return fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) } });
}

export function isLiveOpsAdminSession(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};
  return env.VITE_ADMIN_DESKTOP === "true" && Boolean(getConfigToken());
}

/** Save draft and immediately publish one domain. */
export async function publishConfigDomain(domain: string, value: unknown): Promise<PublishResult> {
  if (!isLiveOpsAdminSession()) {
    return { ok: false, message: "Нет сессии config-server" };
  }
  try {
    let res = await adminFetch("/admin/draft", {
      method: "POST",
      body: JSON.stringify({ domain, value }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false, message: `Черновик не сохранён (${res.status}): ${err.slice(0, 120)}` };
    }
    res = await adminFetch("/admin/publish", {
      method: "POST",
      body: JSON.stringify({ domains: [domain] }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false, message: `Публикация не удалась (${res.status}): ${err.slice(0, 120)}` };
    }
    const data = await res.json() as { version?: number };
    return { ok: true, message: `Опубликовано на сервер (v${data.version ?? "?"})`, version: data.version };
  } catch {
    return { ok: false, message: "Сервер недоступен" };
  }
}

/** Publish several domains in one publish call (single version bump). */
export async function publishConfigDomains(entries: Record<string, unknown>): Promise<PublishResult> {
  if (!isLiveOpsAdminSession()) {
    return { ok: false, message: "Нет сессии config-server" };
  }
  const domains = Object.keys(entries);
  if (domains.length === 0) return { ok: true, message: "Нечего публиковать" };
  try {
    for (const domain of domains) {
      const res = await adminFetch("/admin/draft", {
        method: "POST",
        body: JSON.stringify({ domain, value: entries[domain] }),
      });
      if (!res.ok) {
        return { ok: false, message: `Черновик «${domain}» не сохранён (${res.status})` };
      }
    }
    const res = await adminFetch("/admin/publish", {
      method: "POST",
      body: JSON.stringify({ domains }),
    });
    if (!res.ok) {
      return { ok: false, message: `Публикация не удалась (${res.status})` };
    }
    const data = await res.json() as { version?: number };
    return { ok: true, message: `Опубликовано: ${domains.join(", ")} (v${data.version ?? "?"})`, version: data.version };
  } catch {
    return { ok: false, message: "Сервер недоступен" };
  }
}

export async function fetchPublishedDomain<T = unknown>(domain: string): Promise<T | null> {
  if (!isLiveOpsAdminSession()) return null;
  try {
    const res = await adminFetch("/admin/state");
    if (!res.ok) return null;
    const data = await res.json() as { published?: { domains?: Record<string, T> } };
    return data.published?.domains?.[domain] ?? null;
  } catch {
    return null;
  }
}

const MAX_LIVE_COMMANDS = 300;

export type LiveCommand =
  | { type: "gift_broadcast"; id: string; sentAt: number; items: unknown[]; message: string }
  | { type: "notification_broadcast"; id: string; sentAt: number; title: string; body: string; link?: string }
  | { type: "gift_player"; id: string; sentAt: number; username: string; items: unknown[]; message: string }
  | { type: "player_block"; id: string; sentAt: number; storageKey: string; blocked: boolean }
  | { type: "feedback_reply"; id: string; sentAt: number; username: string; threadId: string; title: string; body: string };

export function newLiveCommandId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Append a one-shot command for all game clients to process. */
export async function appendLiveCommand(command: LiveCommand): Promise<PublishResult> {
  const prev = (await fetchPublishedDomain<LiveCommand[]>("liveCommands")) ?? [];
  const next = [...prev, command].slice(-MAX_LIVE_COMMANDS);
  return publishConfigDomain("liveCommands", next);
}
