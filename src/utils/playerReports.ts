/**
 * Submit player reports and fetch reputation from config-server.
 */
import { getConfigServerUrl } from "../lib/runtimeConfig";
import type { ReportCategoryId } from "../data/reportCategories";
import type { GameMode } from "../App";

export type PlayerReputation = {
  playerId: string;
  reportsInWindow: number;
  totalReports: number;
  windowDays: number;
};

function baseUrl(): string {
  return (getConfigServerUrl() ?? "").replace(/\/$/, "");
}

export async function submitPlayerReport(opts: {
  reporterPlayerId: string;
  reporterUsername: string;
  reportedPlayerId: string;
  reportedUsername: string;
  category: ReportCategoryId;
  description?: string;
  battleMode: GameMode | string;
}): Promise<{ ok: boolean; error?: string }> {
  const url = baseUrl();
  if (!url) return { ok: false, error: "no_server" };
  try {
    const res = await fetch(`${url}/reports/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(opts),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function fetchPlayerReputation(playerId: string): Promise<PlayerReputation | null> {
  const url = baseUrl();
  if (!url || !playerId) return null;
  try {
    const res = await fetch(`${url}/reports/reputation?playerId=${encodeURIComponent(playerId)}`);
    if (!res.ok) return null;
    const data = await res.json() as PlayerReputation & { ok?: boolean };
    if (!data.ok && data.reportsInWindow === undefined) return null;
    return {
      playerId: data.playerId,
      reportsInWindow: data.reportsInWindow ?? 0,
      totalReports: data.totalReports ?? 0,
      windowDays: data.windowDays ?? 5,
    };
  } catch {
    return null;
  }
}

export async function fetchAdminReportQueue(): Promise<{
  id: string;
  playerId: string;
  username: string;
  reportCount: number;
  queuedAt: number;
  reports: unknown[];
}[]> {
  const { adminServerFetch } = await import("./adminServerApi");
  try {
    const res = await adminServerFetch("/admin/reports/queue");
    if (!res.ok) return [];
    const data = await res.json() as { queue?: unknown[] };
    return (data.queue ?? []) as ReturnType<typeof fetchAdminReportQueue> extends Promise<infer T> ? T : never;
  } catch {
    return [];
  }
}

export async function resolveAdminReport(
  playerId: string,
  action: "dismiss" | "ban",
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  const { adminServerFetch } = await import("./adminServerApi");
  try {
    const res = await adminServerFetch("/admin/reports/resolve", {
      method: "POST",
      body: JSON.stringify({ playerId, action, note }),
    });
    const data = await res.json() as { ok?: boolean; error?: string };
    return { ok: Boolean(data.ok), error: data.error };
  } catch {
    return { ok: false, error: "network" };
  }
}
