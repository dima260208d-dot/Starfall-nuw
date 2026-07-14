import { getBrawlerById } from "../../entities/BrawlerData";
import { getBrawlerDisplayName } from "../../utils/brawlerDisplay";
import { brawlerAvatarUrl } from "../../utils/modeAssets";
import {
  getPartySuggestionRecipientName,
  type PartyBrawlerSuggestion,
} from "../../utils/social/party";
import { useI18n } from "../../i18n";
import { Tr } from "../../i18n/Tr";

interface Props {
  suggestion: PartyBrawlerSuggestion;
  onAccept: () => void;
  onDecline: () => void;
}

export default function PartyBrawlerSuggestAcceptModal({
  suggestion,
  onAccept,
  onDecline,
}: Props) {
  const { t } = useI18n();
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const b = getBrawlerById(suggestion.brawlerId);
  const name = getBrawlerDisplayName(b ?? { id: suggestion.brawlerId, name: suggestion.brawlerId } as any);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 56, background: "rgba(0,0,0,0.5)" }} />
      <div style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 57,
        minWidth: 240,
        maxWidth: 320,
        padding: 16,
        background: "linear-gradient(160deg, rgba(20,10,48,0.97), rgba(6,3,22,0.99))",
        border: "1px solid rgba(206,147,216,0.5)",
        borderRadius: 14,
        textAlign: "center",
        color: "#fff",
        boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
      }}>
        <img
          src={brawlerAvatarUrl(suggestion.brawlerId)}
          alt=""
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            objectFit: "cover",
            border: `2px solid ${b?.color ?? "#CE93D8"}`,
            marginBottom: 10,
          }}
        />
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>
          <Tr id="party.suggestChangeTitle" params={{ name: getPartySuggestionRecipientName(suggestion) }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 900, color: b?.color ?? "#CE93D8", marginBottom: 12 }}>
          {name}
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 12 }}>
          <Tr id="party.suggestChangeBody" params={{ name }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="ui-btn ui-btn--primary" style={{ flex: 1, fontSize: 12 }} onClick={onAccept}>
            <Tr id="common.yes" />
          </button>
          <button type="button" className="ui-btn ui-btn--secondary" style={{ flex: 1, fontSize: 12 }} onClick={onDecline}>
            <Tr id="common.no" />
          </button>
        </div>
      </div>
    </>
  );
}
