import { useEffect, useState } from "react";
import type { BattleSnapshot } from "../ai/AstralAssistant";
import { astralBattleTip } from "../ai/astralBrain";
import { isLlmReady } from "../ai/astralLlm";
import { getAstralSettings, isStarGuardianActive } from "../utils/subscription";
import { useI18n } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Props {
  getSnapshot: () => BattleSnapshot | null;
}

interface Tip { text: string; appearedAt: number }

const TIP_HOLD_MS = 12000;
const POLL_MS = 1200;
const COOLDOWN_RULE_MS = 6500;
const COOLDOWN_LLM_MS = 9000;

export default function AstralBattleTip({ getSnapshot }: Props) {
  const { t } = useI18n();
  const [tip, setTip] = useState<Tip | null>(null);
  const [enabled, setEnabled] = useState(isStarGuardianActive() && getAstralSettings().battleTipsEnabled);

  useEffect(() => {
    const settingsTimer = setInterval(() => {
      const s = getAstralSettings();
      setEnabled(
        isStarGuardianActive()
        && s.enabled
        && s.battleTipsEnabled
        && !s.battleCommandsDisabled,
      );
    }, 1500);
    return () => clearInterval(settingsTimer);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let lastEmitted = 0;
    let lastText = "";
    let busy = false;
    const id = setInterval(() => {
      if (busy) return;
      const now = performance.now();
      const llm = isLlmReady();
      const gap = llm ? COOLDOWN_LLM_MS : COOLDOWN_RULE_MS;
      if (now - lastEmitted < gap) return;
      const snap = getSnapshot();
      if (!snap) return;
      busy = true;
      void astralBattleTip(snap).then(t => {
        busy = false;
        if (!t || t === lastText) return;
        lastEmitted = now;
        lastText = t;
        setTip({ text: t, appearedAt: Date.now() });
      });
    }, POLL_MS);
    return () => clearInterval(id);
  }, [enabled, getSnapshot]);

  useEffect(() => {
    if (!tip) return;
    const id = setTimeout(() => setTip(null), TIP_HOLD_MS);
    return () => clearInterval(id);
  }, [tip]);

  if (!enabled || !tip) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 14, right: 14, left: "auto",
        zIndex: 12,
        maxWidth: 320,
        background: "linear-gradient(135deg, rgba(74,20,140,0.92), rgba(26,0,51,0.92))",
        border: "1.5px solid #CE93D8",
        borderRadius: 14,
        boxShadow: "0 0 22px rgba(206,147,216,0.45)",
        color: "white",
        padding: "8px 12px 8px 8px",
        display: "flex", alignItems: "center", gap: 10,
        fontFamily: "'Segoe UI', Arial, sans-serif",
        pointerEvents: "none",
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
        background: "radial-gradient(circle at 35% 30%, #B388FF, #4A148C)",
        border: "2px solid #FFD740", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 20,
      }}><EmojiIcon emoji="✨" size={20} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#FFD740", letterSpacing: 1 }}><Tr id="astral.name" /></div>
        <div style={{ fontSize: 12.5, lineHeight: 1.35 }}>{tip.text}</div>
      </div>
    </div>
  );
}
