import {
  getAllProfiles,
  normalizeProfile,
  saveProfiles,
  type UserProfile,
} from "./localStorageAPI";
import { normalizePlayerIdQuery } from "./playerId";

const KNOWN_PLAYERS_KEY = "clash_known_players_v1";

export type KnownPlayerStub = {
  playerId: string;
  username: string;
  selectedBrawlerId?: string;
  favoriteBrawlerId?: string;
  profileIconId?: string;
  trophies?: number;
};

function readKnown(): Record<string, KnownPlayerStub> {
  try {
    const raw = localStorage.getItem(KNOWN_PLAYERS_KEY);
    return raw ? JSON.parse(raw) as Record<string, KnownPlayerStub> : {};
  } catch {
    return {};
  }
}

function writeKnown(all: Record<string, KnownPlayerStub>): void {
  localStorage.setItem(KNOWN_PLAYERS_KEY, JSON.stringify(all));
}

export function cacheKnownPlayerStub(stub: KnownPlayerStub): void {
  const id = normalizePlayerIdQuery(stub.playerId);
  const all = readKnown();
  all[id] = { ...stub, playerId: id };
  writeKnown(all);

  const storageKey = `_known_${id}`;
  const profiles = getAllProfiles();
  if (profiles[storageKey]) return;

  profiles[storageKey] = normalizeProfile({
    username: stub.username,
    playerId: id,
    selectedBrawlerId: stub.selectedBrawlerId ?? "hana",
    favoriteBrawlerId: stub.favoriteBrawlerId ?? stub.selectedBrawlerId ?? "hana",
    profileIconId: stub.profileIconId,
    trophies: stub.trophies ?? 0,
    coins: 0,
    gems: 0,
    unlockedBrawlers: [stub.selectedBrawlerId ?? "hana"],
    createdAt: Date.now(),
  } as UserProfile);
  saveProfiles(profiles);
}

export function getKnownPlayerStub(playerId: string): KnownPlayerStub | null {
  const id = normalizePlayerIdQuery(playerId);
  return readKnown()[id] ?? null;
}
