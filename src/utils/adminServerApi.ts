/**
 * Admin panel ↔ config-server API (authenticated session).
 */
import { getConfigBaseUrl, getConfigToken } from "../adminDesktop/configServerAuth";
import { isLiveOpsAdminSession } from "../lib/configServerPublish";
import type { DevNote } from "./devNotes";

export type AdminServerPlayer = {
  playerId: string;
  username: string;
  blocked: boolean;
  blockedAt?: number;
  updatedAt?: string;
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
  battleHistory: unknown[];
  modeStats: Record<string, unknown>;
  unlockedBrawlerIds: string[];
  masteryTitlesUnlocked: string[];
};

export type AdminPlayersGlobal = {
  totalPlayers: number;
  activePlayers: number;
  blockedPlayers: number;
  totalGames: number;
  totalTrophies: number;
  avgWinRate: number;
  topPlayers: AdminServerPlayer[];
};

function authHeaders(): Record<string, string> | null {
  const token = getConfigToken();
  if (!token) return null;
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };
}

export async function adminServerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = getConfigBaseUrl().replace(/\/$/, "");
  const headers = authHeaders();
  if (!headers) throw new Error("no_admin_session");
  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string> ?? {}) },
  });
}

export async function fetchAdminPublishedState(): Promise<Record<string, unknown>> {
  if (!isLiveOpsAdminSession()) return {};
  try {
    const res = await adminServerFetch("/admin/state");
    if (!res.ok) return {};
    const data = await res.json() as { published?: { domains?: Record<string, unknown> } };
    return data.published?.domains ?? {};
  } catch {
    return {};
  }
}

export async function fetchDevNotesFromServer(): Promise<DevNote[] | null> {
  if (!isLiveOpsAdminSession()) return null;
  try {
    const res = await adminServerFetch("/admin/dev-notes");
    if (!res.ok) return null;
    const data = await res.json() as { notes?: DevNote[] };
    return Array.isArray(data.notes) ? data.notes : [];
  } catch {
    return null;
  }
}

export async function saveDevNotesToServer(notes: DevNote[]): Promise<{ ok: boolean; message: string }> {
  if (!isLiveOpsAdminSession()) return { ok: false, message: "Нет сессии config-server" };
  try {
    const res = await adminServerFetch("/admin/dev-notes", {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false, message: `Сервер отклонил сохранение (${res.status}): ${err.slice(0, 80)}` };
    }
    return { ok: true, message: "Заметки сохранены на сервере" };
  } catch {
    return { ok: false, message: "Сервер недоступен" };
  }
}

export async function uploadAdminImageToCdn(
  file: File,
  folder = "admin-notes",
): Promise<{ ok: true; url: string; size: number } | { ok: false; error: string }> {
  if (!isLiveOpsAdminSession()) return { ok: false, error: "Нет сессии config-server" };
  if (!file.type.startsWith("image/")) return { ok: false, error: "Только изображения" };
  if (file.size > 6 * 1024 * 1024) return { ok: false, error: "Файл больше 6 МБ" };

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("read_failed"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.readAsDataURL(file);
  });

  try {
    const res = await adminServerFetch("/admin/upload-image", {
      method: "POST",
      body: JSON.stringify({ dataUrl, filename: file.name, folder }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      return { ok: false, error: `Загрузка не удалась (${res.status}): ${err.slice(0, 80)}` };
    }
    const data = await res.json() as { url?: string; size?: number };
    if (!data.url) return { ok: false, error: "Сервер не вернул URL" };
    return { ok: true, url: data.url, size: data.size ?? file.size };
  } catch {
    return { ok: false, error: "Сервер недоступен" };
  }
}

export async function fetchAdminSettingsFromServer(): Promise<Record<string, unknown> | null> {
  if (!isLiveOpsAdminSession()) return null;
  try {
    const res = await adminServerFetch("/admin/settings");
    if (!res.ok) return null;
    const data = await res.json() as { settings?: Record<string, unknown> };
    return data.settings && typeof data.settings === "object" ? data.settings : {};
  } catch {
    return null;
  }
}

export async function saveAdminSettingsToServer(settings: Record<string, unknown>): Promise<{ ok: boolean; message: string }> {
  if (!isLiveOpsAdminSession()) return { ok: false, message: "Нет сессии config-server" };
  try {
    const res = await adminServerFetch("/admin/settings", {
      method: "POST",
      body: JSON.stringify({ settings }),
    });
    if (!res.ok) return { ok: false, message: `Ошибка сохранения (${res.status})` };
    return { ok: true, message: "Настройки сохранены на сервере" };
  } catch {
    return { ok: false, message: "Сервер недоступен" };
  }
}

export async function fetchAdminPlayers(opts: {
  query?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{
  ok: boolean;
  players: AdminServerPlayer[];
  global: AdminPlayersGlobal | null;
  error?: string;
}> {
  if (!isLiveOpsAdminSession()) {
    return { ok: false, players: [], global: null, error: "no_session" };
  }
  const q = new URLSearchParams();
  if (opts.query) q.set("q", opts.query);
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.offset) q.set("offset", String(opts.offset));
  try {
    const res = await adminServerFetch(`/admin/players?${q}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      return { ok: false, players: [], global: null, error: data.error ?? `HTTP ${res.status}` };
    }
    const data = await res.json() as {
      ok?: boolean;
      players?: AdminServerPlayer[];
      global?: AdminPlayersGlobal | null;
    };
    return {
      ok: Boolean(data.ok),
      players: data.players ?? [],
      global: data.global ?? null,
    };
  } catch {
    return { ok: false, players: [], global: null, error: "network" };
  }
}

export async function fetchAdminPlayerDetail(playerId: string): Promise<AdminServerPlayer | null> {
  if (!isLiveOpsAdminSession()) return null;
  try {
    const res = await adminServerFetch(`/admin/players/${encodeURIComponent(playerId)}`);
    if (!res.ok) return null;
    const data = await res.json() as { player?: AdminServerPlayer };
    return data.player ?? null;
  } catch {
    return null;
  }
}

export async function blockAdminPlayerOnServer(
  playerId: string,
  blocked: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!isLiveOpsAdminSession()) return { ok: false, error: "no_session" };
  try {
    const res = await adminServerFetch("/admin/players/block", {
      method: "POST",
      body: JSON.stringify({ playerId, blocked }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}
