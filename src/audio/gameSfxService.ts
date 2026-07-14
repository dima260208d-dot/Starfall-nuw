/**
 * One-shot game SFX — bundled under public/audio/music/, overlays on BGM.
 */
import { isMusicEnabled, SFX_RELATIVE_VOLUME } from "./audioSettings";
import { SFX_FILES, type SfxTrackId } from "./gameAudioManifest";
import { resolveBundledSfxUrl } from "./audioUrls";
import { fetchBlobUrlWithDiskCache, peekBlobUrlDiskCache } from "../utils/assetDiskCache";

const urlCache = new Map<SfxTrackId, string>();
/** One preloaded (decoded) element per SFX so replays don't wait on a fetch. */
const warmCache = new Map<SfxTrackId, HTMLAudioElement>();

/** Quieter menu/chest/resource sounds (half of default SFX). */
export const MENU_SFX_VOLUME = SFX_RELATIVE_VOLUME * 0.5;

function sfxUrl(id: SfxTrackId): string | null {
  if (urlCache.has(id)) return urlCache.get(id)!;
  // SFX are bundled locally — never route them through the CDN, or each play
  // triggers a network fetch and the sound lags behind the action.
  const url = resolveBundledSfxUrl(SFX_FILES[id]);
  urlCache.set(id, url);
  return url;
}

function warmSfx(id: SfxTrackId): HTMLAudioElement | null {
  const cached = warmCache.get(id);
  if (cached) return cached;
  const url = sfxUrl(id);
  if (!url) return null;
  const el = new Audio();
  el.preload = "auto";
  const cachedBlob = peekBlobUrlDiskCache(url);
  if (cachedBlob) {
    el.src = cachedBlob;
  } else {
    el.src = url;
    void fetchBlobUrlWithDiskCache(url, () => fetch(url, { cache: "force-cache" }), "audio/mpeg")
      .then((blobUrl) => {
        if (el && el.src !== blobUrl) {
          el.src = blobUrl;
          try { el.load(); } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }
  try { el.load(); } catch { /* ignore */ }
  warmCache.set(id, el);
  return el;
}

export function playGameSfx(
  id: SfxTrackId,
  opts?: { volume?: number; loop?: boolean },
): HTMLAudioElement | null {
  if (!isMusicEnabled()) return null;
  const url = sfxUrl(id);
  if (!url) return null;
  // Clone a preloaded element: the audio data is already in memory, so the
  // one-shot fires immediately instead of after a fresh load/fetch.
  const warm = warmSfx(id);
  const audio = (warm?.cloneNode() as HTMLAudioElement | undefined) ?? new Audio(url);
  audio.volume = opts?.volume ?? SFX_RELATIVE_VOLUME;
  audio.loop = opts?.loop ?? false;
  void audio.play().catch(() => {});
  return audio;
}

/** Stackable resource bounce — menu BGM should be ducked separately. */
export function playResourceBounceSfx(): void {
  playGameSfx("resource-bounce", { volume: MENU_SFX_VOLUME * 0.35 });
}

export function playButtonSfx(): void {
  playGameSfx("button");
}

export function playBrawlerPickSfx(): void {
  playGameSfx("brawler-pick", { volume: MENU_SFX_VOLUME });
}

export function playGoalSfx(): void {
  playGameSfx("goal");
}

export function playBrawlerLevelUpSfx(): void {
  playGameSfx("brawler-level-up");
}

export function playComicPageSfx(): void {
  playGameSfx("comic-page");
}

export function playMessageSfx(): void {
  playGameSfx("message");
}

let countdownAudio: HTMLAudioElement | null = null;

export function startCountdown10OverlaySfx(): void {
  stopCountdown10OverlaySfx();
  countdownAudio = playGameSfx("countdown-10s", { loop: true, volume: SFX_RELATIVE_VOLUME * 0.85 });
}

export function stopCountdown10OverlaySfx(): void {
  if (countdownAudio) {
    countdownAudio.pause();
    countdownAudio = null;
  }
}

const seenClaimKeys = new Set<string>();

/** Play once per unseen claimable-reward session key. */
export function playClaimRewardSfxOnce(sessionKey: string): void {
  if (!sessionKey || seenClaimKeys.has(sessionKey)) return;
  seenClaimKeys.add(sessionKey);
  playGameSfx("claim-reward", { volume: MENU_SFX_VOLUME });
}

export function resetClaimRewardSession(key: string): void {
  seenClaimKeys.delete(key);
}
