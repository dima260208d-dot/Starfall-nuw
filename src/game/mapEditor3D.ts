/**
 * 3D-рендер конструктора карт.
 *
 * Полный аналог `battle3DWorld.ts`, но для редактора:
 *   • Те же модели тайлов (`tileModelCache`), тот же 3D-пол (`binbunGrass3D`),
 *     то же освещение, тот же наклон камеры — карта выглядит ровно так же,
 *     как в реальном бою.
 *   • Никаких бойцов, анимаций, разрушаемости — редактор статичный.
 *   • Логика «1 клетка = `zoom` CSS-пикселей, камера панорамирует камX/камY
 *     в editor-px» сохранена: 3D-камера настраивается так, что точка земли
 *     `(gx * CELL, gy * CELL)` проецируется на экран в тот же пиксель, что и
 *     2D-маппинг `(gx * zoom - camXedit + zoom/2, gy * zoom - camYedit + zoom/2)`.
 *     Это даёт возможность переиспользовать существующие screen↔grid формулы
 *     редактора без raycast'ов на каждое движение мышью.
 *
 * Поверх 3D-сцены остаются HTML/2D-элементы UI редактора (палитра, тулбар,
 * стрелки поворота для bones/fence) — их рисует React поверх canvas.
 */

import * as THREE from "three";
import { TileType, BATTLE_MAP_RIM_CELLS } from "./TileMap";
import {
  buildMergedFluidMeshes,
  WATER_FLUID_STYLE,
} from "./mergedFluidTiles";
import {
  getTileGLBTemplate,
  disposeTileBakerRenderer,
} from "../utils/tileModelCache";
import {
  createBinbunGrassField,
  disposeBinbunGrassField,
  loadBinbunGrassAssets,
  refreshBinbunGrassMask,
  BINBUN_GRASS_FALLBACK_COLOR,
  type BinbunGrassField,
  type BinbunGrassMask,
} from "./binbunGrass3D";
import { OV, type OVType } from "../utils/mapEditorAPI";
import { getPowerBoxGLBTemplate, loadPowerBoxGLBTemplate } from "../utils/powerModelCache";
import { getHeavyAssetBaseUrl } from "../lib/assetBase";

// ── Константы (синхронизированы с battle3DWorld) ────────────────────────────

const CELL = 50;
const TILE_FIT = 1.06;
const BUSH_XZ_OVERFILL = 1.30;
const FLOWERBED_XZ_OVERFILL = 1.28;

const CAM_TILT_DEG = 30;
const CAM_TILT_RAD = (CAM_TILT_DEG * Math.PI) / 180;
const CAM_TILT_COS = Math.cos(CAM_TILT_RAD);
const CAM_HEIGHT = 1500;
const CAM_BACK_OFFSET = CAM_HEIGHT * Math.tan(CAM_TILT_RAD);

// ── Module-level state ──────────────────────────────────────────────────────

let canvasEl: HTMLCanvasElement | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.OrthographicCamera | null = null;
let directional: THREE.DirectionalLight | null = null;
let ambient: THREE.AmbientLight | null = null;

let grassField: BinbunGrassField | null = null;
let grassBuildGen = 0;
let mapBorderLines: THREE.LineSegments | null = null;
let centerCrossLines: THREE.LineSegments | null = null;
let gridLines: THREE.LineSegments | null = null;

const tileInstancedMeshes: THREE.InstancedMesh[] = [];

interface OverlayMarker {
  mesh: THREE.Group;
}
const overlayMarkers: OverlayMarker[] = [];

let hoverGroup: THREE.Group | null = null;
let hoverRing: THREE.Mesh | null = null;
const mirrorRings: THREE.Mesh[] = [];
let fillSelMesh: THREE.Mesh | null = null;
let selHighlightGroup: THREE.Group | null = null;

let currentCanvasCssW = 800;
let currentCanvasCssH = 600;
let currentGS = 60;
let currentZoom = 14; // px-per-cell в editor space
let currentCamX = 0;   // top-left, editor pixels
let currentCamY = 0;

// ── Public API ──────────────────────────────────────────────────────────────

export function initEditor3D(canvas: HTMLCanvasElement): boolean {
  if (renderer && canvasEl === canvas) return true;
  canvasEl = canvas;
  try {
    // ВАЖНО: освобождаем оффскрин-рендер запекалки тайлов ДО создания нашего —
    // браузерный лимит ~8–16 WebGL-контекстов, и при «горячей» загрузке
    // редактора после сцены боя можно легко упереться.
    try { disposeTileBakerRenderer(); } catch { /* ignore */ }

    // В фоне начинаем подгружать сырой GLB power_box.glb — нужен для 3D
    // отображения маркера POWER_BOX в редакторе.
    void loadPowerBoxGLBTemplate();

    const r = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    r.setPixelRatio(window.devicePixelRatio || 1);
    r.setSize(currentCanvasCssW, currentCanvasCssH, false);
    r.setClearColor(0x0d0d1a, 1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    renderer = r;
  } catch (err) {
    console.warn("[mapEditor3D] WebGL renderer creation failed:", err);
    return false;
  }

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 6000);
  // Camera.up = (0, 0, -1) — север-вверх (game Y → world Z), как в battle3D.
  camera.up.set(0, 0, -1);

  // Свет: тот же набор, что в бою.
  ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0xfff1d6, 0x6a4d2e, 0.55);
  hemi.position.set(0, 1, 0);
  scene.add(hemi);

  directional = new THREE.DirectionalLight(0xfff5dc, 1.45);
  directional.position.set(400, 900, -300);
  directional.castShadow = true;
  const s = directional.shadow;
  s.mapSize.set(1024, 1024);
  // Frustum двигается под камерой в `applyEditorCamera`, тут только базовые границы.
  s.camera.left = -800;
  s.camera.right = 800;
  s.camera.top = 800;
  s.camera.bottom = -800;
  s.camera.near = 100;
  s.camera.far = 3000;
  s.bias = -0.0005;
  s.normalBias = 0.5;
  scene.add(directional);
  scene.add(directional.target);

  rebuildGround();
  const base: string = getHeavyAssetBaseUrl();
  void loadBinbunGrassAssets(base).catch((err) =>
    console.warn("[mapEditor3D] BinbunGrass atlas preload failed:", err),
  );

  return true;
}

export function disposeEditor3D(): void {
  clearTileMeshes();
  clearOverlayMarkers();
  clearHover();
  clearFillSel();
  clearCellHighlights();
  if (scene) {
    if (grassField) {
      disposeBinbunGrassField(grassField);
      grassField = null;
    }
    grassBuildGen++;
    editorGrassMaskCells = null;
    if (mapBorderLines) {
      scene.remove(mapBorderLines);
      (mapBorderLines.material as THREE.Material).dispose();
      mapBorderLines.geometry.dispose();
      mapBorderLines = null;
    }
    if (centerCrossLines) {
      scene.remove(centerCrossLines);
      (centerCrossLines.material as THREE.Material).dispose();
      centerCrossLines.geometry.dispose();
      centerCrossLines = null;
    }
    if (gridLines) {
      scene.remove(gridLines);
      (gridLines.material as THREE.Material).dispose();
      gridLines.geometry.dispose();
      gridLines = null;
    }
  }
  if (renderer) {
    try { renderer.dispose(); } catch { /* ignore */ }
    renderer = null;
  }
  scene = null;
  camera = null;
  directional = null;
  ambient = null;
  canvasEl = null;
}

export function setEditorCanvasSize(cssW: number, cssH: number): void {
  currentCanvasCssW = cssW;
  currentCanvasCssH = cssH;
  if (renderer) renderer.setSize(cssW, cssH, false);
}

export function setEditorCamera(camX: number, camY: number, zoom: number): void {
  currentCamX = camX;
  currentCamY = camY;
  currentZoom = zoom;
}

export function setEditorGridSize(gs: number): void {
  if (gs === currentGS) return;
  currentGS = gs;
  rebuildMapBorder();
  rebuildCenterCross();
  rebuildGround();
}

/**
 * Полная пересборка тайлов и overlay'ев из массивов клеток.
 * Вызывается на каждое изменение содержимого карты (placement, erase, clear, etc.).
 * 3600 ячеек × ~10 типов → один rebuild укладывается в <20 мс на средней машине.
 */
export function rebuildEditorGrid(
  cells: number[],
  overlays: number[],
  rotations: number[],
  gs: number,
): void {
  if (gs !== currentGS) setEditorGridSize(gs);
  if (!scene) return;
  lastEditorCellsForMask = cells;
  refreshEditorGrassMask(cells);
  if (!mapBorderLines) rebuildMapBorder();
  if (!centerCrossLines) rebuildCenterCross();

  clearTileMeshes();
  clearOverlayMarkers();

  // Группируем клетки по типу (внутри — массив cells с rotation-метаданными).
  interface TileCell { tx: number; ty: number; rot: number; }
  const byType = new Map<number, TileCell[]>();
  for (let ty = 0; ty < gs; ty++) {
    for (let tx = 0; tx < gs; tx++) {
      const t = cells[ty * gs + tx];
      if (!t) continue;
      let arr = byType.get(t);
      if (!arr) { arr = []; byType.set(t, arr); }
      arr.push({ tx, ty, rot: rotations[ty * gs + tx] | 0 });
    }
  }
  for (const [type, list] of byType) {
    // ВОДА — собственный путь (см. `buildWaterMeshes` в battle3DWorld.ts):
    // соседние клетки сливаются в монолит, на внешних границах — обводка и
    // скруглённые углы. Точно та же логика, что в бою.
    if (type === TileType.WATER) {
      buildFluidMeshes(list, WATER_FLUID_STYLE);
    } else {
      buildInstancedTiles(type, list);
    }
  }

  // Overlay-маркеры: спавны, цели, кристалл, сейфы, бокс. Каждый — отдельный
  // mesh-group на земле (диск+иконка), сравнительно немного (десятки штук),
  // так что без InstancedMesh.
  for (let ty = 0; ty < gs; ty++) {
    for (let tx = 0; tx < gs; tx++) {
      const ov = overlays[ty * gs + tx];
      if (!ov) continue;
      addOverlayMarker(tx, ty, ov as OVType);
    }
  }
}

/**
 * Подсветка hover-клетки + клеток-зеркал. Дёшево — двигаем уже созданные mesh'и.
 */
export function setEditorHover(
  hov: { x: number; y: number } | null,
  mirrors: { x: number; y: number }[],
): void {
  if (!scene) return;
  if (!hov) {
    clearHover();
    return;
  }
  if (!hoverGroup) {
    hoverGroup = new THREE.Group();
    scene.add(hoverGroup);
  }
  if (!hoverRing) {
    const geom = new THREE.RingGeometry(CELL * 0.42, CELL * 0.49, 24);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    hoverRing = new THREE.Mesh(geom, mat);
    hoverRing.renderOrder = 5;
    hoverGroup.add(hoverRing);
  }
  hoverRing.position.set((hov.x + 0.5) * CELL, 1.0, (hov.y + 0.5) * CELL);

  // Mirror-кольца (жёлтые) — пул, расширяем по мере необходимости.
  while (mirrorRings.length < mirrors.length) {
    const geom = new THREE.RingGeometry(CELL * 0.42, CELL * 0.49, 24);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd54f,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geom, mat);
    m.renderOrder = 5;
    hoverGroup.add(m);
    mirrorRings.push(m);
  }
  for (let i = 0; i < mirrorRings.length; i++) {
    if (i < mirrors.length) {
      const p = mirrors[i];
      mirrorRings[i].visible = true;
      mirrorRings[i].position.set((p.x + 0.5) * CELL, 1.0, (p.y + 0.5) * CELL);
    } else {
      mirrorRings[i].visible = false;
    }
  }
}

/**
 * Прямоугольник заполнения (инструмент fill_rect). Передавайте null чтобы скрыть.
 */
export function setEditorFillSel(sel: { x0: number; y0: number; x1: number; y1: number } | null): void {
  if (!scene) return;
  if (!sel) {
    clearFillSel();
    return;
  }
  const x0 = Math.min(sel.x0, sel.x1);
  const x1 = Math.max(sel.x0, sel.x1);
  const y0 = Math.min(sel.y0, sel.y1);
  const y1 = Math.max(sel.y0, sel.y1);
  const w = (x1 - x0 + 1) * CELL;
  const h = (y1 - y0 + 1) * CELL;
  const cx = (x0 + (x1 - x0 + 1) / 2) * CELL;
  const cz = (y0 + (y1 - y0 + 1) / 2) * CELL;
  if (!fillSelMesh) {
    const geom = new THREE.PlaneGeometry(1, 1);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd54f,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    fillSelMesh = new THREE.Mesh(geom, mat);
    fillSelMesh.renderOrder = 4;
    scene.add(fillSelMesh);
  }
  fillSelMesh.position.set(cx, 0.8, cz);
  fillSelMesh.scale.set(w, 1, h);
  fillSelMesh.visible = true;
}

interface SelBox { w: number; h: number; d: number; cx: number; cy: number; cz: number; rotY: number; }

function clearCellHighlights(): void {
  if (!selHighlightGroup || !scene) return;
  scene.remove(selHighlightGroup);
  selHighlightGroup.traverse((o) => {
    const ls = o as THREE.LineSegments;
    if (ls.isLineSegments) {
      ls.geometry?.dispose();
      (ls.material as THREE.Material)?.dispose();
    }
  });
  selHighlightGroup = null;
}

function scalePrepForTile(type: number, prep: THREE.Object3D): void {
  const fit = tileFitParams(type);
  prep.rotation.copy(fit.rot);
  prep.updateMatrixWorld(true);
  const box0 = new THREE.Box3().setFromObject(prep);
  const size0 = box0.getSize(new THREE.Vector3());
  const maxXZ = Math.max(size0.x, size0.z) || 1;
  const maxY = size0.y || 1;
  if (type === TileType.BUSH) {
    const sXZ = (CELL * BUSH_XZ_OVERFILL) / maxXZ;
    const sY = (CELL * 0.9) / maxY;
    prep.scale.set(sXZ, sY, sXZ);
  } else if (type === TileType.FLOWERBED) {
    const sXZ = (CELL * FLOWERBED_XZ_OVERFILL) / maxXZ;
    const sY = (CELL * fit.vFactor) / maxY;
    prep.scale.set(sXZ, sY, sXZ);
  } else if (type === TileType.WALL || type === TileType.SAND_WALL) {
    const sX = (CELL * TILE_FIT) / (size0.x || 1);
    const sZ = (CELL * TILE_FIT) / (size0.z || 1);
    const sY = (CELL * fit.vFactor) / maxY;
    prep.scale.set(sX, sY, sZ);
  } else {
    const scaleByXZ = (CELL * TILE_FIT) / maxXZ;
    const scaleByY = (CELL * fit.vFactor) / maxY;
    prep.scale.setScalar(Math.min(scaleByXZ, scaleByY));
  }
  prep.updateMatrixWorld(true);
  const box1 = new THREE.Box3().setFromObject(prep);
  const c1 = box1.getCenter(new THREE.Vector3());
  prep.position.x = -c1.x;
  prep.position.z = -c1.z;
  prep.position.y = -box1.min.y;
  prep.updateMatrixWorld(true);
}

function getTileSelBox(tx: number, ty: number, type: number, rot: number): SelBox | null {
  if (type === 0) return null;
  if (type === TileType.WATER) {
    return {
      w: CELL * 0.96, h: CELL * 0.35, d: CELL * 0.96,
      cx: (tx + 0.5) * CELL, cy: CELL * 0.175, cz: (ty + 0.5) * CELL, rotY: 0,
    };
  }
  const template = getTileGLBTemplate(type);
  if (!template) {
    return {
      w: CELL * 0.95, h: CELL * 0.95, d: CELL * 0.95,
      cx: (tx + 0.5) * CELL, cy: CELL * 0.475, cz: (ty + 0.5) * CELL, rotY: 0,
    };
  }
  const prep = template.clone(true);
  scalePrepForTile(type, prep);
  const sz = new THREE.Box3().setFromObject(prep).getSize(new THREE.Vector3());
  let rotY = 0;
  const isLineTile = type === TileType.DECORATION || type === TileType.FENCE;
  const isRotTile = type === TileType.WALL || type === TileType.SAND_WALL;
  if (isLineTile && rot === 1) rotY = Math.PI / 2;
  else if (isRotTile) rotY = ((rot & 3) * Math.PI) / 2;
  return {
    w: sz.x, h: sz.y, d: sz.z,
    cx: (tx + 0.5) * CELL, cy: sz.y / 2, cz: (ty + 0.5) * CELL, rotY,
  };
}

function getOvSelBox(tx: number, ty: number): SelBox {
  const r = CELL * 0.44;
  return {
    w: r * 2, h: 14, d: r * 2,
    cx: (tx + 0.5) * CELL, cy: 7, cz: (ty + 0.5) * CELL, rotY: 0,
  };
}

function addWireBox(group: THREE.Group, box: SelBox, color: number, opacity: number): void {
  const geom = new THREE.BoxGeometry(box.w, box.h, box.d);
  const edges = new THREE.EdgesGeometry(geom);
  geom.dispose();
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: true });
  const lines = new THREE.LineSegments(edges, mat);
  lines.position.set(box.cx, box.cy, box.cz);
  lines.rotation.y = box.rotY;
  lines.renderOrder = 12;
  group.add(lines);
}

/**
 * 3D-контур по граням блока/оверлея. Пустая трава — null (HTML-подсветка клетки).
 */
export function setEditorCellHighlights(params: {
  hover: { x: number; y: number } | null;
  fixed: { x: number; y: number } | null;
  cells: number[];
  overlays: number[];
  rotations: number[];
  gs: number;
}): void {
  if (!scene) return;
  clearCellHighlights();
  const { hover, fixed, cells, overlays, rotations, gs } = params;

  const addCell = (cell: { x: number; y: number }, color: number, opacity: number) => {
    const i = cell.y * gs + cell.x;
    const tile = cells[i];
    const ov = overlays[i];
    const rot = rotations[i] | 0;
    if (tile === 0 && ov === 0) return;
    const box = ov !== 0
      ? getOvSelBox(cell.x, cell.y)
      : getTileSelBox(cell.x, cell.y, tile, rot);
    if (!box) return;
    if (!selHighlightGroup) selHighlightGroup = new THREE.Group();
    addWireBox(selHighlightGroup, box, color, opacity);
  };

  if (hover && (!fixed || hover.x !== fixed.x || hover.y !== fixed.y)) {
    addCell(hover, 0xffffff, 0.88);
  }
  if (fixed) addCell(fixed, 0x81c784, 0.96);

  if (selHighlightGroup && selHighlightGroup.children.length > 0) {
    scene.add(selHighlightGroup);
  } else {
    clearCellHighlights();
  }
}

/**
 * Финальный рендер кадра — обновляет камеру и shadow-frustum под текущие
 * camX/camY/zoom, затем `renderer.render`. Идемпотентный, вызывать столько раз
 * сколько нужно (на каждый redraw редактора).
 */
export function renderEditor3D(): void {
  if (!renderer || !scene || !camera) return;
  applyEditorCamera();
  renderer.render(scene, camera);
}

// ── Внутренняя реализация ───────────────────────────────────────────────────

function applyEditorCamera(): void {
  if (!camera) return;
  // Преобразование «editor-px → world-px»: 1 cell = currentZoom editor-px = CELL world-px.
  const editorToWorld = CELL / currentZoom;
  const worldViewW = currentCanvasCssW * editorToWorld;
  const worldViewH = currentCanvasCssH * editorToWorld;
  const cx = (currentCamX + currentCanvasCssW / 2) * editorToWorld;
  const cy = (currentCamY + currentCanvasCssH / 2) * editorToWorld;

  // Frustum — как в battle3D: горизонтально совпадает с видимым world-окном,
  // вертикально сжат на cos(θ), чтобы наклонённая ортокамера проецировала
  // точки земли (y=0) в те же экранные пиксели, что и 2D-маппинг.
  camera.left = -worldViewW / 2;
  camera.right = worldViewW / 2;
  camera.top = (worldViewH / 2) * CAM_TILT_COS;
  camera.bottom = -(worldViewH / 2) * CAM_TILT_COS;
  camera.near = 1;
  camera.far = 6000;
  camera.position.set(cx, CAM_HEIGHT, cy + CAM_BACK_OFFSET);
  camera.lookAt(cx, 0, cy);
  camera.updateProjectionMatrix();

  if (directional) {
    // Двигаем shadow-target за центром камеры, чтобы shadow-map покрывала
    // именно видимую зону. Frustum расширяем под текущий зум, чтобы тени
    // были чёткими и не «прыгали» при панорамировании.
    directional.position.set(cx + 400, 1100, cy + 300);
    directional.target.position.set(cx, 0, cy);
    directional.target.updateMatrixWorld();
    const halfW = Math.max(worldViewW, worldViewH) / 2 + CELL * 4;
    const s = directional.shadow;
    s.camera.left = -halfW;
    s.camera.right = halfW;
    s.camera.top = halfW;
    s.camera.bottom = -halfW;
    s.camera.updateProjectionMatrix();
  }
}

function clearTileMeshes(): void {
  if (!scene) return;
  for (const inst of tileInstancedMeshes) {
    scene.remove(inst);
    // Геометрия/материал — из GLB-шаблона, не диспозим.
  }
  tileInstancedMeshes.length = 0;

  for (const m of waterMeshes) {
    scene.remove(m);
    m.geometry.dispose();
  }
  waterMeshes.length = 0;
}

/** Per-cell water-меши (см. `buildWaterMeshes`) — собственная ShapeGeometry. */
const waterMeshes: THREE.Mesh[] = [];

function clearOverlayMarkers(): void {
  if (!scene) return;
  for (const om of overlayMarkers) {
    scene.remove(om.mesh);
    om.mesh.traverse((o) => {
      const mm = o as THREE.Mesh;
      if (mm.isMesh) {
        if (mm.geometry) mm.geometry.dispose();
        const mat = mm.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) for (const m of mat) m.dispose();
        else if (mat) mat.dispose();
      }
    });
  }
  overlayMarkers.length = 0;
}

function clearHover(): void {
  if (!scene || !hoverGroup) return;
  scene.remove(hoverGroup);
  hoverGroup.traverse((o) => {
    const mm = o as THREE.Mesh;
    if (mm.isMesh) {
      mm.geometry?.dispose();
      const mat = mm.material as THREE.Material;
      mat?.dispose();
    }
  });
  hoverGroup = null;
  hoverRing = null;
  mirrorRings.length = 0;
}

function clearFillSel(): void {
  if (!scene || !fillSelMesh) return;
  scene.remove(fillSelMesh);
  fillSelMesh.geometry.dispose();
  (fillSelMesh.material as THREE.Material).dispose();
  fillSelMesh = null;
}

let lastEditorCellsForMask: number[] | null = null;
let editorGrassMaskCells: Uint8Array | null = null;

function editorGrassMask(cells: number[]): BinbunGrassMask {
  if (!editorGrassMaskCells || editorGrassMaskCells.length !== cells.length) {
    editorGrassMaskCells = new Uint8Array(cells.length);
  }
  editorGrassMaskCells.set(cells);
  return {
    cells: editorGrassMaskCells,
    width: currentGS,
    height: currentGS,
    cellSize: CELL,
    grassTileType: TileType.GRASS,
    originX: 0,
    originZ: 0,
  };
}

/** Обновляет маску травинок: под блоками (не grass) blades не рисуются — как в бою. */
function refreshEditorGrassMask(cells: number[]): void {
  if (!scene) return;
  const W = currentGS * CELL;
  const H = currentGS * CELL;
  const mask = editorGrassMask(cells);
  if (grassField?.uniforms.uAtlas?.value) {
    refreshBinbunGrassMask(grassField, W, H, 0, mask);
    return;
  }
  lastEditorCellsForMask = cells;
  rebuildGround();
}

function rebuildGround(): void {
  if (!scene) return;
  const gen = ++grassBuildGen;
  if (grassField) {
    disposeBinbunGrassField(grassField);
    grassField = null;
  }

  const W = currentGS * CELL;
  const H = currentGS * CELL;
  const base: string = getHeavyAssetBaseUrl();

  const mask = lastEditorCellsForMask
    ? editorGrassMask(lastEditorCellsForMask)
    : null;

  void createBinbunGrassField(W, H, 0, { baseUrl: base, mask, groundChunks: 20 })
    .then((field) => {
      if (!scene || gen !== grassBuildGen) {
        disposeBinbunGrassField(field);
        return;
      }
      grassField = field;
      scene.add(field.root);
    })
    .catch((err) => {
      console.warn("[mapEditor3D] BinbunGrass field build failed:", err);
      if (!scene || gen !== grassBuildGen) return;
      const geom = new THREE.PlaneGeometry(W, H);
      geom.rotateX(-Math.PI / 2);
      const fallback = new THREE.Mesh(
        geom,
        new THREE.MeshLambertMaterial({ color: BINBUN_GRASS_FALLBACK_COLOR }),
      );
      fallback.position.set(W / 2, 0, H / 2);
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
    });
}

function rebuildMapBorder(): void {
  if (!scene) return;
  if (mapBorderLines) {
    scene.remove(mapBorderLines);
    (mapBorderLines.material as THREE.Material).dispose();
    mapBorderLines.geometry.dispose();
  }
  const W = currentGS * CELL;
  const r = BATTLE_MAP_RIM_CELLS * CELL;
  const verts: number[] = [];
  // Рамка playable-зоны — совпадает с paintMountainBorderRing в бою.
  verts.push(r, 0.35, r,       W - r, 0.35, r);
  verts.push(W - r, 0.35, r,   W - r, 0.35, W - r);
  verts.push(W - r, 0.35, W - r, r, 0.35, W - r);
  verts.push(r, 0.35, W - r,   r, 0.35, r);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.35 });
  mapBorderLines = new THREE.LineSegments(geom, mat);
  scene.add(mapBorderLines);
}

function rebuildCenterCross(): void {
  if (!scene) return;
  if (centerCrossLines) {
    scene.remove(centerCrossLines);
    (centerCrossLines.material as THREE.Material).dispose();
    centerCrossLines.geometry.dispose();
  }
  const W = currentGS * CELL;
  const half = (currentGS / 2) * CELL;
  const verts: number[] = [];
  verts.push(half, 0.4, 0,  half, 0.4, W);
  verts.push(0, 0.4, half,  W, 0.4, half);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.30 });
  centerCrossLines = new THREE.LineSegments(geom, mat);
  scene.add(centerCrossLines);
}

interface TileFit { rot: THREE.Euler; vFactor: number; }
function tileFitParams(type: number): TileFit {
  if (type === TileType.WATER) return { rot: new THREE.Euler(0, 0, 0), vFactor: 0.4 };
  if (type === TileType.FENCE) return { rot: new THREE.Euler(Math.PI / 2, 0, 0), vFactor: 1.6 };
  if (type === TileType.WOOD) return { rot: new THREE.Euler(), vFactor: 1.6 };
  if (type === TileType.CACTUS) return { rot: new THREE.Euler(), vFactor: 1.8 };
  if (type === TileType.TREE) return { rot: new THREE.Euler(), vFactor: 2.25 };
  if (type === TileType.FLOWERBED) return { rot: new THREE.Euler(), vFactor: 0.55 };
  if (type === TileType.BUSH) return { rot: new THREE.Euler(), vFactor: 1.2 };
  return { rot: new THREE.Euler(), vFactor: 1.2 };
}

function buildFluidMeshes(
  cells: { tx: number; ty: number; rot: number }[],
  style: typeof WATER_FLUID_STYLE,
): void {
  if (!scene || cells.length === 0) return;
  buildMergedFluidMeshes(scene, cells, CELL, style, waterMeshes, tileInstancedMeshes);
}

/**
 * Создаёт InstancedMesh-набор для одного типа тайла. Аналог
 * `buildInstancedTilesForType` из battle3DWorld, но без bushInstanceSet
 * (в редакторе кусты не «просвечиваются» — никаких бойцов нет) и с
 * учётом per-cell rotation для bones/fence (LINE_TILES).
 */
function buildInstancedTiles(type: number, cells: { tx: number; ty: number; rot: number }[]): void {
  if (!scene) return;
  const template = getTileGLBTemplate(type);
  if (!template) return;
  const fit = tileFitParams(type);

  const prep = template.clone(true);
  prep.rotation.copy(fit.rot);
  prep.updateMatrixWorld(true);
  const box0 = new THREE.Box3().setFromObject(prep);
  const size0 = box0.getSize(new THREE.Vector3());
  const maxXZ = Math.max(size0.x, size0.z) || 1;
  const maxY = size0.y || 1;
  if (type === TileType.BUSH) {
    const sXZ = (CELL * BUSH_XZ_OVERFILL) / maxXZ;
    const sY = (CELL * 0.9) / maxY;
    prep.scale.set(sXZ, sY, sXZ);
  } else if (type === TileType.FLOWERBED) {
    const sXZ = (CELL * FLOWERBED_XZ_OVERFILL) / maxXZ;
    const sY = (CELL * fit.vFactor) / maxY;
    prep.scale.set(sXZ, sY, sXZ);
  } else if (type === TileType.WALL || type === TileType.SAND_WALL) {
    // Стены — независимый scale по X и Z, чтобы поворот на 90° не оставлял
    // зазоров между перпендикулярными блоками (см. длинный комментарий в
    // battle3DWorld.ts → buildInstancedTilesForType).
    const sX = (CELL * TILE_FIT) / (size0.x || 1);
    const sZ = (CELL * TILE_FIT) / (size0.z || 1);
    const sY = (CELL * fit.vFactor) / maxY;
    prep.scale.set(sX, sY, sZ);
  } else {
    const scaleByXZ = (CELL * TILE_FIT) / maxXZ;
    const scaleByY = (CELL * fit.vFactor) / maxY;
    prep.scale.setScalar(Math.min(scaleByXZ, scaleByY));
  }
  prep.updateMatrixWorld(true);

  const box1 = new THREE.Box3().setFromObject(prep);
  const c1 = box1.getCenter(new THREE.Vector3());
  prep.position.x = -c1.x;
  prep.position.z = -c1.z;
  prep.position.y = -box1.min.y;
  prep.updateMatrixWorld(true);

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

  // Per-cell вращение вокруг Y:
  //   • LINE_TILE (bones=5, fence=6): rot=0 → 0°, rot=1 → 90°  (направление линии)
  //   • ROT_TILE  (wall=1, sand_wall=11): rot ∈ {0,1,2,3} → 0/90/180/270°
  // Остальные типы — ротация игнорируется.
  const isLineTile = type === TileType.DECORATION || type === TileType.FENCE;
  const isRotTile  = type === TileType.WALL || type === TileType.SAND_WALL;

  const dummy = new THREE.Object3D();
  const tmp = new THREE.Matrix4();
  for (const node of meshNodes) {
    const inst = new THREE.InstancedMesh(node.geometry, node.material, cells.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.frustumCulled = false;
    for (let i = 0; i < cells.length; i++) {
      const { tx, ty, rot } = cells[i];
      let yRot = 0;
      if (isLineTile && rot === 1) yRot = Math.PI / 2;
      else if (isRotTile) yRot = ((rot & 3) * Math.PI) / 2;
      dummy.position.set((tx + 0.5) * CELL, 0, (ty + 0.5) * CELL);
      dummy.rotation.set(0, yRot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tmp.multiplyMatrices(dummy.matrix, node.matrix);
      inst.setMatrixAt(i, tmp);
    }
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
    tileInstancedMeshes.push(inst);
  }
}

// ── Overlay markers ─────────────────────────────────────────────────────────

// Кеш текстур-иконок (один canvas-spr на тип overlay'я) — переиспользуется
// между маркерами, не плодим текстуры на каждую клетку.
const overlayTexCache = new Map<number, THREE.Texture>();

interface OverlayStyle { color: number; icon: string; }
function overlayStyle(ov: OVType): OverlayStyle {
  switch (ov) {
    case OV.SPAWN_SD:   return { color: 0xff9800, icon: "🔶" };
    case OV.SPAWN_BLUE: return { color: 0x1976d2, icon: "🔵" };
    case OV.SPAWN_RED:  return { color: 0xd32f2f, icon: "🔴" };
    case OV.GEM_CENTER: return { color: 0x9c27b0, icon: "💎" };
    case OV.SAFE_BLUE:  return { color: 0x0288d1, icon: "🔐" };
    case OV.SAFE_RED:   return { color: 0xc62828, icon: "🔐" };
    case OV.BASE_BLUE:  return { color: 0x0277bd, icon: "🏰" };
    case OV.BASE_RED:   return { color: 0xb71c1c, icon: "🏰" };
    case OV.GOAL_BLUE:  return { color: 0x0288d1, icon: "⚽" };
    case OV.GOAL_RED:   return { color: 0xc62828, icon: "⚽" };
    case OV.POWER_BOX:  return { color: 0x7b2fbe, icon: "📦" };
    case OV.BOSS_SPAWN: return { color: 0xff1744, icon: "👹" };
    default:            return { color: 0xffffff, icon: "?" };
  }
}

function getOrCreateOverlayIconTexture(ov: OVType): THREE.Texture | null {
  const cached = overlayTexCache.get(ov);
  if (cached) return cached;
  const style = overlayStyle(ov);
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  ctx.font = `${Math.floor(size * 0.7)}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 8;
  ctx.fillText(style.icon, size / 2, size / 2 + 4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  overlayTexCache.set(ov, tex);
  return tex;
}

function addOverlayMarker(tx: number, ty: number, ov: OVType): void {
  if (!scene) return;

  // POWER_BOX рендерим как НАСТОЯЩУЮ 3D-модель из power_box.glb (как в бою).
  // Если шаблон ещё не докачался — кладём временную «коробку» из BoxGeometry
  // и подменяем её на GLB по готовности. Никаких 2D-эмодзи поверх.
  if (ov === OV.POWER_BOX) {
    addPowerBox3DMarker(tx, ty);
    return;
  }

  // GOAL_BLUE / GOAL_RED — каркас футбольных ворот, чтобы редактор показывал
  // реальный размер. Ворота фиксированы (нельзя удалить), это просто визуал.
  if (ov === OV.GOAL_BLUE || ov === OV.GOAL_RED) {
    addGoalFrame3D(tx, ty, ov);
    return;
  }

  const style = overlayStyle(ov);
  const group = new THREE.Group();
  group.position.set((tx + 0.5) * CELL, 0, (ty + 0.5) * CELL);

  // Цветной диск на земле — «здесь маркер».
  const discGeom = new THREE.CircleGeometry(CELL * 0.42, 24);
  discGeom.rotateX(-Math.PI / 2);
  const discMat = new THREE.MeshBasicMaterial({
    color: style.color,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(discGeom, discMat);
  disc.position.y = 0.6;
  disc.renderOrder = 2;
  group.add(disc);

  // Кольцо вокруг диска — чтобы виден был и на фоне светлого пола.
  const ringGeom = new THREE.RingGeometry(CELL * 0.42, CELL * 0.48, 24);
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.position.y = 0.65;
  ring.renderOrder = 3;
  group.add(ring);

  // Sprite-иконка с emoji — всегда повернута лицом к камере.
  const iconTex = getOrCreateOverlayIconTexture(ov);
  if (iconTex) {
    const spriteMat = new THREE.SpriteMaterial({
      map: iconTex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(CELL * 0.7, CELL * 0.7, 1);
    sprite.position.y = CELL * 0.6;
    sprite.renderOrder = 10;
    group.add(sprite);
  }

  scene.add(group);
  overlayMarkers.push({ mesh: group });
}

/**
 * Каркас футбольных ворот: 2 штанги + перекладина + сетка-баннер цвета команды.
 *
 * Ширина ворот ≈ 3 клетки (как в реальной игре). Ориентация: ворота смотрят
 * «лицом» в центр карты (если клетка слева — открыты вправо, и наоборот).
 */
function addGoalFrame3D(tx: number, ty: number, ov: OVType): void {
  if (!scene) return;
  const color = ov === OV.GOAL_BLUE ? 0x1976d2 : 0xd32f2f;
  const facingLeft = tx >= 30; // ворота на правой половине открыты влево
  const halfMap = 30;

  const group = new THREE.Group();
  group.position.set((tx + 0.5) * CELL, 0, (ty + 0.5) * CELL);

  // Размеры (ворота 3 клетки в ширину, 1.6 клетки в высоту, 0.5 в глубину).
  const W = CELL * 3.0;        // вдоль оси Z (ширина створа)
  const H = CELL * 1.6;        // высота
  const D = CELL * 0.55;       // глубина (сетка)
  const POST = CELL * 0.18;    // толщина штанг

  // Штанги — две вертикальные.
  const postGeom = new THREE.BoxGeometry(POST, H, POST);
  const postMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
  const postL = new THREE.Mesh(postGeom, postMat);
  postL.position.set(0, H / 2, -W / 2 + POST / 2);
  postL.castShadow = true;
  group.add(postL);
  const postR = new THREE.Mesh(postGeom, postMat);
  postR.position.set(0, H / 2, W / 2 - POST / 2);
  postR.castShadow = true;
  group.add(postR);

  // Перекладина.
  const crossGeom = new THREE.BoxGeometry(POST, POST, W);
  const crossbar = new THREE.Mesh(crossGeom, postMat);
  crossbar.position.set(0, H - POST / 2, 0);
  crossbar.castShadow = true;
  group.add(crossbar);

  // Сетка — полупрозрачный «плед» цвета команды, висит сзади.
  const netMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const dir = facingLeft ? 1 : -1; // куда уходит сетка (от центра)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(D, W), netMat);
  back.rotation.y = Math.PI / 2;
  back.position.set(dir * D, H / 2, 0);
  group.add(back);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(D, W), netMat);
  top.rotation.x = -Math.PI / 2;
  top.position.set(dir * (D / 2), H - 0.1, 0);
  group.add(top);

  // Поворот: ширина створа должна идти ВДОЛЬ короткой стороны центра карты.
  // Если центр выше/ниже по Y — ворота развёрнуты на 90°.
  const dy = ty + 0.5 - halfMap;
  const dx = tx + 0.5 - halfMap;
  if (Math.abs(dy) > Math.abs(dx)) {
    group.rotation.y = Math.PI / 2; // ворота смотрят по оси Y (сверху/снизу)
  }

  scene.add(group);
  overlayMarkers.push({ mesh: group });
}

/**
 * Добавляет 3D-модель power_box.glb в позицию клетки (tx, ty).
 *
 * Если шаблон ещё не загружен — кладём временный кубик-плейсхолдер той же
 * формы, и подменяем его на настоящую модель, как только она будет готова
 * (повторно перерисовываем сцену через renderEditor3D()).
 */
function addPowerBox3DMarker(tx: number, ty: number): void {
  if (!scene) return;
  const group = new THREE.Group();
  group.position.set((tx + 0.5) * CELL, 0, (ty + 0.5) * CELL);

  const template = getPowerBoxGLBTemplate();
  if (template) {
    fillPowerBoxGroup(group, template);
  } else {
    // Плейсхолдер: яркий розовый куб со стороной ≈ 0.7 от клетки.
    const ph = new THREE.Mesh(
      new THREE.BoxGeometry(CELL * 0.6, CELL * 0.6, CELL * 0.6),
      new THREE.MeshLambertMaterial({ color: 0xc44ad6 }),
    );
    ph.position.y = CELL * 0.3;
    ph.castShadow = true;
    ph.receiveShadow = true;
    ph.userData.__powerBoxPlaceholder = true;
    group.add(ph);

    // Подгружаем модель и подменяем плейсхолдер.
    loadPowerBoxGLBTemplate().then((tpl) => {
      if (!tpl || !scene) return;
      // Если группу уже удалили из сцены (rebuild) — игнорируем.
      if (!group.parent) return;
      // Снимаем все плейсхолдер-меши.
      for (let i = group.children.length - 1; i >= 0; i--) {
        const ch = group.children[i];
        if (ch.userData.__powerBoxPlaceholder) {
          group.remove(ch);
          if ((ch as THREE.Mesh).geometry) (ch as THREE.Mesh).geometry.dispose();
        }
      }
      fillPowerBoxGroup(group, tpl);
      renderEditor3D();
    });
  }

  scene.add(group);
  overlayMarkers.push({ mesh: group });
}

/**
 * Клонирует power_box.glb шаблон и кладёт его внутрь группы:
 *   • XZ-центр модели — в (0, 0)
 *   • низ модели — на y = 0
 *   • максимальное XZ-измерение = ~0.85 × CELL (как в боевой сцене)
 *
 * Шаблон НЕ нормализован: позицию/масштаб целиком считаем здесь, чтобы
 * консистентно с battle3DWorld.buildNormalizedInstance.
 */
function fillPowerBoxGroup(group: THREE.Group, template: THREE.Object3D): void {
  const inst = template.clone(true);
  const box0 = new THREE.Box3().setFromObject(inst);
  const size0 = box0.getSize(new THREE.Vector3());
  const center0 = box0.getCenter(new THREE.Vector3());
  const maxXZ = Math.max(size0.x, size0.z) || 1;
  const targetXZ = CELL * 0.85;
  const s = targetXZ / maxXZ;
  inst.position.set(-center0.x * s, -box0.min.y * s, -center0.z * s);
  inst.scale.setScalar(s);
  inst.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
  });
  group.add(inst);
}
