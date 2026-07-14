import ModeIconImg from "../ModeIconImg";
import { getModeInfo } from "../../data/modes";
import type { PartyModeSuggestion } from "../../utils/social/party";
import { Tr } from "../../i18n/Tr";

interface Props {
  suggestion: PartyModeSuggestion;
  onAccept: () => void;
  onDecline: () => void;
}

export default function PartyModeSuggestAcceptModal({
  suggestion,
  onAccept,
  onDecline,
}: Props) {
  const mode = getModeInfo(suggestion.modeId);

  return (
    <>
      <div
        onClick={onDecline}
        style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(2,0,18,0.55)" }}
      />
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 61,
          width: "min(360px, 92vw)",
          padding: 20,
          borderRadius: 16,
          background: "linear-gradient(165deg, rgba(22,12,52,0.98), rgba(8,4,24,0.99))",
          border: "1px solid rgba(206,147,216,0.45)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
          fontFamily: "var(--app-font-sans)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: "#CE93D8", marginBottom: 12, textAlign: "center" }}>
          <Tr id="party.modeSuggestLeaderTitle" params={{ name: suggestion.fromUsername }} />
        </div>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          marginBottom: 18,
        }}>
          <ModeIconImg modeId={mode.id} alt={mode.name} size={72} />
          <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{mode.name}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{mode.subtitle}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" className="ui-btn ui-btn--primary" style={{ width: "100%", fontWeight: 800 }} onClick={onAccept}>
            <Tr id="party.modeSuggestAccept" />
          </button>
          <button type="button" className="ui-btn ui-btn--ghost" style={{ width: "100%", fontWeight: 800 }} onClick={onDecline}>
            <Tr id="party.modeSuggestDecline" />
          </button>
        </div>
      </div>
    </>
  );
}
