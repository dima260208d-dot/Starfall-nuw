/**
 * Shared WebGL preview for battle-intro cards — one renderer for all cards
 * (avoids browser WebGL context limits when 10+ brawlers appear at once).
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { preloadBrawlerGltfUrl } from "../Brawler3DModel";
import BrawlerViewer3D, { getBrawler3DPreviewConfig } from "../BrawlerViewer3D";
import { applyCanvasBitmapDrawPolicy, applyGLTFTexturePolicy } from "../../utils/texturePolicy";
import { registerWebGLCleanup, notifyWebGLRemount } from "../../utils/devWebGLRecovery";

const ATTACK_PATTERN = /attack|slash|combo|kick|shot|cast|spin|punch|strike|stab/i;

type IntroEntry = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rootGroup: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  canvas2d: HTMLCanvasElement;
  cssSize: number;
  renderSize: number;
  lastTs: number;
  alive: boolean;
  active: boolean;
};

const entries = new Set<IntroEntry>();
let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedRafId = 0;
let renderCursor = 0;

function frameIntroUpperBody(camera: THREE.PerspectiveCamera, model: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  // Waist-up framing: zoom in, keep head inside card, legs fall below clip.
  const lookY = box.min.y + size.y * 0.56;
  camera.lookAt(center.x, lookY, center.z);
  const vFov = (camera.fov * Math.PI) / 180;
  const dist = (size.y * 0.54) / Math.tan(vFov / 2);
  camera.position.set(center.x - size.x * 0.02, lookY + size.y * 0.11, center.z + dist * 0.9);
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

function getSharedRenderer(): THREE.WebGLRenderer | null {
  if (sharedRenderer) return sharedRenderer;
  try {
    sharedRenderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "low-power",
      preserveDrawingBuffer: true,
    });
    sharedRenderer.setPixelRatio(1);
    sharedRenderer.setClearColor(0x000000, 0);
    sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
    sharedRenderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      disposeIntroSharedRenderer();
      notifyWebGLRemount();
    });
    return sharedRenderer;
  } catch {
    return null;
  }
}

/** Release intro card WebGL before battle 3D claims a context. */
export function disposeIntroSharedRenderer(): void {
  if (sharedRafId) {
    cancelAnimationFrame(sharedRafId);
    sharedRafId = 0;
  }
  entries.clear();
  renderCursor = 0;
  if (sharedRenderer) {
    try {
      const gl = sharedRenderer.getContext();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      sharedRenderer.dispose();
    } catch {
      /* ignore */
    }
    sharedRenderer = null;
  }
}

registerWebGLCleanup(disposeIntroSharedRenderer);

function disposeEntryResources(entry: IntroEntry): void {
  entry.rootGroup.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach(m => m.dispose());
    else if (mat) mat.dispose();
  });
  entry.mixer?.stopAllAction();
}

function getActiveEntries(): IntroEntry[] {
  const list: IntroEntry[] = [];
  for (const entry of entries) {
    if (entry.alive && entry.active) list.push(entry);
  }
  return list;
}

function blitEntry(entry: IntroEntry, renderer: THREE.WebGLRenderer): void {
  if (!sharedRenderer || renderer !== sharedRenderer) return;
  renderer.setSize(entry.renderSize, entry.renderSize, false);
  try {
    renderer.render(entry.scene, entry.camera);
  } catch {
    return;
  }
  const ctx = entry.canvas2d.getContext("2d");
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

    const active = getActiveEntries();
    if (active.length === 0) return;

    for (const entry of entries) {
      if (!entry.alive || !entry.active || !entry.mixer) continue;
      const dt = entry.lastTs ? Math.min(0.05, (ts - entry.lastTs) / 1000) : 0;
      entry.lastTs = ts;
      entry.mixer.update(dt);
    }

    const budget = Math.min(active.length, Math.max(2, Math.ceil(active.length / 3)));
    for (let i = 0; i < budget; i++) {
      const entry = active[(renderCursor + i) % active.length];
      blitEntry(entry, renderer);
    }
    renderCursor = (renderCursor + budget) % active.length;
  };
  loop(performance.now());
}

function stopSharedLoopIfIdle(): void {
  if (getActiveEntries().length === 0 && sharedRafId) {
    cancelAnimationFrame(sharedRafId);
    sharedRafId = 0;
    renderCursor = 0;
  }
}

interface Props {
  brawlerId: string;
  color: string;
  size: number;
  /** When false, skip WebGL work while card is hidden (slide-in/out). */
  active?: boolean;
}

export default function IntroSharedBrawler3D({ brawlerId, color, size, active = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const entryRef = useRef<IntroEntry | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);
  const modelCfg = getBrawler3DPreviewConfig(brawlerId);

  useEffect(() => {
    const entry = entryRef.current;
    if (!entry) return;
    entry.active = active;
    if (active) {
      entry.lastTs = 0;
      startSharedLoop();
    } else {
      stopSharedLoopIfIdle();
    }
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const cfg = getBrawler3DPreviewConfig(brawlerId);
    if (!canvas || !cfg) return;
    const renderer = getSharedRenderer();
    if (!renderer) {
      setWebglFailed(true);
      return;
    }
    const base = (import.meta as any).env?.BASE_URL ?? "/";
    const modelUrl = `${base}${cfg.url}`;
    const cssSize = Math.max(64, Math.round(size));
    const renderSize = Math.min(384, Math.max(192, Math.round(cssSize * 1.75)));

    canvas.width = cssSize;
    canvas.height = cssSize;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 100);
    camera.position.set(0, 1.38, 4.35);
    camera.lookAt(0, 1.05, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(color), 0.55);
    rim.position.set(-2, 2, -3);
    scene.add(rim);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const entry: IntroEntry = {
      scene,
      camera,
      rootGroup,
      mixer: null,
      canvas2d: canvas,
      cssSize,
      renderSize,
      lastTs: 0,
      alive: true,
      active,
    };
    entryRef.current = entry;
    entries.add(entry);
    if (active) startSharedLoop();

    let cancelled = false;
    preloadBrawlerGltfUrl(modelUrl).then((cached) => {
      if (cancelled || !entry.alive || !cached) return;

      const model = cloneSkinned(cached.scene) as THREE.Group;
      fixMaterials(model);
      model.scale.setScalar(cached.normScale);
      model.position.set(cached.normOffX, cached.normOffY, cached.normOffZ);
      rootGroup.add(model);
      frameIntroUpperBody(camera, model);

      const mixer = new THREE.AnimationMixer(model);
      entry.mixer = mixer;
      const clip = resolveClip(cached.animations, cfg.idleAnim, cfg.idleIdx);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.reset();
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
      }
      mixer.update(1 / 60);
      if (entry.active) blitEntry(entry, renderer);
    }).catch(() => {
      /* canvas stays empty — rare load failure */
    });

    return () => {
      cancelled = true;
      entry.alive = false;
      entry.active = false;
      entries.delete(entry);
      entryRef.current = null;
      disposeEntryResources(entry);
      stopSharedLoopIfIdle();
    };
  }, [brawlerId, color, size]);

  if (!modelCfg || webglFailed) {
    return (
      <BrawlerViewer3D
        brawlerId={brawlerId}
        color={color}
        size={size}
        showBackdrop={false}
        forceBillboard
        snapBackAfterDragMs={0}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={Math.max(64, Math.round(size))}
      height={Math.max(64, Math.round(size))}
      style={{
        width: size,
        height: size,
        display: "block",
        pointerEvents: "none",
      }}
    />
  );
}
