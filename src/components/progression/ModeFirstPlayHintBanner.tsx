import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import type { GameMode } from "../../App";
import { getModeFirstPlayHints } from "../../utils/progression/modeFirstPlayHints";
import {
  isModeFirstPlayHintDone,
  markModeFirstPlayHintDone,
} from "../../utils/progression/unlockGuideState";

interface Props {
  mode: GameMode;
  active: boolean;
}

/** First-time mode hints — centered above mid-screen during battle. */
export default function ModeFirstPlayHintBanner({ mode, active }: Props) {
  const { t } = useI18n();
  const hints = getModeFirstPlayHints(mode);
  const [step, setStep] = useState(0);
  const done = isModeFirstPlayHintDone(mode);

  useEffect(() => {
    if (!active || done || !hints.length) return;
    if (step >= hints.length) {
      markModeFirstPlayHintDone(mode);
      return;
    }
    const id = window.setTimeout(() => setStep(s => s + 1), 5200);
    return () => window.clearTimeout(id);
  }, [active, done, hints.length, step, mode]);

  if (!active || done || !hints.length || step >= hints.length) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "38%",
        transform: "translate(-50%, -50%)",
        zIndex: 18,
        maxWidth: "min(88vw, 520px)",
        padding: "16px 22px",
        borderRadius: 18,
        background: "linear-gradient(135deg, rgba(26,0,51,0.92), rgba(10,0,28,0.94))",
        border: "2px solid rgba(0,229,255,0.45)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(0,229,255,0.15)",
        pointerEvents: "none",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "#FFD740", letterSpacing: 1.2, marginBottom: 8 }}>
        {t("modeHint.label")}
      </div>
      <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, lineHeight: 1.4 }}>
        {t(hints[step])}
      </div>
      <div style={{ marginTop: 10, fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: 700 }}>
        {step + 1} / {hints.length}
      </div>
    </div>
  );
}
