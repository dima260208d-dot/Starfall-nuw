import { useMemo } from "react";
import { getCurrentProfile } from "../utils/localStorageAPI";
import {
  getUnclaimedProStarPassCount,
  proStarPassTokensIntoCurrentLevel,
  PRO_STAR_PASS_MAX_LEVEL,
} from "../utils/proStarPass";
import { useI18n } from "../i18n";
import { publicAssetBase } from "../utils/modeAssets";
import ProPassTokenProgressBar from "./ProPassTokenProgressBar";
import { Tr } from "../i18n/Tr";

interface Props {
  onOpen: () => void;
  compact?: boolean;
  fill?: boolean;
}

const HERO = `${publicAssetBase}images/pro-star-pass-hero.png`;

const FOOTER_H = "13%";
const FOOTER_MIN = 30;

export default function ProStarPassMenuCard({ onOpen, compact, fill }: Props) {
  const { t } = useI18n();
  const profile = getCurrentProfile();
  const progress = useMemo(
    () => proStarPassTokensIntoCurrentLevel(profile?.proStarPassTokens ?? 0),
    [profile?.proStarPassTokens],
  );
  const badge = profile ? getUnclaimedProStarPassCount(profile) : 0;
  const levelLabel = progress.isInfinite || progress.level > PRO_STAR_PASS_MAX_LEVEL
    ? `∞${progress.level - PRO_STAR_PASS_MAX_LEVEL}`
    : String(Math.min(progress.level, PRO_STAR_PASS_MAX_LEVEL));

  const w = fill ? "100%" : (compact ? 108 : 148);
  const h = fill ? "100%" : (compact ? 168 : 228);
  const hudBottom = `calc(${FOOTER_H} + ${fill ? 8 : compact ? 6 : 7}px)`;
  const barVariant = fill ? "menuFill" as const : compact ? "compact" as const : "menu" as const;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("proPass.title")}
      style={{
        position: "relative",
        width: w,
        height: h,
        minHeight: fill ? 0 : undefined,
        maxHeight: fill ? "100%" : undefined,
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        flexShrink: 0,
        filter: "drop-shadow(0 10px 28px rgba(123,47,190,0.55))",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: fill ? 20 : 18,
          overflow: "hidden",
          background: "#1a0a3a",
          border: "3px solid rgba(255,213,79,0.45)",
          boxShadow: "inset 0 2px 14px rgba(255,255,255,0.12), 0 0 24px rgba(213,0,249,0.35)",
        }}
      >
        {/* Hero — на всю плашку */}
        <img
          src={HERO}
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

        {/* Лёгкое затемнение снизу — читаемость HUD поверх арта */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "42%",
            background: "linear-gradient(180deg, transparent 0%, rgba(10,0,24,0.55) 45%, rgba(10,0,24,0.82) 100%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 50% 12%, rgba(255,213,79,0.1) 0%, transparent 50%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Вешалка */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "30%",
            minWidth: 34,
            maxWidth: 52,
            height: "5%",
            minHeight: 12,
            maxHeight: 16,
            borderRadius: "0 0 8px 8px",
            background: "linear-gradient(180deg, #FFD700, #FF8F00)",
            border: "2px solid rgba(255,255,255,0.5)",
            borderTop: "none",
            zIndex: 4,
          }}
        />

        {/* Полоса жетонов на всю ширину плашки */}
        <div
          style={{
            position: "absolute",
            left: fill ? 8 : 8,
            right: fill ? 8 : 8,
            bottom: hudBottom,
            zIndex: 5,
          }}
        >
          <ProPassTokenProgressBar
            intoLevel={progress.intoLevel}
            needed={progress.needed}
            levelLabel={levelLabel}
            variant={barVariant}
          />
        </div>

        {/* PRO PASS */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: FOOTER_H,
            minHeight: FOOTER_MIN,
            zIndex: 6,
            background: "linear-gradient(180deg, #c6ff00, #76ff03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: fill ? "clamp(11px, 1.7vw, 15px)" : (compact ? 10 : 12),
            fontWeight: 900,
            letterSpacing: "0.14em",
            color: "#1a0a3a",
            textShadow: "0 1px 0 rgba(255,255,255,0.35)",
            boxShadow: "0 -2px 12px rgba(0,0,0,0.35)",
          }}
        >
          <Tr id="proPass.badge" />
        </div>
      </div>

      {badge > 0 && (
        <div
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            background: "#ff1744",
            border: "2px solid #fff",
            color: "#fff",
            fontSize: 11,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 5px",
            zIndex: 10,
          }}
        >
          {badge > 99 ? "99+" : badge}
        </div>
      )}
    </button>
  );
}
