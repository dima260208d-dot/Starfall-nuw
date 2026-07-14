import { preloadBootAssets } from "./battleAssetPreloader";

export async function preloadAllModels(
  base: string,
  onProgress: (ratio: number) => void,
): Promise<void> {
  await preloadBootAssets(base, onProgress);
}

export { preloadBootAssets as preloadMenuBootAssets };
export { preloadBootAssets as startBackgroundBattlePreload };
