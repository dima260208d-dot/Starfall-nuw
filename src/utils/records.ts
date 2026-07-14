import { BRAWLERS } from "../entities/BrawlerData";
import { getAllClubs, getClubTotalTrophies, type Club } from "./clubs";
import { getAllProfiles, getBrawlerTrophies, type UserProfile } from "./localStorageAPI";

export type RecordCategory = "global" | "brawler" | "club";
export type ClubRecordSort = "trophies" | "members";

export interface GlobalRecordEntry {
  rank: number;
  username: string;
  playerId: string;
  trophies: number;
  profileIconId?: string;
  totalGames: number;
  totalWins: number;
}

export interface BrawlerRecordEntry {
  rank: number;
  username: string;
  playerId: string;
  brawlerTrophies: number;
  profileIconId?: string;
}

export interface ClubRecordEntry {
  rank: number;
  club: Club;
  memberCount: number;
  totalTrophies: number;
}

function profilePlayerId(p: UserProfile): string {
  return p.playerId ?? p.username;
}

export { getClubTotalTrophies };

export function getGlobalTrophyRecords(): GlobalRecordEntry[] {
  const sorted = Object.values(getAllProfiles())
    .filter((p) => (p.trophies ?? 0) > 0 || p.totalGamesPlayed > 0)
    .sort((a, b) => (b.trophies ?? 0) - (a.trophies ?? 0) || a.username.localeCompare(b.username));

  return sorted.map((p, i) => ({
    rank: i + 1,
    username: p.username,
    playerId: profilePlayerId(p),
    trophies: p.trophies ?? 0,
    profileIconId: p.profileIconId,
    totalGames: p.totalGamesPlayed ?? 0,
    totalWins: p.totalWins ?? 0,
  }));
}

export function getBrawlerTrophyRecords(brawlerId: string): BrawlerRecordEntry[] {
  const sorted = Object.values(getAllProfiles())
    .map((p) => ({
      profile: p,
      brawlerTrophies: getBrawlerTrophies(p, brawlerId),
    }))
    .filter((row) => row.brawlerTrophies > 0)
    .sort(
      (a, b) =>
        b.brawlerTrophies - a.brawlerTrophies ||
        a.profile.username.localeCompare(b.profile.username),
    );

  return sorted.map((row, i) => ({
    rank: i + 1,
    username: row.profile.username,
    playerId: profilePlayerId(row.profile),
    brawlerTrophies: row.brawlerTrophies,
    profileIconId: row.profile.profileIconId,
  }));
}

export function getClubRecords(sortBy: ClubRecordSort = "trophies"): ClubRecordEntry[] {
  const rows = getAllClubs()
    .map((club) => ({
      club,
      memberCount: club.members.length,
      totalTrophies: getClubTotalTrophies(club),
    }))
    .filter((row) => row.memberCount > 0);

  rows.sort((a, b) => {
    if (sortBy === "members") {
      return b.memberCount - a.memberCount || b.totalTrophies - a.totalTrophies;
    }
    return b.totalTrophies - a.totalTrophies || b.memberCount - a.memberCount;
  });

  return rows.map((row, i) => ({
    rank: i + 1,
    club: row.club,
    memberCount: row.memberCount,
    totalTrophies: row.totalTrophies,
  }));
}

export function getRecordBrawlers() {
  return BRAWLERS;
}
