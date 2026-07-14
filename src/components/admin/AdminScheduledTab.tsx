import { useEffect, useState } from "react";
import {
  applyAllPendingAdminActionsNow,
  cancelScheduledAdminAction,
  formatAdminScheduleRule,
  getAllScheduledAdminActions,
  subscribeAdminScheduleChanges,
  type ScheduledAdminAction,
} from "../../utils/adminScheduler";

function btn(color: string): React.CSSProperties {
  return {
    padding: "5px 10px",
    borderRadius: 8,
    border: `1px solid ${color}88`,
    background: `${color}22`,
    color,
    fontWeight: 800,
    fontSize: 11,
    cursor: "pointer",
  };
}

export default function AdminScheduledTab() {
  const [items, setItems] = useState<ScheduledAdminAction[]>(() => getAllScheduledAdminActions());
  const [msg, setMsg] = useState("");

  useEffect(() => subscribeAdminScheduleChanges(() => {
    setItems(getAllScheduledAdminActions());
  }), []);

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 2200);
  };

  const pending = items.filter(i => i.status === "pending");
  const history = items.filter(i => i.status !== "pending").slice(0, 40);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        padding: 12,
        borderRadius: 12,
        background: "rgba(206,147,216,0.10)",
        border: "1px solid rgba(206,147,216,0.30)",
        fontSize: 12,
        lineHeight: 1.5,
        color: "rgba(255,255,255,0.85)",
      }}>
        Здесь все отложенные и повторяющиеся действия из панели разработчика.
        Можно отменить запланированное до момента применения.
      </div>

      <Section title={`ОЖИДАЮТ ПРИМЕНЕНИЯ (${pending.length})`}>
        {pending.length > 0 && (
          <button
            type="button"
            style={{ ...btn("#76FF03"), marginBottom: 10 }}
            onClick={() => {
              const n = applyAllPendingAdminActionsNow();
              flash(n > 0 ? `Применено действий: ${n}` : "Нечего применять");
            }}
          >
            ⚡ Применить все сейчас
          </button>
        )}
        {pending.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Нет запланированных действий</div>
        ) : (
          pending.map(item => (
            <ActionRow
              key={item.id}
              item={item}
              onCancel={() => {
                if (cancelScheduledAdminAction(item.id)) flash("Отменено");
              }}
            />
          ))
        )}
      </Section>

      <Section title="ИСТОРИЯ">
        {history.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Пока пусто</div>
        ) : (
          history.map(item => <ActionRow key={item.id} item={item} />)
        )}
      </Section>

      {msg && (
        <div style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#76FF03" }}>{msg}</div>
      )}
    </div>
  );
}

function ActionRow({ item, onCancel }: { item: ScheduledAdminAction; onCancel?: () => void }) {
  const statusColor = item.status === "pending" ? "#FFD54F" : item.status === "applied" ? "#76FF03" : "#FF7070";
  return (
    <div style={{
      padding: 10,
      borderRadius: 10,
      background: "rgba(0,0,0,0.35)",
      border: "1px solid rgba(255,255,255,0.10)",
      marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "white" }}>{item.label}</div>
        <span style={{ fontSize: 10, fontWeight: 800, color: statusColor }}>{item.status.toUpperCase()}</span>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
        {item.domain} · {formatAdminScheduleRule(item.schedule)}
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.40)", marginTop: 4 }}>
        След. запуск: {new Date(item.nextRunAt).toLocaleString("ru-RU")}
        {item.lastAppliedAt && ` · Последнее: ${new Date(item.lastAppliedAt).toLocaleString("ru-RU")}`}
        {item.applyCount > 0 && ` · ×${item.applyCount}`}
      </div>
      {onCancel && (
        <button type="button" onClick={onCancel} style={{ ...btn("#FF7070"), marginTop: 8 }}>
          Отменить
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#CE93D8", marginBottom: 8, letterSpacing: 0.5 }}>
        {title}
      </div>
      {children}
    </div>
  );
}
