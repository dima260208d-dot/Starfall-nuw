import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import PinIcon from "./PinIcon";
import { getCollectiblePin } from "../entities/PinData";
import { COLLECTIBLE_PIN_RARITY_LABEL } from "../entities/CollectiblePinData";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

interface Props {
  pinId: string;
  goldenFrame?: boolean;
  onDone: () => void;
}

export default function PinRevealModal({ pinId, goldenFrame, onDone }: Props) {
  const { t } = useI18n();
  const [exiting, setExiting] = useState(false);
  const def = getCollectiblePin(pinId);
  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDone, 450);
  }, [onDone]);
  useEffect(() => {
    const t = setTimeout(dismiss, 3200);
    return () => clearTimeout(t);
  }, [dismiss]);
  if (!def) return null;
  const rim = goldenFrame || def.goldenFrame || def.rarity === "golden" ? "#FFD700" : def.color;
  return createPortal(
    <div onClick={dismiss} style={{
      position: "fixed", inset: 0, zIndex: 100000,
      background: "radial-gradient(circle at center, rgba(0,0,30,0.92), rgba(0,0,0,0.98))",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      cursor: "pointer", userSelect: "none",
      animation: exiting ? "pinRevOut 0.45s ease forwards" : "pinRevIn 0.4s ease",
    }}>
      <style>{`@keyframes pinRevIn{from{opacity:0}to{opacity:1}}@keyframes pinRevOut{to{opacity:0;transform:scale(.85)}}@keyframes pinBounce{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}`}</style>
      <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 4, color: rim, marginBottom: 16 }}><Tr id="reveal.newPin" /></div>
      <div style={{ animation: "pinBounce 0.55s cubic-bezier(0.22,1.4,0.36,1) both" }}>
        <PinIcon pinId={pinId} size={140} glow animated />
      </div>
      <div style={{ marginTop: 20, textAlign: "center", color: "white" }}>
        <div style={{ fontSize: 13, color: rim, fontWeight: 800, letterSpacing: 2 }}>
          {COLLECTIBLE_PIN_RARITY_LABEL[def.rarity]}
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 36, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
        <Tr id="chest.tapContinue" />
      </div>
    </div>,
    getAppPortalRoot(),
  );
}
