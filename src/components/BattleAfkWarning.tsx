import { useI18n } from "../i18n";

interface Props {
  visible: boolean;
  secondsLeft: number;
}

export default function BattleAfkWarning({ visible, secondsLeft }: Props) {
  const { t } = useI18n();
  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 45,
      }}
    >
      <div
        style={{
          maxWidth: "min(92vw, 420px)",
          padding: "18px 24px",
          borderRadius: 16,
          background: "rgba(20, 8, 40, 0.88)",
          border: "2px solid rgba(180, 120, 255, 0.65)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45), 0 0 24px rgba(140, 80, 255, 0.25)",
          textAlign: "center",
          animation: "battleAfkPulse 1.2s ease-in-out infinite",
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: "#f0e6ff",
            letterSpacing: "0.04em",
            marginBottom: 8,
          }}
        >
          {t("battle.afkWarningTitle")}
        </div>
        <div style={{ fontSize: 15, color: "#d4c4f0", lineHeight: 1.45 }}>
          {t("battle.afkWarningBody")}
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 13,
            fontWeight: 700,
            color: "rgba(255, 180, 120, 0.95)",
          }}
        >
          {t("battle.afkWarningCountdown", { seconds: Math.ceil(secondsLeft) })}
        </div>
      </div>
      <style>{`
        @keyframes battleAfkPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.02); opacity: 0.94; }
        }
      `}</style>
    </div>
  );
}
