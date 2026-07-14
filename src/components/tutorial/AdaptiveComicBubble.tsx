import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  maxWidth: number;
}

/** Comic speech bubble — height grows with text (no fixed SVG viewport). */
export default function AdaptiveComicBubble({ children, maxWidth }: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 240, h: 72 });

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const w = Math.min(maxWidth, Math.max(200, el.scrollWidth + 28));
    const h = Math.max(64, el.scrollHeight + 24);
    setSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, [children, maxWidth]);

  return (
    <div style={{ position: "relative", width: size.w, minHeight: size.h, flexShrink: 0 }}>
      <div
        style={{
          position: "relative",
          background: "#ffffff",
          border: "2.5px solid #1a1a1a",
          borderRadius: 16,
          padding: "12px 16px",
          minHeight: size.h - 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
        }}
      >
        <div ref={innerRef}>{children}</div>
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 18,
          bottom: -11,
          width: 0,
          height: 0,
          borderTop: "12px solid #1a1a1a",
          borderLeft: "10px solid transparent",
          borderRight: "10px solid transparent",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 20,
          bottom: -8,
          width: 0,
          height: 0,
          borderTop: "10px solid #ffffff",
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
        }}
      />
    </div>
  );
}
