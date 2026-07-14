import * as THREE from "three";
import { BRAWLERS } from "../../entities/BrawlerData";
import { Brawler } from "../../entities/Brawler";
import { getHeavyAssetBaseUrl } from "../../lib/assetBase";
import {
  createBinbunGrassField,
  disposeBinbunGrassField,
  loadBinbunGrassAssets,
  setBinbunGrassStompers,
  updateBinbunGrassField,
  type BinbunGrassField,
} from "../../game/binbunGrass3D";
import {
  CHAR_3D_IDS,
  findCharAnimClip,
  getCharRenderer,
  resetSkinnedBindPose,
  setRenderersBase,
  type CharAnimNames,
} from "../../game/miyaTopDownRenderer";
import { fixCharacterSkinnedMeshes } from "../../utils/gltfSkinnedMeshFix";
import {
  clearMotionTrails,
  renderMotionTrailsAir,
  renderMotionTrailsGround,
  tickMotionTrails,
  type TrailRenderCamera,
} from "../../game/motionTrailSystem";

const CAM_TILT_DEG = 30;
const CAM_TILT_RAD = (CAM_TILT_DEG * Math.PI) / 180;
const CAM_TILT_COS = Math.cos(CAM_TILT_RAD);
const CAM_HEIGHT = 1500;
const CAM_BACK_OFFSET = CAM_HEIGHT * Math.tan(CAM_TILT_RAD);

const MAP_W = 1200;
const MAP_H = 900;
/** Smaller = closer zoom on the brawler. */
const VIEW_W = 220;
const VIEW_H = 165;
const GROUND_PAD = 80;
const WALK_Y = MAP_H * 0.52;
const WALK_X_MIN = 320;
const WALK_X_MAX = MAP_W - 320;
const WALK_SPEED = 185;

type AnimSlot = "idle" | "run";

function createPreviewActions(
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
  names: CharAnimNames,
): Partial<Record<AnimSlot, THREE.AnimationAction>> {
  const actions: Partial<Record<AnimSlot, THREE.AnimationAction>> = {};
  const idleClip = findCharAnimClip(clips, names.idle, names.idleIdx);
  const runClip = findCharAnimClip(clips, names.run, names.runIdx);
  for (const [slot, clip] of [["idle", idleClip], ["run", runClip]] as const) {
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
    actions[slot] = a;
  }
  return actions;
}

function applyRun(
  mixer: THREE.AnimationMixer,
  actions: Partial<Record<AnimSlot, THREE.AnimationAction>>,
  names: CharAnimNames,
): void {
  const idleA = actions.idle;
  const runA = actions.run;
  if (idleA && runA && idleA === runA) {
    idleA.paused = false;
    idleA.setEffectiveWeight(1);
    idleA.setEffectiveTimeScale(names.sharedLocomotionRunScale ?? 1);
    idleA.play();
    return;
  }
  if (!runA) return;
  mixer.stopAllAction();
  runA.reset();
  runA.setEffectiveWeight(1);
  runA.paused = false;
  runA.setEffectiveTimeScale(1);
  runA.play();
}

function applyCameraFrustum(
  camera: THREE.OrthographicCamera,
  canvasW: number,
  canvasH: number,
): { viewW: number; viewH: number } {
  const canvasAspect = canvasW / Math.max(1, canvasH);
  const baseAspect = VIEW_W / VIEW_H;
  let viewW = VIEW_W;
  let viewH = VIEW_H;
  if (canvasAspect > baseAspect) viewW = VIEW_H * canvasAspect;
  else if (canvasAspect < baseAspect) viewH = VIEW_W / canvasAspect;
  camera.left = -viewW / 2;
  camera.right = viewW / 2;
  camera.top = (viewH / 2) * CAM_TILT_COS;
  camera.bottom = -(viewH / 2) * CAM_TILT_COS;
  camera.updateProjectionMatrix();
  return { viewW, viewH };
}

function updateBattleCamera(
  camera: THREE.OrthographicCamera,
  directional: THREE.DirectionalLight,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
): void {
  const cx = camX + viewW / 2;
  const cy = camY + viewH / 2;
  camera.position.set(cx, CAM_HEIGHT, cy + CAM_BACK_OFFSET);
  camera.lookAt(cx, 0, cy);
  directional.position.set(cx + 400, 1100, cy + 300);
  directional.target.position.set(cx, 0, cy);
  directional.target.updateMatrixWorld();
}

export interface TrailBattlePreviewHandle {
  dispose: () => void;
}

export function mountTrailBattlePreview(opts: {
  webglCanvas: HTMLCanvasElement;
  overlayCanvas: HTMLCanvasElement;
  brawlerId: string;
  getTrailId: () => string | null;
  width: number;
  height: number;
}): TrailBattlePreviewHandle {
  const { webglCanvas, overlayCanvas, brawlerId, getTrailId, width, height } = opts;

  clearMotionTrails();

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: webglCanvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch (err) {
    console.warn("[TrailWalkPreview] WebGL init failed:", err);
    return { dispose: () => clearMotionTrails() };
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 6000);
  camera.up.set(0, 0, -1);

  scene.add(new THREE.AmbientLight(0xffffff, 0.32));
  const hemi = new THREE.HemisphereLight(0xfff1d6, 0x6a4d2e, 0.38);
  scene.add(hemi);
  const directional = new THREE.DirectionalLight(0xfff5dc, 1.65);
  directional.position.set(400, 900, -300);
  directional.castShadow = true;
  directional.shadow.mapSize.set(512, 512);
  directional.shadow.camera.left = -420;
  directional.shadow.camera.right = 420;
  directional.shadow.camera.top = 420;
  directional.shadow.camera.bottom = -420;
  directional.shadow.camera.near = 80;
  directional.shadow.camera.far = 2600;
  directional.shadow.bias = -0.00015;
  scene.add(directional);
  scene.add(directional.target);

  let grassField: BinbunGrassField | null = null;
  let disposed = false;
  const base = getHeavyAssetBaseUrl();
  void loadBinbunGrassAssets(base).then(() =>
    createBinbunGrassField(MAP_W, MAP_H, GROUND_PAD, {
      baseUrl: base,
      groundChunks: 8,
      mapW: MAP_W,
      mapH: MAP_H,
    }),
  ).then((field) => {
    if (disposed) {
      disposeBinbunGrassField(field);
      return;
    }
    grassField = field;
    scene.add(field.root);
  }).catch(() => {});

  const stats = BRAWLERS.find(b => b.id === brawlerId) ?? BRAWLERS[0];
  const fakeBrawler = new Brawler(stats, 1, WALK_X_MIN, WALK_Y, "blue", true);
  fakeBrawler.alive = true;

  const displayCharId = CHAR_3D_IDS.has(brawlerId) ? brawlerId : "miya";
  setRenderersBase(base);
  const charRenderer = getCharRenderer(displayCharId);

  let pivot: THREE.Group | null = null;
  let model: THREE.Object3D | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let actions: Partial<Record<AnimSlot, THREE.AnimationAction>> = {};
  let animNames: CharAnimNames = { idle: "Walking", run: "Running", attack: "Attack" };
  let modelReady = false;

  const tryLoadModel = () => {
    if (!charRenderer?.isReady() || modelReady) return;
    const template = charRenderer.cloneModelTemplate();
    if (!template) return;

    fixCharacterSkinnedMeshes(template);
    template.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
      }
    });

    pivot = new THREE.Group();
    model = template;
    pivot.add(model);

    const box = new THREE.Box3().setFromObject(model);
    model.position.y -= box.min.y;

    const desiredHeightPx = Math.max(48, fakeBrawler.radius * 2.4);
    const curH = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y || 1;
    pivot.scale.setScalar(desiredHeightPx / curH);

    scene.add(pivot);
    resetSkinnedBindPose(model);
    model.updateMatrixWorld(true);

    mixer = new THREE.AnimationMixer(model);
    animNames = charRenderer.getAnimNames();
    actions = createPreviewActions(mixer, charRenderer.getClips(), animNames);
    applyRun(mixer, actions, animNames);
    modelReady = true;
  };

  const overlayCtx = overlayCanvas.getContext("2d");
  overlayCanvas.width = width;
  overlayCanvas.height = height;

  let heroX = WALK_X_MIN;
  let dir = 1;
  let last = performance.now();
  let raf = 0;
  let viewSize = applyCameraFrustum(camera, width, height);

  const loop = (now: number) => {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    tryLoadModel();

    heroX += dir * WALK_SPEED * dt;
    if (heroX >= WALK_X_MAX) dir = -1;
    if (heroX <= WALK_X_MIN) dir = 1;

    const moveAngle = dir > 0 ? 0 : Math.PI;
    fakeBrawler.x = heroX;
    fakeBrawler.y = WALK_Y;
    fakeBrawler.moveAngle = moveAngle;
    fakeBrawler.motionTrailId = getTrailId();

    viewSize = applyCameraFrustum(camera, width, height);
    const { viewW, viewH } = viewSize;
    const camX = Math.max(0, Math.min(MAP_W - viewW, heroX - viewW / 2));
    const camY = Math.max(0, Math.min(MAP_H - viewH, WALK_Y - viewH / 2));
    updateBattleCamera(camera, directional, camX, camY, viewW, viewH);

    if (pivot && model && mixer) {
      pivot.position.set(heroX, 0, WALK_Y);
      pivot.rotation.y = Math.PI / 2 - moveAngle;
      mixer.update(dt);
    }

    if (grassField) {
      updateBinbunGrassField(grassField, dt);
      setBinbunGrassStompers(grassField, [{ x: heroX, z: WALK_Y, radius: fakeBrawler.radius }]);
    }

    tickMotionTrails(dt, [fakeBrawler]);

    renderer!.render(scene, camera);

    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, width, height);
      const trailProj: TrailRenderCamera = { camera, canvasW: width, canvasH: height };
      renderMotionTrailsGround(overlayCtx, camX, camY, trailProj);
      renderMotionTrailsAir(overlayCtx, camX, camY, trailProj);
    }

    raf = requestAnimationFrame(loop);
  };

  raf = requestAnimationFrame(loop);

  return {
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      clearMotionTrails();
      if (grassField) disposeBinbunGrassField(grassField);
      if (pivot) scene.remove(pivot);
      mixer?.stopAllAction();
      try { renderer?.dispose(); } catch { /* canvas may already be gone */ }
      renderer = null;
    },
  };
}
