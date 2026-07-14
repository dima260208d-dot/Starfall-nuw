import {
  listAllPlayerKeys,
  getPlayerAdminSummary,
  playerSearchLabel,
  type PlayerAdminSummary,
} from "../playerAdmin";
import { getCurrentUsername, findProfileStorageKey } from "../localStorageAPI";
import { formatPlayerIdDisplay } from "../playerId";

const MODE_LABELS: Record<string, string> = {
  showdown: "Столкновение",
  crystals: "Вынос кристаллов",
  heist: "Ограбление",
  gemgrab: "Ограбление кристаллов",
  siege: "Осада",
  training: "Тренировка",
  megashowdown: "Мега",
  starstrike: "Звёздный удар",
  bossraid: "Рейд босса",
  bounty: "Награда",
};

export interface PlayerListEntry {
  storageKey: string;
  label: string;
  summary: PlayerAdminSummary;
  isCurrent: boolean;
}

export interface GlobalPlayerAnalytics {
  totalPlayers: number;
  activePlayers: number;
  blockedPlayers: number;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  totalTrophies: number;
  totalCoins: number;
  totalGems: number;
  avgWinRate: number;
  modeActivity: { label: string; value: number }[];
  trophyBuckets: { label: string; value: number }[];
  activityLast7: number[];
  topPlayers: PlayerListEntry[];
  currentUserEntry: PlayerListEntry | null;
}

export interface PlayerDetailAnalytics {
  summary: PlayerAdminSummary;
  winRate: number;
  modeWins: { label: string; value: number }[];
  modeGames: { label: string; value: number }[];
  trophyHistory: number[];
  resourceBreakdown: { label: string; value: number; color: string }[];
  battleTimeline: { label: string; won: boolean; ts: number }[];
  engagementScore: number;
  avgTrophyDelta: number;
}

function winRate(w: number, l: number): number {
  const t = w + l;
  return t ? Math.round((w / t) * 100) : 0;
}

export function buildGlobalPlayerAnalytics(): GlobalPlayerAnalytics {
  const keys = listAllPlayerKeys();
  const currentKey = getCurrentUsername() ? findProfileStorageKey(getCurrentUsername()!) : null;
  const entries: PlayerListEntry[] = [];

  let totalGames = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let totalTrophies = 0;
  let totalCoins = 0;
  let totalGems = 0;
  let blockedPlayers = 0;
  const modeMap = new Map<string, number>();
  const trophyBuckets = new Map<string, number>([
    ["0-499", 0], ["500-999", 0], ["1000-1999", 0], ["2000+", 0],
  ]);

  for (const key of keys) {
    const summary = getPlayerAdminSummary(key);
    if (!summary) continue;
    const isCurrent = key === currentKey;
    entries.push({
      storageKey: key,
      label: playerSearchLabel(key),
      summary,
      isCurrent,
    });
    if (summary.blocked) blockedPlayers++;
    totalGames += summary.totalGamesPlayed;
    totalWins += summary.totalWins;
    totalLosses += summary.totalLosses;
    totalTrophies += summary.trophies;
    totalCoins += summary.coins;
    totalGems += summary.gems;
    for (const b of summary.battleHistory) {
      const m = MODE_LABELS[b.mode] ?? b.mode;
      modeMap.set(m, (modeMap.get(m) ?? 0) + 1);
    }
    const tr = summary.trophies;
    if (tr < 500) trophyBuckets.set("0-499", (trophyBuckets.get("0-499") ?? 0) + 1);
    else if (tr < 1000) trophyBuckets.set("500-999", (trophyBuckets.get("500-999") ?? 0) + 1);
    else if (tr < 2000) trophyBuckets.set("1000-1999", (trophyBuckets.get("1000-1999") ?? 0) + 1);
    else trophyBuckets.set("2000+", (trophyBuckets.get("2000+") ?? 0) + 1);
  }

  entries.sort((a, b) => b.summary.trophies - a.summary.trophies);

  const activityLast7 = [0, 0, 0, 0, 0, 0, 0];
  const now = Date.now();
  for (const e of entries) {
    for (const b of e.summary.battleHistory) {
      const day = Math.floor((now - b.ts) / 86400000);
      if (day >= 0 && day < 7) activityLast7[6 - day]++;
    }
  }

  return {
    totalPlayers: keys.length,
    activePlayers: keys.length - blockedPlayers,
    blockedPlayers,
    totalGames,
    totalWins,
    totalLosses,
    totalTrophies,
    totalCoins,
    totalGems,
    avgWinRate: winRate(totalWins, totalLosses),
    modeActivity: [...modeMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    trophyBuckets: [...trophyBuckets.entries()].map(([label, value]) => ({ label, value })),
    activityLast7,
    topPlayers: entries.slice(0, 50),
    currentUserEntry: entries.find(e => e.isCurrent) ?? null,
  };
}

export function buildPlayerDetailAnalytics(summary: PlayerAdminSummary): PlayerDetailAnalytics {
  const modeWins = new Map<string, number>();
  const modeGames = new Map<string, number>();
  for (const b of summary.battleHistory) {
    const m = MODE_LABELS[b.mode] ?? b.mode;
    modeGames.set(m, (modeGames.get(m) ?? 0) + 1);
    if (b.won) modeWins.set(m, (modeWins.get(m) ?? 0) + 1);
  }

  const recent = [...summary.battleHistory].sort((a, b) => a.ts - b.ts).slice(-20);
  const trophyHistory = recent.map((b, i) => Math.max(0, summary.trophies - (recent.length - i) * 3 + (b.won ? 5 : -3)));
  const trophyDeltas = summary.battleHistory.map(b => b.trophyDelta);
  const avgTrophyDelta = trophyDeltas.length
    ? Math.round(trophyDeltas.reduce((a, b) => a + b, 0) / trophyDeltas.length)
    : 0;

  const engagementScore = Math.min(100, Math.round(
    summary.totalGamesPlayed * 2
    + summary.unlockedBrawlers * 4
    + summary.clashPassLevel * 3
    + (summary.inboxUnread === 0 ? 5 : 0),
  ));

  return {
    summary,
    winRate: winRate(summary.totalWins, summary.totalLosses),
    modeWins: [...modeWins.entries()].map(([label, value]) => ({ label, value })),
    modeGames: [...modeGames.entries()].map(([label, value]) => ({ label, value })),
    trophyHistory,
    resourceBreakdown: [
      { label: "Монеты", value: summary.coins, color: "#FFD54F" },
      { label: "Кристаллы", value: summary.gems, color: "#40C4FF" },
      { label: "ОС", value: summary.powerPoints, color: "#CE93D8" },
      { label: "Трофеи", value: summary.trophies, color: "#FF7043" },
    ],
    battleTimeline: summary.battleHistory.slice(0, 30).map(b => ({
      label: `${MODE_LABELS[b.mode] ?? b.mode} · ${b.won ? "W" : "L"}`,
      won: b.won,
      ts: b.ts,
    })),
    engagementScore,
    avgTrophyDelta,
  };
}

export function formatPlayerId(summary: PlayerAdminSummary): string {
  return summary.playerId ? formatPlayerIdDisplay(summary.playerId) : "—";
}
