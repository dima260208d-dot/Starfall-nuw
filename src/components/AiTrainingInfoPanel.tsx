import { AI_TRAINING_TARGET_CYCLES, type TrainingProgress } from "../ai/aiTrainingStore";
import VolProgressTrack from "./ui/VolProgressTrack";

interface Props {
  progress: TrainingProgress;
}

/** Floating training stats panel (cycles, tracks, speed). */
export default function AiTrainingInfoPanel({ progress: p }: Props) {
  const fmt = (n: number) => n.toLocaleString("ru-RU");
  const total = p.targetCycles ?? AI_TRAINING_TARGET_CYCLES;
  const done = p.totalCycles;
  const pct = Math.min(100, (done / Math.max(1, total)) * 100);
  const activeTrack = p.tracks.find(t => !t.complete);

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -42%)",
        zIndex: 10001,
        pointerEvents: "none",
        width: "min(520px, 92vw)",
        background: "rgba(8,4,24,0.92)",
        border: "1px solid rgba(118,255,3,0.45)",
        borderRadius: 16,
        padding: "22px 24px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.65), 0 0 32px rgba(118,255,3,0.12)",
        fontFamily: "var(--app-font-sans, Segoe UI, sans-serif)",
        textAlign: "center",
        color: "#fff",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: 2.2,
          color: "#76FF03",
          marginBottom: 10,
        }}
      >
        ОБУЧЕНИЕ ИИ · ИГРА НА ПАУЗЕ
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
        Запись циклов в ботов
      </div>
      <p style={{ margin: "0 0 20px", fontSize: 13, lineHeight: 1.5, color: "rgba(255,255,255,0.68)" }}>
        Работают только headless-симы. Когда все треки запишутся — игра откроется сама.
      </p>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
        <span>{fmt(done)} / {fmt(total)} циклов</span>
        <span>{pct.toFixed(2)}%</span>
      </div>
      <VolProgressTrack
        fitHeight={16}
        fill={pct}
        fillBackground="linear-gradient(90deg, #76FF03, #00E5FF)"
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 10,
          fontSize: 11,
          color: "rgba(255,255,255,0.55)",
        }}
      >
        <span>Треки: {p.completedTracks}/{p.totalTracks}</span>
        <span>~{p.cyclesPerSec} циклов/с</span>
      </div>
      {activeTrack && (
        <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
          Сейчас: {activeTrack.label} ({fmt(activeTrack.cycles)}/{fmt(activeTrack.target)})
        </div>
      )}
    </div>
  );
}
