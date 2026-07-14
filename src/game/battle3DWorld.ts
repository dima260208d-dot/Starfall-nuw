/**
 * Living 3D battle scene.
 *
 * Behind the main 2D battle canvas sits a separate WebGL canvas that hosts a real
 * THREE.Scene: ground plane, tile meshes as InstancedMesh (one draw call per tile
 * type), animated GLB brawlers, ambient + directional light with shadow casting.
 * The 2D canvas above stays transparent for HUD, projectiles, effects.
 *
 * When `isBattle3DActive()` is true, the existing 2D map / tile / brawler-body
 * rendering paths early-return so the 3D scene is what the player actually sees
 * for the world. HUD layer (bars, names) keeps drawing on the 2D canvas above.
 *
 * Camera: orthographic, tilted `CAM_TILT_DEG` from vertical. With `lookAt` on the
 * ground (y=0) and `frustum_height = cos(θ) × CAM_H`, ground points project to
 * the same canvas pixels as the 2D mapping `(x - camX, y - camY)` — HUD/projectile
 * alignment is preserved automatically without a projection helper.
 */

import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  TileType,
  createFallbackBattleTileGrid,
  getTile,
  tileAdjacentToGrass,
  BATTLE_MAP_RIM_CELLS,
  setTileCollisionFullCell,
  tileShouldShakeOnHit,
  type TileGrid,
} from "./TileMap";
import {
  buildMergedFluidMeshes,
  WATER_FLUID_STYLE,
} from "./mergedFluidTiles";
import {
  getTileGLBTemplate,
  loadAllTileModels,
  disposeTileBakerRenderer,
} from "../utils/tileModelCache";
import {
  CHAR_3D_IDS,
  getCharRenderer,
  preloadCharRenderers,
  findCharAnimClip,
  disposeCharBakerSharedRenderer,
  resetSkinnedBindPose,
  type CharAnimNames,
} from "./miyaTopDownRenderer";
import { tuneAttackClip } from "./attackClipTune";
import { fixCharacterSkinnedMeshes } from "../utils/gltfSkinnedMeshFix";
import {
  disposePowerBakerRenderer,
  getPowerBoxGLBTemplate,
  loadPowerBoxGLBTemplate,
  getPowerJarGLBTemplate,
  loadPowerJarGLBTemplate,
} from "../utils/powerModelCache";
import type { Crate } from "./MapRenderer";
import { getCrateShakeOffset, getTileShakeOffset } from "../utils/effects";
import { getSilvenLifeTrees } from "../utils/silvenMechanics";

/**
 * Минимальный интерфейс «выпавшей банки усиления». Передаётся снаружи
 * (ClashShowdown / ClashMega) — нам важны только мировые координаты XY.
 */
export interface PowerJarDrop {
  /** Stable id from game mode (`jarId` in ClashShowdown / ClashMega). */
  id: number;
  x: number;
  y: number;
  radius: number;
  spawnX?: number;
  spawnY?: number;
}

function resolvePowerJarId(d: PowerJarDrop & { jarId?: number }): number | null {
  const id = d.jarId ?? d.id;
  return typeof id === "number" && Number.isFinite(id) ? id : null;
}
import {
  createBinbunGrassField,
  updateBinbunGrassField,
  disposeBinbunGrassField,
  loadBinbunGrassAssets,
  setBinbunGrassStompers,
  BINBUN_GRASS_FALLBACK_COLOR,
  BINBUN_GROUND_Y,
  type BinbunGrassField,
} from "./binbunGrass3D";
import type { Brawler } from "../entities/Brawler";
import {
  initBattle3DPets,
  syncBattle3DPets,
  resetBattle3DPetMotionState,
  disposeBattle3DPets,
} from "./battle3DPets";
import {
  initBattle3DVerdelettaShadows,
  syncBattle3DVerdelettaShadows,
  resetBattle3DVerdelettaShadowMotionState,
  disposeBattle3DVerdelettaShadows,
} from "./battle3DVerdelettaShadows";
import {
  initBattle3DDevMonsters,
  syncBattle3DDevMonsters,
  resetBattle3DDevMonsterMotionState,
  disposeBattle3DDevMonsters,
} from "./battle3DDevMonsters";
import {
  syncBattle3DSafes,
  disposeBattle3DSafes,
  type Battle3DSafe,
} from "./battle3DSafes";
import { preloadVerdelettaShadowModel } from "./verdelettaShadow3DRenderer";
import { getVerdelettaShadows } from "../utils/verdelettaShadows";
import { getDevBattleMonsters } from "../utils/devBattleMonsters";
import { loadSafeGLBTemplate } from "../utils/powerModelCache";
import { isZephyrinInGale } from "../utils/zephyrinMechanics";
import { registerWebGLCleanup } from "../utils/devWebGLRecovery";
import { getHeavyAssetBaseUrl } from "../lib/assetBase";
import { isBattleAssetsReady } from "../utils/battleAssetPreloader";

/** Bump when battle anim logic changes — stale meshes are recreated automatically. */
const BATTLE_ANIM_LOGIC_VERSION = 22;
/** Min ms between idle↔run switches — stops threshold flicker from spamming stopAllAction. */
const BATTLE_ANIM_MIN_HOLD_MS = 90;


// ── Module-level state ───────────────────────────────────────────────────────

let active = false;
/** Invalidates in-flight `initBattle3DForBattle` when a new battle starts or 3D is disposed. */
let battle3DInitGen = 0;
/** True once ground + tile meshes were built for the current battle session. */
let battle3DSceneReady = false;
let battle3DTilesLoading = false;
let canvasEl: HTMLCanvasElement | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;

let grassField: BinbunGrassField | null = null;
let grassBuildGen = 0;

/** Все InstancedMesh'ы, созданные в текущем бою — один на (tile-type × geometry-in-glb). */
const tileInstancedMeshes: THREE.InstancedMesh[] = [];

interface TileInstRef {
  mesh: THREE.InstancedMesh;
  idx: number;
  localMatrix: THREE.Matrix4;
  tx: number;
  ty: number;
  yRot: number;
}
const tileInstRefs: TileInstRef[] = [];
const tileShakeDummy = new THREE.Object3D();
const tileShakeTmp = new THREE.Matrix4();

/**
 * Специальное хранилище для кустов: в отличие от других тайлов, кусты должны
 * динамически переключаться между «непрозрачным» и «полупрозрачным» состояниями
 * (когда рядом стоит свой боец в кустах — соседние кусты «просвечиваются»).
 *
 * Для этого на каждый mesh-узел шаблона `bush.glb` создаём ДВА InstancedMesh:
 *   • opaque — обычный непрозрачный материал;
 *   • translucent — клон материала с `transparent=true, opacity≈0.4`.
 *
 * Каждый кадр пробегаем по `cells`, определяем «горящие» (подсвеченные) клетки
 * и распределяем матрицы между двумя массивами через `setMatrixAt` + меняем
 * `count`. Это даёт стабильные ~2 draw call'а на кусты и не плодит сотни
 * Mesh'ей при больших картах.
 */
interface BushInstanceSet {
  cells: { tx: number; ty: number }[];
  opaqueMeshes: THREE.InstancedMesh[];
  translucentMeshes: THREE.InstancedMesh[];
  /** Предвычисленная (placement × node.matrix) матрица для каждой клетки и каждого mesh-узла. */
  perNodeCellMatrices: THREE.Matrix4[][];
}
let bushInstanceSet: BushInstanceSet | null = null;

interface BrawlerMeshEntry {
  rootId: string;
  charId: string;
  pivot: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  animNames: CharAnimNames;
  /** Cached clipAction per state — same clip always maps to the same action on a mixer. */
  actions: Partial<Record<"idle" | "run" | "attack" | "super", THREE.AnimationAction>>;
  currentAnim: "idle" | "run" | "attack" | "super";
  /** Resolved clip names — sanity check that run/attack aren't swapped. */
  clipNames: { idle?: string; run?: string; attack?: string; super?: string };
  animLogicVersion: number;
  shadow: THREE.Mesh | null;
  /** Цветной круг-индикатор команды под бойцом (зелёный/синий/красный/нейтральный). */
  teamRing: THREE.Mesh | null;
  teamRingMat: THREE.MeshBasicMaterial | null;
  lastX: number;
  lastY: number;
  /** Smoothed world position for 3D — decoupled from logic x/y micro-corrections. */
  renderX: number;
  renderY: number;
  movingSmoothed: number;
  runLatch: boolean;
  /** Последняя применённая к мешу непрозрачность (избегаем лишних обходов traverse). */
  lastOpacity: number;
  lastAnimChangeMs: number;
  /** Procedural tornado mesh while Zephyrin super (gale) is active. */
  galeTornado: THREE.Group | null;
  galeSpinAngle: number;
}
const brawlerMeshes = new Map<string, BrawlerMeshEntry>();

/**
 * Активные 3D-меши для боксов усиления (power_box).
 *
 * Ключ — сам объект Crate (стабильный, создаётся один раз на карту). Это
 * позволяет нам корректно удалять меши, когда крата исчезла из массива (или
 * пометилась destroyed=true), и переиспользовать уже созданную модель,
 * пока крата жива.
 */
/**
 * Per-крата состояние в 3D: содержит и саму группу с моделью power_box,
 * и Sprite HP-бара над ней. Спрайт обновляется каждый кадр (новая текстура
 * только когда меняется hp; иначе только позиция / прозрачность).
 */
interface CrateEntry {
  group: THREE.Group;
  hpSprite: THREE.Sprite;
  hpCanvas: HTMLCanvasElement;
  hpTexture: THREE.CanvasTexture;
  lastHp: number;
  yHeight: number; // высота модели в мире, для позиции HP-бара
}
const crateMeshes = new Map<Crate, CrateEntry>();

interface SilvenTreeEntry {
  group: THREE.Group;
  healRing: THREE.Mesh;
  healFill: THREE.Mesh;
  hpSprite: THREE.Sprite;
  hpCanvas: HTMLCanvasElement;
  hpTexture: THREE.CanvasTexture;
  lastHp: number;
  lastHostile: boolean;
  yHeight: number;
}
const silvenTreeMeshes = new Map<string, SilvenTreeEntry>();
let crateTemplateRequested = false;

/**
 * Per-jar состояние: pivot вращается вокруг своей оси Y, наклон 15° берётся
 * через дочерний tiltGroup (rotation.x = 15°), внутри которого живёт сама
 * модель. Так Y-вращение происходит вокруг ВЕРТИКАЛИ мира (видно как нормальное
 * прокручивание этикетки на цилиндре), а tilt — это статичный «лёгкий завал».
 */
interface JarEntry {
  pivot: THREE.Group;
  glow: THREE.Group;
  landX: number;
  landZ: number;
  spawnX: number;
  spawnZ: number;
  animT: number;
  landed: boolean;
}

const JAR_DROP_DURATION = 0.55;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function createJarGroundGlow(radius: number): THREE.Group {
  const group = new THREE.Group();
  const rings: [number, number, number][] = [
    [1.35, 0.16, 0x7b1fa2],
    [0.82, 0.3, 0xe040fb],
  ];
  for (const [scale, opacity, color] of rings) {
    const geo = new THREE.CircleGeometry(radius * scale, 24);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    group.add(mesh);
  }
  return group;
}

function disposeJarGlow(glow: THREE.Group): void {
  glow.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  });
}
const jarMeshes = new Map<number, JarEntry>();
let jarTemplateRequested = false;
let jarFrameCounter = 0;

let currentTileGrid: TileGrid | null = null;
let currentMapW = 0;
let currentMapH = 0;
let currentCamW = 0;
let currentCamH = 0;
let currentCanvasCssW = 1200;
let currentCanvasCssH = 800;
/** Round-robin counter so the shadow map only refreshes every 2nd frame. */
let shadowFrameCounter = 0;
/** Effective ortho frustum after aspect fill (≥ base cam size). */
let effectiveViewW = 857;
let effectiveViewH = 571;
/** Out-of-grid tile padding — 0 so edge art does not bleed onto playable area. */
const TILE_EDGE_PAD = 0;
/**
 * Счётчик разрушенных тайлов, для которого был построен текущий InstancedMesh.
 * Если в `tickAndRenderBattle3D` обнаруживаем расхождение с `grid.destroyed` —
 * перестраиваем тайлы (костя/деко/прочие destructible исчезают из сцены).
 */
let lastDestroyRevision = 0;
let lastBushFriendlyKey = "";
/** Grid used during the latest `rebuildTilesFromGrid` — rim scale for border tiles. */
let lastRebuildGrid: TileGrid | null = null;

const TALL_RIM_TYPES = new Set<number>([
  TileType.MOUNTAIN,
  TileType.WALL,
  TileType.SAND_WALL,
  TileType.WOOD,
  TileType.CACTUS,
  TileType.TREE,
  TileType.PYRAMID,
  TileType.FENCE,
  TileType.DECORATION,
]);

function rimGrassFacingScale(type: number, tx: number, ty: number): number {
  if (!lastRebuildGrid || !TALL_RIM_TYPES.has(type)) return 1;
  return tileAdjacentToGrass(lastRebuildGrid, tx, ty) ? 0.72 : 1;
}

/** Inner rim ring that faces grass — clip GLB overflow back outside playable bounds. */
function rimClipBucket(type: number, tx: number, ty: number, grid: TileGrid): string {
  if (!TALL_RIM_TYPES.has(type) || !tileAdjacentToGrass(grid, tx, ty)) return "none";
  const R = BATTLE_MAP_RIM_CELLS;
  const W = grid.width;
  const H = grid.height;
  const parts: string[] = [];
  if (tx === R - 1) parts.push("left");
  if (tx === W - R) parts.push("right");
  if (ty === R - 1) parts.push("top");
  if (ty === H - R) parts.push("bottom");
  return parts.length ? parts.join("|") : "none";
}

function playableClipPlanesForBucket(bucket: string, grid: TileGrid): THREE.Plane[] {
  const R = BATTLE_MAP_RIM_CELLS;
  const xMin = R * CELL;
  const xMax = (grid.width - R) * CELL;
  const zMin = R * CELL;
  const zMax = (grid.height - R) * CELL;
  const planes: THREE.Plane[] = [];
  if (bucket.includes("left")) planes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), xMin));
  if (bucket.includes("right")) planes.push(new THREE.Plane(new THREE.Vector3(1, 0, 0), -xMax));
  if (bucket.includes("top")) planes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), zMin));
  if (bucket.includes("bottom")) planes.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), -zMax));
  return planes;
}

function cloneMaterialWithClip(
  mat: THREE.Material | THREE.Material[],
  planes: THREE.Plane[],
): THREE.Material | THREE.Material[] {
  const apply = (m: THREE.Material) => {
    const c = m.clone();
    if (planes.length > 0) {
      c.clippingPlanes = planes.map((p) => p.clone());
      c.clipIntersection = false;
    }
    return c;
  };
  return Array.isArray(mat) ? mat.map(apply) : apply(mat);
}

/** Ensure tile materials participate in shadow pass (Phong/Lambert only). */
function ensureTileMaterialReceivesLight(mat: THREE.Material | THREE.Material[]): void {
  const list = Array.isArray(mat) ? mat : [mat];
  for (const m of list) {
    if (m instanceof THREE.MeshPhongMaterial || m instanceof THREE.MeshLambertMaterial) {
      m.flatShading = false;
    }
  }
}

function combinedRimClipPlanes(
  type: number,
  cells: { tx: number; ty: number }[],
  grid: TileGrid,
): THREE.Plane[] {
  const seen = new Set<string>();
  const planes: THREE.Plane[] = [];
  for (const { tx, ty } of cells) {
    const bucket = rimClipBucket(type, tx, ty, grid);
    if (bucket === "none") continue;
    for (const p of playableClipPlanesForBucket(bucket, grid)) {
      const key = `${p.normal.x},${p.normal.y},${p.normal.z},${p.constant}`;
      if (seen.has(key)) continue;
      seen.add(key);
      planes.push(p.clone());
    }
  }
  return planes;
}

/** Push inner-rim tall tiles away from playable grass so models don't hang over arena. */
function rimOutwardOffset(tx: number, ty: number, grid: TileGrid, type: number): { ox: number; oz: number } {
  if (!TALL_RIM_TYPES.has(type) || !tileAdjacentToGrass(grid, tx, ty)) return { ox: 0, oz: 0 };
  const R = BATTLE_MAP_RIM_CELLS;
  const W = grid.width;
  const H = grid.height;
  const push = CELL * 0.28;
  let ox = 0;
  let oz = 0;
  if (tx === R - 1) ox -= push;
  if (tx === W - R) ox += push;
  if (ty === R - 1) oz -= push;
  if (ty === H - R) oz += push;
  return { ox, oz };
}

function applyMapClipPlanes(): void {
  if (!renderer) return;
  renderer.localClippingEnabled = true;
}

let directional: THREE.DirectionalLight | null = null;
let ambient: THREE.AmbientLight | null = null;

const CELL = 50; // мировые пиксели на одну ячейку (соответствует TILE_CELL_SIZE)
/** Лёгкое перекрытие, чтобы между соседними тайлами не было видимых щелей. */
const TILE_FIT = 1.06;

/**
 * Угол наклона камеры от вертикали (Brawl-Stars-подобный косой top-down).
 * При `lookAt` на уровне земли (y=0) точки земли проецируются **точно** так же,
 * как 2D-маппинг `(x - camX, y - camY)`, если `frustum_height = cos(θ) × CAM_H`.
 * Это даёт реальный 3D-перспективный вид с сохранением выравнивания 2D HUD/снарядов.
 */
const CAM_TILT_DEG = 30;
const CAM_TILT_RAD = (CAM_TILT_DEG * Math.PI) / 180;
const CAM_TILT_COS = Math.cos(CAM_TILT_RAD);
const CAM_TILT_SIN = Math.sin(CAM_TILT_RAD);
/** Высота камеры над землёй (в пикселях мира). */
const CAM_HEIGHT = 1500;
/** Горизонтальный отступ камеры (за «спиной игрока», вдоль +Z = «юг» в игре). */
const CAM_BACK_OFFSET = CAM_HEIGHT * Math.tan(CAM_TILT_RAD);

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureRenderer(): boolean {
  if (renderer && scene && camera) return true;
  if (!canvasEl) return false;
  try {
    const r = new THREE.WebGLRenderer({
      canvas: canvasEl,
      antialias: false, // главная экономия на слабых GPU
      alpha: true,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    // PixelRatio=1 (никакого DPR-апскейла) — это самое жирное ускорение для слабых GPU.
    r.setPixelRatio(1);
    r.setSize(currentCanvasCssW, currentCanvasCssH, false);
    r.setClearColor(0x000000, 0);
    r.outputColorSpace = THREE.SRGBColorSpace;
  // Тени: PCF 512² — тайлы и бойцы кастуют, пол принимает.
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    // Manual shadow updates (throttled in the render loop). The shadow pass
    // re-renders every caster each frame; in a full battle (10 brawlers + pets +
    // crates) that doubles the draw cost and tanks FPS. Training only has a few
    // casters, which is why it stays smooth. Updating shadows every other frame
    // roughly halves that cost with no visible change (lights move slowly).
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    r.localClippingEnabled = true;
    renderer = r;
  } catch (err) {
    console.warn("[battle3D] WebGL renderer creation failed:", err);
    return false;
  }
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 6000);
  camera.up.set(0, 0, -1);
  camera.position.set(0, CAM_HEIGHT, CAM_BACK_OFFSET);
  camera.lookAt(0, 0, 0);

  // Многослойное освещение «как в Brawl Stars»:
  //   1) AmbientLight — нижний базовый свет, держим невысоким (0.55), иначе
  //      смывает контраст и тени становятся незаметными.
  //   2) HemisphereLight — мягкая разница «небо / земля» (тёплый верх,
  //      холодный отражённый низ), даёт реалистичный неравномерный фон.
  //   3) DirectionalLight — главное «солнце» с тенями (PCF, 1024×1024).
  ambient = new THREE.AmbientLight(0xffffff, 0.32);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xfff1d6, 0x6a4d2e, 0.38);
  hemi.position.set(0, 1, 0);
  scene.add(hemi);

  directional = new THREE.DirectionalLight(0xfff5dc, 1.65);
  directional.position.set(400, 900, -300);
  directional.castShadow = true;
  const s = directional.shadow;
  s.mapSize.set(512, 512);
  s.camera.left = -420;
  s.camera.right = 420;
  s.camera.top = 420;
  s.camera.bottom = -420;
  s.camera.near = 80;
  s.camera.far = 2600;
  s.bias = -0.00015;
  s.normalBias = 0.04;
  scene.add(directional);
  scene.add(directional.target);

  return true;
}

function rebuildGround(): void {
  if (!scene) return;
  const gen = ++grassBuildGen;
  if (grassField) {
    disposeBinbunGrassField(grassField);
    grassField = null;
  }

  const groundPad = TILE_EDGE_PAD * CELL;
  const mapW = currentMapW;
  const mapH = currentMapH;
  const base: string = getHeavyAssetBaseUrl();
  const tg = currentTileGrid;
  const mask = tg
    ? {
        cells: tg.cells,
        destroyed: tg.destroyed,
        width: tg.width,
        height: tg.height,
        cellSize: tg.cellSize,
        grassTileType: TileType.GRASS,
        originX: 0,
        originZ: 0,
      }
    : null;

  void createBinbunGrassField(mapW, mapH, groundPad, { baseUrl: base, mask, groundChunks: 10, mapW, mapH })
    .then((field) => {
      if (!scene || gen !== grassBuildGen) {
        disposeBinbunGrassField(field);
        return;
      }
      grassField = field;
      scene.add(field.root);
      applyMapClipPlanes();
    })
    .catch((err) => {
      console.warn("[battle3D] BinbunGrass field build failed:", err);
      if (!scene || gen !== grassBuildGen) return;
      const groundW = mapW + groundPad * 2;
      const groundH = mapH + groundPad * 2;
      const geom = new THREE.PlaneGeometry(groundW, groundH);
      geom.rotateX(-Math.PI / 2);
      const fallback = new THREE.Mesh(
        geom,
        new THREE.MeshLambertMaterial({ color: BINBUN_GRASS_FALLBACK_COLOR }),
      );
      fallback.position.set(mapW / 2, BINBUN_GROUND_Y, mapH / 2);
      fallback.receiveShadow = true;
      const root = new THREE.Group();
      root.add(fallback);
      scene.add(root);
      grassField = {
        root,
        groundMeshes: [fallback],
        grass: new THREE.InstancedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), 0),
        uniforms: {
          uBladeW: { value: 0 },
          uBladeH: { value: 0 },
          uAlphaCutStart: { value: 0 },
          uAlphaCutEnd: { value: 0 },
          uTime: { value: 0 },
          uWindDir: { value: new THREE.Vector2(1, 0) },
          uWindStrength: { value: 0 },
          uStompers: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, 0, 0)) },
        },
      };
      applyMapClipPlanes();
    });
}

function clearTileMeshes(): void {
  if (!scene) return;
  for (const inst of tileInstancedMeshes) {
    scene.remove(inst);
    // Геометрия/материал берутся из GLB-шаблона и переиспользуются — не диспозим.
  }
  tileInstancedMeshes.length = 0;
  tileInstRefs.length = 0;

  // Translucent-материалы кустов — это КЛОНЫ исходных, их нужно освобождать,
  // иначе при каждом rebuildTilesFromGrid (например, на разрушении деко) будем
  // утекать сотни Material'ов в GPU-кеш.
  if (bushInstanceSet) {
    for (const inst of bushInstanceSet.translucentMeshes) {
      const mat = inst.material;
      if (Array.isArray(mat)) for (const mm of mat) mm.dispose();
      else mat.dispose();
    }
    bushInstanceSet = null;
  }

  // Per-cell water меши (см. `buildWaterMeshes`) — собственная per-cell геометрия,
  // её нужно диспозить. Материал общий — оставляем.
  for (const m of waterMeshes) {
    scene.remove(m);
    m.geometry.dispose();
  }
  waterMeshes.length = 0;
}

/**
 * Меши, относящиеся к воде (тело + cyan-подложка). Хранятся отдельно от
 * `tileInstancedMeshes`, потому что для тела воды у каждой клетки СВОЯ
 * `ShapeGeometry` (с учётом соседей: где соседняя клетка — тоже вода, край
 * остаётся прямой и без обводки, а где не вода — есть скруглённый край).
 */
const waterMeshes: THREE.Mesh[] = [];

/**
 * Параметры подгонки тайла под клетку: вертикальный масштаб и (для воды) поворот.
 */
function tileFitParams(type: number): {
  rot: THREE.Euler;
  vFactor: number;
} {
  // Вода — процедурная плитка (см. `buildProceduralWaterTemplate`), она
  // создаётся уже в горизонтальной ориентации и тонкой по Y. Никаких
  // дополнительных поворотов не нужно. vFactor 0.4 — потолок толщины.
  if (type === TileType.WATER) return { rot: new THREE.Euler(0, 0, 0), vFactor: 0.4 };
  if (type === TileType.FENCE) return { rot: new THREE.Euler(Math.PI / 2, 0, 0), vFactor: 1.6 };
  if (type === TileType.WOOD) return { rot: new THREE.Euler(), vFactor: 1.6 };
  if (type === TileType.CACTUS) return { rot: new THREE.Euler(), vFactor: 1.8 };
  if (type === TileType.TREE) return { rot: new THREE.Euler(), vFactor: 2.25 };
  if (type === TileType.FLOWERBED) return { rot: new THREE.Euler(), vFactor: 0.55 };
  if (type === TileType.BUSH) return { rot: new THREE.Euler(), vFactor: 1.2 };
  if (type === TileType.MOUNTAIN) return { rot: new THREE.Euler(), vFactor: 1.0 };
  return { rot: new THREE.Euler(), vFactor: 1.2 };
}

/**
 * Для одного типа тайла:
 *   1. Готовим шаблон (поворот + масштаб «вписать в клетку»).
 *   2. Извлекаем все внутренние Mesh-узлы и их матрицы в системе шаблона.
 *   3. Для каждого внутреннего Mesh создаём `InstancedMesh(geom, mat, instances.length)`.
 *   4. Заполняем `setMatrixAt` для каждой ячейки этого типа.
 *
 * Это сводит число draw-call'ов к ~10 (по типу) вместо ~3000 (по клетке), и убирает
 * тысячи traverse/Box3-вычислений в RAF-цикле — главный источник лагов.
 */
function buildInstancedTilesForType(type: number, cells: { tx: number; ty: number; rot: number }[]): void {
  if (!scene) return;
  const template = getTileGLBTemplate(type);
  if (!template) return;
  const fit = tileFitParams(type);

  // Готовим «эталонный экземпляр» для типа — повёрнутый, отмасштабированный
  // и сцентрированный в (0, 0, 0) (база на y=0, центр XZ в нуле).
  const prep = template.clone(true);
  prep.rotation.copy(fit.rot);
  prep.updateMatrixWorld(true);

  const box0 = new THREE.Box3().setFromObject(prep);
  const size0 = box0.getSize(new THREE.Vector3());
  const maxXZ = Math.max(size0.x, size0.z) || 1;
  const maxY = size0.y || 1;
  const xzFit = type === TileType.MOUNTAIN ? 1.0 : TILE_FIT;
  const scaleByXZ = (CELL * xzFit) / maxXZ;
  const scaleByY = (CELL * fit.vFactor) / maxY;

  if (type === TileType.BUSH) {
    // КУСТ — особый случай: модель сама по себе «лепёшка» (маленький Y, большой
    // XZ), при равномерном scale она получается очень низкой и не закрывает
    // бойца, который в ней спрятался. Делаем НЕ-равномерный scale: XZ как у
    // обычного тайла, а Y растягиваем так, чтобы куст был ~0.9 от высоты
    // клетки (примерно как стена/каменный блок). Тогда визуально кусты
    // «стоят» как полноценный блок и реально закрывают спрятанных бойцов.
    //
    // BUSH_XZ_OVERFILL — отдельный коэффициент перехлёста именно для кустов.
    // Bounding-box у листвы заметно больше реально нарисованных листьев, поэтому
    // обычного TILE_FIT=1.06 не хватает, и между соседними кустами видны
    // ровные полоски «травы». 1.30 даёт листьям видимый перехлёст, и кусты
    // выглядят как одна сплошная заросль.
    const BUSH_XZ_OVERFILL = 1.30;
    const sXZ = (CELL * BUSH_XZ_OVERFILL) / maxXZ;
    const sY = (CELL * 0.9) / maxY;
    prep.scale.set(sXZ, sY, sXZ);
  } else if (type === TileType.FLOWERBED) {
    // Полисадник — GLB-клумба; соседние клетки перекрываются по XZ без зазоров.
    const FLOWERBED_XZ_OVERFILL = 1.28;
    const sXZ = (CELL * FLOWERBED_XZ_OVERFILL) / maxXZ;
    const sY = (CELL * fit.vFactor) / maxY;
    prep.scale.set(sXZ, sY, sXZ);
  } else if (type === TileType.WALL || type === TileType.SAND_WALL) {
    // СТЕНЫ — НЕ-равномерный scale по X и Z, чтобы блок полностью занимал
    // клетку при ЛЮБОМ повороте на 90°. Иначе модель «brick_wall.glb» / «stone_block.glb»
    // изначально длинная-тонкая (один ряд кирпичей: X≈1.0, Z≈0.3), и после
    // поворота короткая ось становится видимой — между двумя перпендикулярными
    // стенами образуется зазор. С независимым sX/sZ обе стороны = CELL × TILE_FIT,
    // и стены стыкуются на углах без щелей. Кирпич чуть «толще», но визуально
    // цельная стена важнее идеальных пропорций кладки.
    const sX = (CELL * TILE_FIT) / (size0.x || 1);
    const sZ = (CELL * TILE_FIT) / (size0.z || 1);
    const sY = (CELL * fit.vFactor) / maxY;
    prep.scale.set(sX, sY, sZ);
  } else {
    const s = Math.min(scaleByXZ, scaleByY);
    prep.scale.setScalar(s);
  }
  prep.updateMatrixWorld(true);

  const box1 = new THREE.Box3().setFromObject(prep);
  const c1 = box1.getCenter(new THREE.Vector3());
  // Сдвигаем prep так, чтобы XZ-центр был в нуле и низ Y лежал на нуле:
  prep.position.x = -c1.x;
  prep.position.z = -c1.z;
  prep.position.y = -box1.min.y;
  prep.updateMatrixWorld(true);

  // Собираем внутренние Mesh-ы и их world-матрицы в системе шаблона.
  const meshNodes: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; matrix: THREE.Matrix4 }[] = [];
  prep.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshNodes.push({
      geometry: m.geometry,
      material: m.material,
      matrix: m.matrixWorld.clone(),
    });
  });
  if (meshNodes.length === 0) return;

  const dummy = new THREE.Object3D();
  const tmp = new THREE.Matrix4();
  const grid = lastRebuildGrid!;
  const cellBuckets = new Map<string, typeof cells>();
  for (const cell of cells) {
    const key = rimClipBucket(type, cell.tx, cell.ty, grid);
    let arr = cellBuckets.get(key);
    if (!arr) { arr = []; cellBuckets.set(key, arr); }
    arr.push(cell);
  }

  // Для КУСТОВ — особый путь: на каждый mesh-узел создаём пару (opaque, translucent),
  // и складываем cells/матрицы в `bushInstanceSet`, чтобы `updateBushOpacity()`
  // каждый кадр перераспределял клетки между двумя мешами в зависимости от того,
  // подсвечены ли они союзниками в кустах.
  if (type === TileType.BUSH) {
    const bushClip = combinedRimClipPlanes(type, cells, grid);
    const opaqueMeshes: THREE.InstancedMesh[] = [];
    const translucentMeshes: THREE.InstancedMesh[] = [];
    const perNodeCellMatrices: THREE.Matrix4[][] = [];
    for (const node of meshNodes) {
      const matOpaque = cloneMaterialWithClip(node.material, bushClip);
      const cloneMat = (m: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] => {
        if (Array.isArray(m)) {
          return m.map((mm) => {
            const c = mm.clone() as THREE.Material & { transparent: boolean; opacity: number; depthWrite: boolean };
            c.transparent = true;
            c.opacity = 0.4;
            c.depthWrite = false;
            if (bushClip.length) {
              c.clippingPlanes = bushClip.map((p) => p.clone());
              c.clipIntersection = false;
            }
            return c;
          });
        }
        const c = m.clone() as THREE.Material & { transparent: boolean; opacity: number; depthWrite: boolean };
        c.transparent = true;
        c.opacity = 0.4;
        c.depthWrite = false;
        if (bushClip.length) {
          c.clippingPlanes = bushClip.map((p) => p.clone());
          c.clipIntersection = false;
        }
        return c;
      };
      const matTrans = cloneMat(matOpaque);

      const opaque = new THREE.InstancedMesh(node.geometry, matOpaque, cells.length);
      const trans = new THREE.InstancedMesh(node.geometry, matTrans, cells.length);
      opaque.castShadow = true;
      opaque.receiveShadow = true;
      opaque.frustumCulled = false;
      trans.castShadow = false;
      trans.receiveShadow = false;
      trans.frustumCulled = false;
      trans.renderOrder = 1;

      const matrices: THREE.Matrix4[] = [];
      for (let i = 0; i < cells.length; i++) {
        const { tx, ty } = cells[i];
        const rimK = rimGrassFacingScale(type, tx, ty);
        const { ox, oz } = rimOutwardOffset(tx, ty, grid, type);
        dummy.position.set((tx + 0.5) * CELL + ox, 0, (ty + 0.5) * CELL + oz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(rimK, rimK, rimK);
        dummy.updateMatrix();
        const m = new THREE.Matrix4().multiplyMatrices(dummy.matrix, node.matrix);
        matrices.push(m);
        opaque.setMatrixAt(i, m);
      }
      opaque.count = cells.length;
      trans.count = 0;
      opaque.instanceMatrix.needsUpdate = true;
      trans.instanceMatrix.needsUpdate = true;
      scene.add(opaque);
      scene.add(trans);
      tileInstancedMeshes.push(opaque);
      tileInstancedMeshes.push(trans);
      opaqueMeshes.push(opaque);
      translucentMeshes.push(trans);
      perNodeCellMatrices.push(matrices);
    }
    bushInstanceSet = { cells: cells.slice(), opaqueMeshes, translucentMeshes, perNodeCellMatrices };
    return;
  }

  // Per-cell Y-ротация: bones/fence — 0/1 (направление), wall/sand_wall — 0..3.
  const isLineTile = type === TileType.DECORATION || type === TileType.FENCE;
  const isRotTile  = type === TileType.WALL || type === TileType.SAND_WALL;

  for (const node of meshNodes) {
    for (const [bucketKey, bucketCells] of cellBuckets) {
      const clipPlanes = bucketKey === "none" ? [] : playableClipPlanesForBucket(bucketKey, grid);
      const mat = cloneMaterialWithClip(node.material, clipPlanes);
      ensureTileMaterialReceivesLight(mat);
      const inst = new THREE.InstancedMesh(node.geometry, mat, bucketCells.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.frustumCulled = false;
      for (let i = 0; i < bucketCells.length; i++) {
        const { tx, ty, rot } = bucketCells[i];
        let yRot = 0;
        if (isLineTile && rot === 1) yRot = Math.PI / 2;
        else if (isRotTile) yRot = ((rot & 3) * Math.PI) / 2;
        const rimK = rimGrassFacingScale(type, tx, ty);
        const { ox, oz } = rimOutwardOffset(tx, ty, grid, type);
        dummy.position.set((tx + 0.5) * CELL + ox, 0, (ty + 0.5) * CELL + oz);
        dummy.rotation.set(0, yRot, 0);
        dummy.scale.set(rimK, rimK, rimK);
        dummy.updateMatrix();
        tmp.multiplyMatrices(dummy.matrix, node.matrix);
        inst.setMatrixAt(i, tmp);
        if (tileShouldShakeOnHit(type)) {
          tileInstRefs.push({
            mesh: inst,
            idx: i,
            localMatrix: node.matrix.clone(),
            tx,
            ty,
            yRot,
          });
        }
      }
      inst.instanceMatrix.needsUpdate = true;
      scene.add(inst);
      tileInstancedMeshes.push(inst);
    }
  }
}

function applyTileShakes(): void {
  if (!tileInstRefs.length) return;
  const dirty = new Set<THREE.InstancedMesh>();
  for (const ref of tileInstRefs) {
    const shake = getTileShakeOffset(ref.tx, ref.ty, CELL);
    tileShakeDummy.position.set(
      (ref.tx + 0.5) * CELL + shake.ox,
      0,
      (ref.ty + 0.5) * CELL + shake.oy,
    );
    tileShakeDummy.rotation.set(0, ref.yRot, 0);
    tileShakeDummy.scale.set(1, 1, 1);
    tileShakeDummy.updateMatrix();
    tileShakeTmp.multiplyMatrices(tileShakeDummy.matrix, ref.localMatrix);
    ref.mesh.setMatrixAt(ref.idx, tileShakeTmp);
    dirty.add(ref.mesh);
  }
  for (const mesh of dirty) mesh.instanceMatrix.needsUpdate = true;
}

function rebuildTilesFromGrid(grid: TileGrid): void {
  clearTileMeshes();
  lastRebuildGrid = grid;

  // Группируем ячейки по типу. Тащим с собой rot (если grid.rotations задан) —
  // он используется для согласованного поворота wall/sand_wall/fence/bones
  // с тем, что было выставлено в редакторе карт.
  const cellsByType = new Map<number, { tx: number; ty: number; rot: number }[]>();
  const rotArr = grid.rotations;
  const minTX = -TILE_EDGE_PAD;
  const maxTX = grid.width - 1 + TILE_EDGE_PAD;
  const minTY = -TILE_EDGE_PAD;
  const maxTY = grid.height - 1 + TILE_EDGE_PAD;
  for (let ty = minTY; ty <= maxTY; ty++) {
    for (let tx = minTX; tx <= maxTX; tx++) {
      if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) continue;
      const t = getTile(grid, tx, ty);
      if (t === TileType.GRASS) continue;
      const rot = rotArr ? (rotArr[ty * grid.width + tx] | 0) : 0;
      let arr = cellsByType.get(t);
      if (!arr) { arr = []; cellsByType.set(t, arr); }
      arr.push({ tx, ty, rot });
    }
  }
  for (const [type, cells] of cellsByType) {
    // ВОДА — особый путь: соседние клетки воды должны сливаться в монолит без
    // внутренних швов, а внешняя граница — иметь cyan-обводку и скруглённые
    // углы. Стандартный InstancedMesh-путь делает каждую клетку независимым
    // тайлом с одинаковой формой, поэтому здесь у нас отдельная функция,
    // строящая per-cell ShapeGeometry по соседям.
    if (type === TileType.WATER) {
      buildFluidMeshes(cells, WATER_FLUID_STYLE);
    } else {
      buildInstancedTilesForType(type, cells);
    }
  }
}

/** Вода / полисадник — соседние клетки сливаются без швов (см. `mergedFluidTiles`). */
function buildFluidMeshes(
  cells: { tx: number; ty: number; rot?: number }[],
  style: typeof WATER_FLUID_STYLE,
): void {
  if (!scene || cells.length === 0) return;
  buildMergedFluidMeshes(scene, cells, CELL, style, waterMeshes, tileInstancedMeshes);
}

function resolveBattleClip(
  clips: THREE.AnimationClip[],
  name: string,
  idx?: number,
): THREE.AnimationClip | null {
  return findCharAnimClip(clips, name, idx);
}

/** Pre-create clipActions once per mesh — same as CharacterTopDownRenderer.getOrCreateInstance. */
function createBattleActions(
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
  names: CharAnimNames,
): {
  actions: Partial<Record<"idle" | "run" | "attack" | "super", THREE.AnimationAction>>;
  clipNames: { idle?: string; run?: string; attack?: string; super?: string };
} {
  const actions: Partial<Record<"idle" | "run" | "attack" | "super", THREE.AnimationAction>> = {};
  const clipNames: { idle?: string; run?: string; attack?: string; super?: string } = {};
  const idleClip = resolveBattleClip(clips, names.idle, names.idleIdx);
  const runClip = resolveBattleClip(clips, names.run, names.runIdx);
  let attackClip = resolveBattleClip(clips, names.attack, names.attackIdx);
  const superClip = names.super ? resolveBattleClip(clips, names.super, names.superIdx) : null;
  if (attackClip && names.attackClipTune) {
    attackClip = tuneAttackClip(attackClip, names.attackClipTune);
  }

  const usedClips = new Set<THREE.AnimationClip>(
    [idleClip, runClip, attackClip].filter((c): c is THREE.AnimationClip => !!c),
  );
  for (const [slot, clip, loopOnce] of [
    ["idle", idleClip, false] as const,
    ["run", runClip, false] as const,
    ["attack", attackClip, names.attackLoopOnce] as const,
    ["super", superClip && !usedClips.has(superClip) ? superClip : null, names.superLoopOnce] as const,
  ]) {
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    if (loopOnce) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    } else {
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = false;
    }
    actions[slot] = a;
    clipNames[slot] = clip.name;
  }
  return { actions, clipNames };
}

/**
 * Standing still — frozen idle frame 0 (CharacterTopDownRenderer.enterStandingStill).
 * No per-frame maintenance; only called on state transition.
 */
function enterBattleStanding(entry: BrawlerMeshEntry): void {
  entry.mixer.stopAllAction();
  const poseAction = entry.actions.idle ?? entry.actions.run ?? entry.actions.attack;
  if (poseAction) {
    poseAction.reset();
    poseAction.setEffectiveWeight(1);
    poseAction.paused = false;
    poseAction.setEffectiveTimeScale(0);
    poseAction.play();
    poseAction.time = 0;
  } else {
    resetSkinnedBindPose(entry.model);
  }
  entry.currentAnim = "idle";
}

function applyBattleRun(entry: BrawlerMeshEntry): void {
  const idleA = entry.actions.idle;
  const runA = entry.actions.run;
  if (idleA && runA && idleA === runA) {
    idleA.paused = false;
    idleA.setEffectiveWeight(1);
    idleA.setEffectiveTimeScale(entry.animNames.sharedLocomotionRunScale ?? 1);
    idleA.play();
    entry.currentAnim = "run";
    return;
  }
  if (!runA) return;
  entry.mixer.stopAllAction();
  runA.reset();
  runA.setLoop(THREE.LoopRepeat, Infinity);
  runA.clampWhenFinished = false;
  runA.setEffectiveWeight(1);
  runA.paused = false;
  runA.setEffectiveTimeScale(1);
  runA.play();
  entry.currentAnim = "run";
}

function applyBattleAttack(entry: BrawlerMeshEntry): void {
  const atkA = entry.actions.attack;
  if (!atkA) {
    entry.currentAnim = "attack";
    return;
  }
  entry.mixer.stopAllAction();
  atkA.reset();
  atkA.setEffectiveWeight(1);
  atkA.paused = false;
  atkA.setEffectiveTimeScale(entry.animNames.attackClipTune?.timeScale ?? 1);
  atkA.play();
  entry.currentAnim = "attack";
}

function applyBattleSuper(entry: BrawlerMeshEntry): void {
  const superA = entry.actions.super ?? entry.actions.run;
  if (!superA) {
    applyBattleAttack(entry);
    return;
  }
  entry.mixer.stopAllAction();
  superA.reset();
  superA.setEffectiveWeight(1);
  superA.paused = false;
  superA.setEffectiveTimeScale(1.15);
  superA.play();
  entry.currentAnim = "super";
}

function removeBrawlerMeshEntry(id: string, entry: BrawlerMeshEntry): void {
  if (scene) {
    scene.remove(entry.pivot);
    if (entry.shadow) {
      scene.remove(entry.shadow);
      (entry.shadow.material as THREE.Material).dispose();
      entry.shadow.geometry.dispose();
    }
    if (entry.teamRing) {
      scene.remove(entry.teamRing);
      (entry.teamRing.material as THREE.Material).dispose();
      entry.teamRing.geometry.dispose();
    }
  }
  disposeGaleTornado(entry);
  entry.mixer.stopAllAction();
  brawlerMeshes.delete(id);
}

function getOrCreateBrawlerMesh(b: Brawler): BrawlerMeshEntry | null {
  if (!scene) return null;
  const id = b.id;
  let entry = brawlerMeshes.get(id);
  if (entry && entry.animLogicVersion !== BATTLE_ANIM_LOGIC_VERSION) {
    removeBrawlerMeshEntry(id, entry);
    entry = undefined;
  }
  if (entry) return entry;

  const charId = b.stats.id;
  if (!CHAR_3D_IDS.has(charId)) return null;
  const charRenderer = getCharRenderer(charId);
  if (!charRenderer || !charRenderer.isReady()) return null;

  const model = charRenderer.cloneModelTemplate();
  if (!model) return null;

  fixCharacterSkinnedMeshes(model);

  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      // Бойцы кастуют тень на пол (≤ 10 экземпляров — недорого).
      m.castShadow = true;
      m.receiveShadow = false;
    }
  });

  const pivot = new THREE.Group();
  pivot.add(model);

  // Поднимаем модель так, чтобы ноги стояли на y=0 (template уже центрирован, но clone может сместить).
  const box = new THREE.Box3().setFromObject(model);
  model.position.y -= box.min.y;

  // Базовый масштаб модели подобран в miyaTopDownRenderer как MODEL_TARGET_H = 3.2.
  // В нашей сцене 1 единица = 1 пиксель, бойцы должны быть размером с ~radius*2 ~50px.
  // 3.2 → 64px (≈ диаметр бойца).
  const desiredHeightPx = Math.max(48, b.radius * 2.4);
  const curH = (new THREE.Box3().setFromObject(model)).getSize(new THREE.Vector3()).y || 1;
  const k = desiredHeightPx / curH;
  pivot.scale.setScalar(k);

  scene.add(pivot);

  // Тень бойца теперь даёт настоящий directional light + receiveShadow на полу.
  // Дополнительный «нарисованный» круг тени не нужен.
  const shadow: THREE.Mesh | null = null;

  // Тонкое цветное кольцо-индикатор команды у ног бойца. Намеренно тонкое
  // (всего ~7% радиуса), чтобы не воспринималось как «дублирующий силуэт».
  // Цвет ставится в `syncBrawlerEntry`: игрок=зелёный, союзник=синий, враг=красный.
  const ringGeom = new THREE.RingGeometry(b.radius * 1.08, b.radius * 1.16, 40);
  ringGeom.rotateX(-Math.PI / 2);
  const teamRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const teamRing = new THREE.Mesh(ringGeom, teamRingMat);
  teamRing.position.y = 0.55;
  teamRing.renderOrder = 5;
  scene.add(teamRing);

  resetSkinnedBindPose(model);
  model.updateMatrixWorld(true);

  // Match 2D CharacterTopDownRenderer — mixer root is the model, not Armature.
  const mixer = new THREE.AnimationMixer(model);
  const clips = charRenderer.getClips();
  const names: CharAnimNames = charRenderer.getAnimNames();
  const { actions, clipNames } = createBattleActions(mixer, clips, names);
  const runClip = clipNames.run;
  const attackClip = clipNames.attack;

  entry = {
    rootId: id,
    charId,
    pivot,
    model,
    mixer,
    clips,
    animNames: names,
    actions,
    currentAnim: "idle",
    clipNames,
    animLogicVersion: BATTLE_ANIM_LOGIC_VERSION,
    shadow,
    teamRing,
    teamRingMat,
    lastX: b.x,
    lastY: b.y,
    renderX: b.x,
    renderY: b.y,
    movingSmoothed: 0,
    runLatch: false,
    lastOpacity: 1,
    lastAnimChangeMs: 0,
    galeTornado: null,
    galeSpinAngle: 0,
  };
  enterBattleStanding(entry);
  if (import.meta.env.DEV && (!runClip || !attackClip)) {
    console.warn(
      "[Battle3D] missing clips for",
      charId,
      { want: names, got: clipNames, all: clips.map(c => c.name) },
    );
  }
  brawlerMeshes.set(id, entry);
  return entry;
}

/**
 * Применить непрозрачность ко всем mesh-материалам модели бойца. Кеширует
 * последнее значение в `entry.lastOpacity`, чтобы не дёргать traverse каждый
 * кадр без необходимости.
 *
 * Бойцов в кустах рисуем с opacity ≈ 0.55 — тогда игрок «видит сквозь
 * листву» свою модель (и моделей союзников), как в Brawl Stars.
 */
function setBrawlerOpacity(entry: BrawlerMeshEntry, opacity: number): void {
  if (Math.abs(entry.lastOpacity - opacity) < 0.01) return;
  entry.lastOpacity = opacity;
  const transparent = opacity < 0.99;
  entry.model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const mm = mat as THREE.Material & { transparent: boolean; opacity: number };
      if (mm.transparent !== transparent) mm.transparent = transparent;
      mm.opacity = opacity;
    }
  });
}

/** Spinning funnel mesh — replaces Zephyrin's body during gale super. */
function createZephyrinGaleTornado(radiusPx: number): THREE.Group {
  const group = new THREE.Group();
  const height = radiusPx * 1.35;
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const r = radiusPx * (0.28 + t * 0.48);
    const ringGeo = new THREE.RingGeometry(r * 0.68, r, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? 0xffffff : 0xb0bec5,
      transparent: true,
      opacity: 0.24 + t * 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = t * height;
    ring.userData.spinSpeed = 2.2 + i * 0.35;
    ring.userData.spinOffset = i * 0.65;
    group.add(ring);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const wispGeo = new THREE.PlaneGeometry(radiusPx * 0.28, height * 0.72);
    const wispMat = new THREE.MeshBasicMaterial({
      color: 0xeceff1,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const wisp = new THREE.Mesh(wispGeo, wispMat);
    wisp.position.set(Math.cos(a) * radiusPx * 0.24, height * 0.42, Math.sin(a) * radiusPx * 0.24);
    wisp.rotation.y = a;
    wisp.userData.spinSpeed = 3.4;
    wisp.userData.orbitRadius = radiusPx * 0.24;
    group.add(wisp);
  }
  return group;
}

function disposeGaleTornado(entry: BrawlerMeshEntry): void {
  if (!entry.galeTornado) return;
  entry.pivot.remove(entry.galeTornado);
  entry.galeTornado.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
      else m.material.dispose();
    }
  });
  entry.galeTornado = null;
  entry.galeSpinAngle = 0;
}

function syncZephyrinGaleForm(
  entry: BrawlerMeshEntry,
  b: Brawler,
  dt: number,
  visible: boolean,
): void {
  const inGale = isZephyrinInGale(b) || b.inZephyrinGale;
  if (inGale) {
    if (!entry.galeTornado) {
      entry.galeTornado = createZephyrinGaleTornado(b.radius);
      entry.pivot.add(entry.galeTornado);
    }
    entry.galeTornado.visible = visible;
    entry.model.visible = false;
    entry.galeSpinAngle += dt * 5.2;
    entry.galeTornado.rotation.y = entry.galeSpinAngle;
    for (const child of entry.galeTornado.children) {
      const speed = (child.userData.spinSpeed as number | undefined) ?? 2;
      const offset = (child.userData.spinOffset as number | undefined) ?? 0;
      const orbit = child.userData.orbitRadius as number | undefined;
      child.rotation.y = entry.galeSpinAngle * speed + offset;
      if (orbit !== undefined) {
        const a = entry.galeSpinAngle * speed + offset;
        child.position.x = Math.cos(a) * orbit;
        child.position.z = Math.sin(a) * orbit;
      }
    }
  } else {
    if (entry.galeTornado) disposeGaleTornado(entry);
    entry.model.visible = visible;
  }
}

/**
 * Информация о союзнике для расчёта «подсветки» кустов и видимости врагов.
 * Считаем tx/ty один раз на кадр в `tickAndRenderBattle3D`, чтобы не дёргать
 * Math.floor в каждой проверке Chebyshev-расстояния.
 */
interface FriendlyInfo {
  x: number;
  y: number;
  tx: number;
  ty: number;
  inBush: boolean;
}

/**
 * Куст «горит» (становится полупрозрачным и раскрывает врагов внутри), если
 * хотя бы один союзник в кусте находится в Chebyshev-радиусе 1 клетки от него.
 * Это та же механика, что в Brawl Stars: войдя в куст, ты видишь сам куст и
 * 8 соседних клеток кустов.
 */
function isBushLit(tx: number, ty: number, friendliesInBush: FriendlyInfo[]): boolean {
  for (const f of friendliesInBush) {
    if (Math.abs(tx - f.tx) <= 1 && Math.abs(ty - f.ty) <= 1) return true;
  }
  return false;
}

/**
 * Каждый кадр перераспределяет инстансы кустов между opaque-сетом и
 * translucent-сетом. Сами клетки и предвычисленные матрицы лежат в
 * `bushInstanceSet`, поэтому обновление сводится к нескольким сотням
 * `setMatrixAt` без аллокаций.
 */
function updateBushOpacity(friendliesInBush: FriendlyInfo[]): void {
  if (!bushInstanceSet) return;
  const { cells, opaqueMeshes, translucentMeshes, perNodeCellMatrices } = bushInstanceSet;

  // Битовая маска «горящих» клеток — посчитаем один раз для всех mesh-узлов.
  const litFlags = new Uint8Array(cells.length);
  if (friendliesInBush.length > 0) {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (isBushLit(c.tx, c.ty, friendliesInBush)) litFlags[i] = 1;
    }
  }

  for (let n = 0; n < opaqueMeshes.length; n++) {
    const opaque = opaqueMeshes[n];
    const trans = translucentMeshes[n];
    const matrices = perNodeCellMatrices[n];
    let oc = 0;
    let tc = 0;
    for (let i = 0; i < cells.length; i++) {
      if (litFlags[i]) trans.setMatrixAt(tc++, matrices[i]);
      else opaque.setMatrixAt(oc++, matrices[i]);
    }
    opaque.count = oc;
    trans.count = tc;
    opaque.instanceMatrix.needsUpdate = true;
    trans.instanceMatrix.needsUpdate = true;
  }
}

function friendlyBushKey(friendlies: FriendlyInfo[]): string {
  if (friendlies.length === 0) return "_";
  let k = "";
  for (const f of friendlies) k += `${f.tx},${f.ty};`;
  return k;
}

function syncBrawlerEntry(
  entry: BrawlerMeshEntry,
  b: Brawler,
  dt: number,
  viewerTeam: string | undefined,
  friendliesInBush: FriendlyInfo[],
): void {
  if (!b.alive) {
    entry.pivot.visible = false;
    if (entry.shadow) entry.shadow.visible = false;
    if (entry.teamRing) entry.teamRing.visible = false;
    return;
  }

  // Куст прячет врагов: если этот боец — враг с точки зрения зрителя и сидит
  // в кусте, его 3D-модель полностью скрывается. «Раскрывают» куст:
  //   1) свой союзник, который САМ стоит в кусте в радиусе Chebyshev≤1 клетки
  //      (т.е. в этом же кусте или в одном из 8 соседних) — как в Brawl Stars;
  //   2) недавний выстрел врага (b.bushRevealTimer > 0).
  // Радиус-в-пикселях больше не используем — у нас тайловая сетка, и логика
  // должна быть детерминированной по клеткам, а не «зависеть от того, на сколько
  // ты подошёл по пикселям».
  const isEnemyToViewer = viewerTeam !== undefined && !b.isPlayer && b.team !== viewerTeam;
  let hiddenByBush = false;
  let hiddenByInk = false;
  let hiddenBySmoke = false;
  if (isEnemyToViewer && b.inBush) {
    let revealed = b.bushRevealTimer > 0;
    if (!revealed) {
      const bTx = Math.floor(b.x / CELL);
      const bTy = Math.floor(b.y / CELL);
      for (const f of friendliesInBush) {
        if (Math.abs(bTx - f.tx) <= 1 && Math.abs(bTy - f.ty) <= 1) {
          revealed = true;
          break;
        }
      }
    }
    if (!revealed) hiddenByBush = true;
  }
  if (isEnemyToViewer && b.inOctaviaInk && b.bushRevealTimer <= 0) {
    hiddenByInk = true;
  }
  if (isEnemyToViewer && b.stats.id === "airin" && b.airinPilotShadowTimer > 0 && b.attackAnim <= 0.05) {
    hiddenBySmoke = true;
  }

  entry.pivot.visible = !hiddenByBush && !hiddenByInk && !hiddenBySmoke;
  if (entry.shadow) entry.shadow.visible = !hiddenByBush && !hiddenByInk && !hiddenBySmoke;
  if (entry.teamRing) entry.teamRing.visible = !hiddenByBush && !hiddenByInk && !hiddenBySmoke;

  const pivotVisible = entry.pivot.visible;
  if (entry.charId === "zephyrin") {
    syncZephyrinGaleForm(entry, b, dt, pivotVisible);
  } else {
    entry.model.visible = pivotVisible;
  }

  // Если боец сидит в кусте И его видно (свой / раскрытый враг) — делаем его
  // полупрозрачным, чтобы было ясно «он в укрытии» и листва не перекрывала
  // полностью. Бойцов вне куста — рисуем как обычно.
  if (!hiddenByBush && !hiddenByInk && !hiddenBySmoke && !(entry.charId === "zephyrin" && (isZephyrinInGale(b) || b.inZephyrinGale))) {
    setBrawlerOpacity(entry, b.inBush ? 0.55 : 1.0);
  }

  // 3D pivot: local player + server remotes track logic x/y 1:1 (interp already in prepareRemotes).
  if (!Number.isFinite(entry.renderX)) {
    entry.renderX = b.x;
    entry.renderY = b.y;
  }
  const serverDriven = !!(b as Brawler & { __serverDriven?: boolean }).__serverDriven;
  if (b.isPlayer || serverDriven) {
    entry.renderX = b.x;
    entry.renderY = b.y;
  } else {
    const rdt = Math.min(0.05, dt);
    let maxStep = Math.max(2, b.speed * 60 * rdt);
    const slowFx = b.statusEffects?.find((e) => e.type === "slow");
    if (slowFx) maxStep *= Math.max(0.2, 1 - slowFx.value);
    if (b.inRiver) maxStep *= 0.6;
    const toX = b.x - entry.renderX;
    const toY = b.y - entry.renderY;
    const toDist = Math.hypot(toX, toY);
    if (toDist > 480) {
      entry.renderX = b.x;
      entry.renderY = b.y;
    } else if (toDist <= maxStep || toDist < 0.04) {
      entry.renderX = b.x;
      entry.renderY = b.y;
    } else {
      entry.renderX += (toX / toDist) * maxStep;
      entry.renderY += (toY / toDist) * maxStep;
    }
  }
  const rx = entry.renderX;
  const ry = entry.renderY;
  entry.pivot.position.set(rx, 0, ry);
  if (entry.shadow) entry.shadow.position.set(rx, 0.4, ry);

  // Кольцо команды над тенью; цвет: игрок=зелёный, союзник=синий, враг=красный.
  if (entry.teamRing && entry.teamRingMat) {
    entry.teamRing.position.set(rx, 0.55, ry);
    let color = 0xffffff;
    if (viewerTeam !== undefined) {
      if (b.isPlayer) color = 0x4caf50;
      else if (b.team === viewerTeam) color = 0x2196f3;
      else color = 0xf44336;
    }
    if (entry.teamRingMat.color.getHex() !== color) {
      entry.teamRingMat.color.setHex(color);
    }
  }

  // Анимация: атака > бег > idle. Порог 0.02 — такой же как в 2D-логике
  // Brawler.render, чтобы не «застревать» в attack после короткого выстрела.
  const dx = rx - entry.lastX;
  const dy = ry - entry.lastY;
  const moved = Math.hypot(dx, dy);
  entry.lastX = rx;
  entry.lastY = ry;
  const movePulse = (b as Brawler & { _animMovePulse?: number })._animMovePulse ?? 0;
  const moveThreshold = Math.max(0.04, 28 * Math.min(0.05, dt));
  const isMovingNow = moved > moveThreshold || movePulse > 0.08 ? 1 : 0;
  entry.movingSmoothed = entry.movingSmoothed * 0.82 + isMovingNow * 0.18;
  if (entry.runLatch) {
    entry.movingSmoothed = Math.max(entry.movingSmoothed, movePulse > 0.06 ? 0.42 : 0.22);
    if (entry.movingSmoothed < 0.12 && movePulse < 0.04 && moved < moveThreshold * 0.5) {
      entry.runLatch = false;
    }
  } else if (entry.movingSmoothed > 0.32 || movePulse > 0.22) {
    entry.runLatch = true;
  }

  const isSuperCasting =
    (b.stats.id === "verdeletta" || b.stats.id === "lumina" || b.stats.id === "oliver" || b.stats.id === "callista" || b.stats.id === "airin" || b.stats.id === "elian" || b.stats.id === "silven" || b.stats.id === "vittoria" || b.stats.id === "octavia" || b.stats.id === "zephyrin" || b.stats.id === "mirabel") && b.superAnim > 0.05;
  const runLocked = entry.runLatch || movePulse > 0.18;
  const attackGate = runLocked ? 0.18 : 0.02;
  const superGate = runLocked ? 0.12 : 0.05;
  const isAttacking = b.attackAnim > attackGate;
  let desired: "idle" | "run" | "attack" | "super" = "idle";
  if (isAttacking) {
    desired = "attack";
  } else if (isSuperCasting && b.superAnim > superGate && entry.actions.super) {
    desired = "super";
  } else if (entry.runLatch) {
    desired = "run";
  } else {
    desired = "idle";
  }

  const smoothMove = (b as Brawler & { _smoothMoveAngle?: number })._smoothMoveAngle;
  const facingAngle = isAttacking && b.attackAnim > 0.12
    ? b.angle
    : (typeof smoothMove === "number" ? smoothMove : b.angle);
  entry.pivot.rotation.y = Math.PI / 2 - facingAngle;

  if (desired !== entry.currentAnim) {
    const now = performance.now();
    const leavingRun = entry.currentAnim === "run" && desired === "idle";
    const minHold = leavingRun ? 140 : BATTLE_ANIM_MIN_HOLD_MS;
    const canSwitch = desired === "attack" || desired === "super"
      || entry.currentAnim === "attack" || entry.currentAnim === "super"
      || now - entry.lastAnimChangeMs >= minHold;
    if (canSwitch) {
      entry.lastAnimChangeMs = now;
      if (desired === "idle") enterBattleStanding(entry);
      else if (desired === "run") applyBattleRun(entry);
      else if (desired === "super") applyBattleSuper(entry);
      else applyBattleAttack(entry);
    }
  }

  const speedMul = (b as Brawler & { _replaySpeed?: number })._replaySpeed ?? 1;
  entry.mixer.update(Math.min(0.05, dt * speedMul));
}

function pruneBrawlerMeshes(alive: Set<string>): void {
  if (!scene) return;
  for (const [id, entry] of brawlerMeshes) {
    if (alive.has(id)) continue;
    removeBrawlerMeshEntry(id, entry);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function setBattle3DCanvas(canvas: HTMLCanvasElement | null): void {
  if (canvasEl === canvas) return;
  canvasEl = canvas;
  if (renderer && (!canvas || renderer.domElement !== canvas)) {
    disposeBattle3D();
  }
}

export interface Battle3DInitOpts {
  tileGrid: TileGrid;
  /** Размер игрового мира (карты) в пикселях. */
  mapWidth: number;
  mapHeight: number;
  /** Размер видимой области игры (равно CAM_W/CAM_H режима). */
  camViewW: number;
  camViewH: number;
  /** CSS-размер целевого canvas (обычно 1200×800). */
  canvasCssW?: number;
  canvasCssH?: number;
}

/** Build grass + instanced tiles for the current battle grid (idempotent per session). */
function ensureBattle3DWorldContent(): void {
  if (battle3DSceneReady || !active || !currentTileGrid || !scene) return;

  if (!grassField) {
    rebuildGround();
  }

  if (lastRebuildGrid === currentTileGrid) {
    battle3DSceneReady = true;
    return;
  }

  if (battle3DTilesLoading) return;
  battle3DTilesLoading = true;

  void loadAllTileModels(undefined, { glbOnly: true }).then(() => {
    battle3DTilesLoading = false;
    if (!active || !currentTileGrid || !scene) return;
    rebuildTilesFromGrid(currentTileGrid);
    battle3DSceneReady = true;
  }).catch((err) => {
    battle3DTilesLoading = false;
    console.warn("[battle3D] tile models load failed:", err);
  });
}

/** Ждём траву/землю после async rebuildGround. */
async function waitForBattleGrassReady(timeoutMs = 12000): Promise<void> {
  const start = performance.now();
  while (!grassField && performance.now() - start < timeoutMs) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
}

export function reloadBattle3DMap(tileGrid: TileGrid): void {
  currentTileGrid = tileGrid;
  currentMapW = tileGrid.width * tileGrid.cellSize;
  currentMapH = tileGrid.height * tileGrid.cellSize;
  if (!active || !scene) return;
  lastRebuildGrid = null;
  rebuildGround();
  rebuildTilesFromGrid(tileGrid);
  battle3DSceneReady = true;
}

export async function initBattle3DForBattle(opts: Battle3DInitOpts): Promise<boolean> {
  const gen = ++battle3DInitGen;
  const stale = () => gen !== battle3DInitGen;

  currentTileGrid = opts.tileGrid;
  const gridW = opts.tileGrid.width * opts.tileGrid.cellSize;
  const gridH = opts.tileGrid.height * opts.tileGrid.cellSize;
  currentMapW = gridW;
  currentMapH = gridH;
  currentCamW = opts.camViewW;
  currentCamH = opts.camViewH;
  currentCanvasCssW = opts.canvasCssW ?? 1200;
  currentCanvasCssH = opts.canvasCssH ?? 800;
  battle3DSceneReady = false;
  // active остаётся true (beginBattle3DSession) — 3D рисуется во время интро.

  if (!isBattleAssetsReady()) {
    try { disposeTileBakerRenderer(); } catch { /* ignore */ }
    try { disposeCharBakerSharedRenderer(); } catch { /* ignore */ }
    try { disposePowerBakerRenderer(); } catch { /* ignore */ }
  }

  if (!canvasEl || !ensureRenderer()) {
    throw new Error("[battle3D] WebGL renderer not ready");
  }
  if (!renderer || !camera) {
    throw new Error("[battle3D] WebGL partial init");
  }
  if (stale()) return false;

  renderer.setSize(currentCanvasCssW, currentCanvasCssH, false);
  camera.near = 1;
  camera.far = 6000;
  applyCameraFrustum();

  lastDestroyRevision = 0;
  lastBushFriendlyKey = "";

  const base: string = getHeavyAssetBaseUrl();
  try {
    rebuildGround();
    await loadBinbunGrassAssets(base);
    if (stale()) return false;
    await loadAllTileModels(undefined, { glbOnly: true });
    if (stale() || !currentTileGrid) return false;
    rebuildTilesFromGrid(currentTileGrid);
    if (stale()) return false;
    await waitForBattleGrassReady();
    if (stale()) return false;

    // Мир (трава + тайлы) готов — показываем 3D-фон за интро, бойцы догружаются ниже.
    active = true;
    setTileCollisionFullCell(true);
    battle3DSceneReady = true;

    await preloadCharRenderers(base);
    if (stale()) return false;
    await preloadVerdelettaShadowModel(base);
    if (stale()) return false;
    await loadSafeGLBTemplate();
    if (stale()) return false;
    initBattle3DPets(base);
    initBattle3DVerdelettaShadows(base);
    initBattle3DDevMonsters(base);
  } catch (err) {
    if (stale()) return false;
    console.warn("[battle3D] world meshes failed:", err);
    active = false;
    battle3DSceneReady = false;
    throw err;
  }

  return !stale();
}

export function resolveBattleTileGrid(game: {
  tileGrid?: TileGrid | null;
  map?: { tileGrid?: TileGrid | null; width?: number; height?: number } | null;
}): TileGrid {
  const grid = game.tileGrid ?? game.map?.tileGrid;
  if (grid) return grid;
  return createFallbackBattleTileGrid(game.map?.width ?? 3000, game.map?.height ?? 3000);
}

/** Активирует 3D-сессию боя (вызывается из GameScreen до async init). */
export function beginBattle3DSession(): void {
  active = true;
  setTileCollisionFullCell(true);
}

export function isBattle3DActive(): boolean {
  return active && !!renderer && battle3DSceneReady;
}

/** WebGL renderer + scene exist and are ready to draw the battle world. */
export function isBattle3DRendererReady(): boolean {
  return active && !!renderer && !!scene && !!camera;
}

/** Есть ли уже живой 3D-меш для конкретного экземпляра бойца в сцене боя. */
export function hasBrawler3DMesh(instanceId: string): boolean {
  return brawlerMeshes.has(instanceId);
}

export function enableBattle3D(on: boolean): void {
  active = on;
  // В 3D-режиме модель тайла занимает всю ячейку — south-inset больше не нужен.
  setTileCollisionFullCell(on);
}

/**
 * Создаёт/обновляет/удаляет 3D-меши power_box.glb по списку crates.
 *
 * Маппинг координат: Crate.x/Crate.y — это top-left прямоугольника, поэтому
 * мировой центр клетки = (x + w/2, y + h/2). В 3D эти координаты ложатся
 * напрямую: (cx, 0, cy), потому что 3D-сцена строится в той же сетке игровых
 * пикселей, что и 2D-карта (через CELL=50).
 *
 * Сравнение состояния:
 *   • Если crate существует и !destroyed → меш должен быть в сцене.
 *   • Если crate.destroyed или его нет в crates → меш удаляется.
 *   • При первом запуске, если GLB ещё не загружен, ничего не строим — следующий
 *     кадр всё повторит, как только промис resolved.
 */
/**
 * Берёт сырой GLB-шаблон и кладёт его внутрь группы так, чтобы:
 *   • XZ-центр модели был в (0, 0)
 *   • низ модели лежал на y = 0
 *   • максимальное XZ-измерение = `targetXZ`
 *
 * Возвращает реальную высоту модели в мире (нужна для расположения HP-бара
 * над предметом). Без этого высоту приходилось «угадывать» константой.
 */
function buildNormalizedInstance(
  template: THREE.Object3D,
  targetXZ: number,
  parent: THREE.Group,
): number {
  const inst = template.clone(true);
  // Bounding box БЕЗ scale (template.scale = 1).
  const box0 = new THREE.Box3().setFromObject(inst);
  const size0 = box0.getSize(new THREE.Vector3());
  const center0 = box0.getCenter(new THREE.Vector3());
  const maxXZ = Math.max(size0.x, size0.z) || 1;
  const s = targetXZ / maxXZ;
  // Сдвиг inst так, чтобы после scale бокс был центрирован XZ и стоял на y=0.
  inst.position.set(-center0.x * s, -box0.min.y * s, -center0.z * s);
  inst.scale.setScalar(s);
  inst.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
  });
  parent.add(inst);
  return size0.y * s;
}

/**
 * Рисует HP-бар на canvas-текстуре. Зелёный/жёлтый/красный в зависимости от
 * процента HP, белая обводка, чёрная полупрозрачная подложка и текст
 * `hp / maxHp` посередине.
 */
function paintHpBarCanvas(
  cv: HTMLCanvasElement,
  hp: number,
  maxHp: number,
  hostile = false,
): void {
  const W = cv.width;
  const H = cv.height;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const barH = Math.round(H * 0.55);
  const barY = Math.round((H - barH) * 0.5);
  const barX = 0;
  const barW = W;
  // Подложка
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
  // Цвет полосы (как у бойцов; для вражеских объектов — красный)
  ctx.fillStyle = hostile
    ? (ratio > 0.5 ? "#F44336" : ratio > 0.25 ? "#FF5722" : "#B71C1C")
    : (ratio > 0.5 ? "#4CAF50" : ratio > 0.25 ? "#FFB300" : "#F44336");
  ctx.fillRect(barX, barY, barW * ratio, barH);
  // Обводка
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
  // Текст HP
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${Math.round(H * 0.45)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.95)";
  ctx.shadowBlur = 4;
  ctx.fillText(`${Math.ceil(hp)} / ${maxHp}`, W / 2, H / 2 + 1);
}

function addPowerBoxPlaceholder(group: THREE.Group, targetXZ: number): THREE.Mesh {
  const ph = new THREE.Mesh(
    new THREE.BoxGeometry(targetXZ * 0.72, targetXZ * 0.72, targetXZ * 0.72),
    new THREE.MeshLambertMaterial({ color: 0xc44ad6 }),
  );
  ph.position.y = (targetXZ * 0.72) / 2;
  ph.castShadow = true;
  ph.receiveShadow = true;
  ph.userData.__powerBoxPlaceholder = true;
  group.add(ph);
  return ph;
}

function upgradePowerBoxPlaceholder(group: THREE.Group, template: THREE.Object3D, targetXZ: number): number {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const ch = group.children[i];
    if (ch.userData.__powerBoxPlaceholder) {
      group.remove(ch);
      (ch as THREE.Mesh).geometry?.dispose();
    }
  }
  return buildNormalizedInstance(template, targetXZ, group);
}

function syncCrates(crates: Crate[] | undefined): void {
  if (!scene) return;

  if (!crateTemplateRequested) {
    crateTemplateRequested = true;
    void loadPowerBoxGLBTemplate();
  }

  const template = getPowerBoxGLBTemplate();
  const alive = new Set<Crate>();
  if (crates) {
    for (const c of crates) {
      if (c.destroyed) continue;
      alive.add(c);
      let entry = crateMeshes.get(c);
      const target = Math.max(c.w, c.h) * 0.85;
      if (!entry) {
        const group = new THREE.Group();
        let yHeight: number;
        if (template) {
          yHeight = buildNormalizedInstance(template, target, group);
        } else {
          addPowerBoxPlaceholder(group, target);
          yHeight = target * 0.72;
          void loadPowerBoxGLBTemplate().then((tpl) => {
            if (!tpl || !group.parent) return;
            yHeight = upgradePowerBoxPlaceholder(group, tpl, target);
            const existing = crateMeshes.get(c);
            if (existing) existing.yHeight = yHeight;
          });
        }
        scene.add(group);

        const hpCanvas = document.createElement("canvas");
        hpCanvas.width = 256;
        hpCanvas.height = 48;
        const hpTexture = new THREE.CanvasTexture(hpCanvas);
        hpTexture.colorSpace = THREE.SRGBColorSpace;
        const hpMat = new THREE.SpriteMaterial({
          map: hpTexture,
          transparent: true,
          depthWrite: false,
          depthTest: false,
        });
        const hpSprite = new THREE.Sprite(hpMat);
        const spriteW = c.w * 1.35;
        const spriteH = spriteW * (hpCanvas.height / hpCanvas.width);
        hpSprite.scale.set(spriteW, spriteH, 1);
        hpSprite.renderOrder = 100;
        scene.add(hpSprite);

        entry = { group, hpSprite, hpCanvas, hpTexture, lastHp: -1, yHeight };
        crateMeshes.set(c, entry);
      } else if (template && entry.group.children.some(ch => ch.userData.__powerBoxPlaceholder)) {
        entry.yHeight = upgradePowerBoxPlaceholder(entry.group, template, target);
      }
      // Положение: позиция XZ — центр клетки crate; HP-бар — над верхом модели.
      const cx = c.x + c.w / 2;
      const cz = c.y + c.h / 2;
      const shake = getCrateShakeOffset(c);
      entry.group.position.set(cx + shake.ox, 0, cz + shake.oy);
      entry.hpSprite.position.set(cx + shake.ox, entry.yHeight + 14, cz + shake.oy);

      // Перерисовываем canvas HP только когда hp меняется (≈один раз/удар).
      if (entry.lastHp !== c.hp) {
        paintHpBarCanvas(entry.hpCanvas, c.hp, c.maxHp);
        entry.hpTexture.needsUpdate = true;
        entry.lastHp = c.hp;
      }
    }
  }

  // Удаляем меши для разрушенных или исчезнувших crates.
  for (const [c, entry] of crateMeshes) {
    if (alive.has(c)) continue;
    scene.remove(entry.group);
    scene.remove(entry.hpSprite);
    entry.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      // Материалы шарятся между clone'ами шаблона — НЕ диспозим.
    });
    entry.hpTexture.dispose();
    (entry.hpSprite.material as THREE.Material).dispose();
    crateMeshes.delete(c);
  }
}

const TREE_RADIUS = 34;

function syncSilvenLifeTrees(viewerTeam?: string): void {
  if (!scene) return;

  const template = getTileGLBTemplate(TileType.TREE);
  const alive = new Set<string>();
  const list = getSilvenLifeTrees();

  if (template) {
    for (const tree of list) {
      alive.add(tree.id);
      let entry = silvenTreeMeshes.get(tree.id);
      if (!entry) {
        const group = new THREE.Group();
        const targetXZ = TREE_RADIUS * 2.1;
        const yHeight = buildNormalizedInstance(template, targetXZ, group);

        const healFillGeo = new THREE.CircleGeometry(tree.healRadius, 48);
        const healFillMat = new THREE.MeshBasicMaterial({
          color: 0x81c784,
          transparent: true,
          opacity: 0.16,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const healFill = new THREE.Mesh(healFillGeo, healFillMat);
        healFill.rotation.x = -Math.PI / 2;
        healFill.position.y = 0.35;
        scene.add(healFill);

        const healRingGeo = new THREE.RingGeometry(tree.healRadius * 0.88, tree.healRadius, 48);
        const healRingMat = new THREE.MeshBasicMaterial({
          color: 0xaed581,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const healRing = new THREE.Mesh(healRingGeo, healRingMat);
        healRing.rotation.x = -Math.PI / 2;
        healRing.position.y = 0.45;
        scene.add(healRing);

        const hpCanvas = document.createElement("canvas");
        hpCanvas.width = 256;
        hpCanvas.height = 48;
        const hpTexture = new THREE.CanvasTexture(hpCanvas);
        hpTexture.colorSpace = THREE.SRGBColorSpace;
        const hpMat = new THREE.SpriteMaterial({
          map: hpTexture,
          transparent: true,
          depthWrite: false,
          depthTest: false,
        });
        const hpSprite = new THREE.Sprite(hpMat);
        const spriteW = TREE_RADIUS * 2.8;
        const spriteH = spriteW * (hpCanvas.height / hpCanvas.width);
        hpSprite.scale.set(spriteW, spriteH, 1);
        hpSprite.renderOrder = 100;
        scene.add(hpSprite);

        scene.add(group);
        entry = {
          group,
          healRing,
          healFill,
          hpSprite,
          hpCanvas,
          hpTexture,
          lastHp: -1,
          lastHostile: false,
          yHeight,
        };
        silvenTreeMeshes.set(tree.id, entry);
      }

      entry.group.position.set(tree.x, 0, tree.y);
      entry.healFill.position.set(tree.x, entry.healFill.position.y, tree.y);
      entry.healRing.position.set(tree.x, entry.healRing.position.y, tree.y);
      entry.hpSprite.position.set(tree.x, entry.yHeight + 14, tree.y);

      const hostile = viewerTeam !== undefined && tree.ownerTeam !== viewerTeam;
      if (entry.lastHp !== tree.hp || entry.lastHostile !== hostile) {
        paintHpBarCanvas(entry.hpCanvas, tree.hp, tree.maxHp, hostile);
        entry.hpTexture.needsUpdate = true;
        entry.lastHp = tree.hp;
        entry.lastHostile = hostile;
      }
    }
  }

  for (const [id, entry] of silvenTreeMeshes) {
    if (alive.has(id)) continue;
    scene.remove(entry.group);
    scene.remove(entry.healRing);
    scene.remove(entry.healFill);
    scene.remove(entry.hpSprite);
    entry.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
    });
    entry.healRing.geometry.dispose();
    (entry.healRing.material as THREE.Material).dispose();
    entry.healFill.geometry.dispose();
    (entry.healFill.material as THREE.Material).dispose();
    entry.hpTexture.dispose();
    (entry.hpSprite.material as THREE.Material).dispose();
    silvenTreeMeshes.delete(id);
  }
}

/**
 * Синхронизирует 3D-меши выпавших банок усиления (power_jar) с массивом drops,
 * пришедшим из ClashShowdown / ClashMega.
 *
 * Правила отображения:
 *   • банка стоит на земле (низ на y=0) с НАКЛОНОМ 15° вокруг X — лёгкий
 *     «завал», как у Brawl Stars;
 *   • банка КРУТИТСЯ вокруг своей собственной вертикальной оси (мировая Y),
 *     ~30°/сек, благодаря чему видны разные стороны модели и этикетка
 *     «проплывает» по кругу — никакого «часовых стрелок».
 *
 * Для разделения этих двух вращений используется иерархия:
 *   pivot (rotation.y = spin) → tiltGroup (rotation.x = 15°) → модель
 * Так Y-вращение происходит относительно МИРОВОЙ вертикали, а tilt — это
 * статичный наклон модели внутри pivot.
 */
function syncPowerJars(drops: PowerJarDrop[] | undefined, dt: number): void {
  if (!scene) return;

  if (!jarTemplateRequested) {
    jarTemplateRequested = true;
    void loadPowerJarGLBTemplate();
  }

  const template = getPowerJarGLBTemplate();
  // Скорость вращения: ~36°/сек (полный оборот за 10 сек) — приятный темп,
  // не дрезжит и не «гипнотизирует».
  jarFrameCounter += dt;
  const spin = (jarFrameCounter * 0.6) % (Math.PI * 2);

  const alive = new Set<number>();
  if (drops && template) {
    for (const d of drops) {
      const jarId = resolvePowerJarId(d);
      if (jarId == null) continue;
      alive.add(jarId);
      let entry = jarMeshes.get(jarId);
      if (!entry) {
        const pivot = new THREE.Group();
        const tiltGroup = new THREE.Group();
        tiltGroup.rotation.x = (15 * Math.PI) / 180;
        // Целевой размер банки в мире: ~1.1 × drop.radius (drop.radius = 14–16 px).
        const targetXZ = d.radius * 1.1;
        buildNormalizedInstance(template, targetXZ, tiltGroup);
        pivot.add(tiltGroup);
        const glow = createJarGroundGlow(d.radius * 1.1);
        scene.add(pivot);
        scene.add(glow);
        const spawnX = d.spawnX ?? d.x;
        const spawnZ = d.spawnY ?? d.y;
        const landX = d.x;
        const landZ = d.y;
        entry = {
          pivot,
          glow,
          landX,
          landZ,
          spawnX,
          spawnZ,
          animT: 0,
          landed: false,
        };
        jarMeshes.set(jarId, entry);
      }

      if (!entry.landed) {
        entry.animT = Math.min(1, entry.animT + dt / JAR_DROP_DURATION);
        const t = easeOutCubic(entry.animT);
        const hop = Math.sin(t * Math.PI) * 32;
        const dx = entry.landX - entry.spawnX;
        const dz = entry.landZ - entry.spawnZ;
        const dist = Math.hypot(dx, dz) || 1;
        const sideX = (-dz / dist) * Math.min(18, dist * 0.35);
        const sideZ = (dx / dist) * Math.min(18, dist * 0.35);
        const px = entry.spawnX + dx * t + sideX * (1 - t);
        const pz = entry.spawnZ + dz * t + sideZ * (1 - t);
        entry.pivot.position.set(px, hop * (1 - t * 0.9) + 2, pz);
        if (entry.animT >= 1) {
          entry.landed = true;
          entry.pivot.position.set(entry.landX, 2, entry.landZ);
        }
      } else {
        entry.pivot.position.set(entry.landX, 2, entry.landZ);
      }
      entry.pivot.rotation.y = entry.landed ? spin : spin * entry.animT;
      entry.glow.position.set(entry.pivot.position.x, 0.25, entry.pivot.position.z);
    }
  }

  for (const [jarId, entry] of jarMeshes) {
    if (alive.has(jarId)) continue;
    scene.remove(entry.pivot);
    scene.remove(entry.glow);
    entry.pivot.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
    });
    disposeJarGlow(entry.glow);
    jarMeshes.delete(jarId);
  }
}

export function tickAndRenderBattle3D(
  camX: number,
  camY: number,
  brawlers: Brawler[],
  dt: number,
  viewerTeam?: string,
  crates?: Crate[],
  powerJars?: PowerJarDrop[],
  safes?: readonly Battle3DSafe[],
  devMonsterHideVision = false,
): void {
  if (!active) return;
  if (!ensureRenderer() || !renderer || !scene || !camera) return;

  // Init may bail before the WebGL canvas is mounted; bootstrap world meshes here.
  ensureBattle3DWorldContent();

  // Камера следует за центром игровой камеры (camX/camY — top-left визибл-зоны).
  // Наклон камеры реализован сдвигом позиции вдоль +Z (за «спиной игрока» = юг),
  // вместе с lookAt(cx, 0, cy) это даёт CAM_TILT_DEG от вертикали.
  const cx = camX + currentCamW / 2;
  const cy = camY + currentCamH / 2;
  camera.position.set(cx, CAM_HEIGHT, cy + CAM_BACK_OFFSET);
  camera.lookAt(cx, 0, cy);
  if (directional) {
    // Направленный свет приходит «сверху-сзади-вправо», тени падают на «север-влево»,
    // примерно как в Brawl Stars. Источник + target таскаем под игровую камеру,
    // чтобы shadow-map 512×512 покрывал только видимую зону.
    directional.position.set(cx + 400, 1100, cy + 300);
    directional.target.position.set(cx, 0, cy);
    directional.target.updateMatrixWorld();
  }

  // Тайловую сетку перестраиваем только при новом разрушении (O(1) dirty flag).
  // Заодно перепечь BinbunGrass-поле — освободившиеся ячейки получат травинки.
  if (currentTileGrid) {
    const rev = currentTileGrid.destroyRevision ?? 0;
    if (rev !== lastDestroyRevision) {
      rebuildTilesFromGrid(currentTileGrid);
      rebuildGround();
      lastDestroyRevision = rev;
    }
  }

  // Союзники, СТОЯЩИЕ в кустах — источник «подсветки» соседних кустов
  // (себя+8 клеток вокруг). Используются и для перераспределения инстансов
  // кустов на opaque/translucent, и для определения видимости врагов в кустах.
  const friendliesInBush: FriendlyInfo[] = [];
  if (viewerTeam !== undefined) {
    for (const b of brawlers) {
      if (!b.alive) continue;
      const isFriendly = b.isPlayer || b.team === viewerTeam;
      if (!isFriendly || !b.inBush) continue;
      friendliesInBush.push({
        x: b.x,
        y: b.y,
        tx: Math.floor(b.x / CELL),
        ty: Math.floor(b.y / CELL),
        inBush: true,
      });
    }
  }

  const bushKey = friendlyBushKey(friendliesInBush);
  if (bushKey !== lastBushFriendlyKey) {
    lastBushFriendlyKey = bushKey;
    updateBushOpacity(friendliesInBush);
  }

  syncCrates(crates);
  syncBattle3DSafes(scene, safes, viewerTeam);
  syncSilvenLifeTrees(viewerTeam);
  applyTileShakes();
  syncPowerJars(powerJars, dt);

  const aliveIds = new Set<string>();
  for (const b of brawlers) {
    aliveIds.add(b.id);
    const entry = getOrCreateBrawlerMesh(b);
    if (!entry) continue;
    syncBrawlerEntry(entry, b, dt, viewerTeam, friendliesInBush);
  }
  pruneBrawlerMeshes(aliveIds);
  syncBattle3DPets(scene, brawlers, dt, viewerTeam, friendliesInBush);
  syncBattle3DVerdelettaShadows(scene, getVerdelettaShadows(), dt, viewerTeam);
  syncBattle3DDevMonsters(scene, getDevBattleMonsters(), dt, {
    tileGrid: currentTileGrid ?? undefined,
    blues: viewerTeam !== undefined
      ? brawlers.filter(b => b.alive && (b.isPlayer || b.team === viewerTeam))
      : undefined,
    monsterHideVision: devMonsterHideVision,
  });
  if (grassField) {
    updateBinbunGrassField(grassField, dt);
    // Pass up to 8 closest moving brawlers to the grass shader so blades bend
    // around them.
    const stompers: { x: number; z: number; radius: number }[] = [];
    let limit = 8;
    for (const b of brawlers) {
      if (limit <= 0) break;
      if (!b.alive) continue;
      stompers.push({ x: b.x, z: b.y, radius: 70 });
      limit--;
    }
    setBinbunGrassStompers(grassField, stompers);
  }

  // Refresh the shadow map every other frame (autoUpdate is off). Halves the
  // shadow pass cost in busy battles while staying visually identical.
  shadowFrameCounter = (shadowFrameCounter + 1) % 2;
  renderer.shadowMap.needsUpdate = shadowFrameCounter === 0;

  renderer.render(scene, camera);
}

/** Сброс motion-state 3D-мешей (перемотка replay). */
export function resetBattle3DBrawlerMotionState(): void {
  for (const entry of brawlerMeshes.values()) {
    entry.lastX = 0;
    entry.lastY = 0;
    entry.renderX = 0;
    entry.renderY = 0;
    entry.movingSmoothed = 0;
    entry.runLatch = false;
    entry.lastAnimChangeMs = 0;
  }
  resetBattle3DPetMotionState();
  resetBattle3DVerdelettaShadowMotionState();
  resetBattle3DDevMonsterMotionState();
}

export function disposeBattle3D(): void {
  battle3DInitGen++;
  battle3DSceneReady = false;
  battle3DTilesLoading = false;
  active = false;
  setTileCollisionFullCell(false);

  if (scene) {
    clearTileMeshes();
    for (const entry of brawlerMeshes.values()) {
      scene.remove(entry.pivot);
      if (entry.shadow) {
        scene.remove(entry.shadow);
        (entry.shadow.material as THREE.Material).dispose();
        entry.shadow.geometry.dispose();
      }
      if (entry.teamRing) {
        scene.remove(entry.teamRing);
        (entry.teamRing.material as THREE.Material).dispose();
        entry.teamRing.geometry.dispose();
      }
      entry.mixer.stopAllAction();
    }
    brawlerMeshes.clear();

    // Удаляем все 3D-меши power_box и их HP-бары.
    for (const entry of crateMeshes.values()) {
      scene.remove(entry.group);
      scene.remove(entry.hpSprite);
      entry.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      entry.hpTexture.dispose();
      (entry.hpSprite.material as THREE.Material).dispose();
    }
    crateMeshes.clear();
    crateTemplateRequested = false;

    // Удаляем все 3D-меши банок усиления.
    for (const entry of jarMeshes.values()) {
      scene.remove(entry.pivot);
      entry.pivot.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    }
    jarMeshes.clear();
    jarTemplateRequested = false;

    disposeBattle3DPets(scene);
    disposeBattle3DVerdelettaShadows(scene);
    disposeBattle3DDevMonsters(scene);
    disposeBattle3DSafes(scene);

    if (grassField) {
      disposeBinbunGrassField(grassField);
      grassField = null;
    }
    grassBuildGen++;
  }

  if (renderer) {
    try { renderer.dispose(); } catch { /* ignore */ }
    renderer = null;
  }
  scene = null;
  camera = null;
  directional = null;
  ambient = null;
  currentTileGrid = null;
}

/** Expand ortho frustum to match canvas aspect — no side letterboxing on wide screens. */
function applyCameraFrustum(): void {
  if (!camera || currentCamW <= 0 || currentCamH <= 0) return;
  const canvasAspect = currentCanvasCssW / Math.max(1, currentCanvasCssH);
  const baseAspect = currentCamW / currentCamH;
  let viewW = currentCamW;
  let viewH = currentCamH;
  if (canvasAspect > baseAspect) {
    viewW = currentCamH * canvasAspect;
  } else if (canvasAspect < baseAspect) {
    viewH = currentCamW / canvasAspect;
  }
  effectiveViewW = viewW;
  effectiveViewH = viewH;
  camera.left = -viewW / 2;
  camera.right = viewW / 2;
  camera.top = (viewH / 2) * CAM_TILT_COS;
  camera.bottom = -(viewH / 2) * CAM_TILT_COS;
  camera.updateProjectionMatrix();
}

/** Visible world size after aspect-fill (for camera clamp + 2D overlay alignment). */
export function getBattle3DViewSize(): { w: number; h: number } {
  return {
    w: effectiveViewW > 0 ? effectiveViewW : currentCamW,
    h: effectiveViewH > 0 ? effectiveViewH : currentCamH,
  };
}

/** 3D camera + canvas size for projecting motion-trail particles onto the 2D overlay. */
export function getBattle3DTrailProjection(): import("./motionTrailSystem").TrailRenderCamera | null {
  if (!active || !camera || !renderer) return null;
  const { w, h } = getBattle3DViewSize();
  const canvasW = w > 0 ? w : currentCamW;
  const canvasH = h > 0 ? h : currentCamH;
  if (canvasW <= 0 || canvasH <= 0) return null;
  return {
    camera,
    canvasW,
    canvasH,
  };
}

/** При смене размера canvas (адаптив) обновить буфер и frustum. */
export function resizeBattle3D(cssW: number, cssH: number): void {
  if (!renderer) return;
  currentCanvasCssW = cssW;
  currentCanvasCssH = cssH;
  renderer.setSize(cssW, cssH, false);
  applyCameraFrustum();
}

registerWebGLCleanup(() => {
  for (const [id, entry] of brawlerMeshes) {
    removeBrawlerMeshEntry(id, entry);
  }
});
