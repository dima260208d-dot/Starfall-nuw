import { useMemo, useState, type CSSProperties } from "react";
import { resolvePublicAssetUrl } from "../lib/assetBase";
import { LEGAL_DOCUMENTS, getLegalDocument } from "../legal/documents";
import type { LegalDocId } from "../legal/legalConsent";
import { saveLegalConsent } from "../legal/legalConsent";

interface Props {
  onAccepted: () => void;
}

export default function LegalConsentScreen({ onAccepted }: Props) {
  const [checked, setChecked] = useState<Record<LegalDocId, boolean>>({
    userAgreement: false,
    privacyPolicy: false,
    personalDataConsent: false,
    ageConfirmation: false,
  });
  const [readerId, setReaderId] = useState<LegalDocId | null>(null);

  const allChecked = useMemo(
    () => LEGAL_DOCUMENTS.every((d) => checked[d.id]),
    [checked],
  );

  const readerDoc = readerId ? getLegalDocument(readerId) : null;

  const toggle = (id: LegalDocId) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const accept = () => {
    if (!allChecked) return;
    saveLegalConsent(LEGAL_DOCUMENTS.map((d) => d.id));
    onAccepted();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "#06031a",
        color: "#e8eef7",
        fontFamily: "var(--app-font-sans, Inter, system-ui, sans-serif)",
        overflow: "hidden",
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
          opacity: 0.35,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(6,3,26,0.92) 0%, rgba(6,3,26,0.97) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "min(520px, 100%)",
            maxHeight: "min(92vh, 720px)",
            display: "flex",
            flexDirection: "column",
            background: "rgba(12,16,28,0.94)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: "22px 20px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          }}
        >
          <img
            src={resolvePublicAssetUrl("starfall-logo.png")}
            alt="Starfall"
            style={{ width: 120, height: "auto", alignSelf: "center", marginBottom: 12 }}
            draggable={false}
          />
          <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900, textAlign: "center" }}>
            Добро пожаловать в Starfall
          </h1>
          <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.5, color: "#a8b8d0", textAlign: "center" }}>
            Перед началом игры ознакомьтесь с документами и подтвердите согласие по каждому пункту.
            Игра работает только через интернет.
          </p>

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginBottom: 16 }}>
            {LEGAL_DOCUMENTS.map((doc) => (
              <div
                key={doc.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked[doc.id]}
                  onChange={() => toggle(doc.id)}
                  style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>
                    {doc.shortLabel}
                  </div>
                  <button
                    type="button"
                    onClick={() => setReaderId(doc.id)}
                    style={{
                      marginTop: 4,
                      padding: 0,
                      border: "none",
                      background: "none",
                      color: "#80d8ff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Прочитать документ
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={!allChecked}
            onClick={accept}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 12,
              border: "none",
              fontSize: 15,
              fontWeight: 900,
              cursor: allChecked ? "pointer" : "not-allowed",
              opacity: allChecked ? 1 : 0.45,
              background: allChecked
                ? "linear-gradient(135deg, #ffb300 0%, #b388ff 100%)"
                : "rgba(255,255,255,0.12)",
              color: allChecked ? "#f8fbff" : "rgba(255,255,255,0.82)",
              textShadow: allChecked ? "0 1px 2px rgba(0,0,0,0.35)" : "none",
              letterSpacing: "0.02em",
            }}
          >
            Принять и продолжить
          </button>
        </div>
      </div>

      {readerDoc && (
        <div
          role="dialog"
          aria-modal
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2100,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setReaderId(null)}
        >
          <div
            style={{
              width: "min(640px, 100%)",
              maxHeight: "85vh",
              background: "#0f1522",
              border: "1px solid #2a3548",
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px 18px", borderBottom: "1px solid #243044" }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{readerDoc.title}</h2>
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "16px 18px",
                fontSize: 13,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                color: "#c8d4e8",
              }}
            >
              {readerDoc.body}
            </div>
            <div style={{ padding: 12, borderTop: "1px solid #243044", display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setChecked((prev) => ({ ...prev, [readerDoc.id]: true }));
                  setReaderId(null);
                }}
                style={secondaryBtn}
              >
                Прочитал(а) — отметить
              </button>
              <button type="button" onClick={() => setReaderId(null)} style={primaryBtn}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const primaryBtn: CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(135deg, #ffb300, #b388ff)",
  color: "#1a1028",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryBtn: CSSProperties = {
  flex: 1,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #3a4a60",
  background: "transparent",
  color: "#e8eef7",
  fontWeight: 700,
  cursor: "pointer",
};
