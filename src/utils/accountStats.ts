import type { BattleRecord, UserProfile } from "./localStorageAPI";

export interface DayBucket {
  key: string;
  label: string;
  wins: number;
  losses: number;
  games: number;
  trophies: number;
}

export interface ModeRow {
  mode: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export function buildBattleDayBuckets(history: BattleRecord[], days = 14, locale = "ru-RU"): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      key,
      label: d.toLocaleDateString(locale, { day: "numeric", month: "short" }),
      wins: 0,
      losses: 0,
      games: 0,
      trophies: 0,
    });
  }
  for (const r of history) {
    const key = new Date(r.ts).toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue;
    b.games++;
    if (r.won) b.wins++;
    else b.losses++;
    b.trophies += r.trophyDelta;
  }
  return [...buckets.values()];
}

export function buildModeRows(profile: UserProfile): ModeRow[] {
  return Object.entries(profile.modeStats ?? {})
    .map(([mode, s]) => ({
      mode,
      games: s.games,
      wins: s.wins,
      losses: s.losses,
      winRate: s.games ? Math.round((s.wins / s.games) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games);
}

export function topBrawlersByTrophies(profile: UserProfile, limit = 8) {
  return Object.entries(profile.brawlerTrophies ?? {})
    .map(([id, trophies]) => ({ id, trophies, level: profile.brawlerLevels[id] ?? 1 }))
    .sort((a, b) => b.trophies - a.trophies)
    .slice(0, limit);
}

export function chestTotal(profile: UserProfile): number {
  return Object.values(profile.chestInventory ?? {}).reduce((a, n) => a + (n || 0), 0);
}

export function accountAgeDays(profile: UserProfile): number {
  return Math.max(1, Math.floor((Date.now() - profile.createdAt) / 86_400_000));
}

export function winRate(profile: UserProfile): number {
  if (!profile.totalGamesPlayed) return 0;
  return Math.round((profile.totalWins / profile.totalGamesPlayed) * 100);
}

export function donateSpendingByMonth(records: { ts: number; priceRub?: number }[], months = 6, locale = "ru-RU") {
  const buckets = new Map<string, { label: string; rub: number }>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, {
      label: d.toLocaleDateString(locale, { month: "short" }),
      rub: 0,
    });
  }
  for (const r of records) {
    if (!r.priceRub) continue;
    const d = new Date(r.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const b = buckets.get(key);
    if (b) b.rub += r.priceRub;
  }
  return [...buckets.values()];
}
