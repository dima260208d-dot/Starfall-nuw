import {
  acceptPartyInvite,
  declinePartyInvite,
  getIncomingInvite,
} from "../../utils/social/party";
import { useI18n } from "../../i18n";
import { Tr } from "../../i18n/Tr";

interface Props {
  onAccepted: () => void;
  onDeclined: () => void;
}

export default function PartyInviteModal({ onAccepted, onDeclined }: Props) {
  const { t } = useI18n();
  const inv = getIncomingInvite();
  if (!inv) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 120,
      background: "rgba(0,0,0,0.55)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        maxWidth: 340,
        width: "100%",
        background: "linear-gradient(160deg, rgba(25,12,55,0.97), rgba(8,4,28,0.98))",
        border: "2px solid rgba(206,147,216,0.55)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, textAlign: "center", marginBottom: 8 }}>
          <Tr id="party.inviteTitle" />
        </div>
        <div style={{ fontSize: 13, textAlign: "center", color: "rgba(255,255,255,0.75)", marginBottom: 16 }}>
          <span style={{ color: "#CE93D8", fontWeight: 800 }}>{inv.fromUsername}</span>
          {" "}<Tr id="party.inviteBody" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            className="ui-btn ui-btn--success"
            onClick={() => {
              const r = acceptPartyInvite();
              if (r.success) onAccepted();
              else onDeclined();
            }}
          >
            <Tr id="party.joinTeam" />
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--secondary"
            onClick={() => {
              declinePartyInvite();
              onDeclined();
            }}
          >
            <Tr id="party.decline" />
          </button>
        </div>
      </div>
    </div>
  );
}
