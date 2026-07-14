import { useMemo, useState, type ReactNode } from "react";

function GridOverlay() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: 0.35,
        backgroundImage:
          "linear-gradient(rgba(0,229,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.04) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    />
  );
}

export function TechPanel({
  title,
  subtitle,
  accent = "#00E5FF",
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(0,20,40,0.92) 0%, rgba(0,8,18,0.96) 100%)",
        border: `1px solid ${accent}44`,
        borderRadius: 12,
        padding: 14,
        boxShadow: `0 0 24px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <GridOverlay />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2.2, color: accent, textTransform: "uppercase" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{subtitle}</div>}
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}

export function MetricTile({ label, value, sub, accent = "#00E5FF", delta }: {
  label: string; value: string | number; sub?: string; accent?: string; delta?: string;
}) {
  return (
    <div style={{
      background: `linear-gradient(180deg, ${accent}14 0%, rgba(0,0,0,0.55) 100%)`,
      border: `1px solid ${accent}55`, borderRadius: 10, padding: "10px 12px", minHeight: 72,
    }}>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", letterSpacing: 1.6, fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {(sub || delta) && (
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
          {delta && <span style={{ color: delta.startsWith("+") ? "#76FF03" : delta.startsWith("-") ? "#FF5252" : undefined }}>{delta} </span>}
          {sub}
        </div>
      )}
    </div>
  );
}

export function CollapsibleList({ title, count, defaultOpen = false, accent = "#00E5FF", children }: {
  title: string; count: number; defaultOpen?: boolean; accent?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || count <= 6);
  return (
    <div style={{ border: `1px solid ${accent}33`, borderRadius: 10, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 12px", background: `${accent}12`, border: "none", cursor: "pointer",
        color: accent, fontWeight: 900, fontSize: 11, letterSpacing: 1.5,
      }}>
        <span>{open ? "▼" : "▶"} {title}</span>
        <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>{count}</span>
      </button>
      {open && <div style={{ padding: 10, maxHeight: 360, overflowY: "auto" }}>{children}</div>}
    </div>
  );
}

export function BarChart({ data, height = 120, accent = "#00E5FF" }: {
  data: { label: string; value: number; color?: string }[]; height?: number; accent?: string;
}) {
  const max = Math.max(1, ...data.map(d => d.value));
  const w = 100 / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 100 ${height}`} width="100%" height={height} style={{ display: "block" }}>
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 24);
        const x = i * w + w * 0.15;
        const bw = w * 0.7;
        const c = d.color ?? accent;
        return (
          <g key={d.label}>
            <rect x={x} y={height - 18 - h} width={bw} height={h} fill={`${c}99`} rx={1.5} />
            <text x={x + bw / 2} y={height - 4} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="5.5">
              {d.label.length > 8 ? d.label.slice(0, 7) + "…" : d.label}
            </text>
            <text x={x + bw / 2} y={height - 20 - h} textAnchor="middle" fill={c} fontSize="5.5" fontWeight="bold">{d.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ points, height = 80, accent = "#00E5FF" }: { points: number[]; height?: number; accent?: string }) {
  const path = useMemo(() => {
    if (points.length < 2) return "";
    const max = Math.max(1, ...points);
    const min = Math.min(0, ...points);
    const range = max - min || 1;
    const step = 100 / (points.length - 1);
    return points.map((v, i) => {
      const x = i * step;
      const y = height - 8 - ((v - min) / range) * (height - 16);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    }).join(" ");
  }, [points, height]);
  return (
    <svg viewBox={`0 0 100 ${height}`} width="100%" height={height}>
      <path d={path} fill="none" stroke={accent} strokeWidth="1.5" />
      <path d={`${path} L100,${height} L0,${height} Z`} fill={`${accent}22`} />
    </svg>
  );
}

export function DonutChart({ segments, size = 100 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const r = 40; const cx = 50; const cy = 50;
  const arcs = segments.map(seg => {
    const start = acc; acc += seg.value / total; const end = acc;
    const a0 = start * Math.PI * 2 - Math.PI / 2; const a1 = end * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0); const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1); const y1 = cy + r * Math.sin(a1);
    const large = end - start > 0.5 ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;
    return { ...seg, d };
  });
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      {arcs.map(a => <path key={a.label} d={a.d} fill={a.color} opacity={0.85} />)}
      <circle cx={cx} cy={cy} r={22} fill="rgba(0,8,18,0.95)" />
      <text x={cx} y={cy + 3} textAnchor="middle" fill="#00E5FF" fontSize="8" fontWeight="bold">{total}</text>
    </svg>
  );
}

export function Sparkline({ values, width = 120, height = 28, color = "#00E5FF" }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - (v / max) * (height - 4)}`).join(" ");
  return (<svg width={width} height={height}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" /></svg>);
}

export function DataTable({ columns, rows }: { columns: { key: string; label: string; width?: string }[]; rows: Record<string, ReactNode>[] }) {
  return (
    <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid rgba(0,229,255,0.2)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead><tr style={{ background: "rgba(0,229,255,0.1)" }}>
          {columns.map(c => <th key={c.key} style={{ textAlign: "left", padding: "8px 10px", color: "#00E5FF", fontWeight: 900, letterSpacing: 1, width: c.width }}>{c.label}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: i % 2 ? "rgba(0,0,0,0.2)" : "transparent" }}>
              {columns.map(c => <td key={c.key} style={{ padding: "7px 10px", color: "rgba(255,255,255,0.85)", fontVariantNumeric: "tabular-nums" }}>{row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
