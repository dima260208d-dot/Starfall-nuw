import ChestVisual from "./ChestVisual";
import PinIcon from "./PinIcon";
import { CoinIcon, GemIcon, PowerIcon, PassXpIcon } from "./GameIcons";
import { getProfileIconImage, profileIconRewardFrameStyle } from "../utils/profileIconUtils";
import type { DailyReward } from "../utils/dailyLadder";
import { EmojiIcon } from "./EmojiIcon";

export default function DailyRewardVisual({
  reward,
  size = 64,
  animated = true,
}: {
  reward: DailyReward;
  size?: number;
  animated?: boolean;
}) {
  if (reward.type === "chest" && reward.chestRarity) {
    return <ChestVisual rarity={reward.chestRarity} size={size} animated={animated} />;
  }
  if (reward.type === "pin") {
    return <PinIcon pinId="g_target" size={Math.round(size * 0.85)} glow animated={animated} />;
  }
  if (reward.type === "profileIcon" && reward.iconId) {
    const base = (import.meta as any).env?.BASE_URL ?? "/";
    const src = getProfileIconImage(reward.iconId, base);
    return (
      <img
        src={src}
        alt=""
        style={profileIconRewardFrameStyle(size, {
          filter: `drop-shadow(0 4px 14px ${reward.color}88)`,
        })}
      />
    );
  }
  const iconSize = Math.round(size * 0.72);
  if (reward.type === "coins") {
    return <CoinIcon size={iconSize} style={{ filter: `drop-shadow(0 4px 12px ${reward.color}88)` }} />;
  }
  if (reward.type === "gems") {
    return <GemIcon size={iconSize} style={{ filter: `drop-shadow(0 4px 12px ${reward.color}88)` }} />;
  }
  if (reward.type === "powerPoints") {
    return <PowerIcon size={iconSize} style={{ filter: `drop-shadow(0 4px 12px ${reward.color}88)` }} />;
  }
  if (reward.type === "xp") {
    return <PassXpIcon size={iconSize} style={{ filter: `drop-shadow(0 4px 12px ${reward.color}88)` }} />;
  }
  return (
    <div style={{
      fontSize: size * 0.75,
      lineHeight: 1,
      filter: `drop-shadow(0 4px 12px ${reward.color}88)`,
    }}>
      <EmojiIcon emoji={reward.icon} size={18} />
    </div>
  );
}
