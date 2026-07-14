import { useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { fixCharacterSkinnedMeshes } from "../utils/gltfSkinnedMeshFix";
import { applyGLTFTexturePolicy } from "../utils/texturePolicy";
import { getPetUIPreview, getPetUIHeightScale, petIdFromModelUrl, sanitizePetClips } from "../game/pet3DRenderer";
import { applyBrawlerNormTransform, computeBrawlerNormTransform } from "../game/brawler3DScale";
import { alternateHeavyAssetUrl } from "../lib/assetBase";
import { loadGLTFFromUrl } from "../utils/glbFetchCache";

interface Brawler3DModelProps {
  modelUrl: string;
  /** Name of the GLTF animation clip to loop (e.g. "Walking"). */
  animation: string;
  /** Direct clip index — used as the primary selector when provided. */
  animationIdx?: number;
  /** Glow color used for the radial backdrop. */
  color: string;
  size?: number;
  autoRotateInitial?: boolean;
  /** Upper bound for `renderer.setPixelRatio` (default 2). Use 1 in dense UIs. */
  pixelRatioCap?: number;
  /** Меньше нагрузка на GPU: без MSAA, low-power контекст — для превью в списках. */
  efficientPreview?: boolean;
  /** Остановить цикл рендера (один кадр) — когда поверх открыт popup. */
  paused?: boolean;
  /** Цветное свечение за моделью (по умолчанию включено). */
  showBackdrop?: boolean;
  /** После ручного вращения — через N мс плавно вернуть в исходный yaw (0). */
  snapBackAfterDragMs?: number;
  /** Skip loading pulse / opacity fade after first load (main-menu hero). */
  stablePreview?: boolean;
  /** Проигрывать анимацию (false — статичная поза, рендер и вращение работают). */
  animationActive?: boolean;
  /** Canvas шире layout-размера — запас при вращении, модель того же визуального размера. */
  clipPadding?: number;
  /** Клик без перетаскивания. */
  onTap?: () => void;
  /** Called when GLB load fails — parent can swap to 2D fallback. */
  onLoadFailed?: () => void;
}

function shortestYawDelta(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function safeRender(
  renderer: THREE.WebGLRenderer | undefined,
  scene: THREE.Scene | undefined,
  camera: THREE.Camera | undefined,
): void {
  if (!renderer || !scene || !camera || !renderer.info) return;
  try {
    renderer.render(scene, camera);
  } catch {
    /* disposed or lost WebGL context */
  }
}

// ── GLTF cache ────────────────────────────────────────────────────────────────
// The first time a model URL is loaded the raw GLTF plus the pre-computed
// normalisation transform are cached. Subsequent viewers clone the scene and
// apply the stored scale/offset — avoiding a re-download AND the bounding-box
// issue that arises when computing Box3 on an off-scene skinned-mesh clone.
interface CachedGLTF {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  normScale: number;
  normScaleY: number;
  normOffX: number;
  normOffY: number;
  normOffZ: number;
}
const gltfCache = new Map<string, Promise<CachedGLTF>>();

export function invalidateBrawler3DGltfCache(): void {
  gltfCache.clear();
}

/** Warm GLB cache before intro/result cards mount (never throws). */
export function preloadBrawlerGltfUrl(url: string): Promise<CachedGLTF | null> {
  return loadGLTFCached(url).catch(() => null);
}

function loadGLTFCached(url: string, allowAlternate = true): Promise<CachedGLTF> {
  const hit = gltfCache.get(url);
  if (hit) return hit;
  const p = loadGLTFFromUrl(url).then((gltf) => {
    const scene = gltf.scene;
    fixMaterials(scene);
    fixCharacterSkinnedMeshes(scene);

    const TARGET_H = 2.2;
    const isPetModel = url.includes("/models/pets/");
    const animations = isPetModel
      ? sanitizePetClips(gltf.animations ?? [])
      : (gltf.animations ?? []);

    if (isPetModel) {
      const petId = petIdFromModelUrl(url) ?? "";
      const uiTargetH = TARGET_H * getPetUIHeightScale(petId);
      return { scene, animations, ...computeBrawlerNormTransform(scene, uiTargetH, url) };
    }

    const box = new THREE.Box3().setFromObject(scene);
    const sz = new THREE.Vector3();
    box.getSize(sz);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const normScale = sz.y > 0.001 ? TARGET_H / sz.y : 1;
    return {
      scene,
      animations,
      normScale,
      normScaleY: normScale,
      normOffX: -center.x * normScale,
      normOffY: -box.min.y * normScale,
      normOffZ: -center.z * normScale,
    };
  }).catch((err) => {
    gltfCache.delete(url);
    const alt = allowAlternate ? alternateHeavyAssetUrl(url) : null;
    if (alt) return loadGLTFCached(alt, false);
    throw err;
  });
  gltfCache.set(url, p);
  return p;
}

/** Список имён клипов из кэша GLTF (для превью в админке). */
export async function getGltfAnimationNames(url: string): Promise<string[]> {
  const cached = await loadGLTFCached(url);
  return cached.animations.map(c => c.name);
}

// ── Material fix ──────────────────────────────────────────────────────────────
// Many GLB exporters incorrectly set transparent=true, alphaTest, or BackSide.
// Forcing DoubleSide prevents "missing" mesh parts and depthWrite fixes z-order.
function fixMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m: THREE.Material) => {
      m.side = THREE.DoubleSide;
      m.depthWrite = true;
      const sm = m as THREE.MeshStandardMaterial;
      if (sm.opacity !== undefined && sm.opacity >= 0.98) {
        m.transparent = false;
      }
      m.needsUpdate = true;
    });
  });
  applyGLTFTexturePolicy(root, null);
}

// ── Animation clip resolution ─────────────────────────────────────────────────
// Resolution order:
//   1. Direct index (most reliable — hardcoded from binary GLB extraction)
//   2. Exact name match
//   3. Case-insensitive partial name match
//   4. Fuzzy: first clip whose name does NOT look like a combat/attack animation
//   5. clips[0] last resort
const ATTACK_PATTERN = /attack|slash|combo|kick|shot|cast|spin|punch|strike|stab/i;
function resolveClip(
  clips: THREE.AnimationClip[],
  requested: string,
  idx?: number,
): THREE.AnimationClip | null {
  if (!clips.length) return null;
  // 1. Direct index
  if (idx !== undefined && clips[idx] && clips[idx].name === requested) return clips[idx];
  // 2. Exact name
  const exact = clips.find(c => c.name === requested);
  if (exact) return exact;
  // 3. Case-insensitive partial
  const lower = requested.toLowerCase();
  const partial = clips.find(c => c.name.toLowerCase().includes(lower));
  if (partial) return partial;
  // 4. Avoid attack clips — prefer one that looks like a walk/idle
  const nonAttack = clips.filter(c => !ATTACK_PATTERN.test(c.name) && !/^run/i.test(c.name));
  if (nonAttack.length) return nonAttack.find(c => /walk/i.test(c.name)) ?? nonAttack[0];
  // 5. Last resort
  return clips[0];
}

function frameCameraOnModel(
  camera: THREE.PerspectiveCamera,
  model: THREE.Object3D,
  distanceMult = 2.55,
  lookAtDy = 0,
  heightMargin = 1,
  bboxPadTop = 0,
) {
  const box = new THREE.Box3().setFromObject(model);
  if (bboxPadTop > 0) box.max.y += bboxPadTop;
  const center = new THREE.Vector3();
  const sz = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(sz);
  const lookY = center.y + lookAtDy;
  const vFov = (camera.fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distY = (sz.y * heightMargin) / (2 * Math.tan(vFov / 2));
  const distX = (Math.max(sz.x, sz.z) * 1.06) / (2 * Math.tan(hFov / 2));
  const dist = Math.max(distY, distX) * (distanceMult / 2.55);
  camera.lookAt(center.x, lookY, center.z);
  camera.position.set(center.x, lookY, center.z + dist);
}

/** Tracks GLBs already shown in stable UI previews — avoids flash on remount. */
const uiPreviewLoaded = new Set<string>();

export function markUiPreviewGltfLoaded(modelUrl: string): void {
  uiPreviewLoaded.add(modelUrl);
}

/**
 * Standalone 3D model viewer for menu / collection screens. The user looks at
 * the brawler "head-on" and can drag horizontally to spin the model 360°.
 * One animation clip plays on a loop. Models are cached after first download.
 */
export default function Brawler3DModel({
  modelUrl,
  animation,
  animationIdx,
  color,
  size = 320,
  autoRotateInitial = false,
  pixelRatioCap = 2,
  efficientPreview = false,
  paused = false,
  showBackdrop = true,
  snapBackAfterDragMs,
  stablePreview = false,
  animationActive = true,
  clipPadding = 1,
  onTap,
  onLoadFailed,
}: Brawler3DModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modelReady, setModelReady] = useState(() => uiPreviewLoaded.has(modelUrl));
  const [loadFailed, setLoadFailed] = useState(false);
  const pad = Math.max(1, clipPadding);
  const layoutSize = size;
  const renderSize = Math.round(size * pad);
  const isPetModel = modelUrl.includes("/models/pets/");
  const frameCameraMult = 2.55 * (layoutSize / renderSize);

  useEffect(() => {
    setLoadFailed(false);
  }, [modelUrl]);

  const stateRef = useRef<{
    renderer?: THREE.WebGLRenderer;
    scene?: THREE.Scene;
    camera?: THREE.PerspectiveCamera;
    mixer?: THREE.AnimationMixer;
    clips?: THREE.AnimationClip[];
    currentAction?: THREE.AnimationAction;
    rootGroup?: THREE.Group;
    yaw: number;
    autoRotate: boolean;
    dragging: boolean;
    dragStartX: number;
    dragStartYaw: number;
    raf: number;
    lastTs: number;
    frameSkip: number;
    snapTimer: ReturnType<typeof setTimeout> | null;
    snapping: boolean;
    dragMoved: boolean;
  }>({
    yaw: 0,
    autoRotate: autoRotateInitial,
    dragging: false,
    dragStartX: 0,
    dragStartYaw: 0,
    raf: 0,
    lastTs: 0,
    frameSkip: 0,
    snapTimer: null,
    snapping: false,
    dragMoved: false,
  });

  const snapBackMsRef = useRef(snapBackAfterDragMs);
  snapBackMsRef.current = snapBackAfterDragMs;
  const onTapRef = useRef(onTap);
  onTapRef.current = onTap;
  const renderSizeRef = useRef(renderSize);
  renderSizeRef.current = renderSize;

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const animationActiveRef = useRef(animationActive);
  animationActiveRef.current = animationActive;
  const efficientPreviewRef = useRef(efficientPreview);
  efficientPreviewRef.current = efficientPreview;
  const stablePreviewRef = useRef(stablePreview);
  stablePreviewRef.current = stablePreview;

  // ---------------- One-time scene setup ----------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !efficientPreview,
        alpha: true,
        powerPreference: efficientPreview ? "low-power" : "default",
        preserveDrawingBuffer: stablePreview,
      });
    } catch (err) {
      console.warn("[Brawler3DModel] WebGL unavailable, skipping", err);
      return;
    }
    renderer.setPixelRatio(Math.min(pixelRatioCap, window.devicePixelRatio || 1.5));
    renderer.setSize(renderSizeRef.current, renderSizeRef.current, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      if (!stablePreviewRef.current) setLoadFailed(true);
    };
    const onContextRestored = () => {
      setLoadFailed(false);
      renderer.setPixelRatio(Math.min(pixelRatioCap ?? 2, window.devicePixelRatio || 1.5));
      renderer.setSize(renderSizeRef.current, renderSizeRef.current, false);
      safeRender(renderer, scene, camera);
      if (stablePreviewRef.current && !stateRef.current.raf) {
        stateRef.current.raf = requestAnimationFrame(tick);
      }
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);
    const onVisibility = () => {
      if (!stablePreviewRef.current || document.hidden) return;
      safeRender(renderer, scene, camera);
      if (!stateRef.current.raf) {
        stateRef.current.lastTs = 0;
        stateRef.current.raf = requestAnimationFrame(tick);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 1.4, 5.5);
    camera.lookAt(0, 1.0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(color), 0.55);
    rim.position.set(-2, 2, -3);
    scene.add(rim);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    stateRef.current.renderer = renderer;
    stateRef.current.scene = scene;
    stateRef.current.camera = camera;
    stateRef.current.rootGroup = rootGroup;

    // ---------------- Load GLB (cached) ----------------
    let cancelled = false;
    let disposed = false;
    loadGLTFCached(modelUrl).then((cached) => {
      if (cancelled || disposed) return;

      // Clone the cached scene — scale/offset already computed at load time.
      const model = cloneSkinned(cached.scene) as THREE.Group;
      fixMaterials(model);
      if (modelUrl.includes("/models/pets/")) {
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((m) => m.clone());
          } else if (mesh.material) {
            mesh.material = mesh.material.clone();
          }
        });
        applyGLTFTexturePolicy(model, null);
      }
      if (isPetModel) {
        applyBrawlerNormTransform(model, cached);
        const tune = getPetUIPreview(petIdFromModelUrl(modelUrl) ?? "");
        if (tune.modelYOffset) model.position.y += tune.modelYOffset;
      } else {
        model.scale.setScalar(cached.normScale);
        model.position.set(cached.normOffX, cached.normOffY, cached.normOffZ);
      }

      rootGroup.add(model);
      uiPreviewLoaded.add(modelUrl);
      setModelReady(true);

      const mixer = new THREE.AnimationMixer(model);
      stateRef.current.mixer = mixer;
      stateRef.current.clips = cached.animations;
      playClip(animation, animationIdx);
      mixer.update(1 / 60);

      if (isPetModel && pad > 1) {
        const tune = getPetUIPreview(petIdFromModelUrl(modelUrl) ?? "");
        frameCameraOnModel(
          camera,
          model,
          frameCameraMult * (tune.cameraMult ?? 1),
          tune.lookAtDy ?? 0,
          tune.heightMargin ?? 1.06,
          tune.bboxPadTop ?? 0,
        );
        safeRender(renderer, scene, camera);
      }
    }).catch(() => {
      console.warn("[Brawler3DModel] failed to load", modelUrl);
      setLoadFailed(true);
    });

    // ---------------- Render loop ----------------
    const simulateFrame = (dt: number) => {
      const s = stateRef.current;
      if (s.autoRotate && !s.dragging && !s.snapping) {
        s.yaw += dt * 0.6;
      }
      if (s.snapping && !s.dragging) {
        const delta = shortestYawDelta(s.yaw, 0);
        if (Math.abs(delta) < 0.015) {
          s.yaw = 0;
          s.snapping = false;
        } else {
          s.yaw += delta * Math.min(1, dt * 4.5);
        }
      }
      if (s.rootGroup) s.rootGroup.rotation.y = s.yaw;
      if (s.mixer && animationActiveRef.current) s.mixer.update(dt);
    };

    const drawFrame = () => {
      const s = stateRef.current;
      if (disposed) return;
      safeRender(s.renderer, s.scene, s.camera);
    };

    const tick = (ts: number) => {
      const s = stateRef.current;
      if (disposed) return;
      const frozen = pausedRef.current && !stablePreviewRef.current;
      if (frozen) {
        s.raf = 0;
        return;
      }
      const dt = s.lastTs ? Math.min(0.05, (ts - s.lastTs) / 1000) : 0;
      s.lastTs = ts;

      if (!pausedRef.current) simulateFrame(dt);

      if (efficientPreviewRef.current && !stablePreviewRef.current) {
        s.frameSkip = (s.frameSkip + 1) % 2;
        if (s.frameSkip !== 0) {
          s.raf = requestAnimationFrame(tick);
          return;
        }
      }

      drawFrame();
      s.raf = requestAnimationFrame(tick);
    };
    stateRef.current.raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      disposed = true;
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      document.removeEventListener("visibilitychange", onVisibility);
      if (stateRef.current.snapTimer) clearTimeout(stateRef.current.snapTimer);
      cancelAnimationFrame(stateRef.current.raf);
      stateRef.current.raf = 0;
      stateRef.current.renderer = undefined;
      stateRef.current.scene = undefined;
      stateRef.current.camera = undefined;
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      rootGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl]);

  useEffect(() => {
    const s = stateRef.current;
    if (!s.renderer) return;
    const cap = pixelRatioCap ?? 2;
    s.renderer.setPixelRatio(Math.min(cap, window.devicePixelRatio || 1));
    s.renderer.setSize(renderSize, renderSize, false);
    safeRender(s.renderer, s.scene, s.camera);
  }, [renderSize, pixelRatioCap]);

  useEffect(() => {
    const s = stateRef.current;
    if (stablePreviewRef.current) return;
    if (paused) {
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.lastTs = 0;
      safeRender(s.renderer, s.scene, s.camera);
    } else if (!s.raf && s.renderer) {
      const tick = (ts: number) => {
        if (pausedRef.current) {
          s.raf = 0;
          return;
        }
        const dt = s.lastTs ? Math.min(0.05, (ts - s.lastTs) / 1000) : 0;
        s.lastTs = ts;
        if (s.autoRotate && !s.dragging && !s.snapping) s.yaw += dt * 0.6;
        if (s.snapping && !s.dragging) {
          const delta = shortestYawDelta(s.yaw, 0);
          if (Math.abs(delta) < 0.015) {
            s.yaw = 0;
            s.snapping = false;
          } else {
            s.yaw += delta * Math.min(1, dt * 4.5);
          }
        }
        if (s.rootGroup) s.rootGroup.rotation.y = s.yaw;
        if (s.mixer && animationActiveRef.current) s.mixer.update(dt);
        if (efficientPreviewRef.current) {
          s.frameSkip = (s.frameSkip + 1) % 2;
          if (s.frameSkip !== 0) {
            s.raf = requestAnimationFrame(tick);
            return;
          }
        }
        safeRender(s.renderer, s.scene, s.camera);
        s.raf = requestAnimationFrame(tick);
      };
      s.raf = requestAnimationFrame(tick);
    }
  }, [paused]);

  // ---------------- Animation switching ----------------
  const playClip = (name: string, idx?: number) => {
    const s = stateRef.current;
    if (!s.mixer || !s.clips || !name) return;
    const clip = resolveClip(s.clips, name, idx);

    if (!clip) return;
    const next = s.mixer.clipAction(clip);
    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.fadeIn(0.25);
    next.play();
    if (s.currentAction && s.currentAction !== next) {
      s.currentAction.fadeOut(0.25);
    }
    s.currentAction = next;
  };

  useEffect(() => {
    playClip(animation, animationIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation, animationIdx]);

  // ---------------- Pointer drag ----------------
  const scheduleSnapBack = () => {
    const s = stateRef.current;
    const ms = snapBackMsRef.current;
    if (!ms || Math.abs(s.yaw) < 0.015) return;
    if (s.snapTimer) clearTimeout(s.snapTimer);
    s.snapTimer = setTimeout(() => {
      s.snapTimer = null;
      if (!s.dragging && Math.abs(s.yaw) >= 0.015) s.snapping = true;
    }, ms);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const s = stateRef.current;
    s.dragging = true;
    s.autoRotate = false;
    s.snapping = false;
    s.dragMoved = false;
    if (s.snapTimer) {
      clearTimeout(s.snapTimer);
      s.snapTimer = null;
    }
    s.dragStartX = e.clientX;
    s.dragStartYaw = s.yaw;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const drawNow = () => {
    const s = stateRef.current;
    safeRender(s.renderer, s.scene, s.camera);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = stateRef.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.dragStartX;
    if (Math.abs(dx) > 2) s.dragMoved = true;
    s.yaw = s.dragStartYaw + dx * 0.012;
    if (s.rootGroup) s.rootGroup.rotation.y = s.yaw;
    drawNow();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = stateRef.current;
    const dragged = s.dragMoved;
    s.dragging = false;
    if (dragged) {
      scheduleSnapBack();
      e.stopPropagation();
    } else if (onTapRef.current) {
      e.stopPropagation();
      onTapRef.current();
    }
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* */ }
  };

  const useClipLayout = isPetModel && pad > 1;
  const canvasBox: CSSProperties = useClipLayout ? {
    position: "absolute",
    width: renderSize,
    height: renderSize,
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
  } : { width: "100%", height: "100%", position: "relative" };

  const canvasOpacity = stablePreview
    ? 1
    : (modelReady ? 1 : loadFailed ? 0.35 : 0.2);

  return (
    <div
      style={{
        width: useClipLayout ? layoutSize : size,
        height: useClipLayout ? layoutSize : size,
        position: "relative",
        overflow: useClipLayout ? "visible" : undefined,
        userSelect: "none",
        touchAction: "none",
        cursor: onTap ? "pointer" : "grab",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title=""
    >
      {showBackdrop && (
        <div
          style={{
            ...(useClipLayout ? canvasBox : { position: "absolute", inset: 0 }),
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 55%, ${color}55 0%, ${color}15 35%, transparent 70%)`,
            filter: "blur(2px)", pointerEvents: "none",
            opacity: stablePreview ? 1 : (modelReady ? 1 : 0.45),
          }}
        />
      )}
      {!modelReady && !loadFailed && !stablePreview && (
        <div
          aria-hidden
          style={{
            ...(useClipLayout ? canvasBox : { position: "absolute", inset: 0 }),
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 60%, ${color}33 0%, transparent 65%)`,
            animation: "pulse 1.4s ease-in-out infinite",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      )}
      <div
        ref={containerRef}
        style={{
          ...canvasBox,
          background: "transparent",
          opacity: canvasOpacity,
          transition: stablePreview ? undefined : (modelReady ? "opacity 0.35s ease" : undefined),
        }}
      />
    </div>
  );
}
