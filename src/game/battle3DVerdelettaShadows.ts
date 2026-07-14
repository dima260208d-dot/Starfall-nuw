import * as THREE from "three";
import type { VerdelettaShadow, ShadowVariant } from "../utils/verdelettaShadows";
import {
  cloneShadowModelForBattle,
  createShadowBattleActions,
  enterShadowStanding,
  applyShadowRun,
  applyShadowAttack,
  maintainShadowRun,
  getVerdelettaShadowTemplate,
  getVerdelettaShadowTemplateSync,
  isVerdelettaShadowTemplateReady,
  setVerdelettaShadowRenderersBase,
  preloadVerdelettaShadowModel,
  snapShadowModelFeet,
  SHADOW_BATTLE_TARGET_H,
  type ShadowAnimNames,
} from "./verdelettaShadow3DRenderer";

const LOGIC_VERSION = 5;

function displayRadius(variant: ShadowVariant): number {
  return variant === "steward" ? 26 : 18;
}

function paintHpBar(cv: HTMLCanvasElement, hp: number, maxHp: number, isEnemy: boolean): void {
  const W = cv.width;
  const H = cv.height;
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const barH = Math.round(H * 0.55);
  const barY = Math.round((H - barH) * 0.5);
  ctx.fillStyle = "rgba(0,0,0,0.82)";
  ctx.fillRect(-2, barY - 2, W + 4, barH + 4);
  const barColor = isEnemy ? "#F44336" : "#4CAF50";
  ctx.fillStyle = barColor;
  ctx.fillRect(0, barY, W * ratio, barH);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${Math.round(H * 0.45)}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${Math.ceil(hp)} / ${maxHp}`, W / 2, H / 2 + 1);
}

interface ShadowMeshEntry {
  shadowId: string;
  variant: ShadowVariant;
  pivot: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer | null;
  idleAction: THREE.AnimationAction | null;
  runAction: THREE.AnimationAction | null;
  attackAction: THREE.AnimationAction | null;
  teamRing: THREE.Mesh;
  teamRingMat: THREE.MeshBasicMaterial;
  hpSprite: THREE.Sprite;
  hpCanvas: HTMLCanvasElement;
  hpTexture: THREE.CanvasTexture;
  lastHp: number;
  lastHpEnemy: boolean;
  headY: number;
  baseScale: number;
  currentAnim: "idle" | "run" | "attack";
  lastX: number;
  lastY: number;
  movingSmoothed: number;
  runLatch: boolean;
  canAnimate: boolean;
  usingGlb: boolean;
  logicVersion: number;
}

const entries = new Map<string, ShadowMeshEntry>();
const pendingUpgrades = new Set<string>();

function disableFrustumCull(root: THREE.Object3D): void {
  root.frustumCulled = false;
  root.traverse((o) => {
    o.frustumCulled = false;
  });
}

/** Яркий placeholder — виден сразу, до загрузки GLB. */
function buildFallbackModel(radius: number): THREE.Object3D {
  const group = new THREE.Group();
  const bodyH = Math.max(52, radius * 2.35);
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius * 0.42, bodyH * 0.52, 8, 12),
    new THREE.MeshBasicMaterial({ color: 0x0d0d0d }),
  );
  body.position.y = bodyH * 0.5;
  group.add(body);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.55, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0x69f0ae,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
  glow.position.y = bodyH * 0.62;
  group.add(glow);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xb9f6ca });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.12, 8, 8), eyeMat);
    eye.position.set(side * radius * 0.22, bodyH * 0.82, radius * 0.3);
    group.add(eye);
  }

  disableFrustumCull(group);
  return group;
}

function makeTeamRing(radius: number): { ring: THREE.Mesh; mat: THREE.MeshBasicMaterial } {
  const ringGeom = new THREE.RingGeometry(radius * 1.08, radius * 1.16, 32);
  ringGeom.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x69f0ae,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeom, mat);
  ring.position.y = 0.5;
  ring.renderOrder = 0;
  return { ring, mat };
}

function makeHpSprite(radius: number): {
  hpSprite: THREE.Sprite;
  hpCanvas: HTMLCanvasElement;
  hpTexture: THREE.CanvasTexture;
} {
  const hpCanvas = document.createElement("canvas");
  hpCanvas.width = 256;
  hpCanvas.height = 48;
  const hpTexture = new THREE.CanvasTexture(hpCanvas);
  hpTexture.colorSpace = THREE.SRGBColorSpace;
  const hpMat = new THREE.SpriteMaterial({
    map: hpTexture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const hpSprite = new THREE.Sprite(hpMat);
  const spriteW = radius * 1.75;
  hpSprite.scale.set(spriteW, spriteW * (hpCanvas.height / hpCanvas.width), 1);
  hpSprite.renderOrder = 100;
  return { hpSprite, hpCanvas, hpTexture };
}

function setupAnimations(
  model: THREE.Object3D,
  clips: THREE.AnimationClip[],
  animNames: ShadowAnimNames,
): {
  mixer: THREE.AnimationMixer | null;
  idle: THREE.AnimationAction | null;
  run: THREE.AnimationAction | null;
  attack: THREE.AnimationAction | null;
} {
  if (!clips.length) return { mixer: null, idle: null, run: null, attack: null };
  const mixer = new THREE.AnimationMixer(model);
  const { idle, run, attack } = createShadowBattleActions(mixer, clips, animNames);
  enterShadowStanding(mixer, model, idle, run);
  return { mixer, idle, run, attack };
}

function scaleModelToRadius(model: THREE.Object3D, radius: number): number {
  snapShadowModelFeet(model);
  const desiredH = Math.max(48, radius * 2.4);
  const curH = (new THREE.Box3().setFromObject(model)).getSize(new THREE.Vector3()).y || SHADOW_BATTLE_TARGET_H;
  return desiredH / curH;
}

function removeShadowEntry(shadowId: string, entry: ShadowMeshEntry, scene: THREE.Scene): void {
  scene.remove(entry.pivot);
  scene.remove(entry.teamRing);
  scene.remove(entry.hpSprite);
  entry.hpTexture.dispose();
  (entry.hpSprite.material as THREE.Material).dispose();
  (entry.teamRing.material as THREE.Material).dispose();
  entry.teamRing.geometry.dispose();
  entry.mixer?.stopAllAction();
  entries.delete(shadowId);
  pendingUpgrades.delete(shadowId);
}

function disposeHud(entry: ShadowMeshEntry, scene: THREE.Scene): void {
  scene.remove(entry.teamRing);
  scene.remove(entry.hpSprite);
  entry.hpTexture.dispose();
  (entry.hpSprite.material as THREE.Material).dispose();
  (entry.teamRing.material as THREE.Material).dispose();
  entry.teamRing.geometry.dispose();
}

function attachVisuals(
  pivot: THREE.Group,
  scene: THREE.Scene,
  shadow: VerdelettaShadow,
  model: THREE.Object3D,
  clips: THREE.AnimationClip[],
  animNames: ShadowAnimNames,
  usingGlb: boolean,
  prev?: ShadowMeshEntry,
): ShadowMeshEntry {
  if (prev) disposeHud(prev, scene);

  const radius = displayRadius(shadow.variant);
  pivot.clear();
  pivot.add(model);

  const scale = scaleModelToRadius(model, radius);
  pivot.scale.setScalar(scale);
  const headY = (new THREE.Box3().setFromObject(model)).getSize(new THREE.Vector3()).y * scale;

  const { ring, mat } = makeTeamRing(radius);
  const { hpSprite, hpCanvas, hpTexture } = makeHpSprite(radius);
  ring.position.set(shadow.x, 0.5, shadow.y);
  hpSprite.position.set(shadow.x, headY + 14, shadow.y);
  scene.add(ring);
  scene.add(hpSprite);

  paintHpBar(hpCanvas, shadow.hp, shadow.maxHp, false);
  hpTexture.needsUpdate = true;

  const { mixer, idle, run, attack } = setupAnimations(model, clips, animNames);
  disableFrustumCull(pivot);

  return {
    shadowId: shadow.id,
    variant: shadow.variant,
    pivot,
    model,
    mixer,
    idleAction: idle,
    runAction: run,
    attackAction: attack,
    teamRing: ring,
    teamRingMat: mat,
    hpSprite,
    hpCanvas,
    hpTexture,
    lastHp: shadow.hp,
    lastHpEnemy: false,
    headY,
    baseScale: scale,
    currentAnim: "idle",
    lastX: shadow.x,
    lastY: shadow.y,
    movingSmoothed: 0,
    runLatch: false,
    canAnimate: !!(mixer && (run || idle)),
    usingGlb,
    logicVersion: LOGIC_VERSION,
  };
}

function getOrCreateShadowMesh(
  shadow: VerdelettaShadow,
  scene: THREE.Scene,
): ShadowMeshEntry | null {
  const existing = entries.get(shadow.id);
  if (existing && existing.logicVersion === LOGIC_VERSION) return existing;
  if (existing) removeShadowEntry(shadow.id, existing, scene);

  const pivot = new THREE.Group();
  pivot.renderOrder = 2;

  let model: THREE.Object3D;
  let usingGlb = false;
  let clips: THREE.AnimationClip[] = [];
  let animNames: ShadowAnimNames = { idle: "Walking", idleIdx: 1, run: "Running", runIdx: 0 };

  const template = getVerdelettaShadowTemplateSync();
  const glbModel = template ? cloneShadowModelForBattle(template) : null;
  if (glbModel) {
    model = glbModel;
    clips = template!.clips;
    animNames = template!.animNames;
    usingGlb = true;
  } else {
    model = buildFallbackModel(displayRadius(shadow.variant));
  }

  const entry = attachVisuals(pivot, scene, shadow, model, clips, animNames, usingGlb);
  pivot.position.set(shadow.x, 0, shadow.y);
  pivot.rotation.y = Math.PI / 2 - shadow.angle;
  scene.add(pivot);
  entries.set(shadow.id, entry);

  if (!usingGlb && !isVerdelettaShadowTemplateReady() && !pendingUpgrades.has(shadow.id)) {
    pendingUpgrades.add(shadow.id);
    void tryUpgradeToGlb(shadow.id, scene);
  }

  return entry;
}

async function tryUpgradeToGlb(shadowId: string, scene: THREE.Scene): Promise<void> {
  try {
    const template = await getVerdelettaShadowTemplate();
    const entry = entries.get(shadowId);
    if (!template || !entry || entry.usingGlb) return;

    const glbModel = cloneShadowModelForBattle(template);
    if (!glbModel) return;

    entry.mixer?.stopAllAction();
    const rebuilt = attachVisuals(
      entry.pivot,
      scene,
      {
        id: shadowId,
        variant: entry.variant,
        hp: entry.lastHp,
        maxHp: entry.lastHp,
        alive: true,
      } as VerdelettaShadow,
      glbModel,
      template.clips,
      template.animNames,
      true,
      entry,
    );

    Object.assign(entry, rebuilt);
    entry.usingGlb = true;
    entry.logicVersion = LOGIC_VERSION;
  } finally {
    pendingUpgrades.delete(shadowId);
  }
}

function syncShadowEntry(
  entry: ShadowMeshEntry,
  shadow: VerdelettaShadow,
  dt: number,
  viewerTeam?: string,
): void {
  if (!shadow.alive) {
    entry.pivot.visible = false;
    entry.teamRing.visible = false;
    entry.hpSprite.visible = false;
    return;
  }

  entry.pivot.visible = true;
  entry.teamRing.visible = true;
  entry.hpSprite.visible = true;

  entry.pivot.position.set(shadow.x, 0, shadow.y);
  entry.pivot.rotation.y = Math.PI / 2 - shadow.angle;
  entry.teamRing.position.set(shadow.x, 0.5, shadow.y);
  entry.hpSprite.position.set(shadow.x, entry.headY + 14, shadow.y);

  const isEnemy = viewerTeam !== undefined && shadow.team !== viewerTeam;

  if (entry.lastHp !== shadow.hp || entry.lastHpEnemy !== isEnemy) {
    paintHpBar(entry.hpCanvas, shadow.hp, shadow.maxHp, isEnemy);
    entry.hpTexture.needsUpdate = true;
    entry.lastHp = shadow.hp;
    entry.lastHpEnemy = isEnemy;
  }

  const teamColor = viewerTeam === undefined
    ? 0x69f0ae
    : shadow.team === viewerTeam ? 0x2196f3 : 0xf44336;
  if (entry.teamRingMat.color.getHex() !== teamColor) {
    entry.teamRingMat.color.setHex(teamColor);
  }

  const dx = shadow.x - entry.lastX;
  const dy = shadow.y - entry.lastY;
  entry.lastX = shadow.x;
  entry.lastY = shadow.y;
  const movingNow = Math.hypot(dx, dy) > 0.35 ? 1 : 0;
  entry.movingSmoothed = entry.movingSmoothed * 0.72 + movingNow * 0.28;
  if (entry.runLatch) {
    if (entry.movingSmoothed < 0.32) entry.runLatch = false;
  } else if (entry.movingSmoothed > 0.52) {
    entry.runLatch = true;
  }

  const attacking = shadow.attackAnim > 0.02;
  let desired: "idle" | "run" | "attack" = "idle";
  if (attacking) desired = "attack";
  else if (entry.runLatch) desired = "run";

  if (entry.canAnimate && desired !== entry.currentAnim) {
    entry.currentAnim = desired;
    if (desired === "idle") enterShadowStanding(entry.mixer, entry.model, entry.idleAction, entry.runAction);
    else if (desired === "run") applyShadowRun(entry.mixer, entry.runAction);
    else applyShadowAttack(entry.mixer, entry.runAction, entry.attackAction);
  } else if (desired === "run") {
    maintainShadowRun(entry.mixer, entry.runAction);
    entry.currentAnim = "run";
  }

  if (entry.canAnimate && entry.mixer) {
    entry.mixer.update(desired === "idle" ? 0 : Math.min(0.05, dt));
  }
}

export function initBattle3DVerdelettaShadows(base: string): void {
  setVerdelettaShadowRenderersBase(base);
  void preloadVerdelettaShadowModel(base);
}

export function syncBattle3DVerdelettaShadows(
  scene: THREE.Scene | null,
  shadows: readonly VerdelettaShadow[],
  dt: number,
  viewerTeam?: string,
): void {
  if (!scene) return;

  const alive = new Set<string>();
  for (const s of shadows) {
    if (!s.alive) continue;
    alive.add(s.id);
    const entry = getOrCreateShadowMesh(s, scene);
    if (entry) syncShadowEntry(entry, s, dt, viewerTeam);
  }

  for (const [id, entry] of entries) {
    if (!alive.has(id)) removeShadowEntry(id, entry, scene);
  }
}

export function resetBattle3DVerdelettaShadowMotionState(): void {
  for (const e of entries.values()) {
    e.lastX = 0;
    e.lastY = 0;
    e.movingSmoothed = 0;
    e.runLatch = false;
  }
}

export function disposeBattle3DVerdelettaShadows(scene: THREE.Scene | null): void {
  pendingUpgrades.clear();
  if (!scene) {
    entries.clear();
    return;
  }
  for (const [id, entry] of [...entries]) removeShadowEntry(id, entry, scene);
}

export function hasVerdelettaShadow3DMesh(shadowId: string): boolean {
  return entries.has(shadowId);
}
