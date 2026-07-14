import type { CSSProperties } from "react";
import { getPortraitBackgroundImageSrc } from "../utils/portraitBackgroundUtils";

interface Props {
  backgroundId: string;
  brawlerColor?: string;
  base?: string;
  style?: CSSProperties;
  /** Subtle brawler tint overlay for cohesion. */
  tint?: boolean;
}

export default function PortraitFrameBackdrop({
  backgroundId,
  brawlerColor,
  base = "",
  style,
  tint = true,
}: Props) {
  const src = getPortraitBackgroundImageSrc(backgroundId, base);

  return (
    <>
      <img
        src={src}
        alt=""
        loading="eager"
        decoding="async"
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "fill",
          objectPosition: "center center",
          pointerEvents: "none",
          userSelect: "none",
          ...style,
        }}
      />
      {tint && brawlerColor && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, ${brawlerColor}44 0%, rgba(8,12,24,0.55) 55%, rgba(8,12,24,0.88) 100%)`,
            pointerEvents: "none",
          }}
        />
      )}
    </>
  );
}
