import { useEffect, useState } from "react";
import {
  getResourceListIconUrl,
  loadResourceListIcons,
  resourceListIconAssetPath,
  subscribeResourceListIcons,
  type ResourceListIconKind,
} from "../utils/resourceListIconCache";

interface Props {
  kind: ResourceListIconKind;
  size?: number;
  style?: React.CSSProperties;
  alt?: string;
}

const FALLBACK_EMOJI: Record<ResourceListIconKind, string> = {
  coins: "🪙",
  gems: "💎",
  powerPoints: "⚡",
};

/**
 * Static resource icon for reward lists (baked from GLB, transparent background).
 */
export default function ResourceListIcon({ kind, size = 36, style, alt = "" }: Props) {
  const [src, setSrc] = useState<string | null>(() => getResourceListIconUrl(kind));
  const assetPath = resourceListIconAssetPath(kind);

  useEffect(() => {
    let cancelled = false;

    const applyBaked = () => {
      const baked = getResourceListIconUrl(kind);
      if (baked && !cancelled) setSrc(baked);
      return !!baked;
    };

    if (applyBaked()) return;

    const unsub = subscribeResourceListIcons(() => {
      if (!cancelled) applyBaked();
    });

    const img = new Image();
    img.onload = () => {
      if (!cancelled) setSrc(assetPath);
    };
    img.onerror = () => {
      void loadResourceListIcons().then(() => {
        if (!cancelled) applyBaked();
      });
    };
    img.src = assetPath;

    void loadResourceListIcons().then(() => {
      if (!cancelled) applyBaked();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [kind, assetPath]);

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        draggable={false}
        style={{
          display: "inline-block",
          verticalAlign: "middle",
          objectFit: "contain",
          width: size,
          height: size,
          flexShrink: 0,
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.45))",
          ...style,
        }}
      />
    );
  }

  return (
    <span
      aria-hidden={!alt}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        fontSize: Math.round(size * 0.72),
        lineHeight: 1,
        flexShrink: 0,
        ...style,
      }}
    >
      {FALLBACK_EMOJI[kind]}
    </span>
  );
}
