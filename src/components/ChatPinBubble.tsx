import PinIcon from "./PinIcon";

export function ChatPinBubble({ pinId, size = 64 }: { pinId: string; size?: number }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "6px 10px",
      background: "#ffffff",
      border: "3px solid #1a1a1a",
      borderRadius: 18,
      boxShadow: "0 3px 0 #1a1a1a, 0 6px 14px rgba(0,0,0,0.28)",
    }}>
      <PinIcon pinId={pinId} size={size} bare animated={false} />
    </div>
  );
}