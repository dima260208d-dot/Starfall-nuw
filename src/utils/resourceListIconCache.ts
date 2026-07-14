/**
 * Static 2D sprites baked from resource GLBs (coin / gem / power point).
 * Used in long reward lists instead of live SpinningModel3D icons.
 * Claim animations still use full 3D (ChestItemScene).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { fixCharacterSkinnedMeshes } from "./gltfSkinnedMeshFix";
import { applyCanvasBitmapDrawPolicy, applyGLTFTexturePolicy } from "./texturePolicy";
import { registerWebGLCleanup } from "./devWebGLRecovery";
import { getHeavyAssetBaseUrl } from "../lib/assetBase";

export type ResourceListIconKind = "coins" | "gems" | "powerPoints";

const BAKE_SIZE = 256;

const CFG: Record<ResourceListIconKind, {
  model: string;
  color: string;
  ambientMult: number;
  dirMult: number;
  rotY: number;
}> = {
  coins: {
    model: "models/coin.glb",
    color: "#FFD700",
    ambientMult: 2.2,
    dirMult: 2.2,
    rotY: 0.55,
  },
  gems: {
    model: "models/gem.glb",
    color: "#40C4FF",
    ambientMult: 2.0,
    dirMult: 2.0,
    rotY: 0.45,
  },
  powerPoints: {
    model: "models/powerpoint.glb",
    color: "#CE93D8",
    ambientMult: 2.0,
    dirMult: 3.0,
    rotY: 0.5,
  },
};

const canvases: Partial<Record<ResourceListIconKind, HTMLCanvasElement>> = {};
let loadPromise: Promise<void> | null = null;
const readyListeners = new Set<() => void>();

function notifyResourceListIconsReady(): void {
  for (const fn of readyListeners) {
    try { fn(); } catch { /* ignore */ }
  }
}

/** Подписка на завершение выпечки иконок (для списков с виртуальным скроллом). */
export function subscribeResourceListIcons(listener: () => void): () => void {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

let bakerRenderer: THREE.WebGLRenderer | null = null;

function getModelBaseUrl(): string {
  return getHeavyAssetBaseUrl();
}

function getRenderer(): THREE.WebGLRenderer | null {
  if (bakerRenderer) return bakerRenderer;
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(BAKE_SIZE, BAKE_SIZE);
    r.setPixelRatio(1);
    r.setClearColor(0x000000, 0);
    bakerRenderer = r;
    return r;
  } catch {
    return null;
  }
}

export function disposeResourceListIconBaker(): void {
  if (bakerRenderer) {
    try { bakerRenderer.dispose(); } catch { /* ignore */ }
    bakerRenderer = null;
  }
}

registerWebGLCleanup(disposeResourceListIconBaker);

function normalizeModel(model: THREE.Object3D, renderer: THREE.WebGLRenderer | null): THREE.Group {
  fixCharacterSkinnedMeshes(model);
  applyGLTFTexturePolicy(model, renderer);
  const box = new THREE.Box3().setFromObject(model);
  const c = new THREE.Vector3();
  box.getCenter(c);
  const sz = new THREE.Vector3();
  box.getSize(sz);
  const maxDim = Math.max(sz.x, sz.y, sz.z);
  const scale = maxDim > 0.001 ? 1.2 / maxDim : 1;
  model.scale.setScalar(scale);
  model.position.set(-c.x * scale, -c.y * scale, -c.z * scale);
  const group = new THREE.Group();
  group.add(model);
  return group;
}

function bakeKind(
  renderer: THREE.WebGLRenderer,
  kind: ResourceListIconKind,
): Promise<HTMLCanvasElement> {
  const cfg = CFG[kind];
  const url = `${getModelBaseUrl()}${cfg.model.replace(/^\//, "")}`;

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`resource icon timeout: ${url}`)), 30_000);
    new GLTFLoader().load(
      url,
      (gltf) => {
        window.clearTimeout(timer);
        try {
          const group = normalizeModel(gltf.scene.clone(true), renderer);
          group.rotation.y = cfg.rotY;

          const scene = new THREE.Scene();
          scene.add(group);

          const color = new THREE.Color(cfg.color);
          scene.add(new THREE.AmbientLight(0xffffff, 1.8 * cfg.ambientMult));
          const dir = new THREE.DirectionalLight(0xffffff, 3.0 * cfg.dirMult);
          dir.position.set(2, 4, 3);
          scene.add(dir);
          const fill = new THREE.DirectionalLight(0xffffff, 1.2 * cfg.dirMult);
          fill.position.set(-2, 1, 2);
          scene.add(fill);
          const back = new THREE.DirectionalLight(color, 0.8 * cfg.dirMult);
          back.position.set(-2, -1, -3);
          scene.add(back);

          const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
          camera.position.set(0, 0.6, 3);
          camera.lookAt(0, 0.2, 0);

          renderer.setSize(BAKE_SIZE, BAKE_SIZE);
          renderer.setClearColor(0x000000, 0);
          renderer.render(scene, camera);

          const out = document.createElement("canvas");
          out.width = BAKE_SIZE;
          out.height = BAKE_SIZE;
          const ctx = out.getContext("2d")!;
          applyCanvasBitmapDrawPolicy(ctx);
          ctx.drawImage(renderer.domElement, 0, 0);
          resolve(out);
        } catch (e) {
          reject(e);
        }
      },
      undefined,
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function getResourceListIconCanvas(kind: ResourceListIconKind): HTMLCanvasElement | null {
  return canvases[kind] ?? null;
}

export function getResourceListIconUrl(kind: ResourceListIconKind): string | null {
  const c = canvases[kind];
  if (!c) return null;
  try {
    return c.toDataURL("image/png");
  } catch {
    return null;
  }
}

/** Pre-bake list icons from GLB (call during boot preload). */
export function loadResourceListIcons(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const renderer = getRenderer();
    if (!renderer) return;
    const kinds: ResourceListIconKind[] = ["coins", "gems", "powerPoints"];
    await Promise.all(
      kinds.map(async (kind) => {
        try {
          canvases[kind] = await bakeKind(renderer, kind);
        } catch {
          /* leave null — ResourceListIcon falls back to emoji */
        }
      }),
    );
    notifyResourceListIconsReady();
  })();
  return loadPromise;
}

/** Static PNG paths (optional baked assets in public/). */
export function resourceListIconAssetPath(kind: ResourceListIconKind): string {
  const base = ((import.meta as any).env?.BASE_URL ?? "/").replace(/\/?$/, "/");
  const file = kind === "coins" ? "resource-coins.png"
    : kind === "gems" ? "resource-gems.png"
      : "resource-power.png";
  return `${base}images/resources/${file}`;
}
