import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { commitAdminAction } from "../../utils/adminScheduler";
import AdminScheduleControls, { useAdminScheduleState } from "./AdminScheduleControls";
import {
  controlServerAiTraining,
  fetchServerTrainingStatus,
  type ServerTrainingStatus,
} from "../../utils/aiTrainingServerClient";
import { adminConfigHeaders, getConfigBaseUrl } from "../../adminDesktop/configServerAuth";
import { buildAiDashboard, ensureDemoAiTelemetry } from "../../utils/devAnalytics/devAiTelemetry";
import { getAdminSetting } from "../../data/adminSettingsManifest";
import { getAdminPollMs, subscribeAdminSettings } from "../../utils/adminSettingsRuntime";
import { BarChart, CollapsibleList, DataTable, DonutChart, LineChart, MetricTile } from "../../utils/devAnalytics/devCharts";
import { AdminTechPanel as TechPanel } from "./AdminTechPanel";

export default function AdminAiTab() {
  const [training, setTraining] = useState<ServerTrainingStatus | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();
  const data = useMemo(() => {
    try {
      if (!getAdminSetting<boolean>("ai.hide_demo_data", true)) {
        ensureDemoAiTelemetry();
      }
      return buildAiDashboard();
    } catch (e) {
      console.warn("[AdminAiTab] telemetry", e);
      return null;
    }
  }, []);

  const refresh = async () => {
    const status = await fetchServerTrainingStatus();
    if (status != null) {
      setTraining(status);
      setServerOnline(true);
      setErr("");
      return status;
    }
    try {
      const base = getConfigBaseUrl().replace(/\/$/, "");
      const res = await fetch(`${base}/admin/ai-training/status`, {
        headers: adminConfigHeaders(),
        cache: "no-store",
      });
      if (res.status === 404) {
        setServerOnline(false);
        setErr("");
      } else if (res.status === 401) {
        setServerOnline(null);
        setErr("Сессия истекла — выйдите и войдите в админ-панель снова.");
      } else {
        setServerOnline(false);
      }
    } catch {
      setServerOnline(false);
    }
    setTraining(null);
    return null;
  };

  useEffect(() => {
    void refresh();
    let id = 0;
    const arm = () => {
      if (id) window.clearInterval(id);
      if (!getAdminSetting<boolean>("ai.auto_refresh", true)) return;
      const sec = Math.max(3, getAdminSetting<number>("sync.ai_poll_sec", getAdminSetting<number>("ai.refresh_sec", 10)));
      id = window.setInterval(() => { void refresh(); }, sec * 1000);
    };
    arm();
    const unsub = subscribeAdminSettings(arm);
    return () => {
      unsub();
      if (id) window.clearInterval(id);
    };
  }, []);

  const runAction = async (action: "start" | "stop" | "force100", label: string) => {
    if (!getAdminSetting<boolean>("ai.server_training", true)) {
      setErr("Обучение на сервере отключено в настройках (ИИ → «Обучение на config-server»).");
      return;
    }
    if (action === "start" && getAdminSetting<boolean>("ai.confirm_start", true) && !confirm("Запустить обучение ботов на сервере?")) return;
    if (action === "stop" && getAdminSetting<boolean>("ai.confirm_stop", true) && !confirm("Остановить обучение и опубликовать botAi в игру?")) return;
    setErr("");
    setBusy(true);
    try {
      const r = commitAdminAction({
        domain: "ai_training",
        label,
        schedule,
        payload: { action },
      });
      if (r.immediate) {
        const status = await controlServerAiTraining(action);
        if (!status) {
          setErr("Сервер недоступен. Проверьте config-server на VPS.");
          return;
        }
        setTraining(status);
      }
      resetSchedule();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const target = training?.targetCycles ?? 100_000_000;
  const total = training?.totalCycles ?? 0;
  const trainPct = Math.min(100, (total / Math.max(1, target)) * 100);
  const trainingRunning = training?.running ?? false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <TechPanel title="Обучение ботов на игровом сервере" subtitle="Виртуальные циклы боёв · ~100 млн суммарно · tuning → botAi → игра" accent="#76FF03">
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 10, lineHeight: 1.5 }}>
          Обучение выполняется на config-server (VPS). Результаты публикуются в домен <b>botAi</b> и
          автоматически попадают в мозги всех ботов в игре через live-config.
        </div>
        {serverOnline === false && (
          <div style={{ color: "#FF8A80", fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
            Сервер обучения недоступен — задеployьте config-server: node scripts/vps-deploy-config-server.mjs
          </div>
        )}
        {err && <div style={{ color: "#FF8A80", fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
          <MetricTile label="Статус" value={trainingRunning ? "Запись" : "Стоп"} accent={trainingRunning ? "#76FF03" : "#FF5252"} />
          <MetricTile label="Циклов" value={total.toLocaleString("ru-RU")} sub={`из ${target.toLocaleString("ru-RU")}`} accent="#76FF03" />
          <MetricTile label="Треки" value={training ? `${training.completedTracks}/${training.totalTracks}` : "—"} accent="#CE93D8" />
          <MetricTile label="Прогресс" value={`${trainPct.toFixed(3)}%`} accent="#00E5FF" />
          <MetricTile label="Скорость" value={training?.cyclesPerSec ?? 0} sub="циклов/с" accent="#FFD54F" />
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: 12 }}>
          <div style={{ width: `${trainPct}%`, height: "100%", background: "linear-gradient(90deg, #76FF03, #00E5FF)" }} />
        </div>
        <AdminScheduleControls schedule={schedule} onChange={setSchedule} compact />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <button type="button" disabled={busy || trainingRunning || !!training?.complete} onClick={() => void runAction("start", "Запуск обучения на сервере")} style={btn("#76FF03", trainingRunning || !!training?.complete)}>
            Запустить циклы на сервере
          </button>
          <button type="button" disabled={busy || !trainingRunning} onClick={() => void runAction("stop", "Остановка и публикация botAi")} style={btn("#FF5252", !trainingRunning)}>
            Остановить и залить в игру
          </button>
          <button type="button" disabled={busy} onClick={() => void runAction("force100", "+100k циклов на сервере")} style={btn("#00E5FF", false)}>
            +100 000 циклов (разово)
          </button>
        </div>
        {training?.tracks?.length ? (
          <CollapsibleList title="Прогресс по трекам" count={training.tracks.length} defaultOpen={false}>
            <DataTable
              columns={[
                { key: "label", label: "Трек" },
                { key: "cycles", label: "Циклы" },
                { key: "pct", label: "%" },
              ]}
              rows={training.tracks.map(tr => ({
                label: tr.label,
                cycles: `${tr.cycles.toLocaleString("ru-RU")} / ${tr.target.toLocaleString("ru-RU")}`,
                pct: `${tr.pct.toFixed(2)}%${tr.complete ? " ✓" : ""}`,
              }))}
            />
          </CollapsibleList>
        ) : null}
        {training?.tuning && (
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 6, fontSize: 10 }}>
            {(["engageBias", "objectiveBias", "retreatBias", "flankBias", "superBias"] as const).map(k => (
              <div key={k} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 6, padding: "6px 8px" }}>
                <div style={{ color: "rgba(255,255,255,0.45)" }}>{k}</div>
                <div style={{ color: "#00E5FF", fontWeight: 800 }}>{training.tuning[k].toFixed(4)}</div>
              </div>
            ))}
          </div>
        )}
      </TechPanel>

      {data && (
        <>
          <TechPanel title="Нейросеть / подписка" subtitle="Модели OpenRouter & OpenAI" accent="#CE93D8">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 12 }}>
              <MetricTile label="LLM" value={data.llmEnabled ? "ON" : "OFF"} accent={data.llmEnabled ? "#76FF03" : "#FF5252"} />
              <MetricTile label="Star Guardian" value={data.starGuardian ? "Да" : "Нет"} accent="#CE93D8" />
              <MetricTile label="Модель" value={(data.llmModel || "—").split("/").pop() ?? "—"} sub={data.llmProvider} accent="#00E5FF" />
              <MetricTile label="Диалог" value={data.chatHistoryLen} sub="сообщений" accent="#FFD54F" />
            </div>
          </TechPanel>

          <TechPanel title="Астрал — стратегии" subtitle="Автопилот" accent="#00E5FF">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <BarChart data={data.autoplayModeCounts.length ? data.autoplayModeCounts : [{ label: "explore", value: 1 }]} accent="#00E5FF" />
              <DonutChart segments={data.deathTagBreakdown.length ? data.deathTagBreakdown : [{ label: "—", value: 1, color: "#888" }]} />
            </div>
            <div style={{ marginTop: 12 }}>
              <LineChart points={data.strategyTimeline.length ? data.strategyTimeline : [0, 1, 0, 1]} accent="#76FF03" />
            </div>
          </TechPanel>

          <TechPanel title="Боты — журнал" subtitle="Тактики" accent="#76FF03">
            <DataTable
              columns={[
                { key: "ts", label: "Время" },
                { key: "mode", label: "Режим" },
                { key: "detail", label: "Событие" },
              ]}
              rows={(data.botEvents.slice(0, 40).length ? data.botEvents.slice(0, 40) : [{ ts: Date.now(), mode: "—", detail: "Нет записей" }]).map(e => ({
                ts: new Date(e.ts).toLocaleString("ru-RU"),
                mode: e.mode ?? "—",
                detail: String(e.detail).slice(0, 90),
              }))}
            />
          </TechPanel>
        </>
      )}
    </div>
  );
}

function btn(color: string, disabled: boolean): CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 8,
    border: `1px solid ${color}88`,
    background: `${color}22`,
    color,
    fontWeight: 800,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}
