/** Big top-center countdown during final 10 seconds. */
export default function GasCountdown10Overlay({ seconds }: { seconds: number | null }) {
  if (seconds == null || seconds <= 0 || seconds > 10) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "38%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 8700,
        pointerEvents: "none",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "clamp(56px, 14vw, 120px)",
          fontWeight: 900,
          lineHeight: 1,
          color: "#fff",
          textShadow: "0 0 32px rgba(255,80,40,0.95), 0 4px 0 #000, 0 0 8px #000",
          animation: "gasCountdownPulse 0.85s ease-in-out infinite alternate",
        }}
      >
        {seconds}
      </div>
      <style>{`
        @keyframes gasCountdownPulse {
          from { transform: scale(1); opacity: 0.92; }
          to { transform: scale(1.06); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
