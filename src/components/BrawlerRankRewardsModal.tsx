import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BRAWLERS } from "../entities/BrawlerData";
import {
  getCurrentProfile,
  getBrawlerTrophies,
  getBrawlerRank,
  getBrawlerRankClaimed,
  claimBrawlerRankReward,
  BRAWLER_RANK_TABLE,
  MAX_BRAWLER_RANK,
  type BrawlerRankReward,
} from "../utils/localStorageAPI";
import { CoinIcon, GemIcon, PowerIcon, TrophyIcon } from "./GameIcons";
import PinIcon from "./PinIcon";
import ChestVisual from "./ChestVisual";
import { getProfileIconImage } from "../utils/profileIconUtils";
import type { ChestRarity } from "../utils/chests";
import RewardDropModal, { type RewardInfo } from "./RewardDropModal";
import { brawlerRankRewardsScrollTarget } from "../utils/rewardTrackTargets";
import { RankBadgeIcon } from "./BrawlerRankBar";
import ModalCloseButton from "./ModalCloseButton";
import { useI18n, brawlerName, trackRewardLabel } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";
import {
  GLASS_THEMES,
  glassOverlayStyle,
  glassPanelStyle,
  glassRadialStyle,
} from "../utils/glassModalTheme";
import { PageBg, PageBody, PageHeader } from "./PageChrome";

const THEME = GLASS_THEMES.purple;
const ROW_HEIGHT = 54;
const ROW_GAP = 6;
const ROW_STRIDE = ROW_HEIGHT + ROW_GAP;
const VIRTUAL_OVERSCAN = 5;

interface Props {
  brawlerId: string;
  onClose: () => void;
  /** Full menu page (shop/trophy road pattern) — not a fixed overlay. */
  layout?: "modal" | "page";
}

function rewardIcon(
  type: string,
  opts?: { pinId?: string; chestRarity?: ChestRarity; iconId?: string },
): ReactNode {
  if (type === "coins") return <CoinIcon size={22} static />;
  if (type === "gems") return <GemIcon size={22} static />;
  if (type === "powerPoints") return <PowerIcon size={22} static />;
  if (type === "chest" && opts?.chestRarity) {
    return <ChestVisual rarity={opts.chestRarity} size={40} animated={false} />;
  }
  if (type === "pin" && opts?.pinId) {
    return <PinIcon pinId={opts.pinId} size={28} animated={false} />;
  }
  if (type === "profileIcon" && opts?.iconId) {
    return (
      <img
        src={getProfileIconImage(opts.iconId)}
        alt=""
        width={28}
        height={28}
        style={{ borderRadius: "50%", objectFit: "cover", border: "2px solid #CE93D8" }}
      />
    );
  }
  return "🎁";
}

interface RankRowProps {
  row: BrawlerRankReward;
  reached: boolean;
  claimed: boolean;
  canClaim: boolean;
  isCurrent: boolean;
  trophiesLabel: string;
  onClaim: (rank: number) => void;
  claimLabel: string;
  lockedLabel: string;
  claimedLabel: string;
}

const RankRewardRow = memo(function RankRewardRow({
  row,
  reached,
  claimed,
  canClaim,
  isCurrent,
  trophiesLabel,
  onClaim,
  claimLabel,
  lockedLabel,
  claimedLabel,
}: RankRowProps) {
  return (
    <div
      id={`brawler-rank-row-${row.rank}`}
      className="ui-glass"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        height: ROW_HEIGHT,
        padding: "0 14px",
        marginBottom: ROW_GAP,
        borderRadius: "var(--r-md)",
        background: claimed
          ? "linear-gradient(160deg, rgba(105,240,174,0.12), rgba(30,12,50,0.35))"
          : canClaim
            ? "linear-gradient(160deg, rgba(255,213,79,0.22), rgba(40,18,60,0.38))"
            : isCurrent
              ? "linear-gradient(160deg, rgba(138,43,226,0.18), rgba(30,12,50,0.32))"
              : "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(30,12,50,0.28))",
        border: `1px solid ${
          claimed
            ? "rgba(105,240,174,0.45)"
            : canClaim
              ? "var(--bd-gold)"
              : isCurrent
                ? "rgba(180,120,255,0.55)"
                : "var(--bd-1)"
        }`,
        opacity: reached || canClaim ? 1 : 0.58,
        boxShadow: isCurrent ? "0 0 18px rgba(138,43,226,0.35)" : undefined,
        contentVisibility: "auto",
        containIntrinsicSize: `${ROW_HEIGHT}px`,
      }}
    >
      <div style={{
        width: 44,
        height: 38,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <RankBadgeIcon rank={row.rank} size={36} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "white", display: "flex", alignItems: "center", gap: 5 }}>
          {rewardIcon(row.type, { pinId: row.pinId, chestRarity: row.chestRarity, iconId: row.iconId })}{" "}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {trackRewardLabel(row)}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: 4 }}>
          <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}><EmojiIcon emoji="🏆" size={24} /></span>
          {row.trophies} {trophiesLabel}
        </div>
      </div>
      {claimed ? (
        <div style={{ fontSize: 11, fontWeight: 800, color: "#A5D6A7", letterSpacing: 1 }}>{claimedLabel}</div>
      ) : (
        <button
          disabled={!canClaim}
          onClick={() => onClaim(row.rank)}
          className={`ui-btn ${canClaim ? "ui-btn--primary" : "ui-btn--ghost"}`}
          style={{
            padding: "7px 14px",
            fontSize: 11,
            letterSpacing: "0.08em",
            minWidth: 108,
          }}
        >
          {canClaim ? claimLabel : lockedLabel}
        </button>
      )}
    </div>
  );
});

function useVirtualRange(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  count: number,
  initialIndex: number,
) {
  const [range, setRange] = useState(() => {
    const start = Math.max(0, initialIndex - VIRTUAL_OVERSCAN);
    const end = Math.min(count, initialIndex + VIRTUAL_OVERSCAN + 12);
    return { start, end };
  });

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, (initialIndex - 1) * ROW_STRIDE);
  }, [initialIndex, scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const start = Math.max(0, Math.floor(el.scrollTop / ROW_STRIDE) - VIRTUAL_OVERSCAN);
      const visible = Math.ceil(el.clientHeight / ROW_STRIDE) + VIRTUAL_OVERSCAN * 2;
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
  }, [count, scrollRef]);

  return range;
}

export default function BrawlerRankRewardsModal({ brawlerId, onClose, layout = "modal" }: Props) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(getCurrentProfile());
  const [msg, setMsg] = useState("");
  const [pendingReward, setPendingReward] = useState<RewardInfo | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isPage = layout === "page";

  useEffect(() => {
    if (isPage) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [isPage]);

  const trophies = profile ? getBrawlerTrophies(profile, brawlerId) : 0;
  const claimedRanks = profile ? getBrawlerRankClaimed(profile, brawlerId) : [];
  const claimedSet = useMemo(() => new Set(claimedRanks), [claimedRanks.join(",")]);

  const scrollToRank = useMemo(
    () => (profile ? brawlerRankRewardsScrollTarget(trophies, claimedRanks) : 1),
    [profile, trophies, claimedRanks.join(",")],
  );

  const virtualRange = useVirtualRange(listRef, BRAWLER_RANK_TABLE.length, scrollToRank);
  const visibleRows = useMemo(
    () => BRAWLER_RANK_TABLE.slice(virtualRange.start, virtualRange.end),
    [virtualRange.start, virtualRange.end],
  );

  if (!profile) {
    if (isPage) {
      return (
        <PageBg variant="none" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
          <PageHeader onBack={onClose} title={t("char.rankRewards")} />
          <PageBody style={{ padding: 24 }}>{t("common.error")}</PageBody>
        </PageBg>
      );
    }
    return (
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 10050,
          ...glassOverlayStyle,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <ModalCloseButton onClick={onClose} style={{ top: 18, right: 18 }} />
      </div>
    );
  }
  const brawler = BRAWLERS.find(b => b.id === brawlerId) || BRAWLERS[0];
  const rank = getBrawlerRank(trophies);
  const level = profile.brawlerLevels[brawler.id] || 1;
  const totalHeight = BRAWLER_RANK_TABLE.length * ROW_STRIDE - ROW_GAP;
  const topSpacer = virtualRange.start * ROW_STRIDE;
  const bottomSpacer = Math.max(0, totalHeight - topSpacer - visibleRows.length * ROW_STRIDE);
  const pageTitle = t("char.rankRewardsTitle", { name: brawlerName(brawler.id, brawler.name), title: t("char.rankRewards") });

  const handleClaim = (r: number) => {
    const result = claimBrawlerRankReward(brawler.id, r);
    setProfile(getCurrentProfile());
    if (result.success && result.reward) {
      setPendingReward({
        type: result.reward.type as RewardInfo["type"],
        amount: result.reward.amount,
        pinId: result.reward.pinId,
        iconId: result.reward.iconId,
        label: trackRewardLabel(result.reward),
      });
    } else {
      setMsg(result.error || t("rank.claimFailed"));
      setTimeout(() => setMsg(""), 2500);
    }
  };

  const rankList = (
    <div
      ref={listRef}
      className="quest-scroll"
      style={{ flex: 1, overflowY: "auto", padding: 14, overscrollBehavior: "contain", minHeight: 0 }}
    >
      {topSpacer > 0 && <div style={{ height: topSpacer, flexShrink: 0 }} aria-hidden />}
      {visibleRows.map((row) => {
        const reached = trophies >= row.trophies;
        const claimed = claimedSet.has(row.rank);
        const canClaim = reached && !claimed;
        const isCurrent = row.rank === rank;
        return (
          <RankRewardRow
            key={row.rank}
            row={row}
            reached={reached}
            claimed={claimed}
            canClaim={canClaim}
            isCurrent={isCurrent}
            trophiesLabel={t("common.trophies")}
            onClaim={handleClaim}
            claimLabel={t("common.claim")}
            lockedLabel={t("rank.locked")}
            claimedLabel={t("common.claimed")}
          />
        );
      })}
      {bottomSpacer > 0 && <div style={{ height: bottomSpacer, flexShrink: 0 }} aria-hidden />}
    </div>
  );

  if (isPage) {
    return (
      <>
        <PageBg
          variant="rankRewards"
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "var(--app-font-sans)",
          }}
        >
          <PageHeader
            onBack={onClose}
            title={pageTitle}
            titleColor="#fff"
          />
          <div style={{ padding: "0 18px 8px", fontSize: 12, color: "rgba(255,255,255,0.55)", flexShrink: 0 }}>
            <TrophyIcon size={14} lite style={{ verticalAlign: "middle" }} />{" "}
            {t("char.rankMeta", { trophies, trophiesLabel: t("common.trophies"), rank, max: MAX_BRAWLER_RANK, level })}
          </div>
          {msg && (
            <div style={{
              padding: "8px 22px",
              background: "rgba(76,175,80,0.15)",
              color: "#A5D6A7",
              fontSize: 12,
              fontWeight: 700,
              borderBottom: "1px solid rgba(76,175,80,0.3)",
              flexShrink: 0,
            }}>
              {msg}
            </div>
          )}
          <PageBody style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", maxWidth: 720, width: "100%", margin: "0 auto" }}>
            {rankList}
          </PageBody>
        </PageBg>
        {pendingReward && (
          <RewardDropModal reward={pendingReward} onDone={() => setPendingReward(null)} />
        )}
      </>
    );
  }

  return (
    <>
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10050,
        ...glassOverlayStyle,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...glassPanelStyle(THEME, {
            width: "min(720px, 100%)",
            maxHeight: "min(80vh, 720px)",
            padding: 0,
          }),
        }}
      >
        <div style={glassRadialStyle(THEME)} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
          <div style={{
            padding: "16px 22px",
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexShrink: 0,
          }}>
            <div style={{ flex: 1, paddingRight: 40 }}>
              <div style={{
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 1,
                background: `linear-gradient(135deg, ${brawler.color}, #CE93D8)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                {pageTitle}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                <TrophyIcon size={14} lite style={{ verticalAlign: "middle" }} /> {t("char.rankMeta", { trophies, trophiesLabel: t("common.trophies"), rank, max: MAX_BRAWLER_RANK, level })}
              </div>
            </div>
            <ModalCloseButton onClick={onClose} style={{ top: 10, right: 10 }} />
          </div>

          {msg && (
            <div style={{
              padding: "8px 22px",
              background: "rgba(76,175,80,0.15)",
              color: "#A5D6A7",
              fontSize: 12,
              fontWeight: 700,
              borderBottom: "1px solid rgba(76,175,80,0.3)",
              flexShrink: 0,
            }}>
              {msg}
            </div>
          )}

          {rankList}
        </div>
      </div>
    </div>

    {pendingReward && (
      <RewardDropModal
        reward={pendingReward}
        onDone={() => setPendingReward(null)}
      />
    )}
  </>
  );
}
