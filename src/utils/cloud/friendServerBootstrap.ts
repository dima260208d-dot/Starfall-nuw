import { getCurrentProfile } from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import { FRIENDS_CHANGED_EVENT } from "../social/friends";
import {
  isOnlineFriendSyncEnabled,
  syncFriendsFromServer,
  applyServerFriendsList,
  type ServerFriend,
  type ServerFriendRequest,
} from "./friendServerSync";
import { getGameServerWsUrl } from "../../lib/runtimeConfig";

let pollTimer: ReturnType<typeof setInterval> | null = null;
let friendWs: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connectFriendWs(): void {
  const wsUrl = getGameServerWsUrl();
  const profile = getCurrentProfile();
  const playerId = profile?.playerId ? normalizePlayerIdQuery(profile.playerId) : "";
  if (!wsUrl || !playerId || !isOnlineFriendSyncEnabled()) return;

  if (friendWs && (friendWs.readyState === WebSocket.OPEN || friendWs.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    const url = new URL(wsUrl);
    url.searchParams.set("room", `player:${playerId}`);
    friendWs = new WebSocket(url.toString());

    friendWs.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          type?: string;
          request?: ServerFriendRequest;
          friends?: ServerFriend[];
          friend?: ServerFriend;
          fromPlayerId?: string;
          toPlayerId?: string;
        };

        if (msg.type === "friend-request:new" || msg.type === "friend-request:sent") {
          void syncFriendsFromServer();
          return;
        }
        if (msg.type === "friend-request:accepted" && msg.friends) {
          applyServerFriendsList(msg.friends);
          return;
        }
        if (msg.type === "friends:updated" && msg.friends) {
          applyServerFriendsList(msg.friends);
          return;
        }
        if (
          msg.type === "friend-request:declined"
          || msg.type === "friend-request:cancelled"
        ) {
          void syncFriendsFromServer();
        }
      } catch {
        /* ignore */
      }
    };

    friendWs.onclose = () => {
      friendWs = null;
      if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
      wsReconnectTimer = setTimeout(connectFriendWs, 4000);
    };
  } catch {
    friendWs = null;
  }
}

export function initFriendServerBootstrap(): void {
  if (!isOnlineFriendSyncEnabled()) return;

  void syncFriendsFromServer();
  connectFriendWs();

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    void syncFriendsFromServer();
  }, 8_000);

  window.addEventListener("clash-profile-local-changed", () => {
    connectFriendWs();
  });
}

export function stopFriendServerBootstrap(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = null;
  friendWs?.close();
  friendWs = null;
}
