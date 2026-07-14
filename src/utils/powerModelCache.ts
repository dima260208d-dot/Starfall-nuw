import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { loadRollingStarBallModel } from "../game/soccerBallRenderer";
import { configureSquareBattleOrtho } from "../game/battleGroundView";
import { applyCanvasBitmapDrawPolicy, applyGLTFTexturePolicy } from "./texturePolicy";
import { registerWebGLCleanup } from "./devWebGLRecovery";

const SZ = 128; // sprite render resolution

let boxCanvas:  HTMLCanvasElement | null = null;
let jarCanvas:  HTMLCanvasElement | null = null;
let safeCanvas: HTMLCanvasElement | null = null;
let gemCanvas:  HTMLCanvasElement | null = null;
let starBallCanvas: HTMLCanvasElement | null = null;
let loadPromise: Promise<void> | null = null;

import { getHeavyAssetBaseUrl } from "../lib/assetBase";

function getBaseUrl(): string {
  return getHeavyAssetBaseUrl().replace(/\/$/, "");
}

let sharedRenderer: THREE.WebGLRenderer | null = null;
function getRenderer(): THREE.WebGLRenderer | null {
  if (sharedRenderer) return sharedRenderer;
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(SZ, SZ);
    r.setPixelRatio(1);
    r.setClearColor(0x000000, 0);
    sharedRenderer = r;
    return r;
  } catch { return null; }
}

/**
 * Освобождает оффскрин-WebGL контекст (после того как все спрайты уже запечены).
 * Кешированные canvas'ы остаются — они нужны для 2D-рендера. В 3D-сцене боя
 * эти спрайты не используются, поэтому контекст можно вернуть браузеру.
 */
export function disposePowerBakerRenderer(): void {
  if (sharedRenderer) {
    try { sharedRenderer.dispose(); } catch { /* ignore */ }
    sharedRenderer = null;
  }
}

registerWebGLCleanup(disposePowerBakerRenderer);

function buildScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const d1 = new THREE.DirectionalLight(0xfff5e0, 1.5);
  d1.position.set(5, 10, 5);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xd0c0ff, 0.7);
  d2.position.set(-4, 6, -2);
  scene.add(d2);
  return scene;
}

function fixMaterials(root: THREE.Object3D, renderer: THREE.WebGLRenderer | null): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mats = Array.isArray((obj as THREE.Mesh).material)
      ? (obj as THREE.Mesh).material as THREE.Material[]
      : [(obj as THREE.Mesh).material as THREE.Material];
    mats.forEach(m => { m.side = THREE.DoubleSide; m.depthWrite = true; m.needsUpdate = true; });
  });
  applyGLTFTexturePolicy(root, renderer);
}

type CamPreset = "iso" | "front" | "front-low";

function loadAndRender(
  renderer: THREE.WebGLRenderer,
  url: string,
  cam: CamPreset,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        try {
          const model = gltf.scene.clone(true);
          fixMaterials(model, getRenderer());

          const box3 = new THREE.Box3().setFromObject(model);
          const center = box3.getCenter(new THREE.Vector3());
          const size = box3.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = 7.0 / maxDim;
          model.position.set(-center.x * scale, -box3.min.y * scale, -center.z * scale);
          model.scale.setScalar(scale);

          const scene = buildScene();
          scene.add(model);

          let camera: THREE.Camera;
          if (cam === "iso") {
            const H = 6.5;
            const c = new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 200);
            configureSquareBattleOrtho(c, H);
            camera = c;
          } else if (cam === "front") {
            const H = 5.5;
            const c = new THREE.OrthographicCamera(-H, H, H, -H, 0.1, 200);
            c.position.set(1, 6, 6); c.lookAt(0, 1, 0);
            camera = c;
          } else {
            // front-low: good for safes/vaults — slightly elevated frontal view
            const H = 6.0;
            const c = new THREE.OrthographicCamera(-H, H, H, -H, 0.1, 200);
            c.position.set(0, 5, 9); c.lookAt(0, 2, 0);
            camera = c;
          }

          renderer.setSize(SZ, SZ);
          renderer.setClearColor(0x000000, 0);
          renderer.render(scene, camera);

          const out = document.createElement("canvas");
          out.width = SZ; out.height = SZ;
          const pctx = out.getContext("2d")!;
          applyCanvasBitmapDrawPolicy(pctx);
          pctx.drawImage(renderer.domElement, 0, 0);
          resolve(out);
        } catch (e) { reject(e); }
      },
      undefined,
      reject,
    );
  });
}

export function getPowerBoxCanvas(): HTMLCanvasElement | null { return boxCanvas; }
export function getPowerJarCanvas(): HTMLCanvasElement | null { return jarCanvas; }
export function getSafeCanvas():     HTMLCanvasElement | null { return safeCanvas; }
export function getGemCanvas():      HTMLCanvasElement | null { return gemCanvas; }
export function getStarBallCanvas(): HTMLCanvasElement | null { return starBallCanvas; }

// ── Сырые GLB-шаблоны для живой 3D-сцены боя ─────────────────────────────────
//
// Кешируют Object3D, чтобы боевая сцена и редактор карт могли инстанцировать
// модель напрямую (без 2D-bake) — нужно для полноценного 3D-представления
// power-боксов (POWER_BOX) и выпавших банок усиления (power_jar).
//
// ВАЖНО: шаблоны НЕ нормализуются по позиции/масштабу — это делает consumer
// после клонирования. Так разные потребители могут задавать собственные
// размеры/привязки (box в клетке, jar над землёй с tilt).

/**
 * Преобразует все материалы внутри объекта в светлые MeshLambertMaterial
 * с небольшим emissive-«подбоем», чтобы предмет не выглядел чёрным под
 * сценическим освещением. PBR-материалы из GLB заметно темнее под нашим
 * Ambient+Directional набором, поэтому понижаем их до Lambert и добавляем
 * чуть-чуть emissive (≈12% от собственного цвета).
 */
function brightenToLambert(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const out: THREE.Material[] = mats.map((mm) => {
      const any = mm as any;
      const baseColor: THREE.Color = any.color instanceof THREE.Color
        ? any.color.clone()
        : new THREE.Color(0xffffff);
      // emissive = baseColor * 0.12 → предмет не «чёрный» в тени.
      const emissive = baseColor.clone().multiplyScalar(0.12);
      // Если в исходнике уже был emissive — суммируем.
      if (any.emissive instanceof THREE.Color) {
        emissive.add(any.emissive);
      }
      const lamb = new THREE.MeshLambertMaterial({
        color: baseColor,
        map: any.map ?? null,
        transparent: !!any.transparent,
        opacity: any.opacity ?? 1,
        side: any.side ?? THREE.FrontSide,
        emissive,
        emissiveMap: any.emissiveMap ?? null,
        emissiveIntensity: any.emissiveIntensity ?? 1,
      });
      return lamb;
    });
    m.material = Array.isArray(m.material) ? out : out[0];
  });
}

// ── power_box.glb ────────────────────────────────────────────────────────────

let powerBoxTemplate: THREE.Object3D | null = null;
let powerBoxPromise: Promise<THREE.Object3D | null> | null = null;

export function getPowerBoxGLBTemplate(): THREE.Object3D | null {
  return powerBoxTemplate;
}

export function loadPowerBoxGLBTemplate(): Promise<THREE.Object3D | null> {
  if (powerBoxTemplate) return Promise.resolve(powerBoxTemplate);
  if (powerBoxPromise) return powerBoxPromise;
  powerBoxPromise = (async () => {
    try {
      const base = getBaseUrl();
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((res, rej) =>
        loader.load(`${base}/models/power_box.glb`, res, undefined, rej),
      );
      const root = gltf.scene as THREE.Object3D;
      brightenToLambert(root);
      powerBoxTemplate = root;
      return root;
    } catch (e) {
      console.warn("[powerModelCache] Failed to load power_box.glb", e);
      // Сбрасываем закешированный «провальный» промис — чтобы следующий вызов
      // (например, после респауна редактора/боя) мог ретрайнуть загрузку, а не
      // получить навечно резолвленный null. Без этого модели «пропадают» и
      // вернуть их можно только перезагрузкой страницы.
      powerBoxPromise = null;
      return null;
    }
  })();
  return powerBoxPromise;
}

// ── power_jar.glb ────────────────────────────────────────────────────────────

let powerJarTemplate: THREE.Object3D | null = null;
let powerJarPromise: Promise<THREE.Object3D | null> | null = null;

export function getPowerJarGLBTemplate(): THREE.Object3D | null {
  return powerJarTemplate;
}

export function loadPowerJarGLBTemplate(): Promise<THREE.Object3D | null> {
  if (powerJarTemplate) return Promise.resolve(powerJarTemplate);
  if (powerJarPromise) return powerJarPromise;
  powerJarPromise = (async () => {
    try {
      const base = getBaseUrl();
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((res, rej) =>
        loader.load(`${base}/models/power_jar.glb`, res, undefined, rej),
      );
      const root = gltf.scene as THREE.Object3D;
      brightenToLambert(root);
      powerJarTemplate = root;
      return root;
    } catch (e) {
      console.warn("[powerModelCache] Failed to load power_jar.glb", e);
      // См. комментарий в loadPowerBoxGLBTemplate — иначе шаблон банок
      // никогда не подгрузится повторно и «банки усиления» пропадают до F5.
      powerJarPromise = null;
      return null;
    }
  })();
  return powerJarPromise;
}

// ── safe.glb ─────────────────────────────────────────────────────────────────

let safeTemplate: THREE.Object3D | null = null;
let safePromise: Promise<THREE.Object3D | null> | null = null;

export function getSafeGLBTemplate(): THREE.Object3D | null {
  return safeTemplate;
}

export function loadSafeGLBTemplate(): Promise<THREE.Object3D | null> {
  if (safeTemplate) return Promise.resolve(safeTemplate);
  if (safePromise) return safePromise;
  safePromise = (async () => {
    try {
      const base = getBaseUrl();
      const loader = new GLTFLoader();
      const gltf = await new Promise<any>((res, rej) =>
        loader.load(`${base}/models/safe.glb`, res, undefined, rej),
      );
      const root = gltf.scene as THREE.Object3D;
      brightenToLambert(root);
      safeTemplate = root;
      return root;
    } catch (e) {
      console.warn("[powerModelCache] Failed to load safe.glb", e);
      safePromise = null;
      return null;
    }
  })();
  return safePromise;
}

export function loadPowerModels(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const base = getBaseUrl();
    // Запускаем загрузку сырых GLB-шаблонов в фоне — нужны боевой 3D-сцене
    // (power_box → крата, power_jar → выпавшая банка усиления). Не ждём:
    // 2D-bake внизу всё равно идёт по своему пути для совместимости.
    void loadPowerBoxGLBTemplate();
    void loadPowerJarGLBTemplate();
    void loadSafeGLBTemplate();

    const renderer = getRenderer();
    if (!renderer) return; // no WebGL — callers fall back to Canvas 2D

    try { boxCanvas  = await loadAndRender(renderer, `${base}/models/power_box.glb`, "iso"); }
    catch { /* leave null → Canvas fallback */ }

    try { jarCanvas  = await loadAndRender(renderer, `${base}/models/power_jar.glb`, "front"); }
    catch { /* leave null → Canvas fallback */ }

    try { safeCanvas = await loadAndRender(renderer, `${base}/models/safe.glb`, "front-low"); }
    catch { /* leave null → Canvas fallback */ }

    try { gemCanvas  = await loadAndRender(renderer, `${base}/models/gem.glb`, "front"); }
    catch { /* leave null → Canvas fallback */ }

    try { starBallCanvas = await loadAndRender(renderer, `${base}/models/star_ball.glb`, "front"); }
    catch { /* leave null → Canvas fallback */ }

    try { await loadRollingStarBallModel(base); }
    catch { /* in-game rolling fallback */ }
  })();
  return loadPromise;
}
