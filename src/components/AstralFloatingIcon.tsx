import { useState, useEffect } from "react";
import AstralChatModal from "./AstralChatModal";
import AstralOrbAvatar from "./AstralOrbAvatar";
import { isLlmReady } from "../ai/astralLlm";
import { isStarGuardianActive } from "../utils/subscription";
import { useI18n } from "../i18n";

interface Props {
  size?: number;
  compact?: boolean;
  style?: React.CSSProperties;
}

export default function AstralFloatingIcon({ size = 56, compact, style }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [sgActive, setSgActive] = useState(isStarGuardianActive());
  const [llmOn, setLlmOn] = useState(isLlmReady());

  useEffect(() => {
    const id = setInterval(() => {
      setSgActive(isStarGuardianActive());
      setLlmOn(isLlmReady());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <button
        type="button"
        className="no-ui-shear"
        onClick={() => setOpen(true)}
        title={t("astral.companionTitle")}
        style={{
          position: "absolute",
          bottom: compact ? 8 : 16,
          left: compact ? 198 : 312,
          width: size + 12,
          height: size + 12,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          zIndex: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
      >
        <div
          style={{
            position: "relative",
            padding: 6,
            borderRadius: "50%",
            background:
              "linear-gradient(145deg, rgba(0,229,255,0.12) 0%, rgba(74,20,140,0.55) 45%, rgba(10,0,32,0.9) 100%)",
            border: `1px solid ${llmOn ? "rgba(0,229,255,0.65)" : "rgba(206,147,216,0.45)"}`,
            boxShadow: llmOn
              ? "0 0 28px rgba(0,229,255,0.45), 0 0 12px rgba(255,215,64,0.25), inset 0 0 20px rgba(0,229,255,0.08)"
              : "0 0 22px rgba(179,136,255,0.4), inset 0 0 16px rgba(255,255,255,0.06)",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background:
                "repeating-conic-gradient(from 0deg, transparent 0deg 8deg, rgba(0,229,255,0.07) 8deg 9deg)",
              pointerEvents: "none",
            }}
          />
          <AstralOrbAvatar size={size} llmActive={llmOn} starGuardian={sgActive} />
        </div>
      </button>
      {open && <AstralChatModal onClose={() => setOpen(false)} />}
    </>
  );
}
