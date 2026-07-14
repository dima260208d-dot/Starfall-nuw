/** Shared tech-styled Astral orb (PNG + holographic ring). */
interface Props {
  size?: number;
  llmActive?: boolean;
  starGuardian?: boolean;
}

import { getUiAssetBaseUrl } from "../lib/assetBase";

const ORB_SRC = `${getUiAssetBaseUrl()}astral/astral-orb.png`;

export default function AstralOrbAvatar({ size = 56, llmActive = false, starGuardian = false }: Props) {
  const ring = starGuardian ? "#FFD740" : "#00E5FF";
  const glow = llmActive ? "rgba(0,229,255,0.75)" : "rgba(179,136,255,0.55)";

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -3,
          borderRadius: "50%",
          border: `2px solid ${ring}`,
          boxShadow: `0 0 ${size * 0.35}px ${glow}, inset 0 0 12px rgba(0,229,255,0.25)`,
          animation: "astralRingSpin 8s linear infinite",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -6,
          borderRadius: "50%",
          border: "1px dashed rgba(0,229,255,0.35)",
          animation: "astralRingSpin 14s linear infinite reverse",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #00E5FF 0%, #7B1FA2 45%, #0a0620 100%)",
          boxShadow: "inset 0 0 18px rgba(0,0,0,0.45)",
        }}
      />
      <img
        src={ORB_SRC}
        alt=""
        draggable={false}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          objectFit: "cover",
          display: "block",
          boxShadow: "inset 0 0 18px rgba(0,0,0,0.45)",
        }}
      />
      {llmActive && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: size * 0.28,
            height: size * 0.28,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #00E676, #00BFA5)",
            border: "2px solid #0a0620",
            boxShadow: "0 0 10px rgba(0,230,118,0.9)",
          }}
        />
      )}
      <style>{`
        @keyframes astralRingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
