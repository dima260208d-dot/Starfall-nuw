/** Looping background music — bundled under public/audio/music/. */

import {

  BGM_RELATIVE_VOLUME,

  isMusicEnabled,

  subscribeAudioSettings,

} from "./audioSettings";

import { onAudioUnlocked } from "./audioUnlock";

import { BGM_FILES, type BgmTrackId } from "./gameAudioManifest";

import { resolveMusicAssetUrl } from "./audioUrls";
import { preloadBgmTrack } from "./gameAudioPreload";
import { fetchBlobUrlWithDiskCache, peekBlobUrlDiskCache } from "../utils/assetDiskCache";

export { preloadBgmTrack } from "./gameAudioPreload";

const CROSSFADE_MS = 450;

function trackUrl(file: string): string {
  return resolveMusicAssetUrl(file);
}



class GameMusicService {

  private el: HTMLAudioElement | null = null;

  private elUrl: string | null = null;

  private crossEl: HTMLAudioElement | null = null;

  private fadeOutgoing: HTMLAudioElement | null = null;

  private current: BgmTrackId | null = null;

  private desired: BgmTrackId | null = "menu";

  private duckMul = 1;

  private fadeTimer: ReturnType<typeof setInterval> | null = null;



  constructor() {

    subscribeAudioSettings(() => this.applyVolumeToElements());

    onAudioUnlocked(() => this.ensurePlaying());

    if (typeof document !== "undefined") {

      document.addEventListener(

        "pointerdown",

        () => {

          if (this.el?.paused && !document.hidden) this.ensurePlaying();

        },

        { capture: true, passive: true },

      );

      document.addEventListener("visibilitychange", () => {

        if (document.hidden) this.pauseAll();

        else if (isMusicEnabled()) this.ensurePlaying();

      });

    }

  }



  private vol(): number {

    return isMusicEnabled() ? BGM_RELATIVE_VOLUME * this.duckMul : 0;

  }



  private applyVolumeToElements(): void {

    const v = this.vol();

    if (this.el) this.el.volume = v;

    if (this.crossEl) this.crossEl.volume = v;

    if (!isMusicEnabled()) {

      this.pauseAll();

    }

  }



  private disposeAudio(el: HTMLAudioElement | null): null {

    if (!el) return null;

    try {

      el.pause();

      el.src = "";

      el.load();

      el.remove();

    } catch {

      /* ignore */

    }

    return null;

  }



  private clearFade(): void {

    if (this.fadeTimer) {

      clearInterval(this.fadeTimer);

      this.fadeTimer = null;

    }

    if (this.fadeOutgoing) {

      this.fadeOutgoing = this.disposeAudio(this.fadeOutgoing);

    }

    if (this.crossEl) {

      this.crossEl = this.disposeAudio(this.crossEl);

    }

  }



  private attachToDom(audio: HTMLAudioElement): void {

    if (typeof document === "undefined") return;

    if (audio.isConnected) return;

    audio.style.display = "none";

    document.body.appendChild(audio);

  }



  private tryPlay(audio: HTMLAudioElement): void {

    if (document.hidden) return;

    this.attachToDom(audio);

    audio.volume = this.vol();

    const attempt = () => {

      if (document.hidden) return;

      void audio.play().catch(() => {});

    };

    if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) attempt();

    else {

      audio.addEventListener("canplay", attempt, { once: true });

      audio.load();

    }

  }



  private prepareAudio(url: string, loop = true): HTMLAudioElement {
    const audio = new Audio();
    audio.loop = loop;
    audio.preload = "auto";

    const cachedBlob = peekBlobUrlDiskCache(url);
    if (cachedBlob) {
      audio.src = cachedBlob;
    } else {
      audio.src = url;
      void fetchBlobUrlWithDiskCache(url, () => fetch(url, { cache: "force-cache" }), "audio/mpeg")
        .then((blobUrl) => {
          if (audio && audio.src !== blobUrl) {
            audio.src = blobUrl;
            try { audio.load(); } catch { /* ignore */ }
          }
        })
        .catch(() => {});
    }

    try { audio.load(); } catch { /* ignore */ }
    return audio;
  }

  private getOrCreateMain(url: string): HTMLAudioElement {
    if (this.el && this.elUrl === url) return this.el;

    this.el = this.disposeAudio(this.el);

    this.el = this.prepareAudio(url, true);
    this.elUrl = url;
    return this.el;
  }



  private startTrack(track: BgmTrackId): void {

    this.desired = track;

    if (!isMusicEnabled()) {

      this.current = track;

      return;

    }



    const url = this.urlFor(track);

    if (this.current === track && this.el && this.elUrl === url && !this.el.paused) {

      this.el.volume = this.vol();

      return;

    }



    this.clearFade();

    this.current = track;



    const audio = this.getOrCreateMain(url);

    this.tryPlay(audio);

  }



  private urlFor(track: BgmTrackId): string {

    return trackUrl(BGM_FILES[track]);

  }



  /** Set track and play immediately. */

  requestTrack(track: BgmTrackId): void {

    this.startTrack(track);

  }



  ensurePlaying(): void {

    if (!isMusicEnabled() || document.hidden) return;

    const track = this.desired ?? this.current ?? "menu";

    if (!this.el || this.elUrl !== this.urlFor(track)) {

      this.startTrack(track);

      return;

    }

    if (this.el.paused) this.tryPlay(this.el);

  }



  play(track: BgmTrackId): void {

    this.requestTrack(track);

  }



  crossfadeTo(track: BgmTrackId, ms = CROSSFADE_MS): void {

    if (!isMusicEnabled()) {

      this.current = track;

      this.desired = track;

      return;

    }

    if (this.current === track && this.el && !this.el.paused) return;



    if (!this.el || this.el.paused) {

      this.requestTrack(track);

      return;

    }



    this.clearFade();

    const from = this.el;

    this.fadeOutgoing = from;

    const url = this.urlFor(track);

    const to = new Audio(url);

    to.loop = true;

    to.preload = "auto";

    to.volume = 0;

    this.attachToDom(to);

    this.crossEl = to;

    this.current = track;

    this.desired = track;

    this.tryPlay(to);



    const target = this.vol();

    const steps = Math.max(1, Math.floor(ms / 40));

    let step = 0;

    const startFrom = from.volume;



    this.fadeTimer = setInterval(() => {

      step++;

      const t = step / steps;

      from.volume = Math.max(0, startFrom * (1 - t));

      to.volume = target * t;

      if (step >= steps) {

        this.clearFade();

        this.disposeAudio(from);

        this.el = to;

        this.elUrl = url;

        to.volume = target;

      }

    }, ms / steps);

  }



  hardSwitchTo(track: BgmTrackId): void {

    this.clearFade();

    this.el = this.disposeAudio(this.el);

    this.elUrl = null;

    this.requestTrack(track);

  }



  pauseAll(): void {

    this.clearFade();

    this.el?.pause();

    this.crossEl?.pause();

    this.fadeOutgoing?.pause();

  }



  stop(): void {

    this.clearFade();

    this.current = null;

    this.desired = null;

    this.el = this.disposeAudio(this.el);

    this.elUrl = null;

  }



  duckMenu(factor = 0.35): void {

    this.duckMul = factor;

    this.applyVolumeToElements();

  }



  restoreMenu(): void {

    this.duckMul = 1;

    this.applyVolumeToElements();

  }



  getCurrentTrack(): BgmTrackId | null {

    return this.current;

  }

}



export const gameMusic = new GameMusicService();



// After boot config, warm up menu track.

if (typeof window !== "undefined") {

  preloadBgmTrack("menu");

}


