import { useEffect, useState } from "react";
import {
  acceptPartyJoinRequest,
  declinePartyJoinRequest,
  getPendingJoinRequestForLeader,
  PARTY_CHANGED_EVENT,
  PARTY_JOIN_REQUEST_EVENT,
} from "../../utils/social/party";
import { Tr } from "../../i18n/Tr";

interface Props {
  onHandled: () => void;
}

export default function PartyJoinRequestModal({ onHandled }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick(x => x + 1);
    window.addEventListener(PARTY_CHANGED_EVENT, bump);
    window.addEventListener(PARTY_JOIN_REQUEST_EVENT, bump);
    return () => {
      window.removeEventListener(PARTY_CHANGED_EVENT, bump);
      window.removeEventListener(PARTY_JOIN_REQUEST_EVENT, bump);
    };
  }, []);

  const req = getPendingJoinRequestForLeader();
  if (!req) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 360,
          width: "100%",
          background: "linear-gradient(160deg, rgba(25,12,55,0.97), rgba(8,4,28,0.98))",
          border: "2px solid rgba(206,147,216,0.55)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, textAlign: "center", marginBottom: 8 }}>
          <Tr id="party.joinRequestTitle" />
        </div>
        <div style={{ fontSize: 13, textAlign: "center", color: "rgba(255,255,255,0.75)", marginBottom: 16 }}>
          <span style={{ color: "#CE93D8", fontWeight: 800 }}>{req.username}</span>
          {" "}<Tr id="party.joinRequestBody" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            className="ui-btn ui-btn--success"
            onClick={() => {
              acceptPartyJoinRequest(req.playerId);
              onHandled();
            }}
          >
            <Tr id="party.joinRequestAccept" />
          </button>
          <button
            type="button"
            className="ui-btn ui-btn--secondary"
            onClick={() => {
              declinePartyJoinRequest(req.playerId);
              onHandled();
            }}
          >
            <Tr id="party.decline" />
          </button>
        </div>
      </div>
    </div>
  );
}
