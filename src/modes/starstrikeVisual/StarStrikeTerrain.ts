import * as THREE from "three";
import { ensureThreeTerrainLoaded } from "./ensureThreeTerrain";

/** После ensureThreeTerrainLoaded на THREE висят поля библиотеки (без типов в @types/three). */
type ThreeWithTerrain = typeof THREE & {
  Terrain: ((o: Record<string, unknown>) => THREE.Object3D) & {
    Linear: (t: number) => number;
    DiamondSquare: (zs: number[], opts: Record<string, unknown>) => void;
  };
};

/**
 * Процедурный ландшафт (three.terrain.js) под размер арены StarStrike.
 * Возвращает группу: родитель уже повёрнут как в библиотеке (rotation.x = -π/2).
 */
export async function createStarStrikeTerrainRoot(
  mapW: number,
  mapH: number,
): Promise<THREE.Object3D> {
  await ensureThreeTerrainLoaded();
  const TH = THREE as unknown as ThreeWithTerrain;
  const xSegments = 63;
  const ySegments = 63;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x355a38,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: false,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const root = TH.Terrain({
    easing: TH.Terrain.Linear,
    frequency: 2.2,
    heightmap: TH.Terrain.DiamondSquare,
    material: mat,
    maxHeight: 55,
    minHeight: -35,
    steps: 1,
    xSegments,
    xSize: mapW,
    ySegments,
    ySize: mapH,
  });
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return root;
}
