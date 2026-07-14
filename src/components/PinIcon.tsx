/**
 * PinIcon — renders a pin PNG inside a static rarity frame.
 */
import {
  PIN_KIND_META,
  parsePinId, isUniversalPinId, getUniversalPin,
  isCollectiblePinId, getCollectiblePin,
} from "../entities/PinData";
import { COLLECTIBLE_PIN_RARITY_LABEL, PIN_PUBLIC_LABEL } from "../entities/CollectiblePinData";
import { getCustomizationAssetBaseUrl } from "../lib/assetBase";
import { EmojiIcon } from "./EmojiIcon";

interface PinIconProps {
  pinId: string;
  size?: number;
  /** Faded look for locked / not-owned pins. */
  locked?: boolean;
  /** Soft outer glow (static, no animation). */
  glow?: boolean;
  /** @deprecated No-op — animations removed for performance. */
  animated?: boolean;
  badge?: React.ReactNode;
  title?: string;
  /** In-battle: artwork only, no frame. */
  bare?: boolean;
  /** Image loading hint — use "eager" for above-the-fold / intro cards. */
  loading?: "lazy" | "eager";
}

export function getPinImageSrc(
  pinId: string,
  base = (import.meta as any).env?.BASE_URL ?? "/",
): string | null {
  const assetBase = getCustomizationAssetBaseUrl(base);
  if (isUniversalPinId(pinId)) {
    return getUniversalPin(pinId) ? `${assetBase}pins/general/${pinId}.png` : null;
  }
  if (isCollectiblePinId(pinId) && getCollectiblePin(pinId)) {
    return `${assetBase}pins/game/${pinId}.png`;
  }
  const parsed = parsePinId(pinId);
  if (!parsed) return null;
  return `${assetBase}pins/characters/${parsed.brawlerId}/${parsed.kind}.png`;
}

const PIN_ART_FILL = 0.86;

export default function PinIcon({
  pinId,
  size = 56,
  locked = false,
  glow = false,
  badge,
  title,
  bare = false,
  loading = "lazy",
}: PinIconProps) {
  const src = getPinImageSrc(pinId);
  const tooltip = title ?? PIN_PUBLIC_LABEL;

  const parsedChar = !isCollectiblePinId(pinId) && !isUniversalPinId(pinId) ? parsePinId(pinId) : null;

  if (bare && src) {
    return (
      <img
        src={src}
        alt=""
        title={tooltip}
        draggable={false}
        loading={loading}
        decoding="async"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          objectPosition: "center center",
          display: "block",
          pointerEvents: "none",
          background: parsedChar ? "transparent" : undefined,
        }}
      />
    );
  }

  if (isCollectiblePinId(pinId)) {
    const c = getCollectiblePin(pinId);
    if (!c) return null;
    const goldFrame = c.goldenFrame || c.rarity === "golden";
    return (
      <PinFrame
        size={size}
        rim={goldFrame ? "#FFD700" : c.color}
        rimSecondary={goldFrame ? "#FF8F00" : c.secondaryColor}
        glow={glow}
        title={tooltip}
        locked={locked}
        badge={badge}
      >
        <PinImage src={src!} fill={PIN_ART_FILL} />
      </PinFrame>
    );
  }

  if (isUniversalPinId(pinId)) {
    const u = getUniversalPin(pinId);
    if (!u) return null;
    return (
      <PinFrame
        size={size}
        rim={u.color}
        rimSecondary={u.secondaryColor}
        glow={glow}
        title={tooltip}
        locked={locked}
        badge={badge}
      >
        <PinImage src={src!} fill={PIN_ART_FILL} />
      </PinFrame>
    );
  }

  if (!parsedChar) return null;
  const meta = PIN_KIND_META[parsedChar.kind];
  const isVerdeletta = parsedChar.brawlerId === "verdeletta";

  return (
    <PinFrame
      size={size}
      rim={meta.color}
      rimSecondary={meta.secondaryColor}
      glow={glow}
      title={tooltip}
      locked={locked}
      badge={badge}
      artOnly
    >
      <PinImage
        src={src!}
        fill={isVerdeletta ? 1.08 : 0.9}
        layout="bare"
      />
    </PinFrame>
  );
}

function PinImage({
  src,
  fill = PIN_ART_FILL,
  layout = "framed",
}: {
  src: string;
  fill?: number;
  layout?: "framed" | "bare";
}) {
  const pct = `${Math.round(fill * 100)}%`;
  const shared = {
    objectFit: "contain" as const,
    objectPosition: "center center" as const,
    pointerEvents: "none" as const,
    display: "block" as const,
    margin: "auto" as const,
  };

  if (layout === "bare") {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        style={{
          width: pct,
          height: pct,
          maxWidth: "100%",
          maxHeight: "100%",
          ...shared,
        }}
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      style={{
        width: pct,
        height: pct,
        maxWidth: "100%",
        maxHeight: "100%",
        ...shared,
      }}
    />
  );
}

function PinFrame({
  size, rim, rimSecondary, glow, locked, badge, title, children, artOnly = false,
}: {
  size: number;
  rim: string;
  rimSecondary: string;
  glow?: boolean;
  locked?: boolean;
  badge?: React.ReactNode;
  title?: string;
  children?: React.ReactNode;
  artOnly?: boolean;
}) {
  if (artOnly) {
    return (
      <div
        title={title}
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
          overflow: "visible",
          filter: locked ? "grayscale(1) brightness(0.75)" : undefined,
        }}
      >
        {children}
        {locked && <PinLockBadge size={size} />}
        {badge && (
          <div style={{ position: "absolute", top: -4, right: -4, zIndex: 4 }}>{badge}</div>
        )}
      </div>
    );
  }

  const ringThickness = Math.max(2, Math.round(size * 0.07));

  return (
    <div
      title={title}
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "24%",
          padding: ringThickness,
          background: `linear-gradient(135deg, ${rim} 0%, ${rimSecondary} 100%)`,
          boxShadow: glow
            ? `0 0 10px ${rim}88`
            : "0 2px 5px rgba(0,0,0,0.35)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: ringThickness,
          borderRadius: "20%",
          overflow: "hidden",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          filter: locked ? "grayscale(1) brightness(0.75)" : undefined,
        }}
      >
        {children}
      </div>

      {locked && <PinLockBadge size={size} ringThickness={ringThickness} />}
      {badge && (
        <div style={{ position: "absolute", top: -4, right: -4, zIndex: 4 }}>
          {badge}
        </div>
      )}
    </div>
  );
}

function PinLockBadge({ size, ringThickness = 0 }: { size: number; ringThickness?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: Math.max(0, ringThickness - 2),
        right: Math.max(0, ringThickness - 2),
        zIndex: 6,
        width: Math.max(14, size * 0.28),
        height: Math.max(14, size * 0.28),
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(20,20,28,0.9)",
        border: "1px solid rgba(255,255,255,0.3)",
        fontSize: Math.max(8, size * 0.15),
        lineHeight: 1,
        pointerEvents: "none",
      }}
    ><EmojiIcon emoji="🔒" size={24} /></div>
  );
}
