import * as THREE from "three";

/** Per-brawler Y squash after auto height-fit (1 = no extra squash). */
export const BRAWLER_MODEL_HEIGHT_SCALE: Record<string, number> = {};

export function brawlerIdFromModelUrl(url: string): string | null {
  const m = url.match(/models\/([^/?#]+)\.glb/i);
  return m ? m[1] : null;
}

export function getBrawlerModelHeightScale(urlOrId: string): number {
  const id = urlOrId.includes("models/") ? brawlerIdFromModelUrl(urlOrId) : urlOrId;
  if (!id) return 1;
  return BRAWLER_MODEL_HEIGHT_SCALE[id] ?? 1;
}

export interface BrawlerNormTransform {
  normScale: number;
  normScaleY: number;
  normOffX: number;
  normOffY: number;
  normOffZ: number;
}

export function computeBrawlerNormTransform(
  scene: THREE.Object3D,
  targetHeight: number,
  urlOrId: string,
): BrawlerNormTransform {
  const box = new THREE.Box3().setFromObject(scene);
  const sz = new THREE.Vector3();
  box.getSize(sz);
  const hScale = getBrawlerModelHeightScale(urlOrId);
  const normScale = sz.y > 0.001 ? targetHeight / sz.y : 1;
  const normScaleY = normScale * hScale;

  const wrap = new THREE.Group();
  const probe = scene.clone();
  wrap.add(probe);
  wrap.scale.set(normScale, normScaleY, normScale);
  wrap.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(wrap);
  const center = new THREE.Vector3();
  fitted.getCenter(center);

  return {
    normScale,
    normScaleY,
    normOffX: -center.x,
    normOffY: -fitted.min.y,
    normOffZ: -center.z,
  };
}

export function applyBrawlerNormTransform(
  model: THREE.Object3D,
  t: Pick<BrawlerNormTransform, "normScale" | "normScaleY" | "normOffX" | "normOffY" | "normOffZ">,
): void {
  if (Math.abs(t.normScaleY - t.normScale) < 1e-6) {
    model.scale.setScalar(t.normScale);
  } else {
    model.scale.set(t.normScale, t.normScaleY, t.normScale);
  }
  model.position.set(t.normOffX, t.normOffY, t.normOffZ);
}

/** Cache-bust query when the on-disk GLB is replaced without renaming. */
export function brawlerGlbPath(id: string): string {
  const v = id === "lumina" ? "?v=3" : id === "oliver" ? "?v=2" : id === "callista" ? "?v=1" : id === "airin" ? "?v=1" : id === "elian" ? "?v=1" : id === "silven" ? "?v=1" : id === "vittoria" ? "?v=1" : id === "octavia" ? "?v=2" : id === "zephyrin" ? "?v=1" : id === "mirabel" ? "?v=1" : "";
  return `models/${id}.glb${v}`;
}

export function brawlerGlbUrl(base: string, id: string): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}${brawlerGlbPath(id)}`;
}
