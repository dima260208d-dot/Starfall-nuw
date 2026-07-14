/**
 * clubCloud — client for the Cloudflare clubs Worker (authoritative club store).
 *
 * Every mutation is permission-checked on the server against the stored club
 * document, so the client cannot forge actions it has no rights to. All calls are
 * async; callers should await and re-fetch the club afterwards.
 */
import { getClubsServerUrl, isClubsServerConfigured } from "../../lib/runtimeConfig";

export { isClubsServerConfigured };

export type CloudClubResult<T = unknown> = {
  success?: boolean;
  pending?: boolean;
  error?: string;
  club?: T;
  message?: unknown;
};

async function call<T = unknown>(path: string, body?: unknown, method: "GET" | "POST" = "POST"): Promise<T> {
  const base = getClubsServerUrl();
  if (!base) throw new Error("clubs service not configured");
  const res = await fetch(base + path, {
    method,
    headers: method === "POST" ? { "content-type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok && res.status >= 500) throw new Error(data.error || res.statusText);
  return data as T;
}

// ── Reads ──────────────────────────────────────────────────────────────────
export function cloudListClubs<T = unknown>(limit = 50): Promise<{ clubs: T[] }> {
  return call(`/clubs/list?limit=${limit}`, undefined, "GET");
}
export function cloudSearchClubs<T = unknown>(q: string): Promise<{ clubs: T[] }> {
  return call(`/clubs/search?q=${encodeURIComponent(q)}`, undefined, "GET");
}
export function cloudGetClub<T = unknown>(id: string): Promise<{ club: T | null }> {
  return call(`/clubs/get?id=${encodeURIComponent(id)}`, undefined, "GET");
}
export function cloudGetMyClub<T = unknown>(username: string): Promise<{ club: T | null }> {
  return call(`/clubs/mine?username=${encodeURIComponent(username)}`, undefined, "GET");
}

// ── Mutations (server-authorized) ──────────────────────────────────────────
type Actor = { username: string; playerId?: string | null; trophies?: number };

export function cloudCreateClub(actor: Actor, opts: {
  id?: string; name: string; description?: string; type?: "open" | "closed";
  avatarPreset?: string; avatarProfileIconId?: string; avatarDataUrl?: string;
}): Promise<CloudClubResult> {
  return call("/clubs/create", { ...actor, ...opts });
}
export function cloudJoinClub(actor: Actor, clubId: string): Promise<CloudClubResult> {
  return call("/clubs/join", { ...actor, clubId });
}
export function cloudLeaveClub(actor: Actor): Promise<CloudClubResult> {
  return call("/clubs/leave", { ...actor });
}
export function cloudKickMember(username: string, clubId: string, target: string): Promise<CloudClubResult> {
  return call("/clubs/kick", { username, clubId, target });
}
export function cloudSetRank(username: string, clubId: string, target: string, rank: string): Promise<CloudClubResult> {
  return call("/clubs/setRank", { username, clubId, target, rank });
}
export function cloudApproveJoin(username: string, clubId: string, target: string): Promise<CloudClubResult> {
  return call("/clubs/approve", { username, clubId, target });
}
export function cloudDenyJoin(username: string, clubId: string, target: string): Promise<CloudClubResult> {
  return call("/clubs/deny", { username, clubId, target });
}
export function cloudUpdateClubInfo(username: string, clubId: string, patch: Record<string, unknown>): Promise<CloudClubResult> {
  return call("/clubs/updateInfo", { username, clubId, patch });
}
export function cloudSendClubChat(username: string, clubId: string, payload: { text?: string; pinId?: string; battleShare?: unknown }): Promise<CloudClubResult> {
  return call("/clubs/chat", { username, clubId, ...payload });
}
export function cloudRecordClubWin(username: string, trophies?: number): Promise<CloudClubResult> {
  return call("/clubs/recordWin", { username, trophies });
}
export function cloudClubBossRaid(username: string, clubId: string, patch: Record<string, unknown>): Promise<CloudClubResult> {
  return call("/clubs/bossRaid", { username, clubId, ...patch });
}
