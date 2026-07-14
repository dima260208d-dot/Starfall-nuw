import {
  clearClubBossRaid,
  findPlayerIdByUsername,
  getClub,
  patchClub,
  setClubBossRaidBoss,
  syncClubBossRaidFromParty,
  abortClubBossRaidRecruitment,
  type Club,
} from "./clubs";
import { getCurrentProfile, updateProfile } from "./localStorageAPI";
import { normalizePlayerIdQuery } from "./playerId";
import {
  getMyPartyCode,
  getOrCreateMyParty,
  getPartyRoom,
  joinPartyByCode,
  PARTY_CHANGED_EVENT,
} from "./social/party";

const LOBBY_BOSS_KEY = "lobby_bossraid_boss_v1";

export { setClubBossRaidBoss, syncClubBossRaidFromParty, clearClubBossRaid };

export function persistLobbyBossRaidBossId(bossId: string | null): void {
  try {
    if (bossId) localStorage.setItem(LOBBY_BOSS_KEY, bossId);
    else localStorage.removeItem(LOBBY_BOSS_KEY);
  } catch { /* ignore */ }
}

export function configureProfileForClubBossRaid(bossId: string): void {
  updateProfile({ selectedMode: "bossraid" } as Parameters<typeof updateProfile>[0]);
  persistLobbyBossRaidBossId(bossId);
}

export function startClubBossRaidRecruitment(clubId: string): {
  success: boolean;
  error?: string;
  bossId?: string;
} {
  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: "Не авторизован" };

  const club = getClub(clubId);
  if (!club) return { success: false, error: "Клуб не найден" };
  const raid = club.bossRaid;
  if (!raid?.bossId) return { success: false, error: "Сначала выберите босса" };

  const myId = normalizePlayerIdQuery(me.playerId);
  const existingCode = (me as { partyCode?: string | null }).partyCode;
  if (existingCode && raid.partyCode && existingCode !== raid.partyCode) {
    return { success: false, error: "Сначала выйдите из текущей команды" };
  }

  if (raid.partyCode) {
    const room = getPartyRoom(raid.partyCode);
    if (!room) {
      clearClubBossRaid(clubId);
    } else if (normalizePlayerIdQuery(raid.leaderPlayerId ?? "") === myId) {
      configureProfileForClubBossRaid(raid.bossId);
      syncClubBossRaidFromParty(clubId);
      emitClubBossRaidChanged();
      return { success: true, bossId: raid.bossId };
    } else if (existingCode === raid.partyCode) {
      configureProfileForClubBossRaid(raid.bossId);
      emitClubBossRaidChanged();
      return { success: true, bossId: raid.bossId };
    } else if (existingCode) {
      return { success: false, error: "Сначала выйдите из текущей команды" };
    }
  }

  if (existingCode && !raid.partyCode) {
    return { success: false, error: "Сначала выйдите из текущей команды" };
  }

  const room = getOrCreateMyParty();
  patchClub(clubId, c => ({
    ...c,
    bossRaid: {
      ...(c.bossRaid ?? {
        bossId: null,
        leaderPlayerId: null,
        leaderUsername: null,
        partyCode: null,
        joinedPlayerIds: [],
        updatedAt: 0,
      }),
      bossId: raid.bossId,
      leaderPlayerId: myId,
      leaderUsername: me.username,
      partyCode: room.code,
      joinedPlayerIds: [myId],
      updatedAt: Date.now(),
    },
  }));
  configureProfileForClubBossRaid(raid.bossId);
  emitClubBossRaidChanged();
  return { success: true, bossId: raid.bossId };
}

export async function joinClubBossRaidRecruitment(clubId: string): Promise<{
  success: boolean;
  error?: string;
  bossId?: string;
}> {
  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: "Не авторизован" };

  const club = getClub(clubId);
  if (!club) return { success: false, error: "Клуб не найден" };
  const raid = club.bossRaid;
  if (!raid?.partyCode || !raid.bossId) {
    return { success: false, error: "Сбор команды ещё не начат" };
  }

  const myId = normalizePlayerIdQuery(me.playerId);
  const myCode = getMyPartyCode();
  if (myCode) {
    if (myCode === raid.partyCode) {
      configureProfileForClubBossRaid(raid.bossId);
      syncClubBossRaidFromParty(clubId);
      emitClubBossRaidChanged();
      return { success: true, bossId: raid.bossId };
    }
    return { success: false, error: "Сначала выйдите из текущей команды" };
  }

  const joined = await joinPartyByCode(raid.partyCode);
  if (!joined.success) return joined;

  patchClub(clubId, c => ({
    ...c,
    bossRaid: {
      ...(c.bossRaid ?? {
        bossId: null,
        leaderPlayerId: null,
        leaderUsername: null,
        partyCode: null,
        joinedPlayerIds: [],
        updatedAt: 0,
      }),
      joinedPlayerIds: [...new Set([...(c.bossRaid?.joinedPlayerIds ?? []), myId])],
      updatedAt: Date.now(),
    },
  }));
  configureProfileForClubBossRaid(raid.bossId);
  syncClubBossRaidFromParty(clubId);
  emitClubBossRaidChanged();
  return { success: true, bossId: raid.bossId };
}

export function cancelClubBossRaidRecruitment(clubId: string): { success: boolean; error?: string } {
  const me = getCurrentProfile();
  if (!me?.playerId) return { success: false, error: "Не авторизован" };
  const club = getClub(clubId);
  if (!club?.bossRaid?.partyCode) return { success: false, error: "Сбор не активен" };
  const myId = normalizePlayerIdQuery(me.playerId);
  if (normalizePlayerIdQuery(club.bossRaid.leaderPlayerId ?? "") !== myId) {
    return { success: false, error: "Отменить может только лидер похода" };
  }
  abortClubBossRaidRecruitment(clubId);
  return { success: true };
}

export function getClubBossRaidMemberViews(club: Club): Array<{
  username: string;
  playerId: string | null;
  joined: boolean;
  isLeader: boolean;
}> {
  const raid = club.bossRaid;
  const joinedSet = new Set((raid?.joinedPlayerIds ?? []).map(normalizePlayerIdQuery));
  const leaderId = raid?.leaderPlayerId ? normalizePlayerIdQuery(raid.leaderPlayerId) : null;
  return club.members.map(m => {
    const pid = findPlayerIdByUsername(m.username);
    const norm = pid ? normalizePlayerIdQuery(pid) : null;
    return {
      username: m.username,
      playerId: norm,
      joined: norm ? joinedSet.has(norm) : false,
      isLeader: norm != null && leaderId === norm,
    };
  });
}

export const CLUB_BOSS_RAID_CHANGED = "clash_club_boss_raid_changed";

export function emitClubBossRaidChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CLUB_BOSS_RAID_CHANGED));
  }
}

export function subscribeClubBossRaidChanged(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onParty = () => cb();
  window.addEventListener(CLUB_BOSS_RAID_CHANGED, cb);
  window.addEventListener(PARTY_CHANGED_EVENT, onParty);
  return () => {
    window.removeEventListener(CLUB_BOSS_RAID_CHANGED, cb);
    window.removeEventListener(PARTY_CHANGED_EVENT, onParty);
  };
}
