/** Pulsing red dot for unread news items (matches menu notification style). */
export default function NewsUnreadDot({ size = 8 }: { size?: number }) {
  return (
    <span
      className="no-ui-shear"
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: "linear-gradient(135deg, #FF1744, #D50000)",
        border: "1.5px solid #160048",
        boxShadow: "0 0 10px rgba(255,23,68,0.85), 0 0 18px rgba(255,23,68,0.35)",
        animation: "pulse 1.4s ease-in-out infinite",
      }}
    />
  );
}
