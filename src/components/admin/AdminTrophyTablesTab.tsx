import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TROPHY_TABLE_DEFINITIONS,
  TEAM_TROPHY_TABLE_IDS,
  copyTrophyTableFrom,
  exportTrophyTableOverrides,
  formatTrophyBracketRange,
  getEffectiveTrophyTable,
  getTeamTrophyFormat,
  getTeamTrophyPeerIds,
  getTeamTrophyTableLabel,
  getTrophyTableLink,
  hasTrophyTableOverride,
  importTrophyTableOverrides,
  isTrophyTableCustomized,
  lookupTrophyDelta,
  resetTrophyTableOverride,
  saveTrophyTableOverride,
  setTrophyTableLink,
  subscribeTrophyTableChanges,
  unlinkTrophyTableAsIndividual,
  type TeamFormat,
  type TrophyBracketRow,
  type TrophyTableId,
} from "../../utils/trophyTables";
import { commitAdminAction } from "../../utils/adminScheduler";
import AdminScheduleControls, { useAdminScheduleState } from "./AdminScheduleControls";

function cellInputStyle(positive: boolean | null): React.CSSProperties {
  const color = positive == null ? "#fff" : positive ? "#FFD54F" : "#FF8A80";
  return {
    width: 54,
    boxSizing: "border-box",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 6,
    padding: "4px 6px",
    color,
    fontSize: 12,
    fontWeight: 800,
    textAlign: "center",
  };
}

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

function cloneRows(rows: TrophyBracketRow[]): TrophyBracketRow[] {
  return rows.map(r => ({ minTrophies: r.minTrophies, byPlace: [...r.byPlace] }));
}

function rowsEqual(a: TrophyBracketRow[], b: TrophyBracketRow[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function TeamModeOptions({
  excludeId,
  formats,
  syncLabel = false,
}: {
  excludeId: TrophyTableId;
  formats: TeamFormat[];
  syncLabel?: boolean;
}) {
  return (
    <>
      {formats.map(format => (
        <optgroup key={format} label={format}>
          {TEAM_TROPHY_TABLE_IDS[format]
            .filter(id => id !== excludeId)
            .map(peerId => (
              <option key={peerId} value={peerId}>
                {syncLabel
                  ? `Как «${getTeamTrophyTableLabel(peerId)}» (авто-синхронизация)`
                  : getTeamTrophyTableLabel(peerId)}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}

export default function AdminTrophyTablesTab() {
  const [activeId, setActiveId] = useState<TrophyTableId>("showdown_solo");
  const [rows, setRows] = useState<TrophyBracketRow[]>(() => getEffectiveTrophyTable("showdown_solo"));
  const [savedRows, setSavedRows] = useState<TrophyBracketRow[]>(() => cloneRows(getEffectiveTrophyTable("showdown_solo")));
  const [previewTrophies, setPreviewTrophies] = useState(350);
  const [previewPlace, setPreviewPlace] = useState(1);
  const [status, setStatus] = useState("");
  const [importJson, setImportJson] = useState("");
  const [importSourceId, setImportSourceId] = useState<TrophyTableId | "">("");
  const [, bump] = useState(0);
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();
  const skipExternalReloadRef = useRef(false);

  const def = useMemo(
    () => TROPHY_TABLE_DEFINITIONS.find(d => d.id === activeId)!,
    [activeId],
  );

  const teamFormat = getTeamTrophyFormat(activeId);
  const linkedSource = getTrophyTableLink(activeId);
  const isLinked = linkedSource != null;
  const isReadOnly = isLinked;
  const isDirty = !isReadOnly && !rowsEqual(rows, savedRows);

  const teamPeerIds = useMemo(() => getTeamTrophyPeerIds(activeId), [activeId]);
  const teamPeerFormats = useMemo((): TeamFormat[] => {
    const formats = new Set<TeamFormat>();
    for (const id of teamPeerIds) {
      const f = getTeamTrophyFormat(id);
      if (f) formats.add(f);
    }
    return formats.has("3v3") && formats.has("5v5") ? ["3v3", "5v5"] : formats.has("5v5") ? ["5v5"] : ["3v3"];
  }, [teamPeerIds]);

  const loadTableState = useCallback((id: TrophyTableId) => {
    const effective = cloneRows(getEffectiveTrophyTable(id));
    setRows(effective);
    setSavedRows(effective);
  }, []);

  const switchActiveId = useCallback((nextId: TrophyTableId) => {
    if (nextId === activeId) return;
    if (isDirty && !confirm("Есть несохранённые изменения. Переключить режим без сохранения?")) return;
    setActiveId(nextId);
  }, [activeId, isDirty]);

  useEffect(() => {
    loadTableState(activeId);
  }, [activeId, loadTableState]);

  useEffect(() => subscribeTrophyTableChanges(() => {
    bump(v => v + 1);
    if (skipExternalReloadRef.current) {
      skipExternalReloadRef.current = false;
      return;
    }
    if (!isDirty) loadTableState(activeId);
  }), [activeId, isDirty, loadTableState]);

  const updateDraft = (next: TrophyBracketRow[]) => {
    if (isReadOnly) return;
    setRows(next);
  };

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 2200);
  };

  const saveCurrent = () => {
    if (isReadOnly || !isDirty) return;
    const r = commitAdminAction({
      domain: "trophy_save",
      label: `Кубки: ${def.label}`,
      schedule,
      payload: { id: activeId, rows },
    });
    if (r.immediate) {
      skipExternalReloadRef.current = true;
      saveTrophyTableOverride(activeId, rows);
      setSavedRows(cloneRows(rows));
    }
    flash(r.message);
    resetSchedule();
  };

  const discardChanges = () => {
    if (!isDirty) return;
    setRows(cloneRows(savedRows));
    flash("Изменения отменены");
  };

  const updateMin = (rowIdx: number, value: number) => {
    const next = rows.map((r, i) => (i === rowIdx ? { ...r, minTrophies: Math.max(0, value) } : r));
    next.sort((a, b) => a.minTrophies - b.minTrophies);
    updateDraft(next);
  };

  const updateCell = (rowIdx: number, placeIdx: number, value: number) => {
    const next = rows.map((r, i) => {
      if (i !== rowIdx) return r;
      const byPlace = [...r.byPlace];
      byPlace[placeIdx] = value;
      return { ...r, byPlace };
    });
    updateDraft(next);
  };

  const addRow = () => {
    const last = rows[rows.length - 1];
    const nextMin = (last?.minTrophies ?? 0) + 100;
    const byPlace = last ? [...last.byPlace] : def.placeLabels.map(() => 0);
    updateDraft([...rows, { minTrophies: nextMin, byPlace }]);
  };

  const removeRow = (rowIdx: number) => {
    if (rows.length <= 1) return;
    updateDraft(rows.filter((_, i) => i !== rowIdx));
  };

  const resetCurrent = () => {
    if (isDirty && !confirm("Сбросить таблицу? Несохранённые изменения будут потеряны.")) return;
    const r = commitAdminAction({
      domain: "trophy_reset",
      label: `Сброс кубков: ${def.label}`,
      schedule,
      payload: { id: activeId },
    });
    if (r.immediate) resetTrophyTableOverride(activeId);
    loadTableState(activeId);
    flash(r.message);
    resetSchedule();
  };

  const resetAll = () => {
    if (!confirm("Сбросить все таблицы кубков к заводским значениям?")) return;
    const r = commitAdminAction({
      domain: "trophy_reset",
      label: "Сброс всех таблиц кубков",
      schedule,
      payload: {},
    });
    if (r.immediate) resetTrophyTableOverride();
    loadTableState(activeId);
    flash(r.message);
    resetSchedule();
  };

  const previewDelta = lookupTrophyDelta(rows, previewTrophies, previewPlace);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        padding: 12,
        borderRadius: 12,
        background: "rgba(255,213,79,0.08)",
        border: "1px solid rgba(255,213,79,0.28)",
        fontSize: 12,
        lineHeight: 1.5,
        color: "rgba(255,255,255,0.85)",
      }}>
        Изменения в таблице применяются к боям <strong>после «Сохранить»</strong> (можно отложить по расписанию).
        Кубки считаются по <strong>трофеям бойца</strong> (строка таблицы) и <strong>месту</strong> (столбец).
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{
          width: 240,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          maxHeight: 520,
          overflowY: "auto",
        }}>
          {TROPHY_TABLE_DEFINITIONS.map(d => {
            const active = d.id === activeId;
            const customized = isTrophyTableCustomized(d.id);
            const link = getTrophyTableLink(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => switchActiveId(d.id)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: active ? "rgba(255,213,79,0.18)" : "rgba(0,0,0,0.35)",
                  border: `1px solid ${active ? "#FFD54F" : "rgba(255,255,255,0.10)"}`,
                  color: active ? "#FFD54F" : "white",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {customized ? "● " : ""}{d.label}
                {link && (
                  <span style={{ display: "block", fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                    ↪ {getTeamTrophyTableLabel(link)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: "#FFD54F" }}>{def.label}</span>
            {hasTrophyTableOverride(activeId) && !isLinked && (
              <span style={{ fontSize: 10, color: "#76FF03", fontWeight: 800 }}>свои значения</span>
            )}
            {isLinked && linkedSource && (
              <span style={{ fontSize: 10, color: "#40C4FF", fontWeight: 800 }}>
                ↪ как {getTeamTrophyTableLabel(linkedSource)}
              </span>
            )}
            {isDirty && (
              <span style={{ fontSize: 10, color: "#FFAB40", fontWeight: 800 }}>не сохранено</span>
            )}
          </div>

          {teamFormat && (
            <div style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 10,
              background: "rgba(64,196,255,0.08)",
              border: "1px solid rgba(64,196,255,0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#40C4FF", letterSpacing: 0.5 }}>
                КОМАНДНЫЙ РЕЖИМ ({teamFormat})
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", display: "flex", gap: 8, alignItems: "center" }}>
                  Настройка:
                  <select
                    value={isLinked && linkedSource ? linkedSource : "individual"}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === "individual") {
                        if (isLinked) {
                          const r = commitAdminAction({
                            domain: "trophy_unlink",
                            label: `Отвязка кубков: ${def.label}`,
                            schedule,
                            payload: { id: activeId },
                          });
                          if (r.immediate) unlinkTrophyTableAsIndividual(activeId);
                          flash(r.message);
                        }
                        loadTableState(activeId);
                        resetSchedule();
                        return;
                      }
                      const r = commitAdminAction({
                        domain: "trophy_link",
                        label: `Синхронизация кубков: ${def.label}`,
                        schedule,
                        payload: { id: activeId, sourceId: v as TrophyTableId },
                      });
                      if (r.immediate) setTrophyTableLink(activeId, v as TrophyTableId);
                      loadTableState(activeId);
                      flash(r.message);
                      resetSchedule();
                    }}
                    style={selectStyle()}
                  >
                    <option value="individual">Индивидуально (своя таблица)</option>
                    <TeamModeOptions excludeId={activeId} formats={teamPeerFormats} syncLabel />
                  </select>
                </label>
                {isLinked && (
                  <button
                    type="button"
                    onClick={() => {
                      unlinkTrophyTableAsIndividual(activeId);
                      loadTableState(activeId);
                      flash("Отвязано — можно редактировать отдельно");
                    }}
                    style={btn("#FFD54F")}
                  >
                    Отвязать и редактировать
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", display: "flex", gap: 8, alignItems: "center" }}>
                  Разовый импорт из:
                  <select
                    value={importSourceId}
                    onChange={e => setImportSourceId(e.target.value as TrophyTableId | "")}
                    style={selectStyle()}
                  >
                    <option value="">— выберите режим —</option>
                    <TeamModeOptions excludeId={activeId} formats={teamPeerFormats} />
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!importSourceId}
                  onClick={() => {
                    if (!importSourceId) return;
                    const r = commitAdminAction({
                      domain: "trophy_copy",
                      label: `Импорт кубков в ${def.label}`,
                      schedule,
                      payload: { sourceId: importSourceId, targetId: activeId },
                    });
                    if (r.immediate) copyTrophyTableFrom(importSourceId, activeId);
                    loadTableState(activeId);
                    setImportSourceId("");
                    flash(r.message);
                    resetSchedule();
                  }}
                  style={btn("#76FF03", !importSourceId)}
                >
                  Скопировать один раз
                </button>
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", lineHeight: 1.45 }}>
                <strong>Авто-синхронизация</strong> — таблица всегда повторяет выбранный режим (3v3 или 5v5).
                <strong> Разовый импорт</strong> — копирует текущие значения и оставляет режим индивидуальным для правок.
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button type="button" onClick={addRow} style={btn("#76FF03", isReadOnly)} disabled={isReadOnly}>+ Строка</button>
            <button type="button" onClick={resetCurrent} style={btn("#40C4FF")}>Сбросить таблицу</button>
            <button type="button" onClick={resetAll} style={btn("#FF7043")}>Сбросить все</button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(exportTrophyTableOverrides()).catch(() => {});
                flash("JSON скопирован");
              }}
              style={btn("#FFD54F")}
            >
              Экспорт JSON
            </button>
          </div>

          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480, fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(0,0,0,0.45)" }}>
                  <th style={thStyle()}>Кубки бойца</th>
                  {def.placeLabels.map(label => (
                    <th key={label} style={thStyle()}>Место {label}</th>
                  ))}
                  <th style={thStyle()} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, rowIdx) => (
                  <tr key={`${r.minTrophies}-${rowIdx}`} style={{ background: rowIdx % 2 ? "rgba(255,255,255,0.03)" : "transparent" }}>
                    <td style={tdStyle()}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>
                          {formatTrophyBracketRange(rows, rowIdx)}
                        </span>
                        <input
                          type="number"
                          value={r.minTrophies}
                          onChange={e => updateMin(rowIdx, +e.target.value || 0)}
                          disabled={isReadOnly}
                          style={{ ...cellInputStyle(null), width: 72, opacity: isReadOnly ? 0.65 : 1 }}
                        />
                      </div>
                    </td>
                    {def.placeLabels.map((_, placeIdx) => {
                      const v = r.byPlace[placeIdx] ?? 0;
                      return (
                        <td key={placeIdx} style={tdStyle()}>
                          <input
                            type="number"
                            value={v}
                            onChange={e => updateCell(rowIdx, placeIdx, +e.target.value || 0)}
                            disabled={isReadOnly}
                            style={{
                              ...cellInputStyle(v > 0 ? true : v < 0 ? false : null),
                              opacity: isReadOnly ? 0.65 : 1,
                            }}
                          />
                        </td>
                      );
                    })}
                    <td style={tdStyle()}>
                      <button type="button" onClick={() => removeRow(rowIdx)} style={btn("#FF7070", rows.length <= 1 || isReadOnly)} disabled={rows.length <= 1 || isReadOnly}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!isReadOnly && (
            <div style={{
              marginTop: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}>
              <AdminScheduleControls schedule={schedule} onChange={setSchedule} compact />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={saveCurrent}
                disabled={!isDirty}
                style={{
                  ...btn("#76FF03", !isDirty),
                  padding: "10px 20px",
                  fontSize: 13,
                }}
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={discardChanges}
                disabled={!isDirty}
                style={btn("#FF7043", !isDirty)}
              >
                Отменить изменения
              </button>
              </div>
            </div>
          )}

          <div style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#FFD54F" }}>ПРЕВЬЮ</span>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              Кубки бойца
              <input
                type="number"
                min={0}
                value={previewTrophies}
                onChange={e => setPreviewTrophies(Math.max(0, +e.target.value || 0))}
                style={{ ...cellInputStyle(null), marginLeft: 6, width: 80 }}
              />
            </label>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              Место
              <input
                type="number"
                min={1}
                max={def.placeLabels.length}
                value={previewPlace}
                onChange={e => setPreviewPlace(Math.max(1, Math.min(def.placeLabels.length, +e.target.value || 1)))}
                style={{ ...cellInputStyle(null), marginLeft: 6, width: 56 }}
              />
            </label>
            <span style={{
              fontSize: 16,
              fontWeight: 900,
              color: previewDelta >= 0 ? "#FFD54F" : "#FF8A80",
            }}>
              {previewDelta >= 0 ? `+${previewDelta}` : previewDelta} 🏆
            </span>
            {isDirty && (
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
                (превью по черновику — в боях после «Сохранить»)
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{
        padding: 12,
        borderRadius: 10,
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#FFD54F", marginBottom: 8 }}>ИМПОРТ JSON (только изменённые таблицы)</div>
        <textarea
          value={importJson}
          onChange={e => setImportJson(e.target.value)}
          rows={4}
          placeholder='{ "showdown_solo": [ { "minTrophies": 0, "byPlace": [10, 8, ...] } ] }'
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 8,
            padding: 10,
            color: "white",
            fontFamily: "monospace",
            fontSize: 11,
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              try {
                const r = commitAdminAction({
                  domain: "trophy_import",
                  label: "Импорт кубков JSON (слить)",
                  schedule,
                  payload: { json: importJson, mode: "merge" as const },
                });
                if (r.immediate) importTrophyTableOverrides(importJson, "merge");
                loadTableState(activeId);
                setImportJson("");
                flash(r.message);
                resetSchedule();
              } catch (e) {
                flash(e instanceof Error ? e.message : "Ошибка импорта");
              }
            }}
            style={btn("#76FF03")}
          >
            Импорт (слить)
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirm("Заменить все переопределения импортом?")) return;
              try {
                const r = commitAdminAction({
                  domain: "trophy_import",
                  label: "Импорт кубков JSON (заменить)",
                  schedule,
                  payload: { json: importJson, mode: "replace" as const },
                });
                if (r.immediate) importTrophyTableOverrides(importJson, "replace");
                loadTableState(activeId);
                setImportJson("");
                flash(r.message);
                resetSchedule();
              } catch (e) {
                flash(e instanceof Error ? e.message : "Ошибка импорта");
              }
            }}
            style={btn("#FF7043")}
          >
            Импорт (заменить)
          </button>
        </div>
      </div>

      {status && (
        <div style={{ fontSize: 12, fontWeight: 700, color: "#76FF03", textAlign: "center" }}>{status}</div>
      )}
    </div>
  );
}

function thStyle(): React.CSSProperties {
  return {
    padding: "8px 6px",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    color: "#FFD54F",
    fontWeight: 800,
    fontSize: 10,
    letterSpacing: 0.5,
    whiteSpace: "nowrap",
  };
}

function tdStyle(): React.CSSProperties {
  return {
    padding: "6px 4px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    textAlign: "center",
    verticalAlign: "middle",
  };
}

function selectStyle(): React.CSSProperties {
  return {
    minWidth: 220,
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 8,
    padding: "6px 10px",
    color: "white",
    fontSize: 12,
    fontWeight: 700,
  };
}
