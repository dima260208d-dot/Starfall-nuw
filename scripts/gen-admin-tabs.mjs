import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const D = "div";

function w(rel, body) {
  fs.writeFileSync(path.join(root, rel), body);
}

w("src/components/admin/AdminAiTab.tsx", `import { useEffect, useMemo, useState } from "react";
import { buildAiDashboard, ensureDemoAiTelemetry, type LlmModelInfo } from "../../utils/devAnalytics/devAiTelemetry";
import { TechPanel, MetricTile, CollapsibleList, BarChart, LineChart, DonutChart, DataTable } from "../../utils/devAnalytics/devCharts";

function ModelRow({ m }: { m: LlmModelInfo }) {
  return (
    <${D} style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
      background: m.active ? "rgba(0,229,255,0.12)" : "rgba(0,0,0,0.25)",
      border: \`1px solid \${m.active ? "#00E5FF" : "rgba(255,255,255,0.1)"}\`,
      borderRadius: 8, marginBottom: 6,
    }}>
      <${D} style={{ width: 8, height: 8, borderRadius: "50%", background: m.active ? "#00E5FF" : "rgba(255,255,255,0.25)", boxShadow: m.active ? "0 0 8px #00E5FF" : "none" }} />
      <${D} style={{ flex: 1 }}>
        <${D} style={{ fontSize: 12, fontWeight: 800, color: m.active ? "#00E5FF" : "white" }}>{m.label}</${D}>
        <${D} style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>{m.provider} · {m.id}</${D}>
      </${D}>
      {m.subscriptionLinked && <span style={{ fontSize: 9, color: "#CE93D8", fontWeight: 800 }}>SG</span>}
      {m.active && <span style={{ fontSize: 9, color: "#76FF03", fontWeight: 900 }}>ACTIVE</span>}
    </${D}>
  );
}

export default function AdminAiTab() {
  const [ready, setReady] = useState(false);
  useEffect(() => { ensureDemoAiTelemetry(); setReady(true); }, []);
  const data = useMemo(() => (ready ? buildAiDashboard() : null), [ready]);
  if (!data) return <${D} style={{ color: "rgba(255,255,255,0.5)", padding: 24 }}>Загрузка телеметрии…</${D}>;

  return (
    <${D} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <TechPanel title="Нейросеть / подписка" subtitle="Модели OpenRouter & OpenAI" accent="#CE93D8">
        <${D} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
          <MetricTile label="LLM" value={data.llmEnabled ? "ON" : "OFF"} accent={data.llmEnabled ? "#76FF03" : "#FF5252"} />
          <MetricTile label="Star Guardian" value={data.starGuardian ? "Да" : "Нет"} accent="#CE93D8" />
          <MetricTile label="Модель" value={data.llmModel.split("/").pop() ?? data.llmModel} sub={data.llmProvider} accent="#00E5FF" />
          <MetricTile label="Диалог" value={data.chatHistoryLen} sub="сообщений в памяти" accent="#FFD54F" />
        </${D}>
        <CollapsibleList title="Каталог моделей по подписке" count={data.models.length} defaultOpen={data.models.length <= 8}>
          {data.models.map(m => <ModelRow key={\`\${m.provider}-\${m.id}\`} m={m} />)}
        </CollapsibleList>
      </TechPanel>

      <TechPanel title="Астрал — стратегии и ошибки" subtitle="Автопилот + обучение" accent="#00E5FF">
        <${D} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <${D}>
            <${D} style={{ fontSize: 10, color: "#00E5FF", fontWeight: 800, marginBottom: 6 }}>РЕЖИМЫ АВТОПИЛОТА</${D}>
            <BarChart data={data.autoplayModeCounts.length ? data.autoplayModeCounts : [{ label: "explore", value: 1 }]} accent="#00E5FF" />
          </${D}>
          <${D}>
            <${D} style={{ fontSize: 10, color: "#FF5252", fontWeight: 800, marginBottom: 6 }}>ПРИЧИНЫ ПОРАЖЕНИЙ (обучение)</${D}>
            <DonutChart segments={data.deathTagBreakdown.length ? data.deathTagBreakdown : [{ label: "—", value: 1, color: "#888" }]} />
          </${D}>
        </${D}>
        <${D} style={{ marginTop: 12 }}>
          <${D} style={{ fontSize: 10, color: "#76FF03", fontWeight: 800, marginBottom: 6 }}>ДИНАМИКА ПОБЕД (последние бои)</${D}>
          <LineChart points={data.strategyTimeline.length ? data.strategyTimeline : [0, 1, 0, 1]} accent="#76FF03" />
        </${D}>
        <${D} style={{ marginTop: 12 }}>
          <${D} style={{ fontSize: 10, color: "#FFD54F", fontWeight: 800, marginBottom: 6 }}>ИСПРАВЛЕНИЯ АСТРАЛА</${D}>
          <DataTable
            columns={[{ key: "ts", label: "Время" }, { key: "detail", label: "Действие" }]}
            rows={(data.fixEvents.length ? data.fixEvents : [{ detail: "Нет записей — сыграйте матч с автопилотом", ts: "—" }]).map(e => ({
              ts: "ts" in e && typeof e.ts === "number" ? new Date(e.ts).toLocaleString("ru-RU") : String((e as { ts?: string }).ts ?? "—"),
              detail: "detail" in e ? String(e.detail).slice(0, 80) : String(e),
            }))}
          />
        </${D}>
      </TechPanel>

      <TechPanel title="Боты — тактики и коррекции" subtitle="Персональности и поведение" accent="#76FF03">
        <${D} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>
          <MetricTile label="События ботов" value={data.botEvents.length} accent="#76FF03" />
          <MetricTile label="Бои в памяти" value={data.combatRecords.length} accent="#00E5FF" />
          <MetricTile label="Режимов" value={data.modeBreakdown.length} accent="#FFD54F" />
        </${D}>
        <BarChart data={data.botPersonalityUsage.length ? data.botPersonalityUsage : [{ label: "striker", value: 1 }]} accent="#76FF03" height={100} />
        <CollapsibleList title="Журнал коррекций ботов" count={data.botEvents.length}>
          <DataTable
            columns={[{ key: "ts", label: "Время" }, { key: "mode", label: "Режим" }, { key: "detail", label: "Событие" }]}
            rows={data.botEvents.slice(0, 40).map(e => ({
              ts: new Date(e.ts).toLocaleString("ru-RU"),
              mode: e.mode ?? "—",
              detail: e.detail.slice(0, 70),
            }))}
          />
        </CollapsibleList>
      </TechPanel>
    </${D}>
  );
}
`);

w("src/components/admin/AdminPlayersTab.tsx", `import { useMemo, useState } from "react";
import { findProfileStorageKey } from "../../utils/localStorageAPI";
import { formatPlayerIdDisplay } from "../../utils/playerId";
import { searchPlayerKeys, playerSearchLabel, getPlayerAdminSummary, blockPlayer, unblockPlayer, deletePlayer, sendGiftToPlayer } from "../../utils/playerAdmin";
import { buildGlobalPlayerAnalytics, buildPlayerDetailAnalytics, formatPlayerId } from "../../utils/devAnalytics/devPlayerAnalytics";
import { TechPanel, MetricTile, BarChart, LineChart, DonutChart, CollapsibleList, DataTable, Sparkline } from "../../utils/devAnalytics/devCharts";
import { MAX_GIFT_ITEMS, MAX_GIFT_MESSAGE, type GiftItem } from "../../utils/gifts";
import { PETS } from "../../entities/PetData";
import { BRAWLERS } from "../../entities/BrawlerData";

export default function AdminPlayersTab() {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const global = useMemo(() => buildGlobalPlayerAnalytics(), [selectedKey, status]);
  const summary = selectedKey ? getPlayerAdminSummary(selectedKey) : null;
  const detail = summary ? buildPlayerDetailAnalytics(summary) : null;
  const suggestions = useMemo(() => searchPlayerKeys(query, 30), [query]);

  const pick = (key: string) => { setSelectedKey(key); setStatus(""); };

  return (
    <${D} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <TechPanel title="Поиск по ID / нику" subtitle="Введите ID без #" accent="#40C4FF">
        <${D} style={{ display: "flex", gap: 8 }}>
          <input className="ui-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="ID или никнейм" style={{ flex: 1 }} />
          <button type="button" onClick={() => {
            const k = findProfileStorageKey(query);
            if (k) pick(k); else setStatus("Не найден");
          }} style={btn("#40C4FF")}>Найти</button>
        </${D}>
        {suggestions.length > 0 && (
          <${D} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {suggestions.map(k => (
              <button key={k} type="button" onClick={() => pick(k)} style={btn(selectedKey === k ? "#40C4FF" : "#90A4AE")}>{playerSearchLabel(k)}</button>
            ))}
          </${D}>
        )}
        {status && <${D} style={{ marginTop: 8, fontSize: 12, color: "#FF7070" }}>{status}</${D}>}
      </TechPanel>

      <TechPanel title="Глобальная аналитика" subtitle={\`Всего аккаунтов: \${global.totalPlayers}\`} accent="#00E5FF">
        <${D} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 12 }}>
          <MetricTile label="Игроков" value={global.totalPlayers} accent="#00E5FF" />
          <MetricTile label="Активных" value={global.activePlayers} accent="#76FF03" />
          <MetricTile label="Блок" value={global.blockedPlayers} accent="#FF5252" />
          <MetricTile label="Бои" value={global.totalGames} accent="#FFD54F" />
          <MetricTile label="Win%" value={\`\${global.avgWinRate}%\`} accent="#CE93D8" />
          <MetricTile label="Трофеи Σ" value={global.totalTrophies.toLocaleString("ru-RU")} accent="#FF7043" />
        </${D}>
        <${D} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
          <BarChart data={global.modeActivity.slice(0, 8)} accent="#00E5FF" />
          <DonutChart segments={global.trophyBuckets.map((b,i)=>({...b,color:["#90A4AE","#40C4FF","#CE93D8","#FFD54F"][i]}))} />
        </${D}>
        <${D} style={{ marginTop: 10, fontSize: 10, color: "#00E5FF", fontWeight: 800 }}>Активность 7 дней</${D}>
        <LineChart points={global.activityLast7} accent="#00E5FF" />
        <CollapsibleList title="Список аккаунтов" count={global.topPlayers.length} defaultOpen>
          <DataTable columns={[
            { key: "user", label: "Игрок" },
            { key: "id", label: "ID" },
            { key: "tr", label: "🏆" },
            { key: "games", label: "Бои" },
          ]} rows={global.topPlayers.map(e => ({
            user: <button type="button" onClick={() => pick(e.storageKey)} style={{ ...btn(e.isCurrent ? "#FFD54F" : "#888"), padding: "4px 8px" }}>{e.summary.username}{e.isCurrent ? " ★" : ""}</button>,
            id: formatPlayerIdDisplay(e.summary.playerId) || "—",
            tr: e.summary.trophies,
            games: e.summary.totalGamesPlayed,
          }))} />
        </CollapsibleList>
        {global.currentUserEntry && (
          <${D} style={{ marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid #FFD54F55", background: "rgba(255,213,79,0.08)" }}>
            <${D} style={{ fontSize: 10, color: "#FFD54F", fontWeight: 900 }}>ВАШ АККАУНТ (пример)</${D}>
            <${D} style={{ fontSize: 12 }}>{global.currentUserEntry.summary.username} · {formatPlayerId(global.currentUserEntry.summary)} · {global.currentUserEntry.summary.trophies}🏆</${D}>
            <button type="button" onClick={() => pick(global.currentUserEntry!.storageKey)} style={{ ...btn("#FFD54F"), marginTop: 6 }}>Открыть полный отчёт</button>
          </${D}>
        )}
      </TechPanel>

      {detail && summary && (
        <TechPanel title={\`Отчёт: \${summary.username}\`} subtitle={formatPlayerId(summary)} accent="#CE93D8">
          <${D} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginBottom: 12 }}>
            <MetricTile label="Win%" value={\`\${detail.winRate}%\`} accent="#76FF03" />
            <MetricTile label="Engagement" value={detail.engagementScore} accent="#CE93D8" />
            <MetricTile label="Δ трофеев" value={detail.avgTrophyDelta} accent="#FFD54F" />
            <MetricTile label="Монеты" value={summary.coins} accent="#FFD54F" />
            <MetricTile label="Крист." value={summary.gems} accent="#40C4FF" />
          </${D}>
          <${D} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <BarChart data={detail.modeGames} accent="#40C4FF" />
            <LineChart points={detail.trophyHistory.length ? detail.trophyHistory : [0]} accent="#FFD54F" />
          </${D}>
          <CollapsibleList title="История боёв" count={detail.battleTimeline.length}>
            <DataTable columns={[{ key: "t", label: "Время" }, { key: "r", label: "Результат" }]}
              rows={detail.battleTimeline.map(b => ({
                t: new Date(b.ts).toLocaleString("ru-RU"),
                r: <span style={{ color: b.won ? "#76FF03" : "#FF5252", fontWeight: 800 }}>{b.label}</span>,
              }))} />
          </CollapsibleList>
          <${D} style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {summary.blocked ? (
              <button type="button" onClick={() => { unblockPlayer(selectedKey!); setStatus("Разблокирован"); }} style={btn("#76FF03")}>Разблокировать</button>
            ) : (
              <button type="button" onClick={() => { blockPlayer(selectedKey!); setStatus("Заблокирован"); }} style={btn("#FFB74D")}>Заблокировать</button>
            )}
          </${D}>
        </TechPanel>
      )}
    </${D}>
  );
}

function btn(color: string) {
  return { padding: "6px 12px", border: \`1px solid \${color}88\`, borderRadius: 8, background: \`\${color}18\`, color, fontWeight: 800, fontSize: 11, cursor: "pointer" } as const;
}
`);

w("src/components/admin/AdminSecurityTab.tsx", `import { useState } from "react";
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
    <${D} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <TechPanel title="Мониторинг целостности кода" subtitle="Только наблюдение — редактирование не блокируется" accent="#FF5252">
        <${D} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button type="button" onClick={() => scan(false)} disabled={busy} style={btn("#00E5FF")}>{busy ? "Сканирование…" : "🔍 Сканировать"}</button>
          <button type="button" onClick={() => scan(true)} disabled={busy} style={btn("#FFB74D")}>⟳ Новый baseline</button>
        </${D}>
        {report && (
          <>
            <${D} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>
              <MetricTile label="Файлов" value={report.totals.files} accent="#00E5FF" />
              <MetricTile label="Символов" value={report.totals.chars.toLocaleString("ru-RU")} accent="#CE93D8" />
              <MetricTile label="Строк" value={report.totals.lines.toLocaleString("ru-RU")} accent="#FFD54F" />
              <MetricTile label="Ключей LS" value={report.totals.lsKeys} sub={\`\${report.totals.lsBytes} байт\`} accent="#76FF03" />
              <MetricTile label="Изменено" value={report.significantChanges.length} accent="#FF5252" />
            </${D}>
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
                delta: c.charDelta >= 0 ? \`+\${c.charDelta}\` : String(c.charDelta),
              }))} />
            </CollapsibleList>
            <CollapsibleList title="localStorage" count={report.localStorage.length}>
              <DataTable columns={[{ key: "key", label: "Ключ" }, { key: "size", label: "Байт" }]}
                rows={report.localStorage.slice(0, 40).map(e => ({ key: e.key, size: e.size }))} />
            </CollapsibleList>
            <CollapsibleList title="Журнал аудита" count={report.auditLog.length}>
              {report.auditLog.map(a => (
                <${D} key={a.id} style={{ fontSize: 11, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <${D} style={{ color: "#FF5252", fontWeight: 800 }}>{new Date(a.ts).toLocaleString("ru-RU")}</${D}>
                  <${D} style={{ color: "rgba(255,255,255,0.7)" }}>{a.summary}</${D}>
                </${D}>
              ))}
            </CollapsibleList>
          </>
        )}
      </TechPanel>
    </${D}>
  );
}

function btn(color: string) {
  return {
    padding: "8px 14px", border: \`1px solid \${color}88\`, borderRadius: 8,
    background: \`\${color}22\`, color, fontWeight: 900, fontSize: 11, cursor: "pointer",
  } as const;
}
`);

console.log("tabs ok");
