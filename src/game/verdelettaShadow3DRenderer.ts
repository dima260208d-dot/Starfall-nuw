import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { fixCharacterSkinnedMeshes } from "../utils/gltfSkinnedMeshFix";
import { applyGLTFTexturePolicy } from "../utils/texturePolicy";
import { findCharAnimClip, resetSkinnedBindPose } from "./miyaTopDownRenderer";

export const SHADOW_BATTLE_TARGET_H = 3.2;

export interface ShadowAnimNames {
  idle: string;
  idleIdx?: number;
  run: string;
  runIdx?: number;
  attack?: string;
  attackIdx?: number;
}

const SHADOW_ANIM_NAMES: ShadowAnimNames = {
  idle: "Walking",
  idleIdx: 1,
  run: "Running",
  runIdx: 0,
};

export interface ShadowTemplate {
  model: THREE.Object3D;
  clips: THREE.AnimationClip[];
  animNames: ShadowAnimNames;
}

let cachedTemplate: ShadowTemplate | null = null;
let templatePromise: Promise<ShadowTemplate | null> | null = null;
let _base = "/";

function modelUrl(base: string, file: string): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}models/${file}`;
}

/** Яркие материалы — тень должна быть видна на тёмной арене. */
function makeShadowMaterialsVisible(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const srcMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = srcMats.map((m) => {
      const sm = m as THREE.MeshStandardMaterial;
      const tex = sm.isMeshStandardMaterial ? (sm.emissiveMap ?? sm.map) : null;
      return new THREE.MeshBasicMaterial({
        map: tex,
        color: tex ? 0xffffff : 0x1a1a1a,
        side: THREE.DoubleSide,
        transparent: false,
        depthWrite: true,
      });
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
    mesh.castShadow = true;
    mesh.receiveShadow = false;
  });
}

function sanitizeClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => {
    if (t.name.includes(".scale")) return false;
    if (/\.(position|translation)$/.test(t.name) && /armature|root|hips|pelvis/i.test(t.name)) return false;
    return true;
  });
  if (tracks.length === 0) return new THREE.AnimationClip(clip.name, 0, []);
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

function normalizeShadowModel(model: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(model);
  const sz = box.getSize(new THREE.Vector3());
  const center = new THREE.Vector3();
  box.getCenter(center);
  const normScale = sz.y > 0.001 ? SHADOW_BATTLE_TARGET_H / sz.y : 1;
  model.scale.setScalar(normScale);
  const box2 = new THREE.Box3().setFromObject(model);
  model.position.set(-center.x * normScale, -box2.min.y, -center.z * normScale);
  model.updateMatrixWorld(true);
}

function loadFbxAttackClip(base: string): Promise<THREE.AnimationClip | null> {
  return new Promise((resolve) => {
    new FBXLoader().load(
      modelUrl(base, "verdeletta_shadow_move.fbx"),
      (fbx) => resolve(fbx.animations?.[0] ? sanitizeClip(fbx.animations[0]) : null),
      undefined,
      () => resolve(null),
    );
  });
}

function loadShadowTemplate(base: string): Promise<ShadowTemplate | null> {
  return new Promise((resolve) => {
    new GLTFLoader().load(
      modelUrl(base, "verdeletta_shadow.glb"),
      (gltf) => {
        void loadFbxAttackClip(base).then((attackClip) => {
          const model = gltf.scene;
          applyGLTFTexturePolicy(model, null);
          makeShadowMaterialsVisible(model);
          fixCharacterSkinnedMeshes(model);
          normalizeShadowModel(model);
          const clips = (gltf.animations ?? []).map(sanitizeClip).filter(c => c.tracks.length > 0);
          if (attackClip?.tracks.length) clips.push(attackClip);
          resolve({
            model,
            clips,
            animNames: {
              ...SHADOW_ANIM_NAMES,
              attack: attackClip?.name,
              attackIdx: attackClip ? clips.length - 1 : undefined,
            },
          });
        });
      },
      undefined,
      (err) => {
        console.warn("[VerdelettaShadow3D] GLB load failed:", err);
        resolve(null);
      },
    );
  });
}

export function setVerdelettaShadowRenderersBase(base: string): void {
  _base = base;
}

export function invalidateVerdelettaShadowTemplateCache(): void {
  cachedTemplate = null;
  templatePromise = null;
}

export function isVerdelettaShadowTemplateReady(): boolean {
  return cachedTemplate != null;
}

export function getVerdelettaShadowTemplateSync(): ShadowTemplate | null {
  return cachedTemplate;
}

export function preloadVerdelettaShadowModel(base: string): Promise<void> {
  setVerdelettaShadowRenderersBase(base);
  return getVerdelettaShadowTemplate().then(() => {});
}

export function getVerdelettaShadowTemplate(): Promise<ShadowTemplate | null> {
  if (cachedTemplate) return Promise.resolve(cachedTemplate);
  if (!templatePromise) {
    templatePromise = loadShadowTemplate(_base).then((t) => {
      if (t) cachedTemplate = t;
      return t;
    });
  }
  return templatePromise;
}

export function cloneShadowModelForBattle(template: ShadowTemplate): THREE.Object3D | null {
  try {
    const clone = cloneSkinned(template.model) as THREE.Object3D;
    fixCharacterSkinnedMeshes(clone);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
    });
    return clone;
  } catch {
    return null;
  }
}

export function snapShadowModelFeet(model: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(model);
  model.position.y -= box.min.y;
  model.updateMatrixWorld(true);
  return (new THREE.Box3().setFromObject(model)).getSize(new THREE.Vector3()).y;
}

export function createShadowBattleActions(
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
  names: ShadowAnimNames,
): {
  idle: THREE.AnimationAction | null;
  run: THREE.AnimationAction | null;
  attack: THREE.AnimationAction | null;
} {
  const mk = (clip: THREE.AnimationClip | null, loop: THREE.AnimationActionLoopStyles) => {
    if (!clip?.tracks.length) return null;
    const a = mixer.clipAction(clip);
    a.setLoop(loop, loop === THREE.LoopRepeat ? Infinity : 1);
    a.clampWhenFinished = loop === THREE.LoopOnce;
    return a;
  };
  const idleClip = findCharAnimClip(clips, names.idle, names.idleIdx);
  const runClip = findCharAnimClip(clips, names.run, names.runIdx);
  const attackClip = findCharAnimClip(clips, names.attack ?? names.run, names.attackIdx) ?? runClip;
  return {
    idle: mk(idleClip, THREE.LoopRepeat),
    run: mk(runClip, THREE.LoopRepeat),
    attack: mk(attackClip, THREE.LoopOnce),
  };
}

export function enterShadowStanding(
  mixer: THREE.AnimationMixer | null,
  model: THREE.Object3D,
  idleAction: THREE.AnimationAction | null,
  runAction: THREE.AnimationAction | null,
): void {
  if (!mixer) return;
  mixer.stopAllAction();
  const pose = idleAction ?? runAction;
  if (pose) {
    pose.reset();
    pose.setEffectiveWeight(1);
    pose.paused = false;
    pose.setEffectiveTimeScale(0);
    pose.play();
    pose.time = 0;
    mixer.update(0);
  } else {
    resetSkinnedBindPose(model);
  }
}

export function applyShadowRun(mixer: THREE.AnimationMixer | null, runAction: THREE.AnimationAction | null): void {
  if (!mixer || !runAction) return;
  mixer.stopAllAction();
  runAction.reset();
  runAction.setLoop(THREE.LoopRepeat, Infinity);
  runAction.clampWhenFinished = false;
  runAction.setEffectiveWeight(1);
  runAction.paused = false;
  runAction.setEffectiveTimeScale(1);
  runAction.play();
}

export function applyShadowAttack(
  mixer: THREE.AnimationMixer | null,
  runAction: THREE.AnimationAction | null,
  attackAction: THREE.AnimationAction | null,
): void {
  if (!mixer) return;
  const action = attackAction ?? runAction;
  if (!action) return;
  mixer.stopAllAction();
  action.reset();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.setEffectiveWeight(1);
  action.paused = false;
  action.setEffectiveTimeScale(1.15);
  action.play();
}

export function maintainShadowRun(mixer: THREE.AnimationMixer | null, runAction: THREE.AnimationAction | null): void {
  if (!mixer || !runAction) return;
  if (!runAction.isRunning() || runAction.paused || runAction.getEffectiveTimeScale() === 0) {
    applyShadowRun(mixer, runAction);
  }
}
