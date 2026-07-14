import { useId } from "react";
import { BATTLE_STAR_PATH, BATTLE_STAR_VIEW } from "../utils/battleStarPath";

interface GlowingStarProps {
  filled?: boolean;
  /** Pulsing highlight — e.g. pending free star pick */
  glow?: boolean;
  size?: number | string;
  className?: string;
}

/** Battle-style constellation star (matches in-combat orbit stars). */
export default function GlowingStar({
  filled = false,
  glow = false,
  size = "100%",
  className,
}: GlowingStarProps) {
  const haloId = useId().replace(/:/g, "");
  const glowFilterId = useId().replace(/:/g, "");
  const active = filled || glow;

  return (
    <svg
      viewBox={BATTLE_STAR_VIEW}
      aria-hidden
      className={className}
      style={{
        width: size,
        height: size,
        display: "block",
        overflow: "visible",
        filter: active
          ? "drop-shadow(0 0 4px rgba(255,171,0,0.9)) drop-shadow(0 0 10px rgba(255,235,59,0.55))"
          : undefined,
        animation: glow ? "glowStarPulse 1.5s ease-in-out infinite" : undefined,
      }}
    >
      <defs>
        <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,235,59,0.55)" />
          <stop offset="100%" stopColor="rgba(255,235,59,0)" />
        </radialGradient>
        {glow && (
          <filter id={glowFilterId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="0.8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {filled && (
        <circle cx={0} cy={0} r={9} fill={`url(#${haloId})`} opacity={glow ? 0.85 : 0.65} />
      )}

      {glow && !filled && (
        <circle cx={0} cy={0} r={8} fill={`url(#${haloId})`} opacity={0.45} filter={`url(#${glowFilterId})`} />
      )}

      <path
        d={BATTLE_STAR_PATH}
        fill={filled || glow ? "#FFEB3B" : "rgba(0,0,0,0.38)"}
        stroke={filled || glow ? "#FF6F00" : "rgba(120,80,0,0.65)"}
        strokeWidth={filled || glow ? 0.9 : 0.75}
        filter={glow ? `url(#${glowFilterId})` : undefined}
        opacity={!filled && !glow ? 0.85 : 1}
      />

      {(filled || glow) && (
        <circle cx={0} cy={0} r={1.35} fill="rgba(255,255,255,0.95)" />
      )}
    </svg>
  );
}

export function GlowingStarStyles() {
  return (
    <style>{`
      @keyframes glowStarPulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.14); opacity: 1; }
      }
    `}</style>
  );
}
