import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { TileType } from "../game/TileMap";
import { BATTLE_GROUND_LOOK_Y, configureTileAtlasBattleOrtho } from "../game/battleGroundView";
import { registerWebGLCleanup } from "./devWebGLRecovery";
import { getHeavyAssetBaseUrl } from "../lib/assetBase";
import { loadGLTFFromUrl } from "./glbFetchCache";

// ── Canvas dimensions ─────────────────────────────────────────────────────────
const TILE_PX = 256;

// ── Camera frustum ────────────────────────────────────────────────────────────
// Non-square frustum: wider in Y to accommodate isometric projection without
// clipping model tops. Ratio ≈ 1.45 matches the isometric height stretch of a cube.
const HALF_X = 4.5;
const HALF_Y = 6.5;

export const PYRAMID_TILE = 12;

/**
 * Файл .glb для каждого тайла. WATER собирается процедурно (см. `buildProceduralWaterTemplate`),
 * поэтому в этой таблице его нет — никаких сетевых запросов на water.glb.
 */
const TILE_MODEL: Partial<Record<number, string>> = {
  [TileType.WALL]:       "brick_wall.glb",
  // MOUNTAIN = каменный блок (используется как «бордюр» вокруг карты).
  [TileType.MOUNTAIN]:   "stone_block.glb",
  [TileType.BUSH]:       "bush.glb",
  [TileType.DECORATION]: "bones.glb",
  [TileType.FENCE]:      "fence.glb",
  [TileType.HEAL]:       "barrel.glb",
  [TileType.CACTUS]:     "cactus.glb",
  [TileType.TREE]:       "tree.glb",
  [TileType.WOOD]:       "wood_block.glb",
  [TileType.SAND_WALL]:  "boulder.glb",
  [TileType.FLOWERBED]:  "flowerbed.glb",
  // PYRAMID = гора (раньше там лежала pyramid.glb).
  [PYRAMID_TILE]:        "mountain.glb",
};

const TILE_FALLBACK_COLOR: Partial<Record<number, string>> = {
  [TileType.WALL]:       "#8B6060",
  [TileType.MOUNTAIN]:   "#607060",
  [TileType.BUSH]:       "#4CAF50",
  [TileType.WATER]:      "#1565C0",
  [TileType.DECORATION]: "#E0E0E0",
  [TileType.FENCE]:      "#C8A45A",
  [TileType.HEAL]:       "#C2185B",
  [TileType.CACTUS]:     "#558B2F",
  [TileType.TREE]:       "#33691E",
  [TileType.WOOD]:       "#8D6E63",
  [TileType.FLOWERBED]:  "#689F38",
  [TileType.SAND_WALL]:  "#78909C",
  [PYRAMID_TILE]:        "#FDD835",
};

// Tile types that are rendered tall in-game.
export const TALL_TILE_TYPES = new Set<number>([
  TileType.WALL,
  TileType.MOUNTAIN,
  TileType.DECORATION,
  TileType.FENCE,
  TileType.WOOD,
  TileType.SAND_WALL,
  TileType.CACTUS,
  TileType.TREE,
  PYRAMID_TILE,
]);

const cache = new Map<number, HTMLCanvasElement>();
/** Сырые GLB-шаблоны (THREE.Group) для использования в живой 3D-сцене боя. */
const glbTemplates = new Map<number, THREE.Object3D>();
let loadPromise: Promise<void> | null = null;
let glbTemplatesPromise: Promise<void> | null = null;
let atlasBaked = false;
let atlasBakeScheduled = false;

export interface LoadTileModelsOptions {
  /** Только GLB с CDN — без медленного 2D-запекания (экран загрузки / бой). */
  glbOnly?: boolean;
}

/** Получить сырой шаблон GLB тайла, если он уже загружен (для `battle3DWorld`). */
export function getTileGLBTemplate(type: number): THREE.Object3D | null {
  return glbTemplates.get(type) ?? null;
}

/** Список типов тайлов, для которых есть GLB-модель. */
export function getKnownTileTypesWithGLB(): number[] {
  return Array.from(glbTemplates.keys());
}

function makeFallback(color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TILE_PX; c.height = TILE_PX;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, TILE_PX - 4, TILE_PX - 4);
  return c;
}

let sharedRenderer: THREE.WebGLRenderer | null = null;
function getOrCreateRenderer(): THREE.WebGLRenderer | null {
  if (sharedRenderer) return sharedRenderer;
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(TILE_PX, TILE_PX);
    r.setPixelRatio(1);
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = false;
    sharedRenderer = r;
    return r;
  } catch {
    return null;
  }
}

function buildScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.8));
  const dir1 = new THREE.DirectionalLight(0xfff5e0, 1.2);
  dir1.position.set(4, 10, 4);
  scene.add(dir1);
  const dir2 = new THREE.DirectionalLight(0xd0e8ff, 0.55);
  dir2.position.set(-4, 6, -2);
  scene.add(dir2);
  return scene;
}

/**
 * Освобождает оффскрин-WebGL контекст, но СОХРАНЯЕТ кешированные canvas'ы атласа
 * и сырые GLB-шаблоны. Можно вызывать сразу после активации 3D-сцены боя —
 * атлас в этом режиме не используется, а контексты WebGL у браузера ограничены
 * (обычно 8–16 одновременно).
 */
export function disposeTileBakerRenderer(): void {
  if (sharedRenderer) {
    try { sharedRenderer.dispose(); } catch { /* ignore */ }
    sharedRenderer = null;
  }
}

export function invalidateTileModelGlCaches(): void {
  // Сбрасываем только запечённый 2D-атлас. Сырые GLB-шаблоны живут отдельно
  // и не зависят от угла камеры (используются в живой 3D-сцене боя).
  cache.clear();
  loadPromise = null;
  if (sharedRenderer) {
    try {
      sharedRenderer.dispose();
    } catch {
      /* ignore */
    }
    sharedRenderer = null;
  }
}

registerWebGLCleanup(invalidateTileModelGlCaches);

/** Полная очистка (вкл. сырые GLB) — для тестов / unmount всего приложения. */
export function disposeTileGLBTemplates(): void {
  glbTemplates.clear();
}

/**
 * Процедурная вода: горизонтальная тонкая «плитка» с лёгкой синей подсветкой.
 * Параметры подобраны так, чтобы `buildInstancedTilesForType` (battle3DWorld)
 * вписал её в ячейку с теми же правилами что и обычные GLB-тайлы:
 *   - размеры 1 × 0.05 × 1 → maxXZ = 1, maxY = 0.05 → scale по XZ доминирует;
 *   - rot = identity в `tileFitParams(WATER)`, чтобы плитка осталась лежать.
 *
 * Никаких HTTP-загрузок и текстур — ноль трафика, ноль расходов на распаковку
 * и почти ноль вершин (8 вертексов BoxGeometry). Поэтому WATER теперь
 * максимально дешёвая клетка из всех.
 */
/**
 * Шаблон тела воды — простой плоский синий квадрат на ВСЮ клетку.
 *
 * НИКАКИХ rim/закруглений в самом тайле: это нужно, чтобы СОСЕДНИЕ воды
 * сливались в монолит без внутренних швов и рамок. Если у воды есть «свободная»
 * сторона (соседняя клетка — не вода), обводку и скруглённый угол отрисует
 * отдельный проход `buildWaterRim*` в `battle3DWorld.ts` / `mapEditor3D.ts`.
 *
 * vFactor 0.4 у этого типа в `tileFitParams` обеспечивает «тонкость» воды —
 * фактически высоты у плоской геометрии нет, но bbox остаётся корректным.
 */
function buildProceduralFluidTemplate(
  bodyColor: number,
  emissive: number,
  emissiveIntensity: number,
): THREE.Object3D {
  const root = new THREE.Group();
  const bodyGeom = new THREE.PlaneGeometry(1, 1);
  bodyGeom.rotateX(-Math.PI / 2);
  const bodyMat = new THREE.MeshLambertMaterial({
    color: bodyColor,
    emissive,
    emissiveIntensity,
  });
  const body = new THREE.Mesh(bodyGeom, bodyMat);
  body.position.y = 0.012;
  root.add(body);
  return root;
}

function buildProceduralWaterTemplate(): THREE.Object3D {
  return buildProceduralFluidTemplate(0x1976d2, 0x0a3550, 0.25);
}

function buildCamera(lookAtY: number): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 200);
  configureTileAtlasBattleOrtho(cam, HALF_X, HALF_Y);
  cam.lookAt(0, lookAtY, 0);
  cam.updateProjectionMatrix();
  return cam;
}

/**
 * Понижаем материалы до Phong — легче PBR, те же текстуры, теневые грани по normal map.
 */
function downgradeMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const replaced = list.map((m) => downgradeOne(m));
    mesh.material = Array.isArray(mesh.material) ? replaced : replaced[0];
  });
}

/**
 * Phong (normal/ao maps сохраняются) — объёмные теневые грани на GLB-тайлах.
 */
function downgradeOne(src: THREE.Material): THREE.Material {
  const t = (src as any).type ?? "";
  if (t === "MeshPhongMaterial") {
    tunePhongForTiles(src as THREE.MeshPhongMaterial);
    return src;
  }
  if (t === "MeshLambertMaterial" || t === "MeshBasicMaterial") {
    return upgradeToPhong(src);
  }

  return upgradeToPhong(src);
}

function tunePhongForTiles(m: THREE.MeshPhongMaterial): void {
  if (!m.specular) m.specular = new THREE.Color(0x181818);
  if (m.shininess == null || m.shininess < 4) m.shininess = 6;
  if (m.normalScale) m.normalScale.multiplyScalar(0.72);
  else m.normalScale = new THREE.Vector2(0.72, 0.72);
  downsampleTex(m.map);
  downsampleTex(m.normalMap);
  downsampleTex(m.bumpMap);
  downsampleTex(m.alphaMap);
  downsampleTex(m.aoMap);
  downsampleTex(m.emissiveMap);
  m.needsUpdate = true;
}

function upgradeToPhong(src: THREE.Material): THREE.MeshPhongMaterial {
  const anyM = src as any;
  const phong = new THREE.MeshPhongMaterial({
    color: anyM.color ?? new THREE.Color(0xffffff),
    map: anyM.map ?? null,
    normalMap: anyM.normalMap ?? null,
    normalScale: anyM.normalScale?.clone?.() ?? new THREE.Vector2(1, 1),
    bumpMap: anyM.bumpMap ?? null,
    bumpScale: anyM.bumpScale ?? 1,
    alphaMap: anyM.alphaMap ?? null,
    aoMap: anyM.aoMap ?? null,
    aoMapIntensity: anyM.aoMapIntensity ?? 1,
    transparent: !!anyM.transparent,
    opacity: anyM.opacity ?? 1,
    alphaTest: anyM.alphaTest ?? 0,
    side: anyM.side ?? THREE.FrontSide,
    depthWrite: anyM.depthWrite ?? true,
    depthTest: anyM.depthTest ?? true,
    emissive: anyM.emissive?.clone?.() ?? new THREE.Color(0x000000),
    emissiveMap: anyM.emissiveMap ?? null,
    emissiveIntensity: anyM.emissiveIntensity ?? 1,
    specular: new THREE.Color(0x181818),
    shininess: 6,
  });
  if (phong.normalScale) phong.normalScale.multiplyScalar(0.72);
  phong.needsUpdate = true;
  downsampleTex(phong.map);
  downsampleTex(phong.normalMap);
  downsampleTex(phong.bumpMap);
  downsampleTex(phong.alphaMap);
  downsampleTex(phong.aoMap);
  downsampleTex(phong.emissiveMap);
  try { src.dispose(); } catch { /* ignore */ }
  return phong;
}

/** Максимальный размер стороны текстуры тайла после ресемпла. */
const TILE_TEXTURE_MAX_PX = 96;

function downsampleTex(tex: THREE.Texture | null | undefined): void {
  if (!tex) return;
  const img = tex.image as (HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined);
  if (!img) return;
  const w = (img as any).width as number | undefined;
  const h = (img as any).height as number | undefined;
  if (!w || !h) return;
  if (w <= TILE_TEXTURE_MAX_PX && h <= TILE_TEXTURE_MAX_PX) {
    // Уже маленькая — только подкрутим фильтры.
    tex.anisotropy = 1;
    tex.minFilter = THREE.LinearMipmapNearestFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return;
  }
  const scale = TILE_TEXTURE_MAX_PX / Math.max(w, h);
  const tw = Math.max(8, Math.round(w * scale));
  const th = Math.max(8, Math.round(h * scale));
  try {
    const c = document.createElement("canvas");
    c.width = tw;
    c.height = th;
    const cx = c.getContext("2d");
    if (!cx) return;
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = "low";
    cx.drawImage(img as CanvasImageSource, 0, 0, tw, th);
    tex.image = c;
    tex.anisotropy = 1;
    tex.minFilter = THREE.LinearMipmapNearestFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
  } catch {
    // Иногда исходник CORS-tainted или ImageBitmap не рисуется — не критично.
  }
}

function fixMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m: THREE.Material) => {
      m.side = THREE.FrontSide;
      m.depthWrite = true;
      m.needsUpdate = true;
    });
  });
}

export function getTileCanvas(type: number): HTMLCanvasElement | null {
  return cache.get(type) ?? null;
}

export function loadAllTileModels(
  onGlbLoaded?: () => void,
  opts: LoadTileModelsOptions = {},
): Promise<void> {
  if (loadPromise && !opts.glbOnly) return loadPromise;
  if (opts.glbOnly && glbTemplatesPromise && glbTemplates.size > 0) {
    return glbTemplatesPromise;
  }
  const run = (async () => {
    try {
      await ensureTileGLBTemplatesLoaded(onGlbLoaded);
      if (opts.glbOnly || atlasBaked) return;
      await bakeTile2DAtlases();
      atlasBaked = true;
    } catch (err) {
      console.warn("[tileModelCache] loadAllTileModels failed:", err);
      loadPromise = null;
      glbTemplatesPromise = null;
      throw err;
    }
  })();
  if (opts.glbOnly) {
    glbTemplatesPromise = run;
    return run;
  }
  loadPromise = run;
  return run;
}

/** Фоновое 2D-запекание для редактора карт — не блокирует вход в меню/бой. */
export function scheduleTileAtlasBake(): void {
  if (atlasBaked || atlasBakeScheduled) return;
  atlasBakeScheduled = true;
  const idle = typeof requestIdleCallback === "function"
    ? requestIdleCallback
    : (cb: IdleRequestCallback) => window.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline), 300);
  idle(() => {
    void loadAllTileModels(undefined, { glbOnly: false }).catch(() => {});
  });
}

export function areTileGLBTemplatesReady(): boolean {
  if (!glbTemplates.has(TileType.WATER)) return false;
  const core = [TileType.WALL, TileType.BUSH, TileType.MOUNTAIN];
  const coreLoaded = core.filter((t) => glbTemplates.has(t)).length;
  return coreLoaded >= 2 || glbTemplates.size >= 4;
}

function buildFallbackTileTemplate(type: number): THREE.Group {
  const color = TILE_FALLBACK_COLOR[type] ?? "#888888";
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.92, 0.92),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.y = 0.46;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

function ensureFallbackTileTemplates(): void {
  for (const typeStr of Object.keys(TILE_MODEL)) {
    const type = Number(typeStr);
    if (!glbTemplates.has(type)) {
      glbTemplates.set(type, buildFallbackTileTemplate(type));
    }
  }
  if (!glbTemplates.has(TileType.WATER)) {
    try {
      glbTemplates.set(TileType.WATER, buildProceduralWaterTemplate());
    } catch {
      glbTemplates.set(TileType.WATER, buildFallbackTileTemplate(TileType.WATER));
    }
  }
}

function ensureTileGLBTemplatesLoaded(onGlbLoaded?: () => void): Promise<void> {
  const expected = Object.keys(TILE_MODEL).length + 1;
  if (glbTemplates.size >= expected) return Promise.resolve();
  if (glbTemplatesPromise) return glbTemplatesPromise;

  glbTemplatesPromise = (async () => {
    const baseUrl: string = getHeavyAssetBaseUrl();
    const base = baseUrl.replace(/\/$/, "");
    const entries = Object.entries(TILE_MODEL) as [string, string][];

    const fetched = await Promise.allSettled(
      entries.map(async ([typeStr, filename]) => {
        const type = Number(typeStr);
        const url = `${base}/models/${filename}`;
        const gltf = await loadGLTFFromUrl(url);
        onGlbLoaded?.();
        return { type, gltf };
      }),
    );

    for (let i = 0; i < fetched.length; i++) {
      const result = fetched[i];
      const type = Number(entries[i][0]);
      if (result.status === "rejected") continue;
      try {
        const { gltf } = result.value;
        const rawTemplate = gltf.scene.clone(true);
        downgradeMaterials(rawTemplate);
        fixMaterials(rawTemplate);
        glbTemplates.set(type, rawTemplate);
      } catch { /* skip broken tile */ }
    }

    try {
      const waterTemplate = buildProceduralWaterTemplate();
      glbTemplates.set(TileType.WATER, waterTemplate);
    } catch { /* ignore */ }

    ensureFallbackTileTemplates();
  })();

  glbTemplatesPromise.catch(() => { glbTemplatesPromise = null; });
  return glbTemplatesPromise;
}

async function bakeTile2DAtlases(): Promise<void> {
  const entries = Object.entries(TILE_MODEL) as [string, string][];

  await ensureTileGLBTemplatesLoaded();

  const renderer = getOrCreateRenderer();
  if (!renderer) {
    for (const [typeStr] of entries) {
      const type = Number(typeStr);
      if (!cache.has(type)) {
        cache.set(type, makeFallback(TILE_FALLBACK_COLOR[type] ?? "#888888"));
      }
    }
    if (!cache.has(TileType.WATER)) {
      cache.set(TileType.WATER, makeFallback(TILE_FALLBACK_COLOR[TileType.WATER] ?? "#1565C0"));
    }
    return;
  }

  for (const [typeStr] of entries) {
    const type = Number(typeStr);
    const fallback = TILE_FALLBACK_COLOR[type] ?? "#888888";
    const rawTemplate = glbTemplates.get(type);
    if (!rawTemplate) {
      cache.set(type, makeFallback(fallback));
      continue;
    }
    if (cache.has(type)) continue;
    try {
      const model = rawTemplate.clone(true);
      if (type === TileType.WATER) model.rotation.x = -Math.PI / 2;

      let lookAtY = BATTLE_GROUND_LOOK_Y;

      if (type === TileType.FENCE) {
        const boxFlat = new THREE.Box3().setFromObject(model);
        const sizeFlat = boxFlat.getSize(new THREE.Vector3());
        const maxXZ0 = Math.max(sizeFlat.x, sizeFlat.z) || 1;
        const maxY0 = sizeFlat.y || 1;
        const scaleByXZ0 = (HALF_X * 2 * 0.90) / maxXZ0;
        const scaleByY0 = (HALF_Y * 2 * 0.90) / maxY0;
        const scale = Math.min(scaleByXZ0, scaleByY0 * 2.0);
        model.scale.setScalar(scale);
        model.rotation.set(Math.PI / 2, 0, 0);
        const boxStand = new THREE.Box3().setFromObject(model);
        const cen = boxStand.getCenter(new THREE.Vector3());
        model.position.set(-cen.x, -boxStand.min.y, -cen.z);
      } else {
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxXZ = Math.max(size.x, size.z) || 1;
        const maxY = size.y || 1;
        const scaleByXZ = (HALF_X * 2 * 0.90) / maxXZ;
        const scaleByY = (HALF_Y * 2 * 0.90) / maxY;
        let scale: number;

        if (type === TileType.CACTUS) {
          scale = Math.min(scaleByXZ, scaleByY * 0.80);
          lookAtY = (maxY * scale) * 0.45;
        } else if (type === TileType.TREE) {
          scale = Math.min(scaleByXZ, scaleByY * 0.95);
          lookAtY = (maxY * scale) * 0.48;
        } else if (type === TileType.HEAL) {
          scale = Math.min(scaleByXZ * 0.85, scaleByY * 0.90);
        } else if (type === TileType.WOOD) {
          scale = Math.min(scaleByXZ, scaleByY * 2.0);
        } else if (type === TileType.BUSH) {
          scale = Math.min(scaleByXZ, scaleByY);
        } else if (type === TileType.FLOWERBED) {
          scale = Math.min(scaleByXZ * 1.12, scaleByY * 0.88);
        } else {
          scale = Math.min(scaleByXZ, scaleByY);
        }

        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        model.scale.setScalar(scale);
      }

      renderer.setSize(TILE_PX, TILE_PX);
      renderer.setClearColor(0x000000, 0);
      const scene = buildScene();
      scene.add(model);
      const camera = buildCamera(lookAtY);
      renderer.render(scene, camera);

      const out = document.createElement("canvas");
      out.width = TILE_PX;
      out.height = TILE_PX;
      out.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
      cache.set(type, out);
    } catch {
      cache.set(type, makeFallback(fallback));
    }
  }

  try {
    const waterTemplate = glbTemplates.get(TileType.WATER) ?? buildProceduralWaterTemplate();
    if (!cache.has(TileType.WATER)) {
      const waterPreview = waterTemplate.clone(true) as THREE.Object3D;
      const sX = HALF_X * 2 * 0.92;
      const sZ = HALF_X * 2 * 0.92;
      waterPreview.scale.set(sX, 1, sZ);
      waterPreview.position.set(0, 0.025, 0);
      renderer.setSize(TILE_PX, TILE_PX);
      renderer.setClearColor(0x000000, 0);
      const scene = buildScene();
      scene.add(waterPreview);
      const camera = buildCamera(BATTLE_GROUND_LOOK_Y);
      renderer.render(scene, camera);
      const out = document.createElement("canvas");
      out.width = TILE_PX;
      out.height = TILE_PX;
      out.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
      cache.set(TileType.WATER, out);
    }
  } catch {
    cache.set(TileType.WATER, makeFallback(TILE_FALLBACK_COLOR[TileType.WATER] ?? "#1565C0"));
  }

  renderer.setSize(TILE_PX, TILE_PX);
}
