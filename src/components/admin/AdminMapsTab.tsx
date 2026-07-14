import { useEffect, useMemo, useState } from "react";
import {
  EDITOR_MODES,
  getSavedMaps,
  upsertMap,
  type EditorMode,
  type MapSave,
} from "../../utils/mapEditorAPI";
import {
  WEEKDAY_LABELS,
  cloneMapScheduleConfig,
  copyWeeklyDaySchedule,
  ensureDefaultSchedule,
  formatScheduleTime,
  getActiveMap,
  getMapScheduleConfig,
  saveMapScheduleConfig,
  slotEndMin,
  slotStartMin,
  validateMapScheduleConfig,
  type MapScheduleConfig,
  type MapScheduleSlot,
  type WeekdayIndex,
} from "../../utils/mapSchedule";
import { commitAdminAction } from "../../utils/adminScheduler";
import AdminScheduleControls, { useAdminScheduleState } from "./AdminScheduleControls";
import MapThumbCanvas from "../MapThumbCanvas";

type View = "modes" | "maps";

function btn(color: string, disabled = false): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${color}88`,
    background: `${color}22`,
    color,
    fontWeight: 800,
    fontSize: 11,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
  };
}

function emptySlot(mapId: string): MapScheduleSlot {
  return {
    mapId,
    startHour: 0,
    startMinute: 0,
    endHour: 23,
    endMinute: 59,
    enabled: true,
  };
}

function activeSlotsFromConfig(config: MapScheduleConfig, editDay: WeekdayIndex): MapScheduleSlot[] {
  if (config.variant === "daily") return config.dailySlots;
  if (config.weekly.sameAllDays) return config.weekly.sharedSlots;
  return config.weekly.byDay[editDay] ?? [];
}

function writeSlotsToConfig(
  config: MapScheduleConfig,
  slots: MapScheduleSlot[],
  editDay: WeekdayIndex,
): MapScheduleConfig {
  if (config.variant === "daily") return { ...config, dailySlots: slots };
  if (config.weekly.sameAllDays) {
    return { ...config, weekly: { ...config.weekly, sharedSlots: slots } };
  }
  return {
    ...config,
    weekly: {
      ...config.weekly,
      byDay: { ...config.weekly.byDay, [editDay]: slots },
    },
  };
}

export default function AdminMapsTab() {
  const [view, setView] = useState<View>("modes");
  const [mode, setMode] = useState<EditorMode | null>(null);
  const [config, setConfig] = useState<MapScheduleConfig>(() => cloneMapScheduleConfig(getMapScheduleConfig("showdown")));
  const [editDay, setEditDay] = useState<WeekdayIndex>(0);
  const [status, setStatus] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [, tick] = useState(0);
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();

  const slots = useMemo(() => activeSlotsFromConfig(config, editDay), [config, editDay]);

  useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const mapsForMode = useMemo(() => {
    if (!mode) return [];
    return getSavedMaps().filter(m => m.mode === mode);
  }, [mode, tick]);

  const openMode = (m: EditorMode) => {
    setMode(m);
    setView("maps");
    setStatus("");
    ensureDefaultSchedule(m);
    setConfig(cloneMapScheduleConfig(getMapScheduleConfig(m)));
    resetSchedule();
  };

  const updateSlots = (next: MapScheduleSlot[]) => {
    setConfig(prev => writeSlotsToConfig(prev, next, editDay));
  };

  const addSlotForMap = (mapId: string) => {
    updateSlots([...slots, emptySlot(mapId)]);
  };

  const updateSlot = (idx: number, patch: Partial<MapScheduleSlot>) => {
    updateSlots(slots.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSlot = (idx: number) => {
    updateSlots(slots.filter((_, i) => i !== idx));
  };

  const saveSchedule = () => {
    if (!mode) return;
    const ids = new Set(mapsForMode.map(m => m.id));
    const v = validateMapScheduleConfig(config, ids);
    if (!v.ok) {
      setStatus(v.errors.join(" "));
      return;
    }
    const r = commitAdminAction({
      domain: "map_schedule",
      label: `Карты: ${mode}`,
      schedule,
      payload: { mode, config: cloneMapScheduleConfig(config) },
    });
    if (r.immediate) saveMapScheduleConfig(mode, config);
    setStatus(r.message);
    resetSchedule();
    setTimeout(() => setStatus(""), 2500);
  };

  const copyDayTo = (from: WeekdayIndex, toDays: WeekdayIndex[]) => {
    setConfig(prev => copyWeeklyDaySchedule(prev, from, toDays));
    setStatus(`Скопировано с ${WEEKDAY_LABELS[from]} на ${toDays.map(d => WEEKDAY_LABELS[d]).join(", ")}`);
    setTimeout(() => setStatus(""), 2000);
  };

  const saveRename = (map: MapSave) => {
    const name = renameVal.trim();
    if (!name) return;
    upsertMap({ ...map, name, updatedAt: Date.now() });
    setRenameId(null);
    tick(t => t + 1);
  };

  if (view === "modes") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.45 }}>
          Выберите режим — настройте карты и расписание по времени суток и дням недели.
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 10,
        }}>
          {EDITOR_MODES.map(em => {
            const active = getActiveMap(em.id);
            const cfg = getMapScheduleConfig(em.id);
            const slotCount = cfg.variant === "daily"
              ? cfg.dailySlots.length
              : cfg.weekly.sameAllDays
                ? cfg.weekly.sharedSlots.length
                : Object.values(cfg.weekly.byDay).reduce((n, arr) => n + (arr?.length ?? 0), 0);
            return (
              <button
                key={em.id}
                type="button"
                onClick={() => openMode(em.id)}
                style={{
                  ...btn("#40C4FF"),
                  padding: 14,
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 28 }}>{em.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 900 }}>{em.label}</span>
                <span style={{ fontSize: 10, opacity: 0.75 }}>
                  {active ? active.name : "нет карты"} · {cfg.variant === "weekly" ? "неделя" : "день"} · слотов: {slotCount || "авто"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (!mode) return null;
  const modeMeta = EDITOR_MODES.find(m => m.id === mode)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => { setView("modes"); setMode(null); }} style={btn("#90A4AE")}>
          ← Режимы
        </button>
        <span style={{ fontSize: 18, fontWeight: 900 }}>{modeMeta.icon} {modeMeta.label}</span>
        {status && (
          <span style={{ fontSize: 12, color: status.includes("сохран") || status.includes("Примен") || status.includes("Заплан") ? "#69F0AE" : "#FF7070", fontWeight: 700 }}>
            {status}
          </span>
        )}
      </div>

      <div style={{
        padding: 12,
        borderRadius: 10,
        background: "rgba(64,196,255,0.08)",
        border: "1px solid rgba(64,196,255,0.25)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#40C4FF" }}>Тип расписания:</span>
          <button type="button" onClick={() => setConfig(prev => ({ ...prev, variant: "daily" }))} style={btn(config.variant === "daily" ? "#FFD54F" : "#90A4AE")}>
            Одно на все дни
          </button>
          <button type="button" onClick={() => setConfig(prev => ({ ...prev, variant: "weekly" }))} style={btn(config.variant === "weekly" ? "#FFD54F" : "#90A4AE")}>
            По дням недели
          </button>
        </div>

        {config.variant === "weekly" && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  weekly: { ...prev.weekly, sameAllDays: true },
                }))}
                style={btn(config.weekly.sameAllDays ? "#76FF03" : "#90A4AE")}
              >
                Одна схема на всю неделю
              </button>
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  weekly: { ...prev.weekly, sameAllDays: false },
                }))}
                style={btn(!config.weekly.sameAllDays ? "#76FF03" : "#90A4AE")}
              >
                Отдельно для каждого дня
              </button>
            </div>

            {!config.weekly.sameAllDays && (
              <>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {WEEKDAY_LABELS.map((label, idx) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setEditDay(idx as WeekdayIndex)}
                      style={btn(editDay === idx ? "#FFD54F" : "#90A4AE")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", alignSelf: "center" }}>
                    Повторить {WEEKDAY_LABELS[editDay]} на:
                  </span>
                  {WEEKDAY_LABELS.map((label, idx) => (
                    idx !== editDay && (
                      <button
                        key={`copy-${label}`}
                        type="button"
                        onClick={() => copyDayTo(editDay, [idx as WeekdayIndex])}
                        style={btn("#CE93D8")}
                      >
                        {label}
                      </button>
                    )
                  ))}
                  <button
                    type="button"
                    onClick={() => copyDayTo(editDay, [0, 1, 2, 3, 4, 5, 6].filter(d => d !== editDay) as WeekdayIndex[])}
                    style={btn("#CE93D8")}
                  >
                    Все остальные
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {mapsForMode.length === 0 ? (
        <div style={{ padding: 20, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
          Нет карт для этого режима. Создайте карту в конструкторе карт.
        </div>
      ) : (
        mapsForMode.map(map => {
          const mapSlots = slots
            .map((s, i) => ({ s, i }))
            .filter(({ s }) => s.mapId === map.id);
          const isActiveNow = getActiveMap(mode)?.id === map.id;
          return (
            <div
              key={map.id}
              className="ui-glass"
              style={{
                padding: 14,
                borderRadius: 12,
                border: isActiveNow ? "1px solid rgba(255,213,79,0.55)" : "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
                <MapThumbCanvas map={map} size={120} borderColor={isActiveNow ? "#FFD54F" : "#ffffff33"} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  {renameId === map.id ? (
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <input className="ui-input" value={renameVal} onChange={e => setRenameVal(e.target.value)} style={{ flex: 1 }} />
                      <button type="button" onClick={() => saveRename(map)} style={btn("#69F0AE")}>OK</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 900 }}>{map.name}</span>
                      {isActiveNow && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#FFD54F", letterSpacing: 1 }}>В ИГРЕ</span>
                      )}
                      <button type="button" onClick={() => { setRenameId(map.id); setRenameVal(map.name); }} style={btn("#CE93D8")}>
                        ✏️ Имя
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginBottom: 10 }}>
                    ID: {map.id}
                    {config.variant === "weekly" && !config.weekly.sameAllDays && ` · редактируется: ${WEEKDAY_LABELS[editDay]}`}
                  </div>

                  {mapSlots.length === 0 ? (
                    <button type="button" onClick={() => addSlotForMap(map.id)} style={btn("#40C4FF")}>
                      + Добавить в расписание
                    </button>
                  ) : (
                    mapSlots.map(({ s, i }) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          alignItems: "center",
                          marginBottom: 8,
                          padding: 8,
                          borderRadius: 8,
                          background: "rgba(0,0,0,0.2)",
                        }}
                      >
                        <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="checkbox" checked={s.enabled} onChange={e => updateSlot(i, { enabled: e.target.checked })} />
                          Включена
                        </label>
                        <label style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                          с
                          <input
                            type="time"
                            value={formatScheduleTime(s.startHour, s.startMinute)}
                            onChange={e => {
                              const [h, m] = e.target.value.split(":").map(Number);
                              updateSlot(i, { startHour: h || 0, startMinute: m || 0 });
                            }}
                            style={{ marginLeft: 4 }}
                          />
                        </label>
                        <label style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                          до
                          <input
                            type="time"
                            value={formatScheduleTime(s.endHour, s.endMinute)}
                            onChange={e => {
                              const [h, m] = e.target.value.split(":").map(Number);
                              updateSlot(i, { endHour: h || 0, endMinute: m || 0 });
                            }}
                            style={{ marginLeft: 4 }}
                          />
                        </label>
                        <button type="button" onClick={() => removeSlot(i)} style={btn("#FF5252")}>Убрать</button>
                      </div>
                    ))
                  )}
                  {mapSlots.length > 0 && (
                    <button type="button" onClick={() => addSlotForMap(map.id)} style={{ ...btn("#40C4FF"), marginTop: 4 }}>
                      + Ещё слот для этой карты
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      <AdminScheduleControls schedule={schedule} onChange={setSchedule} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={saveSchedule} style={btn("#FFD54F")}>
          💾 Сохранить расписание
        </button>
        <button
          type="button"
          onClick={() => {
            const pub = mapsForMode[0];
            if (!pub) return;
            updateSlots([emptySlot(pub.id)]);
          }}
          style={btn("#90A4AE")}
        >
          Сбросить: одна карта 24/7
        </button>
      </div>
    </div>
  );
}
