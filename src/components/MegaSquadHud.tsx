import { useEffect, useState } from "react";
import { BRAWLERS } from "../entities/BrawlerData";
import type { ClashMega, SquadHudSnapshot } from "../modes/ClashMega";
import { useI18n } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";
import VolProgressTrack from "./ui/VolProgressTrack";

interface MegaSquadHudProps {
  gameRef: React.MutableRefObject<ClashMega | null>;
}

export default function MegaSquadHud({ gameRef }: MegaSquadHudProps) {
  const { t } = useI18n();
  const [snap, setSnap] = useState<SquadHudSnapshot | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const g = gameRef.current;
      if (g && typeof g.getSquadSnapshot === "function") {
        setSnap(g.getSquadSnapshot());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gameRef]);

  if (!snap) return null;

  const handleSwitch = () => {
    gameRef.current?.requestSwitch();
  };

  const aliveOthers = snap.slots.filter((s, i) => s.alive && i !== snap.activeIdx).length;
  const canSwitch = snap.switchCooldown <= 0 && aliveOthers > 0;

  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        top: 12,
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-end",
        pointerEvents: "none",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <div style={{
        background: "rgba(0,0,0,0.65)",
        border: "1px solid rgba(255,213,79,0.3)",
        borderRadius: 12,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        backdropFilter: "blur(6px)",
      }}>
        <div style={{
          color: "#FFD54F",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1.5,
          textAlign: "center",
        }}>
          <Tr id="megasquad.squadEnemies" params={{ count: snap.enemyMembersRemaining }} />
        </div>
        {snap.slots.map((slot, idx) => {
          const b = BRAWLERS.find(br => br.id === slot.brawlerId);
          const isActive = idx === snap.activeIdx;
          const dead = !slot.alive;
          const hpPct = Math.max(0, Math.min(1, slot.hp / Math.max(1, slot.maxHp)));
          return (
            <div key={idx} style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 6px",
              borderRadius: 8,
              background: isActive
                ? "linear-gradient(90deg, rgba(255,213,79,0.25), rgba(255,213,79,0.05))"
                : "transparent",
              border: isActive ? "1.5px solid #FFD54F" : "1.5px solid transparent",
              opacity: dead ? 0.4 : 1,
              filter: dead ? "grayscale(1)" : "none",
              minWidth: 168,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: dead
                  ? "#222"
                  : `radial-gradient(circle, ${b?.color || "#888"}, ${b?.secondaryColor || "#000"})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 900, fontSize: 16,
                border: `1.5px solid ${dead ? "#444" : (b?.color || "#888")}`,
                flexShrink: 0,
                position: "relative",
              }}>
                {dead ? <EmojiIcon emoji="✖" size={21} /> : (b?.name?.charAt(0) || "?")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: dead ? "#888" : "white",
                  fontSize: 11,
                  fontWeight: 700,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {b?.name || "?"}
                  {isActive && !dead && <span style={{ color: "#FFD54F", marginLeft: 4 }}><EmojiIcon emoji="★" size={20} /></span>}
                </div>
                <VolProgressTrack
                  fitHeight={12}
                  fill={hpPct * 100}
                  fillBackground={
                    dead
                      ? "#444"
                      : `rgb(${Math.floor(255 * (1 - hpPct))}, ${Math.floor(220 * hpPct)}, 30)`
                  }
                  style={{ marginTop: 2 }}
                />
                <div style={{
                  color: dead ? "#666" : "rgba(255,255,255,0.7)",
                  fontSize: 9,
                  fontWeight: 700,
                  marginTop: 1,
                }}>
                  {dead ? t("megasquad.eliminated") : `${Math.round(slot.hp)} / ${slot.maxHp}`}
                </div>
              </div>
            </div>
          );
        })}
        {snap.powerCubes > 0 && (
          <div style={{
            color: "#E040FB",
            fontSize: 10,
            fontWeight: 800,
            textAlign: "center",
            padding: "2px 6px",
            background: "rgba(100,0,150,0.4)",
            borderRadius: 6,
          }}>
            <Tr id="megasquad.powerCubes" params={{ count: snap.powerCubes, bonus: snap.powerCubes * 10 }} />
          </div>
        )}
      </div>

      <button
        onClick={handleSwitch}
        disabled={!canSwitch}
        style={{
          pointerEvents: "auto",
          background: canSwitch
            ? "linear-gradient(135deg, #FF8F00, #FFD54F)"
            : "rgba(80,80,80,0.6)",
          border: `1.5px solid ${canSwitch ? "#FFD54F" : "rgba(255,255,255,0.15)"}`,
          borderRadius: 12,
          padding: "10px 18px",
          color: "white",
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: 1.5,
          cursor: canSwitch ? "pointer" : "not-allowed",
          boxShadow: canSwitch ? "0 4px 16px rgba(255,143,0,0.5)" : "none",
          minWidth: 140,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {snap.switchCooldown > 0 ? (
          <>
            <div style={{
              position: "absolute",
              left: 0, top: 0, bottom: 0,
              width: `${(snap.switchCooldown / 3) * 100}%`,
              background: "rgba(0,0,0,0.45)",
              transition: "width 0.1s linear",
            }} />
            <span style={{ position: "relative" }}>
              <Tr id="megasquad.switchCooldown" params={{ seconds: snap.switchCooldown.toFixed(1) }} />
            </span>
          </>
        ) : aliveOthers === 0 ? (
          <span><Tr id="megasquad.solo" /></span>
        ) : (
          <span><Tr id="megasquad.switch" /></span>
        )}
      </button>
    </div>
  );
}
