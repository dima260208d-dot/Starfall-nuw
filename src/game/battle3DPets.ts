import * as THREE from "three";
import type { Brawler } from "../entities/Brawler";
import {
  PET_3D_IDS,
  PET_BATTLE_TARGET_H,
  clonePetModelForBattle,
  createPetBattleActions,
  enterPetStanding,
  applyPetRun,
  applyPetEffect,
  maintainPetRun,
  getPetTemplate,
  setPetRenderersBase,
  preloadPetModels,
  invalidatePetTemplateCache,
  capturePetBindScales,
  restorePetBindScales,
} from "./pet3DRenderer";

const BATTLE_PET_LOGIC_VERSION = 12;
const PET_SIZE_MULT = 1.65;
const CELL = 50;

interface BushFriendlyCell {
  tx: number;
  ty: number;
}

/** Same bush rules as brawler 3D bodies — hide enemy pets unless revealed. */
function isPetHiddenFromViewer(
  b: Brawler,
  viewerTeam: string | undefined,
  friendliesInBush: BushFriendlyCell[],
): boolean {
  const isEnemyToViewer = viewerTeam !== undefined && !b.isPlayer && b.team !== viewerTeam;
  if (!isEnemyToViewer || !b.inBush) return false;
  if (b.bushRevealTimer > 0) return false;
  const bTx = Math.floor(b.x / CELL);
  const bTy = Math.floor(b.y / CELL);
  for (const f of friendliesInBush) {
    if (Math.abs(bTx - f.tx) <= 1 && Math.abs(bTy - f.ty) <= 1) return false;
  }
  return true;
}

function setPetOpacity(entry: PetMeshEntry, opacity: number): void {
  if (Math.abs(entry.lastOpacity - opacity) < 0.01) return;
  entry.lastOpacity = opacity;
  const transparent = opacity < 0.99;
  entry.model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const mm = mat as THREE.Material & { transparent: boolean; opacity: number };
      if (mm.transparent !== transparent) mm.transparent = transparent;
      mm.opacity = opacity;
    }
  });
}

interface PetMeshEntry {
  petId: string;
  pivot: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  runAction: THREE.AnimationAction | null;
  effectAction: THREE.AnimationAction | null;
  teamRing: THREE.Mesh;
  teamRingMat: THREE.MeshBasicMaterial;
  currentAnim: "idle" | "run" | "effect";
  lastX: number;
  lastY: number;
  movingSmoothed: number;
  lastOpacity: number;
  logicVersion: number;
  baseScale: number;
  canAnimate: boolean;
  bindScales: Map<THREE.Object3D, THREE.Vector3>;
}

const petMeshes = new Map<string, PetMeshEntry>();
const pendingBuilds = new Set<string>();

function removePetEntry(ownerId: string, entry: PetMeshEntry, scene: THREE.Scene): void {
  scene.remove(entry.pivot);
  scene.remove(entry.teamRing);
  (entry.teamRing.material as THREE.Material).dispose();
  entry.teamRing.geometry.dispose();
  entry.mixer?.stopAllAction();
  petMeshes.delete(ownerId);
}

function lockPetTransform(entry: PetMeshEntry): void {
  entry.pivot.scale.setScalar(entry.baseScale);
}

async function buildPetMesh(b: Brawler, scene: THREE.Scene): Promise<void> {
  const pet = b.equippedPet;
  if (!pet || !PET_3D_IDS.has(pet.id) || petMeshes.has(b.id)) return;
  const template = await getPetTemplate(pet.id);
  if (!template) return;
  const model = clonePetModelForBattle(template);
  if (!model) return;

  const pivot = new THREE.Group();
  pivot.add(model);

  const desiredH = Math.max(18, b.radius * 0.62) * PET_SIZE_MULT;
  const baseScale = desiredH / PET_BATTLE_TARGET_H;
  pivot.scale.setScalar(baseScale);
  scene.add(pivot);

  const ringR = Math.max(10, b.radius * 0.38) * PET_SIZE_MULT;
  const ringGeom = new THREE.RingGeometry(ringR * 0.92, ringR * 1.08, 8);
  ringGeom.rotateX(-Math.PI / 2);
  const teamRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false,
  });
  const teamRing = new THREE.Mesh(ringGeom, teamRingMat);
  teamRing.position.y = 0.4;
  scene.add(teamRing);

  const bindScales = capturePetBindScales(model);
  let mixer: THREE.AnimationMixer | null = null;
  let run: THREE.AnimationAction | null = null;
  let effect: THREE.AnimationAction | null = null;
  if (template.clips.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    ({ run, effect } = createPetBattleActions(mixer, template.clips, template.animNames));
    enterPetStanding(mixer, run);
  }
  const canAnimate = !!(mixer && run);

  petMeshes.set(b.id, {
    petId: pet.id,
    pivot, model, mixer,
    runAction: run, effectAction: effect,
    teamRing, teamRingMat, currentAnim: "idle",
    lastX: b.petFollowX, lastY: b.petFollowY,
    movingSmoothed: 0, lastOpacity: 1,
    logicVersion: BATTLE_PET_LOGIC_VERSION,
    baseScale, canAnimate, bindScales,
  });
}

function syncPetEntry(
  entry: PetMeshEntry,
  b: Brawler,
  dt: number,
  viewerTeam?: string,
  friendliesInBush: BushFriendlyCell[] = [],
): void {
  if (!b.alive || !b.equippedPet) {
    entry.pivot.visible = false;
    entry.teamRing.visible = false;
    return;
  }
  const hiddenByBush = isPetHiddenFromViewer(b, viewerTeam, friendliesInBush);
  entry.pivot.visible = !hiddenByBush;
  entry.teamRing.visible = !hiddenByBush;
  if (!hiddenByBush) {
    setPetOpacity(entry, b.inBush ? 0.55 : 1.0);
  }

  entry.pivot.position.set(b.petFollowX, 0, b.petFollowY);
  entry.teamRing.position.set(b.petFollowX, 0.4, b.petFollowY);

  let color = 0xffffff;
  if (viewerTeam !== undefined) {
    if (b.isPlayer) color = 0x4caf50;
    else if (b.team === viewerTeam) color = 0x2196f3;
    else color = 0xf44336;
  }
  if (entry.teamRingMat.color.getHex() !== color) entry.teamRingMat.color.setHex(color);

  const pulse = b.petEffectPulse ?? 0;
  const wantsRun = entry.canAnimate && !!entry.runAction && b.petOwnerMovingSmoothed > 0.35;
  const wantsEffect = entry.canAnimate && pulse > 0 && !!entry.effectAction;
  let desired: "idle" | "run" | "effect" = wantsEffect ? "effect" : wantsRun ? "run" : "idle";
  // Match brawler facing — when idle on the flank, pet looks in the last move direction.
  entry.pivot.rotation.y = Math.PI / 2 - b.getBallCarryFacingRad();

  if (entry.canAnimate && desired !== entry.currentAnim) {
    entry.currentAnim = desired;
    if (desired === "idle") enterPetStanding(entry.mixer, entry.runAction);
    else if (desired === "run") applyPetRun(entry.mixer, entry.runAction);
    else applyPetEffect(entry.mixer, entry.runAction, entry.effectAction);
  } else if (desired === "run") {
    maintainPetRun(entry.mixer, entry.runAction);
    entry.currentAnim = "run";
  } else if (!entry.canAnimate && entry.currentAnim !== "idle") {
    enterPetStanding(entry.mixer, entry.runAction);
    entry.currentAnim = "idle";
  }

  if (entry.canAnimate && entry.mixer) {
    if (desired === "idle") {
      entry.mixer.update(0);
    } else {
      entry.mixer.update(Math.min(0.05, dt));
      restorePetBindScales(entry.bindScales);
    }
  }
  lockPetTransform(entry);
}

export function initBattle3DPets(base: string): void {
  invalidatePetTemplateCache();
  setPetRenderersBase(base);
  void preloadPetModels(base);
}

export function syncBattle3DPets(
  scene: THREE.Scene | null,
  brawlers: Brawler[],
  dt: number,
  viewerTeam?: string,
  friendliesInBush: BushFriendlyCell[] = [],
): void {
  if (!scene) return;
  const alive = new Set<string>();
  for (const b of brawlers) {
    if (!b.alive || !b.equippedPet || !PET_3D_IDS.has(b.equippedPet.id)) continue;
    alive.add(b.id);

    const stale = petMeshes.get(b.id);
    if (stale && stale.logicVersion !== BATTLE_PET_LOGIC_VERSION) {
      removePetEntry(b.id, stale, scene);
    }

    if (!petMeshes.has(b.id) && !pendingBuilds.has(b.id)) {
      pendingBuilds.add(b.id);
      void buildPetMesh(b, scene).finally(() => pendingBuilds.delete(b.id));
    }
    const entry = petMeshes.get(b.id);
    if (entry) syncPetEntry(entry, b, dt, viewerTeam, friendliesInBush);
  }
  for (const [id, entry] of petMeshes) {
    if (!alive.has(id)) removePetEntry(id, entry, scene);
  }
}

export function resetBattle3DPetMotionState(): void {
  for (const e of petMeshes.values()) {
    e.lastX = 0; e.lastY = 0; e.movingSmoothed = 0;
  }
}

export function disposeBattle3DPets(scene: THREE.Scene | null): void {
  if (!scene) { petMeshes.clear(); pendingBuilds.clear(); return; }
  for (const [id, entry] of [...petMeshes]) removePetEntry(id, entry, scene);
  pendingBuilds.clear();
}
