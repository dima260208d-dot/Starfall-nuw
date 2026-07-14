/**
 * One WebGL context for main-menu hero brawler + pet (prevents mobile context flicker).
 * Output canvas matches Brawler3DModel / PetSvg layout exactly — no visual repositioning.
 */
import { useEffect, useRef, type CSSProperties } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { preloadBrawlerGltfUrl } from "../Brawler3DModel";
import { getBrawler3DPreviewConfig } from "../BrawlerViewer3D";
import { applyBrawlerNormTransform } from "../../game/brawler3DScale";
import {
  getPetPreviewAnim,
  getPetUIPreview,
  PET_3D_IDS,
  PET_UI_MODEL_URLS,
  petIdFromModelUrl,
  sanitizePetClips,
} from "../../game/pet3DRenderer";
import { resolveHeavyAssetUrl } from "../../lib/assetBase";
import { applyCanvasBitmapDrawPolicy, applyGLTFTexturePolicy } from "../../utils/texturePolicy";
import { registerWebGLCleanup } from "../../utils/devWebGLRecovery";
import { fixCharacterSkinnedMeshes } from "../../utils/gltfSkinnedMeshFix";

const ATTACK_PATTERN = /attack|slash|combo|kick|shot|cast|spin|punch|strike|stab/i;

type PoolEntry = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rootGroup: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  displayCanvas: HTMLCanvasElement;
  cssSize: number;
  renderSize: number;
  pixelRatio: number;
  lastTs: number;
  alive: boolean;
};

const entries = new Set<PoolEntry>();
let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedRafId = 0;

function fixMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m: THREE.Material) => {
      m.side = THREE.DoubleSide;
      m.depthWrite = true;
      const sm = m as THREE.MeshStandardMaterial;
      if (sm.opacity !== undefined && sm.opacity >= 0.98) m.transparent = false;
      m.needsUpdate = true;
    });
  });
  applyGLTFTexturePolicy(root, null);
}

function resolveClip(
  clips: THREE.AnimationClip[],
  requested: string,
  idx?: number,
): THREE.AnimationClip | null {
  if (!clips.length) return null;
  if (idx !== undefined && clips[idx] && clips[idx].name === requested) return clips[idx];
  const exact = clips.find(c => c.name === requested);
  if (exact) return exact;
  const lower = requested.toLowerCase();
  const partial = clips.find(c => c.name.toLowerCase().includes(lower));
  if (partial) return partial;
  const nonAttack = clips.filter(c => !ATTACK_PATTERN.test(c.name) && !/^run/i.test(c.name));
  if (nonAttack.length) return nonAttack.find(c => /walk/i.test(c.name)) ?? nonAttack[0];
  return clips[0];
}

function frameCameraOnModel(
  camera: THREE.PerspectiveCamera,
  model: THREE.Object3D,
  distanceMult = 2.55,
  lookAtDy = 0,
  heightMargin = 1,
  bboxPadTop = 0,
): void {
  const box = new THREE.Box3().setFromObject(model);
  if (bboxPadTop > 0) box.max.y += bboxPadTop;
  const center = new THREE.Vector3();
  const sz = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(sz);
  const lookY = center.y + lookAtDy;
  camera.lookAt(center.x, lookY, center.z);
  const vFov = (camera.fov * Math.PI) / 180;
  const dist = (sz.y * heightMargin) / Math.tan(vFov / 2);
  camera.position.set(center.x, lookY + sz.y * 0.06, center.z + dist * distanceMult);
}

function getSharedRenderer(): THREE.WebGLRenderer | null {
  if (sharedRenderer) return sharedRenderer;
  try {
    sharedRenderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "default",
      preserveDrawingBuffer: true,
    });
    sharedRenderer.setClearColor(0x000000, 0);
    sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
    sharedRenderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      disposeMenuSharedGL();
    });
    return sharedRenderer;
  } catch {
    return null;
  }
}

export function disposeMenuSharedGL(): void {
  if (sharedRafId) {
    cancelAnimationFrame(sharedRafId);
    sharedRafId = 0;
  }
  for (const entry of entries) {
    entry.alive = false;
    entry.mixer?.stopAllAction();
    entry.rootGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else if (mat) mat.dispose();
    });
  }
  entries.clear();
  if (sharedRenderer) {
    try { sharedRenderer.dispose(); } catch { /* ignore */ }
    sharedRenderer = null;
  }
}

registerWebGLCleanup(disposeMenuSharedGL);

function blitEntry(entry: PoolEntry, renderer: THREE.WebGLRenderer): void {
  renderer.setPixelRatio(1);
  renderer.setSize(entry.renderSize, entry.renderSize, false);
  try {
    renderer.render(entry.scene, entry.camera);
  } catch {
    return;
  }
  const ctx = entry.displayCanvas.getContext("2d");
  if (!ctx) return;
  applyCanvasBitmapDrawPolicy(ctx);
  ctx.clearRect(0, 0, entry.cssSize, entry.cssSize);
  ctx.drawImage(renderer.domElement, 0, 0, entry.cssSize, entry.cssSize);
}

function startSharedLoop(): void {
  if (sharedRafId) return;
  const loop = (ts: number) => {
    sharedRafId = requestAnimationFrame(loop);
    const renderer = getSharedRenderer();
    if (!renderer?.info) return;

    const active: PoolEntry[] = [];
    for (const entry of entries) {
      if (entry.alive) active.push(entry);
    }
    if (active.length === 0) return;

    for (const entry of active) {
      if (!entry.mixer) continue;
      const dt = entry.lastTs ? Math.min(0.05, (ts - entry.lastTs) / 1000) : 0;
      entry.lastTs = ts;
      entry.mixer.update(dt);
    }

    for (const entry of active) {
      blitEntry(entry, renderer);
    }
  };
  loop(performance.now());
}

function stopSharedLoopIfIdle(): void {
  if (entries.size === 0 && sharedRafId) {
    cancelAnimationFrame(sharedRafId);
    sharedRafId = 0;
  }
}

function setupLights(scene: THREE.Scene, color: string): void {
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(color), 0.55);
  rim.position.set(-2, 2, -3);
  scene.add(rim);
}

function registerEntry(
  displayCanvas: HTMLCanvasElement,
  cssSize: number,
  pixelRatioCap: number,
  color: string,
): PoolEntry | null {
  const renderer = getSharedRenderer();
  if (!renderer) return null;

  const pixelRatio = Math.min(pixelRatioCap, window.devicePixelRatio || 1.5);
  const renderSize = Math.max(48, Math.round(cssSize * pixelRatio));
  displayCanvas.width = cssSize;
  displayCanvas.height = cssSize;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 1.4, 5.5);
  camera.lookAt(0, 1.0, 0);
  setupLights(scene, color);

  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  const entry: PoolEntry = {
    scene,
    camera,
    rootGroup,
    mixer: null,
    displayCanvas,
    cssSize,
    renderSize,
    pixelRatio,
    lastTs: 0,
    alive: true,
  };
  entries.add(entry);
  startSharedLoop();
  return entry;
}

function disposeEntry(entry: PoolEntry): void {
  entry.alive = false;
  entries.delete(entry);
  entry.mixer?.stopAllAction();
  entry.rootGroup.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
    else if (mat) mat.dispose();
  });
  stopSharedLoopIfIdle();
}

interface BrawlerProps {
  brawlerId: string;
  color: string;
  size: number;
  pixelRatioCap?: number;
}

/** Same outer box as Brawler3DModel (size × size). */
export function MainMenuSharedBrawler3D({
  brawlerId,
  color,
  size,
  pixelRatioCap = 2.5,
}: BrawlerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const displayCanvas = canvasRef.current;
    const cfg = getBrawler3DPreviewConfig(brawlerId);
    if (!displayCanvas || !cfg) return;

    const entry = registerEntry(displayCanvas, size, pixelRatioCap, color);
    if (!entry) return;

    let cancelled = false;
    const modelUrl = resolveHeavyAssetUrl(cfg.url);
    preloadBrawlerGltfUrl(modelUrl).then((cached) => {
      if (cancelled || !entry.alive || !cached) return;
      const model = cloneSkinned(cached.scene) as THREE.Group;
      fixMaterials(model);
      fixCharacterSkinnedMeshes(model);
      model.scale.setScalar(cached.normScale);
      model.position.set(cached.normOffX, cached.normOffY, cached.normOffZ);
      entry.rootGroup.add(model);

      const mixer = new THREE.AnimationMixer(model);
      entry.mixer = mixer;
      const clip = resolveClip(cached.animations, cfg.idleAnim, cfg.idleIdx);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
      }
      mixer.update(1 / 60);
      const renderer = getSharedRenderer();
      if (renderer) blitEntry(entry, renderer);
    }).catch(() => { /* keep canvas */ });

    return () => {
      cancelled = true;
      disposeEntry(entry);
    };
  }, [brawlerId, color, size, pixelRatioCap]);

  if (!getBrawler3DPreviewConfig(brawlerId)) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: "block", pointerEvents: "none" }}
    />
  );
}

interface PetProps {
  petId: string;
  color: string;
  size: number;
  animated?: boolean;
  clipPadding?: number;
  onTap?: () => void;
}

/** Same outer box as PetSvg with clip padding. */
export function MainMenuSharedPet3D({
  petId,
  color,
  size,
  animated = true,
  clipPadding = 1.25,
  onTap,
}: PetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pad = Math.max(1, clipPadding);
  const layoutSize = size;
  const renderLayoutSize = Math.round(size * pad);

  useEffect(() => {
    const displayCanvas = canvasRef.current;
    if (!displayCanvas || !PET_3D_IDS.has(petId)) return;

    const entry = registerEntry(displayCanvas, layoutSize, 1.5, color);
    if (!entry) return;

    const preview = getPetPreviewAnim(petId);
    const modelUrl = resolveHeavyAssetUrl(PET_UI_MODEL_URLS[petId]);
    let cancelled = false;

    preloadBrawlerGltfUrl(modelUrl).then((cached) => {
      if (cancelled || !entry.alive || !cached) return;
      const model = cloneSkinned(cached.scene) as THREE.Group;
      fixMaterials(model);
      fixCharacterSkinnedMeshes(model);
      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
      });
      applyBrawlerNormTransform(model, cached);
      const tune = getPetUIPreview(petIdFromModelUrl(modelUrl) ?? petId);
      if (tune.modelYOffset) model.position.y += tune.modelYOffset;
      entry.rootGroup.add(model);

      const frameMult = 2.55 * (layoutSize / entry.renderSize);
      frameCameraOnModel(
        entry.camera,
        model,
        frameMult * (tune.cameraMult ?? 1),
        tune.lookAtDy ?? 0,
        tune.heightMargin ?? 1.06,
        tune.bboxPadTop ?? 0,
      );

      const clips = sanitizePetClips(cached.animations ?? []);
      const mixer = new THREE.AnimationMixer(model);
      entry.mixer = mixer;
      if (animated) {
        const clip = resolveClip(clips, preview.anim, preview.idx);
        if (clip) {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
        }
      }
      mixer.update(1 / 60);
      const renderer = getSharedRenderer();
      if (renderer) blitEntry(entry, renderer);
    }).catch(() => { /* keep canvas */ });

    return () => {
      cancelled = true;
      disposeEntry(entry);
    };
  }, [petId, color, layoutSize, animated, pad]);

  if (!PET_3D_IDS.has(petId)) return null;

  const canvasBox: CSSProperties = {
    position: "absolute",
    width: renderLayoutSize,
    height: renderLayoutSize,
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: onTap ? "auto" : "none",
    cursor: onTap ? "pointer" : undefined,
  };

  return (
    <div
      style={{
        width: layoutSize,
        height: layoutSize,
        position: "relative",
        overflow: "visible",
      }}
      onClick={onTap ? (e) => { e.stopPropagation(); onTap(); } : undefined}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 55%, ${color}55 0%, ${color}15 35%, transparent 70%)`,
          filter: "blur(2px)",
          pointerEvents: "none",
        }}
      />
      <canvas ref={canvasRef} style={canvasBox} />
    </div>
  );
}
