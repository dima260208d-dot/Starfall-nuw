import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, "../src/utils/techBreak.ts");

const content = `/** Global technical maintenance break — blocks non-admin players. */

const STORAGE_KEY = "clash_tech_break_v1";
export const TECH_BREAK_CHANGED_EVENT = "clash:tech-break-changed";

export interface TechBreakState {
  active: boolean;
  startedAt: number;
  estimatedEndAt: number;
  durationLabel: string;
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
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TECH_BREAK_CHANGED_EVENT));
  }
}

export function getTechBreakState(): TechBreakState {
  return readState();
}

export function isTechBreakActive(): boolean {
  return readState().active;
}

export function formatDurationLabel(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return \`Примерно \${m} мин\`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (rest === 0) return \`Примерно \${h} ч\`;
  return \`Примерно \${h} ч \${rest} мин\`;
}

export function activateTechBreak(minutes: number): TechBreakState {
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
  writeState(inactiveState());
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
`;

fs.writeFileSync(target, content, "utf8");
console.log("written", target);
