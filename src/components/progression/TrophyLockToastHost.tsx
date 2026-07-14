import { useEffect, useState } from "react";
import { subscribeTrophyLockToast } from "../../utils/progression/trophyLockToast";
import { TrophyIcon } from "../GameIcons";
import TrophyLockIcon from "./TrophyLockIcon";

/** Auto-dismissing toast when tapping locked trophy-gated features. */
export default function TrophyLockToastHost() {
  const [message, setMessage] = useState("");

  useEffect(() => subscribeTrophyLockToast(setMessage), []);

  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        top: "18%",
        transform: "translateX(-50%)",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 22px",
        borderRadius: 16,
        background: "linear-gradient(135deg, rgba(26,0,51,0.96), rgba(10,0,28,0.98))",
        border: "2px solid rgba(255,215,64,0.55)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 24px rgba(255,215,64,0.2)",
        maxWidth: "min(92vw, 420px)",
        pointerEvents: "none",
        animation: "trophyLockToastIn 0.28s ease-out",
      }}
    >
      <TrophyLockIcon size="toast" />
      <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, lineHeight: 1.35 }}>{message}</div>
      <TrophyIcon size={22} />
      <style>{`
        @keyframes trophyLockToastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
