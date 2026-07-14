import type { CSSProperties } from "react";
import { useI18nOptional } from "../i18n/I18nProvider";

interface Props {
  onClick: () => void;
  style?: CSSProperties;
  /** i18n key for aria-label / title (default: pass.details.infoBtn) */
  labelKey?: string;
}

export default function InfoIconButton({ onClick, style, labelKey = "pass.details.infoBtn" }: Props) {
  const { t } = useI18nOptional();
  const label = t(labelKey);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        minWidth: 34,
        borderRadius: "50%",
        padding: 0,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        fontSize: 17,
        fontStyle: "italic",
        fontFamily: "Georgia, 'Times New Roman', serif",
        color: "#fff",
        background: "linear-gradient(145deg, rgba(255,255,255,0.22), rgba(0,0,0,0.55))",
        border: "1.5px solid rgba(255,255,255,0.45)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
        flexShrink: 0,
        ...style,
      }}
    >
      i
    </button>
  );
}
