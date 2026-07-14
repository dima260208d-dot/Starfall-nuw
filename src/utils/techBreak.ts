/** Global technical maintenance break — blocks non-admin players. */

import { isAdminUnlocked } from "./mapEditorAPI";

const STORAGE_KEY = "clash_tech_break_v1";
const UPCOMING_KEY = "clash_tech_break_upcoming_v1";
const SCHEDULE_QUEUE_KEY = "clash_admin_schedule_queue_v1";
export const TECH_BREAK_CHANGED_EVENT = "clash:tech-break-changed";
export const TECH_BREAK_BATTLE_BLOCK_MS = 10 * 60_000;

export interface TechBreakState {
  active: boolean;
  startedAt: number;
  estimatedEndAt: number;
  durationLabel: string;
}

export interface UpcomingTechBreak {
  startAt: number;
  durationMinutes: number;
}

interface ScheduledActionLite {
  domain: string;
  status: string;
  nextRunAt: string;
}

function dispatchTechBreakChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TECH_BREAK_CHANGED_EVENT));
  }
}

function inactiveState(): TechBreakState {
  return { active: false, startedAt: 0, estimatedEndAt: 0, durationLabel: "" };
}

function readState(): TechBreakState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return inactiveState();
    const parsed = JSON.parse(raw) as Partial<TechBreakState>;
    if (!parsed?.active) return inactiveState();
    return {
      active: true,
      startedAt: parsed.startedAt ?? Date.now(),
      estimatedEndAt: parsed.estimatedEndAt ?? Date.now(),
      durationLabel: parsed.durationLabel ?? "Некоторое время",
    };
  } catch {
    return inactiveState();
  }
}

function writeState(state: TechBreakState): void {
  if (!state.active) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  dispatchTechBreakChanged();
}

function readUpcomingStored(): UpcomingTechBreak | null {
  try {
    const raw = localStorage.getItem(UPCOMING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UpcomingTechBreak>;
    if (!parsed?.startAt || !parsed.durationMinutes) return null;
    if (parsed.startAt <= Date.now()) return null;
    return {
      startAt: parsed.startAt,
      durationMinutes: Math.max(1, Math.round(parsed.durationMinutes)),
    };
  } catch {
    return null;
  }
}

function readNextPendingTechBreakActivateAt(): number | null {
  try {
    const raw = localStorage.getItem(SCHEDULE_QUEUE_KEY);
    if (!raw) return null;
    const queue = JSON.parse(raw) as ScheduledActionLite[];
    const times = queue
      .filter(a => a.status === "pending" && a.domain === "tech_break_activate")
      .map(a => new Date(a.nextRunAt).getTime())
      .filter(t => Number.isFinite(t) && t > Date.now());
    if (times.length === 0) return null;
    return Math.min(...times);
  } catch {
    return null;
  }
}

export function getUpcomingTechBreak(): UpcomingTechBreak | null {
  return readUpcomingStored();
}

export function scheduleTechBreakAt(startAt: number, durationMinutes: number): void {
  const start = Math.max(Date.now() + 1000, Math.round(startAt));
  const upcoming: UpcomingTechBreak = {
    startAt: start,
    durationMinutes: Math.max(1, Math.round(durationMinutes)),
  };
  localStorage.setItem(UPCOMING_KEY, JSON.stringify(upcoming));
  dispatchTechBreakChanged();
}

export function clearUpcomingTechBreak(): void {
  localStorage.removeItem(UPCOMING_KEY);
  dispatchTechBreakChanged();
}

export function getTechBreakState(): TechBreakState {
  return readState();
}

export function isTechBreakActive(): boolean {
  return readState().active;
}

export function getNextTechBreakStartAt(now = Date.now()): number | null {
  if (isTechBreakActive()) return null;
  const stored = readUpcomingStored();
  const queued = readNextPendingTechBreakActivateAt();
  const candidates = [stored?.startAt ?? null, queued].filter(
    (t): t is number => t !== null && t > now,
  );
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

export function getMsUntilTechBreakStart(now = Date.now()): number | null {
  const start = getNextTechBreakStartAt(now);
  if (start === null) return null;
  return Math.max(0, start - now);
}

export function isUpcomingTechBreakBattleBlocked(now = Date.now()): boolean {
  const ms = getMsUntilTechBreakStart(now);
  if (ms === null) return false;
  return ms <= TECH_BREAK_BATTLE_BLOCK_MS;
}

export function isBattleEntryBlockedByTechBreak(isDev = isAdminUnlocked()): boolean {
  if (isDev) return false;
  if (isTechBreakActive()) return true;
  return isUpcomingTechBreakBattleBlocked();
}

export function formatTechBreakCountdown(ms: number): string {
  if (ms <= 0) return "скоро";
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0 && sec > 0) return `${min} мин ${sec} сек`;
  if (min > 0) return `${min} мин`;
  return `${sec} сек`;
}

export function getTechBreakBattleBlockNotice(now = Date.now()): string | null {
  if (!isUpcomingTechBreakBattleBlocked(now)) return null;
  const ms = getMsUntilTechBreakStart(now);
  if (ms === null) return null;
  return `Через ${formatTechBreakCountdown(ms)} начнётся тех перерыв — бой недоступен`;
}

export function formatDurationLabel(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `Примерно ${m} мин`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (rest === 0) return `Примерно ${h} ч`;
  return `Примерно ${h} ч ${rest} мин`;
}

export function activateTechBreak(minutes: number): TechBreakState {
  clearUpcomingTechBreak();
  const startedAt = Date.now();
  const state: TechBreakState = {
    active: true,
    startedAt,
    estimatedEndAt: startedAt + Math.max(1, minutes) * 60_000,
    durationLabel: formatDurationLabel(minutes),
  };
  writeState(state);
  return state;
}

export function deactivateTechBreak(): void {
  clearUpcomingTechBreak();
  writeState(inactiveState());
}

export function processUpcomingTechBreak(now = Date.now()): boolean {
  if (isTechBreakActive()) return false;
  const upcoming = readUpcomingStored();
  if (!upcoming || upcoming.startAt > now) return false;
  activateTechBreak(upcoming.durationMinutes);
  return true;
}

export function getTechBreakTimeDisplay(state: TechBreakState = readState()): string {
  if (!state.active) return "";
  if (Date.now() >= state.estimatedEndAt) return "Скоро закончится";
  return state.durationLabel;
}

export function subscribeTechBreakChanges(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(TECH_BREAK_CHANGED_EVENT, handler);
  return () => window.removeEventListener(TECH_BREAK_CHANGED_EVENT, handler);
}

let techBreakTickerStarted = false;

export function ensureTechBreakTicker(): void {
  if (techBreakTickerStarted || typeof window === "undefined") return;
  techBreakTickerStarted = true;
  processUpcomingTechBreak();
  window.setInterval(() => {
    processUpcomingTechBreak();
  }, 1000);
}
