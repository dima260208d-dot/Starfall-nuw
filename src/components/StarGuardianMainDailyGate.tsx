import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import RewardDropModal, { type RewardInfo } from "./RewardDropModal";
import StarGuardianIcon from "./StarGuardianIcon";
import { CoinIcon, GemIcon, PowerIcon } from "./GameIcons";
import {
  claimMainDaily,
  isMainDailyAvailable,
  isStarGuardianActive,
  MAIN_DAILY_COINS,
  MAIN_DAILY_GEMS,
  MAIN_DAILY_POWER,
} from "../utils/subscription";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

interface Props {
  /** Не показывать, пока идёт другая входная анимация (например, награда за победы). */
  paused?: boolean;
  onClaimed: () => void;
}

function buildMainDailyDropQueue(
  t: (key: string, params?: Record<string, string | number>) => string,
): RewardInfo[] {
  return [
    {
      type: "coins",
      amount: MAIN_DAILY_COINS,
      label: t("daily.reward.coins", { count: MAIN_DAILY_COINS }),
    },
    {
      type: "gems",
      amount: MAIN_DAILY_GEMS,
      label: t("daily.reward.gems", { count: MAIN_DAILY_GEMS }),
    },
    {
      type: "powerPoints",
      amount: MAIN_DAILY_POWER,
      label: t("daily.reward.power", { count: MAIN_DAILY_POWER }),
    },
  ];
}

/**
 * При входе в главное меню: если активна подписка и доступна главная награда дня —
 * модалка с кнопкой «Получить», затем анимация выпадения ресурсов.
 */
export default function StarGuardianMainDailyGate({ paused = false, onClaimed }: Props) {
  const { t } = useI18n();
  const [showOffer, setShowOffer] = useState(false);
  const [drop, setDrop] = useState<{ q: RewardInfo[]; i: number } | null>(null);
  const claimedTodayRef = useRef(false);
  const claimingRef = useRef(false);

  useEffect(() => {
    if (paused) return;
    claimedTodayRef.current = false;
    if (isStarGuardianActive() && isMainDailyAvailable()) {
      setShowOffer(true);
    } else {
      setShowOffer(false);
    }
  }, [paused]);

  useEffect(() => {
    const hideIfClaimed = () => {
      if (claimingRef.current) return;
      if (!isMainDailyAvailable()) {
        setShowOffer(false);
      }
    };
    window.addEventListener("clash-profile-local-changed", hideIfClaimed);
    return () => window.removeEventListener("clash-profile-local-changed", hideIfClaimed);
  }, []);

  const handleClaim = useCallback(() => {
    if (claimingRef.current || claimedTodayRef.current) return;
    if (!isMainDailyAvailable()) {
      setShowOffer(false);
      return;
    }
    claimingRef.current = true;
    const r = claimMainDaily();
    claimingRef.current = false;
    if (!r.claimed) {
      setShowOffer(false);
      return;
    }
    claimedTodayRef.current = true;
    setShowOffer(false);
    onClaimed();
    setDrop({ q: buildMainDailyDropQueue(t), i: 0 });
  }, [onClaimed, t]);

  const advanceDrop = useCallback(() => {
    setDrop((d) => {
      if (!d) return null;
      const next = d.i + 1;
      if (next >= d.q.length) return null;
      return { q: d.q, i: next };
    });
  }, []);

  const offerModal = showOffer ? (
    <div
      role="dialog"
      aria-modal
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999985,
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
          background: "linear-gradient(165deg, rgba(42,28,8,0.98), rgba(18,10,4,0.99))",
          border: "1px solid rgba(255,215,64,0.45)",
          borderRadius: 18,
          padding: "22px 24px 20px",
          boxShadow: "0 16px 48px rgba(0,0,0,0.55), 0 0 40px rgba(255,193,7,0.18)",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <StarGuardianIcon size={52} />
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: 1.2,
            color: "#FFD740",
            marginBottom: 10,
            textAlign: "center",
          }}
        >
          <Tr id="sg.rewards.entryPopupTitle" />
        </div>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.88)",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          <Tr id="sg.rewards.entryPopupDesc" />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "#FFE082" }}>
            <CoinIcon size={24} /> +{MAIN_DAILY_COINS}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "#80DEEA" }}>
            <GemIcon size={24} /> +{MAIN_DAILY_GEMS}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "#CE93D8" }}>
            <PowerIcon size={24} /> +{MAIN_DAILY_POWER}
          </span>
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
            color: "#ffffff",
            background: "linear-gradient(135deg, #FFD740, #FFB300)",
            boxShadow: "0 6px 22px rgba(255,193,7,0.45)",
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
      {offerModal ? createPortal(offerModal, getAppPortalRoot()) : null}
      {dropOpen ? <RewardDropModal reward={drop.q[drop.i]} onDone={advanceDrop} /> : null}
    </>
  );
}
