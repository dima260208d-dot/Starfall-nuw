import { useState } from "react";
import { applyPercentDelta } from "../../utils/characterBalance";

export function adminBtn(color: string): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 8, border: `1px solid ${color}88`,
    background: `${color}22`, color, fontWeight: 800, fontSize: 11, cursor: "pointer",
  };
}

export function adminNumInput(): React.CSSProperties {
  return {
    width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.18)", borderRadius: 6, padding: "6px 8px",
    color: "#fff", fontSize: 12, fontWeight: 700,
  };
}

export default function AdminPercentField({
  label,
  value,
  onChange,
  step = "any",
  min,
  max,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string | number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const [pct, setPct] = useState(10);
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 2 }}>{label}</div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          style={{ ...adminNumInput(), flex: 1, opacity: disabled ? 0.55 : 1 }}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
        />
        <input
          type="number"
          step={1}
          disabled={disabled}
          style={{ ...adminNumInput(), width: 52, opacity: disabled ? 0.55 : 1 }}
          value={pct}
          onChange={e => setPct(Number(e.target.value))}
          title="Процент изменения"
        />
        <button
          type="button"
          disabled={disabled}
          style={{ ...adminBtn("#81C784"), padding: "6px 8px", flexShrink: 0, opacity: disabled ? 0.45 : 1 }}
          onClick={() => onChange(applyPercentDelta(value, pct))}
          title="Применить процент к значению"
        >
          ±%
        </button>
      </div>
    </label>
  );
}
