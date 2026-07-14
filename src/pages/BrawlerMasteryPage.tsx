import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BRAWLERS } from "../entities/BrawlerData";
import {
  getMasteryDisplayKind,
  getMasteryLevel,
  getMasteryReward,
  getMasteryTier,
  getMasteryTierLevel,
  MASTERY_REWARD_TABLE,
  MAX_MASTERY_LEVEL,
  MAX_MASTERY_XP,
  BRAWLER_MASTERY_TITLES,
  type MasteryReward,
  type MasteryTier,
} from "../data/brawlerMastery";
import {
  claimBrawlerMasteryReward,
  getCurrentProfile,
} from "../utils/localStorageAPI";
import {
  getBrawlerMasteryClaimed,
  getBrawlerMasteryXp,
  isMasteryInfinite,
} from "../utils/brawlerMasteryStorage";
import {
  getMasteryBadgeSrc,
  getMasteryTrackContentWidth,
  masteryTrackFillPercent,
  MASTERY_XP_ICON,
} from "../utils/brawlerMasteryUI";
import BrawlerMasteryBar from "../components/BrawlerMasteryBar";
import VolProgressTrack from "../components/ui/VolProgressTrack";
import BrawlerViewer3D from "../components/BrawlerViewer3D";
import { CoinIcon, GemIcon, PowerIcon } from "../components/GameIcons";
import PinIcon from "../components/PinIcon";
import ChestVisual from "../components/ChestVisual";
import RewardDropModal, { type RewardInfo } from "../components/RewardDropModal";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import { useI18n, brawlerName, trackRewardLabel } from "../i18n";
import type { ChestRarity } from "../utils/chests";
import PlayerMasteryTitle from "../components/PlayerMasteryTitle";
import { EmojiIcon } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Props {
  brawlerId: string;
  onBack: () => void;
}

/** Размеры дорожки — крупный масштаб, всё по центру экрана. */
const NODE_W = 156;
const NODE_GAP = 5;
const REWARD_BOX = 102;
const REWARD_ICON = 54;
const TRACK_H = 52;
const DOT_SIZE = 34;
const BADGE_SIZE = 74;
const REWARD_ZONE_H = 118;
const GAP_ABOVE_TRACK = 18;
const TIER_LABEL_H = 26;
const OUTER_PAD_TOP = 22;
const TRACK_ROW_Y = OUTER_PAD_TOP + TIER_LABEL_H + REWARD_ZONE_H + GAP_ABOVE_TRACK;
const BELOW_TRACK_GAP = 12;

const TIER_LABELS: Record<MasteryTier, string> = {
  bronze: "Бронза",
  silver: "Серебро",
  gold: "Золото",
  diamond: "Алмаз",
  star: "Звезда",
};

function rewardIcon(reward: MasteryReward, size: number): ReactNode {
  if (reward.type === "coins") return <CoinIcon size={size} static />;
  if (reward.type === "gems") return <GemIcon size={size} static />;
  if (reward.type === "powerPoints") return <PowerIcon size={size} static />;
  if (reward.type === "chest" && reward.chestRarity) {
    return <ChestVisual rarity={reward.chestRarity as ChestRarity} size={size + 10} animated={false} />;
  }
  if (reward.type === "pin" && reward.pinId) return <PinIcon pinId={reward.pinId} size={size + 6} animated={false} />;
  if (reward.type === "title") return <span style={{ fontSize: size + 8 }}><EmojiIcon emoji="👑" size={24} /></span>;
  return "🎁";
}

function TrackDot({ reached, isCurrent }: { reached: boolean; isCurrent: boolean }) {
  return (
    <div style={{
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: "50%",
      background: reached
        ? "linear-gradient(180deg, #FFE082, #FF8F00)"
        : "rgba(30,20,40,0.85)",
      border: `3px solid ${isCurrent ? "#fff" : reached ? "#FFD740" : "rgba(255,255,255,0.35)"}`,
      boxShadow: reached ? "0 0 16px rgba(255,215,64,0.75), inset 0 2px 4px rgba(255,255,255,0.35)" : "inset 0 2px 4px rgba(0,0,0,0.5)",
      flexShrink: 0,
      zIndex: 3,
    }} />
  );
}

const MasteryNode = memo(function MasteryNode({
  reward,
  brawlerId,
  reached,
  claimed,
  canClaim,
  isCurrent,
  onClaim,
  claimLabel,
}: {
  reward: MasteryReward;
  brawlerId: string;
  reached: boolean;
  claimed: boolean;
  canClaim: boolean;
  isCurrent: boolean;
  onClaim: () => void;
  claimLabel: string;
}) {
  const { t } = useI18n();
  const full = getMasteryReward(reward.level, brawlerId) ?? reward;
  const tier = getMasteryTier(reward.level);
  const tierLevel = getMasteryTierLevel(reward.level);
  const kind = getMasteryDisplayKind(reward.level);
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");

  return (
    <div style={{
      width: NODE_W,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      opacity: reached ? 1 : 0.52,
    }}>
      {/* Награда — строго над линией, не касается её */}
      <div style={{
        height: REWARD_ZONE_H,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        width: "100%",
        paddingBottom: 0,
      }}>
        <div style={{
          width: REWARD_BOX,
          height: REWARD_BOX,
          borderRadius: 16,
          background: reached ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.42)",
          border: `3px solid ${isCurrent ? "#FFD740" : reached ? "rgba(186,104,255,0.7)" : "rgba(255,255,255,0.16)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: isCurrent ? "0 0 24px rgba(255,215,64,0.6)" : reached ? "0 6px 18px rgba(0,0,0,0.5)" : undefined,
        }}>
          {rewardIcon(full, REWARD_ICON)}
        </div>
      </div>

      {/* Кружок уровня — внутри линии (высота = TRACK_H) */}
      <div style={{
        height: TRACK_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        marginTop: GAP_ABOVE_TRACK,
      }}>
        <TrackDot reached={reached} isCurrent={isCurrent} />
      </div>

      {/* Значок раздела + XP + кнопка — под линией */}
      <div style={{ marginTop: BELOW_TRACK_GAP, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {kind === "tier" ? (
          <div style={{ position: "relative", width: BADGE_SIZE, height: BADGE_SIZE, flexShrink: 0 }}>
            <img
              src={getMasteryBadgeSrc(tier)}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))" }}
            />
            {tierLevel != null && (
              <span style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 20, color: "#fff", textShadow: "0 2px 5px rgba(0,0,0,0.95)",
              }}>
                {tierLevel}
              </span>
            )}
          </div>
        ) : kind === "pin" ? (
          <div style={{
            width: BADGE_SIZE, height: BADGE_SIZE, borderRadius: 16,
            background: "linear-gradient(145deg, rgba(255,64,129,0.35), rgba(74,20,140,0.65))",
            border: "3px solid rgba(255,128,171,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px rgba(255,64,129,0.45)",
          }}>
            {full.pinId
              ? <PinIcon pinId={full.pinId} size={48} animated={false} />
              : <span style={{ fontSize: 36 }}><EmojiIcon emoji="📌" size={24} /></span>}
          </div>
        ) : (
          <div style={{
            width: BADGE_SIZE, height: BADGE_SIZE, borderRadius: 16,
            background: "linear-gradient(145deg, rgba(255,215,64,0.35), rgba(255,143,0,0.45))",
            border: "3px solid rgba(255,235,59,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 22px rgba(255,215,64,0.55)",
          }}>
            <span style={{ fontSize: 40 }}><EmojiIcon emoji="👑" size={24} /></span>
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 900, color: "#E1BEE7", marginTop: 6, letterSpacing: 0.3 }}>
          {full.xpRequired}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>XP</div>

        {full.type === "title" && full.titleId && (
          <PlayerMasteryTitle titleId={full.titleId} fontSize={9} style={{ padding: "2px 6px", marginTop: 4 }} />
        )}

        <div style={{ minHeight: 32, marginTop: 6, display: "flex", alignItems: "center" }}>
          {canClaim ? (
            <button type="button" className="ui-btn ui-btn--accent" style={{ fontSize: 11, padding: "6px 14px", minHeight: 0 }} onClick={onClaim}>
              {claimLabel}
            </button>
          ) : claimed ? (
            <span style={{ fontSize: 11, fontWeight: 800, color: "#81C784" }}><Tr id="common.claimed" /></span>
          ) : (
            <img src={`${base}${MASTERY_XP_ICON}`} alt="" style={{ width: 22, height: 22, opacity: 0.32 }} />
          )}
        </div>
      </div>
    </div>
  );
});

function TierGroup({
  tier,
  rows,
  brawlerId,
  level,
  xp,
  claimedSet,
  onClaim,
  claimLabel,
}: {
  tier: MasteryTier;
  rows: MasteryReward[];
  brawlerId: string;
  level: number;
  xp: number;
  claimedSet: Set<number>;
  onClaim: (lvl: number) => void;
  claimLabel: string;
}) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      flexShrink: 0,
      padding: "0 4px",
      borderRight: "2px solid rgba(255,255,255,0.1)",
    }}>
      <div style={{
        textAlign: "center",
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 2,
        color: "rgba(255,255,255,0.6)",
        marginBottom: 6,
        height: 20,
      }}>
        {TIER_LABELS[tier]}
      </div>
      <div style={{ display: "flex", gap: NODE_GAP }}>
        {rows.map((row) => {
          const reached = xp >= row.xpRequired;
          const claimed = claimedSet.has(row.level);
          return (
            <MasteryNode
              key={row.level}
              reward={row}
              brawlerId={brawlerId}
              reached={reached}
              claimed={claimed}
              canClaim={reached && !claimed}
              isCurrent={row.level === level + 1 || (level === 0 && row.level === 1)}
              onClaim={() => onClaim(row.level)}
              claimLabel={claimLabel}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function BrawlerMasteryPage({ brawlerId, onBack }: Props) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(getCurrentProfile());
  const [pendingReward, setPendingReward] = useState<RewardInfo | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [viewportW, setViewportW] = useState(1200);

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

  const brawler = BRAWLERS.find(b => b.id === brawlerId);
  const xp = getBrawlerMasteryXp(profile, brawlerId);
  const level = getMasteryLevel(xp);
  const claimedSet = useMemo(() => new Set(getBrawlerMasteryClaimed(profile, brawlerId)), [profile, brawlerId]);

  const tierGroups = useMemo(() => {
    const groups: { tier: MasteryTier; rows: MasteryReward[] }[] = [];
    for (let ti = 0; ti < 5; ti++) {
      const tier = (["bronze", "silver", "gold", "diamond", "star"] as MasteryTier[])[ti];
      groups.push({
        tier,
        rows: MASTERY_REWARD_TABLE.filter(r => r.level >= ti * 5 + 1 && r.level <= ti * 5 + 5),
      });
    }
    return groups;
  }, []);

  const finaleRows = useMemo(
    () => MASTERY_REWARD_TABLE.filter(r => r.level >= 26),
    [],
  );

  const infinite = isMasteryInfinite(profile, brawlerId);
  const fillPct = masteryTrackFillPercent(xp);

  const handleClaim = (lvl: number) => {
    const result = claimBrawlerMasteryReward(brawlerId, lvl);
    setProfile(getCurrentProfile());
    if (result.success && result.reward) {
      setPendingReward({
        type: result.reward.type as RewardInfo["type"],
        amount: result.reward.amount,
        pinId: result.reward.pinId,
        label: trackRewardLabel({
          type: result.reward.type,
          amount: result.reward.amount ?? 0,
          label: String(result.reward.type),
          chestRarity: result.reward.chestRarity,
        }),
      });
    }
  };

  if (!profile) {
    return (
      <PageBg variant="mastery" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
        <PageHeader title={t("mastery.title", { name: "…" })} onBack={onBack} />
        <PageBody><Tr id="common.error" /></PageBody>
      </PageBg>
    );
  }
  if (!brawler) {
    return (
      <PageBg variant="mastery" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
        <PageHeader title={t("mastery.title", { name: brawlerId })} onBack={onBack} />
        <PageBody><Tr id="common.error" /></PageBody>
      </PageBg>
    );
  }

  const trackContentW = getMasteryTrackContentWidth();
  const trackBarW = Math.max(trackContentW, viewportW);
  const columnTotalH = OUTER_PAD_TOP + TIER_LABEL_H + REWARD_ZONE_H + GAP_ABOVE_TRACK + TRACK_H + BELOW_TRACK_GAP + BADGE_SIZE + 90;

  const xpLabel = infinite
    ? `${xp.toLocaleString()} XP ∞`
    : `${xp}/${MAX_MASTERY_XP} XP`;

  return (
    <PageBg variant="mastery" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
      <PageHeader
        title={t("mastery.title", { name: brawlerName(brawler.id, brawler.name) })}
        onBack={onBack}
        coins={profile.coins}
        gems={profile.gems}
        powerPoints={profile.powerPoints}
        trophies={profile.trophies}
      />
      <style>{`
        .mastery-track-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .mastery-track-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <PageBody style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8, minHeight: 0, flex: 1 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "rgba(0,0,0,0.52)", borderRadius: 14,
          border: `1px solid ${brawler.color}66`, padding: "8px 14px", flexShrink: 0,
        }}>
          <div style={{ width: 88, height: 88, flexShrink: 0 }}>
            <BrawlerViewer3D brawlerId={brawler.id} color={brawler.color} size={80} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>
              <Tr id="mastery.subtitle" params={{ level, max: MAX_MASTERY_LEVEL }} /> · {xpLabel}
            </div>
            <BrawlerMasteryBar brawlerId={brawlerId} xp={xp} layout="wide" width={300} showNextReward rewardIconSize={38} badgeSize={62} />
          </div>
          {BRAWLER_MASTERY_TITLES[brawler.id] && (
            <div style={{
              flex: "0 1 42%",
              maxWidth: 420,
              minWidth: 140,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingLeft: 8,
            }}>
              <PlayerMasteryTitle
                text={BRAWLER_MASTERY_TITLES[brawler.id]}
                fontSize={22}
                style={{ textAlign: "right", lineHeight: 1.25, width: "100%" }}
              />
            </div>
          )}
        </div>

        <div
          ref={trackRef}
          className="mastery-track-scroll"
          style={{
            flex: 1,
            overflowX: "auto",
            overflowY: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "0",
            minHeight: columnTotalH + 20,
          }}
        >
          <div style={{
            position: "relative",
            minWidth: trackBarW,
            width: trackBarW,
            height: columnTotalH,
            margin: "auto 0",
          }}>
            {/* Линия на всю ширину — от первого до последнего уровня и края экрана */}
            <VolProgressTrack
              fitHeight={TRACK_H + 8}
              fill={fillPct}
              fillBackground="linear-gradient(90deg, #BA68C8, #FFD740, #FF80AB)"
              fillBoxShadow="inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -3px 0 rgba(0,0,0,0.32), 0 0 20px rgba(186,104,255,0.6)"
              style={{
                position: "absolute",
                left: 0,
                width: trackContentW,
                top: TRACK_ROW_Y,
                zIndex: 1,
              }}
            />

            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              position: "relative",
              zIndex: 2,
              paddingTop: OUTER_PAD_TOP,
            }}>
              {tierGroups.map(g => (
                <TierGroup
                  key={g.tier}
                  tier={g.tier}
                  rows={g.rows}
                  brawlerId={brawlerId}
                  level={level}
                  xp={xp}
                  claimedSet={claimedSet}
                  onClaim={handleClaim}
                  claimLabel={t("common.claim")}
                />
              ))}
              <div style={{ display: "flex", flexDirection: "column", flexShrink: 0, paddingLeft: 6 }}>
                <div style={{
                  textAlign: "center", fontSize: 12, fontWeight: 900, letterSpacing: 2,
                  color: "#FFD740", marginBottom: 6, height: 20,
                }}>
                  <Tr id="mastery.finale" />
                </div>
                <div style={{ display: "flex", gap: NODE_GAP }}>
                  {finaleRows.map(row => {
                    const reached = xp >= row.xpRequired;
                    const claimed = claimedSet.has(row.level);
                    return (
                      <MasteryNode
                        key={row.level}
                        reward={row}
                        brawlerId={brawlerId}
                        reached={reached}
                        claimed={claimed}
                        canClaim={reached && !claimed}
                        isCurrent={row.level === level + 1}
                        onClaim={() => handleClaim(row.level)}
                        claimLabel={t("common.claim")}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageBody>

      {pendingReward && (
        <RewardDropModal reward={pendingReward} onDone={() => setPendingReward(null)} />
      )}
    </PageBg>
  );
}
