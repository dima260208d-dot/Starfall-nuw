import type { CSSProperties } from "react";
import { getEmojiIconPath } from "../data/emojiIconMap";

const base = () => (import.meta as any).env?.BASE_URL ?? "/";

export interface EmojiIconProps {
  emoji: string;
  size?: number;
  alt?: string;
  style?: CSSProperties;
  className?: string;
}

/** Raster game icon for a Unicode emoji (shared PNG per emoji across the whole app). */
export function EmojiIcon({ emoji, size = 20, alt = "", style, className }: EmojiIconProps) {
  const rel = getEmojiIconPath(emoji);
  if (!rel) {
    return (
      <span
        aria-hidden={!alt}
        style={{ fontSize: size * 0.85, lineHeight: 1, display: "inline-block", ...style }}
      >
        {emoji}
      </span>
    );
  }
  return (
    <img
      src={`${base()}${rel}`}
      alt={alt}
      className={className ?? "ui-game-icon"}
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

/** Split text and render emojis as EmojiIcon (for i18n strings that still contain emoji). */
export function TextWithEmojis({
  text,
  emojiSize = 27,
  style,
  className,
}: {
  text: string;
  emojiSize?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const re = /(\p{Extended_Pictographic}|\u2600-\u27BF|\uFE0F|\u200D)/gu;
  const parts = text.split(re).filter(Boolean);
  return (
    <span className={className} style={{ display: "inline", ...style }}>
      {parts.map((part, i) =>
        /\p{Extended_Pictographic}/u.test(part) || /^[\u2600-\u27BF]$/.test(part) ? (
          <EmojiIcon key={i} emoji={part} size={emojiSize} style={{ margin: "0 2px" }} />
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

/** Icon inside a ui-btn (on the button, not peeking out). */
export function BtnOnIcon({
  src,
  size = 36,
  glowColor = "rgba(255,213,79,0.7)",
  alt = "",
}: {
  src: string;
  size?: number;
  glowColor?: string;
  alt?: string;
}) {
  return (
    <img
      src={src.startsWith("ui/") ? `${base()}${src}` : src}
      alt={alt}
      className="ui-game-icon"
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        flexShrink: 0,
        pointerEvents: "none",
        filter: `drop-shadow(0 3px 10px ${glowColor})`,
      }}
    />
  );
}
