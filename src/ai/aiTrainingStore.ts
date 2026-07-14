/**
 * Multi-track persistent store for headless battle training + player observation.
 */
import {
  ALL_TRAINING_TRACKS,
  getTotalTrainingTarget,
  getTrackTarget,
  TRAINING_STORE_FLUSH_EVERY,
  type TrainingTrackId,
} from "./aiTrainingConfig";

export { getTotalTrainingTarget, TRAINING_GEMGRAB_TARGET, TRAINING_OTHER_MODES_TOTAL, TRAINING_BOSS_TARGET } from "./aiTrainingConfig";
export type { TrainingTrackId } from "./aiTrainingConfig";

/** Sum of all track targets (~48M with 14 bosses). */
export const AI_TRAINING_TARGET_CYCLES = getTotalTrainingTarget();

export interface TrainingTuning {
  engageBias: number;
  objectiveBias: number;
  retreatBias: number;
  flankBias: number;
  superBias: number;
}

export interface TrainingTrackProgress {
  id: TrainingTrackId;
  label: string;
  category: "core" | "mode" | "boss";
  cycles: number;
  target: number;
  blueWins: number;
  redWins: number;
  timeouts: number;
  complete: boolean;
  pct: number;
}

export interface TrainingProgress {
  totalCycles: number;
  targetCycles: number;
  blueWins: number;
  redWins: number;
  timeouts: number;
  complete: boolean;
  lastBatchAt: number;
  cyclesPerSec: number;
  tracks: TrainingTrackProgress[];
  completedTracks: number;
  totalTracks: number;
}

interface TrackStats {
  cycles: number;
  blueWins: number;
  redWins: number;
  timeouts: number;
  tacticWins: Record<string, number>;
  tacticLosses: Record<string, number>;
}

interface TrainingStoreV2 {
  version: 2;
  tracks: Record<string, TrackStats>;
  lastBatchAt: number;
  recentBatchSize: number;
  recentBatchMs: number;
}

interface PlayerObsStore {
  samples: number;
  retreatHpSum: number;
  engageRangeSum: number;
  gemFocusSum: number;
  gasAwareSum: number;
  matchCount: number;
}

const TRAINING_KEY = "ai_battle_training_v2";
const TRAINING_KEY_V1 = "ai_battle_training_v1";
const PLAYER_OBS_KEY = "ai_player_obs_v1";

let memStore: TrainingStoreV2 | null = null;
let storeDirty = false;
let cyclesSinceFlush = 0;

const DEFAULT_TRAINING_TUNING: TrainingTuning = {
  engageBias: 0,
  objectiveBias: 0,
  retreatBias: 0,
  flankBias: 0,
  superBias: 0,
};

function emptyTrackStats(): TrackStats {
  return {
    cycles: 0,
    blueWins: 0,
    redWins: 0,
    timeouts: 0,
    tacticWins: {},
    tacticLosses: {},
  };
}

function emptyStoreV2(): TrainingStoreV2 {
  const tracks: Record<string, TrackStats> = {};
  for (const t of ALL_TRAINING_TRACKS) tracks[t.id] = emptyTrackStats();
  return {
    version: 2,
    tracks,
    lastBatchAt: 0,
    recentBatchSize: 0,
    recentBatchMs: 0,
  };
}

function migrateV1(): TrainingStoreV2 {
  const store = emptyStoreV2();
  try {
    const raw = localStorage.getItem(TRAINING_KEY_V1);
    if (!raw) return store;
    const v1 = JSON.parse(raw) as {
      totalCycles?: number;
      blueWins?: number;
      redWins?: number;
      timeouts?: number;
      tacticWins?: Record<string, number>;
      tacticLosses?: Record<string, number>;
    };
    const g = store.tracks.gemgrab ?? emptyTrackStats();
    g.cycles = v1.totalCycles ?? 0;
    g.blueWins = v1.blueWins ?? 0;
    g.redWins = v1.redWins ?? 0;
    g.timeouts = v1.timeouts ?? 0;
    g.tacticWins = v1.tacticWins ?? {};
    g.tacticLosses = v1.tacticLosses ?? {};
    store.tracks.gemgrab = g;
  } catch { /* ignore */ }
  return store;
}

function loadTrainingStore(): TrainingStoreV2 {
  if (memStore) return memStore;
  memStore = loadTrainingStoreFromDisk();
  return memStore;
}

function loadTrainingStoreFromDisk(): TrainingStoreV2 {
  try {
    const raw = localStorage.getItem(TRAINING_KEY);
    if (!raw) return migrateV1();
    const parsed = JSON.parse(raw) as Partial<TrainingStoreV2>;
    if (parsed.version !== 2 || !parsed.tracks) return migrateV1();
    const store = emptyStoreV2();
    for (const t of ALL_TRAINING_TRACKS) {
      const hit = parsed.tracks[t.id];
      if (hit) store.tracks[t.id] = { ...emptyTrackStats(), ...hit, tacticWins: hit.tacticWins ?? {}, tacticLosses: hit.tacticLosses ?? {} };
    }
    store.lastBatchAt = parsed.lastBatchAt ?? 0;
    store.recentBatchSize = parsed.recentBatchSize ?? 0;
    store.recentBatchMs = parsed.recentBatchMs ?? 0;
    return store;
  } catch {
    return migrateV1();
  }
}

export function getMutableTrainingStore(): TrainingStoreV2 {
  return loadTrainingStore();
}

export function flushTrainingStore(force = false): void {
  if (!memStore) return;
  if (!force && !storeDirty) return;
  if (!force && cyclesSinceFlush < TRAINING_STORE_FLUSH_EVERY) return;
  saveTrainingStore(memStore);
  storeDirty = false;
  cyclesSinceFlush = 0;
}

function saveTrainingStore(store: TrainingStoreV2): void {
  try {
    localStorage.setItem(TRAINING_KEY, JSON.stringify(store));
  } catch { /* quota */ }
}

function loadPlayerObsStore(): PlayerObsStore {
  try {
    const raw = localStorage.getItem(PLAYER_OBS_KEY);
    if (!raw) return { samples: 0, retreatHpSum: 0, engageRangeSum: 0, gemFocusSum: 0, gasAwareSum: 0, matchCount: 0 };
    return { samples: 0, retreatHpSum: 0, engageRangeSum: 0, gemFocusSum: 0, gasAwareSum: 0, matchCount: 0, ...(JSON.parse(raw) as Partial<PlayerObsStore>) };
  } catch {
    return { samples: 0, retreatHpSum: 0, engageRangeSum: 0, gemFocusSum: 0, gasAwareSum: 0, matchCount: 0 };
  }
}

function savePlayerObsStore(store: PlayerObsStore): void {
  try {
    localStorage.setItem(PLAYER_OBS_KEY, JSON.stringify(store));
  } catch { /* quota */ }
}

export interface TrainingCycleResult {
  trackId: TrainingTrackId;
  blueWon: boolean;
  timedOut: boolean;
  durationSec: number;
  dominantTactic?: string;
}

function ensureTrack(store: TrainingStoreV2, id: TrainingTrackId): TrackStats {
  if (!store.tracks[id]) store.tracks[id] = emptyTrackStats();
  return store.tracks[id];
}

export function applyTrainingCycleResult(store: TrainingStoreV2, result: TrainingCycleResult): void {
  const track = ensureTrack(store, result.trackId);
  track.cycles += 1;
  if (result.timedOut) track.timeouts += 1;
  else if (result.blueWon) track.blueWins += 1;
  else track.redWins += 1;

  const tactic = result.dominantTactic ?? "unknown";
  if (result.blueWon) track.tacticWins[tactic] = (track.tacticWins[tactic] ?? 0) + 1;
  else if (!result.timedOut) track.tacticLosses[tactic] = (track.tacticLosses[tactic] ?? 0) + 1;

  store.lastBatchAt = Date.now();
  storeDirty = true;
  cyclesSinceFlush += 1;
  if (cyclesSinceFlush >= TRAINING_STORE_FLUSH_EVERY) flushTrainingStore(true);
}

export function recordTrainingCycle(result: TrainingCycleResult): TrainingProgress {
  const store = loadTrainingStore();
  applyTrainingCycleResult(store, result);
  return getTrainingProgress();
}

export function recordTrainingBatchMetaInStore(store: TrainingStoreV2, batchSize: number, elapsedMs: number): void {
  store.recentBatchSize = batchSize;
  store.recentBatchMs = Math.max(1, elapsedMs);
  store.lastBatchAt = Date.now();
  storeDirty = true;
}

/** @deprecated use recordTrainingBatchMetaInStore */
export function recordTrainingBatchMeta(batchSize: number, elapsedMs: number): void {
  const store = loadTrainingStore();
  recordTrainingBatchMetaInStore(store, batchSize, elapsedMs);
  flushTrainingStore(true);
}

export function pickNextIncompleteTrackFromStore(store: TrainingStoreV2): TrainingTrackId | null {
  let best: TrainingTrackDef | null = null;
  let bestRatio = Infinity;
  for (const def of ALL_TRAINING_TRACKS) {
    const st = store.tracks[def.id] ?? emptyTrackStats();
    if (st.cycles >= def.target) continue;
    const ratio = st.cycles / def.target;
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = def;
    }
  }
  return best?.id ?? null;
}

export function pickNextIncompleteTrack(): TrainingTrackId | null {
  return pickNextIncompleteTrackFromStore(loadTrainingStore());
}

export function isStoreTrainingComplete(store: TrainingStoreV2): boolean {
  for (const def of ALL_TRAINING_TRACKS) {
    const st = store.tracks[def.id] ?? emptyTrackStats();
    if (st.cycles < def.target) return false;
  }
  return true;
}

type TrainingTrackDef = typeof ALL_TRAINING_TRACKS[number];

export function getTrainingProgress(): TrainingProgress {
  const s = loadTrainingStore();
  let totalCycles = 0;
  let blueWins = 0;
  let redWins = 0;
  let timeouts = 0;
  let completedTracks = 0;

  const tracks: TrainingTrackProgress[] = ALL_TRAINING_TRACKS.map(def => {
    const st = s.tracks[def.id] ?? emptyTrackStats();
    totalCycles += st.cycles;
    blueWins += st.blueWins;
    redWins += st.redWins;
    timeouts += st.timeouts;
    const complete = st.cycles >= def.target;
    if (complete) completedTracks += 1;
    return {
      id: def.id,
      label: def.label,
      category: def.category,
      cycles: st.cycles,
      target: def.target,
      blueWins: st.blueWins,
      redWins: st.redWins,
      timeouts: st.timeouts,
      complete,
      pct: Math.min(100, (st.cycles / Math.max(1, def.target)) * 100),
    };
  });

  const cyclesPerSec = s.recentBatchMs > 0
    ? Math.round((s.recentBatchSize / s.recentBatchMs) * 1000)
    : 0;

  return {
    totalCycles,
    targetCycles: getTotalTrainingTarget(),
    blueWins,
    redWins,
    timeouts,
    complete: completedTracks >= ALL_TRAINING_TRACKS.length,
    lastBatchAt: s.lastBatchAt,
    cyclesPerSec,
    tracks,
    completedTracks,
    totalTracks: ALL_TRAINING_TRACKS.length,
  };
}

export function isTrainingComplete(): boolean {
  return getTrainingProgress().complete;
}

function aggregateTactics(store: TrainingStoreV2): { wins: Record<string, number>; losses: Record<string, number> } {
  const wins: Record<string, number> = {};
  const losses: Record<string, number> = {};
  for (const st of Object.values(store.tracks)) {
    for (const [k, v] of Object.entries(st.tacticWins)) wins[k] = (wins[k] ?? 0) + v;
    for (const [k, v] of Object.entries(st.tacticLosses)) losses[k] = (losses[k] ?? 0) + v;
  }
  return { wins, losses };
}

export function getTrainingTuning(): TrainingTuning {
  const s = loadTrainingStore();
  const totalCycles = Object.values(s.tracks).reduce((n, t) => n + t.cycles, 0);
  if (totalCycles < 100) return { ...DEFAULT_TRAINING_TUNING };

  const progress = Math.min(1, totalCycles / getTotalTrainingTarget());
  const scale = 0.15 + progress * 0.85;

  let blueWins = 0;
  let redWins = 0;
  let timeouts = 0;
  for (const st of Object.values(s.tracks)) {
    blueWins += st.blueWins;
    redWins += st.redWins;
    timeouts += st.timeouts;
  }

  const winRate = totalCycles ? blueWins / totalCycles : 0.5;
  const timeoutRate = totalCycles ? timeouts / totalCycles : 0;

  let engageBias = (winRate - 0.45) * 0.4 * scale;
  let objectiveBias = (winRate - 0.4) * 0.35 * scale;
  let retreatBias = timeoutRate * 0.25 * scale;
  let flankBias = 0;
  let superBias = 0;

  const { wins, losses } = aggregateTactics(s);
  const tactics = new Set([...Object.keys(wins), ...Object.keys(losses)]);
  for (const t of tactics) {
    const w = wins[t] ?? 0;
    const l = losses[t] ?? 0;
    const total = w + l;
    if (total < 20) continue;
    const wr = w / total;
    if (t.includes("flank")) flankBias += (wr - 0.5) * 0.08;
    if (t.includes("attack") || t.includes("engage")) engageBias += (wr - 0.5) * 0.06;
    if (t.includes("retreat") || t.includes("gas")) retreatBias += (wr - 0.5) * 0.05;
    if (t.includes("super") || t.includes("boss")) superBias += (wr - 0.5) * 0.04;
  }

  const bossTracks = ALL_TRAINING_TRACKS.filter(t => t.category === "boss");
  let bossProgress = 0;
  for (const bt of bossTracks) {
    const st = s.tracks[bt.id];
    if (st) bossProgress += Math.min(1, st.cycles / bt.target);
  }
  if (bossTracks.length) {
    superBias += (bossProgress / bossTracks.length - 0.5) * 0.12 * scale;
  }

  return {
    engageBias: clamp(engageBias, -0.35, 0.35),
    objectiveBias: clamp(objectiveBias, -0.35, 0.35),
    retreatBias: clamp(retreatBias, -0.2, 0.45),
    flankBias: clamp(flankBias, -0.25, 0.25),
    superBias: clamp(superBias, -0.2, 0.25),
  };
}

export function mergePlayerObservation(obs: {
  retreatHpAvg: number;
  engageRangeNorm: number;
  gemFocus: number;
  gasAware: number;
}): void {
  const store = loadPlayerObsStore();
  store.samples += 1;
  store.matchCount += 1;
  store.retreatHpSum += obs.retreatHpAvg;
  store.engageRangeSum += obs.engageRangeNorm;
  store.gemFocusSum += obs.gemFocus;
  store.gasAwareSum += obs.gasAware;
  savePlayerObsStore(store);
}

export function getPlayerObservationTuning(): TrainingTuning {
  const s = loadPlayerObsStore();
  if (s.matchCount < 2) return { ...DEFAULT_TRAINING_TUNING };

  const n = s.matchCount;
  return {
    engageBias: clamp(((s.engageRangeSum / n) - 0.55) * 0.3, -0.2, 0.2),
    objectiveBias: clamp(((s.gemFocusSum / n) - 0.5) * 0.35, -0.25, 0.25),
    retreatBias: clamp((0.45 - s.retreatHpSum / n) * 0.4, -0.15, 0.3),
    flankBias: clamp(((s.engageRangeSum / n) - 0.5) * 0.15, -0.15, 0.15),
    superBias: clamp(((s.gasAwareSum / n) - 0.5) * 0.1, -0.1, 0.1),
  };
}

export function getCombinedTrainingTuning(): TrainingTuning {
  const sim = getTrainingTuning();
  const obs = getPlayerObservationTuning();
  const simWeight = isTrainingComplete() ? 0.72 : 0.55;
  const obsWeight = 1 - simWeight;
  return {
    engageBias: sim.engageBias * simWeight + obs.engageBias * obsWeight,
    objectiveBias: sim.objectiveBias * simWeight + obs.objectiveBias * obsWeight,
    retreatBias: sim.retreatBias * simWeight + obs.retreatBias * obsWeight,
    flankBias: sim.flankBias * simWeight + obs.flankBias * obsWeight,
    superBias: sim.superBias * simWeight + obs.superBias * obsWeight,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function getTrackTargetFor(id: TrainingTrackId): number {
  return getTrackTarget(id);
}

export function getTrainingTacticSummary(): Array<{ tactic: string; wins: number; losses: number; wr: number }> {
  const s = loadTrainingStore();
  const { wins, losses } = aggregateTactics(s);
  const names = new Set([...Object.keys(wins), ...Object.keys(losses)]);
  return [...names]
    .map(tactic => {
      const w = wins[tactic] ?? 0;
      const l = losses[tactic] ?? 0;
      const total = w + l;
      return { tactic, wins: w, losses: l, wr: total ? w / total : 0 };
    })
    .filter(row => row.wins + row.losses >= 5)
    .sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
}
