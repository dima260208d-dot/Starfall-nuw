import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useI18n } from "../i18n";
import {
  getCurrentProfile,
  canClaimDailyLadder,
  dailyLadderTimeLeft,
  claimDailyLadderReward,
} from "../utils/localStorageAPI";
import { getRewardForDay, type DailyReward } from "../utils/dailyLadder";
import { formatHmsShort } from "../utils/quests";
import DailyRewardVisual from "./DailyRewardVisual";
import ModalCloseButton from "./ModalCloseButton";
import RewardDropModal, { type RewardInfo } from "./RewardDropModal";
import { Tr  } from "../i18n/Tr";
import {
  GLASS_THEMES, glassOverlayStyle, glassPanelStyle, glassRadialStyle,
} from "../utils/glassModalTheme";

interface Props {
  onClose: () => void;
}

const THEME = GLASS_THEMES.gold;

function formatDailyRewardLabel(
  reward: DailyReward,
  t: (key: string, params?: Record<string, string | number>) => string,
  compact = false,
): string {
  if (reward.type === "chest") {
    const chestKey = reward.chestRarity === "mythic" ? "daily.chest.mythic"
      : reward.chestRarity === "legendary" ? "daily.chest.legendary"
      : reward.chestRarity === "mega" ? "daily.chest.mega"
      : "daily.chest.epic";
    return t(chestKey);
  }
  if (reward.type === "gems") {
    return t(compact ? "daily.compactGems" : "daily.reward.gems", { count: reward.amount });
  }
  if (reward.type === "powerPoints") {
    return t(compact ? "daily.compactPower" : "daily.reward.power", { count: reward.amount });
  }
  if (reward.type === "xp") {
    return t(compact ? "daily.compactPassXp" : "daily.reward.passXp", { count: reward.amount });
  }
  return t(compact ? "daily.compactCoins" : "daily.reward.coins", { count: reward.amount });
}

export default function DailyRewardModal({ onClose }: Props) {
  const { t } = useI18n();
  const [profile, setProfile] = useState(getCurrentProfile());
  const [, setTick] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pendingReward, setPendingReward] = useState<RewardInfo | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!profile) return null;
  const canClaim = canClaimDailyLadder(profile);
  const left = dailyLadderTimeLeft(profile);
  const todayDay = profile.dailyLadderDay;

  const todayReward = getRewardForDay(todayDay);
  const upcoming: { day: number; reward: DailyReward }[] = [];
  for (let i = 1; i <= 5; i++) {
    upcoming.push({ day: todayDay + i, reward: getRewardForDay(todayDay + i) });
  }

  const handleClaim = () => {
    const r = claimDailyLadderReward();
    setProfile(getCurrentProfile());
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

  return (
    <>
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        ...glassOverlayStyle,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <style>{`
        @keyframes bonusGlow {
          0%, 100% { box-shadow: 0 0 25px rgba(255,215,0,0.35); }
          50%      { box-shadow: 0 0 55px rgba(255,215,0,0.65); }
        }
      `}</style>
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.22 }}
        style={{
          ...glassPanelStyle(THEME, { width: "min(720px, 95vw)", maxHeight: "min(92vh, 900px)" }),
          overflowY: "auto",
        }}
      >
        <div style={glassRadialStyle(THEME)} />
        <ModalCloseButton onClick={onClose} style={{ top: 10, right: 10, zIndex: 2 }} />

        <motion.div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            fontSize: 26, fontWeight: 900, letterSpacing: 2,
            background: "linear-gradient(135deg, #FFD700, #FF8A00)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: 4,
          }}>
            <Tr id="daily.title" />
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 16 }}>
            <Tr id="daily.subtitle" />
          </div>

          <div style={{
            background: `linear-gradient(160deg, ${todayReward.color}28, rgba(30,12,50,0.35))`,
            border: `1px solid ${canClaim ? "rgba(255,213,79,0.55)" : "rgba(255,255,255,0.12)"}`,
            borderRadius: "var(--r-lg)",
            padding: 18,
            display: "grid",
            gridTemplateColumns: "120px 1fr 150px",
            gap: 16, alignItems: "center",
            animation: canClaim ? "bonusGlow 2s ease-in-out infinite" : undefined,
            backdropFilter: "blur(6px)",
          }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <DailyRewardVisual reward={todayReward} size={100} animated={canClaim} />
            </div>
            <div>
              <motion.div style={{
                fontSize: 11, color: canClaim ? "#FFD700" : "rgba(255,255,255,0.5)",
                fontWeight: 800, letterSpacing: 2, marginBottom: 4,
              }}>
                {canClaim ? t("daily.todayWaiting") : t("daily.today")}  · <Tr id="daily.dayLabel" params={{ day: todayDay }} />
              </motion.div>
              <div style={{ fontSize: 22, fontWeight: 900, color: todayReward.color, lineHeight: 1.1 }}>
                {formatDailyRewardLabel(todayReward, t)}
              </div>
              {!canClaim && (
                <div style={{ marginTop: 6, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  <Tr id="daily.nextIn" params={{ time: formatHmsShort(left) }} />
                </div>
              )}
            </div>
            <button
              onClick={handleClaim}
              disabled={!canClaim}
              className={`ui-btn ui-btn--block ui-btn--lg ${canClaim ? "ui-btn--primary" : "ui-btn--ghost"}`}
              style={{ letterSpacing: "0.2em" }}
            >
              {canClaim ? t("common.claim") : t("daily.claimed")}
            </button>
          </div>

          {msg && (
            <div className="ui-glass" style={{
              margin: "12px 0 0", padding: "10px 14px",
              border: "1px solid var(--bd-gold)",
              color: "var(--c-gold-3)", textAlign: "center",
              fontWeight: 800, fontSize: 13.5,
            }}>{msg}</div>
          )}

          <div style={{ marginTop: 22, fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 2, fontWeight: 800 }}>
            <Tr id="daily.upcoming" />
          </div>
          <div style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 10,
          }}>
            {upcoming.map(({ day, reward }, i) => (
              <div key={day} className="ui-card" style={{
                background: `linear-gradient(160deg, ${reward.color}22, rgba(30,12,50,0.32))`,
                border: `1px solid ${reward.color}55`,
                borderRadius: "var(--r-md)", padding: "10px 8px",
                textAlign: "center",
                opacity: 1 - i * 0.08,
                backdropFilter: "blur(6px)",
              }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1, fontWeight: 800 }}>
                  <Tr id="daily.inDays" params={{ count: i + 1 }} />
                </div>
                <motion.div style={{
                  fontSize: 11, color: reward.color, fontWeight: 700, marginTop: 2,
                }}>
                  {t("daily.dayLabel", { day: ((day - 1) % 30) + 1 })}
                </motion.div>
                <div style={{
                  margin: "8px auto 6px", height: 60,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <DailyRewardVisual reward={reward} size={50} animated={false} />
                </div>
                <div style={{
                  fontSize: 11, color: reward.color, fontWeight: 800, lineHeight: 1.2,
                }}>
                  {formatDailyRewardLabel(reward, t, true)}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>

    {pendingReward && (
      <RewardDropModal
        reward={pendingReward}
        onDone={() => setPendingReward(null)}
      />
    )}
    </>
  );
}
