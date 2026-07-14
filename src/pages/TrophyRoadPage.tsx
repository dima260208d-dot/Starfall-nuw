import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  getCurrentProfile,
  TROPHY_ROAD,
  claimTrophyRoadReward,
  MAX_TROPHIES,
  type TrophyRoadReward,
} from "../utils/localStorageAPI";
import { CHESTS, type ChestRarity } from "../utils/chests";
import { TrophyIcon, CoinIcon, GemIcon, PowerIcon } from "../components/GameIcons";
import ChestVisual from "../components/ChestVisual";
import RewardDropModal, { type RewardInfo } from "../components/RewardDropModal";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import { useI18n, trackRewardLabel } from "../i18n";
import { trophyRoadScrollTarget, trophyRoadFillPercent } from "../utils/rewardTrackTargets";
import VolProgressTrack from "../components/ui/VolProgressTrack";
import { useVirtualScrollRange } from "../hooks/useVirtualScrollRange";
import { preloadSpinningModelPath } from "../components/SpinningModel3D";
import { Tr } from "../i18n/Tr";
import {
  trophyRoadClaimFingerprint,
  useClaimRewardEnterSfx,
} from "../audio/claimRewardEnterSfx";

interface Props {
  onBack: () => void;
}

const TRACK_GRID = "minmax(0, 1fr) 96px minmax(0, 1fr)";
const SPINE_W = 18;
const ROW_GAP = 14;
const ROW_HEIGHT = 92;
const ROW_STRIDE = ROW_HEIGHT + ROW_GAP;
const SPINE_PAD = 32;
const VIRTUAL_OVERSCAN = 6;

function rewardColor(r: TrophyRoadReward): string {
  if (r.type === "gems") return "#40C4FF";
  if (r.type === "powerPoints") return "#CE93D8";
  if (r.type === "chest" && r.chestRarity) return CHESTS[r.chestRarity].color;
  return "#FFD700";
}

function RewardIcon({ r, size = 40 }: { r: TrophyRoadReward; size?: number }) {
  if (r.type === "chest" && r.chestRarity) {
    return (
      <div
        style={{
          width: size + 10,
          height: size + 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
        aria-hidden
      >
        <ChestVisual rarity={r.chestRarity} size={size + 6} animated={false} />
      </div>
    );
  }
  if (r.type === "gems") return <GemIcon size={size} lite static />;
  if (r.type === "powerPoints") return <PowerIcon size={size} lite static />;
  return <CoinIcon size={size} lite static />;
}

const TrophyRoadRewardTile = memo(function TrophyRoadRewardTile({
  reward,
  reached,
  claimed,
  onClaim,
}: {
  reward: TrophyRoadReward;
  reached: boolean;
  claimed: boolean;
  onClaim: () => void;
}) {
  const { t } = useI18n();
  const color = rewardColor(reward);
  const canClaim = reached && !claimed;
  return (
    <div
      style={{
        background: reached ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
        border: `2px solid ${reached ? color + "77" : "var(--bd-1)"}`,
        borderRadius: "var(--r-lg)",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 18,
        opacity: reached ? 1 : 0.58,
        minHeight: ROW_HEIGHT,
        width: "100%",
        boxShadow: reached && canClaim ? `0 0 22px ${color}55` : "var(--sh-md)",
        contain: "layout paint",
      }}
    >
      <div style={{ width: 64, display: "flex", justifyContent: "center", alignItems: "flex-start", flexShrink: 0, paddingTop: 2 }}>
        <RewardIcon r={reward} size={40} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1.3 }}>
          {trackRewardLabel(reward)}
        </div>
        <button
          type="button"
          onClick={onClaim}
          disabled={!canClaim}
          className={`ui-btn ui-btn--block ${
            claimed ? "ui-btn--ghost" : canClaim ? "ui-btn--success" : "ui-btn--ghost"
          }`}
          style={{ marginTop: 12, padding: "10px 20px", fontSize: 14, letterSpacing: "0.1em" }}
        >
          {claimed ? t("trophy.claimed") : canClaim ? t("trophy.claim") : t("trophy.locked")}
        </button>
      </div>
    </div>
  );
});

const TrophyRoadRow = memo(function TrophyRoadRow({
  reward,
  idx,
  reached,
  claimed,
  onClaim,
}: {
  reward: TrophyRoadReward;
  idx: number;
  reached: boolean;
  claimed: boolean;
  onClaim: (idx: number) => void;
}) {
  const { t } = useI18n();
  const isMilestone = reward.trophies % 500 === 0 || reward.trophies === MAX_TROPHIES;
  const nodeSize = isMilestone ? 64 : 56;
  const iconSize = isMilestone ? 30 : 26;

  return (
    <div
      id={`trophy-road-row-${idx}`}
      style={{
        display: "grid",
        gridTemplateColumns: TRACK_GRID,
        gap: ROW_GAP,
        alignItems: "center",
        height: ROW_HEIGHT,
        marginBottom: ROW_GAP,
        position: "relative",
        zIndex: 1,
        width: "100%",
        contain: "layout style",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 14,
        paddingRight: 8,
        width: "100%",
      }}>
        <div style={{ textAlign: "right" }}>
          <div className="ui-eyebrow" style={{ fontSize: 11, marginBottom: 4, letterSpacing: 1.2 }}><Tr id="common.trophies" /></div>
          <div style={{
            fontSize: isMilestone ? 28 : 24,
            fontWeight: 900,
            color: reached ? "#FFD700" : "var(--t-3)",
            lineHeight: 1,
            textShadow: reached ? "0 2px 12px rgba(255,213,79,0.45)" : "none",
          }}>
            {reward.trophies.toLocaleString("ru-RU")}
          </div>
        </div>
        <div style={{
          width: nodeSize,
          height: nodeSize,
          borderRadius: "50%",
          flexShrink: 0,
          background: reached
            ? "linear-gradient(135deg, #ffe57f 0%, #ffd54f 50%, #ff8a00 100%)"
            : "linear-gradient(160deg, #1a1240 0%, #060119 100%)",
          border: `3px solid ${reached ? "#FFD54F" : "var(--bd-2)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: reached
            ? "0 0 20px rgba(255,213,79,0.65), inset 0 1px 0 rgba(255,255,255,0.35)"
            : "var(--sh-md)",
          color: reached ? "#1a0a3a" : "var(--t-4)",
        }}>
          <TrophyIcon size={iconSize} lite />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: reached
            ? "linear-gradient(135deg, #ffe57f, #ff8a00)"
            : "rgba(255,255,255,0.14)",
          border: `3px solid ${reached ? "#fff" : "rgba(255,255,255,0.25)"}`,
          boxShadow: reached ? "0 0 12px rgba(255,213,79,0.75)" : "none",
          zIndex: 2,
        }} />
      </div>

      <TrophyRoadRewardTile
        reward={reward}
        reached={reached}
        claimed={claimed}
        onClaim={() => onClaim(idx)}
      />
    </div>
  );
});

export default function TrophyRoadPage({ onBack }: Props) {
  const { t, localeMeta } = useI18n();
  const [profile, setProfile] = useState(getCurrentProfile());
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingReward, setPendingReward] = useState<RewardInfo | null>(null);

  useClaimRewardEnterSfx("trophyroad", trophyRoadClaimFingerprint(profile));

  useEffect(() => {
    void preloadSpinningModelPath("models/coin.glb");
    void preloadSpinningModelPath("models/gem.glb");
    void preloadSpinningModelPath("models/powerpoint.glb");
  }, []);

  const bodyRef = useRef<HTMLDivElement>(null);

  const scrollToIdx = useMemo(
    () => (profile ? trophyRoadScrollTarget(profile) : 0),
    [profile?.trophyRoadClaimed],
  );

  const virtualRange = useVirtualScrollRange(
    bodyRef,
    TROPHY_ROAD.length,
    scrollToIdx,
    ROW_STRIDE,
    VIRTUAL_OVERSCAN,
  );

  const claimedSet = useMemo(
    () => new Set(profile?.trophyRoadClaimed ?? []),
    [profile?.trophyRoadClaimed],
  );

  const visibleRows = useMemo(
    () => TROPHY_ROAD.slice(virtualRange.start, virtualRange.end).map((reward, i) => ({
      reward,
      idx: virtualRange.start + i,
    })),
    [virtualRange.start, virtualRange.end],
  );

  const fillPct = useMemo(
    () => (profile ? trophyRoadFillPercent(profile.trophies) : 0),
    [profile?.trophies],
  );

  if (!profile) return null;

  const totalHeight = TROPHY_ROAD.length * ROW_STRIDE;
  const spineInner = `calc(100% - ${SPINE_PAD * 2}px)`;
  const fillTop = `calc(${SPINE_PAD}px + ${spineInner} * ${fillPct / 100})`;
  const topSpacer = virtualRange.start * ROW_STRIDE;
  const bottomSpacer = Math.max(0, totalHeight - topSpacer - visibleRows.length * ROW_STRIDE);

  const handleClaim = (idx: number) => {
    const r = claimTrophyRoadReward(idx);
    setProfile(getCurrentProfile());
    if (r.success && r.reward) {
      setPendingReward({
        type: r.reward.type as RewardInfo["type"],
        amount: r.reward.amount,
        chestRarity: r.reward.chestRarity as ChestRarity | undefined,
        iconId: r.reward.iconId,
        label: trackRewardLabel(r.reward),
      });
    } else {
      setMsg(r.error || t("common.error"));
      setTimeout(() => setMsg(null), 2200);
    }
  };

  return (
    <>
      <PageBg variant="trophyroad" style={{ fontFamily: "var(--app-font-sans)" }}>
        <PageHeader onBack={onBack} title={t("trophy.title")} trophies={profile.trophies} />
        <PageBody ref={bodyRef} style={{ width: "100%", maxWidth: 1320, margin: "0 auto", padding: "12px 8px 48px", boxSizing: "border-box" }}>
          <p style={{ textAlign: "center", color: "var(--t-3)", margin: "0 0 20px", fontSize: 16 }}>
            <Tr id="trophy.progress" />{" "}
            <span style={{ color: "#ffd54f", fontWeight: 800 }}>
              {t("trophy.progressOf", {
                current: profile.trophies.toLocaleString(localeMeta.bcp47),
                max: MAX_TROPHIES.toLocaleString(localeMeta.bcp47),
              })}
            </span>
          </p>

          {msg && (
            <div style={{ marginBottom: 14, color: "#FFD700", fontWeight: 700, textAlign: "center", fontSize: 15 }}>{msg}</div>
          )}

          <div style={{
            display: "grid",
            gridTemplateColumns: TRACK_GRID,
            gap: ROW_GAP,
            alignItems: "center",
            marginBottom: 16,
            width: "100%",
          }}>
            <div style={{
              textAlign: "center", fontWeight: 900, letterSpacing: 1.5, fontSize: 15,
              padding: "14px 10px", borderRadius: 12,
              background: "rgba(0,0,0,0.32)", color: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(255,255,255,0.14)",
            }}>
              <Tr id="trophy.column.trophies" />
            </div>
            <div />
            <div style={{
              textAlign: "center", fontWeight: 900, letterSpacing: 1.5, fontSize: 15,
              padding: "14px 10px", borderRadius: 12,
              background: "linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,138,0,0.14))",
              color: "#ffe082",
              border: "1px solid rgba(255,213,79,0.4)",
            }}>
              <Tr id="trophy.column.rewards" />
            </div>
          </div>

          <div style={{ position: "relative", width: "100%", minHeight: totalHeight + SPINE_PAD * 2 }}>
            <div style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: SPINE_PAD,
              bottom: SPINE_PAD,
              width: SPINE_W + 8,
              zIndex: 0,
              pointerEvents: "none",
            }}>
              <VolProgressTrack
                orientation="vertical"
                fitWidth={SPINE_W}
                fill={fillPct}
                fillBackground="linear-gradient(180deg, #FFE082 0%, #FFD700 35%, #FF8A00 70%, #E65100 100%)"
                fillBoxShadow="0 0 24px rgba(255,213,79,0.6), inset 0 2px 0 rgba(255,255,255,0.4)"
                style={{ height: "100%" }}
              />
            </div>

            {fillPct > 0 && (
              <div style={{
                position: "absolute",
                left: "50%",
                transform: "translate(-50%, -50%)",
                top: fillTop,
                zIndex: 4,
                pointerEvents: "none",
              }}>
                <div style={{
                  minWidth: 72,
                  padding: "6px 16px",
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #ffe57f, #ff8f00)",
                  border: "3px solid rgba(255,255,255,0.6)",
                  boxShadow: "0 6px 22px rgba(255,160,0,0.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  color: "#1a0a3a",
                  fontWeight: 900,
                  fontSize: 15,
                  whiteSpace: "nowrap",
                }}>
                  <TrophyIcon size={18} lite />
                  {profile.trophies.toLocaleString("ru-RU")}
                </div>
              </div>
            )}

            {topSpacer > 0 && <div style={{ height: topSpacer }} aria-hidden />}

            {visibleRows.map(({ reward, idx }) => (
              <TrophyRoadRow
                key={reward.trophies}
                reward={reward}
                idx={idx}
                reached={profile.trophies >= reward.trophies}
                claimed={claimedSet.has(reward.trophies)}
                onClaim={handleClaim}
              />
            ))}

            {bottomSpacer > 0 && <div style={{ height: bottomSpacer }} aria-hidden />}
          </div>
        </PageBody>
      </PageBg>

      {pendingReward && (
        <RewardDropModal
          reward={pendingReward}
          onDone={() => setPendingReward(null)}
        />
      )}
    </>
  );
}
