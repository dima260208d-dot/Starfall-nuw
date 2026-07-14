/**
 * Character voice lines — CDN assets, per-brawler queue (no overlap).
 */
import { resolveVoiceAssetUrl } from "./audioUrls";
import { isVoiceEnabled, VOICE_RELATIVE_VOLUME } from "./audioSettings";
import { fetchBlobUrlWithDiskCache, fetchJsonWithDiskCache, peekBlobUrlDiskCache } from "../utils/assetDiskCache";
import type { PinKind } from "../entities/PinData";
import bundledVoiceManifest from "../../public/data/brawler-voice-manifest.json";

export type VoiceCategory =
  | "spawn"
  | "victory"
  | "kill"
  | "damage"
  | "death"
  | "respawn"
  | "super"
  | "taunt";

export type VoiceSource = "situational" | "emoji" | "menu" | "results" | "unlock" | "party";

export const MENU_VOICE_CATEGORIES: VoiceCategory[] = [
  "spawn",
  "victory",
  "respawn",
  "super",
  "taunt",
];

/** Always play — no random skip in battle relay. */
export const CERTAIN_VOICE_CATEGORIES: VoiceCategory[] = ["spawn", "death", "respawn"];

export const PIN_KIND_VOICE: Record<PinKind, VoiceCategory> = {
  default: "taunt",
  happy: "victory",
  sad: "damage",
  thumbs_up: "victory",
  angry: "taunt",
  hard: "damage",
  heart: "victory",
  special: "super",
};

type VoiceManifest = {
  version: number;
  categories: VoiceCategory[];
  brawlers: Record<string, Partial<Record<VoiceCategory, [string, string]>>>;
};

export type VoiceNetMsg = {
  type: "voice";
  id: string;
  brawlerId: string;
  category: VoiceCategory;
  variant: 0 | 1;
  source: "situational" | "emoji";
  unitId?: string;
  team?: string;
  x?: number;
  y?: number;
  inBush?: boolean;
  tick?: number;
};

export type BattleVoiceCamera = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BattleVoiceContext = {
  youId: string | null;
  yourTeam: string | null;
  camera: BattleVoiceCamera | null;
};

let manifest: VoiceManifest | null = bundledVoiceManifest as VoiceManifest;
let manifestPromise: Promise<VoiceManifest | null> | null = null;
const playing = new Map<string, HTMLAudioElement>();
const queues = new Map<string, Array<{ category: VoiceCategory; variant: 0 | 1 }>>();
const heardIds = new Set<string>();
const HEARD_MAX = 800;

function pruneHeard(): void {
  if (heardIds.size <= HEARD_MAX) return;
  const drop = heardIds.size - HEARD_MAX / 2;
  let i = 0;
  for (const k of heardIds) {
    heardIds.delete(k);
    if (++i >= drop) break;
  }
}

function voiceUrl(key: string): string | null {
  return resolveVoiceAssetUrl(key);
}

/**
 * Prefetched <audio> elements keyed by URL. Voice clips live on the CDN, so the
 * first play of an un-cached clip has to round-trip the network and lags badly.
 * We eagerly download (and keep decoded) each relevant clip so playback is
 * instant — clones reuse the already-fetched data from the browser cache.
 */
const voiceAudioCache = new Map<string, HTMLAudioElement>();

function getPrefetchedVoiceAudio(url: string): HTMLAudioElement {
  let base = voiceAudioCache.get(url);
  if (!base) {
    base = new Audio();
    base.preload = "auto";
    const cachedBlob = peekBlobUrlDiskCache(url);
    if (cachedBlob) {
      base.src = cachedBlob;
    } else {
      base.src = url;
      void fetchBlobUrlWithDiskCache(url, () => fetch(url, { cache: "force-cache" }), "audio/mpeg")
        .then((blobUrl) => {
          if (base && base.src !== blobUrl) {
            base.src = blobUrl;
            try { base.load(); } catch { /* ignore */ }
          }
        })
        .catch(() => {});
    }
    try { base.load(); } catch { /* ignore */ }
    voiceAudioCache.set(url, base);
  }
  return base;
}

/** Start downloading a single voice clip so it can play instantly later. */
export function prefetchVoiceUrl(url: string): void {
  getPrefetchedVoiceAudio(url);
}

/** Eagerly download all of a brawler's voice clips (instant in battle/menu). */
export function warmBrawlerVoices(brawlerId: string): void {
  const m = manifest;
  if (!m) {
    void loadManifest().then((loaded) => { if (loaded) warmBrawlerVoices(brawlerId); });
    return;
  }
  const b = m.brawlers[brawlerId];
  if (!b) return;
  for (const cat of Object.keys(b) as VoiceCategory[]) {
    const paths = b[cat];
    if (!paths) continue;
    for (const key of paths) {
      const url = voiceUrl(key);
      if (url) prefetchVoiceUrl(url);
    }
  }
}

async function loadManifest(): Promise<VoiceManifest | null> {
  if (manifest) return manifest;
  if (manifestPromise) return manifestPromise;
  manifestPromise = (async () => {
    const url = voiceUrl("audio/voices/manifest.json");
    if (!url) return null;
    try {
      manifest = await fetchJsonWithDiskCache<VoiceManifest>(url, () => {
        const init: RequestInit = { cache: "force-cache" };
        if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
          init.signal = AbortSignal.timeout(12_000);
        }
        return fetch(url, init);
      });
      return manifest;
    } catch {
      return manifest;
    }
  })();
  return manifestPromise;
}

export async function preloadVoiceManifest(): Promise<void> {
  await loadManifest();
}

function pickVariant(): 0 | 1 {
  return Math.random() < 0.5 ? 0 : 1;
}

function pickMenuCategory(): VoiceCategory {
  return MENU_VOICE_CATEGORIES[(Math.random() * MENU_VOICE_CATEGORIES.length) | 0];
}

function isOnScreen(x: number, y: number, cam: BattleVoiceCamera): boolean {
  const margin = 90;
  return (
    x >= cam.x - margin &&
    x <= cam.x + cam.width + margin &&
    y >= cam.y - margin &&
    y <= cam.y + cam.height + margin
  );
}

function teamLabel(t: 0 | 1 | 2 | undefined, fallback?: string): string {
  if (fallback) return fallback;
  if (t === 0) return "blue";
  if (t === 1) return "red";
  return "neutral";
}

function isAnyoneSpeaking(): boolean {
  return playing.size > 0;
}

/** True while this brawler's voice clip is playing (damage lines must not queue/stack). */
export function isBrawlerVoicePlaying(brawlerId: string): boolean {
  return playing.has(brawlerId);
}

function shouldHearEmoji(msg: VoiceNetMsg, ctx: BattleVoiceContext): boolean {
  if (msg.unitId === ctx.youId) return true;
  if (msg.x == null || msg.y == null || !ctx.camera) return false;
  if (!isOnScreen(msg.x, msg.y, ctx.camera)) return false;
  if (msg.inBush) return false;
  if (isAnyoneSpeaking()) return false;
  const ally =
    msg.team != null &&
    ctx.yourTeam != null &&
    msg.team === ctx.yourTeam;
  if (ally) return Math.random() < 0.5;
  return Math.random() < 0.2;
}

function shouldHearSituational(msg: VoiceNetMsg, ctx: BattleVoiceContext): boolean {
  if (msg.unitId === ctx.youId) return true;
  if (msg.x == null || msg.y == null || !ctx.camera) return false;
  if (!isOnScreen(msg.x, msg.y, ctx.camera)) return false;
  if (isAnyoneSpeaking()) return false;
  const ally =
    msg.team != null &&
    ctx.yourTeam != null &&
    msg.team === ctx.yourTeam;
  if (ally) {
    if (msg.inBush) return false;
    return Math.random() < 0.5;
  }
  if (msg.inBush) return false;
  return Math.random() < 0.2;
}

function playClipImmediateSync(
  brawlerId: string,
  category: VoiceCategory,
  variant: 0 | 1,
): boolean {
  if (!isVoiceEnabled()) return false;
  const m = manifest;
  if (!m) return false;
  const paths = m.brawlers[brawlerId]?.[category];
  if (!paths) return false;
  const key = paths[variant] ?? paths[0] ?? paths[1];
  if (!key) return false;
  const url = voiceUrl(key);
  if (!url) return false;

  // Play a clone of the prefetched clip so it starts instantly from cache
  // (and future plays can overlap without cutting each other off).
  const base = getPrefetchedVoiceAudio(url);
  const audio = (base.cloneNode(true) as HTMLAudioElement);
  audio.volume = VOICE_RELATIVE_VOLUME;
  playing.set(brawlerId, audio);
  const cleanup = () => {
    if (playing.get(brawlerId) === audio) playing.delete(brawlerId);
    const q = queues.get(brawlerId);
    if (q?.length) {
      const next = q.shift()!;
      playClipImmediateSync(brawlerId, next.category, next.variant);
    }
  };
  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("error", cleanup, { once: true });
  void audio.play().catch(() => cleanup());
  return true;
}

async function playClipImmediate(
  brawlerId: string,
  category: VoiceCategory,
  variant: 0 | 1,
): Promise<void> {
  if (playClipImmediateSync(brawlerId, category, variant)) return;
  if (!isVoiceEnabled()) return;
  const m = await loadManifest();
  if (!m) return;
  playClipImmediateSync(brawlerId, category, variant);
}

async function playClip(
  brawlerId: string,
  category: VoiceCategory,
  variant: 0 | 1,
): Promise<void> {
  const priority = CERTAIN_VOICE_CATEGORIES.includes(category);
  if (playing.has(brawlerId)) {
    if (priority) {
      playing.get(brawlerId)?.pause();
      playing.delete(brawlerId);
    } else if (category === "damage") {
      return;
    } else {
      const q = queues.get(brawlerId) ?? [];
      q.push({ category, variant });
      queues.set(brawlerId, q);
      return;
    }
  }
  if (playClipImmediateSync(brawlerId, category, variant)) return;
  await playClipImmediate(brawlerId, category, variant);
}

export function playMenuVoice(brawlerId: string, category?: VoiceCategory): void {
  const cat = category ?? pickMenuCategory();
  void playClip(brawlerId, cat, pickVariant());
}

export function playResultsVoice(brawlerId: string, won: boolean): void {
  void playClip(brawlerId, won ? "victory" : "damage", pickVariant());
}

export function playUnlockVoice(brawlerId: string): void {
  playBrawlerObtainVoice(brawlerId);
}

const OBTAIN_VOICE_CATEGORIES: VoiceCategory[] = ["spawn", "taunt", "victory", "super"];

/** One voice line when a brawler is unlocked, bought, or drops from a chest (incl. duplicate). */
export function playBrawlerObtainVoice(brawlerId: string): void {
  void (async () => {
    if (!isVoiceEnabled()) return;
    await preloadVoiceManifest();
    const m = manifest;
    if (!m) return;
    playing.get(brawlerId)?.pause();
    playing.delete(brawlerId);
    queues.delete(brawlerId);
    for (const cat of OBTAIN_VOICE_CATEGORIES) {
      if (!m.brawlers[brawlerId]?.[cat]) continue;
      if (playClipImmediateSync(brawlerId, cat, pickVariant())) return;
    }
  })();
}

/** @deprecated Use playBrawlerObtainVoice */
export function playChestBrawlerRevealVoice(brawlerId: string, _duplicate?: boolean): void {
  playBrawlerObtainVoice(brawlerId);
}

export function playVoiceLine(
  brawlerId: string,
  category: VoiceCategory,
  variant?: 0 | 1,
): void {
  void playClip(brawlerId, category, variant ?? pickVariant());
}

export function playPinVoice(brawlerId: string, kind: PinKind): void {
  const cat = PIN_KIND_VOICE[kind] ?? "taunt";
  void playClip(brawlerId, cat, pickVariant());
}

export function handleBattleVoiceMsg(msg: VoiceNetMsg, ctx: BattleVoiceContext): void {
  if (!msg?.id || heardIds.has(msg.id)) return;
  heardIds.add(msg.id);
  pruneHeard();

  if (msg.source === "emoji") {
    if (!shouldHearEmoji(msg, ctx)) return;
    void playClip(msg.brawlerId, msg.category, msg.variant);
    return;
  }

  if (!shouldHearSituational(msg, ctx)) return;
  void playClip(msg.brawlerId, msg.category, msg.variant);
}

export function buildVoiceNetMsg(partial: Omit<VoiceNetMsg, "type">): VoiceNetMsg {
  return { type: "voice", ...partial };
}

export function voiceTeamFromNet(t: 0 | 1 | 2 | undefined): string {
  return teamLabel(t);
}

export { pickVariant, pickMenuCategory, loadManifest };
