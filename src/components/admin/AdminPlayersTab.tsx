import { useCallback, useEffect, useMemo, useState } from "react";
import { findProfileStorageKey } from "../../utils/localStorageAPI";
import { formatPlayerIdDisplay } from "../../utils/playerId";
import {
  searchPlayerKeys, playerSearchLabel, getPlayerAdminSummary, blockPlayer, unblockPlayer,
} from "../../utils/playerAdmin";
import { commitAdminAction } from "../../utils/adminScheduler";
import { sendGiftToPlayer } from "../../utils/gifts";
import { DEVELOPER_TITLE_ID, hasExclusiveTitle } from "../../data/exclusiveTitles";
import AdminScheduleControls, { useAdminScheduleState } from "./AdminScheduleControls";
import { buildGlobalPlayerAnalytics, buildPlayerDetailAnalytics, formatPlayerId } from "../../utils/devAnalytics/devPlayerAnalytics";
import { TechPanel, MetricTile, BarChart, LineChart, DonutChart, CollapsibleList, DataTable } from "../../utils/devAnalytics/devCharts";
import AdminReportsTab from "./AdminReportsTab";
import {
  blockAdminPlayerOnServer,
  fetchAdminPlayerDetail,
  fetchAdminPlayers,
  type AdminServerPlayer,
} from "../../utils/adminServerApi";
import { isLiveOpsAdminSession } from "../../lib/configServerPublish";
import { getAdminSetting } from "../../data/adminSettingsManifest";

function serverWinRate(p: AdminServerPlayer): number {
  const t = p.totalWins + p.totalLosses;
  return t ? Math.round((p.totalWins / t) * 100) : 0;
}

export default function AdminPlayersTab() {
  const [subTab, setSubTab] = useState<"players" | "reports">("players");
  const useServer = isLiveOpsAdminSession() && getAdminSetting<boolean>("sync.players_live", true);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<AdminServerPlayer | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(useServer);
  const [serverPlayers, setServerPlayers] = useState<AdminServerPlayer[]>([]);
  const [serverGlobal, setServerGlobal] = useState<Awaited<ReturnType<typeof fetchAdminPlayers>>["global"]>(null);
  const [serverError, setServerError] = useState("");
  const { schedule, setSchedule, resetSchedule } = useAdminScheduleState();

  const loadServer = useCallback(async (q?: string) => {
    if (!useServer) return;
    setLoading(true);
    setServerError("");
    const r = await fetchAdminPlayers({
      query: q ?? query,
      limit: getAdminSetting<number>("players.page_size", 50),
    });
    if (!r.ok) {
      setServerError(r.error === "supabase_not_configured"
        ? "Supabase не настроен на config-server"
        : r.error ?? "Ошибка загрузки");
      setServerPlayers([]);
    } else {
      setServerPlayers(r.players);
      if (r.global) setServerGlobal(r.global);
    }
    setLoading(false);
  }, [useServer, query]);

  useEffect(() => {
    if (useServer) void loadServer();
  }, [useServer, loadServer]);

  const global = useMemo(() => {
    if (useServer && serverGlobal) {
      return {
        totalPlayers: serverGlobal.totalPlayers,
        activePlayers: serverGlobal.activePlayers,
        blockedPlayers: serverGlobal.blockedPlayers,
        totalGames: serverGlobal.totalGames,
        totalWins: 0,
        totalLosses: 0,
        totalTrophies: serverGlobal.totalTrophies,
        totalCoins: 0,
        totalGems: 0,
        avgWinRate: serverGlobal.avgWinRate,
        modeActivity: [] as { label: string; value: number }[],
        trophyBuckets: [
          { label: "0-499", value: serverPlayers.filter(p => p.trophies < 500).length },
          { label: "500-999", value: serverPlayers.filter(p => p.trophies >= 500 && p.trophies < 1000).length },
          { label: "1000-1999", value: serverPlayers.filter(p => p.trophies >= 1000 && p.trophies < 2000).length },
          { label: "2000+", value: serverPlayers.filter(p => p.trophies >= 2000).length },
        ],
        activityLast7: [0, 0, 0, 0, 0, 0, 0],
        topPlayers: (serverGlobal.topPlayers ?? serverPlayers).map(p => ({
          storageKey: p.username,
          label: p.username,
          isCurrent: false,
          summary: {
            storageKey: p.username,
            username: p.username,
            playerId: p.playerId,
            blocked: p.blocked,
            trophies: p.trophies,
            totalGamesPlayed: p.totalGamesPlayed,
            coins: p.coins,
            gems: p.gems,
            powerPoints: p.powerPoints,
            totalWins: p.totalWins,
            totalLosses: p.totalLosses,
            clashPassLevel: p.clashPassLevel,
            unlockedBrawlers: p.unlockedBrawlers,
            pendingGifts: p.pendingGifts,
            inboxUnread: p.inboxUnread,
            battleHistory: p.battleHistory as never[],
            modeStats: p.modeStats as never,
            unlockedBrawlerIds: p.unlockedBrawlerIds,
            chestInventory: [],
            masteryTitlesUnlocked: p.masteryTitlesUnlocked,
            createdAt: 0,
          },
        })),
        currentUserEntry: null,
      };
    }
    return buildGlobalPlayerAnalytics();
  }, [useServer, serverGlobal, serverPlayers, selectedKey, status]);

  const summary = !useServer && selectedKey ? getPlayerAdminSummary(selectedKey) : null;
  const detail = summary ? buildPlayerDetailAnalytics(summary) : null;

  const suggestions = useMemo(() => {
    if (useServer) {
      return serverPlayers.map(p => p.username);
    }
    return searchPlayerKeys(query, 30);
  }, [useServer, serverPlayers, query]);

  const pickLocal = (key: string) => { setSelectedKey(key); setSelectedServer(null); setStatus(""); };
  const pickServer = async (p: AdminServerPlayer) => {
    setSelectedServer(p);
    setSelectedKey(p.username);
    setStatus("");
    const detail = await fetchAdminPlayerDetail(p.playerId);
    if (detail) setSelectedServer(detail);
  };

  const activeServer = selectedServer;
  const showServerDetail = useServer && activeServer;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setSubTab("players")} style={btn(subTab === "players" ? "#40C4FF" : "#666")}>👥 Игроки</button>
        <button type="button" onClick={() => setSubTab("reports")} style={btn(subTab === "reports" ? "#FF8A80" : "#666")}>🚩 Жалобы</button>
      </div>
      {subTab === "reports" ? <AdminReportsTab /> : (
    <>
      {useServer && (
        <div style={{ fontSize: 11, color: "#3ad29f", fontWeight: 800 }}>
          ☁️ Данные с Supabase через config-server (live)
        </div>
      )}
      <TechPanel title="Поиск по ID / нику" subtitle="Введите ID без #" accent="#40C4FF">
        <div style={{ display: "flex", gap: 8 }}>
          <input className="ui-input" value={query} onChange={e => setQuery(e.target.value)} placeholder="ID или никнейм" style={{ flex: 1 }} />
          <button type="button" onClick={() => {
            if (useServer) void loadServer(query);
            else {
              const k = findProfileStorageKey(query);
              if (k) pickLocal(k); else setStatus("Не найден");
            }
          }} style={btn("#40C4FF")}>Найти</button>
        </div>
        {loading && <div style={{ marginTop: 8, fontSize: 11, color: "#8aa0bd" }}>Загрузка с сервера…</div>}
        {serverError && <div style={{ marginTop: 8, fontSize: 12, color: "#FF7070" }}>{serverError}</div>}
        {suggestions.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {useServer
              ? serverPlayers.slice(0, 30).map(p => (
                <button key={p.playerId} type="button" onClick={() => void pickServer(p)} style={btn(selectedServer?.playerId === p.playerId ? "#40C4FF" : "#90A4AE")}>
                  {p.username} · {formatPlayerIdDisplay(p.playerId)}
                </button>
              ))
              : suggestions.map(k => (
                <button key={k} type="button" onClick={() => pickLocal(k)} style={btn(selectedKey === k ? "#40C4FF" : "#90A4AE")}>{playerSearchLabel(k)}</button>
              ))}
          </div>
        )}
        {status && <div style={{ marginTop: 8, fontSize: 12, color: "#FF7070" }}>{status}</div>}
      </TechPanel>

      <TechPanel title="Глобальная аналитика" subtitle={`Всего аккаунтов: ${global.totalPlayers}`} accent="#00E5FF">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, marginBottom: 12 }}>
          <MetricTile label="Игроков" value={global.totalPlayers} accent="#00E5FF" />
          <MetricTile label="Активных" value={global.activePlayers} accent="#76FF03" />
          <MetricTile label="Блок" value={global.blockedPlayers} accent="#FF5252" />
          <MetricTile label="Бои" value={global.totalGames} accent="#FFD54F" />
          <MetricTile label="Win%" value={`${global.avgWinRate}%`} accent="#CE93D8" />
          <MetricTile label="Трофеи Σ" value={global.totalTrophies.toLocaleString("ru-RU")} accent="#FF7043" />
        </div>
        {!useServer && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
              <BarChart data={global.modeActivity.slice(0, 8)} accent="#00E5FF" />
              <DonutChart segments={global.trophyBuckets.map((b,i)=>({...b,color:["#90A4AE","#40C4FF","#CE93D8","#FFD54F"][i]}))} />
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: "#00E5FF", fontWeight: 800 }}>Активность 7 дней</div>
            <LineChart points={global.activityLast7} accent="#00E5FF" />
          </>
        )}
        {useServer && global.trophyBuckets.length > 0 && (
          <DonutChart segments={global.trophyBuckets.map((b,i)=>({...b,color:["#90A4AE","#40C4FF","#CE93D8","#FFD54F"][i]}))} />
        )}
        <CollapsibleList title="Список аккаунтов" count={global.topPlayers.length} defaultOpen>
          <DataTable columns={[
            { key: "user", label: "Игрок" },
            { key: "id", label: "ID" },
            { key: "tr", label: "🏆" },
            { key: "games", label: "Бои" },
          ]} rows={global.topPlayers.map(e => ({
            user: useServer ? (
              <button type="button" onClick={() => void pickServer({
                playerId: e.summary.playerId,
                username: e.summary.username,
                blocked: e.summary.blocked,
                coins: e.summary.coins,
                gems: e.summary.gems,
                powerPoints: e.summary.powerPoints,
                trophies: e.summary.trophies,
                totalGamesPlayed: e.summary.totalGamesPlayed,
                totalWins: e.summary.totalWins,
                totalLosses: e.summary.totalLosses,
                clashPassLevel: e.summary.clashPassLevel,
                unlockedBrawlers: e.summary.unlockedBrawlers,
                pendingGifts: e.summary.pendingGifts,
                inboxUnread: e.summary.inboxUnread,
                battleHistory: e.summary.battleHistory,
                modeStats: e.summary.modeStats,
                unlockedBrawlerIds: e.summary.unlockedBrawlerIds,
                masteryTitlesUnlocked: e.summary.masteryTitlesUnlocked,
              })} style={{ ...btn("#888"), padding: "4px 8px" }}>{e.summary.username}</button>
            ) : (
              <button type="button" onClick={() => pickLocal(e.storageKey)} style={{ ...btn(e.isCurrent ? "#FFD54F" : "#888"), padding: "4px 8px" }}>{e.summary.username}{e.isCurrent ? " ★" : ""}</button>
            ),
            id: formatPlayerIdDisplay(e.summary.playerId) || "—",
            tr: e.summary.trophies,
            games: e.summary.totalGamesPlayed,
          }))} />
        </CollapsibleList>
        {!useServer && !getAdminSetting<boolean>("players.hide_current_account_banner", true) && global.currentUserEntry && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, border: "1px solid #FFD54F55", background: "rgba(255,213,79,0.08)" }}>
            <div style={{ fontSize: 10, color: "#FFD54F", fontWeight: 900 }}>Локальный профиль</div>
            <div style={{ fontSize: 12 }}>{global.currentUserEntry.summary.username} · {formatPlayerId(global.currentUserEntry.summary)} · {global.currentUserEntry.summary.trophies}🏆</div>
            <button type="button" onClick={() => pickLocal(global.currentUserEntry!.storageKey)} style={{ ...btn("#FFD54F"), marginTop: 6 }}>Открыть полный отчёт</button>
          </div>
        )}
      </TechPanel>

      {showServerDetail && activeServer && (
        <TechPanel title={`Отчёт: ${activeServer.username}`} subtitle={formatPlayerIdDisplay(activeServer.playerId)} accent="#CE93D8">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginBottom: 12 }}>
            <MetricTile label="Win%" value={`${serverWinRate(activeServer)}%`} accent="#76FF03" />
            <MetricTile label="Монеты" value={activeServer.coins} accent="#FFD54F" />
            <MetricTile label="Крист." value={activeServer.gems} accent="#40C4FF" />
            <MetricTile label="🏆" value={activeServer.trophies} accent="#FF7043" />
            <MetricTile label="Бои" value={activeServer.totalGamesPlayed} accent="#CE93D8" />
          </div>
          {getAdminSetting<boolean>("players.show_battle_history", true) && (
            <CollapsibleList title="История боёв" count={activeServer.battleHistory.length}>
              <DataTable columns={[{ key: "t", label: "Режим" }, { key: "r", label: "Результат" }]}
                rows={(activeServer.battleHistory as { mode?: string; won?: boolean }[]).map((b, i) => ({
                  t: b.mode ?? `#${i + 1}`,
                  r: <span style={{ color: b.won ? "#76FF03" : "#FF5252", fontWeight: 800 }}>{b.won ? "Победа" : "Поражение"}</span>,
                }))} />
            </CollapsibleList>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {activeServer.blocked ? (
              <button type="button" onClick={() => void (async () => {
                const r = await blockAdminPlayerOnServer(activeServer.playerId, false);
                setStatus(r.ok ? "Разблокирован на сервере" : (r.error ?? "Ошибка"));
                if (r.ok) void loadServer();
              })()} style={btn("#76FF03")}>Разблокировать (Supabase)</button>
            ) : (
              <button type="button" onClick={() => void (async () => {
                if (getAdminSetting<boolean>("players.confirm_block", true) && !confirm(`Заблокировать ${activeServer.username}?`)) return;
                const r = await blockAdminPlayerOnServer(activeServer.playerId, true);
                setStatus(r.ok ? "Заблокирован на сервере" : (r.error ?? "Ошибка"));
                if (r.ok) void loadServer();
              })()} style={btn("#FFB74D")}>Заблокировать (Supabase)</button>
            )}
          </div>
        </TechPanel>
      )}

      {!useServer && detail && summary && (
        <TechPanel title={`Отчёт: ${summary.username}`} subtitle={formatPlayerId(summary)} accent="#CE93D8">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginBottom: 12 }}>
            <MetricTile label="Win%" value={`${detail.winRate}%`} accent="#76FF03" />
            <MetricTile label="Engagement" value={detail.engagementScore} accent="#CE93D8" />
            <MetricTile label="Δ трофеев" value={detail.avgTrophyDelta} accent="#FFD54F" />
            <MetricTile label="Монеты" value={summary.coins} accent="#FFD54F" />
            <MetricTile label="Крист." value={summary.gems} accent="#40C4FF" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <BarChart data={detail.modeGames} accent="#40C4FF" />
            <LineChart points={detail.trophyHistory.length ? detail.trophyHistory : [0]} accent="#FFD54F" />
          </div>
          <CollapsibleList title="История боёв" count={detail.battleTimeline.length}>
            <DataTable columns={[{ key: "t", label: "Время" }, { key: "r", label: "Результат" }]}
              rows={detail.battleTimeline.map(b => ({
                t: new Date(b.ts).toLocaleString("ru-RU"),
                r: <span style={{ color: b.won ? "#76FF03" : "#FF5252", fontWeight: 800 }}>{b.label}</span>,
              }))} />
          </CollapsibleList>
          <AdminScheduleControls schedule={schedule} onChange={setSchedule} compact />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={hasExclusiveTitle(summary.masteryTitlesUnlocked, DEVELOPER_TITLE_ID)}
              onClick={() => {
                if (!selectedKey) return;
                const r = sendGiftToPlayer({
                  storageKey: selectedKey,
                  message: "Эксклюзивный титул от разработчиков",
                  items: [{ kind: "exclusiveTitle", titleId: DEVELOPER_TITLE_ID }],
                });
                setStatus(r.success ? "Титул «РАЗРАБОТЧИК» отправлен в подарки игрока" : (r.error ?? "Ошибка"));
              }}
              style={{
                ...btn("#00E5FF"),
                opacity: hasExclusiveTitle(summary.masteryTitlesUnlocked, DEVELOPER_TITLE_ID) ? 0.45 : 1,
              }}
            >
              🏷 Титул РАЗРАБОТЧИК
            </button>
            {summary.blocked ? (
              <button type="button" onClick={() => {
                const r = commitAdminAction({
                  domain: "player_block",
                  label: `Разблокировка: ${summary.username}`,
                  schedule,
                  payload: { storageKey: selectedKey!, blocked: false },
                });
                if (r.immediate) unblockPlayer(selectedKey!);
                setStatus(r.message);
                resetSchedule();
              }} style={btn("#76FF03")}>Разблокировать</button>
            ) : (
              <button type="button" onClick={() => {
                const r = commitAdminAction({
                  domain: "player_block",
                  label: `Блокировка: ${summary.username}`,
                  schedule,
                  payload: { storageKey: selectedKey!, blocked: true },
                });
                if (r.immediate) blockPlayer(selectedKey!);
                setStatus(r.message);
                resetSchedule();
              }} style={btn("#FFB74D")}>Заблокировать</button>
            )}
          </div>
        </TechPanel>
      )}
    </>
      )}
    </div>
  );
}

function btn(color: string) {
  return { padding: "6px 12px", border: `1px solid ${color}88`, borderRadius: 8, background: `${color}18`, color, fontWeight: 800, fontSize: 11, cursor: "pointer" } as const;
}
