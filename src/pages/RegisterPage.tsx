import { useState, type CSSProperties } from "react";
import { useI18n } from "../i18n";
import { upgradeGuestAccountCloud } from "../utils/cloud/authCloud";
import { Tr } from "../i18n/Tr";

interface Props {
  onBack: () => void;
  onDone: () => void;
}

const base = ((import.meta as any).env?.BASE_URL ?? "/").replace(/\/?$/, "/");

export default function RegisterPage({ onBack, onDone }: Props) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = () => {
    if (busy) return;
    setError("");
    if (password !== confirm) {
      setError(t("accounts.register.passwordMismatch"));
      return;
    }
    setBusy(true);
    void upgradeGuestAccountCloud(username, password, email || "").then((result) => {
      setBusy(false);
      if (result.success) onDone();
      else setError(result.error || t("common.error"));
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0018", overflow: "hidden", zIndex: 1, fontFamily: "var(--app-font-sans)" }}>
      <img
        src={`${base}loading-battle.png`}
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
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

      <button
        type="button"
        onClick={onBack}
        className="ui-back-btn"
        style={{ position: "absolute", top: 16, left: 16, zIndex: 10 }}
      >
        ←
      </button>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          zIndex: 5,
        }}
      >
        <div
          style={{
            width: "min(400px, 100%)",
            borderRadius: 18,
            padding: "24px 22px 20px",
            background: "linear-gradient(165deg, rgba(35,18,55,0.97), rgba(12,8,28,0.98))",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.65), 0 0 40px rgba(120,40,180,0.25)",
          }}
        >
          <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 900, letterSpacing: 0.5, color: "#fff" }}>
            <Tr id="accounts.register.title" />
          </h2>
          <p style={{ margin: "0 0 18px", fontSize: 12, color: "rgba(255,255,255,0.55)", lineHeight: 1.45 }}>
            <Tr id="accounts.register.hint" />
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="text" className="ui-input" autoComplete="username" placeholder={t("auth.username")} value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
            <input type="email" className="ui-input" autoComplete="email" placeholder={t("accounts.email")} value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input type="password" className="ui-input" autoComplete="new-password" placeholder={t("auth.password")} value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            <input type="password" className="ui-input" autoComplete="new-password" placeholder={t("accounts.register.confirmPassword")} value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSubmit()} style={inputStyle} />

            {error && (
              <div style={{ fontSize: 12, color: "#FF8A80", fontWeight: 700, textAlign: "center" }}>{error}</div>
            )}

            <button type="button" onClick={handleSubmit} className="ui-btn ui-btn--primary ui-btn--block" style={{ marginTop: 4, fontWeight: 900, letterSpacing: "0.04em" }}>
              <Tr id="accounts.register.submit" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
};
