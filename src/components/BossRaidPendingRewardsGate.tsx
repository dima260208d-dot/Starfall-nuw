import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import RewardDropModal from "./RewardDropModal";
import type { RewardInfo } from "./RewardDropModal";
import { getCurrentProfile } from "../utils/localStorageAPI";
import {
  buildBossRaidPendingMenuSnapshot,
  claimBossRaidPendingRewards,
  type MergedBossRaidReward,
} from "../utils/bossRaidRewards";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

function mergedToDropQueue(merged: MergedBossRaidReward, t: (key: string, params?: Record<string, string | number>) => string): RewardInfo[] {
  const q: RewardInfo[] = [];
  if (merged.coins > 0) {
    q.push({ type: "coins", amount: merged.coins, label: `${merged.coins} $<Tr id="chest.roll.coins" />` });
  }
  if (merged.powerPoints > 0) {
    q.push({ type: "powerPoints", amount: merged.powerPoints, label: `${merged.powerPoints} $<Tr id="chest.roll.power" />` });
  }
  for (const c of merged.chests) {
    if (c.count > 0) {
      q.push({
        type: "chest",
        amount: c.count,
        chestRarity: c.rarity,
        label: t("bossRaid.chestReward", { count: c.count }),
      });
    }
  }
  return q;
}

interface Props {
  onRewardsApplied: () => void;
}

/**
 * При входе в главное меню: если есть невыданные награды рейда — модалка «Забрать»,
 * затем цепочка RewardDropModal (монеты / сила / сундуки).
 */
export default function BossRaidPendingRewardsGate({ onRewardsApplied }: Props) {
  const { t } = useI18n();
  const [summaryLines, setSummaryLines] = useState<string[] | null>(null);
  const [drop, setDrop] = useState<{ q: RewardInfo[]; i: number } | null>(null);

  useEffect(() => {
    const snap = buildBossRaidPendingMenuSnapshot(getCurrentProfile());
    if (snap) setSummaryLines(snap.lines);
  }, []);

  const handleClaim = useCallback(() => {
    const claimed = claimBossRaidPendingRewards();
    onRewardsApplied();
    setSummaryLines(null);
    if (!claimed) return;
    const q = mergedToDropQueue(claimed.merged, t);
    if (q.length === 0) return;
    setDrop({ q, i: 0 });
  }, [onRewardsApplied, t]);

  const advanceDrop = useCallback(() => {
    setDrop((d) => {
      if (!d) return null;
      const next = d.i + 1;
      if (next >= d.q.length) return null;
      return { q: d.q, i: next };
    });
  }, []);

  const summaryModal =
    summaryLines && summaryLines.length > 0 ? (
      <div
        role="dialog"
        aria-modal
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999990,
          background: "rgba(4,6,14,0.92)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Segoe UI', Arial, sans-serif",
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: "100%",
            background: "linear-gradient(165deg, rgba(30,35,55,0.98), rgba(12,14,28,0.99))",
            border: "1px solid rgba(130,177,255,0.35)",
            borderRadius: 18,
            padding: "22px 24px 20px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 0 40px rgba(100,140,255,0.12)",
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 1.2,
              color: "#e3f2fd",
              marginBottom: 14,
              textAlign: "center",
            }}
          >
            <Tr id="bossRaid.pendingTitle" />
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.88)",
              marginBottom: 18,
            }}
          >
            {summaryLines.map((line, i) => (
              <p key={i} style={{ margin: i === 0 ? "0 0 10px" : "6px 0 0" }}>
                {line}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={handleClaim}
            style={{
              width: "100%",
              padding: "14px 18px",
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: 1.5,
              color: "#1a237e",
              background: "linear-gradient(135deg, #82b1ff, #b39ddb)",
              boxShadow: "0 6px 22px rgba(100,150,255,0.45)",
            }}
          >
            <Tr id="common.claim" />
          </button>
        </div>
      </div>
    ) : null;

  const dropOpen = drop && drop.i < drop.q.length;

  return (
    <>
      {summaryModal ? createPortal(summaryModal, getAppPortalRoot()) : null}
      {dropOpen ? <RewardDropModal reward={drop.q[drop.i]} onDone={advanceDrop} /> : null}
    </>
  );
}
