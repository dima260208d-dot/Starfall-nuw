import {
  getAllProfiles,
  getCurrentProfile,
  getCurrentUsername,
  saveProfiles,
  updateProfile,
  findProfileStorageKeyByPlayerId,
  normalizeProfile,
} from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import { translate as t } from "../../i18n";
import { getRemotePresenceEntry } from "../cloud/remotePresenceCache";

export type PresenceScreen = "menu" | "results" | "battle" | "offline";

export type MenuActivityId =
  | "shop"
  | "quests"
  | "character"
  | "collection"
  | "clashpass"
  | "trophies"
  | "chests"
  | "pets"
  | "customization"
  | "settings"
  | "news"
  | "messages"
  | "friends"
  | "clubs"
  | "modes"
  | "profile"
  | "megaSquad"
  | "starGuardian"
  | "mapeditor"
  | "admin";

export const MENU_ACTIVITY_DEMO_CYCLE: MenuActivityId[] = [
  "shop", "quests", "character", "collection", "clashpass",
  "trophies", "chests", "pets", "modes", "settings",
];

const MENU_ACTIVITY_I18N: Record<MenuActivityId, string> = {
  shop: "nav.partyActivity.shop",
  quests: "nav.partyActivity.quests",
  character: "nav.partyActivity.character",
  collection: "nav.partyActivity.collection",
  clashpass: "nav.partyActivity.clashpass",
  trophies: "nav.partyActivity.trophies",
  chests: "nav.partyActivity.chests",
  pets: "nav.partyActivity.pets",
  customization: "nav.partyActivity.customization",
  settings: "nav.partyActivity.settings",
  news: "nav.partyActivity.news",
  messages: "nav.partyActivity.messages",
  friends: "nav.partyActivity.friends",
  clubs: "nav.partyActivity.clubs",
  modes: "nav.partyActivity.modes",
  profile: "nav.partyActivity.profile",
  megaSquad: "nav.partyActivity.megaSquad",
  starGuardian: "nav.partyActivity.starGuardian",
  mapeditor: "nav.partyActivity.mapeditor",
  admin: "nav.partyActivity.admin",
};

const SCREEN_MENU_ACTIVITY: Record<string, MenuActivityId | null> = {
  menu: null,
  modeSelect: "modes",
  characterSelect: "character",
  collection: "collection",
  shop: "shop",
  customization: "customization",
  settings: "settings",
  profile: "profile",
  clashpass: "clashpass",
  trophyroad: "trophies",
  chests: "chests",
  pets: "pets",
  mapeditor: "mapeditor",
  news: "news",
  messages: "messages",
  admin: "admin",
  clubs: "clubs",
  friends: "friends",
  playerProfile: "profile",
  megaSquad: "megaSquad",
  starGuardianRewards: "starGuardian",
};

export interface SocialPresence {
  screen: PresenceScreen;
  updatedAt: number;
  /** Что делает игрок в подменю (магазин, квесты и т.д.) — видно команде в лобби. */
  menuActivity?: MenuActivityId | null;
  /** Режим активного боя (для списка друзей / наблюдения). */
  battleMode?: string;
  /** Id сессии live-наблюдения. */
  battleSessionId?: string;
  /** Число зрителей live-боя (только у ведущего). */
  liveSpectatorCount?: number;
}

const ONLINE_MS = 5 * 60 * 1000;

export const PRESENCE_CHANGED_EVENT = "clash_presence_changed";

function emitPresenceChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PRESENCE_CHANGED_EVENT));
  }
}

export function setMyPresence(screen: Exclude<PresenceScreen, "offline">) {
  const me = getCurrentUsername();
  if (!me) return;
  const prev = getCurrentProfile()?.socialPresence as SocialPresence | undefined;
  const presence: SocialPresence = {
    screen,
    updatedAt: Date.now(),
    menuActivity:
      screen === "battle" || screen === "results"
        ? null
        : prev?.menuActivity ?? null,
    battleMode: screen === "battle" || screen === "results" ? prev?.battleMode : undefined,
    battleSessionId: screen === "battle" || screen === "results" ? prev?.battleSessionId : undefined,
    liveSpectatorCount: screen === "battle" ? prev?.liveSpectatorCount : undefined,
  };
  updateProfile({ socialPresence: presence } as Parameters<typeof updateProfile>[0]);
  emitPresenceChanged();
}

export function setMyBattlePresence(mode: string, sessionId: string) {
  const me = getCurrentUsername();
  if (!me) return;
  const presence: SocialPresence = {
    screen: "battle",
    updatedAt: Date.now(),
    menuActivity: null,
    battleMode: mode,
    battleSessionId: sessionId,
  };
  updateProfile({ socialPresence: presence } as Parameters<typeof updateProfile>[0]);
  emitPresenceChanged();
}

export function clearMyBattlePresence() {
  const me = getCurrentUsername();
  if (!me) return;
  const prev = getCurrentProfile()?.socialPresence as SocialPresence | undefined;
  if (!prev || prev.screen === "offline") return;
  const presence: SocialPresence = {
    screen: prev.screen === "results" ? "results" : "menu",
    updatedAt: Date.now(),
    menuActivity: prev.screen === "menu" ? prev.menuActivity ?? null : null,
  };
  updateProfile({ socialPresence: presence } as Parameters<typeof updateProfile>[0]);
  emitPresenceChanged();
}

export function getBattleModeForPlayerId(playerId: string): string | null {
  const idNorm = normalizePlayerIdQuery(playerId);
  const remote = getRemotePresenceEntry(idNorm);
  if (remote?.screen === "battle") return remote.battleMode ?? null;
  const pr = readPresenceForPlayerId(playerId);
  if (!pr || pr.screen !== "battle") return null;
  return pr.battleMode ?? null;
}

export function touchMyPresence() {
  const p = getCurrentProfile();
  if (!p?.socialPresence) {
    setMyPresence("menu");
    return;
  }
  const screen = p.socialPresence.screen === "offline" ? "menu" : p.socialPresence.screen;
  if (screen === "offline") return;
  setMyPresence(screen as Exclude<PresenceScreen, "offline">);
}

function readPresenceForPlayerId(playerId: string): SocialPresence | null {
  const idNorm = normalizePlayerIdQuery(playerId);
  const key = findProfileStorageKeyByPlayerId(idNorm);
  if (!key) return null;
  const all = getAllProfiles();
  const raw = all[key];
  if (!raw) return null;
  const prof = normalizeProfile(raw as any);
  const pr = (prof as any).socialPresence as SocialPresence | undefined;
  if (!pr?.updatedAt) return null;
  return pr;
}

export function getPresenceForPlayerId(playerId: string): {
  screen: PresenceScreen;
  updatedAt: number;
  online: boolean;
} {
  const idNorm = normalizePlayerIdQuery(playerId);
  const remote = getRemotePresenceEntry(idNorm);
  if (remote) {
    const stale = Date.now() - remote.updatedAt > ONLINE_MS;
    if (!stale && remote.screen !== "offline") {
      return { screen: remote.screen, updatedAt: remote.updatedAt, online: true };
    }
    if (!stale && remote.screen === "offline") {
      return { screen: "offline", updatedAt: remote.updatedAt, online: false };
    }
  }

  const pr = readPresenceForPlayerId(playerId);
  const now = Date.now();
  if (!pr) {
    return { screen: "offline", updatedAt: 0, online: false };
  }
  const stale = now - pr.updatedAt > ONLINE_MS;
  if (stale) {
    return { screen: "offline", updatedAt: pr.updatedAt, online: false };
  }
  return { screen: pr.screen, updatedAt: pr.updatedAt, online: true };
}

export function formatLastSeen(updatedAt: number, online: boolean): string {
  if (online) return t("presence.online");
  if (!updatedAt) return t("presence.longAgo");
  const diff = Date.now() - updatedAt;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("presence.justNow");
  if (mins < 60) return t("presence.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("presence.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("presence.daysAgo", { count: days });
  return t("presence.longAgo");
}

export function presenceScreenLabel(screen: PresenceScreen): string {
  switch (screen) {
    case "menu": return t("presence.screen.menu");
    case "results": return t("presence.screen.results");
    case "battle": return t("presence.screen.battle");
    default: return t("presence.screen.offline");
  }
}

/** Persist last-active timestamp when going offline (logout / background). */
export function markOffline() {
  const me = getCurrentUsername();
  if (!me) return;
  const presence: SocialPresence = { screen: "offline", updatedAt: Date.now() };
  updateProfile({ socialPresence: presence } as any);
  emitPresenceChanged();
}

export function menuActivityLabel(activity: MenuActivityId): string {
  return t(MENU_ACTIVITY_I18N[activity]);
}

export function screenToMenuActivity(screen: string): MenuActivityId | null {
  if (Object.prototype.hasOwnProperty.call(SCREEN_MENU_ACTIVITY, screen)) {
    return SCREEN_MENU_ACTIVITY[screen] ?? null;
  }
  return null;
}

export function setMyMenuActivity(activity: MenuActivityId | null) {
  if (!getCurrentUsername()) return;
  const prev = getCurrentProfile()?.socialPresence as SocialPresence | undefined;
  if (prev?.screen === "battle" || prev?.screen === "results") return;
  const presence: SocialPresence = {
    screen: "menu",
    updatedAt: Date.now(),
    menuActivity: activity,
  };
  updateProfile({ socialPresence: presence } as Parameters<typeof updateProfile>[0]);
  emitPresenceChanged();
}

export function getMenuActivityLabelForPlayerId(playerId: string): string | null {
  const idNorm = normalizePlayerIdQuery(playerId);
  const remote = getRemotePresenceEntry(idNorm);
  if (remote?.screen === "menu" && remote.menuActivity) {
    return menuActivityLabel(remote.menuActivity);
  }
  const pr = readPresenceForPlayerId(playerId);
  if (!pr || pr.screen !== "menu" || !pr.menuActivity) return null;
  return menuActivityLabel(pr.menuActivity);
}

/** Статус участника клуба: онлайн, активность в меню, бой или «был(а) …». */
export function getClubMemberStatusText(playerId: string | undefined | null): string {
  if (!playerId) return formatLastSeen(0, false);
  const pr = getPresenceForPlayerId(playerId);
  if (!pr.online) return formatLastSeen(pr.updatedAt, false);
  if (pr.screen === "battle") return presenceScreenLabel("battle");
  if (pr.screen === "results") return presenceScreenLabel("results");
  const activity = getMenuActivityLabelForPlayerId(playerId);
  return activity ?? t("presence.online");
}
