/**
 * Player report aggregation — rolling 5-day window, moderation at 100 reports.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.CONFIG_DATA_DIR || resolve(__dir, "../data");
const PATH = resolve(DATA_DIR, "player-reports.json");

const WINDOW_MS = 5 * 24 * 60 * 60 * 1000;
const THRESHOLD = 100;

const EMPTY = { reports: [], playerWindows: {}, moderationQueue: [] };

function load() {
  try {
    return JSON.parse(readFileSync(PATH, "utf8"));
  } catch {
    return structuredClone(EMPTY);
  }
}

function save(data) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PATH, JSON.stringify(data, null, 2));
}

function pruneWindow(entries, now) {
  return entries.filter((e) => now - e.at < WINDOW_MS);
}

function windowCount(entries, now) {
  return pruneWindow(entries, now).length;
}

export function createPlayerReportsStore() {
  let data = load();

  function persist() {
    save(data);
  }

  return {
    submitReport(payload) {
      const now = Date.now();
      const id = `rpt_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const entry = {
        id,
        at: now,
        reporterPlayerId: String(payload.reporterPlayerId ?? "").toUpperCase(),
        reporterUsername: String(payload.reporterUsername ?? "").slice(0, 40),
        reportedPlayerId: String(payload.reportedPlayerId ?? "").toUpperCase(),
        reportedUsername: String(payload.reportedUsername ?? "").slice(0, 40),
        category: String(payload.category ?? "other").slice(0, 40),
        description: String(payload.description ?? "").slice(0, 500),
        battleMode: String(payload.battleMode ?? "").slice(0, 32),
      };
      if (!entry.reporterPlayerId || !entry.reportedPlayerId || entry.reporterPlayerId === entry.reportedPlayerId) {
        return { ok: false, error: "invalid_payload" };
      }
      data.reports.push(entry);
      if (data.reports.length > 50_000) data.reports = data.reports.slice(-40_000);

      const pid = entry.reportedPlayerId;
      const win = data.playerWindows[pid] ?? { entries: [], totalAllTime: 0 };
      win.entries.push({ at: now, category: entry.category, id });
      win.entries = pruneWindow(win.entries, now);
      win.totalAllTime = (win.totalAllTime ?? 0) + 1;
      data.playerWindows[pid] = win;

      const count = win.entries.length;
      let queued = false;
      if (count >= THRESHOLD) {
        const existing = data.moderationQueue.find((q) => q.playerId === pid && q.status === "pending");
        if (!existing) {
          const related = data.reports.filter((r) => r.reportedPlayerId === pid).slice(-200);
          data.moderationQueue.push({
            id: `mod_${now.toString(36)}`,
            playerId: pid,
            username: entry.reportedUsername,
            reportCount: count,
            queuedAt: now,
            status: "pending",
            reports: related,
          });
          queued = true;
        }
      }
      persist();
      return { ok: true, id, windowCount: count, queued };
    },

    getReputation(playerId) {
      const pid = String(playerId ?? "").toUpperCase();
      if (!pid) return { ok: false, error: "invalid_id" };
      const now = Date.now();
      const win = data.playerWindows[pid];
      const windowCountVal = win ? windowCount(win.entries, now) : 0;
      return {
        ok: true,
        playerId: pid,
        reportsInWindow: windowCountVal,
        totalReports: win?.totalAllTime ?? 0,
        windowDays: 5,
      };
    },

    listModerationQueue() {
      return data.moderationQueue.filter((q) => q.status === "pending");
    },

    resolveModeration(playerId, action, adminNote = "") {
      const pid = String(playerId ?? "").toUpperCase();
      const item = data.moderationQueue.find((q) => q.playerId === pid && q.status === "pending");
      if (!item) return { ok: false, error: "not_found" };
      item.status = action === "ban" ? "banned" : "dismissed";
      item.resolvedAt = Date.now();
      item.adminNote = String(adminNote).slice(0, 300);
      if (action === "dismiss" && data.playerWindows[pid]) {
        data.playerWindows[pid].entries = [];
      }
      persist();
      return { ok: true, action: item.status, playerId: pid };
    },

    resetWindowsIfExpired() {
      const now = Date.now();
      let changed = false;
      for (const pid of Object.keys(data.playerWindows)) {
        const win = data.playerWindows[pid];
        const pruned = pruneWindow(win.entries ?? [], now);
        if (pruned.length !== (win.entries ?? []).length) {
          win.entries = pruned;
          changed = true;
        }
      }
      if (changed) persist();
    },
  };
}
