import { useEffect, useRef, useState, type CSSProperties } from "react";
import { resolveUsernameStyle } from "../utils/usernameDisplay";

interface Props {
  name: string;
  colorValue?: string | null;
  subActive?: boolean;
  maxSize?: number;
  minSize?: number;
  fontWeight?: number;
  style?: CSSProperties;
  className?: string;
}

/** Player name with solid or Star Guardian shimmer styling. */
export default function UsernameDisplay({
  name,
  colorValue,
  subActive,
  maxSize = 22,
  minSize = 13,
  fontWeight = 900,
  style,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(maxSize);
  const resolved = resolveUsernameStyle(colorValue, subActive);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    let size = maxSize;
    measure.style.fontSize = `${size}px`;
    while (size > minSize && measure.scrollWidth > container.clientWidth) {
      size -= 1;
      measure.style.fontSize = `${size}px`;
    }
    setFontSize(size);
  }, [name, maxSize, minSize, resolved.kind]);

  const textStyle: CSSProperties = {
    display: "inline-block",
    maxWidth: "100%",
    fontSize,
    fontWeight,
    lineHeight: 1.05,
    whiteSpace: "nowrap",
    ...style,
  };

  if (resolved.kind === "shimmer") {
    return (
      <div ref={containerRef} style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <span
          ref={measureRef}
          className={`subscriber-name-shimmer${className ? ` ${className}` : ""}`}
          style={{
            ...textStyle,
            backgroundImage: resolved.def.gradient,
            filter: `drop-shadow(0 0 5px ${resolved.def.glow}) drop-shadow(0 1px 2px rgba(0,0,0,0.7))`,
          }}
        >
          {name}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
      <span
        ref={measureRef}
        className={className}
        style={{
          ...textStyle,
          color: resolved.color,
        }}
      >
        {name}
      </span>
    </div>
  );
}
