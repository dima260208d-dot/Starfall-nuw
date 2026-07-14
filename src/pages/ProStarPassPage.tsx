import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getCurrentProfile, type ClashPassReward } from "../utils/localStorageAPI";
import {
  buyProStarPass,
  claimProStarPassPaidReward,
  claimProStarPassReward,
  proStarPassMaxReachableLevel,
  proStarPassTokensIntoCurrentLevel,
  PRO_STAR_PASS_MAX_LEVEL,
  PRO_STAR_PASS_PRICE_RUB,
  PRO_STAR_PASS_WIN_TOKENS,
  PRO_STAR_PASS_TIER_BONUS,
} from "../utils/proStarPass";
import { PROFILE_CLOUD_CHANGED } from "../utils/cloud/profileCloud";
import { proStarPassFreeReward, proStarPassPaidReward } from "../utils/proStarPassRewards";
import ChestVisual from "../components/ChestVisual";
import { GemIcon } from "../components/GameIcons";
import PinIcon from "../components/PinIcon";
import RewardDropModal, { type RewardInfo } from "../components/RewardDropModal";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import { getProfileIconImage } from "../utils/profileIconUtils";
import { useI18n, trackRewardLabel } from "../i18n";
import { publicAssetBase } from "../utils/modeAssets";
import ProPassTokenProgressBar from "../components/ProPassTokenProgressBar";
import PassTrackDetailsModal, {
  PassInfoButton,
  preloadPassDetailsChestModelsFromTracks,
} from "../components/PassTrackDetailsModal";
import { proStarPassTrackSummaries } from "../utils/passTrackSummary";
import { EmojiIcon } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";
import {
  proStarPassClaimFingerprint,
  useClaimRewardEnterSfx,
} from "../audio/claimRewardEnterSfx";

interface Props {
  onBack: () => void;
}

const COL_W = 162;
const REWARD_SIZE = 148;
const LEVEL_NODE = 46;
const COL_GAP = 10;
const COL_STRIDE = COL_W + COL_GAP;
/** Max "infinite" (>100) reward columns to render at once — guards against
 *  huge token balances trying to draw tens of thousands of 3D tiles. */
const PRO_STAR_PASS_INFINITE_DISPLAY_ROWS = 40;

/**
 * Horizontal windowing for the Pro Star Pass track. Trophy Road uses the same
 * technique (`useVirtualScrollRange`) to keep a *constant* number of 3D reward
 * tiles mounted; without it, scrolling the 100+ level track instantiates every
 * chest model at once and exhausts mobile WebGL/RAM (page blanks after ~2s).
 */
function useHorizontalVirtualRange(
  scrollRef: React.RefObject<HTMLElement | null>,
  count: number,
  initialIndex: number,
  stride: number,
  overscan = 4,
) {
  const [range, setRange] = useState(() => ({
    start: Math.max(0, initialIndex - overscan),
    end: Math.min(count, initialIndex + overscan + 8),
  }));

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || count === 0) return;
    el.scrollLeft = Math.max(0, initialIndex * stride - stride);
  }, [initialIndex, scrollRef, stride, count]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || count === 0) return;
    const update = () => {
      const start = Math.max(0, Math.floor(el.scrollLeft / stride) - overscan);
      const visible = Math.ceil(el.clientWidth / stride) + overscan * 2;
      const end = Math.min(count, start + visible);
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [count, scrollRef, stride, overscan]);

  return range;
}
const HERO_IMG = `${publicAssetBase}images/pro-star-pass-hero.png`;

function rewardColor(r: ClashPassReward): string {
  if (r.type === "gems") return "#40C4FF";
  if (r.type === "chest") return "#FF7043";
  if (r.type === "pin") return "#CE93D8";
  if (r.type === "profileIcon") return "#B388FF";
  return "#FFD700";
}

function RewardIcon({ r, size = 52 }: { r: ClashPassReward; size?: number }) {
  if (r.type === "chest" && r.chestRarity) {
    return <ChestVisual rarity={r.chestRarity} size={size} animated={false} />;
  }
  if (r.type === "gems") return <GemIcon size={size} static />;
  if (r.type === "pin" && r.pinId) return <PinIcon pinId={r.pinId} size={size} glow bare />;
  if (r.type === "profileIcon" && r.iconId) {
    return (
      <img
        src={getProfileIconImage(r.iconId)}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: "contain", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))" }}
      />
    );
  }
  return null;
}

function rewardAmountText(reward: ClashPassReward): string | null {
  if (reward.type === "gems" || reward.type === "coins" || reward.type === "powerPoints" || reward.type === "xp") {
    return trackRewardLabel(reward);
  }
  if (reward.type === "chest" && reward.chestRarity) {
    return trackRewardLabel(reward);
  }
  return null;
}

function RewardTile({
  reward,
  reached,
  claimed,
  locked,
  premium,
  onClaim,
}: {
  reward: ClashPassReward;
  reached: boolean;
  claimed: boolean;
  locked: boolean;
  premium: boolean;
  onClaim: () => void;
}) {
  const { t } = useI18n();
  const color = rewardColor(reward);
  const canClaim = reached && !claimed && !locked;
  const amountText = rewardAmountText(reward);
  const iconSize = amountText ? 52 : 58;
  return (
    <button
      type="button"
      disabled={!canClaim}
      onClick={canClaim ? onClaim : undefined}
      style={{
        width: REWARD_SIZE,
        height: REWARD_SIZE,
        padding: 6,
        borderRadius: 6,
        border: `2px solid ${reached ? (premium ? "rgba(255,213,79,0.65)" : "rgba(120,200,255,0.45)") : "rgba(255,255,255,0.14)"}`,
        background: reached
          ? premium
            ? "linear-gradient(145deg, rgba(255,215,0,0.22), rgba(184,134,11,0.16))"
            : "linear-gradient(145deg, rgba(40,60,120,0.35), rgba(20,30,60,0.25))"
          : "rgba(255,255,255,0.05)",
        boxShadow: reached ? (premium ? "0 0 14px rgba(255,213,79,0.25)" : "0 0 10px rgba(64,196,255,0.15)") : undefined,
        opacity: locked ? 0.55 : reached ? 1 : 0.65,
        cursor: canClaim ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        position: "relative",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
    >
      {locked && <span style={{ position: "absolute", top: 5, left: 6, fontSize: 12, zIndex: 2 }}><EmojiIcon emoji="🔒" size={24} /></span>}
      {claimed && <span style={{ position: "absolute", top: 5, right: 6, fontSize: 12, color: "#76ff03", zIndex: 2 }}><EmojiIcon emoji="✓" size={20} /></span>}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        <RewardIcon r={reward} size={iconSize} />
      </div>
      {amountText ? (
        <span
          style={{
            fontSize: 10,
            fontWeight: 900,
            color: premium ? "#FFD740" : "#E3F2FD",
            textAlign: "center",
            lineHeight: 1.15,
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
            flexShrink: 0,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {amountText}
        </span>
      ) : (
        <span
          style={{
            fontSize: 8,
            fontWeight: 800,
            color: "rgba(255,255,255,0.75)",
            textAlign: "center",
            lineHeight: 1.1,
            flexShrink: 0,
          }}
        >
          {trackRewardLabel(reward)}
        </span>
      )}
      {canClaim && (
        <span style={{ fontSize: 7, fontWeight: 900, color: "#c6ff00", letterSpacing: "0.06em", flexShrink: 0 }}>
          <Tr id="common.claim" />
        </span>
      )}
    </button>
  );
}

function LevelNode({ label, reached, claimed }: { label: string | number; reached: boolean; claimed: boolean }) {
  return (
    <div
      style={{
        width: LEVEL_NODE,
        height: LEVEL_NODE,
        flexShrink: 0,
        borderRadius: "50%",
        background: reached
          ? "linear-gradient(135deg, #ffe57f, #ff8a00)"
          : "linear-gradient(160deg, #1a1240, #060119)",
        border: `2px solid ${reached ? "#ffd54f" : "rgba(255,255,255,0.15)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        fontSize: 13,
        color: reached ? "#1a0a3a" : "rgba(255,255,255,0.45)",
        boxShadow: reached ? "0 0 14px rgba(255,213,79,0.5)" : undefined,
      }}
    >
      {reached && claimed ? <EmojiIcon emoji="✓" size={24} /> : label}
    </div>
  );
}

export default function ProStarPassPage({ onBack }: Props) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(getCurrentProfile());
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingReward, setPendingReward] = useState<RewardInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const passTrackDetails = useMemo(() => proStarPassTrackSummaries(), []);
  const trackRef = useRef<HTMLDivElement>(null);
  const refresh = () => setProfile(getCurrentProfile());

  useClaimRewardEnterSfx("prostarpass", proStarPassClaimFingerprint(profile));

  useEffect(() => {
    void preloadPassDetailsChestModelsFromTracks(passTrackDetails);
    refresh();
  }, [passTrackDetails]);

  useEffect(() => {
    const onProfile = () => refresh();
    window.addEventListener("clash-profile-local-changed", onProfile);
    window.addEventListener(PROFILE_CLOUD_CHANGED, onProfile);
    return () => {
      window.removeEventListener("clash-profile-local-changed", onProfile);
      window.removeEventListener(PROFILE_CLOUD_CHANGED, onProfile);
    };
  }, []);

  const levels = useMemo(
    () => Array.from({ length: PRO_STAR_PASS_MAX_LEVEL }, (_, i) => i + 1),
    [],
  );

  const maxLevel = profile ? proStarPassMaxReachableLevel(profile.proStarPassTokens ?? 0) : 0;
  const infiniteRowCount = Math.min(
    Math.max(0, maxLevel - PRO_STAR_PASS_MAX_LEVEL),
    PRO_STAR_PASS_INFINITE_DISPLAY_ROWS,
  );
  const colCount = PRO_STAR_PASS_MAX_LEVEL + infiniteRowCount;
  const initialCol = Math.max(0, Math.min(colCount - 1, (maxLevel > 0 ? maxLevel : 1) - 1));
  const vRange = useHorizontalVirtualRange(trackRef, colCount, initialCol, COL_STRIDE);

  if (!profile) return null;

  const hasPaid = !!profile.proStarPassPaid;
  const claimedFree = profile.proStarPassClaimed ?? [];
  const claimedPaid = profile.proStarPassClaimedPaid ?? [];
  const progress = proStarPassTokensIntoCurrentLevel(profile.proStarPassTokens ?? 0);
  const levelLabel = progress.isInfinite || progress.level > PRO_STAR_PASS_MAX_LEVEL
    ? `∞${progress.level - PRO_STAR_PASS_MAX_LEVEL}`
    : String(Math.min(progress.level, PRO_STAR_PASS_MAX_LEVEL));
  const completedLevels = Math.max(0, maxLevel - 1);
  const currentFrac = maxLevel > 0 ? progress.intoLevel / progress.needed : 0;
  const trackFillPct = Math.min(
    100,
    ((completedLevels + currentFrac) / PRO_STAR_PASS_MAX_LEVEL) * 100,
  );

  const showReward = (r: { success: boolean; reward?: ClashPassReward; error?: string }) => {
    refresh();
    if (r.success && r.reward) {
      setPendingReward({
        type: r.reward.type as RewardInfo["type"],
        amount: r.reward.amount,
        chestRarity: r.reward.chestRarity,
        pinId: r.reward.pinId,
        iconId: r.reward.iconId,
        goldenPinFrame: r.reward.goldenPinFrame,
        label: r.reward.label,
      });
    } else if (r.error) {
      setMsg(r.error);
      setTimeout(() => setMsg(null), 2200);
    }
  };

  // The infinite track is conceptually endless — with a very large token
  // balance maxLevel can be tens of thousands. `infiniteRowCount` (computed
  // above) caps how many infinite rows exist; virtualization then keeps only a
  // window of them mounted so the 3D tile count stays constant.
  const infiniteRows = infiniteRowCount > 0
    ? Array.from({ length: infiniteRowCount }, (_, i) => PRO_STAR_PASS_MAX_LEVEL + i + 1)
    : [];

  const allLevels = [...levels, ...infiniteRows];

  return (
    <PageBg variant="clashpass" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHeader title={t("proPass.title")} onBack={onBack} />
      <PageBody
        style={{
          display: "flex",
          flexDirection: "row",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
          padding: 0,
          gap: 0,
        }}
      >
        {/* Left promo panel — ~30% */}
        <div
          style={{
            flex: "0 0 30%",
            maxWidth: "30%",
            minWidth: 200,
            height: "100%",
            boxSizing: "border-box",
            padding: "12px 14px 14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            overflow: "hidden",
            borderRight: "1px solid rgba(255,255,255,0.12)",
            background: "linear-gradient(180deg, rgba(255,234,0,0.12) 0%, rgba(0,0,0,0.35) 100%)",
          }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              position: "relative",
              borderRadius: 18,
              overflow: "hidden",
              background: "#1a0a3a",
              border: "2px solid rgba(255,213,79,0.45)",
              boxShadow: "0 12px 40px rgba(123,47,190,0.4), inset 0 2px 14px rgba(255,255,255,0.08)",
            }}
          >
            <PassInfoButton
              onClick={() => setShowDetails(true)}
              style={{ position: "absolute", top: 10, right: 10, zIndex: 8 }}
            />
            <img
              src={HERO_IMG}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center top",
                display: "block",
                zIndex: 0,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                height: "28%",
                background: "linear-gradient(180deg, rgba(10,0,24,0.72) 0%, transparent 100%)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: "48%",
                background: "linear-gradient(180deg, transparent 0%, rgba(10,0,24,0.55) 40%, rgba(10,0,24,0.88) 100%)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />

            <div
              style={{
                position: "absolute",
                top: 10,
                left: 0,
                right: 0,
                textAlign: "center",
                zIndex: 5,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(16px, 2vw, 22px)",
                  fontWeight: 900,
                  color: "#FFD740",
                  letterSpacing: "0.08em",
                  textShadow: "0 2px 8px rgba(0,0,0,0.9)",
                }}
              >
                <Tr id="proPass.badge" />
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.85)",
                  letterSpacing: "0.12em",
                  textShadow: "0 1px 4px rgba(0,0,0,0.85)",
                }}
              >
                <Tr id="proPass.season" />
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: hasPaid ? 10 : 0,
                zIndex: 6,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ margin: hasPaid ? "0 10px" : "0 10px 10px", width: "calc(100% - 20px)" }}>
                <ProPassTokenProgressBar
                  intoLevel={progress.intoLevel}
                  needed={progress.needed}
                  levelLabel={levelLabel}
                  variant="page"
                />
              </div>

              {!hasPaid ? (
                <button
                  type="button"
                  className="ui-btn ui-btn--primary"
                  style={{
                    width: "100%",
                    margin: 0,
                    borderRadius: 0,
                    fontWeight: 900,
                    fontSize: "clamp(11px, 1.2vw, 14px)",
                    padding: "12px 10px",
                    letterSpacing: "0.06em",
                    boxShadow: "0 -2px 12px rgba(0,0,0,0.35)",
                  }}
                  onClick={() => {
                    const r = buyProStarPass();
                    refresh();
                    setMsg(r.success ? t("proPass.purchased") : (r.error || t("common.error")));
                    setTimeout(() => setMsg(null), 2600);
                  }}
                >
                  <Tr id="proPass.activate" params={{ price: PRO_STAR_PASS_PRICE_RUB }} />
                </button>
              ) : (
                <div
                  style={{
                    margin: "0 10px 10px",
                    padding: "10px 8px",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 900,
                    color: "#c6ff00",
                    textAlign: "center",
                    background: "rgba(0,0,0,0.5)",
                    border: "1px solid rgba(118,255,3,0.35)",
                  }}
                >
                  <Tr id="proPass.active" />
                </div>
              )}
            </div>
          </div>

          <div style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}>
            <div><Tr id="proPass.hintWin" params={{ tokens: PRO_STAR_PASS_WIN_TOKENS }} /></div>
            <div style={{ marginTop: 4 }}><Tr id="proPass.hintTier" params={{ tokens: PRO_STAR_PASS_TIER_BONUS }} /></div>
            {hasPaid && (
              <div style={{ marginTop: 6, color: "#c6ff00", fontWeight: 900 }}>
                <Tr id="proPass.doubleTokens" />
              </div>
            )}
          </div>

          {msg && (
            <div style={{ flexShrink: 0, textAlign: "center", fontSize: 11, fontWeight: 800, color: "#ff8a80" }}>{msg}</div>
          )}
        </div>

        {/* Right track — ~70%, full height, horizontal scroll only */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: "8px 10px 10px 6px",
            boxSizing: "border-box",
          }}
        >
          <div
            ref={trackRef}
            style={{
              flex: 1,
              minHeight: 0,
              overflowX: "auto",
              overflowY: "hidden",
              WebkitOverflowScrolling: "touch",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "relative",
                height: "100%",
                minHeight: "100%",
                width: allLevels.length * COL_STRIDE,
                paddingBottom: 4,
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: COL_W / 2,
                  top: "50%",
                  transform: "translateY(-50%)",
                  height: 12,
                  borderRadius: 6,
                  background: "rgba(0,0,0,0.45)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  zIndex: 0,
                  width: `calc(${allLevels.length} * ${COL_W}px + ${(allLevels.length - 1) * COL_GAP}px)`,
                  pointerEvents: "none",
                }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: COL_W / 2,
                  top: "50%",
                  transform: "translateY(-50%)",
                  height: 12,
                  borderRadius: 6,
                  background: "linear-gradient(90deg, #c6ff00 0%, #FFD700 50%, #FF8A00 100%)",
                  boxShadow: "0 0 12px rgba(198,255,0,0.45)",
                  zIndex: 0,
                  width: `calc(((${allLevels.length} * ${COL_W}px + ${(allLevels.length - 1) * COL_GAP}px) * ${trackFillPct}) / 100)`,
                  maxWidth: `calc(${allLevels.length} * ${COL_W}px + ${(allLevels.length - 1) * COL_GAP}px)`,
                  transition: "width 0.5s ease-out",
                  pointerEvents: "none",
                }}
              />
              {allLevels.slice(vRange.start, vRange.end).map((lvl, i) => {
                const idx = vRange.start + i;
                const isInf = lvl > PRO_STAR_PASS_MAX_LEVEL;
                const reached = maxLevel >= lvl;
                const freeClaimed = isInf
                  ? (profile.proStarPassInfiniteClaimedFree ?? profile.proStarPassInfiniteClaimed ?? 0) >= lvl - PRO_STAR_PASS_MAX_LEVEL
                  : claimedFree.includes(lvl);
                const paidClaimed = isInf
                  ? (profile.proStarPassInfiniteClaimedPaid ?? 0) >= lvl - PRO_STAR_PASS_MAX_LEVEL
                  : claimedPaid.includes(lvl);
                const allClaimed = freeClaimed && (paidClaimed || !hasPaid);
                const nodeLabel = isInf ? `∞${lvl - PRO_STAR_PASS_MAX_LEVEL}` : lvl;

                return (
                  <div
                    key={lvl}
                    id={`pro-pass-lvl-${lvl}`}
                    style={{
                      position: "absolute",
                      left: idx * COL_STRIDE,
                      top: 0,
                      width: COL_W,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      height: "100%",
                      zIndex: 1,
                    }}
                  >
                    <RewardTile
                      reward={proStarPassPaidReward(lvl)}
                      reached={reached}
                      claimed={paidClaimed}
                      locked={!hasPaid}
                      premium
                      onClaim={() => showReward(claimProStarPassPaidReward(lvl))}
                    />
                    <LevelNode label={nodeLabel} reached={reached} claimed={allClaimed} />
                    <RewardTile
                      reward={proStarPassFreeReward(lvl)}
                      reached={reached}
                      claimed={freeClaimed}
                      locked={false}
                      premium={false}
                      onClaim={() => showReward(claimProStarPassReward(lvl))}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </PageBody>

      {pendingReward && (
        <RewardDropModal reward={pendingReward} onDone={() => setPendingReward(null)} />
      )}
      {showDetails && (
        <PassTrackDetailsModal
          variant="pro"
          tracks={passTrackDetails}
          onClose={() => setShowDetails(false)}
        />
      )}
    </PageBg>
  );
}
