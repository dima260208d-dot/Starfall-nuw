import { useEffect, useState } from "react";
import type { ReplayHudFrame } from "../utils/battleReplayStore";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

const TEAM_MODES = new Set([
  "gemgrab", "heist", "crystals", "siege", "starstrike", "bounty", "bossraid",
]);

interface Props {
  mode: string;
  hudRef: React.RefObject<ReplayHudFrame | null | undefined>;
  visible: boolean;
}

function formatTimer(sec: number): string {
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function BattleReplayScoreHud({ mode, hudRef, visible }: Props) {
  const { t } = useI18n();
  const [hud, setHud] = useState<ReplayHudFrame | null | undefined>(null);

  useEffect(() => {
    if (!visible) {
      setHud(null);
      return;
    }
    const id = setInterval(() => {
      setHud(hudRef.current ?? null);
    }, 250);
    return () => clearInterval(id);
  }, [hudRef, visible]);

  if (!visible || !TEAM_MODES.has(mode) || hud?.scoreBlue == null || hud?.scoreRed == null) {
    return null;
  }

  const isHp = hud.scoreKind === "hp" || hud.scoreKind === "siege";

  let footer = "";
  if (hud.blueCountdown && hud.blueCountdown > 0) {
    footer = t("battle.victoryIn", { seconds: hud.blueCountdown.toFixed(1) });
  } else if (hud.redCountdown && hud.redCountdown > 0) {
    footer = t("battle.enemyVictoryIn", { seconds: hud.redCountdown.toFixed(1) });
  } else if (mode === "gemgrab") {
    footer = t("battle.gemGrabHint");
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 25,
        pointerEvents: "none",
        minWidth: 280,
        maxWidth: "min(92vw, 420px)",
      }}
    >
      <div style={{
        background: "rgba(0,0,0,0.82)",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
        padding: "8px 18px 10px",
        textAlign: "center",
      }}>
        {hud.secondsLeft != null && (
          <div style={{
            color: hud.overtime ? "#FFD740" : "rgba(255,255,255,0.85)",
            fontSize: 12,
            fontWeight: 800,
            marginBottom: 4,
            letterSpacing: 0.5,
          }}>
            {hud.overtime
              ? t("battle.goldenGoal", { time: formatTimer(hud.secondsLeft) })
              : formatTimer(hud.secondsLeft)}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <div style={{ textAlign: "center", minWidth: 72 }}>
            {!isHp && (
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 700 }}>
                <Tr id="battle.teamBlue" />
              </div>
            )}
            <div style={{ color: "#40C4FF", fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
              {hud.scoreBlue}
            </div>
          </div>
          <div style={{ color: "#fff", fontSize: 22, fontWeight: 900 }}>:</div>
          <div style={{ textAlign: "center", minWidth: 72 }}>
            {!isHp && (
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10, fontWeight: 700 }}>
                <Tr id="battle.teamRed" />
              </div>
            )}
            <div style={{ color: "#FF5252", fontSize: 26, fontWeight: 900, lineHeight: 1.1 }}>
              {hud.scoreRed}
            </div>
          </div>
        </div>
        {footer && (
          <div style={{
            marginTop: 6,
            color: "rgba(255,255,255,0.72)",
            fontSize: 11,
            fontWeight: 700,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
