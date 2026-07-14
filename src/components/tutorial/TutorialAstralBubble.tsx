import { useEffect, useLayoutEffect, useRef, useState } from "react";
import AstralOrbAvatar from "../AstralOrbAvatar";
import AdaptiveComicBubble from "./AdaptiveComicBubble";
import { Tr } from "../../i18n/Tr";
import { useI18n } from "../../i18n/I18nProvider";

interface Props {
  messageId: string;
  /** Raw message instead of i18n id */
  messageText?: string;
  onSizeChange?: (height: number) => void;
}

const AVATAR_SIZE = 58;

export default function TutorialAstralBubble({ messageId, messageText, onSizeChange }: Props) {
  const { t } = useI18n();
  const [pulse, setPulse] = useState(false);
  const [maxBubbleW, setMaxBubbleW] = useState(480);
  const rootRef = useRef<HTMLDivElement>(null);
  const message = messageText ?? t(messageId);

  useEffect(() => {
    const id = window.setInterval(() => setPulse((p) => !p), 1800);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const update = () => {
      setMaxBubbleW(Math.min(560, Math.max(240, window.innerWidth - AVATAR_SIZE - 96)));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useLayoutEffect(() => {
    if (!onSizeChange || !rootRef.current) return;
    const report = () => onSizeChange(rootRef.current!.offsetHeight + 8);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, [onSizeChange, message, maxBubbleW]);

  return (
    <div
      ref={rootRef}
      style={{
        position: "absolute",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        width: "min(94vw, 640px)",
        padding: "0 4px",
        boxSizing: "border-box",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: 6,
          borderRadius: "50%",
          background:
            "linear-gradient(145deg, rgba(0,229,255,0.12) 0%, rgba(74,20,140,0.55) 45%, rgba(10,0,32,0.9) 100%)",
          border: `2px solid ${pulse ? "rgba(0,229,255,0.75)" : "rgba(206,147,216,0.55)"}`,
          boxShadow: pulse
            ? "0 0 24px rgba(0,229,255,0.45), inset 0 0 14px rgba(0,229,255,0.08)"
            : "0 0 18px rgba(179,136,255,0.35)",
          transition: "box-shadow 0.45s ease, border-color 0.45s ease",
        }}
      >
        <AstralOrbAvatar size={AVATAR_SIZE} llmActive={false} starGuardian={false} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            color: "#FFD740",
            letterSpacing: 1.2,
            marginBottom: 4,
            paddingLeft: 6,
            textShadow: "0 1px 4px rgba(0,0,0,0.85)",
          }}
        >
          <Tr id="astral.name" />
        </div>
        <AdaptiveComicBubble maxWidth={maxBubbleW}>
          <div
            style={{
              color: "#1a1a2e",
              fontSize: 13.5,
              fontWeight: 700,
              lineHeight: 1.38,
              textAlign: "left",
              whiteSpace: "normal",
            }}
          >
            {message}
          </div>
        </AdaptiveComicBubble>
      </div>
    </div>
  );
}
