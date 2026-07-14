import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { fixCharacterSkinnedMeshes } from "../utils/gltfSkinnedMeshFix";
import { applyCanvasBitmapDrawPolicy, applyGLTFTexturePolicy } from "../utils/texturePolicy";
import { registerWebGLCleanup } from "../utils/devWebGLRecovery";
import { loadGLTFFromUrl } from "../utils/glbFetchCache";
import { getGameRenderDt } from "./frameClock";
import { configureCharacterBattleOrtho } from "./battleGroundView";
import { applyBrawlerNormTransform, brawlerGlbUrl, computeBrawlerNormTransform } from "./brawler3DScale";
import { type AttackClipTune, tuneAttackClip } from "./attackClipTune";

/** Force correct material settings on all meshes (mirrors Brawler3DModel). */
function fixMaterials(root: THREE.Object3D, renderer?: THREE.WebGLRenderer | null): void {
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
  applyGLTFTexturePolicy(root, renderer);
}

export type CharAnim = "idle" | "run" | "attack" | "dead" | "still";
/** @deprecated use CharAnim */
export type MiyaAnim = CharAnim;

const SIZE = 512;
const MODEL_TARGET_H = 3.2;

// Exact animation clip names per character (extracted from the GLB files).
export interface CharAnimNames {
  idle: string; idleIdx?: number;
  run: string;  runIdx?: number;
  attack: string; attackIdx?: number;
  /** Freeze idle clip on frame 0 in live 3D battle scene. */
  freezeIdle?: boolean;
  /**
   * When idle & run resolve to the same AnimationAction (same GLB clip), don’t stop/reset
   * between still and run — unpause + this time scale. Use for “Walking as jog” (e.g. Rin legs).
   */
  sharedLocomotionRunScale?: number;
  /**
   * Attack clip plays once (cast animations like Lumina mage spell).
   */
  attackLoopOnce?: boolean;
  /** Separate super cast clip (e.g. Octavia tentacle summon). */
  super?: string;
  superIdx?: number;
  superLoopOnce?: boolean;
  /** Trim / scale attack clip so melee VFX range matches gameplay hitbox. */
  attackClipTune?: AttackClipTune;
}

const CHAR_ANIM_NAMES: Record<string, CharAnimNames> = {
  miya:    { idle: "Walking",         idleIdx: 3, run: "Running", runIdx: 1, attack: "Attack",              attackIdx: 0 },
  // sora.glb (new model): clip names mislabeled —
  //   "Running"         → stroll / idle walk
  //   "Walking"         → actual run cycle
  //   "mage_soell_cast_4" → attack
  sora:    {
    idle: "Running", idleIdx: 0,
    run: "Walking", runIdx: 1,
    attack: "mage_soell_cast_4", attackIdx: 2,
  },
  // goro/rin: name-only — exact GLB clip names found by THREE.js loader (no idx to avoid ordering ambiguity)
  goro:    { idle: "Running",                     run: "Running",            attack: "Double_Combo_Attack"              },
  // rin.glb clip names are mislabeled in the export:
  //   "Running"    → stroll (used for run after idle/run swap)
  //   "Left_Slash" → actual run (used for idle/stand after idle/run swap)
  //   "Walking"    → attack slash
  rin:     { idle: "Left_Slash", idleIdx: 0, run: "Running", runIdx: 1, attack: "Walking", attackIdx: 2 },
  ronin:   { idle: "Walking",         idleIdx: 2, run: "Running", runIdx: 0, attack: "Step_Step_Turn_Kick", attackIdx: 1 },
  hana:    { idle: "Walking",         idleIdx: 2, run: "Running", runIdx: 1, attack: "Archery_Shot_3",      attackIdx: 0 },
  kenji:   { idle: "Walking",         idleIdx: 2, run: "Running", runIdx: 1, attack: "Axe_Spin_Attack",     attackIdx: 0 },
  yuki:    { idle: "Walking",         idleIdx: 2, run: "Running", runIdx: 1, attack: "Axe_Spin_Attack",     attackIdx: 0 },
  taro:    { idle: "Walking",         idleIdx: 2, run: "Running", runIdx: 1, attack: "Archery_Shot_1",      attackIdx: 0 },
  // GLB clips: 0 Running, 1 Thrust_Slash, 2 Walking (no Archery_Shot_* — that name was Hana-only).
  zafkiel: { idle: "Walking",         idleIdx: 2, run: "Running", runIdx: 0, attack: "Thrust_Slash", attackIdx: 1 },
  verdeletta: { idle: "Walking", idleIdx: 2, run: "Running", runIdx: 0, attack: "Walk_Forward_While_Shooting", attackIdx: 1 },
  lumina: { idle: "Walking", idleIdx: 1, run: "Running", runIdx: 0, attack: "mage_soell_cast_3", attackIdx: 2, attackLoopOnce: true },
  oliver: { idle: "Walking", idleIdx: 1, run: "Running", runIdx: 0, attack: "mage_soell_cast_3", attackIdx: 2, attackLoopOnce: true },
  callista: { idle: "Walking", idleIdx: 1, run: "Running", runIdx: 0, attack: "mage_soell_cast_6", attackIdx: 2, attackLoopOnce: true },
  airin: { idle: "Walking", idleIdx: 1, run: "Running", runIdx: 0, attack: "mage_soell_cast", attackIdx: 2, attackLoopOnce: true },
  elian: { idle: "Walking", idleIdx: 1, run: "Running", runIdx: 0, attack: "mage_soell_cast", attackIdx: 2, attackLoopOnce: true },
  silven: { idle: "Walking", idleIdx: 1, run: "Running", runIdx: 0, attack: "mage_soell_cast_2", attackIdx: 2, attackLoopOnce: true },
  vittoria: {
    idle: "Walking", idleIdx: 2, run: "Running", runIdx: 1,
    attack: "Left_Jab_from_Guard", attackIdx: 0, attackLoopOnce: true,
    attackClipTune: {
      maxDuration: 0.38,
      translationDeltaScale: 0.12,
      translationBones: ["hips"],
      armRotationDeltaScale: 0.62,
      timeScale: 1.35,
    },
  },
  octavia: {
    idle: "Walking", idleIdx: 1, run: "Running", runIdx: 0,
    attack: "mage_soell_cast_3", attackIdx: 2, attackLoopOnce: true,
    attackClipTune: {
      maxDuration: 0.52,
      translationDeltaScale: 0.08,
      translationBones: ["hips"],
      armRotationDeltaScale: 0.5,
      timeScale: 1.3,
    },
  },
  mirabel: {
    idle: "Walking", idleIdx: 1, run: "Running", runIdx: 0,
    attack: "mage_soell_cast_3", attackIdx: 2, attackLoopOnce: true,
    super: "mage_soell_cast_6", superIdx: 2, superLoopOnce: true,
    attackClipTune: {
      maxDuration: 0.48,
      translationDeltaScale: 0.1,
      translationBones: ["hips"],
      armRotationDeltaScale: 0.55,
      timeScale: 1.25,
    },
  },
  zephyrin: {
    idle: "Walking", idleIdx: 1, run: "Running", runIdx: 0,
    attack: "mage_soell_cast_3", attackIdx: 2, attackLoopOnce: true,
    super: "mage_soell_cast_3", superIdx: 2, superLoopOnce: true,
    attackClipTune: {
      maxDuration: 0.62,
      translationDeltaScale: 0.14,
      translationBones: ["hips", "spine"],
      armRotationDeltaScale: 0.72,
      timeScale: 1.55,
    },
  },
};

export function findCharAnimClip(clips: THREE.AnimationClip[], name: string, idx?: number): THREE.AnimationClip | null {
  return findClip(clips, name, idx);
}

/** Freeze an action on frame 0 — visible standing pose without bind-pose glitches. */
export function applyFrozenClipPose(
  mixer: THREE.AnimationMixer,
  action: THREE.AnimationAction | null | undefined,
): boolean {
  mixer.stopAllAction();
  if (!action) return false;
  action.reset();
  action.enabled = true;
  action.setEffectiveWeight(1);
  action.setEffectiveTimeScale(0);
  action.paused = false;
  action.play();
  action.time = 0;
  // Double sample at t=0 so frame-0 pose fully overwrites prior run/attack bone state.
  mixer.update(0);
  action.time = 0;
  mixer.update(1 / 60);
  return true;
}

/** Start a looping locomotion / attack clip from a clean stop. */
export function playLoopClipPose(
  mixer: THREE.AnimationMixer,
  action: THREE.AnimationAction | null | undefined,
  timeScale = 1,
): boolean {
  if (!action) return false;
  mixer.stopAllAction();
  action.reset();
  action.enabled = true;
  action.setEffectiveWeight(1);
  action.setEffectiveTimeScale(timeScale);
  action.paused = false;
  action.play();
  return true;
}

function normalizeClipName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, "");
}

function findClip(clips: THREE.AnimationClip[], name: string, idx?: number): THREE.AnimationClip | null {
  // Prefer index only when it matches the expected clip name — GLB clip order differs per model
  // (e.g. Zafkiel: runIdx pointed at the wrong track so "run" played the attack clip).
  if (idx !== undefined && clips[idx] && clips[idx].name === name) {
    return clips[idx];
  }
  const named = clips.find(c => c.name === name) ?? null;
  if (named) return named;
  const want = normalizeClipName(name);
  const fuzzy = clips.find(c => normalizeClipName(c.name) === want) ?? null;
  if (fuzzy) return fuzzy;
  // Never return clips[idx] when its name !== name — that mis-binds run/attack when order differs from comments.
  return null;
}

/** No clips — rest pose from glTF bind (battle “standing still”). */
export function resetSkinnedBindPose(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const m = obj as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !m.skeleton) return;
    const sk = m.skeleton as THREE.Skeleton & { pose?: () => void };
    // Only use Skeleton.pose() — manual boneInverses math breaks SkeletonUtils clones.
    if (typeof sk.pose === "function") sk.pose();
    sk.update();
  });
  root.updateMatrixWorld(true);
}

// ── Shared WebGL renderer ─────────────────────────────────────────────────────
// All CharacterTopDownRenderer instances share ONE WebGL context to avoid
// hitting the browser's ~8–16 simultaneous WebGL context limit.

let _sharedRenderer: THREE.WebGLRenderer | null = null;
let _sharedScene: THREE.Scene | null = null;
let _sharedCamera: THREE.OrthographicCamera | null = null;
let _sharedRendererReady = false;

function getSharedRenderer(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera } | null {
  if (_sharedRendererReady && _sharedRenderer && _sharedScene && _sharedCamera) {
    if (!_sharedRenderer.getContext().isContextLost()) {
      return { renderer: _sharedRenderer, scene: _sharedScene, camera: _sharedCamera };
    }
    // Context was lost — recreate on next call.
    _sharedRendererReady = false;
    _sharedRenderer = null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;

  try {
    _sharedRenderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true,
      preserveDrawingBuffer: true,
    });
  } catch {
    return null;
  }

  canvas.addEventListener("webglcontextlost", () => {
    _sharedRendererReady = false;
    _sharedRenderer = null;
  }, { once: true });

  _sharedRenderer.setPixelRatio(1);
  _sharedRenderer.setSize(SIZE, SIZE, false);
  _sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
  _sharedRenderer.setClearColor(0x000000, 0);

  _sharedScene = new THREE.Scene();
  // Frustum + наклон камеры — общие с тайлами/подложкой (`battleGroundView.ts`).
  _sharedCamera = new THREE.OrthographicCamera(0, 0, 0, 0, 0.1, 30);
  configureCharacterBattleOrtho(_sharedCamera);

  _sharedRendererReady = true;
  return { renderer: _sharedRenderer, scene: _sharedScene, camera: _sharedCamera };
}

/**
 * Освобождает разделяемый WebGL-контекст оффскрин-печки персонажей.
 * GLB-шаблоны и AnimationClip'ы у каждого CharacterTopDownRenderer остаются —
 * их использует живая 3D-сцена боя (`battle3DWorld`), которая работает на своём
 * собственном рендерере. Можно безопасно вызывать сразу после активации 3D-боя.
 */
export function disposeCharBakerSharedRenderer(): void {
  if (_sharedRenderer) {
    try { _sharedRenderer.dispose(); } catch { /* ignore */ }
  }
  _sharedRenderer = null;
  _sharedScene = null;
  _sharedCamera = null;
  _sharedRendererReady = false;
}

registerWebGLCleanup(disposeCharBakerSharedRenderer);

// ── Per-character renderer ────────────────────────────────────────────────────

type MixerInst = {
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<CharAnim, THREE.AnimationAction>>;
  currentAnim: CharAnim;
};

class CharacterTopDownRenderer {
  // Per-character 2D canvas — holds the last rendered frame.
  // This is what callers receive, so the shared WebGL canvas can be
  // overwritten by the next character without corrupting prior results.
  private outputCanvas: HTMLCanvasElement | null = null;
  private outputCtx: CanvasRenderingContext2D | null = null;

  private modelTemplate: THREE.Group | null = null;
  private clips: THREE.AnimationClip[] = [];
  private animNames: CharAnimNames;

  private instances = new Map<string, MixerInst>();

  private loading: Promise<void> | null = null;
  private ready = false;

  constructor(animNames: CharAnimNames) {
    this.animNames = animNames;
  }

  init(modelUrl: string): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;

    this.loading = new Promise((resolve, reject) => {
      this.outputCanvas = document.createElement("canvas");
      this.outputCanvas.width = SIZE;
      this.outputCanvas.height = SIZE;
      this.outputCtx = this.outputCanvas.getContext("2d");
      if (this.outputCtx) {
        this.outputCtx.imageSmoothingEnabled = true;
        this.outputCtx.imageSmoothingQuality = "high";
      }

      void loadGLTFFromUrl(modelUrl).then((gltf) => {
          this.modelTemplate = gltf.scene;
          this.clips = gltf.animations ?? [];
          const shared =
            _sharedRendererReady && _sharedRenderer && _sharedScene && _sharedCamera && !_sharedRenderer.getContext().isContextLost()
              ? { renderer: _sharedRenderer, scene: _sharedScene, camera: _sharedCamera }
              : null;
          fixMaterials(this.modelTemplate, shared?.renderer);
          fixCharacterSkinnedMeshes(this.modelTemplate);

          const t = computeBrawlerNormTransform(this.modelTemplate, MODEL_TARGET_H, modelUrl);
          applyBrawlerNormTransform(this.modelTemplate, t);

          this.ready = true;

          try {
            if (shared) {
              const warmModel = cloneSkinned(this.modelTemplate) as THREE.Object3D;
              shared.scene.add(new THREE.AmbientLight(0xffffff, 2.5));
              shared.scene.add(warmModel);
              shared.renderer.render(shared.scene, shared.camera);
              shared.scene.clear();
            }
          } catch { /* ignore warmup errors */ }

          resolve();
        }).catch((err) => {
          console.warn("[CharTopDown] failed to load", modelUrl, err);
          this.loading = null;
          reject(err);
        });
    });

    return this.loading;
  }

  isReady(): boolean { return this.ready; }

  /** Клон загруженного GLB-шаблона (для живой 3D-сцены боя). */
  cloneModelTemplate(): THREE.Object3D | null {
    if (!this.ready || !this.modelTemplate) return null;
    return cloneSkinned(this.modelTemplate) as THREE.Object3D;
  }

  /** Список анимационных клипов GLB (для AnimationMixer в живой 3D-сцене). */
  getClips(): THREE.AnimationClip[] {
    return this.clips;
  }

  /** Имена клипов для idle/run/attack — нужны для подбора AnimationAction в живой сцене. */
  getAnimNames(): CharAnimNames {
    return this.animNames;
  }

  /**
   * Standing pose: idle clip frame 0 when available (natural “just standing”), else run/attack.
   * Always stopAll first, then one frozen action — no fade/overlap (avoids bone-scale glitches).
   */
  private enterStandingStill(inst: MixerInst): void {
    inst.mixer.stopAllAction();
    const poseAction = inst.actions.idle ?? inst.actions.run ?? inst.actions.attack;
    if (poseAction) {
      poseAction.reset();
      poseAction.setEffectiveWeight(1);
      poseAction.paused = false;
      poseAction.setEffectiveTimeScale(0);
      poseAction.play();
      poseAction.time = 0;
      inst.mixer.update(0.0001);
    } else {
      resetSkinnedBindPose(inst.model);
    }
  }

  private getOrCreateInstance(instanceId: string): MixerInst | null {
    let inst = this.instances.get(instanceId);
    if (inst) return inst;
    if (!this.modelTemplate) return null;

    const model = cloneSkinned(this.modelTemplate) as THREE.Object3D;
    const mixer = new THREE.AnimationMixer(model);
    const actions: Partial<Record<CharAnim, THREE.AnimationAction>> = {};

    const idleClip   = findClip(this.clips, this.animNames.idle,   this.animNames.idleIdx);
    const runClip    = findClip(this.clips, this.animNames.run,    this.animNames.runIdx);
    let attackClip = findClip(this.clips, this.animNames.attack, this.animNames.attackIdx);
    if (attackClip && this.animNames.attackClipTune) {
      attackClip = tuneAttackClip(attackClip, this.animNames.attackClipTune);
    }

    for (const [anim, clip] of [
      ["idle", idleClip] as const,
      ["run",  runClip]  as const,
      ["attack", attackClip] as const,
    ]) {
      if (clip) {
        const a = mixer.clipAction(clip);
        if (anim === "attack" && this.animNames.attackLoopOnce) {
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = true;
        } else {
          a.setLoop(THREE.LoopRepeat, Infinity);
          a.clampWhenFinished = false;
        }
        actions[anim] = a;
      }
    }

    // First render with anim "still" runs enterStandingStill (otherwise bind pose can look empty until run/attack).
    inst = { model, mixer, actions, currentAnim: "idle" };
    resetSkinnedBindPose(model);
    this.instances.set(instanceId, inst);
    return inst;
  }

  releaseInstance(instanceId: string): void {
    this.instances.delete(instanceId);
  }

  /**
   * Render the character for one frame and return a per-character 2D canvas.
   *
   * angleRad: 2D world facing angle (0 = right, π/2 = down, π = left, -π/2 = up).
   */
  render(instanceId: string, anim: CharAnim, angleRad: number): HTMLCanvasElement | null {
    if (!this.ready || !this.outputCanvas || !this.outputCtx) return null;

    const shared = getSharedRenderer();
    // В живом 3D-бою оффскрин-контекст намеренно освобождён — GLB-шаблон
    // остаётся ready, иначе ломается cloneModelTemplate() для всех бойцов.
    if (!shared) return null;

    const inst = this.getOrCreateInstance(instanceId);
    if (!inst) return null;

    if (anim === "dead") {
      if (inst.currentAnim !== "dead") {
        for (const a of Object.values(inst.actions)) {
          if (a) a.stop();
        }
        inst.currentAnim = "dead";
      }
      inst.model.position.set(0, 0, 0);
      inst.model.rotation.set(-Math.PI / 2, 0, Math.PI / 2 - angleRad);
    } else {
      inst.model.position.set(0, 0, 0);
      inst.model.rotation.set(0, Math.PI / 2 - angleRad, 0);

      if (anim === "still") {
        if (inst.currentAnim !== "still") {
          this.enterStandingStill(inst);
          inst.currentAnim = "still";
        }
        inst.mixer.update(Math.max(1e-6, getGameRenderDt()));
      } else {
        const dt = getGameRenderDt();
        const step = Math.min(0.05, dt);

        if (anim === "run") {
          if (inst.currentAnim !== "run") {
            const idleA = inst.actions.idle;
            const runA = inst.actions.run;
            const sharedLoco = !!(idleA && runA && idleA === runA);
            if (sharedLoco && inst.currentAnim === "still") {
              runA!.paused = false;
              runA!.setEffectiveWeight(1);
              runA!.setEffectiveTimeScale(this.animNames.sharedLocomotionRunScale ?? 1);
              runA!.play();
            } else {
              inst.mixer.stopAllAction();
              const r = inst.actions.run;
              if (r) {
                r.reset();
                r.setEffectiveWeight(1);
                r.paused = false;
                r.setEffectiveTimeScale(1);
                r.play();
              }
            }
            inst.currentAnim = "run";
          }
        } else if (anim === "attack") {
          if (inst.currentAnim !== "attack") {
            inst.mixer.stopAllAction();
            const a = inst.actions.attack;
            if (a) {
              a.reset();
              a.setEffectiveWeight(1);
              a.paused = false;
              a.setEffectiveTimeScale(this.animNames.attackClipTune?.timeScale ?? 1);
              a.play();
            }
            inst.currentAnim = "attack";
          }
        } else if (anim === "idle") {
          if (inst.currentAnim !== "idle") {
            inst.mixer.stopAllAction();
            const id = inst.actions.idle;
            if (id) {
              id.reset();
              id.setEffectiveWeight(1);
              id.paused = false;
              id.setEffectiveTimeScale(1);
              id.play();
            }
            inst.currentAnim = "idle";
          }
        }

        inst.mixer.update(Math.max(1e-6, step));
      }
    }

    shared.scene.clear();
    shared.scene.add(new THREE.AmbientLight(0xffffff, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 3.5);
    key.position.set(2, 6, 2);
    shared.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 1.5);
    fill.position.set(-2, 4, -2);
    shared.scene.add(fill);
    inst.model.updateMatrixWorld(true);
    shared.scene.add(inst.model);

    configureCharacterBattleOrtho(shared.camera);
    shared.renderer.render(shared.scene, shared.camera);

    // Copy rendered frame from the shared WebGL canvas to this character's
    // dedicated 2D canvas so subsequent character renders don't overwrite it.
    if (this.outputCtx) applyCanvasBitmapDrawPolicy(this.outputCtx);
    this.outputCtx.clearRect(0, 0, SIZE, SIZE);
    this.outputCtx.drawImage(shared.renderer.domElement, 0, 0);

    return this.outputCanvas;
  }
}

// ── Lazy registry ─────────────────────────────────────────────────────────────

/** Character IDs that have a 3D GLB model for in-battle rendering. */
export const CHAR_3D_IDS = new Set(["miya", "ronin", "yuki", "kenji", "hana", "goro", "sora", "rin", "taro", "zafkiel", "verdeletta", "lumina", "oliver", "callista", "airin", "elian", "silven", "vittoria", "octavia", "zephyrin", "mirabel"]);

let _base = "/";
const rendererRegistry = new Map<string, CharacterTopDownRenderer>();

/** Call once (on module import) to record the base URL for lazy GLB loading. */
export function setRenderersBase(base: string): void {
  _base = base;
}

/**
 * Eagerly preload every 3D character model and warm up the GPU.
 * Call this as soon as the player decides to enter battle (e.g. during the
 * loading screen) so that GLB downloads and shader compilation finish before
 * the game loop starts — eliminating the 2-D → 3-D pop and mid-game lag.
 */
export function preloadCharRenderers(base: string, onCharLoaded?: () => void): Promise<void> {
  setRenderersBase(base);
  const b = base.endsWith("/") ? base : `${base}/`;
  const promises = Array.from(CHAR_3D_IDS).map(id => {
    let r = rendererRegistry.get(id);
    if (!r) {
      const names = CHAR_ANIM_NAMES[id] ?? { idle: "Walking", run: "Running", attack: "Attack" };
      r = new CharacterTopDownRenderer(names);
      rendererRegistry.set(id, r);
    }
    return r.init(brawlerGlbUrl(b, id))
      .then(() => { onCharLoaded?.(); })
      .catch(() => {
        onCharLoaded?.();
      });
  });
  return Promise.all(promises).then(() => {});
}

/** @deprecated use setRenderersBase */
export function initCharRenderers(base: string): void {
  setRenderersBase(base);
}

/**
 * Returns the renderer for the given character, creating and starting the load
 * if it hasn't been requested before. Falls back to null if the character has
 * no 3D model.
 */
export function getCharRenderer(id: string): CharacterTopDownRenderer | null {
  if (!CHAR_3D_IDS.has(id)) return null;
  let r = rendererRegistry.get(id);
  if (!r) {
    const names = CHAR_ANIM_NAMES[id] ?? { idle: "Walking", run: "Running", attack: "Attack" };
    r = new CharacterTopDownRenderer(names);
    r.init(brawlerGlbUrl(_base, id)).catch(() => { /* fall back to 2D sprite */ });
    rendererRegistry.set(id, r);
  }
  return r;
}

/** @deprecated kept for any lingering references — use getCharRenderer("miya") */
export const miyaTopDown = {
  init: (url: string) => rendererRegistry.get("miya")?.init(url) ?? Promise.resolve(),
  isReady: () => rendererRegistry.get("miya")?.isReady() ?? false,
  render: (id: string, anim: CharAnim, angle: number) =>
    rendererRegistry.get("miya")?.render(id, anim, angle) ?? null,
};
