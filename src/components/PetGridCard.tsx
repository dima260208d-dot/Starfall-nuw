import { memo, type CSSProperties } from "react";
import type { PetDef, PetRarity } from "../entities/PetData";
import PetSvg from "./PetSvg";
import { petName } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";

export const PET_RARITY_TINT: Record<PetRarity, string> = {
  common: "#9E9E9E",
  rare: "#42A5F5",
  epic: "#AB47BC",
  mythic: "#FF7043",
  legendary: "#FFD54F",
};

export type PetCardOverlay = "none" | "preview" | "locked-blue" | "locked-red" | "banned";

const PetGridModel = memo(function PetGridModel({
  pet,
  owned,
  modelSize = 72,
}: {
  pet: PetDef;
  owned: boolean;
  modelSize?: number;
}) {
  return (
    <PetSvg
      pet={pet}
      size={modelSize}
      animated={owned}
      haloPulse={false}
    />
  );
}, (a, b) => a.pet.id === b.pet.id && a.owned === b.owned && a.modelSize === b.modelSize);

export interface PetGridCardProps {
  pet: PetDef;
  owned?: boolean;
  selected?: boolean;
  displayName?: string;
  equippedLabel?: string;
  isEquipped?: boolean;
  isNew?: boolean;
  overlay?: PetCardOverlay;
  /** Компактная квадратная карточка для рангового драфта (как иконки бойцов). */
  compact?: boolean;
  compactSize?: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
  style?: CSSProperties;
}

export const PetGridCard = memo(function PetGridCard({
  pet,
  owned = true,
  selected = false,
  displayName,
  equippedLabel = "EQUIP",
  isEquipped = false,
  isNew = false,
  overlay = "none",
  compact = false,
  compactSize = 132,
  onClick,
  onDoubleClick,
  style,
}: PetGridCardProps) {
  const name = displayName ?? petName(pet.id, pet.name);
  const cardW = compact ? compactSize : 140;
  const cardH = compact ? compactSize : undefined;
  const modelBox = compact ? Math.round(compactSize * 0.7) : 78;
  const modelH = compact ? Math.round(compactSize * 0.72) : 88;
  const modelSize = compact ? Math.round(compactSize * 0.58) : 72;

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        position: "relative",
        width: cardW,
        height: cardH,
        boxSizing: "border-box",
        background: compact
          ? "#0a0a14"
          : owned
            ? `linear-gradient(180deg, ${pet.color}26 0%, rgba(0,0,0,0.55) 100%)`
            : "rgba(0,0,0,0.45)",
        border: compact
          ? (selected ? `3px solid ${pet.color}` : owned ? `1.5px solid ${pet.color}55` : "1.5px solid rgba(255,255,255,0.10)")
          : selected
            ? `2px solid ${pet.color}`
            : owned
              ? `1.5px solid ${pet.color}55`
              : "1.5px solid rgba(255,255,255,0.10)",
        borderRadius: compact ? 0 : 14,
        padding: compact ? "4px 4px 3px" : "12px 8px 10px",
        cursor: owned ? "pointer" : "default",
        opacity: owned ? 1 : 0.72,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: compact ? 3 : 6,
        boxShadow: selected ? `0 0 18px ${pet.color}88` : "none",
        transition: "transform 0.15s, box-shadow 0.2s",
        transform: selected ? "translateY(-2px)" : "none",
        flexShrink: 0,
        animation: overlay === "preview" ? "rankedDraftPulse 1.1s ease-in-out infinite" : undefined,
        ...style,
      }}
    >
      <div style={{
        position: "absolute", top: compact ? 4 : 6, left: compact ? 4 : 6,
        width: 8, height: 8, borderRadius: 999,
        background: PET_RARITY_TINT[pet.rarity],
        boxShadow: `0 0 6px ${PET_RARITY_TINT[pet.rarity]}`,
      }} />
      {isEquipped && (
        <div style={{
          position: "absolute", top: 4, right: 4,
          fontSize: compact ? 7 : 8, fontWeight: 900, letterSpacing: 1,
          background: "#76FF03", color: "#1B5E20",
          borderRadius: 6, padding: "2px 5px",
        }}>{equippedLabel}</div>
      )}
      {isNew && (
        <div style={{
          position: "absolute", top: 4, right: isEquipped ? (compact ? 42 : 50) : 4,
          fontSize: compact ? 7 : 8, fontWeight: 900, letterSpacing: 1,
          background: "#FF1744", color: "white",
          borderRadius: 6, padding: "2px 5px",
          animation: "pulse 1.4s ease-in-out infinite",
        }}>NEW</div>
      )}
      <div style={{
        width: modelBox, height: modelH,
        display: "flex", alignItems: "center", justifyContent: "center",
        filter: owned ? "none" : "grayscale(0.85) brightness(0.55)",
        flexShrink: 0,
      }}>
        <PetGridModel pet={pet} owned={owned} modelSize={modelSize} />
      </div>
      <div style={{
        fontSize: compact ? 9 : 11, fontWeight: 800,
        color: owned ? pet.color : "rgba(255,255,255,0.5)",
        textAlign: "center", lineHeight: 1.2,
      }}>{owned ? name : "???"}</div>

      {overlay === "preview" && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: compact ? 0 : 14,
          background: "rgba(255,255,255,0.28)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{ fontSize: compact ? 14 : 16, fontWeight: 900, color: "#fff", letterSpacing: 1 }}>ВЫБРАТЬ?</span>
        </div>
      )}
      {(overlay === "locked-blue" || overlay === "locked-red") && (
        <>
          <div style={{
            position: "absolute", inset: 0, borderRadius: compact ? 0 : 14, zIndex: 2,
            background: overlay === "locked-blue" ? "rgba(33,150,243,0.22)" : "rgba(244,67,54,0.22)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", left: 0, right: 0, top: "50%", zIndex: 3,
            transform: "translateY(-50%)", borderRadius: 0,
            height: 26, background: overlay === "locked-blue" ? "#1565C0" : "#C62828",
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>ВЫБРАН</span>
          </div>
        </>
      )}
      {overlay === "banned" && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: compact ? 0 : 14, zIndex: 4,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{ fontSize: compact ? 10 : 11, fontWeight: 900, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>ЗАНЯТ</span>
        </div>
      )}
      {!owned && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: compact ? 0 : 14, zIndex: 5,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, textShadow: "0 4px 12px rgba(0,0,0,0.9)",
          pointerEvents: "none",
        }}>
          <EmojiIcon emoji="🔒" size={24} />
        </div>
      )}
    </button>
  );
});

export function PetSkipCard({
  label,
  selected = false,
  overlay = "none",
  compact = false,
  compactSize = 132,
  onClick,
  onDoubleClick,
}: {
  label: string;
  selected?: boolean;
  overlay?: PetCardOverlay;
  compact?: boolean;
  compactSize?: number;
  onClick?: () => void;
  onDoubleClick?: () => void;
}) {
  const cardW = compact ? compactSize : 140;
  const cardH = compact ? compactSize : undefined;
  const modelBox = compact ? Math.round(compactSize * 0.7) : 78;
  const modelH = compact ? Math.round(compactSize * 0.72) : 88;

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      style={{
        position: "relative",
        width: cardW,
        height: cardH,
        boxSizing: "border-box",
        background: compact ? "#0a0a14" : "rgba(0,0,0,0.45)",
        border: compact
          ? (selected ? "3px solid rgba(255,255,255,0.55)" : "1.5px solid rgba(255,255,255,0.12)")
          : (selected ? "2px solid rgba(255,255,255,0.55)" : "1.5px solid rgba(255,255,255,0.12)"),
        borderRadius: compact ? 0 : 14,
        padding: compact ? "4px 4px 3px" : "12px 8px 10px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 3 : 6,
        minHeight: compact ? undefined : 130,
        flexShrink: 0,
        animation: overlay === "preview" ? "rankedDraftPulse 1.1s ease-in-out infinite" : undefined,
      }}
    >
      <div style={{
        width: modelBox, height: modelH,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: compact ? 22 : 28, opacity: 0.45,
      }}>—</div>
      <div style={{
        fontSize: compact ? 9 : 11, fontWeight: 800,
        color: "rgba(255,255,255,0.65)",
        textAlign: "center", lineHeight: 1.2,
      }}>{label}</div>
      {overlay === "preview" && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: compact ? 0 : 14,
          background: "rgba(255,255,255,0.28)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{ fontSize: compact ? 14 : 16, fontWeight: 900, color: "#fff" }}>ВЫБРАТЬ?</span>
        </div>
      )}
      {(overlay === "locked-blue" || overlay === "locked-red") && (
        <>
          <div style={{
            position: "absolute", inset: 0, borderRadius: compact ? 0 : 14, zIndex: 2,
            background: overlay === "locked-blue" ? "rgba(33,150,243,0.22)" : "rgba(244,67,54,0.22)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", left: 0, right: 0, top: "50%", zIndex: 3,
            transform: "translateY(-50%)",
            height: 26, background: overlay === "locked-blue" ? "#1565C0" : "#C62828",
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>ВЫБРАН</span>
          </div>
        </>
      )}
      {overlay === "banned" && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: compact ? 0 : 14, zIndex: 4,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,0.7)", letterSpacing: 1 }}>ЗАНЯТ</span>
        </div>
      )}
    </button>
  );
}
