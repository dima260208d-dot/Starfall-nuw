import { useMemo, useState } from "react";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

export type LlmGuideProvider = "openrouter" | "openai";

interface Props {
  onClose: () => void;
  /** Какую вкладку открыть сразу. */
  initialProvider?: LlmGuideProvider;
}

const GUIDE_META: Record<LlmGuideProvider, { title: string; site: string; url: string; stepKeys: string[] }> = {
  openrouter: {
    title: "OpenRouter",
    site: "openrouter.ai",
    url: "https://openrouter.ai/keys",
    stepKeys: Array.from({ length: 12 }, (_, i) => `astral.guide.openrouter.step${i + 1}`),
  },
  openai: {
    title: "OpenAI",
    site: "platform.openai.com",
    url: "https://platform.openai.com/api-keys",
    stepKeys: Array.from({ length: 12 }, (_, i) => `astral.guide.openai.step${i + 1}`),
  },
};

export default function AstralLlmSetupGuide({ onClose, initialProvider = "openrouter" }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<LlmGuideProvider>(initialProvider);
  const guide = GUIDE_META[tab];
  const steps = useMemo(() => guide.stepKeys.map(key => t(key)), [guide.stepKeys, t]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(2,0,12,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520, maxHeight: "min(88vh, 720px)",
          background: "linear-gradient(165deg, rgba(28,12,68,0.98), rgba(18,6,48,0.98))",
          border: "1px solid rgba(206,147,216,0.5)",
          borderRadius: 16,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          color: "white",
          boxShadow: "0 24px 60px rgba(0,0,0,0.65)",
        }}
      >
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(206,147,216,0.35)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#FFD740" }}><Tr id="astral.guide.title" /></div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
              <Tr id="astral.guide.subtitle" />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8, color: "white", padding: "6px 12px", cursor: "pointer", fontWeight: 700,
            }}
          >
            <Tr id="common.close" />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "10px 16px 0" }}>
          {(["openrouter", "openai"] as const).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                flex: 1, padding: "8px 10px", borderRadius: 10, cursor: "pointer", fontWeight: 800, fontSize: 12,
                border: tab === id ? "2px solid #FFD740" : "1px solid rgba(255,255,255,0.15)",
                background: tab === id ? "rgba(255,215,64,0.2)" : "rgba(0,0,0,0.25)",
                color: tab === id ? "#FFD740" : "rgba(255,255,255,0.8)",
              }}
            >
              {GUIDE_META[id].title}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 16px" }}>
          <div style={{
            marginBottom: 12, padding: "10px 12px", borderRadius: 10,
            background: "rgba(74,20,140,0.4)", border: "1px solid rgba(206,147,216,0.3)",
            fontSize: 11, lineHeight: 1.45,
          }}>
            {t("astral.guide.subscriptionNote").split("<b>").map((part, i) => {
              if (i === 0) return part;
              const [bold, rest] = part.split("</b>");
              return <span key={i}><b style={{ color: "#FFD740" }}>{bold}</b>{rest}</span>;
            })}
          </div>

          <a
            href={guide.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginBottom: 14, padding: "8px 14px", borderRadius: 10,
              background: "linear-gradient(135deg, #7E57C2, #4527A0)",
              color: "white", fontWeight: 800, fontSize: 12, textDecoration: "none",
            }}
          >
            <Tr id="astral.guide.openSite" params={{ site: guide.site }} />
          </a>

          <ol style={{
            margin: 0, paddingLeft: 20,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {steps.map((step, i) => (
              <li key={i} style={{ fontSize: 12.5, lineHeight: 1.5, color: "rgba(255,255,255,0.92)" }}>
                <span style={{
                  display: "inline-block", minWidth: 22, marginRight: 6,
                  fontWeight: 900, color: "#CE93D8",
                }}>
                  {i + 1}.
                </span>
                {step}
              </li>
            ))}
          </ol>

          <div style={{
            marginTop: 16, padding: "10px 12px", borderRadius: 10,
            background: "rgba(0,0,0,0.35)", fontSize: 11, lineHeight: 1.45, color: "#CE93D8",
          }}>
            {t("astral.guide.inGameHint", { provider: guide.title }).split("<b>").map((part, i) => {
              if (i === 0) return part;
              const [bold, rest] = part.split("</b>");
              return <span key={i}><b style={{ color: "#FFD740" }}>{bold}</b>{rest}</span>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
