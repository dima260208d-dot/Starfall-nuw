import { useState, useEffect, useRef, useLayoutEffect, useMemo, type ReactNode } from "react";
import BrawlerViewer3D from "./BrawlerViewer3D";
import { getBrawlerRank, getBrawlerTrophies, getCurrentProfile } from "../utils/localStorageAPI";
import { queueMenuTrophyFx } from "../utils/trophyMenuFx";
import { queueMenuPassXpFx } from "../utils/passMenuFx";
import { queueMenuRankedCupFx } from "../utils/rankedCupMenuFx";
import { queueMenuProPassTokenFx } from "../utils/proPassTokenMenuFx";
import BrawlerRankBar from "./BrawlerRankBar";
import RankedLeagueBar from "./RankedLeagueBar";
import BrawlerMasteryBar from "./BrawlerMasteryBar";
import PlayerMasteryTitle from "./PlayerMasteryTitle";
import { TrophyIcon, PassXpIcon } from "./GameIcons";
import TrophyFlyBurst from "./TrophyFlyBurst";
import PassXpFlyBurst from "./PassXpFlyBurst";
import MasteryXpFlyBurst from "./MasteryXpFlyBurst";
import RankedCupFlyBurst from "./RankedCupFlyBurst";
import ProPassTokenFlyBurst from "./ProPassTokenFlyBurst";
import { getProfileRankedCups, getProfileRankedPeakCups } from "../utils/rankedProgress";
import { queueMenuMasteryXpFx } from "../utils/masteryMenuFx";
import { getBrawlerMasteryXp } from "../utils/brawlerMasteryStorage";
import { MENU_RANK_BADGE_SCALE } from "../utils/brawlerRankUI";
import { BRAWLERS } from "../entities/BrawlerData";
import type { GameParticipant, ParticipantBattleStats } from "../types/gameResult";
import { normalizeMatchStats } from "../utils/matchStats";
import { loadResourceListIcons } from "../utils/resourceListIconCache";
import {
  battleTitleI18nKey,
  computeBattleTitles,
  participantResultKey,
  type BattleTitleKind,
} from "../utils/battleResultTitles";

export type { GameParticipant };

import type { GrantBossRaidRewardResult } from "../utils/bossRaidRewards";
import PartyPlayAgainPanel from "./PartyPlayAgainPanel";
import type { PartyPlayAgainPanelMember } from "../utils/social/partyBattle";
import { useI18n } from "../i18n";
import { playResultsVoice } from "../audio/voiceLineService";
import WinStreakFlame, { WinStreakBonus } from "./WinStreakFlame";
import { isWinStreakVisible } from "../utils/winStreak";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";
import ResultReportFlow from "./ResultReportFlow";

interface ResultScreenProps {
  won: boolean;
  mode: string;
  participants: GameParticipant[];
  result: {
    trophyDelta: number;
    xpGained: number;
    place: number;
    winStreak?: number;
    winStreakBonus?: number;
    masteryXpGained?: number;
    masteryLeaderBonus?: number;
    monsterKillTrophyBonus?: number;
    rankedCupDelta?: number;
    rankedBattle?: boolean;
    proStarPassTokensGained?: number;
  } | null;
  matchStats: { damageDealt: number; healingDone: number; superUses: number; killCount: number; powerCubesCollected: number; deaths: number };
  questDeltas: Array<{ description: string; before: number; after: number; target: number; delta: number }>;
  bossRaidGrant?: GrantBossRaidRewardResult | null;
  playAgainLabel?: string;
  playAgainDisabled?: boolean;
  partyPlayAgainMembers?: PartyPlayAgainPanelMember[];
  partyPlayAgainSecondsLeft?: number;
  partyPlayAgainActive?: boolean;
  canShareBattle?: boolean;
  replayReady?: boolean;
  battleShared?: boolean;
  onShareBattle?: () => { success: boolean; error?: string };
  /** Просмотр чужого боя / повтора — только экран команд, без наград. */
  observerMode?: boolean;
  playerMapBattle?: boolean;
  playerMapName?: string;
  playerMapAuthor?: string;
  playerMapVoted?: boolean;
  onPlayerMapLike?: () => void;
  onPlayerMapDislike?: () => void;
  onExit: () => void;
  onPlayAgain: () => void;
}

function TrophyStatInline({
  trophies,
  fontSize = 16,
  iconSize,
  showRank = true,
}: {
  trophies: number;
  fontSize?: number;
  iconSize?: number;
  showRank?: boolean;
}) {
  const icon = iconSize ?? Math.max(12, Math.round(fontSize * 0.95));
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize,
      color: "#ffd700",
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}>
      <TrophyIcon size={icon} lite />
      {trophies}
      {showRank ? ` • R${getBrawlerRank(trophies)}` : ""}
    </span>
  );
}

function MonsterKillBonusBar({
  count,
  label,
}: {
  count: number;
  label: string;
}) {
  if (count <= 0) return null;
  return (
    <div style={{
      position: "absolute",
      top: 10,
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 40,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 16px",
      borderRadius: 999,
      background: "rgba(20,12,40,0.82)",
      border: "1px solid rgba(171,71,188,0.55)",
      boxShadow: "0 4px 18px rgba(0,0,0,0.45)",
      pointerEvents: "none",
    }}>
      <span style={{ fontSize: 15, fontWeight: 800, color: "#E1BEE7", letterSpacing: 0.3 }}>
        {label}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 16, fontWeight: 900, color: "#ffd700" }}>
        <TrophyIcon size={18} lite />
        +{count}
      </span>
    </div>
  );
}

function TrophyDeltaLine({
  label,
  color,
  fontSize = 28,
  iconSize,
}: {
  label: string;
  color: string;
  fontSize?: number;
  iconSize?: number;
}) {
  const trophySize = iconSize ?? Math.round(fontSize * 0.92);
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      fontSize,
      fontWeight: 800,
      color,
      textShadow: `0 0 16px ${color}`,
      marginTop: 8,
    }}>
      <TrophyIcon size={trophySize} />
      {label}
    </div>
  );
}

/** Corner wedge — darkest; backgrounds use the same hues, slightly brighter. */
const RESULT_WEDGE_WIN_TOP = "#0058a8";
const RESULT_WEDGE_WIN_BOTTOM = "#003366";
const RESULT_WEDGE_LOSE_TOP = "#a82828";
const RESULT_WEDGE_LOSE_BOTTOM = "#5c1010";

const RESULT_WIN_BG = "linear-gradient(170deg, #006ab8 0%, #004478 100%)";
const RESULT_LOSE_BG = "linear-gradient(170deg, #b83838 0%, #701818 100%)";
const RESULT_DUAL_BG = "linear-gradient(90deg, #006ab8 0%, #004478 50%, #b83838 50%, #701818 100%)";
const RESULT_WIN_GLOW = "radial-gradient(circle, rgba(0, 106, 184, 0.32) 0%, transparent 70%)";
const RESULT_LOSE_GLOW = "radial-gradient(circle, rgba(184, 56, 56, 0.32) 0%, transparent 70%)";

/** Brawl-style top-left wedge behind victory/defeat on dual-team results. */
function ResultOutcomeBanner({
  won,
  revealed,
  children,
}: {
  won: boolean;
  revealed: boolean;
  children: ReactNode;
}) {
  const wedgeTop = won ? RESULT_WEDGE_WIN_TOP : RESULT_WEDGE_LOSE_TOP;
  const wedgeBottom = won ? RESULT_WEDGE_WIN_BOTTOM : RESULT_WEDGE_LOSE_BOTTOM;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 4,
        pointerEvents: "none",
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateX(0)" : "translateX(-40px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 580,
          height: 210,
          background: `linear-gradient(160deg, ${wedgeTop} 0%, ${wedgeBottom} 72%)`,
          clipPath: "polygon(0 0, 96% 0, 72% 100%, 0 100%)",
          boxShadow: "inset -6px -10px 28px rgba(0,0,0,0.4)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 420,
          height: 168,
          background: won ? "rgba(0,70,140,0.38)" : "rgba(120,18,18,0.38)",
          clipPath: "polygon(0 0, 90% 0, 60% 100%, 0 100%)",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, padding: "18px 108px 26px 36px" }}>
        {children}
      </div>
    </div>
  );
}

const isTeamMode = (mode: string) =>
  ["gemgrab", "heist", "crystals", "siege", "starstrike", "bounty", "monsterhide", "monsterInvasion"].includes(mode);

/** Результат рейда: визуальный масштаб GLB в колонке (CSS scale, origin снизу). */
const BOSS_RAID_RESULT_MODEL_SCALE = 2.25;

function formatStatInt(n: number): string {
  const v = Math.round(Number(n) || 0);
  if (!Number.isFinite(v)) return "0";
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  return String(v);
}

const EMPTY_BATTLE_STATS: ParticipantBattleStats = {
  deaths: 0,
  kills: 0,
  damageDealt: 0,
  healingDone: 0,
};

function resolveBattleStats(p: GameParticipant): ParticipantBattleStats {
  const s = p.battleStats;
  if (!s) return EMPTY_BATTLE_STATS;
  return {
    deaths: Number(s.deaths) || 0,
    kills: Number(s.kills) || 0,
    damageDealt: Number(s.damageDealt) || 0,
    healingDone: Number(s.healingDone) || 0,
  };
}

function getBrawlerColor(brawlerId: string): string {
  return BRAWLERS.find(b => b.id === brawlerId)?.color ?? "#7b2fbe";
}

interface QuestDelta {
  description: string;
  before: number;
  after: number;
  target: number;
  delta: number;
}

function ParticipantBattleStatsTable({
  stats,
  compact,
  maxWidth,
}: {
  stats: import("../types/gameResult").ParticipantBattleStats;
  compact?: boolean;
  maxWidth?: number;
}) {
  const { t } = useI18n();
  const fs = compact ? 18 : 20;
  const row = (icon: ReactNode, label: string, value: number) => (
    <div
      key={label}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        lineHeight: 1.2,
        color: "rgba(255,255,255,0.9)",
        width: "100%",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ opacity: 0.85, display: "inline-flex", alignItems: "center", gap: 6 }}>{icon} {label}</span>
      <span style={{ fontWeight: 800, color: "#fff", flexShrink: 0 }}>{formatStatInt(value)}</span>
    </div>
  );
  return (
    <div
      style={{
        marginTop: 4,
        width: "fit-content",
        minWidth: compact ? 170 : 184,
        maxWidth: maxWidth,
        boxSizing: "border-box",
        padding: compact ? "6px 10px" : "7px 12px",
        borderRadius: 8,
        background: "transparent",
        border: "1.5px solid rgba(255,255,255,0.55)",
        boxShadow: "none",
        fontSize: fs,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        zIndex: 6,
      }}
    >
      {row(<EmojiIcon emoji="💀" size={21} />, t("result.battleStats.deaths"), stats.deaths)}
      {row(<EmojiIcon emoji="🎯" size={21} />, t("result.battleStats.kills"), stats.kills)}
      {row(<EmojiIcon emoji="⚔️" size={21} />, t("result.battleStats.damage"), stats.damageDealt)}
      {stats.healingDone > 0
        ? row(<EmojiIcon emoji="💚" size={21} />, t("result.battleStats.healing"), stats.healingDone)
        : null}
    </div>
  );
}

// ── Small stat chip ─────────────────────────────────────────────────────────
function StatChip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(255,255,255,0.07)",
      border: `1px solid ${color}44`,
      borderRadius: 12, padding: "9px 14px",
      boxShadow: `0 0 14px ${color}22`,
    }}>
      <span style={{ fontSize: 22 }}><EmojiIcon emoji={icon} size={22} /></span>
      <div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
      </div>
    </div>
  );
}

const BATTLE_TITLE_STYLE: Record<BattleTitleKind, { bg: string; color: string }> = {
  mvp: { bg: "linear-gradient(90deg, #ffd700, #ffab40)", color: "#1a0000" },
  kills: { bg: "linear-gradient(90deg, #b71c1c, #ef5350)", color: "#fff" },
  damage: { bg: "linear-gradient(90deg, #e65100, #ffb74d)", color: "#fff" },
  healing: { bg: "linear-gradient(90deg, #2e7d32, #81c784)", color: "#fff" },
  sacrifice: { bg: "linear-gradient(90deg, #5e35b1, #b39ddb)", color: "#fff" },
};

// ── One brawler column in the team split ────────────────────────────────────
function ParticipantCard({
  p, size, titleKinds, revealed, compact, modelScale = 1, showBattleStats = false,
  winStreak, winStreakBonus, rankedBarMode, rankedCups, rankedPeakCups,
}: {
  p: GameParticipant;
  size: number;
  titleKinds?: BattleTitleKind[];
  revealed: boolean;
  /** Узкая колонка рейда: чуть меньше шрифты, без вылезания. */
  compact?: boolean;
  /** Масштаб 3D (рейд: BOSS_RAID_RESULT_MODEL_SCALE), origin снизу. */
  modelScale?: number;
  /** Таблица смертей/убийств/урона под именем (экран двух команд). */
  showBattleStats?: boolean;
  winStreak?: number;
  winStreakBonus?: number;
  rankedBarMode?: boolean;
  rankedCups?: number;
  rankedPeakCups?: number;
}) {
  const { t } = useI18n();
  const axisWidth = size;
  const modelZoneH = Math.round(size * 0.92);
  const fsName = compact ? 12 : 15;
  /** Поднимаем визуал модели вверх — больше воздуха над именем. */
  const modelVisualLift =
    compact && modelScale > 1 ? Math.round(14 + (modelScale - 1) * 12) : 0;
  const headroomBase =
    compact && modelScale > 1 ? Math.round(modelZoneH * (modelScale - 1) * 0.55) : 0;
  const headroom = headroomBase + modelVisualLift;
  const standLift = compact ? modelVisualLift : 48;
  const topPad = compact ? 8 + headroom : 44;
  const modelTop = compact ? 10 : -36;
  const modelNameGap = compact && modelScale > 1 ? 42 : compact ? 10 : 38;
  const rankBarTop = topPad + modelTop - (compact ? 34 : 42) - (compact ? 0 : standLift);
  const badges = titleKinds ?? [];
  const badgeH = compact ? 15 : 17;
  const leaderTop = (compact ? 2 : rankBarTop - 22) - Math.max(0, badges.length - 1) * badgeH;
  const statsTableMaxW = showBattleStats ? axisWidth - 4 : undefined;
  const statsBlockH = showBattleStats ? (compact ? 112 : 122) : 0;
  const labelBlockH = (compact ? 22 : 28) + statsBlockH;
  const labelTop = topPad + modelTop + modelZoneH + modelNameGap;
  const slotH = topPad + modelTop + modelZoneH + modelNameGap + labelBlockH;
  const hiResModel = compact && modelScale > 1;
  const rasterSize = hiResModel ? Math.round(size * modelScale) : size;
  /** Было: (size×modelZoneH) + uniform scale(m) → визуал (size·m × modelZoneH·m). Сохраняем то же с hi-res canvas. */
  const modelScaleX = hiResModel ? (size * modelScale) / rasterSize : 1;
  const modelScaleY = hiResModel ? (modelZoneH * modelScale) / rasterSize : 1;
  return (
    <div
      style={{
        width: axisWidth,
        minHeight: slotH,
        paddingTop: compact ? topPad : 0,
        flexShrink: 0,
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(30px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
        position: "relative",
        overflow: "visible",
      }}
    >
      {badges.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: leaderTop,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            zIndex: 5,
            pointerEvents: "none",
          }}
        >
          {badges.map((kind) => {
            const style = BATTLE_TITLE_STYLE[kind];
            return (
              <div
                key={kind}
                style={{
                  background: style.bg,
                  borderRadius: 5,
                  padding: compact ? "1px 7px" : "2px 9px",
                  fontSize: compact ? 9 : 10,
                  fontWeight: 900,
                  letterSpacing: 1.2,
                  color: style.color,
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                }}
              >
                {t(battleTitleI18nKey(kind))}
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: rankBarTop,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 3,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {rankedBarMode ? (
            <RankedLeagueBar
              totalCups={rankedCups}
              peakCups={rankedPeakCups}
              layout="compact"
              badgeScale={compact ? 1.12 : MENU_RANK_BADGE_SCALE}
              powerLevel={p.level}
            />
          ) : (
            <BrawlerRankBar
              brawlerId={p.brawlerId}
              trophies={p.trophies}
              layout="compact"
              badgeScale={compact ? 1.12 : MENU_RANK_BADGE_SCALE}
              powerLevel={p.level}
              clickable={false}
              showUnclaimedBadge={false}
            />
          )}
          {winStreak != null && isWinStreakVisible(winStreak) && (
            <>
              <WinStreakFlame streak={winStreak} size={compact ? 32 : 38} />
              {winStreakBonus != null && winStreakBonus > 0 && (
                <WinStreakBonus bonus={winStreakBonus} size={compact ? 16 : 18} />
              )}
            </>
          )}
        </div>
      </div>

      <div
        style={{
          pointerEvents: "none",
          position: "absolute",
          left: "50%",
          top: topPad + modelTop,
          width: size,
          height: modelZoneH,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          transform:
            compact && modelVisualLift
              ? `translate(-50%, -${modelVisualLift}px)`
              : compact
                ? "translateX(-50%)"
                : `translate(-50%, -${standLift}px)`,
          overflow: "visible",
        }}
      >
        <div
          style={{
            width: hiResModel ? rasterSize : size,
            height: hiResModel ? rasterSize : modelZoneH,
            transform:
              hiResModel ? `scale(${modelScaleX}, ${modelScaleY})` : undefined,
            transformOrigin: "50% 100%",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <BrawlerViewer3D
            brawlerId={p.brawlerId}
            color={getBrawlerColor(p.brawlerId)}
            size={rasterSize}
            pixelRatioCap={hiResModel ? 2.5 : undefined}
          />
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: labelTop,
          width: axisWidth,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 4,
          zIndex: 5,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: fsName,
            fontWeight: 800,
            color: "#fff",
            textShadow: "0 1px 4px #000",
            lineHeight: 1.1,
            minHeight: 15,
            maxWidth: axisWidth,
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            padding: 0,
            margin: 0,
          }}
        >
          {p.displayName}
        </div>
        {showBattleStats && (
          <ParticipantBattleStatsTable
            stats={resolveBattleStats(p)}
            compact={compact}
            maxWidth={statsTableMaxW}
          />
        )}
      </div>
    </div>
  );
}

// ── Share / Report actions ────────────────────────────────────────────────────
function ResultTopActions({
  visible,
  canShare,
  replayReady,
  shared,
  onShare,
  canReport,
  reportMode,
  onReportClick,
}: {
  visible: boolean;
  canShare: boolean;
  replayReady: boolean;
  shared: boolean;
  onShare?: () => { success: boolean; error?: string };
  canReport: boolean;
  reportMode: boolean;
  onReportClick: () => void;
}) {
  const { t } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canShare && !canReport) return null;

  const handleConfirm = () => {
    if (!onShare) return;
    const res = onShare();
    setConfirmOpen(false);
    if (!res.success) setError(res.error ?? t("result.shareFailed"));
    else setError(null);
  };

  const handleShareClick = () => {
    if (shared) return;
    if (!replayReady) {
      setError(t("result.sharePreparing"));
      return;
    }
    setError(null);
    setConfirmOpen(true);
  };

  return (
    <>
      <div style={{
        position: "absolute",
        top: 28,
        right: 36,
        zIndex: 25,
        display: "flex",
        gap: 8,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.6s ease",
        pointerEvents: visible ? "auto" : "none",
      }}>
        {canReport && (
          <button
            type="button"
            onClick={onReportClick}
            className="ui-btn ui-btn--secondary"
            style={{
              letterSpacing: "0.08em",
              fontSize: 12,
              padding: "8px 14px",
              borderColor: reportMode ? "rgba(255,138,128,0.8)" : undefined,
              color: reportMode ? "#FF8A80" : undefined,
            }}
          >
            <Tr id="report.button" />
          </button>
        )}
        {canShare && (
          <button
            type="button"
            onClick={handleShareClick}
            title={!replayReady ? t("result.sharePreparing") : shared ? t("result.shareDone") : t("result.shareBattle")}
            className="ui-btn ui-btn--secondary"
            style={{
              letterSpacing: "0.08em",
              fontSize: 12,
              padding: "8px 14px",
              cursor: shared ? "default" : "pointer",
            }}
          >
            {shared ? t("result.shareDone") : t("result.shareBattle")}
          </button>
        )}
      </div>

      {error && (
        <div style={{
          position: "absolute", top: 68, right: 36, zIndex: 25,
          maxWidth: 220, padding: "6px 10px", borderRadius: 8,
          background: "rgba(255,82,82,0.15)", border: "1px solid rgba(255,82,82,0.35)",
          fontSize: 11, color: "#FF8A80", fontWeight: 700, textAlign: "right",
          opacity: visible ? 1 : 0,
        }}>
          {error}
        </div>
      )}

      {confirmOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            style={{
              width: "min(420px, 92vw)",
              background: "linear-gradient(160deg, rgba(18,32,58,0.98), rgba(8,14,28,0.98))",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: "22px 24px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: "white", marginBottom: 10 }}>
              <Tr id="result.shareConfirmTitle" />
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.45, marginBottom: 18 }}>
              <Tr id="result.shareConfirmBody" />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setConfirmOpen(false)}>
                <Tr id="common.no" />
              </button>
              <button type="button" className="ui-btn ui-btn--primary" onClick={handleConfirm}>
                <Tr id="common.yes" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Legacy wrapper kept for embedded share-only usages
function ResultShareActions({
  visible,
  canShare,
  replayReady,
  shared,
  onShare,
}: {
  visible: boolean;
  canShare: boolean;
  replayReady: boolean;
  shared: boolean;
  onShare?: () => { success: boolean; error?: string };
}) {
  const { t } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canShare) return null;

  const handleConfirm = () => {
    if (!onShare) return;
    const res = onShare();
    setConfirmOpen(false);
    if (!res.success) setError(res.error ?? t("result.shareFailed"));
    else setError(null);
  };

  const handleShareClick = () => {
    if (shared) return;
    if (!replayReady) {
      setError(t("result.sharePreparing"));
      return;
    }
    setError(null);
    setConfirmOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleShareClick}
        title={!replayReady ? t("result.sharePreparing") : shared ? t("result.shareDone") : t("result.shareBattle")}
        className="ui-btn ui-btn--secondary"
        style={{
          position: "absolute",
          top: 28,
          right: 36,
          zIndex: 25,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.6s ease",
          letterSpacing: "0.08em",
          fontSize: 12,
          padding: "8px 14px",
          cursor: shared ? "default" : "pointer",
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        {shared ? t("result.shareDone") : t("result.shareBattle")}
      </button>

      {error && (
        <div style={{
          position: "absolute", top: 68, right: 36, zIndex: 25,
          maxWidth: 220, padding: "6px 10px", borderRadius: 8,
          background: "rgba(255,82,82,0.15)", border: "1px solid rgba(255,82,82,0.35)",
          fontSize: 11, color: "#FF8A80", fontWeight: 700, textAlign: "right",
          opacity: visible ? 1 : 0,
        }}>
          {error}
        </div>
      )}

      {confirmOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            style={{
              width: "min(420px, 92vw)",
              background: "linear-gradient(160deg, rgba(18,32,58,0.98), rgba(8,14,28,0.98))",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16,
              padding: "22px 24px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: "white", marginBottom: 10 }}>
              <Tr id="result.shareConfirmTitle" />
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.45, marginBottom: 18 }}>
              <Tr id="result.shareConfirmBody" />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="ui-btn ui-btn--ghost" onClick={() => setConfirmOpen(false)}>
                <Tr id="common.no" />
              </button>
              <button type="button" className="ui-btn ui-btn--primary" onClick={handleConfirm}>
                <Tr id="common.yes" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ResultScreen({
  won, mode, participants, result, matchStats, questDeltas, bossRaidGrant = null,
  playAgainLabel, playAgainDisabled = false,
  partyPlayAgainMembers = [],
  partyPlayAgainSecondsLeft = 0,
  partyPlayAgainActive = false,
  canShareBattle = false,
  replayReady = false,
  battleShared = false,
  onShareBattle,
  observerMode = false,
  playerMapBattle = false,
  playerMapName,
  playerMapAuthor,
  playerMapVoted = false,
  onPlayerMapLike,
  onPlayerMapDislike,
  onExit, onPlayAgain,
}: ResultScreenProps) {
  const { t } = useI18n();
  const playLabel = playAgainLabel ?? t("battle.playAgain");
  const [phase, setPhase] = useState<1 | 2>(1);
  const [revealed, setRevealed] = useState(false);
  const [phase2In, setPhase2In] = useState(false);
  const [reportMode, setReportMode] = useState(false);

  const canReport = !observerMode && mode !== "training";

  const profile = getCurrentProfile();
  const patchedParticipants = participants.map((p) => {
    const base = { ...p, battleStats: resolveBattleStats(p) };
    if (!p.isPlayer) return base;
    const bt = getBrawlerTrophies(profile, p.brawlerId);
    return { ...base, trophies: bt };
  });

  const battleTitlesByKey = useMemo(
    () => computeBattleTitles(patchedParticipants),
    [participants],
  );
  const titlesFor = (p: GameParticipant) =>
    battleTitlesByKey.get(participantResultKey(p)) ?? [];

  const isBossRaid = mode === "bossraid";
  const player = patchedParticipants.find(p => p.isPlayer) || patchedParticipants[0];
  const starstrikeTeamSize = (mode === "starstrike" || mode === "bounty")
    ? Math.max(
        3,
        Math.min(
          5,
          Math.max(
            patchedParticipants.filter(p => p.team === "blue").length,
            patchedParticipants.filter(p => p.team === "red").length,
          ),
        ),
      )
    : 3;
  const playerTeam = patchedParticipants.filter(p => p.team === player.team).slice(0, isBossRaid ? 5 : 3);
  const enemyPool = patchedParticipants.filter(p => p.team !== player.team);
  const isClassicTeam = isTeamMode(mode);
  const isShowdownTeam = (mode === "showdown" && playerTeam.length > 1) || mode === "teamHunt";
  const isPvETeamResult = mode === "siege" || mode === "bossraid" || mode === "monsterhide" || mode === "monsterInvasion";
  const isDualTeamResult = isClassicTeam && !isPvETeamResult && patchedParticipants.some(p => p.team === "red");
  const isTeam = isClassicTeam || isShowdownTeam || isBossRaid;
  const showTeamBattleStats = phase === 1 && isTeam && !reportMode;
  const safeMatchStats = normalizeMatchStats(matchStats);
  const blueTeam = isClassicTeam
    ? patchedParticipants.filter(p => p.team === "blue").slice(0, starstrikeTeamSize)
    : playerTeam;
  const redTeam = isClassicTeam
    ? patchedParticipants.filter(p => p.team === "red").slice(0, starstrikeTeamSize)
    : [];
  const teamCount = Math.max(1, blueTeam.length);
  /** Boss raid: размер 3D из доступной области (до ~70% высоты блока), без скролла. */
  const bossRaidBlockRef = useRef<HTMLDivElement>(null);
  const trophyDeltaRef = useRef<HTMLSpanElement>(null);
  const rankBarRef = useRef<HTMLDivElement>(null);
  const masteryBarRef = useRef<HTMLDivElement>(null);
  const xpStatRef = useRef<HTMLDivElement>(null);
  const passHudRef = useRef<HTMLDivElement>(null);
  const proPassHudRef = useRef<HTMLDivElement>(null);
  const [trophyFly, setTrophyFly] = useState(false);
  const [passFly, setPassFly] = useState(false);
  const [masteryFly, setMasteryFly] = useState(false);
  const [rankedCupFly, setRankedCupFly] = useState(false);
  const [proPassFly, setProPassFly] = useState(false);
  const [rankAnimFrom, setRankAnimFrom] = useState<number | undefined>();
  const [rankAnimTo, setRankAnimTo] = useState<number | undefined>();
  const [rankedAnimFrom, setRankedAnimFrom] = useState<number | undefined>();
  const [rankedAnimTo, setRankedAnimTo] = useState<number | undefined>();
  const [masteryAnimFrom, setMasteryAnimFrom] = useState<number | undefined>();
  const [masteryAnimTo, setMasteryAnimTo] = useState<number | undefined>();
  const [bossRaidCardSize, setBossRaidCardSize] = useState(220);
  const teamCardSize =
    isBossRaid && teamCount >= 5 ? bossRaidCardSize : teamCount >= 3 ? 450 : teamCount === 2 ? 560 : 690;
  const teamGap = isBossRaid && teamCount >= 5 ? 6 : teamCount >= 3 ? 18 : teamCount === 2 ? 46 : 0;
  const allies = playerTeam.filter(p => !p.isPlayer);
  const trophyDelta = result?.trophyDelta ?? 0;
  const rankedCupDelta = result?.rankedCupDelta ?? 0;
  const proStarPassTokensGained = result?.proStarPassTokensGained ?? 0;
  const isRankedResult = !!result?.rankedBattle;
  const rankedCupsNow = profile ? getProfileRankedCups(profile) : 0;
  const rankedPeakCups = profile ? getProfileRankedPeakCups(profile) : rankedCupsNow;
  const rankedCupsBefore = Math.max(0, rankedCupsNow - rankedCupDelta);
  const trophiesBefore = Math.max(0, player.trophies - trophyDelta);
  const playerPeak = profile?.brawlerTrophyPeak?.[player.brawlerId] ?? player.trophies;
  const winStreak = result?.winStreak ?? 0;
  const winStreakBonus = result?.winStreakBonus ?? 0;
  const masteryXpGained = result?.masteryXpGained ?? 0;
  const masteryLeaderBonus = result?.masteryLeaderBonus ?? 0;
  const monsterKillBonus = result?.monsterKillTrophyBonus ?? 0;
  const masteryAfter = getBrawlerMasteryXp(profile, player.brawlerId);
  const masteryBefore = Math.max(0, masteryAfter - masteryXpGained);
  const playerMasteryTitle = profile?.equippedMasteryTitle;

  // Staggered reveal
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { void loadResourceListIcons(); }, []);

  useLayoutEffect(() => {
    if (!isBossRaid || phase !== 1) return;
    const block = bossRaidBlockRef.current;
    if (!block || typeof ResizeObserver === "undefined") return;
    const n = Math.max(1, Math.min(5, blueTeam.length));
    const gap = teamGap;
    const TITLE_BAND = 40;
    const sc = BOSS_RAID_RESULT_MODEL_SCALE;
    const modelVisualLift = sc > 1 ? Math.round(14 + (sc - 1) * 12) : 0;
    const modelNameGap = sc > 1 ? 42 : 10;
    const labelBlockH = 48;
    /** Совпадает с ParticipantCard compact. */
    const compactSlotH = (s: number) => {
      const modelZoneH = Math.round(s * 0.92);
      const headroomBase = sc > 1 ? Math.round(modelZoneH * (sc - 1) * 0.55) : 0;
      const headroom = headroomBase + modelVisualLift;
      return 8 + headroom + 10 + modelZoneH + modelNameGap + labelBlockH;
    };
    const measure = () => {
      const br = block.getBoundingClientRect();
      const availW = Math.max(0, br.width - 4);
      const innerH = Math.max(120, br.height - TITLE_BAND);
      const modelBandH = innerH * 0.7;
      const colW = (availW - gap * Math.max(0, n - 1)) / n - 2;
      const fromW = colW / sc;
      let fromH = 108;
      for (let s = 640; s >= 80; s--) {
        if (compactSlotH(s) <= modelBandH) {
          fromH = s;
          break;
        }
      }
      const next = Math.floor(Math.max(108, Math.min(fromW, fromH, 600)));
      setBossRaidCardSize(next);
    };
    measure();
    const ro = new ResizeObserver(() => requestAnimationFrame(measure));
    ro.observe(block);
    return () => ro.disconnect();
  }, [isBossRaid, phase, blueTeam.length, teamGap]);

  const handleNext = () => {
    if (!observerMode) {
      playResultsVoice(player.brawlerId, won);
    }
    setPhase(2);
    setTimeout(() => setPhase2In(true), 50);
  };

  useEffect(() => {
    if (!phase2In || isBossRaid || isRankedResult || trophyDelta <= 0) return;
    const t = setTimeout(() => {
      setRankAnimFrom(trophiesBefore);
      setRankAnimTo(player.trophies);
      setTrophyFly(true);
    }, 450);
    return () => clearTimeout(t);
  }, [phase2In, isBossRaid, isRankedResult, trophyDelta, trophiesBefore, player.trophies]);

  useEffect(() => {
    if (!phase2In || isBossRaid || !isRankedResult || rankedCupDelta === 0) return;
    const t = setTimeout(() => {
      setRankedAnimFrom(rankedCupsBefore);
      setRankedAnimTo(rankedCupsNow);
      if (rankedCupDelta > 0) setRankedCupFly(true);
    }, 450);
    return () => clearTimeout(t);
  }, [phase2In, isBossRaid, isRankedResult, rankedCupDelta, rankedCupsBefore, rankedCupsNow]);

  useEffect(() => {
    if (!phase2In || isBossRaid || trophyDelta <= 0 || !result || result.xpGained <= 0 || isRankedResult) return;
    const t = setTimeout(() => setPassFly(true), 500);
    return () => clearTimeout(t);
  }, [phase2In, isBossRaid, isRankedResult, trophyDelta, result?.xpGained]);

  useEffect(() => {
    if (!phase2In || isBossRaid || !isRankedResult || proStarPassTokensGained <= 0) return;
    const t = setTimeout(() => setProPassFly(true), 500);
    return () => clearTimeout(t);
  }, [phase2In, isBossRaid, isRankedResult, proStarPassTokensGained]);

  useEffect(() => {
    if (!phase2In || isBossRaid || !won || masteryXpGained <= 0) return;
    const t = setTimeout(() => {
      setMasteryAnimFrom(masteryBefore);
      setMasteryAnimTo(masteryAfter);
      setMasteryFly(true);
    }, 650);
    return () => clearTimeout(t);
  }, [phase2In, isBossRaid, won, masteryXpGained, masteryBefore, masteryAfter]);

  const handleExit = () => {
    if (!observerMode) {
      const p = getCurrentProfile();
      if (result?.rankedBattle && p) {
        if (result.rankedCupDelta && result.rankedCupDelta > 0) {
          queueMenuRankedCupFx(result.rankedCupDelta, getProfileRankedCups(p));
        }
        if (result.proStarPassTokensGained && result.proStarPassTokensGained > 0) {
          queueMenuProPassTokenFx(result.proStarPassTokensGained);
        }
      } else if (result) {
        if (result.trophyDelta > 0 && p) {
          queueMenuTrophyFx(result.trophyDelta, p.trophies);
        }
        if (result.trophyDelta > 0 && result.xpGained > 0) {
          queueMenuPassXpFx(result.xpGained);
        }
        if (result.masteryXpGained && result.masteryXpGained > 0 && p) {
          queueMenuMasteryXpFx(result.masteryXpGained, player.brawlerId);
        }
      }
    }
    onExit();
  };

  const observerExitBtn = observerMode ? (
    <button
      onClick={handleExit}
      className="ui-btn ui-btn--secondary ui-btn--lg"
      style={{
        position: "absolute",
        bottom: 24,
        right: 24,
        letterSpacing: "0.12em",
        zIndex: 30,
      }}
    >
      <Tr id="common.exit" />
    </button>
  ) : null;

  const trophyLabel = result
    ? (result.trophyDelta >= 0 ? `+${result.trophyDelta}` : `${result.trophyDelta}`)
    : "—";
  const trophyColor = result && result.trophyDelta >= 0 ? "#ffd700" : "#ff5252";
  const placeText = (mode === "showdown" || mode === "megashowdown" || mode === "teamHunt") && result
    ? t("result.place", { place: result.place })
    : "";
  const placeBigText = (mode === "showdown" || mode === "megashowdown" || mode === "teamHunt") && result
    ? t("result.placeBig", { place: result.place })
    : "";
  const monsterKillBar = !observerMode && monsterKillBonus > 0 ? (
    <MonsterKillBonusBar count={monsterKillBonus} label={t("result.monsterKillBonus", { count: monsterKillBonus })} />
  ) : null;

  // ── Phase 1 – Team split ─────────────────────────────────────────────────
  if (phase === 1 && isTeam) {
    if (isDualTeamResult) {
      const dualCount = Math.max(blueTeam.length, redTeam.length, (mode === "starstrike" || mode === "bounty") ? starstrikeTeamSize : 3);
      const dualCardSize = dualCount >= 5 ? 245 : dualCount >= 3 ? 285 : 350;
      const dualTeamGap = dualCount >= 5 ? 8 : dualCount >= 3 ? 12 : 18;
      return (
        <div style={{ position: "absolute", inset: 0, zIndex: 20, overflow: "visible", fontFamily: "'Segoe UI', sans-serif" }}>
          <div style={{
            position: "absolute", inset: 0,
            background: RESULT_DUAL_BG,
          }} />

          <ResultOutcomeBanner won={won} revealed={revealed}>
            <div style={{
              fontSize: 52, fontWeight: 900, letterSpacing: 3,
              color: won ? "#ffd700" : "#ff5252",
              textShadow: `0 0 30px ${won ? "#ffd700" : "#ff5252"}, 0 2px 0 #000`,
              lineHeight: 1,
            }}>
              {won ? t("result.victory") : t("result.defeat")}
            </div>
            {isRankedResult ? (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                fontSize: 46,
                fontWeight: 800,
                color: rankedCupDelta >= 0 ? "#CE93D8" : "#ff5252",
                textShadow: "0 0 16px rgba(206,147,216,0.5)",
                marginTop: 8,
              }}>
                <TrophyIcon size={84} />
                {rankedCupDelta >= 0 ? `+${rankedCupDelta}` : rankedCupDelta} <Tr id="ranked.cupsShort" />
              </div>
            ) : (
              <TrophyDeltaLine label={trophyLabel} color={trophyColor} fontSize={46} iconSize={84} />
            )}
          </ResultOutcomeBanner>

          <div style={{
            position: "absolute", left: 0, bottom: "2%", width: "50%", height: "62%",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            gap: dualTeamGap,
            padding: "0 2%",
            boxSizing: "border-box",
            overflow: "visible",
            transform: "translateX(-8px)",
          }}>
            {blueTeam.map((p, i) => (
              <ParticipantCard
                key={`blue-slot-${p.brawlerId}-${i}`}
                p={p}
                size={dualCardSize}
                titleKinds={titlesFor(p)}
                revealed={revealed}
                showBattleStats={showTeamBattleStats}
              />
            ))}
          </div>

          <div style={{
            position: "absolute", right: 0, bottom: "2%", width: "50%", height: "62%",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            gap: dualTeamGap,
            padding: "0 2%",
            boxSizing: "border-box",
            overflow: "visible",
          }}>
            {redTeam.map((p, i) => (
              <ParticipantCard
                key={`red-slot-${p.brawlerId}-${i}`}
                p={p}
                size={dualCardSize}
                titleKinds={titlesFor(p)}
                revealed={revealed}
                showBattleStats={showTeamBattleStats}
              />
            ))}
          </div>

          {!observerMode ? (
            <div style={{
              position: "absolute", bottom: 30, right: 36,
              display: "flex", gap: 14,
              opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s",
            }}>
              <button
                onClick={handleNext}
                className="ui-btn ui-btn--primary ui-btn--lg"
                style={{ letterSpacing: "0.16em" }}
              >
                <Tr id="common.next" />
              </button>
            </div>
          ) : observerExitBtn}

        </div>
      );
    }
    return (
      <div style={{
        position: "absolute", inset: 0, zIndex: 20,
        overflow: "visible",
        fontFamily: "'Segoe UI', sans-serif",
      }}>
        {/* Team-only full background */}
        <div style={{
          position: "absolute", inset: 0,
          background: won ? RESULT_WIN_BG : RESULT_LOSE_BG,
        }} />
        {/* BG overlay fade */}
        {/* Top left – result badge */}
        <div style={{
          position: "absolute", top: 28, left: 36,
          opacity: revealed ? 1 : 0, transform: revealed ? "translateX(0)" : "translateX(-40px)",
          transition: "opacity 0.6s ease, transform 0.6s ease",
        }}>
          <div style={{
            fontSize: 52, fontWeight: 900, letterSpacing: 3,
            color: won ? "#ffd700" : "#ff5252",
            textShadow: `0 0 30px ${won ? "#ffd700" : "#ff5252"}, 0 2px 0 #000`,
            lineHeight: 1,
          }}>
            {won ? t("result.victory") : t("result.defeat")}
          </div>
          {isBossRaid && (
            <div style={{
              fontSize: 15,
              fontWeight: 700,
              color: "rgba(255,255,255,0.9)",
              marginTop: 10,
              maxWidth: 560,
              lineHeight: 1.35,
            }}>
              <Tr id="result.raid.noTrophies" />
              {bossRaidGrant?.granted && bossRaidGrant.reward ? (
                <span>
                  {" "}
                  <Tr id="result.raid.rewardHint" />{" "}
                  {[
                    bossRaidGrant.reward.coins > 0 ? t("result.raid.rewardCoins", { count: bossRaidGrant.reward.coins }) : null,
                    bossRaidGrant.reward.powerPoints > 0 ? t("result.raid.rewardPower", { count: bossRaidGrant.reward.powerPoints }) : null,
                    bossRaidGrant.reward.chest
                      ? t("result.raid.rewardChest", { count: bossRaidGrant.reward.chest.count, rarity: bossRaidGrant.reward.chest.rarity })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                  .
                </span>
              ) : won ? (
                <span> <Tr id="result.raid.firstClearHint" /></span>
              ) : null}
            </div>
          )}
          {!isBossRaid && (
            <TrophyDeltaLine label={trophyLabel} color={trophyColor} />
          )}
        </div>

        {/* Boss raid: фиксированная область экрана, модели до 70% её высоты, без скролла */}
        {isBossRaid ? (
          <div
            ref={bossRaidBlockRef}
            style={{
              position: "absolute",
              left: "2%",
              right: "2%",
              top: "18%",
              bottom: "12%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              minHeight: 0,
              overflow: "visible",
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                color: "#82b1ff",
                fontWeight: 900,
                fontSize: "clamp(14px, 1.9vw, 20px)",
                letterSpacing: 2,
                opacity: 0.95,
                textShadow: "0 2px 10px rgba(0,0,0,0.55)",
                flexShrink: 0,
              }}
            >
              <Tr id="result.team.yours" />
            </div>
            <div
              style={{
                flex: "1 1 0",
                minHeight: 0,
                width: "100%",
                display: "flex",
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "flex-end",
                gap: teamGap,
                overflow: "visible",
                pointerEvents: "auto",
              }}
            >
              {blueTeam.map((p, i) => (
                <ParticipantCard
                  key={p.brawlerId + i}
                  p={p}
                  size={teamCardSize}
                  titleKinds={titlesFor(p)}
                  revealed={revealed}
                  compact
                  modelScale={BOSS_RAID_RESULT_MODEL_SCALE}
                  showBattleStats={showTeamBattleStats}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                position: "absolute",
                top: 18,
                left: "50%",
                transform: "translateX(-50%)",
                color: "#82b1ff",
                fontWeight: 900,
                fontSize: 24,
                letterSpacing: 2.2,
                opacity: 0.92,
                textShadow: "0 2px 10px rgba(0,0,0,0.55)",
                pointerEvents: "none",
              }}
            >
              <Tr id="result.team.yours" />
            </div>

            <div
              style={{
                position: "absolute",
                bottom: "8%",
                left: "50%",
                width: "min(1180px, 98vw)",
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-end",
                gap: teamGap,
                transform: "translateX(-50%)",
              }}
            >
              {blueTeam.map((p, i) => (
                <ParticipantCard
                  key={p.brawlerId + i}
                  p={p}
                  size={teamCardSize}
                  titleKinds={titlesFor(p)}
                  revealed={revealed}
                  showBattleStats={showTeamBattleStats}
                />
              ))}
            </div>
          </>
        )}

        

        {!observerMode ? (
          <div style={{
            position: "absolute", bottom: 30, right: 36,
            display: "flex", gap: 14,
            opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s",
          }}>
            <button
              onClick={handleNext}
              className="ui-btn ui-btn--primary ui-btn--lg"
              style={{ letterSpacing: "0.16em" }}
            >
              <Tr id="common.next" />
            </button>
          </div>
        ) : observerExitBtn}

        <style>{`
          @keyframes slideInLeft { from { opacity:0; transform: translateX(-40px); } to { opacity:1; transform: none; } }
        `}</style>

      </div>
    );
  }

  // ── Phase 1 – Showdown / training (solo) ─────────────────────────────────
  if (phase === 1 && !isTeam) {
    return (
      <div style={{
        position: "absolute", inset: 0, zIndex: 20, overflow: "hidden",
        background: won ? RESULT_WIN_BG : RESULT_LOSE_BG,
        fontFamily: "'Segoe UI', sans-serif",
      }}>
        {/* Glow orb behind brawler */}
        <div style={{
          position: "absolute", left: "50%", top: "38%", width: 280, height: 280,
          borderRadius: "50%", transform: "translate(-50%, -50%)",
          background: won ? RESULT_WIN_GLOW : RESULT_LOSE_GLOW,
          filter: "blur(20px)",
        }} />

        {/* Top left */}
        <div style={{
          position: "absolute", top: 28, left: 36,
          opacity: revealed ? 1 : 0, transform: revealed ? "none" : "translateX(-30px)",
          transition: "all 0.5s ease",
        }}>
          <div style={{
            fontSize: 52, fontWeight: 900, letterSpacing: 3,
            color: won ? "#ffd700" : "#ff5252",
            textShadow: `0 0 30px ${won ? "#ffd700" : "#ff5252"}`,
          }}>
            {won ? t("result.victory") : t("result.defeat")}
          </div>
          {placeBigText && (
            <div style={{
              fontSize: 46,
              fontWeight: 900,
              letterSpacing: 2,
              color: "#ffffff",
              textShadow: "0 0 22px rgba(255,255,255,0.45), 0 3px 0 rgba(0,0,0,0.75)",
              marginTop: 2,
              lineHeight: 1,
            }}>
              {placeBigText}
            </div>
          )}
          <TrophyDeltaLine label={trophyLabel} color={trophyColor} />
        </div>

        {/* Player brawler centered */}
        <div style={{
          position: "absolute", left: "50%", top: "18%", transform: "translate(-50%, 0)",
          opacity: revealed ? 1 : 0, transition: "all 0.5s ease 0.1s",
        }}>
          <div style={{ pointerEvents: "none" }}>
            <BrawlerViewer3D brawlerId={player.brawlerId} color={getBrawlerColor(player.brawlerId)} size={532} />
          </div>
        </div>

        {/* Player/team info below */}
        {isShowdownTeam ? (
          <div style={{
            position: "absolute", left: "50%", top: "70%", transform: "translateX(-50%)",
            display: "flex", justifyContent: "center", gap: 12,
            opacity: revealed ? 1 : 0, transition: "all 0.5s ease 0.2s",
          }}>
            {playerTeam.map((p, i) => (
              <ParticipantCard
                key={p.displayName + i}
                p={p}
                size={185}
                titleKinds={titlesFor(p)}
                revealed={revealed}
                showBattleStats={showTeamBattleStats}
              />
            ))}
          </div>
        ) : (
          <div style={{
            position: "absolute", left: "50%", top: "76%", transform: "translateX(-50%)",
            textAlign: "center",
            opacity: revealed ? 1 : 0, transition: "all 0.5s ease 0.2s",
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{player.displayName}</div>
            <div style={{ display: "flex", gap: 16, marginTop: 6, justifyContent: "center" }}>
              <TrophyStatInline trophies={player.trophies} fontSize={16} showRank={false} />
              <span style={{ fontSize: 16, color: "#80d8ff", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><EmojiIcon emoji="⚡" size={24} /> {player.level}</span>
            </div>
            {placeText && (
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{placeText}</div>
            )}
          </div>
        )}

        {!observerMode ? (
          <button
            onClick={handleNext}
            className="ui-btn ui-btn--primary ui-btn--lg"
            style={{
              position: "absolute", bottom: 30, right: 36,
              opacity: revealed ? 1 : 0, transition: "all 0.5s ease 0.4s",
              letterSpacing: "0.12em",
            }}
          >
            <Tr id="common.next" />
          </button>
        ) : observerExitBtn}

      </div>
    );
  }

  // ── Phase 2 – Personal stats ─────────────────────────────────────────────
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 20, overflow: "hidden",
      background: won ? RESULT_WIN_BG : RESULT_LOSE_BG,
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      {monsterKillBar}
      {/* Subtle glow orb */}
      <div style={{
        position: "absolute", left: "50%", top: "45%", width: 320, height: 320,
        borderRadius: "50%", transform: "translate(-50%,-50%)",
        background: won ? RESULT_WIN_GLOW : RESULT_LOSE_GLOW,
        filter: "blur(30px)",
      }} />

      {/* ── Left ally (dimmed) ──────────────────────────────────────────── */}
      {isTeam && allies[0] && (
        <div style={{
          position: "absolute", left: "3%", bottom: "18%",
          opacity: phase2In ? 0.35 : 0,
          transform: phase2In ? "none" : "translateX(-40px)",
          transition: "all 0.6s ease",
        }}>
          <div style={{ opacity: 0.55, pointerEvents: "none" }}>
            <BrawlerViewer3D brawlerId={allies[0].brawlerId} color={getBrawlerColor(allies[0].brawlerId)} size={238} />
          </div>
          <div style={{ textAlign: "center", marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
            {allies[0].displayName}
          </div>
        </div>
      )}

      {/* ── Right ally (dimmed) ─────────────────────────────────────────── */}
      {isTeam && allies[1] && (
        <div style={{
          position: "absolute", right: "28%", bottom: "18%",
          opacity: phase2In ? 0.35 : 0,
          transform: phase2In ? "none" : "translateX(40px)",
          transition: "all 0.6s ease",
        }}>
          <div style={{ opacity: 0.55, pointerEvents: "none" }}>
            <BrawlerViewer3D brawlerId={allies[1].brawlerId} color={getBrawlerColor(allies[1].brawlerId)} size={238} />
          </div>
          <div style={{ textAlign: "center", marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
            {allies[1].displayName}
          </div>
        </div>
      )}

      {/* ── Player's brawler (center) ───────────────────────────────────── */}
      <div style={{
        position: "absolute",
        left: isTeam ? "44%" : "50%",
        bottom: "12%",
        transform: isTeam ? "translateX(-50%)" : "translateX(-50%)",
        opacity: phase2In ? 1 : 0,
        transition: "all 0.55s ease 0.05s",
      }}>
        <div style={{ pointerEvents: "none" }}>
          <BrawlerViewer3D brawlerId={player.brawlerId} color={getBrawlerColor(player.brawlerId)} size={371} />
        </div>
      </div>

      {/* ── Top left – result badge ──────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: 24, left: 28,
        opacity: phase2In ? 1 : 0, transform: phase2In ? "none" : "translateX(-30px)",
        transition: "all 0.5s ease",
      }}>
        <div style={{
          fontSize: 40, fontWeight: 900, letterSpacing: 3,
          color: won ? "#ffd700" : "#ff5252",
          textShadow: `0 0 28px ${won ? "#ffd700" : "#ff5252"}, 0 2px 0 #000`,
        }}>
          {won ? t("result.victory") : t("result.defeat")}
        </div>
        {placeBigText && (
          <div style={{
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: 1.5,
            color: "#ffffff",
            textShadow: "0 0 18px rgba(255,255,255,0.45), 0 2px 0 rgba(0,0,0,0.8)",
            marginTop: 2,
            lineHeight: 1,
          }}>
            {placeBigText}
          </div>
        )}
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 10 }}>
          {isBossRaid ? (
            <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.82)" }}>
              <Tr id="result.raid.noTrophiesShort" />
            </span>
          ) : isRankedResult ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
              <span
                ref={trophyDeltaRef}
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: rankedCupDelta >= 0 ? "#CE93D8" : "#ff5252",
                  textShadow: "0 0 14px rgba(206,147,216,0.5)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <TrophyIcon size={28} />
                {rankedCupDelta >= 0 ? `+${rankedCupDelta}` : rankedCupDelta} <Tr id="ranked.cupsShort" />
              </span>
              {proStarPassTokensGained > 0 && (
                <span style={{ fontSize: 15, fontWeight: 900, color: "#c6ff00", textShadow: "0 0 10px rgba(198,255,0,0.45)" }}>
                  <Tr id="proPass.tokensGained" params={{ tokens: proStarPassTokensGained }} />
                </span>
              )}
            </div>
          ) : playerMapBattle ? (
            <span style={{ fontSize: 15, fontWeight: 800, color: "rgba(255,255,255,0.82)" }}>
              <Tr id="playerMaps.noTrophies" />
            </span>
          ) : (
            <span
              ref={trophyDeltaRef}
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: trophyColor,
                textShadow: `0 0 14px ${trophyColor}`,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <TrophyIcon size={28} />
              {trophyLabel}
            </span>
          )}
        </div>
        {!isBossRaid && (
          <div style={{ marginTop: 12, display: "inline-flex" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 10, flexWrap: "wrap", marginLeft: -4 }}>
              {playerMapBattle ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: 320 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#80DEEA", textShadow: "0 0 12px rgba(128,222,234,0.35)" }}>
                    {playerMapName ?? t("playerMaps.unknownMap")}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.72)" }}>
                    <Tr id="playerMaps.byAuthor" params={{ name: playerMapAuthor ?? "?" }} />
                  </div>
                </div>
              ) : isRankedResult ? (
                <RankedLeagueBar
                  totalCups={rankedCupsNow}
                  peakCups={rankedPeakCups}
                  layout="compact"
                  badgeScale={MENU_RANK_BADGE_SCALE}
                  showSegmentCaption
                  barRef={rankBarRef}
                  animateFromCups={rankedAnimFrom}
                  animateToCups={rankedAnimTo}
                  animateDurationMs={1200}
                />
              ) : (
                <div ref={rankBarRef} style={{ display: "inline-flex" }}>
                  <BrawlerRankBar
                    brawlerId={player.brawlerId}
                    trophies={player.trophies}
                    peakTrophies={playerPeak}
                    layout="compact"
                    badgeScale={MENU_RANK_BADGE_SCALE}
                    clickable={false}
                    showUnclaimedBadge={false}
                    animateFromTrophies={rankAnimFrom}
                    animateToTrophies={rankAnimTo}
                    animateDurationMs={1200}
                  />
                </div>
              )}
              {!isRankedResult && isWinStreakVisible(winStreak) && (
                <>
                  <WinStreakFlame streak={winStreak} size={44} />
                  {winStreakBonus > 0 && <WinStreakBonus bonus={winStreakBonus} size={20} />}
                </>
              )}
            </div>
          </div>
        )}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{player.displayName}</div>
          {playerMasteryTitle && (
            <div style={{ marginTop: 2 }}>
              <PlayerMasteryTitle titleId={playerMasteryTitle} fontSize={11} style={{ textAlign: "left" }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 2, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: "#80d8ff", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><EmojiIcon emoji="⚡" size={21} /> {player.level}</span>
          </div>
          {!isBossRaid && (
            <div style={{ marginTop: 8 }}>
              <BrawlerMasteryBar
                brawlerId={player.brawlerId}
                layout="result"
                width={200}
                badgeSize={58}
                rewardIconSize={36}
                animateFromXp={masteryAnimFrom}
                animateToXp={masteryAnimTo}
                animateDurationMs={1200}
                barRef={masteryBarRef}
              />
              {won && masteryXpGained > 0 && (
                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: "#CE93D8" }}>
                  +{masteryXpGained - masteryLeaderBonus}
                  {masteryLeaderBonus > 0 && (
                    <span style={{ color: "#FFD740", marginLeft: 6 }}>+{masteryLeaderBonus}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Quests panel (bottom left) ──────────────────────────────────── */}
      <div style={{
        position: "absolute", bottom: 18, left: 20, maxWidth: 280,
        opacity: phase2In ? 1 : 0, transform: phase2In ? "none" : "translateY(30px)",
        transition: "all 0.55s ease 0.15s",
      }}>
        <>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
            <Tr id="result.quests" />
          </div>
          {questDeltas.length > 0 ? questDeltas.map((qd, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.07)", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              padding: "7px 12px", marginBottom: 5,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 14 }}><EmojiIcon emoji="🎯" size={24} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.3 }}>
                  {qd.description}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 12, color: "#ffd700", fontWeight: 700 }}>
                    {qd.after}/{qd.target}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: "#4caf50",
                    background: "#4caf5022", borderRadius: 4, padding: "1px 5px",
                  }}>
                    +{qd.delta}
                  </span>
                </div>
              </div>
            </div>
          )) : (
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
            }}>
              <Tr id="result.questsNoProgress" />
            </div>
          )}
        </>
      </div>

      {!isBossRaid && result && result.xpGained > 0 && !isRankedResult && (
        <div
          ref={passHudRef}
          style={{
            position: "absolute",
            top: canShareBattle ? 76 : 22,
            right: 22,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 12,
            background: "rgba(74,20,140,0.55)",
            border: "1px solid rgba(206,147,216,0.5)",
            boxShadow: "0 0 20px rgba(206,147,216,0.25)",
            opacity: phase2In ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        >
          <PassXpIcon size={28} lite />
          <span style={{ fontSize: 12, fontWeight: 900, color: "#CE93D8", letterSpacing: 1 }}><Tr id="result.starPass" /></span>
        </div>
      )}

      {isRankedResult && proStarPassTokensGained > 0 && (
        <div
          ref={proPassHudRef}
          style={{
            position: "absolute",
            top: canShareBattle ? 76 : 22,
            right: 22,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 12,
            background: "rgba(26,10,58,0.72)",
            border: "1px solid rgba(255,213,79,0.55)",
            boxShadow: "0 0 20px rgba(198,255,0,0.25)",
            opacity: phase2In ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL ?? "/"}images/ranked-battle-token.png?v=4`}
            alt=""
            style={{ width: 28, height: 28, objectFit: "contain" }}
          />
          <span style={{ fontSize: 12, fontWeight: 900, color: "#FFD700", letterSpacing: 1 }}><Tr id="result.proPass" /></span>
        </div>
      )}

      {/* ── Stats panel (right) ─────────────────────────────────────────── */}
      <div style={{
        position: "absolute", top: "50%", right: 24,
        transform: phase2In ? "translateY(-50%)" : "translateY(-50%) translateX(60px)",
        opacity: phase2In ? 1 : 0, transition: "all 0.55s ease 0.1s",
        width: 210,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
          <Tr id="result.stats.battle" />
        </div>
        <StatChip icon="⚔️" label={t("result.stats.damage")} value={formatStatInt(safeMatchStats.damageDealt)} color="#ff7043" />
        <StatChip icon="💚" label={t("result.stats.healing")} value={formatStatInt(safeMatchStats.healingDone)} color="#66bb6a" />
        <StatChip icon="💀" label={t("result.stats.kills")} value={formatStatInt(safeMatchStats.killCount)} color="#ef5350" />
        <StatChip icon="☠️" label={t("result.stats.deaths")} value={formatStatInt(safeMatchStats.deaths)} color="#b39ddb" />
        <StatChip icon="⚡" label={t("result.stats.super")} value={formatStatInt(safeMatchStats.superUses)} color="#ffd700" />
        {result && (
          <div ref={xpStatRef}>
            <StatChip icon="⭐" label={t("result.stats.xp")} value={`+${result.xpGained}`} color="#ce93d8" />
          </div>
        )}
      </div>

      {/* ── Bottom right – play again panel + action buttons ─────────────── */}
      <div style={{
        position: "absolute", bottom: 24, right: 24,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12,
        opacity: phase2In ? 1 : 0, transform: phase2In ? "none" : "translateY(20px)",
        transition: "all 0.5s ease 0.3s",
      }}>
        {partyPlayAgainMembers.length > 1 && (
          <PartyPlayAgainPanel
            members={partyPlayAgainMembers}
            secondsLeft={partyPlayAgainSecondsLeft}
            active={partyPlayAgainActive}
          />
        )}
        <div style={{ display: "flex", gap: 14 }}>
          {playerMapBattle ? (
            <>
              <button
                onClick={onPlayerMapLike}
                disabled={playerMapVoted}
                className={`ui-btn ui-btn--lg ${playerMapVoted ? "ui-btn--ghost" : ""}`}
                style={{ letterSpacing: "0.08em", ["--ui-shear-fill" as string]: "#1565C0", ["--ui-shear-border" as string]: "#64B5F6" }}
              >
                <Tr id="playerMaps.like" />
              </button>
              <button
                onClick={onPlayerMapDislike}
                disabled={playerMapVoted}
                className={`ui-btn ui-btn--lg ${playerMapVoted ? "ui-btn--ghost" : ""}`}
                style={{ letterSpacing: "0.08em", ["--ui-shear-fill" as string]: "#B71C1C", ["--ui-shear-border" as string]: "#FF5252" }}
              >
                <Tr id="playerMaps.dislike" />
              </button>
            </>
          ) : !isRankedResult && (
            <button
              onClick={onPlayAgain}
              disabled={playAgainDisabled}
              className={`ui-btn ${playAgainDisabled ? "ui-btn--ghost" : "ui-btn--accent"} ui-btn--lg`}
              style={{ letterSpacing: "0.12em" }}
            >
              {playLabel}
            </button>
          )}
          <button
            onClick={handleExit}
            className={`ui-btn ${isRankedResult ? "ui-btn--primary" : "ui-btn--secondary"} ui-btn--lg`}
            style={{ letterSpacing: "0.12em" }}
          >
            <Tr id="common.exit" />
          </button>
        </div>
      </div>

      {trophyFly && trophyDelta > 0 && (
        <TrophyFlyBurst
          count={trophyDelta}
          fromEl={trophyDeltaRef.current}
          toEl={rankBarRef.current}
          spawnDurationMs={Math.min(1500, 400 + trophyDelta * 40)}
          onComplete={() => setTrophyFly(false)}
        />
      )}
      {rankedCupFly && rankedCupDelta > 0 && (
        <RankedCupFlyBurst
          count={rankedCupDelta}
          fromEl={trophyDeltaRef.current}
          toEl={rankBarRef.current}
          spawnDurationMs={Math.min(1500, 400 + rankedCupDelta * 40)}
          onComplete={() => setRankedCupFly(false)}
        />
      )}
      {passFly && result && result.trophyDelta > 0 && result.xpGained > 0 && !isBossRaid && (
        <PassXpFlyBurst
          count={result.xpGained}
          fromEl={trophyDeltaRef.current}
          toEl={passHudRef.current}
          spawnDurationMs={Math.min(1500, 400 + result.xpGained * 8)}
          onComplete={() => setPassFly(false)}
        />
      )}
      {proPassFly && proStarPassTokensGained > 0 && (
        <ProPassTokenFlyBurst
          count={proStarPassTokensGained}
          fromEl={trophyDeltaRef.current}
          toEl={proPassHudRef.current}
          spawnDurationMs={Math.min(1500, 400 + proStarPassTokensGained * 8)}
          onComplete={() => setProPassFly(false)}
        />
      )}
      {masteryFly && masteryXpGained > 0 && !isBossRaid && (
        <MasteryXpFlyBurst
          count={masteryXpGained}
          fromEl={trophyDeltaRef.current}
          toEl={masteryBarRef.current}
          spawnDurationMs={Math.min(1500, 400 + masteryXpGained * 12)}
          onComplete={() => setMasteryFly(false)}
        />
      )}

      <ResultTopActions
        visible={phase2In}
        canShare={canShareBattle}
        replayReady={replayReady}
        shared={battleShared}
        onShare={onShareBattle}
        canReport={canReport}
        reportMode={reportMode}
        onReportClick={() => setReportMode((v) => !v)}
      />

      {reportMode && canReport && (
        <ResultReportFlow
          visible={reportMode}
          mode={mode as import("../App").GameMode}
          opponents={patchedParticipants.filter((p) => !p.isPlayer)}
          onClose={() => setReportMode(false)}
        />
      )}
    </div>
  );
}
