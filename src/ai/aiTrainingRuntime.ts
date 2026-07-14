/**
 * Background cyclic battle training - runs headless sim batches when enabled in admin.
 */
import { runTrainingBatch } from "./aiBattleTrainer";
import {
  TRAINING_BATCH_BUDGET_HIDDEN_MS,
  TRAINING_BATCH_BUDGET_MS,
  TRAINING_BATCH_CYCLES,
  TRAINING_BATCH_CYCLES_HIDDEN,
  TRAINING_FORCE_BATCH_BUDGET_MS,
  TRAINING_FORCE_BATCH_CYCLES,
  TRAINING_GATE_BATCH_CYCLES,
  TRAINING_GATE_BUDGET_MS,
} from "./aiTrainingConfig";
import {
  getTrainingControlState,
  isAiTrainingRunning,
  setTrainingControlState,
  subscribeTrainingControl,
  type TrainingControlState,
} from "./aiTrainingControl";
import {
  getTrainingProgress,
  flushTrainingStore,
  isTrainingComplete,
  type TrainingProgress,
} from "./aiTrainingStore";

const TRAINING_EVENT = "ai-training-progress";

let running = false;
let timerId = 0;

function isTabHidden(): boolean {
  return typeof document !== "undefined" && document.hidden;
}

/** @deprecated game is no longer blocked; use isAiTrainingRunning() */
export function isGamePausedForTraining(): boolean {
  return isAiTrainingRunning();
}

function getBatchPlan(): { cycles: number; budgetMs: number; pauseMs: number } {
  if (isTabHidden()) {
    return {
      cycles: TRAINING_BATCH_CYCLES_HIDDEN,
      budgetMs: TRAINING_BATCH_BUDGET_HIDDEN_MS,
      pauseMs: 0,
    };
  }
  if (isAiTrainingRunning()) {
    return {
      cycles: TRAINING_GATE_BATCH_CYCLES,
      budgetMs: TRAINING_GATE_BUDGET_MS,
      pauseMs: 0,
    };
  }
  return {
    cycles: TRAINING_BATCH_CYCLES,
    budgetMs: TRAINING_BATCH_BUDGET_MS,
    pauseMs: 8,
  };
}

function emitProgress(p: TrainingProgress): void {
  window.dispatchEvent(new CustomEvent(TRAINING_EVENT, { detail: p }));
}

function detachTrainingListeners(): void {
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("beforeunload", onTrainingBeforeUnload);
  }
}

function trainingLoop(): void {
  if (!running || !isAiTrainingRunning() || isTrainingComplete()) {
    running = false;
    timerId = 0;
    flushTrainingStore(true);
    emitProgress(getTrainingProgress());
    if (!isAiTrainingRunning() || isTrainingComplete()) detachTrainingListeners();
    return;
  }

  const plan = getBatchPlan();
  let progress = getTrainingProgress();
  const burst = isAiTrainingRunning() ? 2 : 1;
  for (let i = 0; i < burst && !progress.complete; i += 1) {
    progress = runTrainingBatch(plan.cycles, plan.budgetMs);
  }
  emitProgress(progress);

  if (progress.complete || !isAiTrainingRunning()) {
    running = false;
    timerId = 0;
    flushTrainingStore(true);
    if (progress.complete) setTrainingControlState("stopped");
    detachTrainingListeners();
    return;
  }

  timerId = window.setTimeout(trainingLoop, plan.pauseMs);
}

function onVisibilityChange(): void {
  if (!running || !isAiTrainingRunning() || isTrainingComplete()) return;
  if (timerId) window.clearTimeout(timerId);
  timerId = window.setTimeout(trainingLoop, 0);
}

function onTrainingBeforeUnload(): void {
  flushTrainingStore(true);
}

function beginTrainingLoop(): void {
  if (running) return;
  if (isTrainingComplete()) {
    emitProgress(getTrainingProgress());
    setTrainingControlState("stopped");
    return;
  }
  running = true;
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onTrainingBeforeUnload);
  }
  trainingLoop();
}

/** Start background training (admin control). */
export function startAiBattleTraining(): void {
  if (isTrainingComplete()) {
    emitProgress(getTrainingProgress());
    return;
  }
  setTrainingControlState("running");
  beginTrainingLoop();
}

/** Stop training and persist all recorded cycles/tuning. */
export function stopAiBattleTraining(): void {
  setTrainingControlState("stopped");
  running = false;
  if (timerId) window.clearTimeout(timerId);
  timerId = 0;
  flushTrainingStore(true);
  detachTrainingListeners();
  emitProgress(getTrainingProgress());
}

export function subscribeTrainingProgress(cb: (p: TrainingProgress) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<TrainingProgress>).detail);
  window.addEventListener(TRAINING_EVENT, handler);
  cb(getTrainingProgress());
  return () => window.removeEventListener(TRAINING_EVENT, handler);
}

export function subscribeTrainingControlState(cb: (state: TrainingControlState) => void): () => void {
  return subscribeTrainingControl(cb);
}

export { isAiTrainingRunning, getTrainingControlState };

export function getAiTrainingStatus(): TrainingProgress {
  return getTrainingProgress();
}

export function forceTrainingBatch(
  cycles = TRAINING_FORCE_BATCH_CYCLES,
  budgetMs = TRAINING_FORCE_BUDGET_MS,
): TrainingProgress {
  const p = runTrainingBatch(cycles, budgetMs);
  flushTrainingStore(true);
  emitProgress(p);
  return p;
}

/** Resume loop if control flag is running (e.g. after admin reload). */
export function syncAiBattleTrainingFromControl(): void {
  if (getTrainingControlState() === "running" && !isTrainingComplete()) beginTrainingLoop();
}
