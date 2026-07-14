import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import { getProfileIconImage, profileIconRewardFrameStyle } from "../utils/profileIconUtils";
import { getProfileIconDisplayLabel } from "../data/profileIcons";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

interface Props {
  iconId: string;
  onDone: () => void;
}

export default function ProfileIconChestReveal({ iconId, onDone }: Props) {
  const { t } = useI18n();
  const base = (import.meta as any).env?.BASE_URL ?? "/";

  return createPortal(
    <div
      onClick={onDone}
      style={{
        position: "fixed", inset: 0, zIndex: 999999,
        background: "radial-gradient(ellipse at center, rgba(186,104,200,0.25) 0%, rgba(0,0,8,0.96) 70%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: 24,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 4, color: "#CE93D8", marginBottom: 20 }}>
        <Tr id="reveal.newProfileIcon" />
      </div>
      <div style={{
        ...profileIconRewardFrameStyle(140, {
          border: "3px solid #CE93D8",
          boxShadow: "0 0 40px rgba(206,147,216,0.65), 0 0 80px rgba(186,104,200,0.35)",
          background: "rgba(0,0,0,0.4)",
          animation: "iconChestPulse 2s ease-in-out infinite",
        }),
      }}>
        <img
          src={getProfileIconImage(iconId, base)}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
        />
      </div>
      <div style={{ marginTop: 18, fontSize: 22, fontWeight: 900, color: "#E1BEE7", textShadow: "0 0 16px rgba(206,147,216,0.8)" }}>
        {getProfileIconDisplayLabel(iconId)}
      </div>
      <div style={{ marginTop: 28, fontSize: 12, color: "rgba(255,255,255,0.45)", letterSpacing: 2 }}>
        <Tr id="duplicate.tapContinue" />
      </div>
      <style>{`
        @keyframes iconChestPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>
    </div>,
    getAppPortalRoot(),
  );
}
