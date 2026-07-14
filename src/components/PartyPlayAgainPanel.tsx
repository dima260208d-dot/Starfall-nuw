import PinIcon from "./PinIcon";
import { useI18n } from "../i18n";
import type { PartyPlayAgainPanelMember } from "../utils/social/partyBattle";
import { EmojiIcon } from "./EmojiIcon";

interface PartyPlayAgainPanelProps {
  members: PartyPlayAgainPanelMember[];
  secondsLeft: number;
  active: boolean;
}

function StatusBadge({ status }: { status: PartyPlayAgainPanelMember["status"] }) {
  const { t } = useI18n();
  if (status === "ready") {
    return (
      <span
        style={{
          position: "absolute",
          right: -4,
          bottom: -4,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#43a047",
          border: "2px solid #1b5e20",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 900,
          color: "#fff",
          boxShadow: "0 0 10px rgba(67,160,71,0.7)",
        }}
        title={t("party.ready")}
      >
        <EmojiIcon emoji="✓" size={20} />
      </span>
    );
  }
  if (status === "declined") {
    return (
      <span
        style={{
          position: "absolute",
          right: -4,
          bottom: -4,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#e53935",
          border: "2px solid #b71c1c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 900,
          color: "#fff",
          boxShadow: "0 0 10px rgba(229,57,53,0.6)",
        }}
        title={t("party.declined")}
      >
        <EmojiIcon emoji="✕" size={20} />
      </span>
    );
  }
  return null;
}

export default function PartyPlayAgainPanel({ members, secondsLeft, active }: PartyPlayAgainPanelProps) {
  const { t } = useI18n();
  if (members.length <= 1) return null;

  return (
    <div
      style={{
        background: "rgba(8,12,24,0.88)",
        border: "1px solid rgba(255,215,64,0.35)",
        borderRadius: 14,
        padding: "12px 14px",
        minWidth: 200,
        boxShadow: "0 8px 28px rgba(0,0,0,0.45), 0 0 18px rgba(255,215,64,0.12)",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1.6,
          color: "rgba(255,215,64,0.85)",
          marginBottom: 10,
          textAlign: "center",
        }}
      >
        {active && secondsLeft > 0
          ? t("party.playAgainSeconds", { seconds: secondsLeft })
          : t("party.playAgain")}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        {members.map(m => (
          <div
            key={m.playerId}
            title={m.username}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              opacity: m.status === "declined" ? 0.55 : 1,
            }}
          >
            <div style={{ position: "relative" }}>
              <PinIcon pinId={m.pinId} size={44} bare glow={m.isMe} />
              <StatusBadge status={m.status} />
            </div>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: m.isMe ? "#ffd740" : "rgba(255,255,255,0.65)",
                maxWidth: 56,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textAlign: "center",
              }}
            >
              {m.isMe ? t("messages.you") : m.username.split(" ")[0]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
