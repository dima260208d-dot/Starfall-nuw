import { preloadBrawlerGltfUrl, markUiPreviewGltfLoaded } from "../components/Brawler3DModel";
import { getBrawler3DPreviewConfig } from "../components/BrawlerViewer3D";
import { BRAWLERS } from "../entities/BrawlerData";
import { PET_3D_IDS, PET_UI_MODEL_URLS } from "../game/pet3DRenderer";
import { resolveHeavyAssetUrl } from "../lib/assetBase";

/** Warm menu UI GLB cache (brawlers + pets) before main menu mounts. */
export async function preloadAllMenuUi3DGltfs(): Promise<void> {
  const urls = new Set<string>();

  for (const b of BRAWLERS) {
    const cfg = getBrawler3DPreviewConfig(b.id);
    if (cfg) urls.add(resolveHeavyAssetUrl(cfg.url));
  }

  for (const petId of PET_3D_IDS) {
    const url = PET_UI_MODEL_URLS[petId];
    if (url) urls.add(resolveHeavyAssetUrl(url));
  }

  await Promise.all(
    [...urls].map(async (url) => {
      const cached = await preloadBrawlerGltfUrl(url);
      if (cached) markUiPreviewGltfLoaded(url);
    }),
  );
}
