import { useEffect, useState } from "react";
import VolProgressTrack from "./ui/VolProgressTrack";
import { subscribeTrainingProgress } from "../ai/aiTrainingRuntime";
import { AI_TRAINING_TARGET_CYCLES, type TrainingProgress } from "../ai/aiTrainingStore";

export default function AiTrainingBanner() {
  const [p, setP] = useState<TrainingProgress | null>(null);

  useEffect(() => subscribeTrainingProgress(setP), []);

  if (!p || p.complete) return null;

  const pct = Math.min(100, (p.totalCycles / Math.max(1, p.targetCycles)) * 100);
  const fmt = (n: number) => n.toLocaleString("ru-RU");
  const activeTrack = p.tracks.find(t => !t.complete);

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 9998,
        pointerEvents: "none",
        background: "rgba(8,4,24,0.88)",
        border: "1px solid rgba(118,255,3,0.45)",
        borderRadius: 12,
        padding: "10px 14px",
        minWidth: 240,
        maxWidth: 320,
        boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
        fontFamily: "var(--app-font-sans, Segoe UI, sans-serif)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.2, color: "#76FF03", marginBottom: 6 }}>
        ОБУЧЕНИЕ ИИ · {p.completedTracks}/{p.totalTracks} треков
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginBottom: 8 }}>
        {fmt(p.totalCycles)} / {fmt(p.targetCycles ?? AI_TRAINING_TARGET_CYCLES)} циклов ({pct.toFixed(2)}%)
      </div>
      <VolProgressTrack
        fitHeight={12}
        fill={pct}
        fillBackground="linear-gradient(90deg, #76FF03, #00E5FF)"
      />
      {activeTrack && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>
          Сейчас: {activeTrack.label} ({fmt(activeTrack.cycles)}/{fmt(activeTrack.target)})
        </div>
      )}
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
        ~{p.cyclesPerSec}/с
      </div>
    </div>
  );
}
