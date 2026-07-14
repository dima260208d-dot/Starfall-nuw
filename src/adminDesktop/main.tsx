import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import "../index.css";
import AdminDesktopApp from "./AdminDesktopApp";
import { loadCloudRuntimeConfig } from "../lib/runtimeConfig";
import { initCapacitorShell } from "../platform";
import { I18nProvider } from "../i18n";
import { initLocale } from "../i18n/core";

function AdminBoot() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      initLocale();
      await loadCloudRuntimeConfig();
      await initCapacitorShell();
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#0b0f17",
        color: "#8aa0bd",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontSize: 14,
        fontWeight: 700,
      }}>
        Загрузка Starfall Admin…
      </div>
    );
  }

  return (
    <I18nProvider>
      <AdminDesktopApp />
    </I18nProvider>
  );
}

createRoot(document.getElementById("root")!).render(<AdminBoot />);
