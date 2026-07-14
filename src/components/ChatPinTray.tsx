import { useMemo } from "react";
import { getCurrentProfile, getEquippedPins } from "../utils/localStorageAPI";
import PinIcon from "./PinIcon";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

interface Props {
  brawlerId: string;
  onPick: (pinId: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

/** Быстрая панель экипированных пинов для чата (команда / клуб). */
export default function ChatPinTray({ brawlerId, onPick, disabled, compact }: Props) {
  const { t } = useI18n();
  const equipped = useMemo(() => {
    const p = getCurrentProfile();
    return getEquippedPins(brawlerId, p).filter(Boolean);
  }, [brawlerId]);

  if (equipped.length === 0) {
    return (
      <div style={{
        padding: compact ? "8px 10px" : "10px 12px",
        fontSize: compact ? 11 : 12,
        fontWeight: 700,
        color: "rgba(255,255,255,0.55)",
        textAlign: "center",
        background: "rgba(0,0,0,0.25)",
        borderRadius: 10,
        border: "1px dashed rgba(255,255,255,0.18)",
      }}>
        <Tr id="chatPin.equipHint" />
      </div>
    );
  }

  const btnSize = compact ? 52 : 60;
  const iconSize = compact ? 40 : 46;

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: compact ? 6 : 8,
      padding: compact ? "6px 0" : "8px 0",
    }}>
      {equipped.map((pinId, i) => (
        <button
          key={`${pinId}-${i}`}
          type="button"
          disabled={disabled}
          title={t("chatPin.send")}
          onClick={() => onPick(pinId)}
          style={{
            width: btnSize,
            height: btnSize + 8,
            borderRadius: "42% / 48%",
            background: "linear-gradient(180deg, #ffffff 0%, #f0f0f0 100%)",
            border: "2.5px solid #1a1a1a",
            boxShadow: "0 3px 0 #1a1a1a",
            padding: 4,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.55 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PinIcon pinId={pinId} size={iconSize} bare animated={false} />
        </button>
      ))}
    </div>
  );
}