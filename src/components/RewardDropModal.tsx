import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import ChestItemScene from "./ChestItemScene";
import ChestVisual from "./ChestVisual";
import PinIcon from "./PinIcon";
import type { ChestRarity } from "../utils/chests";
import { getProfileIconImage, profileIconRewardFrameStyle } from "../utils/profileIconUtils";
import { useI18n } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

export interface RewardInfo {
  type: "coins" | "gems" | "powerPoints" | "chest" | "xp" | "pin" | "profileIcon";
  amount: number;
  chestRarity?: ChestRarity;
  pinId?: string;
  iconId?: string;
  goldenPinFrame?: boolean;
  label: string;
}

interface Props {
  reward: RewardInfo;
  onDone: () => void;
}

const GLOW: Record<string, string> = {
  coins:       "#FFD700",
  gems:        "#40C4FF",
  powerPoints: "#CE93D8",
  profileIcon: "#CE93D8",
  chest:       "#FF9800",
  xp:          "#FFD700",
};

export default function RewardDropModal({ reward, onDone }: Props) {
  const { t } = useI18n();
  // Keep drop animation, but cap particle count to reduce lag.
  const is3D = reward.type === "coins" || reward.type === "gems" || reward.type === "powerPoints";
  const glow  = reward.type === "pin" ? "#CE93D8" : (GLOW[reward.type] ?? "#FFD700");

  const modal = (
    <div
      onClick={onDone}
      style={{
        position: "fixed", inset: 0, zIndex: 999999,
        background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,20,0.93), rgba(0,0,0,0.98))`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer", userSelect: "none",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <style>{`
        @keyframes rdmFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes rdmPopUp   { from { opacity:0; transform:scale(0.6) } to { opacity:1; transform:scale(1) } }
        @keyframes rdmHintPulse {
          0%,100% { opacity:0.4 }
          50%      { opacity:0.9 }
        }
      `}</style>

      {/* Title */}
      <div style={{
        position: "absolute", top: 44,
        fontSize: 30, fontWeight: 900, letterSpacing: 3,
        color: "#fff",
        textShadow: `0 0 30px ${glow}CC, 0 2px 8px rgba(0,0,0,0.6)`,
        animation: "rdmPopUp 0.35s ease",
      }}>
        <Tr id="reward.received" />
      </div>

      {/* 3D physics drop for currency rewards */}
      {is3D && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <ChestItemScene
            type={reward.type as "coins" | "gems" | "powerPoints"}
            amount={Math.min(reward.amount, 8)}
          />
        </div>
      )}

      
      {reward.type === "pin" && reward.pinId && (
        <div style={{ animation: "rdmPopUp 0.45s 0.05s ease both", marginBottom: 20 }}>
          <PinIcon pinId={reward.pinId} size={120} glow animated />
        </div>
      )}

      {reward.type === "profileIcon" && reward.iconId && (
        <div style={{ animation: "rdmPopUp 0.45s 0.05s ease both", marginBottom: 20 }}>
          <img
            src={getProfileIconImage(reward.iconId)}
            alt=""
            style={profileIconRewardFrameStyle(120, {
              border: `3px solid ${glow}`,
              boxShadow: `0 0 28px ${glow}88`,
            })}
          />
        </div>
      )}

      {/* Static visual for chest rewards */}
      {reward.type === "chest" && reward.chestRarity && (
        <div style={{ animation: "rdmPopUp 0.45s 0.05s ease both", marginBottom: 20 }}>
          <ChestVisual rarity={reward.chestRarity} size={180} animated />
        </div>
      )}

      {/* Static visual for XP rewards */}
      {reward.type === "xp" && (
        <div style={{
          fontSize: 110, lineHeight: 1,
          animation: "rdmPopUp 0.45s 0.05s ease both",
          filter: `drop-shadow(0 0 30px ${glow})`,
        }}><EmojiIcon emoji="⭐" size={110} style={{ filter: `drop-shadow(0 0 30px ${glow})` }} /></div>
      )}

      {!is3D && (reward.type === "coins" || reward.type === "gems" || reward.type === "powerPoints") && (
        <div style={{
          fontSize: 100, lineHeight: 1,
          animation: "rdmPopUp 0.4s 0.05s ease both",
          filter: `drop-shadow(0 0 24px ${glow})`,
        }}>
          {reward.type === "coins" ? <EmojiIcon emoji="🪙" size={100} /> : reward.type === "gems" ? <EmojiIcon emoji="💎" size={100} /> : <EmojiIcon emoji="⚡" size={100} />}
        </div>
      )}

      {/* Reward label */}
      <div style={{
        position: "absolute", bottom: 110,
        fontSize: 26, fontWeight: 900,
        color: glow,
        textShadow: `0 0 20px ${glow}88`,
        animation: "rdmPopUp 0.45s 0.15s ease both",
        letterSpacing: 1,
      }}>
        + {reward.label}
      </div>

      {/* Tap hint */}
      <div style={{
        position: "absolute", bottom: 54,
        fontSize: 13, color: "rgba(255,255,255,0.5)",
        animation: "rdmHintPulse 1.6s 0.6s infinite",
        letterSpacing: 1,
      }}>
        <Tr id="chest.tapContinue" />
      </div>
    </div>
  );

  return createPortal(modal, getAppPortalRoot());
}
