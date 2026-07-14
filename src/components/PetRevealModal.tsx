/**
 * PetRevealModal — full-screen "new pet!" celebration, mirroring the
 * BrawlerRevealModal pattern but rendered with the hand-drawn SVG pet.
 * The pet pops up from below, bounces, spins, then slides down on dismiss.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import PetSvg from "./PetSvg";
import { getPetById, PET_RARITY_LABEL } from "../entities/PetData";
import { petName, petRarityLabel, petEffectLabel } from "../i18n";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

interface Props {
  petId: string;
  onDone: () => void;
  index?: number;
  total?: number;
}

const STYLES = `
  @keyframes petPopIn {
    0%   { transform: translateY(80vh) scale(0.4) rotate(-30deg); opacity: 0; }
    60%  { transform: translateY(-20px) scale(1.15) rotate(8deg); opacity: 1; }
    80%  { transform: translateY(8px) scale(0.96) rotate(-4deg); }
    100% { transform: translateY(0) scale(1) rotate(0); }
  }
  @keyframes petSlideOut {
    0%   { transform: translateY(0) scale(1); opacity: 1; }
    100% { transform: translateY(60vh) scale(0.4) rotate(20deg); opacity: 0; }
  }
  @keyframes petSpinIdle {
    0%,100% { transform: translateY(0) rotate(-3deg); }
    50%     { transform: translateY(-8px) rotate(3deg); }
  }
  @keyframes ringSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes namePop {
    0%   { opacity: 0; transform: translateY(20px) scale(0.85); }
    60%  { transform: translateY(-4px) scale(1.05); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes headlineIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-32px) scale(0.6); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }
  @keyframes flashBurst {
    0%   { opacity: 1; transform: scale(0.3); }
    40%  { opacity: 0.9; transform: scale(1.4); }
    100% { opacity: 0; transform: scale(2.5); }
  }
  @keyframes tapHint {
    0%,70%,100% { opacity: 0.3; }
    35%         { opacity: 0.7; }
  }
  @keyframes confettiFall {
    0%   { transform: translate(var(--ox), -20vh) rotate(0deg); opacity: 1; }
    100% { transform: translate(var(--ox), 60vh)  rotate(720deg); opacity: 0; }
  }
`;

type Phase = "in" | "idle" | "out";

export default function PetRevealModal({ petId, onDone, index = 0, total = 1 }: Props) {
  const { t } = useI18n();
  const pet = getPetById(petId);
  const [phase, setPhase] = useState<Phase>("in");
  const [showFlash, setShowFlash] = useState(false);
  const phaseRef = useRef<Phase>("in");
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // After pop-in animation, transition to idle and trigger flash
  useEffect(() => {
    if (phase !== "in") return;
    const t = setTimeout(() => {
      phaseRef.current = "idle";
      setPhase("idle");
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 600);
    }, 900);
    return () => clearTimeout(t);
  }, [phase]);

  // Auto-dismiss after a few seconds in idle
  useEffect(() => {
    if (phase !== "idle") return;
    const t = setTimeout(() => startOut(), 4200);
    return () => clearTimeout(t);
  }, [phase]);

  const startOut = useCallback(() => {
    if (phaseRef.current === "out") return;
    phaseRef.current = "out";
    setPhase("out");
    setTimeout(() => onDoneRef.current(), 700);
  }, []);

  const handleTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (phaseRef.current === "in") {
      phaseRef.current = "idle";
      setPhase("idle");
    } else if (phaseRef.current === "idle") {
      startOut();
    }
  }, [startOut]);

  if (!pet) return null;

  const rarityLabel = petRarityLabel(pet.rarity, PET_RARITY_LABEL[pet.rarity]);
  const isIdle = phase === "idle";
  const isOut  = phase === "out";

  // Simple confetti pieces in the rarity colors
  const confettiCount = 24;
  const confetti = Array.from({ length: confettiCount }, (_, i) => ({
    id: i,
    ox: `${(Math.random() - 0.5) * 100}vw`,
    color: i % 2 === 0 ? pet.color : pet.secondaryColor,
    size: 6 + Math.random() * 8,
    delay: Math.random() * 0.6,
    dur:   1.6 + Math.random() * 1.5,
  }));

  const modal = (
    <div
      onClick={handleTap}
      style={{
        position: "fixed", inset: 0, zIndex: 999999,
        background: `radial-gradient(ellipse at 50% 52%, ${pet.color}28 0%, rgba(0,0,10,0.97) 68%)`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden", cursor: "pointer", userSelect: "none",
      }}
    >
      <style>{STYLES}</style>

      {/* counter when multiple */}
      {total > 1 && (
        <div style={{
          position: "absolute", top: 16, left: "50%",
          transform: "translateX(-50%)",
          fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.55)",
          letterSpacing: 3, zIndex: 8,
        }}>
          {index + 1} / {total}
        </div>
      )}

      <div style={{
        position: "absolute",
        top: total > 1 ? 46 : 26,
        left: "50%",
        fontSize: 28, fontWeight: 900, letterSpacing: 6,
        color: "#FFD700",
        textShadow: "0 0 28px #FFD700, 0 0 56px #FFD70088, 0 4px 0 #7B5800",
        textTransform: "uppercase", zIndex: 8, whiteSpace: "nowrap",
        animation: "headlineIn 0.7s cubic-bezier(0.22,1,0.36,1) 0.15s both",
      }}>
        <Tr id="reveal.newPet" />
      </div>

      {/* Spinning rays */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: `conic-gradient(from 0deg at 50% 54%,
          transparent 0deg, ${pet.color}10 8deg, transparent 18deg,
          transparent 48deg, ${pet.color}08 56deg, transparent 66deg)`,
        animation: isIdle ? "ringSpin 12s linear infinite" : undefined,
      }} />

      {/* Halo aura */}
      {isIdle && (
        <div style={{
          position: "absolute",
          width: 460, height: 460, borderRadius: "50%",
          background: `radial-gradient(circle, ${pet.color}44 0%, ${pet.color}0a 55%, transparent 70%)`,
          zIndex: 2, pointerEvents: "none",
        }} />
      )}

      {/* Burst flash */}
      {showFlash && (
        <div style={{
          position: "absolute",
          width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, ${pet.color}cc 0%, ${pet.color}44 40%, transparent 70%)`,
          animation: "flashBurst 0.6s ease-out forwards",
          zIndex: 6, pointerEvents: "none",
        }} />
      )}

      {/* Confetti when reveal lands */}
      {isIdle && confetti.map(c => (
        <div key={c.id} style={{
          position: "absolute", left: "50%", top: "20%",
          width: c.size, height: c.size,
          background: c.color, borderRadius: 2,
          "--ox": c.ox,
          animation: `confettiFall ${c.dur}s ease-in ${c.delay}s forwards`,
          zIndex: 5, pointerEvents: "none",
        } as React.CSSProperties} />
      ))}

      {/* Pet itself */}
      <div style={{
        position: "relative", zIndex: 4,
        transformOrigin: "50% 50%",
        animation:
          phase === "in"  ? "petPopIn 0.9s cubic-bezier(0.22,1.2,0.36,1) forwards" :
          phase === "out" ? "petSlideOut 0.7s ease-in forwards" :
                            "petSpinIdle 2.4s ease-in-out infinite",
      }}>
        <PetSvg pet={pet} size={Math.min(360, Math.floor(window.innerWidth * 0.55))} animated haloPulse={false} />
      </div>

      {/* Name + rarity badge */}
      <div style={{
        position: "absolute", bottom: 96,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        zIndex: 6, pointerEvents: "none",
        opacity: isIdle || isOut ? 1 : 0,
        transition: "opacity 0.4s",
        animation: isIdle ? "namePop 0.55s cubic-bezier(0.22,1,0.36,1)" : undefined,
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${pet.color}, ${pet.secondaryColor})`,
          borderRadius: 8, padding: "4px 18px",
          fontSize: 11, fontWeight: 900, letterSpacing: 3,
          color: "white", textTransform: "uppercase",
          boxShadow: `0 0 24px ${pet.color}99`,
        }}>
          {rarityLabel}
        </div>
        <div style={{
          fontSize: 38, fontWeight: 900, lineHeight: 1, letterSpacing: 3,
          color: "white", textAlign: "center",
          textShadow: `0 0 36px ${pet.color}, 0 0 72px ${pet.color}55, 0 5px 0 rgba(0,0,0,0.9)`,
        }}>
          {petName(pet.id, pet.name).toUpperCase()}
        </div>
        <div style={{
          fontSize: 12, color: "rgba(255,255,255,0.6)",
          letterSpacing: 2, textTransform: "uppercase",
          maxWidth: 460, textAlign: "center", padding: "0 16px",
        }}>
          {petEffectLabel(pet.id, pet.effectLabel)}
        </div>
      </div>

      {isIdle && (
        <div style={{
          position: "absolute", bottom: 40,
          fontSize: 11, color: "rgba(255,255,255,0.3)",
          letterSpacing: 2, textTransform: "uppercase",
          animation: "tapHint 2.5s ease-in-out infinite",
          zIndex: 7, pointerEvents: "none",
        }}>
          <Tr id="chest.tapContinue" />
        </div>
      )}
    </div>
  );

  return createPortal(modal, getAppPortalRoot());
}
