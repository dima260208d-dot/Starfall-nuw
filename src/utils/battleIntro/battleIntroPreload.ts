import { preloadBrawlerGltfUrl } from "../../components/Brawler3DModel";
import { getPinImageSrc } from "../../components/PinIcon";
import { getMasteryBadgeSrc } from "../brawlerMasteryUI";
import { getProfileIconImage } from "../profileIconUtils";
import { getRankBadgeSrc } from "../brawlerRankUI";
import { brawlerGlbPath } from "../../game/brawler3DScale";
import type { BattleIntroParticipant } from "./battleIntroParticipants";
import { getStarFeatBadgeUrl } from "./battleIntroParticipants";
import { getHeavyAssetBaseUrl, getCustomizationAssetBaseUrl } from "../../lib/assetBase";
import { brawlerAvatarUrl } from "../modeAssets";

const MODEL_BY_ID: Record<string, { path: string }> = {
  miya: { path: "models/miya.glb" },
  ronin: { path: "models/ronin.glb" },
  yuki: { path: "models/yuki.glb" },
  kenji: { path: "models/kenji.glb" },
  hana: { path: "models/hana.glb" },
  goro: { path: "models/goro.glb" },
  sora: { path: "models/sora.glb" },
  rin: { path: "models/rin.glb" },
  taro: { path: "models/taro.glb" },
  zafkiel: { path: "models/zafkiel.glb" },
  verdeletta: { path: "models/verdeletta.glb" },
  lumina: { path: brawlerGlbPath("lumina").replace(/^\//, "") },
  oliver: { path: brawlerGlbPath("oliver").replace(/^\//, "") },
  callista: { path: brawlerGlbPath("callista").replace(/^\//, "") },
  airin: { path: brawlerGlbPath("airin").replace(/^\//, "") },
  elian: { path: brawlerGlbPath("elian").replace(/^\//, "") },
  silven: { path: brawlerGlbPath("silven").replace(/^\//, "") },
  vittoria: { path: brawlerGlbPath("vittoria").replace(/^\//, "") },
  octavia: { path: brawlerGlbPath("octavia").replace(/^\//, "") },
  zephyrin: { path: brawlerGlbPath("zephyrin").replace(/^\//, "") },
  mirabel: { path: brawlerGlbPath("mirabel").replace(/^\//, "") },
};

function preloadImage(src: string): void {
  if (!src) return;
  const img = new Image();
  img.decoding = "async";
  img.src = src;
}

export function preloadIntroBrawlerModels(brawlerIds: readonly string[]): void {
  const base = getHeavyAssetBaseUrl();
  const seen = new Set<string>();
    for (const id of brawlerIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const entry = MODEL_BY_ID[id];
    if (entry) {
      void preloadBrawlerGltfUrl(`${base}${entry.path}`).catch(() => {});
    }
    preloadImage(brawlerAvatarUrl(id));
  }
}

/** Warm pin / badge / profile PNGs used on intro cards. */
export function preloadIntroCardAssets(participants: readonly BattleIntroParticipant[]): void {
  const base = getCustomizationAssetBaseUrl();
  const uiBase = getHeavyAssetBaseUrl();
  preloadIntroBrawlerModels(participants.map(p => p.brawlerId));
  const seen = new Set<string>();
  for (const p of participants) {
    const pinSrc = getPinImageSrc(p.pinId, base);
    if (pinSrc && !seen.has(pinSrc)) {
      seen.add(pinSrc);
      preloadImage(pinSrc);
    }
    if (p.masteryTier) {
      const src = getMasteryBadgeSrc(p.masteryTier);
      if (!seen.has(src)) {
        seen.add(src);
        preloadImage(src);
      }
    }
    if (p.featTierBadge != null) {
      const src = `${uiBase}${getStarFeatBadgeUrl(p.featTierBadge)}`;
      if (!seen.has(src)) {
        seen.add(src);
        preloadImage(src);
      }
    }
    const rankSrc = getRankBadgeSrc(p.brawlerRank);
    if (!seen.has(rankSrc)) {
      seen.add(rankSrc);
      preloadImage(rankSrc);
    }
    const profileSrc = getProfileIconImage(p.profileIconId, base);
    if (profileSrc && !seen.has(profileSrc)) {
      seen.add(profileSrc);
      preloadImage(profileSrc);
    }
    const profileSrc2 = getProfileIconImage(p.profileIconIds[1], base);
    if (profileSrc2 && !seen.has(profileSrc2)) {
      seen.add(profileSrc2);
      preloadImage(profileSrc2);
    }
  }
}
