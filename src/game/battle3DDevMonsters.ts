import * as THREE from "three";
import type { DevBattleMonster } from "../utils/devBattleMonsters";
import { DEV_MONSTER_DISPLAY_RADIUS } from "../utils/devBattleMonsters";
import type { TileGrid } from "../game/TileMap";
import { isDevMonsterHiddenFromBlues, isMonsterVisibleToPlayers } from "../utils/monsterHideMechanics";
import {
  cloneDevMonsterForBattle,
  getDevMonsterTemplateSync,
  isDevMonsterTemplateReady,
  preloadDevMonsterModel,
  resolveDevMonsterAnimClips,
  setDevMonsterRenderersBase,
} from "./devMonster3DRenderer";

const RED_RING = 0xf44336;
const LOGIC_VERSION = 4;

/** Как у бойцов и теней Verdeletta: 1 ед. = 1 px, высота ≈ radius×2.4. */
function applyBattleScale(pivot: THREE.Group, model: THREE.Object3D, radius: number): number {
  const box = new THREE.Box3().setFromObject(model);
  if (Number.isFinite(box.min.y)) {
    model.position.y -= box.min.y;
  }
  const desiredHeightPx = Math.max(48, radius * 2.4);
  const curH = (new THREE.Box3().setFromObject(model)).getSize(new THREE.Vector3()).y || 1;
  const k = desiredHeightPx / curH;
  pivot.scale.setScalar(k);
  return curH * k;
}

interface MonsterMeshEntry {
  monsterId: string;
  modelId: string;
  pivot: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  idleAction: THREE.AnimationAction | null;
  runAction: THREE.AnimationAction | null;
  attackAction: THREE.AnimationAction | null;
  teamRing: THREE.Mesh;
  teamRingMat: THREE.MeshBasicMaterial;
  lastHp: number;
  headY: number;
  currentAnim: "idle" | "run" | "attack";
  lastX: number;
  lastY: number;
  movingSmoothed: number;
  runLatch: boolean;
  canAnimate: boolean;
  usingGlb: boolean;
  logicVersion: number;
}

const entries = new Map<string, MonsterMeshEntry>();
const pendingUpgrades = new Set<string>();

function buildFallbackModel(radius: number, color: string): THREE.Object3D {
  const group = new THREE.Group();
  const bodyH = Math.max(52, radius * 2.35);
  const col = new THREE.Color(color);
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius * 0.42, bodyH * 0.52, 8, 12),
    new THREE.MeshBasicMaterial({ color: col }),
  );
  body.position.y = bodyH * 0.5;
  group.add(body);
  group.frustumCulled = false;
  return group;
}

function makeTeamRing(radius: number): { ring: THREE.Mesh; mat: THREE.MeshBasicMaterial } {
  const ringGeom = new THREE.RingGeometry(radius * 1.08, radius * 1.16, 32);
  ringGeom.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: RED_RING,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeom, mat);
  ring.position.y = 0.5;
  return { ring, mat };
}

function setupAnimations(model: THREE.Object3D, clips: THREE.AnimationClip[]): {
  mixer: THREE.AnimationMixer | null;
  idle: THREE.AnimationAction | null;
  run: THREE.AnimationAction | null;
  attack: THREE.AnimationAction | null;
} {
  if (!clips.length) return { mixer: null, idle: null, run: null, attack: null };
  const resolved = resolveDevMonsterAnimClips(clips);
  const mixer = new THREE.AnimationMixer(model);
  const idle = resolved.idle ? mixer.clipAction(resolved.idle) : null;
  const run = resolved.run ? mixer.clipAction(resolved.run) : null;
  const attack = resolved.attack ? mixer.clipAction(resolved.attack) : null;
  if (idle) {
    idle.setLoop(THREE.LoopRepeat, Infinity);
    idle.play();
  }
  if (run) run.setLoop(THREE.LoopRepeat, Infinity);
  if (attack) {
    attack.setLoop(THREE.LoopOnce, 1);
    attack.clampWhenFinished = true;
  }
  return { mixer, idle, run, attack };
}

function removeEntry(id: string, entry: MonsterMeshEntry, scene: THREE.Scene): void {
  scene.remove(entry.pivot);
  scene.remove(entry.teamRing);
  (entry.teamRing.material as THREE.Material).dispose();
  entry.teamRing.geometry.dispose();
  if (entry.mixer) entry.mixer.stopAllAction();
  entries.delete(id);
}

function getOrCreateMesh(m: DevBattleMonster, scene: THREE.Scene): MonsterMeshEntry | null {
  let entry = entries.get(m.id);
  if (entry && entry.logicVersion !== LOGIC_VERSION) {
    removeEntry(m.id, entry, scene);
    entry = undefined;
  }
  if (entry) return entry;

  const radius = DEV_MONSTER_DISPLAY_RADIUS * (m.displayScale ?? 1);
  const pivot = new THREE.Group();
  const cloned = cloneDevMonsterForBattle(m.modelId);
  const usingGlb = !!cloned;
  const model = cloned?.model ?? buildFallbackModel(radius, m.accentColor);
  pivot.add(model);
  pivot.scale.setScalar(1);
  const headY = applyBattleScale(pivot, model, radius);

  const { ring, mat } = makeTeamRing(radius);

  const anims = cloned ? setupAnimations(model, cloned.clips) : { mixer: null, idle: null, run: null, attack: null };

  entry = {
    monsterId: m.id,
    modelId: m.modelId,
    pivot,
    model,
    mixer: anims.mixer,
    idleAction: anims.idle,
    runAction: anims.run,
    attackAction: anims.attack,
    teamRing: ring,
    teamRingMat: mat,
    lastHp: m.hp,
    headY,
    currentAnim: "idle",
    lastX: m.x,
    lastY: m.y,
    movingSmoothed: 0,
    runLatch: false,
    canAnimate: !!anims.mixer,
    usingGlb,
    logicVersion: LOGIC_VERSION,
  };

  scene.add(pivot);
  scene.add(ring);
  // HP рисуется на 2D-канвасе (renderDevMonsterHud), как у бойцов.
  entries.set(m.id, entry);

  if (!usingGlb && !pendingUpgrades.has(m.id)) {
    pendingUpgrades.add(m.id);
    void preloadDevMonsterModel(m.modelId).then(() => {
      pendingUpgrades.delete(m.id);
      const e = entries.get(m.id);
      if (e) tryUpgradeToGlb(e, m);
    });
  }
  return entry;
}

function tryUpgradeToGlb(entry: MonsterMeshEntry, m: DevBattleMonster): void {
  if (entry.usingGlb || !isDevMonsterTemplateReady(m.modelId)) return;
  const cloned = cloneDevMonsterForBattle(m.modelId);
  if (!cloned) return;
  entry.pivot.remove(entry.model);
  entry.model = cloned.model;
  entry.pivot.add(cloned.model);
  entry.pivot.scale.setScalar(1);
  entry.usingGlb = true;
  entry.headY = applyBattleScale(entry.pivot, cloned.model, DEV_MONSTER_DISPLAY_RADIUS);
  const anims = setupAnimations(cloned.model, cloned.clips);
  entry.mixer = anims.mixer;
  entry.idleAction = anims.idle;
  entry.runAction = anims.run;
  entry.attackAction = anims.attack;
  entry.canAnimate = !!anims.mixer;
}

function syncEntry(
  entry: MonsterMeshEntry,
  m: DevBattleMonster,
  dt: number,
  opts?: {
    tileGrid?: TileGrid;
    blues?: ReadonlyArray<{ x: number; y: number; alive: boolean; inBush?: boolean }>;
    monsterHideVision?: boolean;
  },
): void {
  if (!m.alive) {
    entry.pivot.visible = false;
    entry.teamRing.visible = false;
    return;
  }

  tryUpgradeToGlb(entry, m);

  let visible: boolean;
  if (opts?.monsterHideVision && opts.tileGrid) {
    visible = isMonsterVisibleToPlayers(m, opts.tileGrid);
  } else {
    const hiddenByHide = !!m.hideInvisible;
    const hiddenByBush = opts?.tileGrid && opts?.blues
      ? isDevMonsterHiddenFromBlues(m, opts.tileGrid, opts.blues)
      : false;
    visible = !hiddenByHide && !hiddenByBush;
  }

  entry.pivot.visible = visible;
  entry.teamRing.visible = visible;

  entry.pivot.position.set(m.x, 0, m.y);
  entry.pivot.rotation.y = Math.PI / 2 - m.angle;
  entry.teamRing.position.set(m.x, 0.5, m.y);
  entry.teamRingMat.color.setHex(m.isElite ? 0xffd54f : RED_RING);
  entry.teamRingMat.opacity = m.isElite ? 0.78 : 0.55;

  if (entry.lastHp !== m.hp) {
    entry.lastHp = m.hp;
  }

  const dx = m.x - entry.lastX;
  const dy = m.y - entry.lastY;
  entry.lastX = m.x;
  entry.lastY = m.y;
  const movingNow = Math.hypot(dx, dy) > 0.35 ? 1 : 0;
  entry.movingSmoothed = entry.movingSmoothed * 0.72 + movingNow * 0.28;
  if (entry.runLatch) {
    if (entry.movingSmoothed < 0.32) entry.runLatch = false;
  } else if (entry.movingSmoothed > 0.52) {
    entry.runLatch = true;
  }

  const attacking = m.attackAnim > 0.02;
  let desired: "idle" | "run" | "attack" = "idle";
  if (attacking) desired = "attack";
  else if (entry.runLatch) desired = "run";

  if (entry.canAnimate && entry.mixer && desired !== entry.currentAnim) {
    entry.currentAnim = desired;
    entry.mixer.stopAllAction();
    const act = desired === "attack" ? entry.attackAction
      : desired === "run" ? (entry.runAction ?? entry.idleAction)
      : entry.idleAction;
    if (act) {
      act.reset().fadeIn(0.1).play();
    }
  }

  if (entry.canAnimate && entry.mixer) {
    entry.mixer.update(Math.min(dt, 0.05));
  }
}

export function initBattle3DDevMonsters(base: string): void {
  setDevMonsterRenderersBase(base);
}

export function syncBattle3DDevMonsters(
  scene: THREE.Scene | null,
  monsters: readonly DevBattleMonster[],
  dt: number,
  opts?: {
    tileGrid?: TileGrid;
    blues?: ReadonlyArray<{ x: number; y: number; alive: boolean; inBush?: boolean }>;
    monsterHideVision?: boolean;
  },
): void {
  if (!scene) return;
  const alive = new Set<string>();
  for (const m of monsters) {
    if (!m.alive) continue;
    alive.add(m.id);
    const entry = getOrCreateMesh(m, scene);
    if (entry) syncEntry(entry, m, dt, opts);
  }
  for (const [id, entry] of entries) {
    if (!alive.has(id)) removeEntry(id, entry, scene);
  }
}

export function resetBattle3DDevMonsterMotionState(): void {
  for (const e of entries.values()) {
    e.lastX = 0;
    e.lastY = 0;
    e.movingSmoothed = 0;
    e.runLatch = false;
  }
}

export function disposeBattle3DDevMonsters(scene: THREE.Scene | null): void {
  pendingUpgrades.clear();
  if (!scene) {
    entries.clear();
    return;
  }
  for (const [id, entry] of [...entries]) removeEntry(id, entry, scene);
}
