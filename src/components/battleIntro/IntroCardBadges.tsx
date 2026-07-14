import { getMasteryDisplayKind, getMasteryTierLevel, type MasteryTier } from "../../data/brawlerMastery";
import { getMasteryBadgeSrc } from "../../utils/brawlerMasteryUI";
import { getRankBadgeSrc } from "../../utils/brawlerRankUI";
import { translate as t } from "../../i18n";
import { EmojiIcon } from "../EmojiIcon";
import { Tr } from "../../i18n/Tr";

export function IntroMasteryBadge({ level, tier, size }: { level: number; tier: MasteryTier; size: number }) {
  const tierLevel = getMasteryTierLevel(level);
  const kind = getMasteryDisplayKind(level);
  const numFs = Math.max(9, Math.round(size * 0.34));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <img
        src={getMasteryBadgeSrc(tier)}
        alt=""
        loading="eager"
        decoding="async"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))",
        }}
      />
      {kind === "tier" && tierLevel != null && (
        <span style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 900, fontSize: numFs, color: "#fff", lineHeight: 1, pointerEvents: "none",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        }}>
          {tierLevel}
        </span>
      )}
      {kind === "pin" && (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4) }}><EmojiIcon emoji="📌" size={24} /></span>
      )}
      {kind === "title" && (
        <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.4) }}><EmojiIcon emoji="👑" size={24} /></span>
      )}
    </div>
  );
}

export function IntroRankBadge({ rank, size }: { rank: number; size: number }) {
  const numSize = Math.max(9, Math.round(size * 0.34));
  const labelSize = Math.max(6, Math.round(size * 0.12));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <img
        src={getRankBadgeSrc(rank)}
        alt=""
        draggable={false}
        loading="eager"
        decoding="async"
        style={{ width: size, height: size, display: "block", objectFit: "contain" }}
      />
      <span style={{
        position: "absolute", top: "18%", left: "50%", transform: "translateX(-50%)",
        fontSize: labelSize, fontWeight: 900, color: "#0d0d0d", lineHeight: 1, pointerEvents: "none",
      }}>
        <Tr id="rank.label" />
      </span>
      <span style={{
        position: "absolute", top: "54%", left: "50%", transform: "translate(-50%, -50%)",
        fontSize: numSize, fontWeight: 900, color: "#fff", lineHeight: 1, pointerEvents: "none",
        textShadow: "0 1px 0 #000",
      }}>
        {rank}
      </span>
    </div>
  );
}

/** Shrink label font so full string fits the bar width without ellipsis. */
export function fitLabelFontSize(text: string, basePx: number, maxWidthPx: number, minPx = 7): number {
  if (!text || maxWidthPx <= 0) return basePx;
  // Bold labels + Cyrillic need a wider per-glyph estimate.
  const est = text.length * basePx * 0.64;
  if (est <= maxWidthPx) return basePx;
  return Math.max(minPx, Math.floor(basePx * maxWidthPx / est));
}

/** Pick the largest font that fits both strings in the same column width. */
export function fitLabelFontSizePair(
  primary: string,
  secondary: string | undefined,
  basePrimary: number,
  baseSecondary: number,
  maxWidthPx: number,
  minPrimary = 6,
  minSecondary = 5,
): { primary: number; secondary: number } {
  let pFs = fitLabelFontSize(primary, basePrimary, maxWidthPx, minPrimary);
  let sFs = secondary
    ? fitLabelFontSize(secondary, baseSecondary, maxWidthPx, minSecondary)
    : baseSecondary;
  if (secondary) {
    const tighter = Math.min(pFs, sFs);
    pFs = fitLabelFontSize(primary, tighter, maxWidthPx, minPrimary);
    sFs = fitLabelFontSize(secondary, tighter, maxWidthPx, minSecondary);
  }
  return { primary: pFs, secondary: sFs };
}
