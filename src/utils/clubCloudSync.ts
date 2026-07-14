/**
 * clubCloudSync — keeps the local clubs cache in sync with the Cloudflare Worker.
 *
 * Clubs are authoritative on the cloud; the game keeps a synchronous localStorage
 * mirror so the existing (sync) club getters keep working. This module hydrates
 * that mirror from the cloud on startup, on an interval, and when the tab regains
 * focus, so every player converges on the same global club directory.
 */
import * as clubCloud from "./cloud/clubCloud";
import {
  mergeCloudClubsIntoCache,
  pullMyClubToCache,
  CLUBS_UPDATED_EVENT,
  type Club,
} from "./clubs";
import { getCurrentUsername } from "./localStorageAPI";

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
let lastRefresh = 0;

const POLL_MS = 30_000;
const THROTTLE_MS = 10_000;
const DIRECTORY_LIMIT = 100;

/** Pull the global club directory + my club into the local cache. */
export async function refreshClubsFromCloud(): Promise<void> {
  if (!clubCloud.isClubsServerConfigured() || inFlight) return;
  inFlight = true;
  lastRefresh = Date.now();
  try {
    const { clubs } = await clubCloud.cloudListClubs<Club>(DIRECTORY_LIMIT);
    if (Array.isArray(clubs) && clubs.length) mergeCloudClubsIntoCache(clubs);
    await pullMyClubToCache();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CLUBS_UPDATED_EVENT));
    }
  } catch {
    /* offline — local cache stands */
  } finally {
    inFlight = false;
  }
}

export function bootstrapClubsCloud(): void {
  if (started || typeof window === "undefined") return;
  if (!clubCloud.isClubsServerConfigured()) return;
  started = true;

  void refreshClubsFromCloud();

  timer = setInterval(() => {
    if (document.visibilityState === "visible") void refreshClubsFromCloud();
  }, POLL_MS);

  window.addEventListener("focus", () => { void refreshClubsFromCloud(); });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshClubsFromCloud();
  });
  // Pick up the player's own club shortly after sign-in (throttled, since this
  // profile event fires on many unrelated updates).
  window.addEventListener("clash-profile-local-changed", () => {
    if (getCurrentUsername() && Date.now() - lastRefresh > THROTTLE_MS) {
      void refreshClubsFromCloud();
    }
  });
}

export function stopClubsCloud(): void {
  if (timer) { clearInterval(timer); timer = null; }
  started = false;
}
