import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { getModeIconUrl } from "../utils/modeAssets";
import { ensureUiImage, getCachedUiImageUrl } from "../utils/uiImageRetry";

interface ModeIconImgProps {
  modeId: string;
  alt?: string;
  size?: number;
  color?: string;
  /** PNG с прозрачностью — без цветного ореола и без подложки */
  bare?: boolean;
  style?: CSSProperties;
}

export default function ModeIconImg({ modeId, alt = "", size = 72, color, bare = false, style }: ModeIconImgProps) {
  const iconUrl = getModeIconUrl(modeId);
  const [src, setSrc] = useState(() => getCachedUiImageUrl(iconUrl) ?? iconUrl);

  useEffect(() => {
    let alive = true;
    setSrc(getCachedUiImageUrl(iconUrl) ?? iconUrl);
    void ensureUiImage(iconUrl).then((resolved) => {
      if (alive) {
        setSrc(resolved);
      }
    });
    return () => { alive = false; };
  }, [iconUrl]);

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        flexShrink: 0,
        background: "transparent",
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt}
        className="ui-game-icon"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "transparent",
          filter: !bare && color ? `drop-shadow(0 0 12px ${color}88)` : undefined,
        }}
      />
    </div>
  );
}
