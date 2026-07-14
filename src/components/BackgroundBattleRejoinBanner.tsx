import { useI18n } from "../i18n";
import { getBackgroundBattleMeta } from "../game/backgroundBattleSession";

interface Props {
  onRejoin: () => void;
}

export default function BackgroundBattleRejoinBanner({ onRejoin }: Props) {
  const { t } = useI18n();
  const meta = getBackgroundBattleMeta();

  return (
    <button
      type="button"
      onClick={onRejoin}
      style={{
        position: "absolute",
        top: 72,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 30,
        pointerEvents: "auto",
        padding: "12px 20px",
        borderRadius: 14,
        border: "2px solid rgba(255, 183, 77, 0.85)",
        background: "linear-gradient(135deg, rgba(80, 30, 10, 0.92), rgba(120, 45, 12, 0.92))",
        color: "#ffe0b2",
        fontWeight: 800,
        fontSize: 14,
        letterSpacing: "0.04em",
        cursor: "pointer",
        boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
        maxWidth: "min(92vw, 420px)",
        whiteSpace: "nowrap",
      }}
    >
      {t("battle.afkRejoinBanner", { mode: meta?.mode ?? "" })}
    </button>
  );
}
