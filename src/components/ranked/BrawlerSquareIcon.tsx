import type { CSSProperties, MouseEvent } from "react";
import { BRAWLERS } from "../../entities/BrawlerData";
import { getBrawlerDisplayName } from "../../utils/brawlerDisplay";
import { brawlerAvatarUrl } from "../../utils/modeAssets";
import { RankBadgeIcon } from "../BrawlerRankBar";
import GlowingStar from "../GlowingStar";
import { EmojiIcon } from "../EmojiIcon";

export type BrawlerSquareOverlay =
  | "none"
  | "preview"
  | "locked-blue"
  | "locked-red"
  | "banned";

export interface BrawlerSquareIconProps {
  brawlerId: string;
  size: number;
  level?: number;
  rank?: number;
  stars?: number;
  overlay?: BrawlerSquareOverlay;
  unlocked?: boolean;
  showMeta?: boolean;
  showName?: boolean;
  checkmark?: boolean;
  /** Только отображение (нижняя плашка команд) — без кнопки. */
  static?: boolean;
  onClick?: (e: MouseEvent) => void;
  onDoubleClick?: (e: MouseEvent) => void;
  style?: CSSProperties;
  className?: string;
}

export default function BrawlerSquareIcon({
  brawlerId,
  size,
  level = 1,
  rank = 1,
  stars = 0,
  overlay = "none",
  unlocked = true,
  showMeta = true,
  showName = true,
  checkmark = false,
  static: isStatic = false,
  onClick,
  onDoubleClick,
  style,
  className,
}: BrawlerSquareIconProps) {
  const b = BRAWLERS.find(x => x.id === brawlerId);
  const name = b ? getBrawlerDisplayName(b) : brawlerId;
  const badgeSize = Math.max(18, Math.round(size * 0.22));
  const starSize = Math.max(14, Math.round(size * 0.16));
  const metaScale = size / 128;

  const borderColor =
    overlay === "locked-blue" ? "#42A5F5"
      : overlay === "locked-red" ? "#EF5350"
        : overlay === "preview" ? "rgba(255,255,255,0.95)"
          : overlay === "banned" ? "rgba(80,80,80,0.8)"
            : "transparent";

  const shellStyle: CSSProperties = {
    position: "relative",
    width: size,
    height: size,
    padding: 0,
    border: overlay === "none" ? "none" : `3px solid ${borderColor}`,
    borderRadius: 0,
    overflow: "hidden",
    background: "#0a0a14",
    cursor: isStatic ? "default" : unlocked && overlay !== "banned" ? "pointer" : "default",
    flexShrink: 0,
    boxSizing: "border-box",
    opacity: overlay === "banned" ? 0.42 : unlocked ? 1 : 0.45,
    animation: overlay === "preview" ? "rankedDraftPulse 1.1s ease-in-out infinite" : undefined,
    ...style,
  };

  const inner = (
    <>
      <img
        src={brawlerAvatarUrl(brawlerId)}
        alt={name}
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          display: "block",
          borderRadius: 0,
          filter: unlocked ? "none" : "grayscale(0.85) brightness(0.45)",
        }}
      />

      {showMeta && unlocked && (
        <>
          <div style={{
            position: "absolute", top: 4, left: 5, zIndex: 2,
            fontSize: Math.max(9, 11 * metaScale), fontWeight: 900, color: "#fff",
            textShadow: "0 1px 4px rgba(0,0,0,0.95)",
            letterSpacing: 0.3,
            lineHeight: 1,
            pointerEvents: "none",
          }}>
            СИЛА {level}
          </div>
          <div style={{
            position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)",
            zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            pointerEvents: "none",
          }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: starSize, height: starSize }}>
                <GlowingStar filled={i < stars} size={starSize} />
              </div>
            ))}
          </div>
          <div style={{
            position: "absolute", top: 4, right: 4, zIndex: 2,
            display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2,
            pointerEvents: "none",
          }}>
            <RankBadgeIcon rank={rank} size={badgeSize} />
            {[3, 4, 5].map(i => (
              <div key={i} style={{ width: starSize, height: starSize }}>
                <GlowingStar filled={i < stars} size={starSize} />
              </div>
            ))}
          </div>
        </>
      )}

      {showName && (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 2,
          padding: "5px 6px 4px",
          background: "linear-gradient(0deg, rgba(0,0,0,0.82) 0%, transparent 100%)",
          fontSize: Math.max(10, 13 * metaScale), fontWeight: 900, color: "#fff",
          textAlign: "left", letterSpacing: 0.4,
          textShadow: "0 1px 4px rgba(0,0,0,0.95)",
          pointerEvents: "none",
          lineHeight: 1.05,
        }}>
          {name.toUpperCase()}
        </div>
      )}

      {overlay === "preview" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 4,
          background: "rgba(255,255,255,0.28)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{
            fontSize: Math.max(14, 20 * metaScale), fontWeight: 900, color: "#fff",
            letterSpacing: 1.5, textShadow: "0 2px 8px rgba(0,0,0,0.9)",
          }}>
            ВЫБРАТЬ?
          </span>
        </div>
      )}

      {(overlay === "locked-blue" || overlay === "locked-red") && (
        <>
          <div style={{
            position: "absolute", inset: 0, zIndex: 3,
            background: overlay === "locked-blue" ? "rgba(33,150,243,0.22)" : "rgba(244,67,54,0.22)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", left: 0, right: 0, top: "50%", zIndex: 5,
            transform: "translateY(-50%)",
            height: Math.max(22, 28 * metaScale),
            background: overlay === "locked-blue" ? "#1565C0" : "#C62828",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.55)",
            pointerEvents: "none",
          }}>
            <span style={{
              fontSize: Math.max(11, 14 * metaScale), fontWeight: 900, color: "#fff",
              letterSpacing: 2,
            }}>
              ВЫБРАН
            </span>
          </div>
        </>
      )}

      {overlay === "banned" && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 4,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{ fontSize: Math.max(10, 12 * metaScale), fontWeight: 900, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>
            ЗАНЯТ
          </span>
        </div>
      )}

      {!unlocked && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: Math.max(36, Math.round(size * 0.34)),
          textShadow: "0 4px 12px rgba(0,0,0,0.9)",
          pointerEvents: "none",
        }}>
          <EmojiIcon emoji="🔒" size={24} />
        </div>
      )}

      {checkmark && (
        <div style={{
          position: "absolute", right: 3, bottom: 3, zIndex: 6,
          width: Math.max(18, 22 * metaScale), height: Math.max(18, 22 * metaScale),
          borderRadius: "50%",
          background: "#43A047",
          border: "2px solid #fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: Math.max(10, 12 * metaScale), fontWeight: 900, color: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
          pointerEvents: "none",
        }}>
          <EmojiIcon emoji="✓" size={20} />
        </div>
      )}
    </>
  );

  if (isStatic) {
    return <div className={className} style={shellStyle}>{inner}</div>;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={!unlocked || overlay === "banned"}
      style={shellStyle}
    >
      {inner}
    </button>
  );
}
