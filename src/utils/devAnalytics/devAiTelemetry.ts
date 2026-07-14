import { getAstralLlmSettings, LLM_MODEL_PRESETS, type LlmProvider } from "../../ai/astralLlm";
import { getChatHistory } from "../../ai/astralLlm";
import { isStarGuardianActive } from "../subscription";
import { getCurrentUsername } from "../localStorageAPI";
import { getCombatMemoryRecords, type CombatMatchRecord } from "../../ai/aiCombatLearning";

const EVENTS_KEY = "dev_ai_telemetry_v1";
const BOT_EVENTS_KEY = "dev_bot_telemetry_v1";
const MAX_EVENTS = 400;

export type DevAiEventKind =
  | "astral_mode"
  | "astral_llm"
  | "astral_tip"
  | "astral_fix"
  | "bot_state"
  | "bot_correction"
  | "combat_learn";

export interface DevAiEvent {
  id: string;
  ts: number;
  kind: DevAiEventKind;
  source: "astral" | "bot" | "system";
  mode?: string;
  detail: string;
  meta?: Record<string, string | number | boolean>;
}

function loadEvents(key: string): DevAiEvent[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEvents(key: string, events: DevAiEvent[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch { /* quota */ }
}

export function logDevAiEvent(
  event: Omit<DevAiEvent, "id" | "ts"> & { ts?: number },
): void {
  const entry: DevAiEvent = {
    ...event,
    id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: event.ts ?? Date.now(),
  };
  const key = event.source === "bot" ? BOT_EVENTS_KEY : EVENTS_KEY;
  const list = loadEvents(key);
  list.push(entry);
  saveEvents(key, list);
}

export function getAstralEvents(): DevAiEvent[] {
  return loadEvents(EVENTS_KEY).sort((a, b) => b.ts - a.ts);
}

export function getBotEvents(): DevAiEvent[] {
  return loadEvents(BOT_EVENTS_KEY).sort((a, b) => b.ts - a.ts);
}

export interface LlmModelInfo {
  id: string;
  label: string;
  provider: LlmProvider;
  active: boolean;
  subscriptionLinked: boolean;
}

export function getSubscribedLlmModels(): LlmModelInfo[] {
  const s = getAstralLlmSettings();
  const sg = isStarGuardianActive();
  const out: LlmModelInfo[] = [];
  for (const provider of ["openrouter", "openai"] as LlmProvider[]) {
    for (const m of LLM_MODEL_PRESETS[provider]) {
      out.push({
        id: m.id,
        label: m.label,
        provider,
        active: s.enabled && s.model === m.id && s.provider === provider,
        subscriptionLinked: sg,
      });
    }
  }
  if (s.model && !out.some(m => m.id === s.model)) {
    out.unshift({
      id: s.model,
      label: `Пользовательская: ${s.model}`,
      provider: s.provider,
      active: s.enabled,
      subscriptionLinked: sg,
    });
  }
  return out;
}

export interface AiDashboardData {
  models: LlmModelInfo[];
  llmEnabled: boolean;
  llmProvider: string;
  llmModel: string;
  starGuardian: boolean;
  chatHistoryLen: number;
  astralEvents: DevAiEvent[];
  botEvents: DevAiEvent[];
  combatRecords: CombatMatchRecord[];
  modeBreakdown: { label: string; value: number }[];
  deathTagBreakdown: { label: string; value: number; color: string }[];
  strategyTimeline: number[];
  fixEvents: DevAiEvent[];
  errorEvents: DevAiEvent[];
  botPersonalityUsage: { label: string; value: number }[];
  autoplayModeCounts: { label: string; value: number }[];
}

export function buildAiDashboard(): AiDashboardData {
  const combatRecords = getCombatMemoryRecords();
  const astralEvents = getAstralEvents();
  const botEvents = getBotEvents();
  const s = getAstralLlmSettings();

  const modeMap = new Map<string, number>();
  const deathMap = new Map<string, number>();
  for (const r of combatRecords) {
    modeMap.set(r.mode, (modeMap.get(r.mode) ?? 0) + 1);
    if (!r.won) deathMap.set(r.deathTag, (deathMap.get(r.deathTag) ?? 0) + 1);
  }

  const autoplayMap = new Map<string, number>();
  for (const e of astralEvents.filter(x => x.kind === "astral_mode")) {
    const m = String(e.meta?.mode ?? e.detail);
    autoplayMap.set(m, (autoplayMap.get(m) ?? 0) + 1);
  }

  const botRoleMap = new Map<string, number>();
  for (const e of botEvents) {
    const role = String(e.meta?.role ?? "unknown");
    botRoleMap.set(role, (botRoleMap.get(role) ?? 0) + 1);
  }

  const last14 = combatRecords.slice(-14);
  const strategyTimeline = last14.map(r => (r.won ? 1 : 0));

  return {
    models: getSubscribedLlmModels(),
    llmEnabled: s.enabled,
    llmProvider: s.provider,
    llmModel: s.model,
    starGuardian: isStarGuardianActive(),
    chatHistoryLen: getChatHistory().length,
    astralEvents: astralEvents.slice(0, 80),
    botEvents: botEvents.slice(0, 80),
    combatRecords,
    modeBreakdown: [...modeMap.entries()].map(([label, value]) => ({ label, value })),
    deathTagBreakdown: [...deathMap.entries()].map(([label, value]) => ({
      label,
      value,
      color: label === "gas" ? "#FF5252" : label === "stuck" ? "#FFB74D" : "#CE93D8",
    })),
    strategyTimeline,
    fixEvents: astralEvents.filter(e => e.kind === "astral_fix").slice(0, 20),
    errorEvents: astralEvents.filter(e => e.kind === "astral_tip" || e.detail.includes("ошиб")).slice(0, 20),
    botPersonalityUsage: [...botRoleMap.entries()].map(([label, value]) => ({ label, value })),
    autoplayModeCounts: [...autoplayMap.entries()].map(([label, value]) => ({ label, value })),
  };
}

/** Seed demo telemetry if empty (for dev panel demo). */
export function ensureDemoAiTelemetry(): void {
  if (getBotEvents().length > 3) return;
  if (getAstralEvents().length > 5) return;
  const user = getCurrentUsername() ?? "dev";
  const modes = ["gemgrab", "starstrike", "showdown", "heist"];
  const autoplay = ["engage", "pickup", "flee", "break_crates", "explore"];
  for (let i = 0; i < 24; i++) {
    logDevAiEvent({
      source: "astral",
      kind: i % 5 === 0 ? "astral_fix" : "astral_mode",
      mode: modes[i % modes.length],
      detail: i % 5 === 0
        ? `Подстройка: gasBuffer +${12 + i}px после поражения`
        : `Режим автопилота: ${autoplay[i % autoplay.length]}`,
      meta: { mode: autoplay[i % autoplay.length], user },
    });
  }
  for (let i = 0; i < 18; i++) {
    logDevAiEvent({
      source: "bot",
      kind: "bot_correction",
      mode: modes[i % modes.length],
      detail: `Бот [${["striker", "defender", "midfielder", "flanker"][i % 4]}]: коррекция ${["куст", "газ", "коробка", "пас"][i % 4]}`,
      meta: { role: ["striker", "defender", "midfielder", "flanker"][i % 4] },
    });
  }
}
