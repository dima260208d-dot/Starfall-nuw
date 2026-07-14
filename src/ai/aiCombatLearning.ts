/**
 * Локальная «память» ИИ: накапливает исходы боёв реального игрока и
 * подстраивает приоритеты ботов / автопилота (без внешнего ML).
 */
import { getCombinedTrainingTuning } from "./aiTrainingStore";
import { getServerBotAiTuning } from "../utils/serverBotAiTuning";

const STORAGE_KEY = "ai_combat_memory_v1";
const MAX_RECORDS = 120;

export type CombatDeathTag =
  | "gas"
  | "stuck"
  | "low_hp_duel"
  | "objective_loss"
  | "unknown";

export interface CombatMatchRecord {
  ts: number;
  mode: string;
  won: boolean;
  brawlerId: string;
  deathTag: CombatDeathTag;
  durationSec: number;
}

export interface CombatAiTuning {
  /** Доп. буфер отступа от газа (px). */
  gasBufferBonus: number;
  /** 0..1 — уменьшение бокового strafe у ботов. */
  strafeScale: number;
  /** Чаще держать BFS-шаг дольше. */
  pathHoldBias: number;
  /** Вес «не заходить в газ» для автопилота. */
  gasFleeWeight: number;
  /** Из циклического обучения + наблюдения игрока. */
  engageBias: number;
  objectiveBias: number;
  retreatBias: number;
  flankBias: number;
  superBias: number;
}

interface MemoryStore {
  records: CombatMatchRecord[];
}

const DEFAULT_TUNING: CombatAiTuning = {
  gasBufferBonus: 0,
  strafeScale: 1,
  pathHoldBias: 0,
  gasFleeWeight: 1,
  engageBias: 0,
  objectiveBias: 0,
  retreatBias: 0,
  flankBias: 0,
  superBias: 0,
};

function loadStore(): MemoryStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { records: [] };
    const parsed = JSON.parse(raw) as MemoryStore;
    if (!Array.isArray(parsed.records)) return { records: [] };
    return parsed;
  } catch {
    return { records: [] };
  }
}

function saveStore(store: MemoryStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* quota */ }
}

export function recordCombatMatch(record: Omit<CombatMatchRecord, "ts">): void {
  const store = loadStore();
  store.records.push({ ...record, ts: Date.now() });
  if (store.records.length > MAX_RECORDS) {
    store.records = store.records.slice(-MAX_RECORDS);
  }
  saveStore(store);
  try {
    const { logDevAiEvent } = require("../utils/devAnalytics/devAiTelemetry") as typeof import("../utils/devAnalytics/devAiTelemetry");
    logDevAiEvent({
      source: "system",
      kind: "combat_learn",
      mode: record.mode,
      detail: record.won ? `Победа (${record.brawlerId})` : `Поражение: ${record.deathTag}`,
      meta: { won: record.won, deathTag: record.deathTag, durationSec: record.durationSec },
    });
  } catch { /* dev panel optional */ }
}

/** Вызывается после боя игрока (не тренировка). */
export function recordHumanMatchEnd(opts: {
  mode: string;
  won: boolean;
  brawlerId: string;
  durationSec: number;
  lastGasMargin?: number | null;
  wasStuckHeavy?: boolean;
  hpAtEnd?: number;
}): void {
  let deathTag: CombatDeathTag = "unknown";
  if (!opts.won) {
    if (opts.lastGasMargin != null && opts.lastGasMargin < -40) deathTag = "gas";
    else if (opts.wasStuckHeavy) deathTag = "stuck";
    else if ((opts.hpAtEnd ?? 1) <= 0) deathTag = "low_hp_duel";
    else deathTag = "objective_loss";
  }
  recordCombatMatch({
    mode: opts.mode,
    won: opts.won,
    brawlerId: opts.brawlerId,
    deathTag,
    durationSec: opts.durationSec,
  });
}

export function getCombatMemoryRecords(): CombatMatchRecord[] {
  return loadStore().records;
}

export function getCombatAiTuning(): CombatAiTuning {
  const { records } = loadStore();
  const train = getCombinedTrainingTuning();
  const server = getServerBotAiTuning();
  const base: CombatAiTuning = { ...DEFAULT_TUNING, ...train, ...(server ?? {}) };

  if (records.length < 3) {
    return base;
  }

  const recent = records.slice(-40);
  const losses = recent.filter((r) => !r.won);
  const gasDeaths = losses.filter((r) => r.deathTag === "gas").length;
  const stuckDeaths = losses.filter((r) => r.deathTag === "stuck").length;

  const gasRatio = losses.length ? gasDeaths / losses.length : 0;
  const stuckRatio = losses.length ? stuckDeaths / losses.length : 0;

  return {
    gasBufferBonus: Math.min(120, Math.round(gasRatio * 80)),
    strafeScale: Math.max(0.55, 1 - stuckRatio * 0.25),
    pathHoldBias: Math.min(0.35, stuckRatio * 0.25),
    gasFleeWeight: 1 + gasRatio * 0.8,
    ...base,
  };
}

export function getLearnedLessonHint(mode: string): string | null {
  const tuning = getCombatAiTuning();
  const hints: string[] = [];
  if (tuning.gasBufferBonus > 40) {
    hints.push("часто проигрываешь в газе — держись ближе к центру");
  }
  if (tuning.strafeScale < 0.75) {
    hints.push("застреваешь у препятствий — обходи шире, не дёргайся у стен");
  }
  if (!hints.length) return null;
  return hints.join("; ");
}
