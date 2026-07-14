import type { CSSProperties } from "react";
import { useI18n } from "../../i18n";
import { Tr } from "../../i18n/Tr";

interface Props {
  username: string;
  canKick: boolean;
  anchor: DOMRect;
  side: "left" | "right";
  onClose: () => void;
  onSuggest: () => void;
  onProfile: () => void;
  onKick: () => void;
}

export default function TeammateActionMenu({
  username,
  canKick,
  anchor,
  side,
  onClose,
  onSuggest,
  onProfile,
  onKick,
}: Props) {
  const { t } = useI18n();
  const panelStyle = menuPosition(anchor, side);

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 59, background: "transparent" }}
        onClick={onClose}
      />
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={{
          fontSize: 10,
          fontWeight: 900,
          color: "#CE93D8",
          marginBottom: 6,
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 150,
        }}>
          {username}
        </div>
        <button type="button" className="ui-btn ui-btn--primary" style={btn} onClick={onSuggest}>
          <Tr id="party.suggestBrawler" />
        </button>
        <button type="button" className="ui-btn ui-btn--secondary" style={btn} onClick={onProfile}>
          <Tr id="party.profile" />
        </button>
        {canKick && (
          <button type="button" className="ui-btn ui-btn--secondary" style={{ ...btn, color: "#FF8A80" }} onClick={onKick}>
            <Tr id="party.kick" />
          </button>
        )}
      </div>
    </>
  );
}

function menuPosition(anchor: DOMRect, side: "left" | "right"): CSSProperties {
  const w = 168;
  const panelH = 130;
  const gap = 8;
  const top = Math.max(8, Math.min(anchor.top + anchor.height * 0.2, window.innerHeight - panelH));

  let left: number;
  if (side === "left") {
    // слева от персонажа (наружу)
    left = anchor.left - w - gap;
  } else {
    // правый слот — меню слева от него, к центру (не за край экрана)
    left = anchor.left - w - gap;
  }

  left = Math.max(gap, Math.min(left, window.innerWidth - w - gap));

  return {
    position: "fixed",
    top,
    left,
    zIndex: 60,
    width: w,
    padding: 8,
    display: "flex",
    flexDirection: "column",
    gap: 5,
    background: "linear-gradient(160deg, rgba(20,10,48,0.96), rgba(6,3,22,0.98))",
    border: "1px solid rgba(206,147,216,0.5)",
    borderRadius: 10,
    boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
  };
}

const btn: CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  padding: "6px 8px",
  minHeight: 0,
};
