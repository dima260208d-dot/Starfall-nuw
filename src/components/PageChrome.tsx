/**
 * Shared "page chrome" primitives that give every menu the same modern,
 * polished look: a generated full-screen background, a unified back-button,
 * gradient page titles, and a glass resource bar.
 *
 * Pages opt-in by wrapping their content in <PageBg variant="shop"> ... etc.
 */
import { CSSProperties, ReactNode, forwardRef } from "react";
import { CoinIcon, GemIcon, PowerIcon, TrophyIcon } from "./GameIcons";
import { useI18nOptional } from "../i18n";

type BgVariant =
  | "shop"
  | "customization"
  | "clashpass"
  | "trophyroad"
  | "chests"
  | "modeselect"
  | "profile"
  | "clubs"
  | "news"
  | "settings"
  | "admin"
  | "collection"
  | "megasquad"
  | "starguardian"
  | "friends"
  | "menu"
  | "battle"
  | "records"
  | "accounts"
  | "feed"
  | "mastery"
  | "rankRewards"
  | "starfeats"
  | "friendshipRewards"
  | "comics"
  | "none";

const BG_FILES: Record<BgVariant, string | null> = {
  shop: "shop-bg.png",
  customization: "customization-bg.png",
  clashpass: "clashpass-bg.png",
  trophyroad: "trophyroad-bg.png",
  chests: "chests-bg.png",
  modeselect: "modeselect-bg.png",
  profile: "profile-bg.png",
  clubs: "clubs-bg.png",
  news: "news-bg.png",
  settings: "settings-bg.png",
  admin: "admin-bg.png",
  collection: "collection-bg.png",
  megasquad: "megasquad-bg.png",
  starguardian: "constellation-bg.png",
  friends: "friends-bg.png",
  records: "records-bg.png",
  accounts: "accounts-bg.png",
  feed: "feed-bg.png",
  mastery: "mastery-bg.png",
  rankRewards: "rank-rewards-bg.png",
  starfeats: "starfeats-bg.png",
  friendshipRewards: "friendship-rewards-bg.png",
  comics: "comics-bg.png",
  menu: "main-menu-bg.png",
  battle: "loading-battle.png",
  none: null,
};

import { resolvePublicAssetUrl } from "../lib/assetBase";

export function PageBg({
  variant,
  children,
  style,
  className,
}: {
  variant: BgVariant;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const file = BG_FILES[variant];
  const bgImage = file ? `url("${resolvePublicAssetUrl(file)}")` : "none";
  const bgFallback = "radial-gradient(ellipse at 50% 40%, #1a0040 0%, #0a0028 70%, #000015 100%)";
  return (
    <div
      className={`ui-page-bg ${className ?? ""}`}
      style={{
        backgroundImage: bgImage === "none" ? bgFallback : `${bgImage}, ${bgFallback}`,
        minHeight: "100%",
        height: "100%",
        maxHeight: "100%",
        width: "100%",
        color: "var(--t-1)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function BackButton({
  onClick,
  label,
  style,
}: {
  onClick: () => void;
  label?: string;
  style?: CSSProperties;
}) {
  const { t } = useI18nOptional();
  const displayLabel = label ?? t("common.back");
  return (
    <button onClick={onClick} className="ui-back-btn" style={style}>
      <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>←</span>
      {displayLabel}
    </button>
  );
}

export function PageTitle({
  children,
  subtitle,
  align = "center",
  style,
}: {
  children: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  style?: CSSProperties;
}) {
  return (
    <div style={{ textAlign: align }}>
      <h1
        className="ui-page-title"
        style={{
          textAlign: align,
          ...style,
        }}
      >
        {children}
      </h1>
      {subtitle && (
        <div
          className="ui-page-subtitle"
          style={{ textAlign: align, marginTop: 8 }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

interface ResourceBarProps {
  coins?: number;
  gems?: number;
  power?: number;
  trophies?: number;
  size?: "sm" | "md";
  style?: CSSProperties;
}

export function ResourceBar({
  coins,
  gems,
  power,
  trophies,
  size = "md",
  style,
}: ResourceBarProps) {
  const iconSize = size === "sm" ? 22 : 28;
  const fs = size === "sm" ? 12 : 14;
  return (
    <div className="ui-resource-bar" style={style}>
      {trophies !== undefined && (
        <span
          className="ui-resource-pill ui-resource-pill--trophy"
          style={{ fontSize: fs }}
        >
          <TrophyIcon size={iconSize} />
          {trophies.toLocaleString("ru-RU")}
        </span>
      )}
      {coins !== undefined && (
        <span
          className="ui-resource-pill ui-resource-pill--gold"
          style={{ fontSize: fs }}
        >
          <CoinIcon size={iconSize} />
          {coins.toLocaleString("ru-RU")}
        </span>
      )}
      {gems !== undefined && (
        <span
          className="ui-resource-pill ui-resource-pill--cyan"
          style={{ fontSize: fs }}
        >
          <GemIcon size={iconSize} />
          {gems.toLocaleString("ru-RU")}
        </span>
      )}
      {power !== undefined && (
        <span
          className="ui-resource-pill ui-resource-pill--violet"
          style={{ fontSize: fs }}
        >
          <PowerIcon size={iconSize} />
          {power.toLocaleString("ru-RU")}
        </span>
      )}
    </div>
  );
}

/** Fixed toolbar row under the header (tabs, filters). Does not scroll with content. */
export function PageToolbar({
  children,
  style,
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        position: "relative",
        zIndex: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Scrollable page body — header/toolbar stay fixed above. */
export const PageBody = forwardRef<HTMLDivElement, {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}>(function PageBody({ children, style, className }, ref) {
  return (
    <div
      ref={ref}
      className={className}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        position: "relative",
        ...style,
      }}
    >
      {children}
    </div>
  );
});

/**
 * Unified page header strip used at the top of nearly every page:
 *   ←Назад  ........  Title  ........  ResourceBar
 * It places the title centered on screen and the resources on the right.
 */
export function PageHeader({
  onBack,
  title,
  titleColor,
  right,
  bottom,
  coins,
  gems,
  power,
  trophies,
  compact,
  transparent,
}: {
  onBack: () => void;
  title: ReactNode;
  titleColor?: string;
  right?: ReactNode;
  /** Extra strip inside the header (below title row), e.g. Star Pass daily XP. */
  bottom?: ReactNode;
  coins?: number;
  gems?: number;
  power?: number;
  trophies?: number;
  compact?: boolean;
  /** No background, border, or blur — title floats over page art. */
  transparent?: boolean;
}) {
  const showResources =
    coins !== undefined ||
    gems !== undefined ||
    power !== undefined ||
    trophies !== undefined;
  const rowPad = compact ? "10px 14px" : "14px 22px";
  const rowPadWithBottom = compact ? "10px 14px 8px" : "14px 22px 10px";
  return (
    <div
      style={{
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
        borderBottom: transparent ? "none" : "1px solid var(--bd-1)",
        background: transparent
          ? "transparent"
          : "linear-gradient(180deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.18) 100%)",
        backdropFilter: transparent ? "none" : "blur(10px) saturate(1.15)",
        WebkitBackdropFilter: transparent ? "none" : "blur(10px) saturate(1.15)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: bottom ? rowPadWithBottom : rowPad,
        }}
      >
        <BackButton onClick={onBack} />
        <h2
          style={{
            flex: 1,
            textAlign: "center",
            margin: 0,
            fontSize: compact ? 18 : 22,
            fontWeight: 900,
            letterSpacing: "0.08em",
            color: titleColor ?? "transparent",
            background: titleColor
              ? "none"
              : "linear-gradient(135deg, #ffe57f 0%, #ffb300 35%, #b388ff 75%, #80d8ff 100%)",
            WebkitBackgroundClip: titleColor ? undefined : "text",
            WebkitTextFillColor: titleColor ? titleColor : "transparent",
            backgroundClip: titleColor ? undefined : "text",
            textShadow: "0 2px 18px rgba(0,0,0,0.55)",
            filter: titleColor
              ? undefined
              : "drop-shadow(0 4px 14px rgba(123,47,190,0.35))",
          }}
        >
          {title}
        </h2>
        {showResources ? (
          <ResourceBar
            coins={coins}
            gems={gems}
            power={power}
            trophies={trophies}
            size={compact ? "sm" : "md"}
          />
        ) : right ? (
          right
        ) : (
          <div style={{ width: 92 }} />
        )}
      </div>
      {bottom ? (
        <div style={{ padding: `0 ${compact ? 14 : 22}px 12px` }}>
          {bottom}
        </div>
      ) : null}
    </div>
  );
}
