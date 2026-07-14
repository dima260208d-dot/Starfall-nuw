import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n";
import { Tr } from "../../i18n/Tr";
import {
  activateLuckyRush,
  getLuckyRushState,
  type LuckyRushState,
} from "../../utils/luckyRush";
import LuckyRushResourceIcon from "./LuckyRushResourceIcon";

const CHARGE_MS = 5000;

interface LuckyRushButtonProps {
  onActivated?: () => void;
}

export default function LuckyRushButton({ onActivated }: LuckyRushButtonProps) {
  const { t } = useI18n();
  const [state, setState] = useState<LuckyRushState>(() => getLuckyRushState());
  const [charging, setCharging] = useState(false);
  const [chargePct, setChargePct] = useState(0);
  const [pressed, setPressed] = useState(false);
  const [burst, setBurst] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const chargeStart = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setState(getLuckyRushState()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!charging) return;
    const tick = () => {
      const elapsed = Date.now() - chargeStart.current;
      const pct = Math.min(1, elapsed / CHARGE_MS);
      setChargePct(pct);
      if (pct >= 1) {
        setCharging(false);
        setBurst(true);
        activateLuckyRush();
        setState(getLuckyRushState());
        onActivated?.();
        setTimeout(() => setBurst(false), 1200);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [charging, onActivated]);

  if (!state.visible || !state.visual) return null;

  const visual = state.visual;
  const size = 132;
  const ringR = size / 2 + 8;
  const circumference = 2 * Math.PI * ringR;
  const dashOffset = circumference * (1 - chargePct);

  const handlePressStart = () => {
    if (!state.canActivate || state.active) return;
    setPressed(true);
    setCharging(true);
    setChargePct(0);
    chargeStart.current = Date.now();
  };

  const handlePressEnd = () => {
    setPressed(false);
    if (chargePct < 1) {
      setCharging(false);
      setChargePct(0);
    }
  };

  return (
    <div
      style={{
        flex: "0 0 auto",
        width: size + 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        scrollSnapAlign: "start",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes luckyBurst {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
        }
        @keyframes luckyBgFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(6deg); }
        }
      `}</style>

      {showInfo && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: size + 48,
            zIndex: 20,
            width: 260,
            padding: 14,
            borderRadius: 14,
            background: "rgba(8,4,24,0.94)",
            border: `1px solid ${visual.color}88`,
            boxShadow: `0 12px 32px rgba(0,0,0,0.55), 0 0 20px ${visual.color}33`,
            fontSize: 12,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.88)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, color: visual.accent }}>
            <Tr id="luckyRush.infoTitle" />
          </div>
          <Tr id="luckyRush.infoBody" />
        </div>
      )}

      <button
        type="button"
        className="ui-shape-round no-ui-shear"
        aria-label={t(visual.labelKey)}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        disabled={!state.canActivate && !state.active}
        style={{
          position: "relative",
          width: size,
          height: size,
          borderRadius: "50%",
          border: `3px solid ${visual.accent}55`,
          cursor: state.canActivate || state.active ? "pointer" : "default",
          background: visual.gradient,
          boxShadow: state.active
            ? `0 0 32px ${visual.color}, inset 0 -8px 16px rgba(0,0,0,0.35)`
            : `0 10px 28px rgba(0,0,0,0.45), inset 0 -6px 12px rgba(0,0,0,0.28)`,
          transform: pressed ? "scale(0.92) translateY(4px)" : "scale(1)",
          transition: "transform 0.12s ease, box-shadow 0.2s ease",
          overflow: "visible",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg
          aria-hidden
          style={{
            position: "absolute",
            inset: -10,
            width: size + 20,
            height: size + 20,
            pointerEvents: "none",
            transform: "rotate(-90deg)",
          }}
        >
          <circle
            cx={(size + 20) / 2}
            cy={(size + 20) / 2}
            r={ringR}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={6}
          />
          {(charging || state.active) && (
            <circle
              cx={(size + 20) / 2}
              cy={(size + 20) / 2}
              r={ringR}
              fill="none"
              stroke={visual.accent}
              strokeWidth={6}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={state.active ? 0 : dashOffset}
              style={{ transition: state.active ? "stroke-dashoffset 0.3s ease" : undefined }}
            />
          )}
        </svg>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "78%",
            height: "78%",
            animation: state.active ? "luckyBgFloat 2.4s ease-in-out infinite" : undefined,
            filter: `drop-shadow(0 4px 12px ${visual.color}aa)`,
          }}
        >
          <LuckyRushResourceIcon type={visual.type} size={Math.round(size * 0.72)} />
        </div>

        {burst &&
          Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const dx = Math.cos(angle) * 80;
            const dy = Math.sin(angle) * 80;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 28,
                  height: 28,
                  marginLeft: -14,
                  marginTop: -14,
                  pointerEvents: "none",
                  animation: "luckyBurst 0.9s ease-out forwards",
                  ["--dx" as string]: `${dx}px`,
                  ["--dy" as string]: `${dy}px`,
                }}
              >
                <LuckyRushResourceIcon type={visual.type} size={28} frozen />
              </div>
            );
          })}
      </button>

      <button
        type="button"
        className="ui-shape-round no-ui-shear"
        onClick={() => setShowInfo((v) => !v)}
        style={{
          position: "absolute",
          top: 4,
          right: 0,
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.35)",
          background: "rgba(0,0,0,0.45)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 900,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        i
      </button>

      <div style={{ textAlign: "center", maxWidth: size + 24 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: visual.accent, letterSpacing: 0.6 }}>
          <Tr id="luckyRush.title" />
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.72)", marginTop: 2 }}>
          <Tr id={visual.labelKey} />
        </div>
        {state.active && state.activeUntil && (
          <div style={{ fontSize: 9, color: visual.color, marginTop: 2, fontWeight: 800 }}>
            <Tr id="luckyRush.active" />
          </div>
        )}
        {state.beforeNoon && (
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
            <Tr id="luckyRush.beforeNoon" />
          </div>
        )}
        {state.alreadyUsedToday && !state.active && (
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
            <Tr id="luckyRush.usedToday" />
          </div>
        )}
      </div>
    </div>
  );
}

export function LuckyRushBackgroundOverlay({ active }: { active: boolean }) {
  const [state, setState] = useState(() => getLuckyRushState());
  useEffect(() => {
    const id = setInterval(() => setState(getLuckyRushState()), 800);
    return () => clearInterval(id);
  }, []);
  if (!active || !state.active || !state.visual) return null;
  const visual = state.visual;
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        backgroundImage: `url(${visual.bgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: 0.42,
      }}
    />
  );
}
