import { useState } from "react";
import { useI18n } from "../../i18n";
import { renameTutorialGuest } from "../../utils/tutorial/onboardingTutorial";
import { Tr } from "../../i18n/Tr";

interface Props {
  onDone: () => void;
}

export default function TutorialGuestNameModal({ onDone }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(t("tutorial.name.tooShort"));
      return;
    }
    const result = renameTutorialGuest(trimmed);
    if (!result.success) {
      if (result.error === "name_taken") setError(t("tutorial.name.taken"));
      else if (result.error === "invalid_chars") setError(t("tutorial.name.invalid"));
      else setError(t("common.error"));
      return;
    }
    setError("");
    onDone();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "var(--app-font-sans)",
      }}
    >
      <div
        style={{
          width: "min(400px, 100%)",
          borderRadius: 18,
          padding: "24px 22px 20px",
          background: "linear-gradient(160deg, rgba(74,20,140,0.95) 0%, rgba(18,0,40,0.98) 100%)",
          border: "2px solid rgba(206,147,216,0.55)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 30px rgba(179,136,255,0.25)",
          color: "#fff",
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#FFD740" }}>
          <Tr id="tutorial.name.title" />
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.45, opacity: 0.92 }}>
          <Tr id="tutorial.name.subtitle" />
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={16}
          placeholder={t("tutorial.name.placeholder")}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 12,
            border: "2px solid rgba(206,147,216,0.45)",
            background: "rgba(0,0,0,0.35)",
            color: "#fff",
            fontSize: 16,
            fontWeight: 700,
            outline: "none",
          }}
        />
        {error && (
          <div style={{ marginTop: 8, color: "#FF8A80", fontSize: 12, fontWeight: 700 }}>{error}</div>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #FFD740, #FFA000)",
            color: "#1a0a00",
            fontWeight: 900,
            fontSize: 15,
            cursor: "pointer",
            boxShadow: "0 4px 18px rgba(255,160,0,0.45)",
          }}
        >
          <Tr id="tutorial.name.continue" />
        </button>
      </div>
    </div>
  );
}
