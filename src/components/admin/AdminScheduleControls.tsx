import { useMemo, useState } from "react";
import {
  WEEKDAY_LABELS,
  defaultAdminSchedule,
  type AdminScheduleRule,
} from "../../utils/adminScheduler";

export { defaultAdminSchedule, type AdminScheduleRule };

function toLocalDatetimeValue(iso?: string): string {
  if (!iso) {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return d.toISOString().slice(0, 16);
  }
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeValue(v: string): string {
  return new Date(v).toISOString();
}

interface Props {
  schedule: AdminScheduleRule;
  onChange: (next: AdminScheduleRule) => void;
  compact?: boolean;
}

export default function AdminScheduleControls({ schedule, onChange, compact = false }: Props) {
  const mode = schedule.type;

  const weeklyDays = useMemo(() => {
    if (schedule.type !== "weekly") return [1, 3, 5];
    return schedule.days.length ? schedule.days : [1];
  }, [schedule]);

  return (
    <div style={{
      padding: compact ? 8 : 10,
      borderRadius: 10,
      background: "rgba(156,39,176,0.10)",
      border: "1px solid rgba(186,104,200,0.35)",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#CE93D8", letterSpacing: 0.6 }}>
        КОГДА ПРИМЕНИТЬ
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {([
          ["immediate", "Сейчас"],
          ["once", "Дата и время"],
          ["weekly", "По дням недели"],
          ["monthly", "По числу месяца"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (key === "immediate") onChange({ type: "immediate" });
              else if (key === "once") onChange({ type: "once", at: new Date(Date.now() + 3600000).toISOString() });
              else if (key === "weekly") onChange({ type: "weekly", days: [1, 3, 5], time: "12:00" });
              else onChange({ type: "monthly", day: 1, time: "12:00" });
            }}
            style={chip(mode === key)}
          >
            {label}
          </button>
        ))}
      </div>

      {schedule.type === "once" && (
        <label style={labelStyle()}>
          Дата и время
          <input
            type="datetime-local"
            value={toLocalDatetimeValue(schedule.at)}
            onChange={e => onChange({ type: "once", at: fromLocalDatetimeValue(e.target.value) })}
            style={inputStyle()}
          />
        </label>
      )}

      {schedule.type === "weekly" && (
        <>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {WEEKDAY_LABELS.map((label, idx) => {
              const active = schedule.days.includes(idx);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const days = active
                      ? schedule.days.filter(d => d !== idx)
                      : [...schedule.days, idx].sort((a, b) => a - b);
                    onChange({ ...schedule, days });
                  }}
                  style={chip(active)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <label style={labelStyle()}>
            Время
            <input
              type="time"
              value={schedule.time}
              onChange={e => onChange({ ...schedule, time: e.target.value || "12:00" })}
              style={inputStyle()}
            />
          </label>
        </>
      )}

      {schedule.type === "monthly" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={labelStyle()}>
            Число месяца
            <input
              type="number"
              min={1}
              max={31}
              value={schedule.day}
              onChange={e => onChange({ ...schedule, day: Math.max(1, Math.min(31, +e.target.value || 1)) })}
              style={{ ...inputStyle(), width: 72 }}
            />
          </label>
          <label style={labelStyle()}>
            Время
            <input
              type="time"
              value={schedule.time}
              onChange={e => onChange({ ...schedule, time: e.target.value || "12:00" })}
              style={inputStyle()}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 8,
    border: `1px solid ${active ? "#CE93D8" : "rgba(255,255,255,0.18)"}`,
    background: active ? "rgba(206,147,216,0.22)" : "rgba(0,0,0,0.35)",
    color: active ? "#CE93D8" : "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
  };
}

function labelStyle(): React.CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    fontWeight: 700,
  };
}

function inputStyle(): React.CSSProperties {
  return {
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 8,
    padding: "6px 10px",
    color: "white",
    fontSize: 12,
    fontWeight: 700,
  };
}

export function useAdminScheduleState() {
  const [schedule, setSchedule] = useState<AdminScheduleRule>(defaultAdminSchedule);
  const resetSchedule = () => setSchedule(defaultAdminSchedule());
  return { schedule, setSchedule, resetSchedule };
}
