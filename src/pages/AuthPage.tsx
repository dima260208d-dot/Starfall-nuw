import { useState, type CSSProperties } from "react";
import { useI18n } from "../i18n";
import { createGuestProfile } from "../utils/localStorageAPI";
import { loginAccountCloud, registerAccountCloud } from "../utils/cloud/authCloud";
import { syncProfileWithCloud, ensureAutoCloudSyncRunning } from "../utils/cloud/profileCloud";
import { Tr } from "../i18n/Tr";

interface AuthPageProps {
  onAuth: () => void;
}

import { resolvePublicAssetUrl } from "../lib/assetBase";

export default function AuthPage({ onAuth }: AuthPageProps) {
  const { t } = useI18n();
  const [modal, setModal] = useState<null | "login" | "register">(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const openModal = (m: "login" | "register") => {
    setModal(m);
    setError("");
    setUsername("");
    setEmail("");
    setPassword("");
  };

  const closeModal = () => {
    setModal(null);
    setError("");
  };

  const finishAuth = () => {
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 6000));
    void Promise.race([syncProfileWithCloud(), timeout])
      .finally(() => {
        ensureAutoCloudSyncRunning();
        onAuth();
      });
  };

  const handleSubmit = () => {
    if (busy) return;
    setError("");
    setBusy(true);

    void (async () => {
      try {
        if (modal === "register") {
          if (!email.trim().includes("@")) {
            setError("Укажите корректный e-mail");
            return;
          }
          const result = await registerAccountCloud(username.trim(), password, email.trim());
          if (result.success) finishAuth();
          else setError(result.error || t("common.error"));
        } else if (modal === "login") {
          const result = await loginAccountCloud(username.trim(), password);
          if (result.success) finishAuth();
          else setError(result.error || t("common.error"));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t("common.error"));
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleGuest = () => {
    createGuestProfile();
    finishAuth();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0018",
        overflow: "hidden",
        zIndex: 100,
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <img
        src={resolvePublicAssetUrl("loading-battle.png")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: [
            "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 22%, transparent 58%, rgba(0,0,10,0.9) 100%)",
            "linear-gradient(90deg, rgba(0,0,0,0.18) 0%, transparent 14%, transparent 86%, rgba(0,0,0,0.18) 100%)",
          ].join(", "),
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 24,
          right: 28,
          zIndex: 5,
          lineHeight: 1,
          userSelect: "none",
          textAlign: "right",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: "clamp(28px, 7vw, 48px)",
            fontWeight: 900,
            letterSpacing: 6,
            color: "white",
            textShadow: [
              "0 0 22px rgba(255,210,0,0.95)",
              "0 0 60px rgba(200,80,255,0.75)",
              "0 3px 0 rgba(0,0,0,1)",
              "0 5px 20px rgba(0,0,0,0.95)",
            ].join(", "),
            animation: "authTitleGlow 2.6s ease-in-out infinite alternate",
          }}
        >
          <Tr id="auth.title" />
        </div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: 6,
            color: "rgba(255,225,100,0.9)",
            marginTop: 4,
            textShadow: "0 0 12px rgba(255,200,0,0.8)",
            fontWeight: 700,
          }}
        >
          <Tr id="auth.subtitle" />
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 6,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 8,
          maxWidth: 720,
          margin: "0 auto",
          padding: "16px",
          paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "nowrap",
            alignItems: "stretch",
            gap: 10,
            width: "100%",
          }}
        >
          <button
            type="button"
            onClick={() => openModal("register")}
            style={btnPrimary}
          >
            <Tr id="auth.register" />
          </button>
          <button
            type="button"
            onClick={() => openModal("login")}
            style={btnSecondary}
          >
            <Tr id="auth.login" />
          </button>
          <button
            type="button"
            onClick={handleGuest}
            style={btnGhost}
          >
            <Tr id="auth.guest" />
          </button>
        </div>
        <p
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: 10,
            color: "rgba(255,255,255,0.45)",
            lineHeight: 1.35,
          }}
        >
          <Tr id="auth.guestHint" />
        </p>
      </div>

      {modal && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            background: "rgba(0,0,12,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backdropFilter: "blur(6px)",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
            style={{
              width: "min(380px, 100%)",
              borderRadius: 18,
              padding: "22px 22px 18px",
              background: "linear-gradient(165deg, rgba(35,18,55,0.97), rgba(12,8,28,0.98))",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.65), 0 0 40px rgba(120,40,180,0.25)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <h2
                id="auth-dialog-title"
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: 0.5,
                  color: "#fff",
                  lineHeight: 1.2,
                }}
              >
                {modal === "register" ? t("auth.modal.register") : t("auth.modal.login")}
              </h2>
              <button
                type="button"
                aria-label={t("common.close")}
                onClick={closeModal}
                style={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  padding: 0,
                  margin: 0,
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.35)",
                  color: "#fff",
                  fontSize: 22,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                className="auth-inp"
                autoComplete="username"
                placeholder={modal === "login" ? t("auth.loginOrEmail") : t("auth.username")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={inputStyle}
              />
              {modal === "register" && (
                <input
                  type="email"
                  className="auth-inp"
                  autoComplete="email"
                  placeholder={t("auth.email")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  style={inputStyle}
                />
              )}
              <input
                type="password"
                className="auth-inp"
                autoComplete={modal === "register" ? "new-password" : "current-password"}
                placeholder={t("auth.password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                style={inputStyle}
              />

              {error && (
                <div
                  style={{
                    background: "rgba(255,82,82,0.12)",
                    border: "1px solid rgba(255,82,82,0.35)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "#ff8a80",
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  {error}
                </div>
              )}

              <button type="button" onClick={handleSubmit} disabled={busy} style={{ ...btnModalSubmit, opacity: busy ? 0.65 : 1 }}>
                {busy ? "…" : modal === "register" ? t("auth.createAccount") : t("auth.login")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes authTitleGlow {
          0% { text-shadow: 0 0 18px rgba(255,210,0,0.85), 0 0 50px rgba(200,80,255,0.55), 0 3px 0 #000, 0 5px 20px rgba(0,0,0,0.95); }
          100% { text-shadow: 0 0 34px rgba(255,225,0,1), 0 0 80px rgba(220,100,255,0.9), 0 3px 0 #000, 0 5px 20px rgba(0,0,0,0.95); }
        }
        input.auth-inp::placeholder { color: rgba(255,255,255,0.35); }
      `}</style>
    </div>
  );
}

const btnRowBase: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  padding: "13px 10px",
  borderRadius: "var(--r-md)",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: "clamp(10px, 2.8vw, 14px)",
  letterSpacing: "0.04em",
  textAlign: "center",
  lineHeight: 1.25,
  whiteSpace: "normal",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  transition: "transform var(--ease-mid), box-shadow var(--ease-mid), filter var(--ease-mid)",
  fontFamily: "inherit",
};

const btnPrimary: CSSProperties = {
  ...btnRowBase,
  border: "1px solid rgba(255,255,255,0.34)",
  color: "#fff",
  background: "linear-gradient(135deg, #7B2FBE 0%, #D500F9 45%, #FF6F00 100%)",
  boxShadow:
    "0 10px 28px rgba(213,0,249,0.55), 0 0 18px rgba(255,111,0,0.35), inset 0 1px 0 rgba(255,255,255,0.42)",
};

const btnSecondary: CSSProperties = {
  ...btnRowBase,
  border: "1px solid rgba(255,255,255,0.32)",
  color: "#fff",
  background:
    "linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))",
  boxShadow: "0 8px 22px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.20)",
  backdropFilter: "blur(12px) saturate(1.18)",
  WebkitBackdropFilter: "blur(12px) saturate(1.18)",
};

const btnGhost: CSSProperties = {
  ...btnRowBase,
  border: "1px solid var(--bd-2)",
  fontWeight: 800,
  color: "var(--t-2)",
  background: "rgba(0,0,0,0.45)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  boxShadow: "var(--sh-sm), inset 0 1px 0 rgba(255,255,255,0.04)",
};

const btnModalSubmit: CSSProperties = {
  marginTop: 4,
  width: "100%",
  padding: "14px 16px",
  borderRadius: "var(--r-md)",
  border: "1px solid rgba(255,255,255,0.32)",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 15,
  letterSpacing: "0.06em",
  color: "#fff",
  background: "linear-gradient(135deg, #5E35B1 0%, #D500F9 100%)",
  boxShadow:
    "0 10px 28px rgba(94,53,177,0.6), 0 0 16px rgba(213,0,249,0.4), inset 0 1px 0 rgba(255,255,255,0.38)",
  transition: "transform var(--ease-mid), filter var(--ease-mid)",
  fontFamily: "inherit",
};

const inputStyle: CSSProperties = {
  background: "rgba(0,0,0,0.45)",
  border: "1px solid var(--bd-2)",
  borderRadius: "var(--r-md)",
  padding: "12px 14px",
  color: "var(--t-1)",
  fontSize: 15,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color var(--ease-mid), box-shadow var(--ease-mid)",
  fontFamily: "inherit",
};
