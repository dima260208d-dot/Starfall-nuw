import { useEffect, useState } from "react";
import { fetchAdminReportQueue, resolveAdminReport } from "../../utils/playerReports";
import { TechPanel, CollapsibleList, DataTable } from "../../utils/devAnalytics/devCharts";

export default function AdminReportsTab() {
  const [queue, setQueue] = useState<Awaited<ReturnType<typeof fetchAdminReportQueue>>>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    setQueue(await fetchAdminReportQueue());
    setLoading(false);
  };

  useEffect(() => { void reload(); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <TechPanel title="Жалобы игроков" subtitle="100+ жалоб за 5 дней → модерация" accent="#FF8A80">
        {loading && <div style={{ fontSize: 12, color: "#8aa0bd" }}>Загрузка…</div>}
        {!loading && queue.length === 0 && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Очередь пуста</div>
        )}
        {queue.map((item) => (
          <div key={item.id} style={{
            marginBottom: 12, padding: 12, borderRadius: 10,
            background: "rgba(255,82,82,0.08)", border: "1px solid rgba(255,82,82,0.25)",
          }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#FF8A80" }}>
              {item.username || item.playerId} · {item.reportCount} жалоб
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
              ID: {item.playerId} · {new Date(item.queuedAt).toLocaleString("ru-RU")}
            </div>
            <CollapsibleList title="Жалобы" count={item.reports.length}>
              <DataTable
                columns={[
                  { key: "cat", label: "Категория" },
                  { key: "from", label: "От" },
                  { key: "at", label: "Когда" },
                ]}
                rows={(item.reports as { category?: string; reporterUsername?: string; at?: number }[]).slice(-30).map((r, i) => ({
                  cat: r.category ?? "—",
                  from: r.reporterUsername ?? "—",
                  at: r.at ? new Date(r.at).toLocaleString("ru-RU") : `#${i}`,
                }))}
              />
            </CollapsibleList>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                type="button"
                style={btn("#76FF03")}
                onClick={() => void (async () => {
                  const r = await resolveAdminReport(item.playerId, "dismiss");
                  setStatus(r.ok ? "Снято с модерации" : (r.error ?? "Ошибка"));
                  void reload();
                })()}
              >
                Оставить игрока
              </button>
              <button
                type="button"
                style={btn("#FF5252")}
                onClick={() => void (async () => {
                  if (!confirm(`Забанить ${item.username}?`)) return;
                  const r = await resolveAdminReport(item.playerId, "ban");
                  setStatus(r.ok ? "Игрок заблокирован" : (r.error ?? "Ошибка"));
                  void reload();
                })()}
              >
                Забанить
              </button>
            </div>
          </div>
        ))}
        {status && <div style={{ fontSize: 12, fontWeight: 700, color: "#3ad29f" }}>{status}</div>}
      </TechPanel>
    </div>
  );
}

function btn(color: string) {
  return {
    padding: "8px 14px", borderRadius: 8, border: `1px solid ${color}88`,
    background: `${color}18`, color, fontWeight: 800, fontSize: 11, cursor: "pointer",
  } as const;
}
