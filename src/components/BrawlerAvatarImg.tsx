import type { CSSProperties, ImgHTMLAttributes } from "react";
import { brawlerAvatarUrl } from "../utils/modeAssets";

export interface BrawlerAvatarImgProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  brawlerId: string;
  size?: number;
}

/** Square brawler portrait — same asset as character menu (`brawlers/avatars/*.png`). */
export default function BrawlerAvatarImg({
  brawlerId,
  size,
  style,
  alt = "",
  ...rest
}: BrawlerAvatarImgProps) {
  return (
    <img
      src={brawlerAvatarUrl(brawlerId)}
      alt={alt}
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: "cover",
        objectPosition: "center top",
        display: "block",
        ...style,
      }}
      {...rest}
    />
  );
}
