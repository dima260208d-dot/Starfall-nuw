import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { applyCanvasBitmapDrawPolicy, applyGLTFTexturePolicy } from "../utils/texturePolicy";
import { getHeavyAssetBaseUrl } from "../lib/assetBase";

const SZ = 160;

function getBaseUrl(): string {
  return getHeavyAssetBaseUrl().replace(/\/$/, "");
}

function lightEnough(hex: number): boolean {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return r + g + b > 36;
}

function upgradeMeshMaterial(mesh: THREE.Mesh, m: THREE.Material): THREE.Material {
  if (m instanceof THREE.MeshStandardMaterial) {
    if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
    if (!lightEnough(m.color.getHex())) m.color.setHex(m.map ? 0xffffff : 0xf2f2f2);
    m.roughness = Math.min(1, Math.max(0.25, m.roughness));
    m.metalness = Math.min(0.2, m.metalness);
    m.side = THREE.DoubleSide;
    m.depthWrite = true;
    m.needsUpdate = true;
    return m;
  }
  if (
    m instanceof THREE.MeshPhongMaterial ||
    m instanceof THREE.MeshLambertMaterial ||
    m instanceof THREE.MeshBasicMaterial
  ) {
    const colorHex = m.color.getHex();
    const nm = new THREE.MeshStandardMaterial({
      map: "map" in m && m.map ? (m as THREE.MeshPhongMaterial).map : undefined,
      color: lightEnough(colorHex) ? colorHex : 0xffffff,
      roughness: 0.4,
      metalness: 0.06,
      side: THREE.DoubleSide,
      transparent: m.transparent,
      opacity: m.opacity,
    });
    if (nm.map) nm.map.colorSpace = THREE.SRGBColorSpace;
    m.dispose();
    return nm;
  }
  m.side = THREE.DoubleSide;
  m.depthWrite = true;
  m.needsUpdate = true;
  return m;
}

function fixMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material)
      ? mesh.material as THREE.Material[]
      : [mesh.material as THREE.Material];
    const next = mats.map((mat) => upgradeMeshMaterial(mesh, mat));
    mesh.material = next.length === 1 ? next[0]! : next;
  });
  applyGLTFTexturePolicy(root, getRenderer());
}

function buildScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 2.6));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6a7a, 0.65));
  const d1 = new THREE.DirectionalLight(0xfff5e0, 1.55);
  d1.position.set(5, 10, 5);
  scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xe8e0ff, 0.85);
  d2.position.set(-4, 6, -2);
  scene.add(d2);
  return scene;
}

let sharedRenderer: THREE.WebGLRenderer | null = null;
function getRenderer(): THREE.WebGLRenderer | null {
  if (sharedRenderer) return sharedRenderer;
  try {
    const r = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    r.setSize(SZ, SZ);
    r.setPixelRatio(1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
    r.setClearColor(0x000000, 0);
    sharedRenderer = r;
    return r;
  } catch {
    return null;
  }
}

let ballTemplate: THREE.Group | null = null;
let ballDrawMesh: THREE.Group | null = null;
let ballLoading: Promise<void> | null = null;
let ballReady = false;

let outputCanvas: HTMLCanvasElement | null = null;
let outputCtx: CanvasRenderingContext2D | null = null;

function ensureOutputCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!outputCanvas || !outputCtx) {
    outputCanvas = document.createElement("canvas");
    outputCanvas.width = SZ;
    outputCanvas.height = SZ;
    outputCtx = outputCanvas.getContext("2d");
  }
  if (!outputCtx) throw new Error("2d context unavailable");
  return { canvas: outputCanvas, ctx: outputCtx };
}

const _axis = new THREE.Vector3();
const _dq = new THREE.Quaternion();

/** Rolling without slip on horizontal plane (Y-up): ω = (up × v) / r */
export function integrateBallRolling(
  quat: THREE.Quaternion,
  vx: number,
  vy: number,
  dt: number,
  radiusWorld: number,
): void {
  if (radiusWorld < 1e-6 || dt < 1e-9) return;
  const speed = Math.hypot(vx, vy);
  if (speed < 1e-4) return;
  const angle = (speed / radiusWorld) * dt;
  _axis.set(vy, 0, -vx).multiplyScalar(1 / speed);
  _dq.setFromAxisAngle(_axis, angle);
  quat.premultiply(_dq);
  quat.normalize();
}

/** Loads `star_ball.glb` for per-frame rolling render (same asset as menu sprite). */
export function loadRollingStarBallModel(base?: string): Promise<void> {
  if (ballReady) return Promise.resolve();
  if (ballLoading) return ballLoading;

  const url = `${(base ?? getBaseUrl())}/models/star_ball.glb`;
  ballLoading = new Promise((resolve) => {
    const renderer = getRenderer();
    if (!renderer) {
      ballLoading = null;
      resolve();
      return;
    }

    new GLTFLoader().load(
      url,
      (gltf) => {
        try {
          const root = gltf.scene.clone(true);
          fixMaterials(root);

          const box3 = new THREE.Box3().setFromObject(root);
          const center = box3.getCenter(new THREE.Vector3());
          const size = box3.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = 7.0 / maxDim;
          root.position.set(-center.x * scale, -box3.min.y * scale, -center.z * scale);
          root.scale.setScalar(scale);

          ballTemplate = root;
          ballDrawMesh = root.clone(true);
          ballReady = true;
          ballLoading = null;
          resolve();
        } catch {
          ballLoading = null;
          resolve();
        }
      },
      undefined,
      (err) => {
        console.warn("[RollingStarBall] GLB load failed", url, err);
        ballLoading = null;
        resolve();
      },
    );
  });

  return ballLoading;
}

export function isRollingStarBallReady(): boolean {
  return ballReady && ballDrawMesh !== null;
}

/** True if the 2D copy of the WebGL frame has almost no opaque pixels (broken alpha / empty render). */
export function isRollingBallFrameBlank(canvas: HTMLCanvasElement): boolean {
  const c = canvas.getContext("2d", { willReadFrequently: true });
  if (!c || canvas.width < 8 || canvas.height < 8) return true;
  const w = canvas.width;
  const h = canvas.height;
  const img = c.getImageData(Math.floor(w / 2) - 4, Math.floor(h / 2) - 4, 8, 8).data;
  let sum = 0;
  for (let i = 3; i < img.length; i += 4) sum += img[i];
  return sum < 64 * 12;
}

/** Renders star ball with rolling orientation (ortho camera aligned with baked sprite). */
export function renderRollingStarBall(quat: THREE.Quaternion): HTMLCanvasElement | null {
  if (!ballDrawMesh || !ballReady) return null;
  const renderer = getRenderer();
  if (!renderer) return null;
  const { canvas, ctx } = ensureOutputCanvas();

  ballDrawMesh.quaternion.copy(quat);
  ballDrawMesh.removeFromParent();

  const scene = buildScene();
  scene.add(ballDrawMesh);

  const H = 5.5;
  const camera = new THREE.OrthographicCamera(-H, H, H, -H, 0.1, 200);
  camera.position.set(1, 6, 6);
  camera.lookAt(0, 1, 0);

  renderer.setSize(SZ, SZ);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);

  applyCanvasBitmapDrawPolicy(ctx);
  ctx.clearRect(0, 0, SZ, SZ);
  ctx.drawImage(renderer.domElement, 0, 0);

  return canvas;
}

/** @deprecated use loadRollingStarBallModel */
export const loadSoccerBallModel = loadRollingStarBallModel;
/** @deprecated use isRollingStarBallReady */
export const isSoccerBallReady = isRollingStarBallReady;
/** @deprecated use renderRollingStarBall */
export function renderSoccerBall(quat: THREE.Quaternion, _diameterPx: number): HTMLCanvasElement | null {
  return renderRollingStarBall(quat);
}
