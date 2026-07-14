import { useEffect, useState } from "react";
import {
  formatDurationLabel,
  getMsUntilTechBreakStart,
  getNextTechBreakStartAt,
  getTechBreakState,
  getTechBreakTimeDisplay,
  subscribeTechBreakChanges,
} from "../../utils/techBreak";
import AdminScheduleControls, { useAdminScheduleState } from "./AdminScheduleControls";
import { commitAdminAction, ADMIN_SCHEDULE_CHANGED } from "../../utils/adminScheduler";

interface Props {
  onPreview: () => void;
}

const PRESETS = [15, 30, 45, 60, 90, 120, 180, 240];

function btn(color: string): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${color}88`,
    background: `${color}22`,
    color,
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  };
}

export default function AdminTechBreakTab({ onPreview }: Props) {
  const [state, setState] = useState(getTechBreakState);
  const [minutes, setMinutes] = useState(30);
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();

  const refresh = () => setState(getTechBreakState());

  useEffect(() => subscribeTechBreakChanges(refresh), []);

  useEffect(() => {
    const onSched = () => setTick(t => t + 1);
    window.addEventListener(ADMIN_SCHEDULE_CHANGED, onSched);
    return () => window.removeEventListener(ADMIN_SCHEDULE_CHANGED, onSched);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      refresh();
      setTick(t => t + 1);
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 2800);
  };

  const handleActivate = () => {
    const r = commitAdminAction({
      domain: "tech_break_activate",
      label: `Тех перерыв (${formatDurationLabel(minutes)})`,
      schedule,
      payload: { minutes },
    });
    refresh();
    setTick(t => t + 1);
    flash(r.message);
    resetSchedule();
  };

  const handleDeactivate = () => {
    const r = commitAdminAction({
      domain: "tech_break_deactivate",
      label: "Выключить тех перерыв",
      schedule,
      payload: {},
    });
    refresh();
    flash(r.message);
    resetSchedule();
  };

  void tick;
  const nextStart = getNextTechBreakStartAt();
  const msUntil = getMsUntilTechBreakStart();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 680 }}>
      <div style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(255,152,0,0.10)",
        border: "1px solid rgba(255,183,77,0.35)",
        fontSize: 12,
        lineHeight: 1.55,
        color: "rgba(255,255,255,0.88)",
      }}>
        Глобальный тех перерыв блокирует игру для всех, кроме разработчиков с доступом к панели.
        Можно включить сейчас или по расписанию (дата, дни недели, число месяца).
        За 10 минут до начала перерыва игроки не смогут зайти в бой — в меню появится предупреждение.
      </div>

      <AdminScheduleControls schedule={schedule} onChange={setSchedule} />

      <div style={{
        padding: 16,
        borderRadius: 12,
        background: state.active ? "rgba(255,87,34,0.12)" : "rgba(76,175,80,0.10)",
        border: `1px solid ${state.active ? "rgba(255,138,101,0.45)" : "rgba(129,199,132,0.35)"}`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,0.55)", marginBottom: 6 }}>
          СТАТУС
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: state.active ? "#FF8A65" : "#81C784" }}>
          {state.active ? "АКТИВЕН" : "ВЫКЛЮЧЕН"}
        </div>
        {state.active && (
          <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
            Отображается у игроков: <strong>{getTechBreakTimeDisplay(state)}</strong>
          </div>
        )}
        {!state.active && nextStart && (
          <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
            Запланирован: <strong>{new Date(nextStart).toLocaleString()}</strong>
            {msUntil !== null && msUntil > 0 && (
              <span style={{ color: "rgba(255,213,79,0.85)" }}>
                {" "}(через {Math.ceil(msUntil / 60_000)} мин)
              </span>
            )}
          </div>
        )}
      </div>

      {!state.active ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,0.55)" }}>
            ПРИМЕРНАЯ ДЛИТЕЛЬНОСТЬ
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setMinutes(p)}
                style={{
                  ...btn(minutes === p ? "#FFD54F" : "#CE93D8"),
                  opacity: minutes === p ? 1 : 0.75,
                }}
              >
                {formatDurationLabel(p)}
              </button>
            ))}
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 700 }}>
            Свои минуты
            <input
              type="number"
              min={1}
              max={1440}
              value={minutes}
              onChange={e => setMinutes(Math.max(1, Math.min(1440, Number(e.target.value) || 1)))}
              className="ui-input"
              style={{ maxWidth: 160 }}
            />
          </label>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
            Игроки увидят: {formatDurationLabel(minutes)}
          </div>
          <button
            type="button"
            onClick={handleActivate}
            className="ui-btn ui-btn--primary"
            style={{ alignSelf: "flex-start", letterSpacing: "0.1em" }}
          >
            {schedule.type === "immediate" ? "ВКЛЮЧИТЬ ТЕХ ПЕРЕРЫВ" : "ЗАПЛАНИРОВАТЬ ТЕХ ПЕРЕРЫВ"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={handleDeactivate} style={btn("#FF5252")}>
            {schedule.type === "immediate" ? "ВЫКЛЮЧИТЬ ТЕХ ПЕРЕРЫВ" : "ЗАПЛАНИРОВАТЬ ВЫКЛЮЧЕНИЕ"}
          </button>
          <button type="button" onClick={onPreview} style={btn("#40C4FF")}>
            ПРОСМОТР КАК У ИГРОКОВ
          </button>
        </div>
      )}

      {msg && (
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#76FF03" }}>{msg}</div>
      )}
    </div>
  );
}
