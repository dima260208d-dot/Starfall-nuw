import { useEffect, useState } from "react";
import type { MenuNotification } from "../ai/AstralAssistant";
import { astralMenuNotification } from "../ai/astralBrain";
import { getCurrentProfile } from "../utils/localStorageAPI";
import { getAstralSettings, isStarGuardianActive } from "../utils/subscription";
import { useI18n } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Props {
  onCta?: (screen: NonNullable<MenuNotification["cta"]>["screen"]) => void;
}

const FIRST_DELAY_MS = 8000;
const HOLD_MS = 12000;
const MIN_INTERVAL_MS = 30000;
const MAX_INTERVAL_MS = 90000;

export default function AstralMenuPopup({ onCta }: Props) {
  const { t } = useI18n();
  const [note, setNote] = useState<MenuNotification | null>(null);
  const [enabled, setEnabled] = useState(isStarGuardianActive() && getAstralSettings().menuTipsEnabled);

  useEffect(() => {
    const t = setInterval(() => {
      setEnabled(isStarGuardianActive() && getAstralSettings().menuTipsEnabled);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let busy = false;

    const nextDelay = () =>
      Math.floor(MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS));

    const tryShow = () => {
      if (!alive || busy) return;
      const p = getCurrentProfile();
      if (!p) {
        timer = setTimeout(tryShow, nextDelay());
        return;
      }
      busy = true;
      void astralMenuNotification(p).then(n => {
        busy = false;
        if (!alive) return;
        if (n) setNote(n);
        timer = setTimeout(tryShow, nextDelay());
      });
    };
    timer = setTimeout(tryShow, FIRST_DELAY_MS);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), HOLD_MS);
    return () => clearTimeout(t);
  }, [note]);

  if (!enabled || !note) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 80, right: 16, zIndex: 50,
      width: 320, maxWidth: "85vw",
      background: "linear-gradient(160deg, rgba(74,20,140,0.96), rgba(26,0,51,0.96))",
      border: "1.5px solid #CE93D8",
      borderRadius: 14,
      boxShadow: "0 8px 32px rgba(206,147,216,0.45)",
      color: "white",
      padding: 12,
      display: "flex", flexDirection: "column", gap: 10,
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: "radial-gradient(circle at 35% 30%, #B388FF, #4A148C)",
          border: "2px solid #FFD740", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 20,
        }}><EmojiIcon emoji="✨" size={20} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#FFD740", letterSpacing: 1 }}><Tr id="astral.name" /></div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{note.text}</div>
        </div>
        <button onClick={() => setNote(null)} style={{
          background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 6, color: "white", cursor: "pointer",
          width: 22, height: 22, fontSize: 11, lineHeight: 1, padding: 0,
        }}><EmojiIcon emoji="✕" size={20} /></button>
      </div>
      {note.cta && (
        <button onClick={() => { onCta?.(note.cta!.screen); setNote(null); }} style={{
          background: "linear-gradient(135deg, #FFD740, #FFA000)",
          border: "none", borderRadius: 10, padding: "8px 14px",
          fontWeight: 800, color: "#ffffff", cursor: "pointer",
          fontSize: 12.5,
          textShadow: "0 1px 3px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9)",
        }}>{note.cta.label}</button>
      )}
    </div>
  );
}
