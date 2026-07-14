import { resolveMusicAssetUrl, resolveBundledSfxUrl } from "./audioUrls";
import { resolveHeavyAssetUrl } from "../lib/assetBase";
import { BGM_FILES, SFX_FILES, type BgmTrackId } from "./gameAudioManifest";
import { BOOT_INTRO_START_AUDIO_FILE } from "../utils/firstLaunchIntro";
import { fetchBlobUrlWithDiskCache, peekBlobUrlDiskCache } from "../utils/assetDiskCache";

const warmed = new Set<string>();

function warmAudio(url: string): void {
  if (warmed.has(url)) return;
  warmed.add(url);
  const audio = new Audio();
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
}

/** Preload every bundled BGM/SFX track and shared 3D icon GLBs for instant playback at boot. */
export function preloadAllGameAudio(): void {
  for (const file of Object.values(BGM_FILES)) warmAudio(resolveMusicAssetUrl(file));
  // SFX play from the bundled local copy (see gameSfxService) — warm that same
  // URL so the decoded audio is ready and one-shots never lag behind the action.
  for (const file of Object.values(SFX_FILES)) warmAudio(resolveBundledSfxUrl(file));
  warmAudio(resolveMusicAssetUrl(BOOT_INTRO_START_AUDIO_FILE));
  void import("../components/SpinningModel3D").then(({ preloadSpinningModelPath }) => {
    for (const path of [
      "models/coin.glb",
      "models/gem.glb",
      "models/powerpoint.glb",
      "models/trophy.glb",
      "models/chest_common.glb",
      "models/chest_rare.glb",
      "models/chest_epic.glb",
    ]) {
      void preloadSpinningModelPath(path);
    }
  });
  for (const path of ["models/coin.glb", "models/gem.glb", "models/powerpoint.glb"]) {
    void import("../utils/glbFetchCache")
      .then(({ fetchGlbBuffer }) => fetchGlbBuffer(resolveHeavyAssetUrl(path)))
      .catch(() => {});
  }
}

export function preloadBgmTrack(track: BgmTrackId): void {
  warmAudio(resolveMusicAssetUrl(BGM_FILES[track]));
}
