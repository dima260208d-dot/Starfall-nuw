import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GLASS_THEMES, glassOverlayStyle, glassPanelStyle, glassRadialStyle } from "../utils/glassModalTheme";

const QUEST_GLASS = GLASS_THEMES.purple;
import {
  getCurrentProfile,
  getQuestPool,
} from "../utils/localStorageAPI";
import {
  timeUntilDaily, timeUntilWeekly, timeUntilPaid,
  formatHmsShort, MAX_ACTIVE_QUESTS,
  type QuestPool, type QuestState,
} from "../utils/quests";
import ChestVisual from "./ChestVisual";
import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";
import { useI18n, getQuestDescription, getQuestRewardLabel } from "../i18n";
import ModalCloseButton from "./ModalCloseButton";
import { Tr } from "../i18n/Tr";
import VolProgressTrack from "./ui/VolProgressTrack";
import { EmojiIcon } from "./EmojiIcon";

interface Props { onClose: () => void }

const DIFF_COLORS = ["#69F0AE", "#FFD740", "#FF7043"];
const DIFF_KEYS = ["common.difficulty.easy", "common.difficulty.medium", "common.difficulty.hard"] as const;

function diffOf(q: QuestState): 0 | 1 | 2 {
  if (q.isWeekly) return 2;
  if (q.target <= 3 || (q.kind.startsWith("play_") && q.target <= 3)) return 0;
  return 1;
}

function sortQuestsForDisplay(quests: QuestState[]): QuestState[] {
  return [...quests].sort((a, b) => {
    const aReady = !a.claimed && a.progress >= a.target;
    const bReady = !b.claimed && b.progress >= b.target;
    if (aReady !== bReady) return aReady ? -1 : 1;
    const aPct = a.target > 0 ? a.progress / a.target : 0;
    const bPct = b.target > 0 ? b.progress / b.target : 0;
    if (Math.abs(aPct - bPct) > 0.001) return bPct - aPct;
    if (a.isWeekly !== b.isWeekly) return a.isWeekly ? -1 : 1;
    if (a.isPaid !== b.isPaid) return a.isPaid ? -1 : 1;
    return 0;
  });
}

function QuestCard({
  q,
  hasPaidPass,
}: { q: QuestState; hasPaidPass: boolean }) {
  const { t } = useI18n();
  const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
  const ready = q.progress >= q.target && !q.claimed;
  const lockedPaid = ready && !!q.isPaid && !hasPaidPass;
  const diff = diffOf(q);
  return (
    <div className="ui-card" style={{
      background: ready && !lockedPaid
        ? "linear-gradient(160deg, rgba(255,213,79,0.22), rgba(40,18,60,0.38))"
        : lockedPaid
          ? "linear-gradient(160deg, rgba(255,152,0,0.18), rgba(40,18,60,0.38))"
          : "linear-gradient(160deg, rgba(255,255,255,0.08), rgba(30,12,50,0.32))",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      border: `1px solid ${lockedPaid ? "rgba(255,152,0,0.65)" : ready ? "var(--bd-gold)" : "var(--bd-1)"}`,
      borderRadius: "var(--r-md)",
      padding: "10px 12px",
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 12,
      alignItems: "center",
      boxShadow: ready
        ? "0 0 22px rgba(255,213,79,0.3), var(--sh-md), inset 0 1px 0 rgba(255,255,255,0.06)"
        : "var(--sh-sm), inset 0 1px 0 rgba(255,255,255,0.03)",
      position: "relative",
      overflow: "hidden",
      flexShrink: 0,
      transition: "all var(--ease-mid)",
    }}>
      {q.isWeekly && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 14,
          background: "linear-gradient(135deg, rgba(138,43,226,0.08) 0%, transparent 60%)",
          pointerEvents: "none",
        }} />
      )}
      {q.isPaid && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 14,
          background: "linear-gradient(135deg, rgba(255,193,7,0.10) 0%, transparent 60%)",
          pointerEvents: "none",
        }} />
      )}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 10, fontWeight: 900, letterSpacing: 0.8, padding: "2px 7px",
            borderRadius: 6, background: `${DIFF_COLORS[diff]}22`,
            color: DIFF_COLORS[diff], border: `1px solid ${DIFF_COLORS[diff]}55`,
          }}>{t(DIFF_KEYS[diff])}</span>
          {q.isWeekly && (
            <span style={{
              fontSize: 10, fontWeight: 900, letterSpacing: 0.8, padding: "2px 7px",
              borderRadius: 6, background: "rgba(138,43,226,0.18)",
              color: "#CE93D8", border: "1px solid rgba(138,43,226,0.4)",
            }}><Tr id="quests.weeklyBadge" /></span>
          )}
          {q.isPaid && (
            <span style={{
              fontSize: 10, fontWeight: 900, letterSpacing: 0.8, padding: "2px 7px",
              borderRadius: 6, background: "rgba(255,193,7,0.18)",
              color: "#FFD54F", border: "1px solid rgba(255,193,7,0.45)",
            }}><Tr id="quests.paidBadge" /></span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "white", marginBottom: 5, lineHeight: 1.35 }}>
          {getQuestDescription(q)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <VolProgressTrack
            fitHeight={14}
            fill={pct}
            fillBackground={
              ready
                ? "linear-gradient(90deg, #FFD700, #FFAB40)"
                : q.isWeekly
                  ? "linear-gradient(90deg, #FFD700, #FF6E40)"
                  : q.isPaid
                    ? "linear-gradient(90deg, #FFC107, #FF9800)"
                    : "linear-gradient(90deg, #4DD0E1, #0097A7)"
            }
            style={{ flex: 1 }}
          />
          <span style={{
            fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 700,
            fontVariantNumeric: "tabular-nums", minWidth: 54, textAlign: "right",
          }}>
            {q.progress} / {q.target}
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#FFD700", fontWeight: 700 }}>
          <EmojiIcon emoji="🎁" size={18} /> {getQuestRewardLabel(q)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        {q.reward.type === "chest" && q.reward.chestRarity ? (
          <ChestVisual rarity={q.reward.chestRarity} size={50} animated={!ready} />
        ) : q.reward.type === "coins" ? (
          <CoinIcon size={44} static />
        ) : q.reward.type === "gems" ? (
          <GemIcon size={44} static />
        ) : q.reward.type === "powerPoints" ? (
          <PowerIcon size={44} static />
        ) : null}
        <div
          className={`ui-btn ${
            lockedPaid ? "ui-btn--ghost" : ready ? "ui-btn--success" : "ui-btn--ghost"
          }`}
          style={{
            width: 96,
            padding: "8px 0",
            fontSize: 10,
            letterSpacing: "0.06em",
            textAlign: "center",
            cursor: "default",
            pointerEvents: "none",
            lineHeight: 1.25,
          }}
        >
          {lockedPaid
            ? t("quests.needStarPass")
            : ready
              ? t("quests.autoCollectHint")
              : t("common.inProgress")}
        </div>
      </div>
    </div>
  );
}

export default function QuestsModal({ onClose }: Props) {
  const { t } = useI18n();
  const [pool, setPool] = useState<QuestPool | null>(null);
  const [hasPaidPass, setHasPaidPass] = useState(false);
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<"daily" | "weekly" | "paid" | "all">("all");

  useEffect(() => {
    setPool(getQuestPool());
    const profile = getCurrentProfile();
    setHasPaidPass(!!profile?.clashPassPaid);
    const id = setInterval(() => {
      setTick(t => t + 1);
      setPool(getQuestPool());
    }, 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!pool) return null;

  const allQuests = sortQuestsForDisplay(pool.activeQuests.filter(q => !q.claimed));
  const dailyQuests  = sortQuestsForDisplay(allQuests.filter(q => !q.isWeekly && !q.isPaid));
  const weeklyQuests = sortQuestsForDisplay(allQuests.filter(q => q.isWeekly));
  const paidQuests   = sortQuestsForDisplay(allQuests.filter(q => q.isPaid));
  const activeCount  = allQuests.length;

  const tabQuests =
    tab === "daily"  ? dailyQuests  :
    tab === "weekly" ? weeklyQuests :
    tab === "paid"   ? paidQuests   :
    allQuests;

  const nextDaily  = timeUntilDaily(pool);
  const nextWeekly = timeUntilWeekly(pool);
  const nextPaid   = timeUntilPaid(pool);

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        ...glassOverlayStyle,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "8px 10px",
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pop { from { transform: scale(0.93); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes questFill {
          0%   { background-position: -100% 0; }
          100% { background-position:  200% 0; }
        }
        .quest-scroll::-webkit-scrollbar { width: 5px }
        .quest-scroll::-webkit-scrollbar-track { background: transparent }
        .quest-scroll::-webkit-scrollbar-thumb { background: rgba(255,215,0,0.35); border-radius: 10px }
      `}</style>
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22 }}
        style={{
          ...glassPanelStyle(QUEST_GLASS, {
            width: "min(640px, 92vw)",
            maxHeight: "min(76vh, 660px)",
            padding: "12px 14px 10px",
          }),
          height: "min(76vh, 660px)",
        }}
      >
        <div style={glassRadialStyle(QUEST_GLASS)} />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 6, paddingRight: 44, flexShrink: 0, position: "relative" }}>
          <ModalCloseButton
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{ top: 0, right: 0, zIndex: 20 }}
          />
          <div style={{
            fontSize: 20, fontWeight: 900, letterSpacing: 2,
            background: "linear-gradient(135deg, #FFD700, #CE93D8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            <Tr id="quests.title" />
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 2, lineHeight: 1.3 }}>
            <Tr id="quests.subtitleAutoCollect" params={{ max: MAX_ACTIVE_QUESTS }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", flexShrink: 0 }}>
          <div className="ui-pill" style={{
            background: "linear-gradient(135deg, rgba(77,208,225,0.22), rgba(77,208,225,0.10))",
            border: "1px solid rgba(77,208,225,0.55)",
            color: "var(--c-cyan-3)", fontSize: 11, fontWeight: 800,
            padding: "5px 10px",
          }}>
            {t("quests.dailyReset", { time: nextDaily > 0 ? formatHmsShort(nextDaily) : t("common.now") })}
          </div>
          <div className="ui-pill" style={{
            background: "linear-gradient(135deg, rgba(138,43,226,0.30), rgba(138,43,226,0.12))",
            border: "1px solid var(--bd-violet)",
            color: "var(--c-violet-4)", fontSize: 11, fontWeight: 800,
            padding: "5px 10px",
          }}>
            {t("quests.weeklyReset", { time: nextWeekly > 0 ? formatHmsShort(nextWeekly) : t("common.now") })}
          </div>
          <div className="ui-pill" style={{
            background: "linear-gradient(135deg, rgba(255,193,7,0.28), rgba(255,152,0,0.12))",
            border: "1px solid rgba(255,193,7,0.55)",
            color: "#FFD54F", fontSize: 11, fontWeight: 800,
            padding: "5px 10px",
          }}>
            {t("quests.paidReset", { time: nextPaid > 0 ? formatHmsShort(nextPaid) : t("common.now") })}
          </div>
          <div className="ui-pill" style={{
            marginLeft: "auto",
            color: "var(--t-2)", fontSize: 11, fontWeight: 800,
            padding: "5px 10px",
          }}>
            <Tr id="quests.activeCount" params={{ current: activeCount, max: MAX_ACTIVE_QUESTS }} />
          </div>
        </div>

        <div className="ui-tab-bar" style={{ marginBottom: 6, flexShrink: 0, flexWrap: "wrap" }}>
          {(["all", "daily", "weekly", "paid"] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`ui-tab ${tab === tabKey ? "is-active" : ""}`}
              style={{
                flex: "1 1 22%",
                minWidth: 72,
                ...(tab === tabKey ? {
                  background: tabKey === "weekly"
                    ? "linear-gradient(135deg, rgba(123,47,190,0.6), rgba(206,147,216,0.4))"
                    : tabKey === "paid"
                      ? "linear-gradient(135deg, rgba(255,193,7,0.55), rgba(255,152,0,0.35))"
                      : "linear-gradient(135deg, rgba(0,151,167,0.55), rgba(77,208,225,0.4))",
                  borderColor: tabKey === "weekly" ? "var(--bd-violet)" : tabKey === "paid" ? "rgba(255,193,7,0.7)" : "var(--bd-cyan)",
                  color: "#fff",
                  boxShadow: tabKey === "weekly"
                    ? "var(--sh-glow-violet), inset 0 1px 0 rgba(255,255,255,0.18)"
                    : tabKey === "paid"
                      ? "0 4px 16px rgba(255,193,7,0.4), inset 0 1px 0 rgba(255,255,255,0.18)"
                      : "0 4px 16px rgba(77,208,225,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
                } : {}),
              }}
            >
              {tabKey === "all"
                ? t("quests.tab.all", { count: allQuests.length })
                : tabKey === "daily"
                  ? t("quests.tab.daily", { count: dailyQuests.length })
                  : tabKey === "weekly"
                    ? t("quests.tab.weekly", { count: weeklyQuests.length })
                    : t("quests.tab.paid", { count: paidQuests.length })}
            </button>
          ))}
        </div>

        <div
          className="quest-scroll"
          style={{
            flex: 1, minHeight: 0, overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 10,
            padding: "4px 2px 14px",
          }}
        >
          {tabQuests.length === 0 ? (
            <div style={{
              textAlign: "center", color: "rgba(255,255,255,0.4)",
              padding: "40px 20px", fontSize: 14,
            }}>
              {tab === "daily" ? t("quests.empty.daily") :
               tab === "weekly" ? t("quests.empty.weekly") :
               tab === "paid" ? t("quests.empty.paid") :
               t("quests.empty.all")}
            </div>
          ) : (
            tabQuests.map(q => (
              <QuestCard key={q.id} q={q} hasPaidPass={hasPaidPass} />
            ))
          )}
        </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
