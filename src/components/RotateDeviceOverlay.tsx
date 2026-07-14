import { useEffect, useState } from "react";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

// Force the player to play in landscape on mobile devices. The whole UI is
// designed around a wide 1200×800 stage (canvas, joysticks, lobby panels),
// so portrait orientation chops it in half. We watch the viewport and ask
// the user to rotate their phone whenever it's portrait AND clearly a
// phone-class screen (short side ≤ 900px). We also try to lock the screen
// orientation programmatically when supported.
export default function RotateDeviceOverlay() {
  const { t } = useI18n();
  const [needsRotate, setNeedsRotate] = useState(false);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const shortSide = Math.min(w, h);
      // Only target mobile-class viewports. Desktop windows that happen to
      // be tall stay untouched.
      const isMobileClass = shortSide <= 900;
      const isPortrait = h > w;
      setNeedsRotate(isMobileClass && isPortrait);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    // Best-effort: ask the browser to lock landscape. This only works in
    // fullscreen on most browsers and silently fails otherwise — that's OK,
    // we still have the overlay as a fallback.
    const so = (screen as any).orientation;
    if (so && typeof so.lock === "function") {
      so.lock("landscape").catch(() => { /* ignored — overlay handles it */ });
    }
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  if (!needsRotate) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "radial-gradient(ellipse at center, #160048 0%, #060025 70%, #03001a 100%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        color: "white", textAlign: "center",
        padding: 32,
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <style>{`
        @keyframes rotateHint {
          0%   { transform: rotate(0deg); }
          40%  { transform: rotate(-90deg); }
          70%  { transform: rotate(-90deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes pulseHint {
          0%,100% { opacity: 0.7; }
          50%     { opacity: 1; }
        }
      `}</style>
      <div
        style={{
          width: 110, height: 170,
          borderRadius: 18,
          border: "5px solid #CE93D8",
          background: "linear-gradient(160deg, rgba(206,147,216,0.25), rgba(64,196,255,0.25))",
          boxShadow: "0 0 35px rgba(206,147,216,0.5)",
          marginBottom: 28,
          position: "relative",
          animation: "rotateHint 2.4s ease-in-out infinite",
        }}
      >
        <div style={{
          position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
          width: 32, height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.4)",
        }} />
        <div style={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          width: 16, height: 16, borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.4)",
        }} />
      </div>

      <div style={{
        fontSize: 28, fontWeight: 900, letterSpacing: 2,
        background: "linear-gradient(135deg, #CE93D8 0%, #FFD700 50%, #40C4FF 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        marginBottom: 12,
      }}>
        <Tr id="rotate.title" />
      </div>
      <div style={{
        fontSize: 15, color: "rgba(255,255,255,0.75)",
        maxWidth: 320, lineHeight: 1.5,
        animation: "pulseHint 2s ease-in-out infinite",
      }}>
        <Tr id="rotate.subtitle" />
      </div>
    </div>
  );
}
