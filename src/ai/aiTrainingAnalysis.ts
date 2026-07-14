import {
  getCombinedTrainingTuning,
  getTrainingProgress,
  getTrainingTacticSummary,
  getTrainingTuning,
  type TrainingProgress,
  type TrainingTuning,
} from "./aiTrainingStore";
import { REF_BOT_BEHAVIOR_VERSION } from "./refBotBehavior";

export interface TrainingEffectivenessReport {
  controlState: "running" | "stopped";
  progress: TrainingProgress;
  simTuning: TrainingTuning;
  combinedTuning: TrainingTuning;
  simWeight: number;
  winRate: number;
  lossRate: number;
  timeoutRate: number;
  botInfluencePct: number;
  categoryPct: { core: number; mode: number; boss: number };
  topTactics: Array<{ tactic: string; wins: number; losses: number; wr: number }>;
  etaHours: number | null;
  verdict: string;
  bullets: string[];
}

function aggregateTactics(): Array<{ tactic: string; wins: number; losses: number; wr: number }> {
  return getTrainingTacticSummary().slice(0, 8);
}

export function buildTrainingEffectivenessReport(): TrainingEffectivenessReport {
  const progress = getTrainingProgress();
  const simTuning = getTrainingTuning();
  const combinedTuning = getCombinedTrainingTuning();
  const simWeight = progress.complete ? 0.72 : 0.55;
  const total = Math.max(1, progress.totalCycles);
  const winRate = progress.blueWins / total;
  const lossRate = progress.redWins / total;
  const timeoutRate = progress.timeouts / total;
  const overallPct = (progress.totalCycles / Math.max(1, progress.targetCycles)) * 100;

  const coreTracks = progress.tracks.filter(t => t.category === "core");
  const modeTracks = progress.tracks.filter(t => t.category === "mode");
  const bossTracks = progress.tracks.filter(t => t.category === "boss");
  const avgPct = (tracks: typeof progress.tracks) =>
    tracks.length ? tracks.reduce((s, t) => s + t.pct, 0) / tracks.length : 0;

  const categoryPct = {
    core: avgPct(coreTracks),
    mode: avgPct(modeTracks),
    boss: avgPct(bossTracks),
  };

  const scale = progress.totalCycles < 100 ? 0 : Math.min(1, 0.15 + (progress.totalCycles / progress.targetCycles) * 0.85);
  const botInfluencePct = Math.round(scale * simWeight * 100);

  const etaHours = progress.cyclesPerSec > 0 && !progress.complete
    ? ((progress.targetCycles - progress.totalCycles) / progress.cyclesPerSec) / 3600
    : null;

  const bullets: string[] = [
    `Мозг ботов: ${REF_BOT_BEHAVIOR_VERSION} (PylaAI + BrawlStarsBot + gdx-ai steering).`,
    `Записано ${progress.totalCycles.toLocaleString("ru-RU")} из ${progress.targetCycles.toLocaleString("ru-RU")} циклов (${overallPct.toFixed(2)}%).`,
    `Победы синих ${(winRate * 100).toFixed(1)}% · поражения ${(lossRate * 100).toFixed(1)}% · таймауты ${(timeoutRate * 100).toFixed(1)}%.`,
    `Влияние сим-обучения на ботов ~${botInfluencePct}% (вес sim ${Math.round(simWeight * 100)}%, шкала ${Math.round(scale * 100)}%).`,
    `Gem Grab ${categoryPct.core.toFixed(1)}% · режимы в среднем ${categoryPct.mode.toFixed(1)}% · боссы в среднем ${categoryPct.boss.toFixed(1)}%.`,
  ];

  if (combinedTuning.engageBias > 0.05) bullets.push("Боты чаще идут в бой (engage +).");
  else if (combinedTuning.engageBias < -0.05) bullets.push("Боты осторожнее в атаке (engage −).");
  if (combinedTuning.objectiveBias > 0.05) bullets.push("Усилен фокус на цели режима (objective +).");
  if (combinedTuning.retreatBias > 0.08) bullets.push("Чаще отступают при низком HP / газе (retreat +).");
  if (combinedTuning.superBias > 0.05) bullets.push("Чаще используют супер (super +), особенно на boss-треках.");

  let verdict: string;
  if (progress.totalCycles < 100) {
    verdict = "Недостаточно данных — менее 100 циклов, боты почти не изменены.";
  } else if (overallPct < 1) {
    verdict = "Ранний этап: базовые смещения уже пишутся, но покрытие режимов минимально.";
  } else if (overallPct < 15) {
    verdict = "Начальное обучение: Gem Grab и часть режимов уже влияют на тактику, боссы отстают.";
  } else if (overallPct < 50) {
    verdict = "Средний прогресс: заметные коррекции engage/objective; boss/super ещё набирают статистику.";
  } else if (progress.complete) {
    verdict = "Обучение завершено — максимальный вес sim-тюнинга зафиксирован в боях.";
  } else {
    verdict = "Хороший прогресс: большинство треков частично обучены, боты стабильно используют накопленные смещения.";
  }

  if (etaHours != null && etaHours > 0) {
    bullets.push(`При текущей скорости ~${progress.cyclesPerSec}/с до конца ~${etaHours < 24 ? `${etaHours.toFixed(1)} ч` : `${(etaHours / 24).toFixed(1)} дн`}.`);
  }

  return {
    controlState: getTrainingControlState(),
    progress,
    simTuning,
    combinedTuning,
    simWeight,
    winRate,
    lossRate,
    timeoutRate,
    botInfluencePct,
    categoryPct,
    topTactics: aggregateTactics(),
    etaHours,
    verdict,
    bullets,
  };
}
