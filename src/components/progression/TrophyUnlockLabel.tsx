import { Tr } from "../../i18n/Tr";

interface Props {
  required: number;
  /** Overlay under lock icon — no layout shift. */
  overlay?: boolean;
}

export default function TrophyUnlockLabel({ required, overlay }: Props) {
  if (required <= 0) return null;
  if (overlay) {
    return (
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          lineHeight: 1.25,
          textAlign: "center",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          textShadow: "0 1px 4px rgba(0,0,0,0.9)",
        }}
      >
        <span style={{ color: "#CE93D8" }}><Tr id="unlock.requiresLabel" /></span>{" "}
        <span style={{ color: "#FFD740", fontSize: 13 }}>{required}</span>{" "}
        <span style={{ color: "#40C4FF" }}><Tr id="unlock.trophiesWord" /></span>
      </div>
    );
  }
  return (
    <div
      style={{
        marginTop: 12,
        fontSize: 15,
        fontWeight: 900,
        lineHeight: 1.35,
        textAlign: "center",
        color: "rgba(255,255,255,0.88)",
        flexShrink: 0,
      }}
    >
      <Tr id="unlock.requiresLabel" />{" "}
      <span style={{ color: "#FFD740", fontSize: 17 }}>{required}</span>{" "}
      <Tr id="unlock.trophiesWord" />
    </div>
  );
}
