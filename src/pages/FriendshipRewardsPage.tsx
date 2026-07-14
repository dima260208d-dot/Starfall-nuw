import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  FRIENDSHIP_LEVEL_REWARDS,
  FRIENDSHIP_LEVEL_XP,
  FRIENDSHIP_MAX_LEVEL,
  friendshipProgress,
  type FriendshipLevelReward,
} from "../data/friendshipLevels";
import { OLD_FRIEND_TITLE_ID, exclusiveTitleI18nKey } from "../data/exclusiveTitles";
import { getProfileByPlayerId } from "../utils/playerGiftSend";
import { getFriendshipBond } from "../utils/social/friendship";
import { FriendAvatar } from "../components/FriendRowCard";
import FriendshipBondBar from "../components/social/FriendshipBondBar";
import VolProgressTrack from "../components/ui/VolProgressTrack";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import { CoinIcon, GemIcon, PowerIcon } from "../components/GameIcons";
import ChestVisual from "../components/ChestVisual";
import PlayerMasteryTitle from "../components/PlayerMasteryTitle";
import { useI18n } from "../i18n";
import type { ChestRarity } from "../utils/chests";
import { getCurrentProfile } from "../utils/localStorageAPI";
import { TextWithEmojis, EmojiIcon } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";

const NODE_W = 148;
const NODE_GAP = 8;
const REWARD_BOX = 96;
const REWARD_ICON = 50;
const TRACK_H = 48;
const DOT_SIZE = 32;
const REWARD_ZONE_H = 108;
const GAP_ABOVE_TRACK = 14;
const OUTER_PAD_TOP = 18;
const BELOW_TRACK_GAP = 10;

function rewardPreview(reward: FriendshipLevelReward, size: number): ReactNode {
  if (reward.chest) {
    return <ChestVisual rarity={reward.chest as ChestRarity} size={size + 8} animated={false} />;
  }
  if (reward.exclusiveTitleId) {
    return <span style={{ fontSize: size }}><EmojiIcon emoji="🏷️" size={20} /></span>;
  }
  if (reward.powerPoints) {
    return <PowerIcon size={size} static />;
  }
  if (reward.gems && !reward.coins && !reward.powerPoints) {
    return <GemIcon size={size} static />;
  }
  if (reward.coins) {
    return <CoinIcon size={size} static />;
  }
  return <span style={{ fontSize: size }}><EmojiIcon emoji="🎁" size={24} /></span>;
}

function rewardSummary(reward: FriendshipLevelReward, t: (k: string, p?: Record<string, string>) => string): string {
  const parts: string[] = [];
  if (reward.coins) parts.push(`+${reward.coins}`);
  if (reward.gems) parts.push(`+${reward.gems} 💎`);
  if (reward.chest) parts.push(t(`chest.def.${reward.chest}.shortName`));
  if (reward.powerPoints) parts.push(`+${reward.powerPoints} ${t("common.powerPoints")}`);
  if (reward.exclusiveTitleId) {
    const key = exclusiveTitleI18nKey(reward.exclusiveTitleId);
    parts.push(key ? t(key) : "");
  }
  if (reward.level === 10) parts.push(t("friendship.rewardsLevel10Extra"));
  return parts.filter(Boolean).join(" · ");
}

const LevelNode = memo(function LevelNode({
  reward,
  reached,
  claimed,
  isCurrent,
  xpRequired,
}: {
  reward: FriendshipLevelReward;
  reached: boolean;
  claimed: boolean;
  isCurrent: boolean;
  xpRequired: number;
}) {
  const { t } = useI18n();

  return (
    <div
      style={{
        width: NODE_W,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: reached ? 1 : 0.5,
      }}
    >
      <div
        style={{
          height: REWARD_ZONE_H,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            width: REWARD_BOX,
            height: REWARD_BOX,
            borderRadius: 16,
            background: reached ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.42)",
            border: `3px solid ${isCurrent ? "#FFD740" : reached ? "rgba(206,147,216,0.65)" : "rgba(255,255,255,0.14)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isCurrent ? "0 0 22px rgba(255,215,64,0.55)" : undefined,
          }}
        >
          {rewardPreview(reward, REWARD_ICON)}
        </div>
      </div>

      <div
        style={{
          height: TRACK_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          marginTop: GAP_ABOVE_TRACK,
        }}
      >
        <div
          style={{
            width: DOT_SIZE,
            height: DOT_SIZE,
            borderRadius: "50%",
            background: reached
              ? "linear-gradient(180deg, #FFE082, #FF8F00)"
              : "rgba(30,15,50,0.9)",
            border: `3px solid ${isCurrent ? "#fff" : reached ? "#FFD740" : "rgba(255,255,255,0.3)"}`,
            boxShadow: reached ? "0 0 14px rgba(255,215,64,0.65)" : undefined,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 900,
            color: reached ? "#3E2723" : "rgba(255,255,255,0.5)",
          }}
        >
          {reward.level}
        </div>
      </div>

      <div style={{ marginTop: BELOW_TRACK_GAP, textAlign: "center", padding: "0 4px" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.45)" }}>
          <Tr id="friendship.rewardsXpRequired" params={{ xp: String(xpRequired) }} />
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: "#E1BEE7",
            marginTop: 4,
            lineHeight: 1.35,
            minHeight: 28,
          }}
        >
          <TextWithEmojis text={rewardSummary(reward, t)} emojiSize={21} />
        </div>
        {reward.exclusiveTitleId === OLD_FRIEND_TITLE_ID && (
          <PlayerMasteryTitle titleId={OLD_FRIEND_TITLE_ID} fontSize={8} style={{ marginTop: 4 }} />
        )}
        <div style={{ minHeight: 22, marginTop: 6 }}>
          {claimed ? (
            <span style={{ fontSize: 10, fontWeight: 800, color: "#81C784" }}><Tr id="common.claimed" /></span>
          ) : reached ? (
            <span style={{ fontSize: 10, fontWeight: 800, color: "#FFD740" }}><Tr id="friendship.rewardsPending" /></span>
          ) : null}
        </div>
      </div>
    </div>
  );
});

interface Props {
  friendPlayerId: string;
  onBack: () => void;
}

export default function FriendshipRewardsPage({ friendPlayerId, onBack }: Props) {
  const { t } = useI18n();
  const trackRef = useRef<HTMLDivElement>(null);
  const [viewportW, setViewportW] = useState(900);

  const me = getCurrentProfile();
  const friendProfile = getProfileByPlayerId(friendPlayerId);
  const bond = getFriendshipBond(friendPlayerId, me);
  const progress = friendshipProgress(bond.xp);
  const claimedSet = useMemo(() => new Set(bond.claimedLevels ?? []), [bond.claimedLevels]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = el.clientWidth;
      setViewportW((prev) => (prev === w ? prev : w));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!me) {
    return (
      <PageBg variant="friendshipRewards">
        <PageHeader onBack={onBack} title={t("friendship.rewardsTitle")} />
        <PageBody style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
          <Tr id="friends.error.unauthorized" />
        </PageBody>
      </PageBg>
    );
  }

  if (!friendProfile) {
    return (
      <PageBg variant="friendshipRewards">
        <PageHeader onBack={onBack} title={t("friendship.rewardsTitle")} />
        <PageBody style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.6)" }}>
          <Tr id="friends.error.notFound" />
        </PageBody>
      </PageBg>
    );
  }

  const trackContentW =
    FRIENDSHIP_LEVEL_REWARDS.length * NODE_W +
    Math.max(0, FRIENDSHIP_LEVEL_REWARDS.length - 1) * NODE_GAP +
    40;
  const trackBarW = Math.max(trackContentW, viewportW);
  const fillPct = progress.pct;

  return (
    <PageBg variant="friendshipRewards" style={{ fontFamily: "var(--app-font-sans)" }}>
      <PageHeader
        onBack={onBack}
        title={t("friendship.rewardsTitle")}
        coins={me.coins}
        gems={me.gems}
        power={me.powerPoints}
      />
      <style>{`
        .friendship-rewards-track-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .friendship-rewards-track-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <PageBody
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 0,
          flex: 1,
          paddingBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "rgba(0,0,0,0.52)",
            borderRadius: 14,
            border: "1px solid rgba(206,147,216,0.45)",
            padding: "10px 14px",
            flexShrink: 0,
          }}
        >
          <FriendAvatar
            profileIconId={friendProfile.profileIconId}
            brawlerId={friendProfile.selectedBrawlerId || friendProfile.favoriteBrawlerId}
            username={friendProfile.username}
            online={false}
            size={56}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>
              {friendProfile.username}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>
              {t("friendship.rewardsSubtitle", {
                level: String(progress.level),
                max: String(FRIENDSHIP_MAX_LEVEL),
              })}
            </div>
            <FriendshipBondBar friendPlayerId={friendPlayerId} />
          </div>
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.5)",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          <Tr id="friendship.rewardsAutoHint" />
        </div>

        <div
          ref={trackRef}
          className="friendship-rewards-track-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: "auto",
            overflowY: "hidden",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div style={{ width: trackBarW, minHeight: "100%", position: "relative", paddingTop: OUTER_PAD_TOP }}>
            <VolProgressTrack
              fitHeight={18}
              fill={fillPct}
              fillBackground="linear-gradient(90deg, #CE93D8, #FFD740)"
              fillBoxShadow="0 0 12px rgba(255,215,64,0.45)"
              style={{
                position: "absolute",
                left: NODE_W / 2,
                top: OUTER_PAD_TOP + REWARD_ZONE_H + GAP_ABOVE_TRACK + TRACK_H / 2 - 9,
                width: trackBarW - NODE_W,
              }}
            />
            <div style={{ display: "flex", gap: NODE_GAP, padding: "0 20px", position: "relative", zIndex: 2 }}>
              {FRIENDSHIP_LEVEL_REWARDS.map(reward => {
                const reached = progress.level >= reward.level;
                const claimed = claimedSet.has(reward.level);
                const isCurrent =
                  reward.level === progress.level + 1 ||
                  (progress.level >= FRIENDSHIP_MAX_LEVEL && reward.level === FRIENDSHIP_MAX_LEVEL);
                return (
                  <LevelNode
                    key={reward.level}
                    reward={reward}
                    reached={reached}
                    claimed={claimed}
                    isCurrent={isCurrent && !claimed}
                    xpRequired={FRIENDSHIP_LEVEL_XP[reward.level] ?? 0}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </PageBody>
    </PageBg>
  );
}
