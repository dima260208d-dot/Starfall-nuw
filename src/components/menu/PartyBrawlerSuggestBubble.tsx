import { getBrawlerById } from "../../entities/BrawlerData";
import { getBrawlerDisplayName } from "../../utils/brawlerDisplay";
import { brawlerAvatarUrl } from "../../utils/modeAssets";
import {
  getPartySuggestionRecipientName,
  type PartyBrawlerSuggestion,
} from "../../utils/social/party";

interface Props {
  suggestion: PartyBrawlerSuggestion;
  onClick?: () => void;
  compact?: boolean;
}

export default function PartyBrawlerSuggestBubble({
  suggestion,
  onClick,
  compact,
}: Props) {
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const b = getBrawlerById(suggestion.brawlerId);
  const avatar = brawlerAvatarUrl(suggestion.brawlerId);
  const recipientName = getPartySuggestionRecipientName(suggestion);

  const inner = (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: "#fff",
      color: "#1a1a2e",
      borderRadius: 14,
      padding: compact ? "6px 10px" : "8px 12px",
      boxShadow: "0 4px 16px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.08)",
      fontSize: compact ? 10 : 11,
      fontWeight: 800,
      maxWidth: compact ? 220 : 260,
      cursor: onClick ? "pointer" : "default",
    }}>
      <span style={{
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: compact ? 88 : 110,
      }}>
        {recipientName}
      </span>
      <span style={{ color: "#7B1FA2", fontSize: 14, lineHeight: 1 }} aria-hidden>
        →
      </span>
      <img
        src={avatar}
        alt=""
        style={{
          width: compact ? 36 : 42,
          height: compact ? 36 : 42,
          borderRadius: 8,
          objectFit: "cover",
          border: `2px solid ${b?.color ?? "#CE93D8"}`,
          flexShrink: 0,
        }}
      />
      <span style={{
        fontSize: 9,
        color: "rgba(0,0,0,0.55)",
        maxWidth: compact ? 56 : 72,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {getBrawlerDisplayName(b ?? { id: suggestion.brawlerId, name: suggestion.brawlerId, color: "#CE93D8" } as any)}
      </span>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          border: "none",
          background: "transparent",
          padding: 0,
          fontFamily: "inherit",
        }}
      >
        {inner}
      </button>
    );
  }

  return inner;
}
