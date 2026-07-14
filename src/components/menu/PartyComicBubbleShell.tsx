import type { ReactNode } from "react";

interface Props {
  width: number;
  height: number;
  children: ReactNode;
  shape?: "wide" | "tall";
}

function wideBubblePath(vbW: number, vbH: number, bodyBottom: number): string {
  const tipX = 8;
  const tipY = vbH - 4;
  return `
    M 16 6
    H ${vbW - 16}
    Q ${vbW - 6} 6 ${vbW - 6} 16
    V ${bodyBottom - 10}
    Q ${vbW - 6} ${bodyBottom} ${vbW - 16} ${bodyBottom}
    H 36
    L ${tipX} ${tipY}
    L 26 ${bodyBottom}
    H 16
    Q 6 ${bodyBottom} 6 ${bodyBottom - 10}
    V 16
    Q 6 6 16 6
    Z
  `;
}

function tallBubblePath(vbW: number, vbH: number, bodyBottom: number): string {
  const tipX = 8;
  const tipY = vbH - 4;
  return `
    M 14 6
    H ${vbW - 14}
    Q ${vbW - 6} 6 ${vbW - 6} 14
    V ${bodyBottom - 10}
    Q ${vbW - 6} ${bodyBottom} ${vbW - 14} ${bodyBottom}
    H 34
    L ${tipX} ${tipY}
    L 24 ${bodyBottom}
    H 14
    Q 6 ${bodyBottom} 6 ${bodyBottom - 10}
    V 14
    Q 6 6 14 6
    Z
  `;
}

/** Comic bubble — single clean outline, tail at bottom-left. */
export default function PartyComicBubbleShell({ width, height, children, shape = "wide" }: Props) {
  const vbW = shape === "wide" ? 112 : 104;
  const vbH = shape === "wide" ? 88 : 118;
  const bodyBottom = shape === "wide" ? 72 : 102;
  const d = shape === "wide"
    ? wideBubblePath(vbW, vbH, bodyBottom)
    : tallBubblePath(vbW, vbH, bodyBottom);

  return (
    <div style={{ position: "relative", width, height, flexShrink: 0 }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${vbW} ${vbH}`}
        style={{ display: "block", overflow: "visible" }}
        aria-hidden
      >
        <path
          d={d}
          fill="#ffffff"
          stroke="#1a1a1a"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: shape === "wide" ? "14%" : "10%",
          right: "8%",
          top: shape === "wide" ? "8%" : "6%",
          bottom: shape === "wide" ? "22%" : "18%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
