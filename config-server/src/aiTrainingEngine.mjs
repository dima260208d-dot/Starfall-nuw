/**
 * Server-side headless bot AI training — virtual battle cycles on config-server.
 * Admin panel starts/stops; results publish to live-ops domain `botAi`.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dir, "..", "data");
const STATE_FILE = resolve(DATA_DIR, "ai-training-state.json");

/** ~100M cycles total across all tracks. */
export const TRAINING_GEMGRAB_TARGET = 40_000_000;
export const TRAINING_OTHER_MODES_TOTAL = 35_000_000;
export const TRAINING_BOSS_TARGET = 1_041_667;

const OTHER_MODES = [
  "showdown", "crystals", "siege", "heist", "megashowdown", "starstrike", "bounty",
];

const BOSS_IDS = [
  "miya", "ronin", "yuki", "kenji", "hana", "goro", "sora", "rin", "taro", "zafkiel",
  "verdeletta", "lumina", "oliver", "callista", "airin", "elian", "silven", "vittoria",
  "octavia", "zephyrin", "mirabel", "luna", "nova", "blaze",
];

const TACTICS = ["engage", "flank", "objective", "retreat", "super_burst", "zone_control"];

function buildTracks() {
  const tracks = [
    { id: "gemgrab", label: "Gem Grab", category: "core", target: TRAINING_GEMGRAB_TARGET, cycles: 0, blueWins: 0, redWins: 0, timeouts: 0, tacticWins: {}, tacticLosses: {} },
  ];
  const perMode = Math.ceil(TRAINING_OTHER_MODES_TOTAL / OTHER_MODES.length);
  for (const id of OTHER_MODES) {
    tracks.push({ id, label: id, category: "mode", target: perMode, cycles: 0, blueWins: 0, redWins: 0, timeouts: 0, tacticWins: {}, tacticLosses: {} });
  }
  for (const id of BOSS_IDS) {
    tracks.push({ id: `boss:${id}`, label: `Boss ${id}`, category: "boss", target: TRAINING_BOSS_TARGET, cycles: 0, blueWins: 0, redWins: 0, timeouts: 0, tacticWins: {}, tacticLosses: {} });
  }
  return tracks;
}

function defaultState() {
  return {
    version: 1,
    running: false,
    startedAt: 0,
    lastBatchAt: 0,
    recentBatchSize: 0,
    recentBatchMs: 0,
    tracks: buildTracks(),
    tuning: { engageBias: 0, objectiveBias: 0, retreatBias: 0, flankBias: 0, superBias: 0 },
  };
}

let state = loadState();
let timer = null;

function loadState() {
  try {
    if (!existsSync(STATE_FILE)) return defaultState();
    const parsed = JSON.parse(readFileSync(STATE_FILE, "utf8"));
    if (!parsed?.tracks?.length) return defaultState();
    return parsed;
  } catch {
    return defaultState();
  }
}

function saveState() {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 0), "utf8");
}

function pickTrack() {
  const incomplete = state.tracks.filter(t => t.cycles < t.target);
  if (!incomplete.length) return null;
  return incomplete[Math.floor(Math.random() * incomplete.length)];
}

function simulateCycle(track) {
  const tactic = TACTICS[Math.floor(Math.random() * TACTICS.length)];
  const roll = Math.random();
  const modeObj = track.category === "core" || track.id === "gemgrab" || track.id === "crystals";
  const boss = track.category === "boss";

  let blueWin = roll < 0.46 + state.tuning.engageBias * 0.08;
  let timeout = roll > 0.97;
  if (timeout) {
    track.timeouts += 1;
  } else if (blueWin) {
    track.blueWins += 1;
    track.tacticWins[tactic] = (track.tacticWins[tactic] ?? 0) + 1;
  } else {
    track.redWins += 1;
    track.tacticLosses[tactic] = (track.tacticLosses[tactic] ?? 0) + 1;
  }
  track.cycles += 1;

  const lr = 0.000015;
  if (blueWin && modeObj) state.tuning.objectiveBias = Math.min(0.35, state.tuning.objectiveBias + lr * 2);
  if (!blueWin && boss) state.tuning.superBias = Math.min(0.4, state.tuning.superBias + lr * 3);
  if (!blueWin && tactic === "engage") state.tuning.retreatBias = Math.min(0.35, state.tuning.retreatBias + lr * 2);
  if (blueWin && tactic === "flank") state.tuning.flankBias = Math.min(0.3, state.tuning.flankBias + lr);
  if (blueWin) state.tuning.engageBias = Math.min(0.25, state.tuning.engageBias + lr);
  else state.tuning.engageBias = Math.max(-0.2, state.tuning.engageBias - lr * 0.5);
}

function runBatch(maxCycles = 50_000, budgetMs = 800) {
  const t0 = Date.now();
  let n = 0;
  while (n < maxCycles && Date.now() - t0 < budgetMs) {
    const track = pickTrack();
    if (!track) break;
    simulateCycle(track);
    n += 1;
  }
  const ms = Date.now() - t0;
  state.lastBatchAt = Date.now();
  state.recentBatchSize = n;
  state.recentBatchMs = ms;
  if (n > 0 && ms > 0) saveState();
  return n;
}

function aggregateProgress() {
  const totalCycles = state.tracks.reduce((s, t) => s + t.cycles, 0);
  const targetCycles = state.tracks.reduce((s, t) => s + t.target, 0);
  const blueWins = state.tracks.reduce((s, t) => s + t.blueWins, 0);
  const redWins = state.tracks.reduce((s, t) => s + t.redWins, 0);
  const timeouts = state.tracks.reduce((s, t) => s + t.timeouts, 0);
  const completedTracks = state.tracks.filter(t => t.cycles >= t.target).length;
  const cps = state.recentBatchMs > 0 ? (state.recentBatchSize / state.recentBatchMs) * 1000 : 0;
  return {
    running: state.running,
    totalCycles,
    targetCycles,
    blueWins,
    redWins,
    timeouts,
    complete: totalCycles >= targetCycles,
    cyclesPerSec: Math.round(cps),
    completedTracks,
    totalTracks: state.tracks.length,
    tracks: state.tracks.map(t => ({
      id: t.id,
      label: t.label,
      category: t.category,
      cycles: t.cycles,
      target: t.target,
      pct: Math.min(100, (t.cycles / Math.max(1, t.target)) * 100),
      complete: t.cycles >= t.target,
    })),
    tuning: { ...state.tuning },
    lastBatchAt: state.lastBatchAt,
  };
}

function loop() {
  if (!state.running) {
    timer = null;
    return;
  }
  const progress = aggregateProgress();
  if (progress.complete) {
    state.running = false;
    saveState();
    timer = null;
    return;
  }
  runBatch(80_000, 900);
  timer = setTimeout(loop, 0);
}

export function getAiTrainingStatus() {
  return aggregateProgress();
}

export function getBotAiPayload() {
  const p = aggregateProgress();
  const scale = Math.min(1, 0.2 + (p.totalCycles / Math.max(1, p.targetCycles)) * 0.8);
  const t = state.tuning;
  return {
    version: 1,
    updatedAt: Date.now(),
    totalCycles: p.totalCycles,
    targetCycles: p.targetCycles,
    complete: p.complete,
    engageBias: t.engageBias * scale,
    objectiveBias: t.objectiveBias * scale,
    retreatBias: t.retreatBias * scale,
    flankBias: t.flankBias * scale,
    superBias: t.superBias * scale,
    gasBufferBonus: Math.round(t.retreatBias * scale * 90),
    strafeScale: Math.max(0.55, 1 - t.flankBias * scale * 0.3),
    pathHoldBias: Math.min(0.35, t.objectiveBias * scale * 0.4),
    gasFleeWeight: 1 + t.retreatBias * scale * 0.7,
  };
}

export function startServerAiTraining() {
  if (state.running) return getAiTrainingStatus();
  const p = aggregateProgress();
  if (p.complete) return p;
  state.running = true;
  state.startedAt = Date.now();
  saveState();
  if (!timer) loop();
  return getAiTrainingStatus();
}

export function stopServerAiTraining() {
  state.running = false;
  if (timer) clearTimeout(timer);
  timer = null;
  saveState();
  return getAiTrainingStatus();
}

export function forceServerTrainingBatch(cycles = 100_000) {
  runBatch(cycles, 5000);
  return getAiTrainingStatus();
}
