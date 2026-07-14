import { useEffect, useState, type CSSProperties } from "react";

import AdminPanel from "../pages/AdminPanel";

import {

  clearConfigSession,

  getConfigBaseUrl,

  getConfigToken,

  loginConfigServer,

  pingConfigServer,

} from "./configServerAuth";

import { lockAdmin } from "../utils/mapEditorAPI";

import { LIVE_OPS_SYNC_EVENT } from "../utils/liveOpsSync";

import { hydrateAdminFromServer } from "../utils/adminHydrate";
import { fetchAdminReportQueue } from "../utils/playerReports";
import { getUnreadFeedbackCount } from "../utils/messages";
import { pollAdminNotifications, requestAdminNotificationPermission } from "../utils/adminNotifications";

import {

  authenticateAdminBiometric,

  isBiometricRequiredAfterLogin,

  requestAdminBiometricPermission,

} from "../utils/adminBiometric";

import { getAdminSetting } from "../data/adminSettingsManifest";
import { getAdminPollMs } from "../utils/adminSettingsRuntime";

const GATE_DEFAULT = localStorage.getItem("sf_cfg_gate") || "";



export default function AdminDesktopApp() {

  const [authed, setAuthed] = useState(() => Boolean(getConfigToken()));

  const [panelReady, setPanelReady] = useState(false);

  const [baseUrl, setBaseUrl] = useState(getConfigBaseUrl);

  const [gate, setGate] = useState(GATE_DEFAULT);

  const [password, setPassword] = useState("");

  const [err, setErr] = useState("");

  const [online, setOnline] = useState<boolean | null>(null);

  const [syncMsg, setSyncMsg] = useState("");

  const [hydrating, setHydrating] = useState(false);



  useEffect(() => {

    void requestAdminBiometricPermission();
    void requestAdminNotificationPermission();

  }, []);

  useEffect(() => {
    if (!authed || !panelReady) return;
    const tick = async () => {
      const queue = await fetchAdminReportQueue();
      await pollAdminNotifications({
        queueCount: queue.length,
        unreadFeedback: getUnreadFeedbackCount(),
      });
    };
    const pollMs = getAdminPollMs("inbox.poll_sec", 45);
    void tick();
    const id = window.setInterval(() => { void tick(); }, pollMs);
    return () => window.clearInterval(id);
  }, [authed, panelReady]);



  useEffect(() => {

    pingConfigServer(baseUrl).then(setOnline);

  }, [baseUrl]);



  useEffect(() => {

    const onSync = (ev: Event) => {

      const detail = (ev as CustomEvent<{ ok?: boolean; message?: string }>).detail;

      if (!detail?.message) return;

      setSyncMsg(detail.ok ? `✓ ${detail.message}` : `✗ ${detail.message}`);

      setTimeout(() => setSyncMsg(""), 4000);

    };

    window.addEventListener(LIVE_OPS_SYNC_EVENT, onSync);

    return () => window.removeEventListener(LIVE_OPS_SYNC_EVENT, onSync);

  }, []);



  useEffect(() => {

    if (!authed) {

      setPanelReady(false);

      return;

    }

    if (!getAdminSetting<boolean>("sync.hydrate_on_login", true)) {

      setPanelReady(true);

      return;

    }

    setHydrating(true);

    void hydrateAdminFromServer().finally(() => {

      setHydrating(false);

      setPanelReady(true);

    });

  }, [authed]);



  useEffect(() => {
    if (!authed) return;
    if (!getAdminSetting<boolean>("sec.auto_logout_idle", true)) return;
    const idleMs = Math.max(5, getAdminSetting<number>("sec.idle_logout_minutes", 60)) * 60_000;
    let timer = window.setTimeout(() => {
      clearConfigSession();
      lockAdmin();
      setAuthed(false);
      setPanelReady(false);
    }, idleMs);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        clearConfigSession();
        lockAdmin();
        setAuthed(false);
        setPanelReady(false);
      }, idleMs);
    };
    const events = ["pointerdown", "keydown", "touchstart", "scroll"] as const;
    for (const ev of events) window.addEventListener(ev, bump, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const ev of events) window.removeEventListener(ev, bump);
    };
  }, [authed]);



  const doLogin = async () => {

    setErr("");

    try {

      await loginConfigServer(baseUrl.trim(), gate.trim(), password);

      if (isBiometricRequiredAfterLogin()) {

        const ok = await authenticateAdminBiometric("Подтвердите вход в Starfall Admin");

        if (!ok) {

          clearConfigSession();

          setErr("Биометрическая проверка не пройдена");

          return;

        }

      }

      setAuthed(true);

      setPassword("");

    } catch (e) {

      const code = e instanceof Error ? e.message : "";

      setErr(

        code === "gate" ? "Неверный ключ доступа (gate key)"

          : code === "password" ? "Неверный пароль администратора"

            : code === "rate" ? "Слишком много попыток — подождите минуту"

              : code === "network" ? "Сервер недоступен или браузер заблокировал запрос"

                : "Ошибка входа",

      );

    }

  };



  const logout = () => {

    if (getAdminSetting<boolean>("sec.confirm_logout", true) && !confirm("Выйти из админ-панели?")) return;

    clearConfigSession();

    lockAdmin();

    setAuthed(false);

    setPanelReady(false);

  };



  if (!authed) {

    return (

      <div style={{

        minHeight: "100vh",

        background: "#0b0f17",

        color: "#e8eef7",

        display: "flex",

        alignItems: "center",

        justifyContent: "center",

        padding: 24,

        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",

      }}>

        <div style={{

          width: "100%",

          maxWidth: 420,

          background: "#131a26",

          border: "1px solid #243044",

          borderRadius: 14,

          padding: 24,

        }}>

          <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>Starfall Admin</h2>

          <p style={{ margin: "0 0 18px", fontSize: 13, color: "#8aa0bd", lineHeight: 1.45 }}>

            Полная панель разработчика. Подключение к config-server на VPS.

          </p>

          <label style={lbl}>Адрес config-server</label>

          <input style={inp} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />

          <label style={lbl}>Ключ доступа (gate key)</label>

          <input style={inp} type={getAdminSetting<boolean>("sec.hide_gate_key", true) ? "password" : "text"} value={gate} onChange={(e) => setGate(e.target.value)} />

          <label style={lbl}>Пароль администратора</label>

          <input

            style={inp}

            type="password"

            value={password}

            onChange={(e) => setPassword(e.target.value)}

            onKeyDown={(e) => { if (e.key === "Enter") void doLogin(); }}

          />

          {err && <div style={{ color: "#ff6b6b", fontSize: 12, marginTop: 10, fontWeight: 700 }}>{err}</div>}

          <button type="button" onClick={() => void doLogin()} style={btnPrimary}>Войти</button>

          <div style={{ marginTop: 10, fontSize: 12, color: online === null ? "#8aa0bd" : online ? "#3ad29f" : "#ff6b6b" }}>

            {online === null ? "Проверка сервера…" : online ? "Сервер доступен" : "Сервер недоступен — проверьте адрес"}

          </div>

          <div style={{ marginTop: 8, fontSize: 11, color: "#8aa0bd" }}>

            На Android можно включить вход по отпечатку или лицу в ⚙️ Настройки → Безопасность.

          </div>

        </div>

      </div>

    );

  }



  if (hydrating || !panelReady) {

    return (

      <div style={{

        minHeight: "100vh", background: "#0b0f17", color: "#8aa0bd",

        display: "flex", alignItems: "center", justifyContent: "center",

        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", fontWeight: 700,

      }}>

        Загрузка данных с сервера…

      </div>

    );

  }



  return (

    <div style={{ minHeight: "100dvh", height: "100dvh", background: "#0b0f17", overflow: "hidden" }}>

      {syncMsg && (

        <div style={{

          position: "fixed", top: 12, right: 12, zIndex: 9999,

          background: syncMsg.startsWith("✓") ? "#1b4332" : "#4a1515",

          color: "#fff", padding: "10px 14px", borderRadius: 10,

          fontSize: 12, fontWeight: 700, maxWidth: 360,

          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",

        }}>

          {syncMsg}

        </div>

      )}

      <AdminPanel

        onBack={logout}

        onPreviewTechBreak={() => {

          window.open(`${window.location.origin}${window.location.pathname}?preview=techbreak`, "_blank");

        }}

      />

    </div>

  );

}



const lbl: CSSProperties = {

  display: "block",

  fontSize: 12,

  color: "#8aa0bd",

  marginBottom: 6,

  marginTop: 12,

};



const inp: CSSProperties = {

  width: "100%",

  boxSizing: "border-box",

  background: "#0f1622",

  border: "1px solid #243044",

  color: "#e8eef7",

  borderRadius: 8,

  padding: "8px 10px",

  font: "inherit",

};



const btnPrimary: CSSProperties = {

  marginTop: 16,

  width: "100%",

  background: "#4f9cff",

  border: "none",

  color: "#04101f",

  borderRadius: 8,

  padding: "10px 0",

  fontWeight: 800,

  fontSize: 14,

  cursor: "pointer",

};

