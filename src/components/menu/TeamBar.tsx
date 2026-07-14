import { useState } from "react";
import { useI18n } from "../../i18n";
import { getMyPartyCode, leaveParty } from "../../utils/social/party";
import { Tr } from "../../i18n/Tr";
import { EmojiIcon } from "../EmojiIcon";

interface Props {
  onLeave: () => void;
  compact?: boolean;
}

/** Центр верхней панели — кнопка и код в две строки, код всегда целиком. */
export default function TeamBar({ onLeave, compact }: Props) {
  const { t } = useI18n();
  const code = getMyPartyCode();
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: compact ? 2 : 3,
      maxWidth: "100%",
      overflow: "visible",
      flexShrink: 0,
    }}>
      <button
        type="button"
        className="ui-btn ui-btn--danger"
        onClick={() => { leaveParty(); onLeave(); }}
        style={{
          fontSize: compact ? 9 : 10,
          padding: compact ? "3px 10px" : "4px 12px",
          minHeight: 0,
          fontWeight: 900,
          whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}
      >
        <Tr id="party.leaveTeam" />
      </button>
      <button
        type="button"
        onClick={handleCopyCode}
        title={t("party.copyCodeHint")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: compact ? 10 : 12,
          fontWeight: 900,
          fontFamily: "monospace",
          letterSpacing: 2,
          color: "#E1BEE7",
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(206,147,216,0.5)",
          borderRadius: 8,
          padding: compact ? "3px 10px" : "4px 12px",
          whiteSpace: "nowrap",
          cursor: "pointer",
          lineHeight: 1.2,
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.55)", letterSpacing: 0.5, fontSize: compact ? 8 : 10 }}>
          <Tr id="party.codeLabel" />
        </span>
        <span>{code}</span>
        <span style={{
          fontSize: compact ? 8 : 9,
          letterSpacing: 0,
          color: copied ? "#69F0AE" : "rgba(255,255,255,0.45)",
          fontFamily: "inherit",
        }}>
          {copied ? <EmojiIcon emoji="✓" size={21} /> : <EmojiIcon emoji="📋" size={21} />}
        </span>
      </button>
    </div>
  );
}
