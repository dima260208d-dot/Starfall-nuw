import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { fixCharacterSkinnedMeshes } from "../utils/gltfSkinnedMeshFix";
import { applyGLTFTexturePolicy } from "../utils/texturePolicy";

/** Pets with shipped GLB models — others are removed from the game. */
export const PET_3D_IDS = new Set([
  "fluffy_healer",
  "swift_rabbit",
  "shadow_wolf",
  "fire_fox",
  "golden_beetle",
  "stone_turtle",
  "phoenix",
]);

/** Normalized model height in world units — matches brawler GLB setup. */
export const PET_BATTLE_TARGET_H = 3.2;

export interface PetUIPreviewTune {
  /** Множитель целевой высоты (1 = авто). */
  heightScale?: number;
  /** Сдвиг точки взгляда камеры вниз — модель выше в кадре, уши не обрезаются. */
  lookAtDy?: number;
  /** Доп. отдаление камеры (>1 — меньше обрезка). */
  cameraMult?: number;
  /** Сдвиг модели вверх после нормализации. */
  modelYOffset?: number;
  /** Доп. вертикальный запас кадра (>1 — уши/рога не обрезаются). */
  heightMargin?: number;
  /** Доп. высота bbox сверху (уши скелета не попадают в Box3). */
  bboxPadTop?: number;
}

/** Тонкая настройка превью в меню (только UI, бой не затрагивается). */
export const PET_UI_PREVIEW: Record<string, PetUIPreviewTune> = {
  swift_rabbit: {
    heightScale: 1.12,
    lookAtDy: 0.06,
    cameraMult: 1.3,
    modelYOffset: -0.02,
    heightMargin: 1.48,
    bboxPadTop: 0.38,
  },
};

export function petIdFromModelUrl(url: string): string | null {
  const m = url.match(/models\/pets\/([^/?#]+)\.glb/i);
  return m ? m[1] : null;
}

export function getPetUIPreview(urlOrId: string): PetUIPreviewTune {
  const id = urlOrId.includes("models/pets/") ? petIdFromModelUrl(urlOrId) : urlOrId;
  if (!id) return {};
  return PET_UI_PREVIEW[id] ?? {};
}

export function getPetUIHeightScale(urlOrId: string): number {
  return getPetUIPreview(urlOrId).heightScale ?? 1;
}

export interface PetAnimNames {
  run: string;
  runIdx?: number;
  walk?: string;
  walkIdx?: number;
  effect?: string;
  effectIdx?: number;
}

const PET_ANIM_NAMES: Record<string, PetAnimNames> = {
  fluffy_healer: { run: "Armature|Unreal Take|baselayer" },
  swift_rabbit:  { run: "Armature|Unreal Take|baselayer" },
  shadow_wolf:   { run: "Armature|Unreal Take|baselayer" },
  fire_fox:      { run: "Armature|Unreal Take|baselayer" },
  golden_beetle: { run: "Armature|Unreal Take|baselayer" },
  stone_turtle:  { run: "Armature|Unreal Take|baselayer" },
  phoenix:       { run: "Running", runIdx: 0, walk: "Walking", walkIdx: 1, effect: "Walking", effectIdx: 1 },
};

export function getPetAnimNames(petId: string): PetAnimNames {
  return PET_ANIM_NAMES[petId] ?? { run: "Armature|Unreal Take|baselayer" };
}

export function petModelUrl(base: string, petId: string): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}models/pets/${petId}.glb`;
}

export function petBackgroundUrl(base: string, petId: string): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}pets/backgrounds/${petId}.png`;
}

/** Layered page backdrop: pet PNG scene (same style as brawler menu backgrounds). */
export function petPageBackgroundStyle(
  base: string,
  pet: { id: string; color: string; secondaryColor: string } | null | undefined,
): { backgroundImage: string; backgroundColor: string } {
  if (!pet) {
    return { backgroundImage: petPageBackgroundCss(null), backgroundColor: "#030a06" };
  }
  return {
    backgroundImage: `url("${petBackgroundUrl(base, pet.id)}")`,
    backgroundColor: pet.secondaryColor,
  };
}

/** Rich layered CSS backdrop for pets menu/collection (fallback under PNG). */
export function petPageBackgroundCss(
  pet: { color: string; secondaryColor: string } | null | undefined,
): string {
  if (!pet) {
    return [
      "radial-gradient(ellipse 90% 70% at 50% 18%, rgba(118,255,3,0.28) 0%, transparent 55%)",
      "radial-gradient(ellipse 80% 60% at 85% 85%, rgba(46,125,50,0.35) 0%, transparent 50%)",
      "radial-gradient(ellipse 70% 55% at 12% 72%, rgba(27,94,32,0.30) 0%, transparent 48%)",
      "linear-gradient(165deg, #14532d 0%, #0a2818 42%, #030a06 100%)",
    ].join(", ");
  }
  return [
    `radial-gradient(ellipse 95% 75% at 50% 15%, ${pet.color}99 0%, transparent 58%)`,
    `radial-gradient(ellipse 85% 65% at 88% 88%, ${pet.secondaryColor}77 0%, transparent 52%)`,
    `radial-gradient(ellipse 75% 60% at 10% 75%, ${pet.color}55 0%, transparent 50%)`,
    `linear-gradient(165deg, ${pet.secondaryColor} 0%, #0a1f12 48%, #030a06 100%)`,
  ].join(", ");
}

interface PetTemplate {
  model: THREE.Object3D;
  clips: THREE.AnimationClip[];
  animNames: PetAnimNames;
  normScale: number;
}

const templateCache = new Map<string, Promise<PetTemplate | null>>();
let _base = "/";

function fixMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      m.side = THREE.DoubleSide;
      m.depthWrite = true;
      const sm = m as THREE.MeshStandardMaterial;
      if (sm.opacity !== undefined && sm.opacity >= 0.98) m.transparent = false;
      m.needsUpdate = true;
    }
  });
  applyGLTFTexturePolicy(root, null);
}

function findClip(clips: THREE.AnimationClip[], name: string, idx?: number): THREE.AnimationClip | null {
  if (idx != null && clips[idx]?.name === name) return clips[idx];
  const exact = clips.find(c => c.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  return clips.find(c => c.name.toLowerCase().includes(lower)) ?? clips[0] ?? null;
}

/** Strip scale/root-motion tracks — Unreal exports break skinned pets in battle. */
export function sanitizePetClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => {
    if (t.name.includes(".scale")) return false;
    if (/\.(position|translation)$/.test(t.name) && /armature|root|hips|pelvis/i.test(t.name)) return false;
    return true;
  });
  if (tracks.length === 0) return new THREE.AnimationClip(clip.name, 0, []);
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export function sanitizePetClips(clips: THREE.AnimationClip[]): THREE.AnimationClip[] {
  return clips.map(sanitizePetClip).filter(c => c.tracks.length > 0);
}

function optimizePetBattleMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const srcMats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = srcMats.map((m) => {
      if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) return m;
      const sm = m as THREE.MeshStandardMaterial;
      return new THREE.MeshBasicMaterial({
        map: sm.emissiveMap ?? sm.map ?? null,
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: sm.transparent,
        opacity: sm.opacity,
        depthWrite: true,
      });
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}

/** Snapshot bone scales so Unreal baselayer cannot inflate skinned pets. */
export function capturePetBindScales(root: THREE.Object3D): Map<THREE.Object3D, THREE.Vector3> {
  const bindScales = new Map<THREE.Object3D, THREE.Vector3>();
  root.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh || obj.type === "Bone") {
      bindScales.set(obj, obj.scale.clone());
    }
  });
  return bindScales;
}

export function restorePetBindScales(bindScales: Map<THREE.Object3D, THREE.Vector3>): void {
  for (const [obj, scale] of bindScales) {
    obj.scale.copy(scale);
  }
}

/** Bake feet-on-ground + uniform height into the template (same idea as brawler GLBs). */
function normalizePetModelForBattle(model: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(model);
  const sz = box.getSize(new THREE.Vector3());
  const center = new THREE.Vector3();
  box.getCenter(center);
  const normScale = sz.y > 0.001 ? PET_BATTLE_TARGET_H / sz.y : 1;
  model.scale.setScalar(normScale);
  const box2 = new THREE.Box3().setFromObject(model);
  model.position.set(-center.x * normScale, -box2.min.y, -center.z * normScale);
  model.updateMatrixWorld(true);
  return normScale;
}

export function setPetRenderersBase(base: string): void {
  _base = base;
}

export function invalidatePetTemplateCache(): void {
  templateCache.clear();
}

export function preloadPetModels(base: string): Promise<void> {
  setPetRenderersBase(base);
  return Promise.all(
    Array.from(PET_3D_IDS).map(id =>
      loadPetTemplate(id).then(() => {}).catch(() => {}),
    ),
  ).then(() => {});
}

function loadPetTemplate(petId: string): Promise<PetTemplate | null> {
  if (!PET_3D_IDS.has(petId)) return Promise.resolve(null);
  const hit = templateCache.get(petId);
  if (hit) return hit;

  const p = new Promise<PetTemplate | null>((resolve) => {
    new GLTFLoader().load(
      petModelUrl(_base, petId),
      (gltf) => {
        const model = gltf.scene;
        fixMaterials(model);
        fixCharacterSkinnedMeshes(model);
        optimizePetBattleMaterials(model);
        const normScale = normalizePetModelForBattle(model);
        resolve({
          model,
          clips: sanitizePetClips(gltf.animations ?? []),
          animNames: getPetAnimNames(petId),
          normScale,
        });
      },
      undefined,
      () => resolve(null),
    );
  });
  templateCache.set(petId, p);
  return p;
}

export function getPetTemplate(petId: string): Promise<PetTemplate | null> {
  return loadPetTemplate(petId);
}

/** Per-instance battle clone — shares baked BasicMaterials from template (lighter GPU). */
export function clonePetModelForBattle(template: PetTemplate): THREE.Object3D | null {
  try {
    const clone = cloneSkinned(template.model) as THREE.Object3D;
    fixCharacterSkinnedMeshes(clone);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
    });
    return clone;
  } catch {
    return null;
  }
}

/** Per-instance clone — keep emissive/base maps (pets use emissiveTexture as albedo). */
export function clonePetModel(template: PetTemplate): THREE.Object3D | null {
  try {
    const clone = cloneSkinned(template.model) as THREE.Object3D;
    fixCharacterSkinnedMeshes(clone);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = true;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(m => m.clone());
      } else if (mesh.material) {
        mesh.material = mesh.material.clone();
      }
    });
    applyGLTFTexturePolicy(clone, null);
    return clone;
  } catch {
    return null;
  }
}

/** @deprecated use clonePetModel — kept so older imports don't break. */
export function optimizePetModelForBattle(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
}

export function createPetBattleActions(
  mixer: THREE.AnimationMixer,
  clips: THREE.AnimationClip[],
  names: PetAnimNames,
): {
  run: THREE.AnimationAction | null;
  effect: THREE.AnimationAction | null;
} {
  const runClip = findClip(clips, names.run, names.runIdx);
  const effectName = names.effect ?? names.walk ?? names.run;
  const effectIdx = names.effectIdx ?? names.walkIdx ?? names.runIdx;
  const effectClip = findClip(clips, effectName, effectIdx) ?? runClip;

  const mk = (clip: THREE.AnimationClip | null, loop: THREE.AnimationActionLoopStyles) => {
    if (!clip || clip.tracks.length === 0) return null;
    const a = mixer.clipAction(clip);
    a.setLoop(loop, loop === THREE.LoopRepeat ? Infinity : 1);
    a.clampWhenFinished = loop === THREE.LoopOnce;
    return a;
  };

  return {
    run: mk(runClip, THREE.LoopRepeat),
    effect: mk(effectClip, THREE.LoopOnce),
  };
}

export function enterPetStanding(
  mixer: THREE.AnimationMixer | null,
  runAction: THREE.AnimationAction | null,
): void {
  if (!mixer) return;
  mixer.stopAllAction();
  if (!runAction) return;
  runAction.reset();
  runAction.setEffectiveWeight(1);
  runAction.paused = false;
  runAction.setEffectiveTimeScale(0);
  runAction.play();
  runAction.time = 0;
  mixer.update(0);
  mixer.update(1 / 60);
}

export function applyPetRun(mixer: THREE.AnimationMixer | null, runAction: THREE.AnimationAction | null): void {
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

/** Keep locomotion looping while the pet is moving (Unreal clips can stop after one cycle). */
export function maintainPetRun(mixer: THREE.AnimationMixer | null, runAction: THREE.AnimationAction | null): void {
  if (!mixer || !runAction) return;
  if (!runAction.isRunning() || runAction.paused || runAction.getEffectiveTimeScale() === 0) {
    applyPetRun(mixer, runAction);
  }
}

export function applyPetEffect(
  mixer: THREE.AnimationMixer | null,
  runAction: THREE.AnimationAction | null,
  effectAction: THREE.AnimationAction | null,
): void {
  if (!mixer) return;
  mixer.stopAllAction();
  if (effectAction) {
    effectAction.reset();
    effectAction.setEffectiveWeight(1);
    effectAction.paused = false;
    effectAction.setEffectiveTimeScale(1);
    effectAction.play();
  } else if (runAction) {
    applyPetRun(mixer, runAction);
  }
}

/** UI preview — phoenix walks; other pets loop sanitized baselayer locomotion. */
export function getPetPreviewAnim(petId: string): { anim: string; idx?: number } {
  if (petId === "phoenix") return { anim: "Walking", idx: 1 };
  return { anim: "Armature|Unreal Take|baselayer", idx: 0 };
}

export const PET_UI_MODEL_URLS: Record<string, string> = Object.fromEntries(
  Array.from(PET_3D_IDS).map(id => [id, `models/pets/${id}.glb`]),
);
