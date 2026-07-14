import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCurrentProfile,
  clashPassXpForLevel,
  clashPassRewardForLevel,
  paidClashPassRewardForLevel,
  ultraClashPassRewardForLevel,
  claimClashPassReward,
  claimPaidClashPassReward,
  claimUltraClashPassReward,
  buyClashPass,
  buyClashPassUltra,
  buyXp,
  skipClashPassLevel,
  getNextClaimableInfiniteTier,
  infinitePassDealReward,
  claimInfinitePassReward,
  getClaimableQuestCount,
  getQuestPool,
  MAX_CLASHPASS_LEVEL,
  CLASH_PASS_PRICE_RUB,
  CLASH_PASS_ULTRA_PRICE_RUB,
  SKIP_PASS_LEVEL_GEM_COST,
  clashPassInfiniteTier,
  isClashPassInfinite,
  getPassDailyBattleXpStatus,
  PASS_DAILY_BATTLE_XP_FREE,
  PASS_DAILY_BATTLE_XP_PAID,
  type ClashPassReward,
  type InfinitePassChoice,
} from "../utils/localStorageAPI";
import { PROFILE_CLOUD_CHANGED } from "../utils/cloud/profileCloud";
import QuestsModal from "../components/QuestsModal";
import PassTrackDetailsModal, {
  PassInfoButton,
  preloadPassDetailsChestModelsFromTracks,
} from "../components/PassTrackDetailsModal";
import { clashPassTrackSummaries } from "../utils/passTrackSummary";
import {
  clashPassClaimFingerprint,
  useClaimRewardEnterSfx,
} from "../audio/claimRewardEnterSfx";
import ChestVisual from "../components/ChestVisual";
import { CoinIcon, GemIcon, PowerIcon } from "../components/GameIcons";
import PinIcon from "../components/PinIcon";
import { getProfileIconImage } from "../utils/profileIconUtils";
import RewardDropModal, { type RewardInfo } from "../components/RewardDropModal";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import VolProgressTrack from "../components/ui/VolProgressTrack";
import { useI18n, trackRewardLabel } from "../i18n";
import { useScrollToOnMount } from "../hooks/useScrollToOnMount";
import { clashPassScrollTarget } from "../utils/rewardTrackTargets";
import { EmojiIcon } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Props {
  onBack: () => void;
}

const XP_BUNDLES = [
  { xp: 200, gems: 10 },
  { xp: 600, gems: 25 },
  { xp: 1500, gems: 60 },
];

const TRACK_GRID = "1fr 70px 1fr 70px 1fr";
const ULTRA_GRADIENT = "linear-gradient(135deg, #FF1744 0%, #FFEA00 25%, #00E676 50%, #00B0FF 75%, #D500F9 100%)";
const LEVEL_COL_1 = "calc((100% - 180px) / 3 + 45px)";
const LEVEL_COL_2 = "calc((100% - 180px) * 2 / 3 + 135px)";

function LevelNode({
  label,
  reached,
  showCheck,
  isSkipTarget,
  canSkip,
  onSkip,
  isMilestone,
  dimmed,
  locked,
}: {
  label: string | number;
  reached: boolean;
  showCheck: boolean;
  isSkipTarget: boolean;
  canSkip: boolean;
  onSkip: () => void;
  isMilestone?: boolean;
  dimmed?: boolean;
  locked?: boolean;
}) {
  const { t } = useI18n();
  const size = isMilestone ? 52 : 44;

  if (isSkipTarget && !locked) {
    return (
      <button
        type="button"
        onClick={onSkip}
        disabled={!canSkip}
        title={t("pass.skipLevel", { level: label, gems: SKIP_PASS_LEVEL_GEM_COST })}
        className={`ui-btn ${canSkip ? "ui-btn--primary" : "ui-btn--ghost"}`}
        style={{
          width: size + 10,
          height: size + 10,
          minWidth: size + 10,
          borderRadius: "50%",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
          fontSize: 10,
          fontWeight: 900,
          lineHeight: 1,
          boxShadow: canSkip ? "0 0 18px rgba(255,213,79,0.55)" : undefined,
          position: "relative",
          zIndex: 2,
        }}
      >
        <GemIcon size={14} />
        <span>{SKIP_PASS_LEVEL_GEM_COST}</span>
      </button>
    );
  }

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: locked
        ? "linear-gradient(160deg, #2a1158 0%, #1a0a3a 100%)"
        : reached
          ? "linear-gradient(135deg, #ffe57f 0%, #ffd54f 50%, #ff8a00 100%)"
          : "linear-gradient(160deg, #1a1240 0%, #060119 100%)",
      border: `2px solid ${locked ? "rgba(213,0,249,0.55)" : reached ? "var(--c-gold-3)" : "var(--bd-2)"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 900,
      fontSize: locked ? (isMilestone ? 22 : 18) : isMilestone ? 16 : 14,
      color: locked ? "#D500F9" : reached ? "#1a0a3a" : "var(--t-3)",
      boxShadow: locked
        ? "0 0 12px rgba(213,0,249,0.35), inset 0 1px 0 rgba(255,255,255,0.08)"
        : reached
          ? "0 0 16px rgba(255,213,79,0.65), inset 0 1px 0 rgba(255,255,255,0.4)"
          : "var(--sh-sm), inset 0 1px 0 rgba(255,255,255,0.06)",
      opacity: dimmed ? 0.45 : 1,
      position: "relative",
      zIndex: 2,
      transition: "all var(--ease-mid)",
    }}>
      {locked ? <EmojiIcon emoji="🔒" size={24} /> : showCheck ? <EmojiIcon emoji="✓" size={24} /> : label}
    </div>
  );
}

function RandomRewardTile({
  variant,
  active,
  locked,
  onOpen,
}: {
  variant: "free" | "premium" | "ultra";
  active: boolean;
  locked?: boolean;
  onOpen?: () => void;
}) {
  const { t } = useI18n();
  const bg = variant === "ultra"
    ? ULTRA_GRADIENT
    : variant === "premium"
      ? "linear-gradient(135deg, rgba(255,215,0,0.16), rgba(255,138,0,0.1))"
      : "rgba(255,255,255,0.05)";
  const decos: { kind: "coin" | "gem" | "pp" | "chest" | "q"; x: string; y: string; rot: number }[] = [
    { kind: "coin", x: "8%", y: "14%", rot: -14 },
    { kind: "gem", x: "76%", y: "10%", rot: 12 },
    { kind: "pp", x: "12%", y: "68%", rot: 8 },
    { kind: "chest", x: "72%", y: "62%", rot: -10 },
    { kind: "q", x: "28%", y: "22%", rot: -5 },
    { kind: "q", x: "58%", y: "18%", rot: 10 },
    { kind: "q", x: "44%", y: "74%", rot: 0 },
  ];

  return (
    <button
      type="button"
      disabled={!active || locked}
      onClick={active && !locked && onOpen ? onOpen : undefined}
      style={{
        position: "relative",
        overflow: "hidden",
        ...card,
        padding: "14px 10px",
        minHeight: 118,
        background: active ? bg : "rgba(255,255,255,0.03)",
        border: variant === "premium"
          ? "1px solid rgba(255,213,79,0.35)"
          : variant === "ultra"
            ? "1px solid rgba(255,255,255,0.35)"
            : "1px solid var(--bd-1)",
        opacity: active ? 1 : 0.5,
        cursor: active && !locked ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
      }}
    >
      {variant === "ultra" && active && (
        <div style={{ position: "absolute", inset: 0, opacity: 0.35, background: ULTRA_GRADIENT, pointerEvents: "none" }} />
      )}
      {decos.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute", left: d.x, top: d.y,
            transform: `rotate(${d.rot}deg)`,
            opacity: 0.8, pointerEvents: "none",
          }}
        >
          {d.kind === "coin" && <CoinIcon size={28} />}
          {d.kind === "gem" && <GemIcon size={26} />}
          {d.kind === "pp" && <PowerIcon size={26} />}
          {d.kind === "chest" && <ChestVisual rarity="rare" size={46} />}
          {d.kind === "q" && (
            <span style={{
              fontSize: 22, fontWeight: 900,
              color: variant === "ultra" ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)",
            }}>?</span>
          )}
        </div>
      ))}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <div style={{
          fontSize: 10, fontWeight: 900, letterSpacing: "0.14em",
          color: variant === "ultra" ? "rgba(255,255,255,0.85)" : "var(--t-3)",
          marginBottom: 4,
        }}>
          ? ? ?
        </div>
        <div style={{
          fontSize: 12, fontWeight: 900, lineHeight: 1.25,
          color: variant === "ultra" ? "#fff" : variant === "premium" ? "#FFD700" : "#fff",
          textShadow: variant === "ultra" ? "0 1px 4px rgba(0,0,0,0.5)" : undefined,
        }}>
          <Tr id="pass.infinite.randomReward" />
        </div>
      </div>
      {locked && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 18,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, zIndex: 2,
        }}>
          <EmojiIcon emoji="🔒" size={24} />
        </div>
      )}
    </button>
  );
}

// ── Visual helpers for a reward (icon + color) ───────────────────────────────
function rewardColor(r: ClashPassReward): string {
  if (r.type === "gems") return "#40C4FF";
  if (r.type === "powerPoints") return "#CE93D8";
  if (r.type === "chest") return "#FF7043";
  if (r.type === "pin") return "#CE93D8";
  if (r.type === "profileIcon") return "#B388FF";
  return "#FFD700";
}
function RewardIcon({ r, size = 36, animated = false }: { r: ClashPassReward; size?: number; animated?: boolean }) {
  if (r.type === "chest" && r.chestRarity) {
    return <ChestVisual rarity={r.chestRarity} size={size + 16} animated={animated} />;
  }
  if (r.type === "gems") return <GemIcon size={size} static />;
  if (r.type === "powerPoints") return <PowerIcon size={size} static />;
  if (r.type === "pin" && r.pinId) {
    return <PinIcon pinId={r.pinId} size={size} glow />;
  }
  if (r.type === "profileIcon" && r.iconId) {
    return (
      <img
        src={getProfileIconImage(r.iconId)}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid #CE93D8" }}
      />
    );
  }
  return <CoinIcon size={size} static />;
}

// ── Single reward "tile" used on either side of the row ──────────────────────
function RewardTile({
  reward,
  reached,
  claimed,
  locked,
  premium,
  ultra,
  onClaim,
}: {
  reward: ClashPassReward;
  reached: boolean;
  claimed: boolean;
  locked: boolean;
  premium: boolean;
  ultra?: boolean;
  onClaim: () => void;
}) {
  const { t } = useI18n();
  const color = rewardColor(reward);
  const bg = ultra
    ? "linear-gradient(135deg, rgba(255,23,68,0.22), rgba(0,230,118,0.18), rgba(213,0,249,0.22))"
    : premium
      ? "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(184,134,11,0.18))"
      : "rgba(255,255,255,0.05)";
  const trackLabel = ultra
    ? t("pass.reward.ultra")
    : premium
      ? t("pass.reward.premium")
      : t("pass.reward.free");
  const canClaim = reached && !claimed && !locked;
  return (
    <div style={{
      position: "relative",
      background: reached ? bg : "rgba(255,255,255,0.03)",
      border: `1px solid ${reached ? (ultra ? "rgba(255,255,255,0.45)" : premium ? "var(--bd-gold)" : color + "55") : "var(--bd-1)"}`,
      borderRadius: "var(--r-md)",
      padding: "10px 12px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      opacity: reached ? 1 : 0.55,
      boxShadow: reached
        ? (ultra
          ? "0 0 20px rgba(213,0,249,0.35), var(--sh-sm)"
          : premium ? "0 0 16px rgba(255,213,79,0.25), var(--sh-sm)" : "var(--sh-sm)")
        : undefined,
      minHeight: 78,
      flexDirection: premium || ultra ? "row-reverse" : "row",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      overflow: "hidden",
    }}>
      {ultra && reached && (
        <div style={{
          position: "absolute", inset: 0, opacity: 0.35, pointerEvents: "none",
          background: ULTRA_GRADIENT,
        }} />
      )}
      <div style={{ width: 56, display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
        <RewardIcon r={reward} size={36} animated={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0, textAlign: premium || ultra ? "right" : "left", position: "relative", zIndex: 1 }}>
        <div className="ui-eyebrow" style={{
          color: ultra ? "#fff" : premium ? "var(--c-gold-3)" : "var(--t-3)",
          fontSize: 10,
          marginBottom: 2,
          textShadow: ultra ? "0 1px 4px rgba(0,0,0,0.6)" : undefined,
        }}>
          {trackLabel}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color, lineHeight: 1.25 }}>
          {trackRewardLabel(reward)}
        </div>
        <button
          onClick={onClaim}
          disabled={!canClaim}
          className={`ui-btn ui-btn--block ${
            !canClaim
              ? "ui-btn--ghost"
              : ultra
                ? "ui-btn--accent"
                : premium
                  ? "ui-btn--primary"
                  : "ui-btn--success"
          }`}
          style={{
            marginTop: 8,
            padding: "6px 14px",
            fontSize: 11,
            letterSpacing: "0.1em",
          }}
        >
          {claimed ? t("common.claimed") : locked ? <EmojiIcon emoji="🔒" size={21} /> : reached ? t("common.claim") : <EmojiIcon emoji="🔒" size={21} />}
        </button>
      </div>

      {locked && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 14,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, color: ultra ? "#D500F9" : "#FFD700",
          textShadow: "0 2px 6px rgba(0,0,0,0.7)",
          pointerEvents: "none",
          zIndex: 2,
        }}>
          <EmojiIcon emoji="🔒" size={24} />
        </div>
      )}
    </div>
  );
}

function InfinitePassChoiceModal({
  tier,
  gems,
  onChoose,
  onClose,
}: {
  tier: number;
  gems: number;
  onChoose: (choice: InfinitePassChoice) => void;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const deal = infinitePassDealReward(tier);
  const canAfford = gems >= deal.gemCost;

  const mysteryDecos: { kind: "coin" | "gem" | "pp" | "chest" | "q"; x: string; y: string; rot: number; size?: number }[] = [
    { kind: "coin", x: "4%", y: "8%", rot: -18, size: 30 },
    { kind: "gem", x: "80%", y: "6%", rot: 14, size: 28 },
    { kind: "pp", x: "6%", y: "68%", rot: 10, size: 28 },
    { kind: "chest", x: "74%", y: "62%", rot: -8, size: 48 },
    { kind: "q", x: "20%", y: "14%", rot: -6 },
    { kind: "q", x: "66%", y: "18%", rot: 12 },
    { kind: "q", x: "46%", y: "76%", rot: 0 },
  ];

  const renderPreview = (reward?: ClashPassReward, mystery?: boolean) => {
    if (mystery) {
      return (
        <div style={{
          width: 96, height: 96, borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          border: "2px dashed rgba(255,255,255,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 44, fontWeight: 900, color: "rgba(255,255,255,0.7)",
        }}>
          ?
        </div>
      );
    }
    if (!reward) return null;
    if (reward.type === "chest" && reward.chestRarity) {
      return <ChestVisual rarity={reward.chestRarity} size={84} animated />;
    }
    if (reward.type === "gems") return <GemIcon size={68} />;
    if (reward.type === "powerPoints") return <PowerIcon size={68} />;
    return <CoinIcon size={68} />;
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 999998,
        background: "radial-gradient(ellipse at 50% 40%, rgba(26,10,58,0.96), rgba(0,0,0,0.98))",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        fontFamily: "var(--app-font-sans)",
      }}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="ui-back-btn"
          style={{ position: "absolute", top: 18, left: 18, zIndex: 2 }}
        >
          ← <Tr id="common.back" />
        </button>
      )}
      <div
        style={{
          width: "min(520px, 100%)",
          borderRadius: 20,
          background: "linear-gradient(160deg, rgba(30,15,60,0.95), rgba(8,4,20,0.98))",
          border: "1px solid rgba(255,213,79,0.45)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.65), 0 0 40px rgba(255,213,79,0.15)",
          padding: "28px 24px 24px",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          textAlign: "center", fontSize: 22, fontWeight: 900,
          color: "#FFD700", letterSpacing: "0.06em", marginBottom: 8,
        }}>
          <Tr id="pass.infinite.modalTitle" params={{ tier }} />
        </div>
        <p style={{
          margin: "0 0 22px", textAlign: "center",
          color: "rgba(255,255,255,0.65)", fontSize: 13, lineHeight: 1.5,
        }}>
          <Tr id="pass.infinite.modalDesc" />
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{
            position: "relative", overflow: "hidden",
            padding: 16, borderRadius: 16,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            minHeight: 240,
          }}>
            {mysteryDecos.map((item, i) => (
              <div
                key={i}
                style={{
                  position: "absolute", left: item.x, top: item.y,
                  transform: `rotate(${item.rot}deg)`, opacity: 0.85, pointerEvents: "none",
                }}
              >
                {item.kind === "coin" && <CoinIcon size={item.size ?? 30} />}
                {item.kind === "gem" && <GemIcon size={item.size ?? 28} />}
                {item.kind === "pp" && <PowerIcon size={item.size ?? 28} />}
                {item.kind === "chest" && <ChestVisual rarity="epic" size={item.size ?? 48} />}
                {item.kind === "q" && (
                  <span style={{ fontSize: 24, fontWeight: 900, color: "rgba(255,255,255,0.55)" }}>?</span>
                )}
              </div>
            ))}
            <div style={{ position: "relative", zIndex: 1, fontSize: 11, fontWeight: 900, color: "var(--t-3)", letterSpacing: "0.08em" }}>
              ???
            </div>
            <div style={{ position: "relative", zIndex: 1 }}>{renderPreview(undefined, true)}</div>
            <div style={{ position: "relative", zIndex: 1, fontSize: 12, fontWeight: 800, color: "#fff", textAlign: "center" }}>
              <Tr id="pass.infinite.randomReward" />
            </div>
            <div style={{ position: "relative", zIndex: 1, fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
              <Tr id="pass.infinite.freeHint" />
            </div>
            <button
              type="button"
              onClick={() => onChoose("free")}
              className="ui-btn ui-btn--success ui-btn--block"
              style={{ position: "relative", zIndex: 1, fontSize: 12, padding: "10px 12px" }}
            >
              <Tr id="pass.infinite.chooseFree" />
            </button>
          </div>

          <div style={{
            position: "relative", overflow: "hidden",
            padding: 16, borderRadius: 16,
            background: "linear-gradient(135deg, rgba(255,215,0,0.14), rgba(255,138,0,0.08))",
            border: "1px solid rgba(255,213,79,0.4)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            minHeight: 240,
          }}>
            <div style={{ position: "relative", zIndex: 1 }}>{renderPreview(deal.reward)}</div>
            <div style={{ position: "relative", zIndex: 1, fontSize: 12, fontWeight: 800, color: "#FFD700", textAlign: "center" }}>
              {trackRewardLabel(deal.reward)}
            </div>
            <div style={{ position: "relative", zIndex: 1, fontSize: 11, color: "rgba(255,255,255,0.55)", textAlign: "center" }}>
              <Tr id="pass.infinite.dealHint" />
            </div>
            <button
              type="button"
              onClick={() => onChoose("deal")}
              disabled={!canAfford}
              className={`ui-btn ui-btn--block ${canAfford ? "ui-btn--primary" : "ui-btn--ghost"}`}
              style={{ position: "relative", zIndex: 1, fontSize: 12, padding: "10px 12px" }}
            >
              <Tr id="pass.infinite.chooseDeal" params={{ gems: deal.gemCost }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClashPassPage({ onBack }: Props) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(getCurrentProfile());
  const [msg, setMsg] = useState<string | null>(null);
  const [showQuests, setShowQuests] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const passTrackDetails = useMemo(() => clashPassTrackSummaries(), []);
  const [pendingReward, setPendingReward] = useState<RewardInfo | null>(null);
  const [infiniteModalTier, setInfiniteModalTier] = useState<number | null>(null);
  const lastAutoInfiniteTier = useRef<number | null>(null);
  const refresh = () => setProfile(getCurrentProfile());

  useClaimRewardEnterSfx("clashpass", clashPassClaimFingerprint(profile));

  useEffect(() => {
    void preloadPassDetailsChestModelsFromTracks(passTrackDetails);
    const p = getCurrentProfile();
    if (p) getPassDailyBattleXpStatus(p);
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

  useEffect(() => {
    if (!profile) return;
    const tier = getNextClaimableInfiniteTier(profile);
    if (tier == null && lastAutoInfiniteTier.current !== null) {
      lastAutoInfiniteTier.current = null;
      setInfiniteModalTier(null);
    }
  }, [profile?.clashPassLevel, profile?.clashPassInfiniteClaimed]);

  const passLevels = useMemo(
    () => Array.from({ length: MAX_CLASHPASS_LEVEL }, (_, i) => i + 1),
    [],
  );

  const scrollToLevel = useMemo(
    () => (profile ? clashPassScrollTarget(profile) : null),
    [
      profile?.clashPassLevel,
      profile?.clashPassClaimed,
      profile?.clashPassClaimedPaid,
      profile?.clashPassClaimedUltra,
      profile?.clashPassInfiniteClaimed,
      profile?.clashPassPaid,
      profile?.clashPassUltraPaid,
    ],
  );
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollTargetId =
    scrollToLevel === "infinite"
      ? "clash-pass-infinite"
      : scrollToLevel != null
        ? `clash-pass-lvl-${scrollToLevel}`
        : null;
  useScrollToOnMount(bodyRef, scrollTargetId);

  if (!profile) {
    return (
      <PageBg variant="clashpass" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
        <PageHeader onBack={onBack} title={t("pass.title")} />
        <PageBody style={{ padding: 24 }}><Tr id="common.error" /></PageBody>
      </PageBg>
    );
  }
  const pool = getQuestPool();
  const questClaimBadge = getClaimableQuestCount({ ...profile, questPool: pool ?? profile.questPool });

  const hasPaid = !!profile.clashPassPaid;
  const hasUltra = !!profile.clashPassUltraPaid;
  const claimedFree = profile.clashPassClaimed;
  const claimedPaid = profile.clashPassClaimedPaid || [];
  const claimedUltra = profile.clashPassClaimedUltra || [];
  const infiniteTier = clashPassInfiniteTier(profile.clashPassLevel);
  const nextInfiniteTier = getNextClaimableInfiniteTier(profile);

  const dailyBattleXp = getPassDailyBattleXpStatus(profile);
  const freeDailyPct = Math.round((dailyBattleXp.freeLeft / dailyBattleXp.freeMax) * 100);
  const paidDailyPct = dailyBattleXp.paidMax > 0
    ? Math.round((dailyBattleXp.paidLeft / dailyBattleXp.paidMax) * 100)
    : 0;
  const levelXpNeed = clashPassXpForLevel(profile.clashPassLevel);
  const xpProgress = Math.min(100, Math.round((profile.xp / levelXpNeed) * 100));
  const nextLevel = profile.clashPassLevel + 1;
  const canSkip = profile.gems >= SKIP_PASS_LEVEL_GEM_COST;
  const levelDisplay = isClashPassInfinite(profile.clashPassLevel)
    ? t("pass.infiniteLevel", { tier: infiniteTier })
    : t("pass.level", { level: profile.clashPassLevel });

  const verticalFillPct = profile.clashPassLevel >= MAX_CLASHPASS_LEVEL
    ? 100
    : Math.min(100, ((profile.clashPassLevel - 1) / (MAX_CLASHPASS_LEVEL - 1)) * 100);

  const handleClaimFree = (lvl: number) => {
    const r = claimClashPassReward(lvl);
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
    } else {
      setMsg(r.error || t("common.error"));
      setTimeout(() => setMsg(null), 2200);
    }
  };

  const handleClaimPaid = (lvl: number) => {
    const r = claimPaidClashPassReward(lvl);
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
    } else {
      setMsg(r.error || t("common.error"));
      setTimeout(() => setMsg(null), 2200);
    }
  };

  const handleClaimUltra = (lvl: number) => {
    const r = claimUltraClashPassReward(lvl);
    refresh();
    if (r.success && r.reward) {
      setPendingReward({
        type: r.reward.type as RewardInfo["type"],
        amount: r.reward.amount,
        chestRarity: r.reward.chestRarity,
        label: r.reward.label,
      });
    } else {
      setMsg(r.error || t("common.error"));
      setTimeout(() => setMsg(null), 2200);
    }
  };

  const handleClaimInfinite = (tier: number, choice: InfinitePassChoice) => {
    const r = claimInfinitePassReward(tier, choice);
    refresh();
    if (r.success && r.reward) {
      lastAutoInfiniteTier.current = null;
      setInfiniteModalTier(null);
      setPendingReward({
        type: r.reward.type as RewardInfo["type"],
        amount: r.reward.amount,
        chestRarity: r.reward.chestRarity,
        label: r.reward.label,
      });
    } else {
      setMsg(r.error || t("common.error"));
      setTimeout(() => setMsg(null), 2200);
    }
  };

  const openInfiniteModal = () => {
    if (nextInfiniteTier != null) setInfiniteModalTier(nextInfiniteTier);
  };

  const handleBuyXp = (xp: number, gems: number) => {
    const r = buyXp(xp, gems);
    setMsg(r.success ? t("pass.xpGained", { xp }) : (r.error || t("common.error")));
    refresh();
    setTimeout(() => setMsg(null), 2200);
  };

  const handleBuyPass = () => {
    const r = buyClashPass();
    refresh();
    setMsg(r.success ? t("pass.purchased") : (r.error || t("common.error")));
    setTimeout(() => setMsg(null), 2600);
  };

  const handleBuyUltraPass = () => {
    const r = buyClashPassUltra();
    refresh();
    setMsg(r.success ? t("pass.ultra.purchased") : (r.error || t("common.error")));
    setTimeout(() => setMsg(null), 2600);
  };

  const handleSkipLevel = () => {
    const target = nextLevel;
    const r = skipClashPassLevel();
    refresh();
    setMsg(r.success ? t("pass.level", { level: target }) : (r.error || t("common.error")));
    setTimeout(() => setMsg(null), 2200);
  };

  const renderLevelColumn = (
    lvl: number,
    reached: boolean,
    allClaimed: boolean,
    isMilestone: boolean,
    locked = false,
  ) => (
    <LevelNode
      label={lvl}
      reached={reached}
      showCheck={reached && allClaimed}
      isSkipTarget={lvl === nextLevel}
      canSkip={canSkip}
      onSkip={handleSkipLevel}
      isMilestone={isMilestone}
      locked={locked}
    />
  );

  const dailyXpHeaderStrip = (
    <div style={{
      padding: "10px 14px",
      borderRadius: "var(--r-md)",
      background: "linear-gradient(135deg, rgba(255,213,79,0.2) 0%, rgba(255,138,0,0.08) 100%)",
      border: "1px solid rgba(255,213,79,0.5)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", color: "#FFD700" }}>
          <Tr id="pass.dailyXp" />
        </span>
        {(dailyBattleXp.freeLeft <= 0 && (!dailyBattleXp.hasPaid || dailyBattleXp.paidLeft <= 0)) && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}><Tr id="common.tomorrow" /></span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: dailyBattleXp.hasPaid ? "1fr 1fr" : "1fr", gap: 12 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: "rgba(255,255,255,0.7)" }}><Tr id="pass.dailyFree" /></span>
            <span style={{ fontWeight: 900, color: "#fff" }}>{dailyBattleXp.freeLeft}/{PASS_DAILY_BATTLE_XP_FREE} ⭐</span>
          </div>
          <VolProgressTrack
            fitHeight={14}
            fill={freeDailyPct}
            fillBackground="linear-gradient(90deg,#FFD700,#FF8A00)"
          />
        </div>
        {dailyBattleXp.hasPaid && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "#FFD700" }}><Tr id="pass.dailyPaid" /></span>
              <span style={{ fontWeight: 900, color: "#FFD700" }}>{dailyBattleXp.paidLeft}/{PASS_DAILY_BATTLE_XP_PAID} ⭐</span>
            </div>
            <VolProgressTrack
              fitHeight={14}
              fill={paidDailyPct}
              fillBackground="linear-gradient(90deg,#FFE57F,#FFD700)"
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <PageBg variant="clashpass" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
      <PageHeader
        onBack={onBack}
        title={t("pass.title")}
        bottom={dailyXpHeaderStrip}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PassInfoButton onClick={() => setShowDetails(true)} />
            <button
              onClick={() => setShowQuests(true)}
              className="ui-btn ui-btn--primary"
              style={{ position: "relative", padding: "8px 16px", fontSize: 13 }}
            >
              <Tr id="pass.quests" />
              {questClaimBadge > 0 && (
                <span className="ui-badge" style={{ position: "static", marginLeft: 4, animation: "none" }}>
                  {questClaimBadge > 99 ? "99+" : questClaimBadge}
                </span>
              )}
            </button>
          </div>
        }
      />
      <PageBody ref={bodyRef} style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 40px", zIndex: 1 }}>
        <p style={{ textAlign: "center", color: "var(--t-3)", marginTop: 0, marginBottom: 8, fontSize: 13, letterSpacing: "0.04em" }}>
          <Tr id="pass.subtitle" />
        </p>

        {/* Progress card */}
        <div style={{ ...card, marginTop: 12, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#FFD700" }}>{levelDisplay}</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 4 }}>
                <Tr id="pass.xpProgress" params={{ current: profile.xp, need: levelXpNeed }} />
              </div>
            </div>
            <div style={{ color: "#40C4FF", fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}>
              <GemIcon size={22} /> {profile.gems}
            </div>
          </div>
          <VolProgressTrack fitHeight={22} fill={xpProgress} style={{ marginTop: 14 }} />

          {/* XP shop */}
          <div style={{ marginTop: 18 }}>
            <div className="ui-section-title">
              <Tr id="pass.buyXp" />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {XP_BUNDLES.map(b => (
                <button
                  key={b.xp}
                  onClick={() => handleBuyXp(b.xp, b.gems)}
                  disabled={profile.gems < b.gems}
                  className={`ui-btn ${profile.gems >= b.gems ? "ui-btn--accent" : "ui-btn--ghost"}`}
                  style={{
                    flex: 1, minWidth: 140,
                    padding: "12px 14px",
                    fontSize: 14,
                    letterSpacing: "0.04em",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    +{b.xp} ⭐ <span style={{ opacity: 0.8 }}><Tr id="common.for" /></span> <GemIcon size={16} /> {b.gems}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {msg && (
            <div className="ui-glass" style={{
              marginTop: 12,
              padding: "8px 14px",
              color: "var(--c-gold-3)",
              fontWeight: 800, textAlign: "center",
              letterSpacing: "0.04em",
            }}>{msg}</div>
          )}
        </div>

        {/* Buy banner — only when paid pass NOT yet purchased */}
        {!hasPaid && (
          <div style={{
            marginTop: 18,
            padding: "18px 22px",
            borderRadius: "var(--r-xl)",
            background: "linear-gradient(135deg, #B8860B 0%, #FFD700 45%, #FF8A00 100%)",
            color: "#1a0a3a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            border: "1px solid rgba(255,255,255,0.42)",
            boxShadow: "0 16px 44px rgba(255,138,0,0.45), inset 0 1px 0 rgba(255,255,255,0.45)",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ flex: 1, minWidth: 240, position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.06em" }}>
                <Tr id="pass.premium.title" />
              </div>
              <div style={{ fontSize: 13, marginTop: 4, opacity: 0.88, lineHeight: 1.45 }}>
                <Tr id="pass.premium.desc" />
              </div>
            </div>
            <button
              onClick={handleBuyPass}
              style={{
                background: "linear-gradient(160deg, #1a0a3a 0%, #2a1158 100%)",
                color: "var(--c-gold-3)",
                padding: "14px 28px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--bd-gold)",
                fontWeight: 900,
                fontSize: 17,
                letterSpacing: "0.12em",
                cursor: "pointer",
                animation: "none",
                boxShadow: "0 8px 22px rgba(0,0,0,0.45), 0 0 24px rgba(255,213,79,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <Tr id="pass.premium.buy" params={{ price: CLASH_PASS_PRICE_RUB }} />
            </button>
          </div>
        )}
        {hasPaid && (
          <div style={{
            marginTop: 18, padding: "12px 18px", borderRadius: 14,
            background: "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,138,0,0.18))",
            border: "1.5px solid #FFD700",
            color: "#FFD700", fontWeight: 900, textAlign: "center", letterSpacing: 0.5,
          }}>
            <Tr id="pass.premium.active" />
          </div>
        )}

        {!hasUltra && (
          <div style={{
            marginTop: 18,
            padding: "18px 22px",
            borderRadius: "var(--r-xl)",
            background: ULTRA_GRADIENT,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
            border: "1px solid rgba(255,255,255,0.42)",
            boxShadow: "0 16px 44px rgba(213,0,249,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ flex: 1, minWidth: 240, position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.06em", textShadow: "0 2px 8px rgba(0,0,0,0.45)" }}>
                <Tr id="pass.ultra.title" />
              </div>
              <div style={{ fontSize: 13, marginTop: 4, opacity: 0.92, lineHeight: 1.45, textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
                <Tr id="pass.ultra.desc" />
              </div>
            </div>
            <button
              onClick={handleBuyUltraPass}
              style={{
                background: "linear-gradient(160deg, #1a0a3a 0%, #2a1158 100%)",
                color: "#fff",
                padding: "14px 28px",
                borderRadius: "var(--r-md)",
                border: "1px solid rgba(255,255,255,0.45)",
                fontWeight: 900,
                fontSize: 17,
                letterSpacing: "0.12em",
                cursor: "pointer",
                boxShadow: "0 8px 22px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
              }}
            >
              <Tr id="pass.ultra.buy" params={{ price: CLASH_PASS_ULTRA_PRICE_RUB }} />
            </button>
          </div>
        )}
        {hasUltra && (
          <div style={{
            marginTop: 18, padding: "12px 18px", borderRadius: 14,
            background: ULTRA_GRADIENT,
            border: "1.5px solid rgba(255,255,255,0.45)",
            color: "#fff", fontWeight: 900, textAlign: "center", letterSpacing: 0.5,
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}>
            <Tr id="pass.ultra.active" />
          </div>
        )}

        {/* Tracks header */}
        <div style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns: TRACK_GRID,
          gap: 10,
          alignItems: "center",
        }}>
          <div style={{
            textAlign: "center", fontWeight: 900, letterSpacing: 1.5, fontSize: 13,
            padding: "10px 0", borderRadius: 10,
            background: "rgba(0,0,0,0.25)", color: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <Tr id="pass.track.free" />
          </div>
          <div style={{
            textAlign: "center", fontWeight: 900, fontSize: 13,
            color: "rgba(255,255,255,0.7)", letterSpacing: 1,
          }}>
            <Tr id="common.levelShort" />
          </div>
          <div style={{
            textAlign: "center", fontWeight: 900, letterSpacing: 1.5, fontSize: 13,
            padding: "10px 0", borderRadius: 10,
            background: "linear-gradient(135deg, #FFD700, #FF8A00)",
            color: "#1a0a3a",
            border: "1px solid rgba(255,255,255,0.3)",
          }}>
            <Tr id="pass.track.premium" />
          </div>
          <div style={{
            textAlign: "center", fontWeight: 900, fontSize: 13,
            color: "rgba(255,255,255,0.7)", letterSpacing: 1,
          }}>
            <Tr id="common.levelShort" />
          </div>
          <div style={{
            textAlign: "center", fontWeight: 900, letterSpacing: 1.5, fontSize: 13,
            padding: "10px 0", borderRadius: 10,
            background: ULTRA_GRADIENT,
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.35)",
            textShadow: "0 1px 4px rgba(0,0,0,0.45)",
          }}>
            <Tr id="pass.track.ultra" />
          </div>
        </div>

        {/* Vertical track with center bar that fills by level */}
        <div style={{ position: "relative", marginTop: 10 }}>
          {[LEVEL_COL_1, LEVEL_COL_2].map((left, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left,
                transform: "translateX(-50%)",
                top: 22,
                bottom: 22,
                width: 16,
                zIndex: 0,
              }}
            >
              <VolProgressTrack
                orientation="vertical"
                fitWidth={10}
                fill={verticalFillPct}
                fillBackground="linear-gradient(180deg, #FFD700 0%, #FF8A00 50%, #B8860B 100%)"
                style={{ height: "100%" }}
              />
            </div>
          ))}

          {passLevels.map(lvl => {
            const free = clashPassRewardForLevel(lvl);
            const paid = paidClashPassRewardForLevel(lvl);
            const ultra = ultraClashPassRewardForLevel(lvl);
            const reached = profile.clashPassLevel >= lvl;
            const freeClaimed = claimedFree.includes(lvl);
            const paidClaimed = claimedPaid.includes(lvl);
            const ultraClaimed = claimedUltra.includes(lvl);
            const isMilestone = lvl % 10 === 0;
            const allClaimed = freeClaimed
              && (paidClaimed || !hasPaid)
              && (ultraClaimed || !hasUltra);
            return (
              <div
                key={lvl}
                id={`clash-pass-lvl-${lvl}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: TRACK_GRID,
                  gap: 10,
                  alignItems: "stretch",
                  marginBottom: 10,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <RewardTile
                  reward={free}
                  reached={reached}
                  claimed={freeClaimed}
                  locked={false}
                  premium={false}
                  onClaim={() => handleClaimFree(lvl)}
                />

                <div style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}>
                  {renderLevelColumn(lvl, reached, allClaimed, isMilestone, false)}
                </div>

                <RewardTile
                  reward={paid}
                  reached={reached}
                  claimed={paidClaimed}
                  locked={!hasPaid}
                  premium={true}
                  onClaim={() => handleClaimPaid(lvl)}
                />

                <div style={{
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}>
                  {renderLevelColumn(lvl, reached, allClaimed, isMilestone, !hasUltra)}
                </div>

                <RewardTile
                  reward={ultra}
                  reached={reached}
                  claimed={ultraClaimed}
                  locked={!hasUltra}
                  premium={false}
                  ultra
                  onClaim={() => handleClaimUltra(lvl)}
                />
              </div>
            );
          })}

          {/* Infinite level row — always visible at the end of all tracks */}
          <div
            id="clash-pass-infinite"
            style={{
              display: "grid",
              gridTemplateColumns: TRACK_GRID,
              gap: 10,
              alignItems: "stretch",
              marginBottom: 10,
              marginTop: 6,
              position: "relative",
              zIndex: 1,
            }}
          >
            <RandomRewardTile
              variant="free"
              active={profile.clashPassLevel >= MAX_CLASHPASS_LEVEL}
              onOpen={openInfiniteModal}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LevelNode
                label={nextLevel > MAX_CLASHPASS_LEVEL ? `∞${Math.max(1, nextLevel - MAX_CLASHPASS_LEVEL)}` : "∞"}
                reached={profile.clashPassLevel >= MAX_CLASHPASS_LEVEL}
                showCheck={false}
                isSkipTarget={nextLevel > MAX_CLASHPASS_LEVEL}
                canSkip={canSkip}
                onSkip={handleSkipLevel}
                isMilestone
                dimmed={profile.clashPassLevel < MAX_CLASHPASS_LEVEL}
              />
            </div>

            <RandomRewardTile
              variant="premium"
              active={profile.clashPassLevel >= MAX_CLASHPASS_LEVEL}
              locked={!hasPaid}
              onOpen={openInfiniteModal}
            />

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LevelNode
                label={nextLevel > MAX_CLASHPASS_LEVEL ? `∞${Math.max(1, nextLevel - MAX_CLASHPASS_LEVEL)}` : "∞"}
                reached={profile.clashPassLevel >= MAX_CLASHPASS_LEVEL}
                showCheck={false}
                isSkipTarget={nextLevel > MAX_CLASHPASS_LEVEL}
                canSkip={canSkip}
                onSkip={handleSkipLevel}
                isMilestone
                dimmed={profile.clashPassLevel < MAX_CLASHPASS_LEVEL}
                locked={!hasUltra}
              />
            </div>

            <RandomRewardTile
              variant="ultra"
              active={profile.clashPassLevel >= MAX_CLASHPASS_LEVEL}
              locked={!hasUltra}
              onOpen={openInfiniteModal}
            />
          </div>
        </div>
      </PageBody>
      {showQuests && <QuestsModal onClose={() => { setShowQuests(false); refresh(); }} />}
      {showDetails && (
        <PassTrackDetailsModal
          variant="clash"
          tracks={passTrackDetails}
          onClose={() => setShowDetails(false)}
        />
      )}
      {infiniteModalTier != null && (
        <InfinitePassChoiceModal
          tier={infiniteModalTier}
          gems={profile.gems}
          onChoose={(choice) => handleClaimInfinite(infiniteModalTier, choice)}
          onClose={() => setInfiniteModalTier(null)}
        />
      )}
      {pendingReward && (
        <RewardDropModal
          reward={pendingReward}
          onDone={() => setPendingReward(null)}
        />
      )}
    </PageBg>
  );
}

const card: React.CSSProperties = {
  background: "var(--surf-glass)",
  border: "1px solid var(--bd-1)",
  borderRadius: 18,
  backdropFilter: "blur(14px) saturate(1.15)",
  WebkitBackdropFilter: "blur(14px) saturate(1.15)",
  boxShadow: "var(--sh-md)",
};
