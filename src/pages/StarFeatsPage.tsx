import { useEffect, useMemo, useState } from "react";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import VolProgressTrack from "../components/ui/VolProgressTrack";
import { CoinIcon, GemIcon, PowerIcon } from "../components/GameIcons";
import RewardDropModal, { type RewardInfo } from "../components/RewardDropModal";
import ChestVisual from "../components/ChestVisual";
import { CHESTS } from "../utils/chests";
import {
  claimStarFeatReward,
  getCurrentProfile,
  syncStarFeatPeaks,
} from "../utils/localStorageAPI";
import {
  featsForTier,
  starFeatBadgeImg,
  starFeatTabImg,
  type StarFeatDef,
  type StarFeatTier,
} from "../data/starFeatsData";
import type { StarFeatReward } from "../utils/starFeatRewards";
import { starFeatRewardLabel, starFeatRewardToDropInfo } from "../utils/starFeatRewards";
import {
  getStarFeatProgress,
  getStarFeatTierUnclaimedCount,
  hasStarFeatTierBadge,
  isStarFeatComplete,
  tierCompletionRatio,
} from "../utils/starFeatProgress";
import { isStarFeatClaimed } from "../utils/starFeatProgressCore";
import { starFeatTextParams } from "../utils/starFeatI18n";
import { getDisplayStarFeatTierBadges, isStarFeatDevPreviewUser } from "../utils/starFeatDisplay";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";
import {
  starFeatsClaimFingerprint,
  useClaimRewardEnterSfx,
} from "../audio/claimRewardEnterSfx";

const TIERS: StarFeatTier[] = [1, 2, 3, 4, 5, 6];
const base = (import.meta as any).env?.BASE_URL ?? "/";

function TierUnclaimedBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <span
      className="no-ui-shear"
      style={{
        position: "absolute",
        top: 2,
        left: 2,
        minWidth: 18,
        height: 18,
        padding: "0 5px",
        borderRadius: 9,
        background: "linear-gradient(135deg, #FF1744, #D50000)",
        border: "2px solid #160048",
        color: "#fff",
        fontSize: 10,
        fontWeight: 900,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 10px rgba(255,23,68,0.85)",
        pointerEvents: "none",
        zIndex: 12,
        lineHeight: 1,
      }}
    >
      {display}
    </span>
  );
}

interface Props {
  onBack: () => void;
}

function formatProgress(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function RewardPreview({ reward, t }: { reward: StarFeatReward; t: (key: string, p?: Record<string, string | number>) => string }) {
  const label = starFeatRewardLabel(reward, t);
  if (reward.kind === "chest") {
    const ch = CHESTS[reward.chest];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <ChestVisual rarity={reward.chest} size={40} />
        <span style={{ fontSize: 12, fontWeight: 800, color: ch.color }}>{label}</span>
      </div>
    );
  }
  const icon =
    reward.kind === "coins" ? <CoinIcon size={18} /> :
    reward.kind === "gems" ? <GemIcon size={18} /> :
    <PowerIcon size={18} />;
  const color =
    reward.kind === "coins" ? "#FFD54F" :
    reward.kind === "gems" ? "#40C4FF" : "#CE93D8";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color }}>
      {icon}
      {label}
    </span>
  );
}

function FeatCard({
  def,
  tick,
  onClaimed,
  onClaimReward,
}: {
  def: StarFeatDef;
  tick: number;
  onClaimed: () => void;
  onClaimReward: (info: RewardInfo) => void;
}) {
  const { t } = useI18n();
  void tick;
  const profile = getCurrentProfile();
  const params = starFeatTextParams(def, t);
  const cur = getStarFeatProgress(def, profile);
  const done = isStarFeatComplete(def, profile);
  const claimed = isStarFeatClaimed(def, profile);
  const pct = def.target > 0 ? Math.min(100, Math.round((cur / def.target) * 100)) : 0;
  const canClaim = done && !claimed;

  return (
    <div
      style={{
        position: "relative",
        padding: "12px 14px 12px 12px",
        borderRadius: 14,
        border: `2px solid ${done ? def.borderColor : `${def.borderColor}99`}`,
        background: done
          ? `linear-gradient(135deg, ${def.borderColor}22, rgba(8,6,24,0.55))`
          : "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(12,8,32,0.5))",
        boxShadow: done ? `0 0 18px ${def.borderColor}44` : "var(--sh-sm)",
      }}
    >
      <img
        src={`${base}${starFeatTabImg(def.tier)}`}
        alt=""
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 36,
          height: 36,
          objectFit: "contain",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
        }}
      />
      <div style={{ fontWeight: 900, fontSize: 14, color: "#fff", paddingRight: 42, marginBottom: 4 }}>
        {t(def.titleKey, params)}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.62)", lineHeight: 1.35, marginBottom: 8, paddingRight: 8 }}>
        {t(def.descKey, params)}
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}><Tr id="starFeat.reward" /></div>
      <div style={{ marginBottom: 10 }}>
        <RewardPreview reward={def.reward} t={t} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: done ? "#69F0AE" : "#FFD54F" }}>
          {formatProgress(cur)} / {formatProgress(def.target)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.45)" }}>{pct}%</span>
      </div>
      <VolProgressTrack
        fitHeight={14}
        fill={pct}
        fillBackground={
          done
            ? `linear-gradient(90deg, ${def.borderColor}, #fff)`
            : `linear-gradient(90deg, ${def.borderColor}aa, ${def.borderColor})`
        }
      />
      {canClaim && (
        <button
          type="button"
          className="star-feat-claim-btn"
          onClick={() => {
            const dropInfo = starFeatRewardToDropInfo(def.reward, t);
            const r = claimStarFeatReward(def.id);
            if (r.success) {
              onClaimReward(dropInfo);
              onClaimed();
            }
          }}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "8px 12px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #FFD740, #FF8F00)",
            color: "#FFFBF0",
            fontWeight: 900,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <Tr id="starFeat.claim" />
        </button>
      )}
      {claimed && (
        <div style={{ marginTop: 8, fontSize: 10, fontWeight: 900, letterSpacing: 1, color: "#69F0AE" }}>
          <Tr id="starFeat.claimed" />
        </div>
      )}
    </div>
  );
}

export default function StarFeatsPage({ onBack }: Props) {
  const { t } = useI18n();
  const [tier, setTier] = useState<StarFeatTier>(1);
  const [tick, setTick] = useState(0);
  const [pendingReward, setPendingReward] = useState<RewardInfo | null>(null);

  useEffect(() => {
    syncStarFeatPeaks();
    const id = window.setInterval(() => {
      syncStarFeatPeaks();
      setTick(n => n + 1);
    }, 800);
    return () => window.clearInterval(id);
  }, []);

  const profile = getCurrentProfile();
  useClaimRewardEnterSfx("starfeats", starFeatsClaimFingerprint(profile));
  const feats = useMemo(() => featsForTier(tier), [tier]);
  const tierRatio = tierCompletionRatio(tier, profile);
  const displayBadges = getDisplayStarFeatTierBadges(profile);
  const hasBadge = displayBadges.includes(tier) || hasStarFeatTierBadge(tier, profile);
  const devPreview = isStarFeatDevPreviewUser(profile) && !hasStarFeatTierBadge(tier, profile) && displayBadges.includes(tier);

  return (
    <PageBg variant="starfeats">
      <PageHeader
        onBack={onBack}
        title={t("starFeat.pageTitle")}
        coins={profile?.coins}
        gems={profile?.gems}
        power={profile?.powerPoints}
        trophies={profile?.trophies}
      />
      <PageBody style={{ padding: "12px 16px 20px", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
        <style>{`.star-feat-claim-btn { color: #FFFBF0 !important; }`}</style>

        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
          <Tr id="starFeat.pageHint" />
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12 }}>
          <aside
            style={{
              width: 88,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              borderRadius: 14,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                WebkitOverflowScrolling: "touch",
              }}
            >
              {TIERS.map(st => {
                const ratio = tierCompletionRatio(st, profile);
                const badge = getDisplayStarFeatTierBadges(profile).includes(st);
                const unclaimed = getStarFeatTierUnclaimedCount(st, profile);
                const active = st === tier;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTier(st)}
                    style={{
                      flexShrink: 0,
                      border: active ? "2px solid #FFD740" : unclaimed > 0 ? "1px solid rgba(255,23,68,0.45)" : "1px solid rgba(255,255,255,0.12)",
                      background: active ? "rgba(255,215,64,0.15)" : unclaimed > 0 ? "rgba(255,23,68,0.12)" : "rgba(0,0,0,0.3)",
                      borderRadius: 12,
                      padding: "8px 4px",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    <TierUnclaimedBadge count={unclaimed} />
                    <img
                      src={`${base}${starFeatTabImg(st)}`}
                      alt=""
                      style={{ width: 48, height: 48, objectFit: "contain", display: "block", margin: "0 auto" }}
                    />
                    <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 4 }}>
                      {ratio.done}/{ratio.total}
                    </div>
                    {badge && (
                      <img
                        src={`${base}${starFeatBadgeImg(st)}`}
                        alt=""
                        style={{
                          position: "absolute",
                          bottom: 2,
                          right: 2,
                          width: 22,
                          height: 22,
                          objectFit: "contain",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(0,0,0,0.32)",
                border: "1px solid rgba(255,255,255,0.1)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={`${base}${starFeatTabImg(tier)}`} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />
                <div>
                  <div style={{ fontWeight: 900, fontSize: 13, color: "#FFD740" }}>
                    <Tr id="starFeat.tierProgress" params={{ done: tierRatio.done, total: tierRatio.total }} />
                  </div>
                  {hasBadge && (
                    <div style={{ fontSize: 10, color: "#69F0AE", marginTop: 2 }}><Tr id="starFeat.tierBadgeEarned" /></div>
                  )}
                  {devPreview && (
                    <div style={{ fontSize: 9, color: "rgba(255,213,79,0.7)", marginTop: 2 }}><Tr id="starFeat.devBadgePreview" /></div>
                  )}
                </div>
              </div>
              {hasBadge && (
                <img src={`${base}${starFeatBadgeImg(tier)}`} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
              {feats.map(def => (
                <FeatCard
                  key={def.id}
                  def={def}
                  tick={tick}
                  onClaimed={() => setTick(n => n + 1)}
                  onClaimReward={setPendingReward}
                />
              ))}
            </div>
          </div>
        </div>
      </PageBody>

      {pendingReward && (
        <RewardDropModal
          reward={pendingReward}
          onDone={() => {
            setPendingReward(null);
            setTick(n => n + 1);
          }}
        />
      )}
    </PageBg>
  );
}
