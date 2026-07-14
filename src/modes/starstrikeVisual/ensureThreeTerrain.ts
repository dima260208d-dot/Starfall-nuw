import * as THREE from "three";

/** Патчит глобальный THREE для legacy-бандла three.terrain.js (он ожидает window.THREE). */
let loadPromise: Promise<void> | null = null;

export async function ensureThreeTerrainLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const g = globalThis as unknown as { THREE?: typeof THREE };
    g.THREE = THREE;
    await import("three.terrain.js/build/THREE.Terrain.min.js");
  })();
  return loadPromise;
}
