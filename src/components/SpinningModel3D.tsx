/**
 * SpinningModel3D — uses a single shared WebGL renderer (singleton) to avoid
 * exceeding the browser's WebGL context limit (~16 contexts).
 *
 * Architecture:
 *  - One THREE.WebGLRenderer renders to an OffscreenCanvas
 *  - Each mounted icon registers itself; the shared loop renders each icon's
 *    scene into the renderer, then copies the result to the icon's 2D canvas
 *    via drawImage(renderer.domElement)
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { fixCharacterSkinnedMeshes } from "../utils/gltfSkinnedMeshFix";
import { applyCanvasBitmapDrawPolicy, applyGLTFTexturePolicy } from "../utils/texturePolicy";
import { registerWebGLCleanup } from "../utils/devWebGLRecovery";
import { resolveHeavyAssetUrl, alternateHeavyAssetUrl } from "../lib/assetBase";
import { loadGLTFFromUrl } from "../utils/glbFetchCache";

function resolveAssetUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return resolveHeavyAssetUrl(pathOrUrl.replace(/^\//, ""));
}

async function loadSpinningGltf(url: string): Promise<THREE.Group> {
  try {
    const gltf = await loadGLTFFromUrl(url);
    return normalizeGltfToGroup(gltf.scene);
  } catch (firstErr) {
    const alt = alternateHeavyAssetUrl(url);
    if (!alt) throw firstErr;
    const gltf = await loadGLTFFromUrl(alt);
    return normalizeGltfToGroup(gltf.scene);
  }
}

// ─── Shared renderer singleton ──────────────────────────────────────────────

const RENDER_SIZE = 128; // internal render resolution

let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedRafId = 0;

type IconEntry = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  group: THREE.Group | null;
  canvas2d: HTMLCanvasElement;
  size: number;
  rotSpeed: number;
};

const icons: Set<IconEntry> = new Set();

const spinningRemountListeners = new Set<() => void>();

function notifySpinningModelRemount(): void {
  for (const cb of spinningRemountListeners) {
    try { cb(); } catch { /* ignore */ }
  }
}

function subscribeSpinningModelRemount(cb: () => void): () => void {
  spinningRemountListeners.add(cb);
  return () => spinningRemountListeners.delete(cb);
}

const gltfCache = new Map<string, THREE.Group>();
const frozenSnapshotCache = new Map<string, string>();

export type FrozenSnapshotOpts = {
  modelPath: string;
  size: number;
  color?: string;
  ambientMult?: number;
  dirMult?: number;
  cameraPos?: [number, number, number];
  lookAtPos?: [number, number, number];
  /** Extra scale after bbox normalization (match visual size across GLBs). */
  modelScale?: number;
};

function frozenSnapshotKey(opts: FrozenSnapshotOpts): string {
  const [cx, cy, cz] = opts.cameraPos ?? [0, 0.6, 3];
  const [lx, ly, lz] = opts.lookAtPos ?? [0, 0.2, 0];
  return [
    opts.modelPath,
    opts.size,
    opts.ambientMult ?? 1,
    opts.dirMult ?? 1,
    opts.modelScale ?? 1,
    opts.color ?? "",
    cx, cy, cz,
    lx, ly, lz,
  ].join("|");
}

export function getFrozenSpinningModelSnapshot(opts: FrozenSnapshotOpts): string | null {
  return frozenSnapshotCache.get(frozenSnapshotKey(opts)) ?? null;
}

function loseRendererContext(renderer: THREE.WebGLRenderer): void {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
  } catch {
    /* ignore */
  }
}

function getRenderer(): THREE.WebGLRenderer | null {
  if (sharedRenderer) return sharedRenderer;
  try {
    sharedRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    sharedRenderer.setPixelRatio(1);
    sharedRenderer.setSize(RENDER_SIZE, RENDER_SIZE);
    sharedRenderer.setClearColor(0x000000, 0);
    sharedRenderer.shadowMap.enabled = false;
    sharedRenderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      disposeSpinningModelRendererGpuOnly();
      notifySpinningModelRemount();
    });
    return sharedRenderer;
  } catch {
    return null;
  }
}

function disposeSpinningModelRendererGpuOnly(): void {
  if (sharedRafId) {
    cancelAnimationFrame(sharedRafId);
    sharedRafId = 0;
  }
  icons.clear();
  if (sharedRenderer) {
    try {
      loseRendererContext(sharedRenderer);
      sharedRenderer.dispose();
    } catch {
      /* ignore */
    }
    sharedRenderer = null;
  }
}

export function disposeSpinningModelRenderer(): void {
  disposeSpinningModelRendererGpuOnly();
  gltfCache.clear();
  frozenSnapshotCache.clear();
}

function normalizeGltfToGroup(model: THREE.Object3D): THREE.Group {
  fixCharacterSkinnedMeshes(model);
  const renderer = getRenderer();
  if (renderer) applyGLTFTexturePolicy(model, renderer);
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

/** Preload a GLB into the shared icon cache (boot / recovery). */
export function preloadSpinningModelPath(pathOrUrl: string): Promise<void> {
  const url = resolveAssetUrl(pathOrUrl);
  if (gltfCache.has(url)) return Promise.resolve();
  return loadSpinningGltf(url)
    .then((group) => { gltfCache.set(url, group); })
    .catch(() => {});
}

registerWebGLCleanup(disposeSpinningModelRendererGpuOnly);

function startLoop() {
  if (sharedRafId) return;
  const loop = () => {
    sharedRafId = requestAnimationFrame(loop);
    const renderer = getRenderer();
    if (!renderer) return;
    for (const entry of icons) {
      if (entry.group) entry.group.rotation.y += entry.rotSpeed;
      renderer.setSize(RENDER_SIZE, RENDER_SIZE);
      renderer.render(entry.scene, entry.camera);
      const ctx = entry.canvas2d.getContext("2d");
      if (ctx) {
        applyCanvasBitmapDrawPolicy(ctx);
        ctx.clearRect(0, 0, entry.size, entry.size);
        ctx.drawImage(renderer.domElement, 0, 0, entry.size, entry.size);
      }
    }
  };
  loop();
}

function stopLoop() {
  if (icons.size === 0 && sharedRafId) {
    cancelAnimationFrame(sharedRafId);
    sharedRafId = 0;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  modelPath: string;
  size?: number;
  color?: string;
  ambientMult?: number;
  dirMult?: number;
  style?: React.CSSProperties;
  /** Optional camera position override (default [0, 0.6, 3]) */
  cameraPos?: [number, number, number];
  /** Optional lookAt target override (default [0, 0.2, 0]) */
  lookAtPos?: [number, number, number];
  /** Override rotation speed in radians/frame (default 0.025) */
  rotSpeed?: number;
  /** One static frame — no RAF loop (lists with many instances). */
  frozen?: boolean;
  /** Extra scale after bbox normalization (default 1). */
  modelScale?: number;
}

function renderEntryOnce(entry: IconEntry, snapshotKey?: string): void {
  const renderer = getRenderer();
  if (!renderer || !entry.group) return;
  // Guard the GL render: if the shared context was lost (e.g. too many icons
  // rendered at once on a very wide list), `render` can throw. Swallowing it
  // keeps the whole app from unmounting (blue screen); the remount listener
  // re-renders once the context recovers.
  try {
    renderer.setSize(RENDER_SIZE, RENDER_SIZE);
    renderer.render(entry.scene, entry.camera);
    const ctx = entry.canvas2d.getContext("2d");
    if (ctx) {
      applyCanvasBitmapDrawPolicy(ctx);
      ctx.clearRect(0, 0, entry.size, entry.size);
      ctx.drawImage(renderer.domElement, 0, 0, entry.size, entry.size);
      if (snapshotKey) {
        try {
          frozenSnapshotCache.set(snapshotKey, entry.canvas2d.toDataURL("image/png"));
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* GL context lost mid-render — skip this frame */
  }
}

/** Очередь — один WebGL-рендер за раз (параллельный prewarm ломал снимки). */
let snapshotPrewarmTail: Promise<void> = Promise.resolve();

function enqueueSnapshotPrewarm(task: () => Promise<void>): Promise<void> {
  const job = snapshotPrewarmTail
    .then(() => task())
    .catch(() => {});
  snapshotPrewarmTail = job;
  return job;
}

function buildFrozenScene(opts: FrozenSnapshotOpts): {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  group: THREE.Group;
} {
  const ambientMult = opts.ambientMult ?? 1;
  const dirMult = opts.dirMult ?? 1;
  const [cx, cy, cz] = opts.cameraPos ?? [0, 0.6, 3];
  const [lx, ly, lz] = opts.lookAtPos ?? [0, 0.2, 0];

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(cx, cy, cz);
  camera.lookAt(lx, ly, lz);

  scene.add(new THREE.AmbientLight(0xffffff, 1.8 * ambientMult));
  const dir = new THREE.DirectionalLight(0xffffff, 3.0 * dirMult);
  dir.position.set(2, 4, 3);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xffffff, 1.2 * dirMult);
  fill.position.set(-2, 1, 2);
  scene.add(fill);
  const back = new THREE.DirectionalLight(
    opts.color ? new THREE.Color(opts.color) : 0x8888ff,
    0.8 * dirMult,
  );
  back.position.set(-2, -1, -3);
  scene.add(back);

  const url = resolveAssetUrl(opts.modelPath);
  const group = gltfCache.has(url)
    ? cloneSkinned(gltfCache.get(url)!)
    : makeFallbackGroup(opts.modelPath, opts.color);
  const scale = opts.modelScale ?? 1;
  if (scale !== 1) group.scale.multiplyScalar(scale);
  scene.add(group);
  return { scene, camera, group };
}

/** Pre-render a static PNG snapshot (pass details, lists). */
export function prewarmFrozenSpinningModelSnapshot(opts: FrozenSnapshotOpts): Promise<void> {
  const key = frozenSnapshotKey(opts);
  if (frozenSnapshotCache.has(key)) return Promise.resolve();
  return enqueueSnapshotPrewarm(async () => {
    if (frozenSnapshotCache.has(key)) return;
    try {
      await preloadSpinningModelPath(opts.modelPath);
      if (frozenSnapshotCache.has(key)) return;
      const canvas = document.createElement("canvas");
      canvas.width = opts.size;
      canvas.height = opts.size;
      const { scene, camera, group } = buildFrozenScene(opts);
      const entry: IconEntry = {
        scene,
        camera,
        group,
        canvas2d: canvas,
        size: opts.size,
        rotSpeed: 0,
      };
      renderEntryOnce(entry, key);
    } catch {
      /* ignore — fallback canvas in ChestVisual */
    }
  });
}

function attachModelToEntry(
  entry: IconEntry,
  group: THREE.Group,
  frozen: boolean,
  snapshotKey?: string,
  modelScale = 1,
): void {
  if (modelScale !== 1) group.scale.multiplyScalar(modelScale);
  entry.group = group;
  entry.scene.add(group);
  if (frozen) {
    // Dedupe against the snapshot cache: many identical frozen icons (e.g. the
    // Star Pass / Trophy Road tracks) mount together. Without this every one of
    // them fires its own WebGL render on a wide screen, and the burst overloads
    // the single shared context. If another instance already produced this
    // snapshot, reuse it — the component switches to the cached <img> anyway.
    if (snapshotKey && frozenSnapshotCache.has(snapshotKey)) return;
    renderEntryOnce(entry, snapshotKey);
  }
}

function makeFallbackGroup(modelPath: string, color?: string): THREE.Group {
  const c = color ? new THREE.Color(color) : new THREE.Color("#bbbbbb");
  const mat = new THREE.MeshStandardMaterial({ color: c, metalness: 0.45, roughness: 0.35 });
  const group = new THREE.Group();
  const p = modelPath.toLowerCase();
  if (p.includes("coin")) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 32), mat);
    mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
  } else if (p.includes("gem")) {
    group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), mat));
  } else if (p.includes("power")) {
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 0), mat));
  } else if (p.includes("trophy")) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 0.42, 20), mat);
    cup.position.y = 0.18;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 14), mat);
    stem.position.y = -0.14;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 20), mat);
    base.position.y = -0.3;
    group.add(cup, stem, base);
  } else {
    group.add(new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), mat));
  }
  return group;
}

export default function SpinningModel3D({
  modelPath,
  size = 48,
  color,
  ambientMult = 1,
  dirMult = 1,
  style,
  cameraPos,
  lookAtPos,
  rotSpeed,
  frozen = false,
  modelScale = 1,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const entryRef = useRef<IconEntry | null>(null);
  const [remountEpoch, setRemountEpoch] = useState(0);

  const snapshotOpts: FrozenSnapshotOpts | null = frozen
    ? { modelPath, size, color, ambientMult, dirMult, cameraPos, lookAtPos, modelScale }
    : null;
  const snapshotKey = snapshotOpts ? frozenSnapshotKey(snapshotOpts) : null;
  const cachedSnapshot = snapshotKey ? frozenSnapshotCache.get(snapshotKey) ?? null : null;
  const [snapshotSrc, setSnapshotSrc] = useState<string | null>(cachedSnapshot);

  useEffect(() => subscribeSpinningModelRemount(() => setRemountEpoch((e) => e + 1)), []);

  useEffect(() => {
    if (!frozen) return;
    if (snapshotKey && frozenSnapshotCache.has(snapshotKey)) {
      setSnapshotSrc(frozenSnapshotCache.get(snapshotKey)!);
    }
  }, [frozen, snapshotKey, remountEpoch]);

  useEffect(() => {
    if (frozen && snapshotSrc) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const [cx, cy, cz] = cameraPos ?? [0, 0.6, 3];
    const [lx, ly, lz] = lookAtPos ?? [0, 0.2, 0];
    const speed = rotSpeed ?? 0.025;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(cx, cy, cz);
    camera.lookAt(lx, ly, lz);

    scene.add(new THREE.AmbientLight(0xffffff, 1.8 * ambientMult));
    const dir = new THREE.DirectionalLight(0xffffff, 3.0 * dirMult);
    dir.position.set(2, 4, 3);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xffffff, 1.2 * dirMult);
    fill.position.set(-2, 1, 2);
    scene.add(fill);
    const back = new THREE.DirectionalLight(color ? new THREE.Color(color) : 0x8888ff, 0.8 * dirMult);
    back.position.set(-2, -1, -3);
    scene.add(back);

    const entry: IconEntry = { scene, camera, group: null, canvas2d: canvas, size, rotSpeed: speed };
    entryRef.current = entry;
    if (!frozen) {
      icons.add(entry);
      startLoop();
    }

    const url = resolveAssetUrl(modelPath);
    const onModelReady = (group: THREE.Group) => {
      if (entryRef.current !== entry) return;
      attachModelToEntry(entry, group, frozen, snapshotKey ?? undefined, modelScale);
      if (frozen && snapshotKey && frozenSnapshotCache.has(snapshotKey)) {
        setSnapshotSrc(frozenSnapshotCache.get(snapshotKey)!);
      }
    };
    if (gltfCache.has(url)) {
      onModelReady(cloneSkinned(gltfCache.get(url)!));
    } else {
      void loadSpinningGltf(url)
        .then((normalized) => {
          gltfCache.set(url, normalized);
          onModelReady(cloneSkinned(normalized));
        })
        .catch(() => {
          onModelReady(makeFallbackGroup(modelPath, color));
        });
    }

    return () => {
      if (!frozen) icons.delete(entry);
      entryRef.current = null;
      if (!frozen) stopLoop();
    };
  }, [modelPath, ambientMult, dirMult, color, remountEpoch, frozen, snapshotKey, modelScale,
    cameraPos?.[0], cameraPos?.[1], cameraPos?.[2],
    lookAtPos?.[0], lookAtPos?.[1], lookAtPos?.[2],
    rotSpeed]);

  useEffect(() => {
    if (frozen && snapshotSrc) return;
    const canvas = canvasRef.current;
    const entry = entryRef.current;
    if (!canvas || !entry) return;
    entry.size = size;
    canvas.width = size;
    canvas.height = size;
    if (frozen && entry.group) renderEntryOnce(entry, snapshotKey ?? undefined);
  }, [size, frozen, snapshotKey, snapshotSrc]);

  if (frozen && snapshotSrc) {
    return (
      <img
        src={snapshotSrc}
        width={size}
        height={size}
        alt=""
        draggable={false}
        style={{ display: "inline-block", verticalAlign: "middle", ...style }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "middle", ...style }}
    />
  );
}
