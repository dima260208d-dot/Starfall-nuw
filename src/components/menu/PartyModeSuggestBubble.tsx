import ModeIconImg from "../ModeIconImg";
import { getModeInfo } from "../../data/modes";
import type { PartyModeSuggestion } from "../../utils/social/party";
import { useI18n } from "../../i18n";
import PartyComicBubbleShell from "./PartyComicBubbleShell";
import PartyBubbleTap from "./PartyBubbleTap";

const BUBBLE_W = { normal: 104, compact: 96 } as const;
const BUBBLE_H = { normal: 118, compact: 108 } as const;

interface Props {
  suggestion: PartyModeSuggestion;
  onClick?: () => void;
  compact?: boolean;
}

/** Mode-suggest bubble: icon → name → ⇄ режим, tail bottom-left. */
export default function PartyModeSuggestBubble({ suggestion, onClick, compact }: Props) {
  const { t } = useI18n();
  const mode = getModeInfo(suggestion.modeId);
  const iconSize = compact ? 30 : 34;
  const w = compact ? BUBBLE_W.compact : BUBBLE_W.normal;
  const h = compact ? BUBBLE_H.compact : BUBBLE_H.normal;

  const inner = (
    <PartyComicBubbleShell width={w} height={h} shape="tall">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: compact ? 3 : 4,
          width: "100%",
          pointerEvents: "none",
        }}
      >
        <ModeIconImg modeId={mode.id} alt={mode.name} size={iconSize} bare />
        <span style={{
          fontSize: compact ? 9 : 10,
          fontWeight: 900,
          lineHeight: 1.15,
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
          color: "#1a1a2e",
        }}>
          {mode.name}
        </span>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          fontSize: compact ? 8 : 9,
          fontWeight: 800,
          color: "#7B1FA2",
          lineHeight: 1,
        }}>
          <span aria-hidden style={{ fontSize: compact ? 11 : 12 }}>⇄</span>
          <span>{t("party.modeSuggestShort")}</span>
        </div>
      </div>
    </PartyComicBubbleShell>
  );

  return <PartyBubbleTap onClick={onClick}>{inner}</PartyBubbleTap>;
}
