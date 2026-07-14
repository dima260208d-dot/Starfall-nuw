interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  valueSuffix?: string;
}

export function MiniBarChart({ data, height = 120, valueSuffix = "" }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, padding: "8px 4px 0" }}>
      {data.map((d) => {
        const h = Math.max(4, Math.round((d.value / max) * (height - 28)));
        return (
          <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
            <div style={{ fontSize: 9, color: "var(--t-3)", fontWeight: 700, whiteSpace: "nowrap" }}>
              {d.value}{valueSuffix}
            </div>
            <div
              style={{
                width: "100%",
                maxWidth: 36,
                height: h,
                borderRadius: "6px 6px 2px 2px",
                background: d.color ?? "linear-gradient(180deg, #FFD54F, #FF8F00)",
                boxShadow: "0 0 12px rgba(255,213,79,0.25)",
              }}
            />
            <div style={{ fontSize: 9, color: "var(--t-3)", textAlign: "center", lineHeight: 1.1 }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

interface StackedBarProps {
  data: { label: string; wins: number; losses: number }[];
  height?: number;
}

export function WinLossStackChart({ data, height = 120 }: StackedBarProps) {
  const max = Math.max(1, ...data.map((d) => d.wins + d.losses));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, padding: "8px 4px 0" }}>
      {data.map((d) => {
        const total = d.wins + d.losses;
        const barH = Math.max(4, Math.round((total / max) * (height - 24)));
        const winH = total ? Math.round((d.wins / total) * barH) : 0;
        const lossH = barH - winH;
        return (
          <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: barH, width: "100%", maxWidth: 28 }}>
              {lossH > 0 && (
                <div style={{ height: lossH, background: "rgba(255,82,82,0.75)", borderRadius: winH ? 0 : "4px 4px 0 0" }} />
              )}
              {winH > 0 && (
                <div style={{ height: winH, background: "rgba(105,240,174,0.85)", borderRadius: "4px 4px 0 0" }} />
              )}
            </div>
            <div style={{ fontSize: 9, color: "var(--t-3)", textAlign: "center" }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

interface DonutProps {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}

export function MiniDonut({ segments, size = 96 }: DonutProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const stops = segments.map((s) => {
    const start = (acc / total) * 100;
    acc += s.value;
    const end = (acc / total) * 100;
    return `${s.color} ${start}% ${end}%`;
  }).join(", ");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `conic-gradient(${stops})`,
          boxShadow: "inset 0 0 0 10px rgba(8,4,24,0.92), 0 0 20px rgba(120,80,255,0.2)",
          flexShrink: 0,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ color: "var(--t-3)" }}>{s.label}</span>
            <span style={{ fontWeight: 800, marginLeft: "auto" }}>{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ points, width = 200, height = 48, color = "#69F0AE" }: SparklineProps) {
  if (!points.length) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / Math.max(1, points.length - 1)) * width;
    const y = height - ((p - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} style={{ display: "block", maxWidth: "100%" }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords}
      />
      <polyline
        fill={`${color}22`}
        stroke="none"
        points={`0,${height} ${coords} ${width},${height}`}
      />
    </svg>
  );
}
