import PinIcon from "../PinIcon";
import { TextWithEmojis } from "../EmojiIcon";
import type { PartyChatMessage } from "../../utils/social/party";
import PartyComicBubbleShell from "./PartyComicBubbleShell";
import PartyBubbleTap from "./PartyBubbleTap";

const SPEECH_MAX_CHARS = 15;

const BUBBLE_W = { normal: 112, compact: 100 } as const;
const BUBBLE_H = { normal: 88, compact: 80 } as const;

function truncateSpeech(text: string): string {
  const t = text.trim();
  if (t.length <= SPEECH_MAX_CHARS) return t;
  return `${t.slice(0, SPEECH_MAX_CHARS)}…`;
}

interface Props {
  message: PartyChatMessage;
  compact?: boolean;
  onClick?: () => void;
}

/** Fixed-size comic speech bubble — tail bottom-left, text never resizes bubble. */
export default function PartySpeechBubble({ message, compact, onClick }: Props) {
  const w = compact ? BUBBLE_W.compact : BUBBLE_W.normal;
  const h = compact ? BUBBLE_H.compact : BUBBLE_H.normal;

  const inner = (
    <PartyComicBubbleShell width={w} height={h} shape="wide">
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          color: "#1a1a2e",
          fontSize: compact ? 10 : 11,
          fontWeight: 800,
          lineHeight: 1.1,
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          pointerEvents: "none",
        }}
      >
        {message.pinId ? (
          <PinIcon pinId={message.pinId} size={compact ? 28 : 32} bare animated={false} />
        ) : message.modeId && message.modeSuggest ? null : (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
            <TextWithEmojis text={truncateSpeech(message.text ?? "")} emojiSize={compact ? 14 : 16} />
          </span>
        )}
      </div>
    </PartyComicBubbleShell>
  );

  return <PartyBubbleTap onClick={onClick}>{inner}</PartyBubbleTap>;
}

export { SPEECH_MAX_CHARS, truncateSpeech };
