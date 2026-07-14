import { useEffect, useState } from "react";
import { useI18n } from "../../i18n";

/** «Столкновение» splash — same spirit as intro Starfall. */
export default function ShowdownStandoffOverlay({ active }: { active: boolean }) {
  const { t } = useI18n();
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!active) {
      setOpacity(0);
      return;
    }
    setOpacity(0);
    const t0 = requestAnimationFrame(() => setOpacity(1));
    const hide = window.setTimeout(() => setOpacity(0), 1600);
    return () => {
      cancelAnimationFrame(t0);
      clearTimeout(hide);
    };
  }, [active]);

  if (!active && opacity <= 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 8800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        opacity,
        transition: "opacity 0.35s ease",
        background: "radial-gradient(circle at center, rgba(255,120,40,0.22) 0%, transparent 55%)",
      }}
    >
      <div
        style={{
          fontSize: "clamp(40px, 10vw, 80px)",
          fontWeight: 900,
          letterSpacing: 5,
          color: "#fff",
          textTransform: "uppercase",
          textShadow: `
            0 0 24px rgba(255,160,60,0.95),
            0 0 48px rgba(255,100,20,0.65),
            0 4px 0 #000
          `,
          animation: opacity > 0.4 ? "showdownStandoffPulse 1s ease-in-out infinite alternate" : undefined,
        }}
      >
        {t("mode.showdown.subtitle")}
      </div>
      <style>{`
        @keyframes showdownStandoffPulse {
          from { filter: brightness(1); transform: scale(1); }
          to { filter: brightness(1.12); transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
