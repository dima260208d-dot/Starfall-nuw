import type { CombatAiTuning } from "../ai/aiCombatLearning";

const EVENT = "starfall:server-bot-ai";

let cached: Partial<CombatAiTuning> | null = null;

export function applyServerBotAiTuning(value: unknown): void {
  if (!value || typeof value !== "object") return;
  const v = value as Record<string, unknown>;
  cached = {
    engageBias: num(v.engageBias),
    objectiveBias: num(v.objectiveBias),
    retreatBias: num(v.retreatBias),
    flankBias: num(v.flankBias),
    superBias: num(v.superBias),
    gasBufferBonus: num(v.gasBufferBonus),
    strafeScale: num(v.strafeScale),
    pathHoldBias: num(v.pathHoldBias),
    gasFleeWeight: num(v.gasFleeWeight),
  };
  window.dispatchEvent(new CustomEvent(EVENT, { detail: cached }));
}

export function getServerBotAiTuning(): Partial<CombatAiTuning> | null {
  return cached;
}

export function subscribeServerBotAiTuning(cb: (t: Partial<CombatAiTuning> | null) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail ?? cached);
  window.addEventListener(EVENT, handler);
  cb(cached);
  return () => window.removeEventListener(EVENT, handler);
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
