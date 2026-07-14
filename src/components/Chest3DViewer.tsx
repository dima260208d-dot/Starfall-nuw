/**
 * Chest3DViewer — 3D chest preview via shared SpinningModel3D (one WebGL context).
 * loadChestCached kept for ChestOpenAnimation full-screen viewer.
 */
import * as THREE from "three";
import { resolveHeavyAssetUrl, alternateHeavyAssetUrl } from "../lib/assetBase";
import { loadGLTFFromUrl } from "../utils/glbFetchCache";
import { CHESTS, type ChestRarity } from "../utils/chests";
import ChestVisual from "./ChestVisual";

export const CHEST_MODELS: Record<ChestRarity, string> = {
  common:         "models/chest_common.glb",
  rare:           "models/chest_rare.glb",
  epic:           "models/chest_epic.glb",
  mega:           "models/chest_mega.glb",
  legendary:      "models/chest_legendary.glb",
  mythic:         "models/chest_mythic.glb",
  ultralegendary: "models/chest_ultralegendary.glb",
};

interface CachedChest {
  scene: THREE.Group;
  normScale: number;
  normOffX: number;
  normOffY: number;
  normOffZ: number;
}

const chestGltfCache = new Map<string, Promise<CachedChest>>();

export function invalidateChestGltfCache(): void {
  chestGltfCache.clear();
}

function parseCachedChest(gltf: { scene: THREE.Group }): CachedChest {
  const scene = gltf.scene;
  scene.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const m = obj as THREE.Mesh;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat: THREE.Material) => { mat.side = THREE.DoubleSide; mat.needsUpdate = true; });
  });
  const box = new THREE.Box3().setFromObject(scene);
  const sz = new THREE.Vector3();
  box.getSize(sz);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const TARGET_H = 2.4;
  const normScale = sz.y > 0.001 ? TARGET_H / sz.y : 1;
  return {
    scene,
    normScale,
    normOffX: -center.x * normScale,
    normOffY: -box.min.y * normScale,
    normOffZ: -center.z * normScale,
  };
}

export function loadChestCached(url: string, allowAlternate = true): Promise<CachedChest> {
  const hit = chestGltfCache.get(url);
  if (hit) return hit;
  const p = loadGLTFFromUrl(url).then(parseCachedChest).catch((err) => {
    chestGltfCache.delete(url);
    const alt = allowAlternate ? alternateHeavyAssetUrl(url) : null;
    if (alt) return loadChestCached(alt, false);
    throw err;
  });
  chestGltfCache.set(url, p);
  return p;
}

interface Props {
  rarity: ChestRarity;
  size?: number;
  float?: boolean;
}

export default function Chest3DViewer({ rarity, size = 130, float = false }: Props) {
  return <ChestVisual rarity={rarity} size={size} animated float={float} />;
}
