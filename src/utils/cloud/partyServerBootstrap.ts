import { getCurrentProfile } from "../localStorageAPI";
import { PARTY_CHANGED_EVENT } from "../social/party";
import {
  hydratePartyFromServer,
  isOnlinePartySyncEnabled,
  pushPartyRoomToServer,
  subscribePartyRoomOnServer,
  wakePartyServer,
} from "./partyServerSync";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeWs: (() => void) | null = null;

export function onPartiesWritten(all: Record<string, unknown>): void {
  if (!isOnlinePartySyncEnabled()) return;

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void (async () => {
      await wakePartyServer(45_000);
      for (const [code, room] of Object.entries(all)) {
        if (room && typeof room === "object") {
          await pushPartyRoomToServer(code, room as Record<string, unknown>);
        }
      }
    })();
  }, 200);
}

export function initPartyServerBootstrap(): void {
  if (!isOnlinePartySyncEnabled()) return;

  void wakePartyServer(30_000);

  const sync = () => {
    const code = (getCurrentProfile() as { partyCode?: string | null } | null)?.partyCode;
    if (!code || typeof code !== "string") {
      unsubscribeWs?.();
      unsubscribeWs = null;
      return;
    }

    const norm = code.toUpperCase();
    void hydratePartyFromServer(norm);

    if (unsubscribeWs) unsubscribeWs();
    unsubscribeWs = subscribePartyRoomOnServer(norm, (room) => {
      const PARTIES_KEY = "clash_parties_v1";
      try {
        const raw = localStorage.getItem(PARTIES_KEY);
        const all = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        all[norm] = room;
        localStorage.setItem(PARTIES_KEY, JSON.stringify(all));
        window.dispatchEvent(new Event(PARTY_CHANGED_EVENT));
      } catch {
        /* ignore */
      }
    });
  };

  sync();
  window.addEventListener("clash-profile-local-changed", sync);
  window.addEventListener(PARTY_CHANGED_EVENT, sync);
}
