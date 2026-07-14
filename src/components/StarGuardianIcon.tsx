import type { CSSProperties } from "react";

interface Props {
  size?: number;
  style?: CSSProperties;
  alt?: string;
}

export default function StarGuardianIcon({ size = 32, style, alt = "" }: Props) {
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  return (
    <img
      src={`${base}ui/star-guardian-icon.png`}
      alt={alt}
      draggable={false}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        flexShrink: 0,
        background: "none",
        backgroundColor: "transparent",
        display: "block",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}
