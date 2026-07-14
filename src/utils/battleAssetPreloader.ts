/**
 * Единая предзагрузка ресурсов боя с реальным прогрессом (GLB, текстуры, спрайты).
 */
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BRAWLERS } from "../entities/BrawlerData";
import { preloadCharRenderers, disposeCharBakerSharedRenderer } from "../game/miyaTopDownRenderer";
import { preloadPetModels } from "../game/pet3DRenderer";
import { loadSpriteSheet, loadBrawlerImages } from "../game/sprites";
import { loadRollingStarBallModel } from "../game/soccerBallRenderer";
import type { GameMode } from "../App";
import {
  loadAllTileModels,
  disposeTileBakerRenderer,
  scheduleTileAtlasBake,
  areTileGLBTemplatesReady,
} from "./tileModelCache";
import { loadBinbunGrassAssets } from "../game/binbunGrass3D";
import { loadPowerBoxGLBTemplate, loadPowerJarGLBTemplate, loadPowerModels, disposePowerBakerRenderer } from "./powerModelCache";
import { loadResourceListIcons, disposeResourceListIconBaker } from "./resourceListIconCache";
import { preloadAllMenuUi3DGltfs } from "./menuUi3DPreload";
import { getTrainingMonsterModelIds } from "./devBattleMonsters";
import { preloadDevMonsterModels, setDevMonsterRenderersBase } from "../game/devMonster3DRenderer";

export type PreloadProgressCallback = (ratio: number) => void;

type WeightedTask = { weight: number; run: () => Promise<unknown> };

/** Минимальное время экрана загрузки перед боем (мс). */
export const BATTLE_LOADING_MIN_MS = 3500;

let battleAssetsReady = false;
let corePreloadPromise: Promise<void> | null = null;
let corePreloadProgress = 0;
const coreProgressListeners = new Set<PreloadProgressCallback>();

export function isBattleAssetsReady(): boolean {
  return battleAssetsReady;
}

export function resetBattleAssetsReady(): void {
  battleAssetsReady = false;
  corePreloadPromise = null;
  corePreloadProgress = 0;
}

function releaseMenuBakerContexts(): void {
  disposeTileBakerRenderer();
  disposePowerBakerRenderer();
  disposeResourceListIconBaker();
  disposeCharBakerSharedRenderer();
}

const TASK_TIMEOUT_MS = 45_000;

function withTaskTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`preload timeout: ${label}`));
    }, TASK_TIMEOUT_MS);
    promise.then(
      (value) => { window.clearTimeout(timer); resolve(value); },
      (err) => { window.clearTimeout(timer); reject(err); },
    );
  });
}

function emitCoreProgress(ratio: number): void {
  corePreloadProgress = ratio;
  for (const cb of coreProgressListeners) cb(ratio);
}

function subscribeCoreProgress(onProgress: PreloadProgressCallback): () => void {
  coreProgressListeners.add(onProgress);
  onProgress(corePreloadProgress);
  return () => { coreProgressListeners.delete(onProgress); };
}

async function runWeightedPreload(
  tasks: WeightedTask[],
  onProgress: PreloadProgressCallback,
): Promise<void> {
  const total = tasks.reduce((s, t) => s + t.weight, 0);
  if (total <= 0) {
    onProgress(1);
    return;
  }
  let done = 0;
  let nextIdx = 0;
  onProgress(0.02);

  const TASK_CONCURRENCY = 2;
  async function worker(): Promise<void> {
    while (nextIdx < tasks.length) {
      const index = nextIdx++;
      const task = tasks[index]!;
      try {
        await withTaskTimeout(task.run(), `task-${index}`);
      } catch (err) {
        console.warn("[preload] task failed:", err);
      }
      done += task.weight;
      onProgress(0.02 + (done / total) * 0.96);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(TASK_CONCURRENCY, tasks.length) }, () => worker()),
  );

  onProgress(1);
}

function collectBootTasks(base: string): WeightedTask[] {
  return [
    { weight: 16, run: () => preloadAllMenuUi3DGltfs() },
    ...collectCoreBattleTasks(base),
  ];
}

function collectCoreBattleTasks(base: string): WeightedTask[] {
  const b = base.endsWith("/") ? base : `${base}/`;
  return [
    { weight: 24, run: () => loadAllTileModels(undefined, { glbOnly: true }) },
    { weight: 10, run: () => loadBinbunGrassAssets(b) },
    { weight: 5, run: () => loadPowerBoxGLBTemplate() },
    { weight: 5, run: () => loadPowerJarGLBTemplate() },
    { weight: 18, run: () => preloadCharRenderers(b) },
    { weight: 6, run: () => preloadPetModels(b) },
    { weight: 4, run: () => loadSpriteSheet(`${b}characters.webp`) },
    { weight: 14, run: () => loadBrawlerImages(BRAWLERS.map((x) => x.id), b) },
    { weight: 4, run: () => loadResourceListIcons() },
  ];
}

function collectBattleVerifyTasks(base: string): WeightedTask[] {
  const b = base.endsWith("/") ? base : `${base}/`;
  return [
    { weight: 30, run: async () => { await loadAllTileModels(undefined, { glbOnly: true }); } },
    { weight: 20, run: () => loadBinbunGrassAssets(b) },
    { weight: 15, run: () => preloadCharRenderers(b) },
    { weight: 10, run: () => loadPowerBoxGLBTemplate() },
    { weight: 10, run: () => loadPowerJarGLBTemplate() },
    { weight: 15, run: async () => {
      if (!areTileGLBTemplatesReady()) {
        await loadAllTileModels(undefined, { glbOnly: true });
      }
    }},
  ];
}

async function ensureCoreBattleAssets(
  base: string,
  onProgress: PreloadProgressCallback,
): Promise<void> {
  if (battleAssetsReady) {
    onProgress(1);
    return;
  }
  if (corePreloadPromise) {
    const unsub = subscribeCoreProgress(onProgress);
    try {
      await corePreloadPromise;
    } finally {
      unsub();
    }
    onProgress(1);
    return;
  }

  corePreloadPromise = runWeightedPreload(collectBootTasks(base), emitCoreProgress)
    .then(() => {
      battleAssetsReady = true;
      releaseMenuBakerContexts();
      scheduleTileAtlasBake();
    })
    .finally(() => {
      corePreloadPromise = null;
    });

  const unsub = subscribeCoreProgress(onProgress);
  try {
    await corePreloadPromise;
  } finally {
    unsub();
  }
}

function loadGlbQuiet(url: string): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(), 30_000);
    new GLTFLoader().load(
      url,
      () => { window.clearTimeout(timer); resolve(); },
      undefined,
      () => { window.clearTimeout(timer); resolve(); },
    );
  });
}

function collectModeBattleTasks(base: string, mode?: GameMode): WeightedTask[] {
  const b = base.endsWith("/") ? base : `${base}/`;
  const tasks: WeightedTask[] = [];
  if (mode === "starstrike") {
    tasks.push({ weight: 8, run: () => loadPowerModels() });
    tasks.push({ weight: 6, run: () => loadRollingStarBallModel(b) });
  }
  if (mode === "heist") {
    tasks.push({ weight: 5, run: () => loadGlbQuiet(`${b}models/safe.glb`) });
  }
  if (mode === "gemgrab" || mode === "crystals") {
    tasks.push({ weight: 4, run: () => loadGlbQuiet(`${b}models/gem.glb`) });
  }
  if (mode === "training") {
    tasks.push({
      weight: 10,
      run: async () => {
        setDevMonsterRenderersBase(b);
        await preloadDevMonsterModels(getTrainingMonsterModelIds(5));
      },
    });
  }
  return tasks;
}

function mergeProgress(
  onProgress: PreloadProgressCallback,
  assetRatio: number,
  timeRatio: number,
): void {
  // Assets cap at 92%; last 8% + min timer gate the loading screen exit.
  const assetPart = Math.min(0.92, assetRatio * 0.92);
  const timePart = Math.min(0.08, timeRatio * 0.08);
  onProgress(Math.min(0.99, assetPart + timePart));
}

/** Предзагрузка при старте игры (меню). */
export async function preloadBootAssets(
  base: string,
  onProgress: PreloadProgressCallback,
): Promise<void> {
  await ensureCoreBattleAssets(base, onProgress);
}

export interface BattlePreloadOptions {
  mode?: GameMode;
}

/** Перед входом в бой — всегда с минимальной длительностью и проверкой GLB/травы. */
export async function preloadBattleAssets(
  base: string,
  onProgress: PreloadProgressCallback,
  opts: BattlePreloadOptions = {},
): Promise<void> {
  const modeTasks = collectModeBattleTasks(base, opts.mode);
  const started = performance.now();

  const tickTimer = window.setInterval(() => {
    const timeRatio = Math.min(1, (performance.now() - started) / BATTLE_LOADING_MIN_MS);
    mergeProgress(onProgress, corePreloadProgress, timeRatio);
  }, 80);

  let assetRatio = 0;
  const onAssetProgress = (p: number) => {
    assetRatio = p;
    const timeRatio = Math.min(1, (performance.now() - started) / BATTLE_LOADING_MIN_MS);
    mergeProgress(onProgress, assetRatio, timeRatio);
  };

  try {
    onAssetProgress(0.01);

    if (!battleAssetsReady) {
      await ensureCoreBattleAssets(base, onAssetProgress);
    } else {
      await runWeightedPreload(collectBattleVerifyTasks(base), onAssetProgress);
    }

    if (modeTasks.length > 0) {
      await runWeightedPreload(modeTasks, onAssetProgress);
    }

    while (performance.now() - started < BATTLE_LOADING_MIN_MS) {
      const timeRatio = (performance.now() - started) / BATTLE_LOADING_MIN_MS;
      mergeProgress(onProgress, 1, timeRatio);
      await new Promise<void>((r) => window.setTimeout(r, 50));
    }
  } finally {
    window.clearInterval(tickTimer);
    onProgress(1);
    releaseMenuBakerContexts();
  }
}
