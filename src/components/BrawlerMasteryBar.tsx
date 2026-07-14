import { useEffect, useState, type CSSProperties } from "react";
import {
  getMasteryBarState,
  getMasteryDisplayKind,
  getMasteryReward,
  MAX_MASTERY_LEVEL,
} from "../data/brawlerMastery";
import {
  getMasteryBadgeSrc,
  getMasteryBarColors,
  MASTERY_XP_ICON,
} from "../utils/brawlerMasteryUI";
import { getBrawlerMasteryXp, isMasteryInfinite } from "../utils/brawlerMasteryStorage";
import { getCurrentProfile } from "../utils/localStorageAPI";
import VolProgressTrack from "./ui/VolProgressTrack";
import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";
import { loadResourceListIcons } from "../utils/resourceListIconCache";
import PinIcon from "./PinIcon";
import ChestVisual from "./ChestVisual";
import type { ChestRarity } from "../utils/chests";
import type { MasteryReward } from "../data/brawlerMastery";
import { EmojiIcon } from "./EmojiIcon";

export interface BrawlerMasteryBarProps {
  brawlerId: string;
  xp?: number;
  layout?: "compact" | "wide" | "result";
  width?: number;
  badgeSize?: number;
  rewardIconSize?: number;
  animateFromXp?: number;
  animateToXp?: number;
  animateDurationMs?: number;
  showNextReward?: boolean;
  barRef?: React.Ref<HTMLDivElement>;
  style?: CSSProperties;
}

function RewardPreview({ reward, size }: { reward: MasteryReward | undefined; size: number }) {
  if (!reward) return null;
  if (reward.type === "coins") return <CoinIcon size={size} lite static />;
  if (reward.type === "gems") return <GemIcon size={size} lite static />;
  if (reward.type === "powerPoints") return <PowerIcon size={size} lite static />;
  if (reward.type === "chest" && reward.chestRarity) {
    return <ChestVisual rarity={reward.chestRarity as ChestRarity} size={size + 6} animated={false} />;
  }
  if (reward.type === "pin" && reward.pinId) return <PinIcon pinId={reward.pinId} size={size} animated={false} />;
  if (reward.type === "title") return <span style={{ fontSize: size }}><EmojiIcon emoji="👑" size={24} /></span>;
  return null;
}

export default function BrawlerMasteryBar({
  brawlerId,
  xp: xpProp,
  layout = "compact",
  width: widthProp,
  badgeSize: badgeSizeProp,
  rewardIconSize: rewardIconSizeProp,
  animateFromXp,
  animateToXp,
  animateDurationMs = 1200,
  showNextReward = true,
  barRef,
  style,
}: BrawlerMasteryBarProps) {
  useEffect(() => { void loadResourceListIcons(); }, []);

  const profile = getCurrentProfile();
  const targetXp = xpProp ?? getBrawlerMasteryXp(profile, brawlerId);
  const infinite = isMasteryInfinite(profile, brawlerId);
  const [displayXp, setDisplayXp] = useState(targetXp);

  useEffect(() => {
    if (animateFromXp == null || animateToXp == null) {
      setDisplayXp(targetXp);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / animateDurationMs);
      const eased = 1 - (1 - t) ** 3;
      setDisplayXp(Math.round(animateFromXp + (animateToXp - animateFromXp) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animateFromXp, animateToXp, animateDurationMs, targetXp]);

  const state = getMasteryBarState(displayXp);
  const colors = getMasteryBarColors(state.tier);
  const masteryLevel = state.level;
  const displayKind = masteryLevel > 0 ? getMasteryDisplayKind(masteryLevel) : "tier";

  const barH = layout === "result" ? 32 : layout === "wide" ? 30 : 28;
  const badgeSize = badgeSizeProp ?? (layout === "result" ? 56 : layout === "wide" ? 52 : 44);
  const trackW = widthProp ?? (layout === "result" ? 180 : layout === "wide" ? 260 : 140);
  const rewardSize = rewardIconSizeProp ?? (layout === "result" ? 34 : layout === "wide" ? 32 : 26);
  const xpIconSize = barH + 10;
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  const nextReward = state.level < MAX_MASTERY_LEVEL
    ? getMasteryReward(state.level + 1, brawlerId)
    : undefined;

  return (
    <div ref={barRef} style={{ display: "inline-flex", alignItems: "center", gap: 8, ...style }}>
      <div style={{ position: "relative", width: badgeSize, height: badgeSize, flexShrink: 0 }}>
        <img
          src={getMasteryBadgeSrc(state.tier)}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.6))" }}
        />
        {masteryLevel === 0 && (
          <span style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: layout === "result" ? 15 : 13, color: "#fff",
            textShadow: "0 1px 4px rgba(0,0,0,0.95)",
          }}>
            0
          </span>
        )}
        {masteryLevel > 0 && displayKind === "tier" && state.tierLevel != null && (
          <span style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: layout === "result" ? 15 : 13, color: "#fff",
            textShadow: "0 1px 4px rgba(0,0,0,0.95)",
          }}>
            {state.tierLevel}
          </span>
        )}
        {masteryLevel > 0 && displayKind === "pin" && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}><EmojiIcon emoji="📌" size={24} /></span>
        )}
        {masteryLevel > 0 && displayKind === "title" && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}><EmojiIcon emoji="👑" size={24} /></span>
        )}
      </div>
      <div style={{ position: "relative", width: trackW, height: barH, flexShrink: 0 }}>
        <VolProgressTrack
          fitHeight={barH}
          fill={Math.round(state.fill * 100)}
          fillBackground={`linear-gradient(180deg, ${colors.top}, ${colors.bottom})`}
          fillBoxShadow={colors.glow ? `inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -3px 0 rgba(0,0,0,0.32), 0 0 12px ${colors.glow}` : undefined}
          style={{ width: trackW, height: barH }}
          overlay={(
            <>
              <img src={`${base}${MASTERY_XP_ICON}`} alt="" style={{ width: xpIconSize, height: xpIconSize, objectFit: "contain" }} />
              <span style={{ fontSize: layout === "result" ? 12 : 11, fontWeight: 900, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.85)" }}>
                {infinite ? `${displayXp.toLocaleString()} ∞` : displayXp}
              </span>
            </>
          )}
          overlayStyle={{ justifyContent: "flex-start", gap: 5, paddingLeft: 8 }}
        />
      </div>
      {showNextReward && nextReward && (
        <div style={{
          width: rewardSize + 14, height: rewardSize + 14, borderRadius: 10, flexShrink: 0,
          background: "rgba(0,0,0,0.45)", border: "1.5px solid rgba(255,255,255,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <RewardPreview reward={nextReward} size={rewardSize} />
        </div>
      )}
    </div>
  );
}
