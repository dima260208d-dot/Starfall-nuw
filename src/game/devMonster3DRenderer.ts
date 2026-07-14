import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { fixCharacterSkinnedMeshes } from "../utils/gltfSkinnedMeshFix";
import { applyGLTFTexturePolicy } from "../utils/texturePolicy";
import { resetSkinnedBindPose } from "./miyaTopDownRenderer";
import {
  devImportedModelUrl,
  devImportedModelAssetBase,
  getDevMonsterModelById,
  type DevImportedModelEntry,
} from "../data/devImportedModels";

export const DEV_MONSTER_BATTLE_TARGET_H = 3.4;

export interface DevMonsterTemplate {
  model: THREE.Object3D;
  clips: THREE.AnimationClip[];
}

const templateCache = new Map<string, DevMonsterTemplate>();
const templatePromises = new Map<string, Promise<DevMonsterTemplate | null>>();
let _base = "/";

export function setDevMonsterRenderersBase(base: string): void {
  _base = base;
}

function normalizeModel(model: THREE.Object3D): void {
  model.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const sm = m as THREE.MeshStandardMaterial;
      if (sm.isMeshStandardMaterial) {
        sm.side = THREE.DoubleSide;
      }
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const sz = box.getSize(new THREE.Vector3());
  const center = new THREE.Vector3();
  box.getCenter(center);
  const scale = sz.y > 0.001 ? DEV_MONSTER_BATTLE_TARGET_H / sz.y : 1;
  model.scale.setScalar(scale);
  model.position.x -= center.x * scale;
  model.position.z -= center.z * scale;
  model.position.y -= box.min.y * scale;
}

function loadTemplate(entry: DevImportedModelEntry): Promise<DevMonsterTemplate | null> {
  const cached = templateCache.get(entry.id);
  if (cached) return Promise.resolve(cached);
  const pending = templatePromises.get(entry.id);
  if (pending) return pending;

  const promise = new Promise<DevMonsterTemplate | null>((resolve) => {
    const loader = new GLTFLoader();
    const url = devImportedModelUrl(_base, entry);
    loader.setPath(devImportedModelAssetBase(_base, entry));
    loader.load(
      entry.fileName,
      (gltf) => {
        const model = cloneSkinned(gltf.scene);
        fixCharacterSkinnedMeshes(model);
        applyGLTFTexturePolicy(model);
        normalizeModel(model);
        model.frustumCulled = false;
        model.traverse((o) => { o.frustumCulled = false; });
        const tpl: DevMonsterTemplate = { model, clips: gltf.animations ?? [] };
        templateCache.set(entry.id, tpl);
        templatePromises.delete(entry.id);
        resolve(tpl);
      },
      undefined,
      () => {
        templatePromises.delete(entry.id);
        resolve(null);
      },
    );
  });
  templatePromises.set(entry.id, promise);
  return promise;
}

export function getDevMonsterTemplateSync(modelId: string): DevMonsterTemplate | null {
  return templateCache.get(modelId) ?? null;
}

export function isDevMonsterTemplateReady(modelId: string): boolean {
  return templateCache.has(modelId);
}

export function preloadDevMonsterModel(modelId: string): Promise<DevMonsterTemplate | null> {
  const entry = getDevMonsterModelById(modelId);
  if (!entry) return Promise.resolve(null);
  return loadTemplate(entry);
}

export function preloadDevMonsterModels(modelIds: readonly string[]): Promise<void> {
  const unique = [...new Set(modelIds)];
  return Promise.all(unique.map(id => preloadDevMonsterModel(id))).then(() => {});
}

export function cloneDevMonsterForBattle(modelId: string): {
  model: THREE.Object3D;
  clips: THREE.AnimationClip[];
} | null {
  const tpl = templateCache.get(modelId);
  if (!tpl) return null;
  const model = cloneSkinned(tpl.model);
  resetSkinnedBindPose(model);
  return { model, clips: tpl.clips };
}

export function pickMonsterAnimClip(clips: THREE.AnimationClip[], names: string[]): THREE.AnimationClip | null {
  if (!clips.length) return null;
  for (const n of names) {
    const exact = clips.find(c => c.name.toLowerCase() === n.toLowerCase());
    if (exact) return exact;
  }
  for (const n of names) {
    const hit = clips.find(c => c.name.toLowerCase().includes(n.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

export interface DevMonsterAnimClips {
  idle: THREE.AnimationClip | null;
  run: THREE.AnimationClip | null;
  attack: THREE.AnimationClip | null;
}

/** Имена клипов в glTF: Idle, Run, Jump, Punch, Weapon, HitRecieve… */
export function resolveDevMonsterAnimClips(clips: THREE.AnimationClip[]): DevMonsterAnimClips {
  const attack =
    pickMonsterAnimClip(clips, ["Punch", "Weapon"])
    ?? pickMonsterAnimClip(clips, ["HitRecieve", "HitReceive", "HitReact"]);

  const run =
    pickMonsterAnimClip(clips, ["Run"])
    ?? pickMonsterAnimClip(clips, ["Jump"]);

  return {
    idle: pickMonsterAnimClip(clips, ["Idle", "idle", "stand"]),
    run,
    attack,
  };
}

export function snapDevMonsterFeet(model: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(model);
  return box.max.y;
}
