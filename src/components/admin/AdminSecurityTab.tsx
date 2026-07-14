import { useState } from "react";
import { runIntegrityScan, type IntegrityReport } from "../../utils/devAnalytics/devCodeIntegrity";
import { TechPanel, MetricTile, CollapsibleList, BarChart, DataTable } from "../../utils/devAnalytics/devCharts";

export default function AdminSecurityTab() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [busy, setBusy] = useState(false);
  const scan = async (reset = false) => {
    setBusy(true);
    try { setReport(await runIntegrityScan({ resetBaseline: reset })); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <TechPanel title="Мониторинг целостности кода" subtitle="Только наблюдение — редактирование не блокируется" accent="#FF5252">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button type="button" onClick={() => scan(false)} disabled={busy} style={btn("#00E5FF")}>{busy ? "Сканирование…" : "🔍 Сканировать"}</button>
          <button type="button" onClick={() => scan(true)} disabled={busy} style={btn("#FFB74D")}>⟳ Новый baseline</button>
        </div>
        {report && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>
              <MetricTile label="Файлов" value={report.totals.files} accent="#00E5FF" />
              <MetricTile label="Символов" value={report.totals.chars.toLocaleString("ru-RU")} accent="#CE93D8" />
              <MetricTile label="Строк" value={report.totals.lines.toLocaleString("ru-RU")} accent="#FFD54F" />
              <MetricTile label="Ключей LS" value={report.totals.lsKeys} sub={`${report.totals.lsBytes} байт`} accent="#76FF03" />
              <MetricTile label="Изменено" value={report.significantChanges.length} accent="#FF5252" />
            </div>
            <BarChart data={[
              { label: "+add", value: report.significantChanges.filter(c=>c.kind==="added").length, color: "#76FF03" },
              { label: "mod", value: report.significantChanges.filter(c=>c.kind==="modified").length, color: "#FFD54F" },
              { label: "-del", value: report.significantChanges.filter(c=>c.kind==="removed").length, color: "#FF5252" },
            ]} accent="#FF5252" height={90} />
            <CollapsibleList title="Изменения файлов" count={report.significantChanges.length} defaultOpen>
              <DataTable columns={[
                { key: "path", label: "Файл" },
                { key: "kind", label: "Тип" },
                { key: "delta", label: "Δ символов" },
              ]} rows={report.significantChanges.slice(0, 80).map(c => ({
                path: c.path,
                kind: c.kind,
                delta: c.charDelta >= 0 ? `+${c.charDelta}` : String(c.charDelta),
              }))} />
            </CollapsibleList>
            <CollapsibleList title="localStorage" count={report.localStorage.length}>
              <DataTable columns={[{ key: "key", label: "Ключ" }, { key: "size", label: "Байт" }]}
                rows={report.localStorage.slice(0, 40).map(e => ({ key: e.key, size: e.size }))} />
            </CollapsibleList>
            <CollapsibleList title="Журнал аудита" count={report.auditLog.length}>
              {report.auditLog.map(a => (
                <div key={a.id} style={{ fontSize: 11, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "#FF5252", fontWeight: 800 }}>{new Date(a.ts).toLocaleString("ru-RU")}</div>
                  <div style={{ color: "rgba(255,255,255,0.7)" }}>{a.summary}</div>
                </div>
              ))}
            </CollapsibleList>
          </>
        )}
      </TechPanel>
    </div>
  );
}

function btn(color: string) {
  return {
    padding: "8px 14px", border: `1px solid ${color}88`, borderRadius: 8,
    background: `${color}22`, color, fontWeight: 900, fontSize: 11, cursor: "pointer",
  } as const;
}
