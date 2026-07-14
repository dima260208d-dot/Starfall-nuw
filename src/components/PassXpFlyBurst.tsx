import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import GlowingStar from "./GlowingStar";

interface Props {
  count: number;
  fromEl: HTMLElement | null;
  toEl: HTMLElement | null;
  spawnDurationMs?: number;
  iconSize?: number;
  onArrive?: (index: number) => void;
  onComplete?: () => void;
}

interface Particle {
  id: number;
  delay: number;
  jitterX: number;
  jitterY: number;
}

function centerOf(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const DEFAULT_ICON_SIZE = 66;

/** Звёзды опыта Star Pass — аналог TrophyFlyBurst. */
export default function PassXpFlyBurst({
  count,
  fromEl,
  toEl,
  spawnDurationMs = 1500,
  iconSize = DEFAULT_ICON_SIZE,
  onArrive,
  onComplete,
}: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const arrivedRef = useRef(0);
  const arriveAccRef = useRef(0);
  const doneRef = useRef(false);
  const onArriveRef = useRef(onArrive);
  const onCompleteRef = useRef(onComplete);
  onArriveRef.current = onArrive;
  onCompleteRef.current = onComplete;

  const boxSize = Math.round(iconSize * 1.28);

  useEffect(() => {
    arrivedRef.current = 0;
    arriveAccRef.current = 0;
    doneRef.current = false;
    if (count <= 0) {
      onCompleteRef.current?.();
      return;
    }
    if (!fromEl || !toEl) return;
    const visual = Math.min(count, 18);
    setParticles(
      Array.from({ length: visual }, (_, i) => ({
        id: i,
        delay: (i / Math.max(1, visual - 1)) * (spawnDurationMs / 1000) * 0.9,
        jitterX: (Math.random() - 0.5) * 36,
        jitterY: (Math.random() - 0.5) * 24,
      })),
    );
    const maxDelayMs = spawnDurationMs + 1600;
    const safety = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      setParticles([]);
      onCompleteRef.current?.();
    }, maxDelayMs);
    return () => {
      window.clearTimeout(safety);
      setParticles([]);
    };
  }, [count, fromEl, toEl, spawnDurationMs]);

  if (!count || !fromEl || !toEl || particles.length === 0) return null;

  const from = centerOf(fromEl);
  const to = centerOf(toEl);
  const perArrive = count / particles.length;
  const half = boxSize / 2;

  const handleArrive = () => {
    if (doneRef.current) return;
    arriveAccRef.current += perArrive;
    const prev = arrivedRef.current;
    const next = Math.min(count, Math.floor(arriveAccRef.current));
    for (let i = prev; i < next; i++) onArriveRef.current?.(i);
    arrivedRef.current = next;
    if (arrivedRef.current >= count) {
      doneRef.current = true;
      setParticles([]);
      onCompleteRef.current?.();
    }
  };

  return createPortal(
    <motion.div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 20000 }}>
      {particles.map((p) => {
        const startX = from.x + p.jitterX - half;
        const startY = from.y + p.jitterY - half;
        const endX = to.x - half;
        const endY = to.y - half;
        const midX = startX + (endX - startX) * 0.35;
        const midY = Math.min(startY, endY) - 48 - p.id * 2;
        return (
          <motion.div
            key={p.id}
            initial={{ x: startX, y: startY, scale: 0.35, opacity: 0 }}
            animate={{
              x: [startX, midX, endX],
              y: [startY, midY, endY],
              scale: [0.45, 1.1, 0.92, 0],
              opacity: [0, 1, 0.85, 0],
            }}
            transition={{
              delay: p.delay,
              duration: 1.25,
              times: [0, 0.45, 0.82, 1],
              ease: [0.25, 0.1, 0.25, 1],
            }}
            onAnimationComplete={handleArrive}
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              width: boxSize,
              height: boxSize,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              filter: "drop-shadow(0 6px 18px rgba(206,147,216,0.95))",
            }}
          >
            <GlowingStar filled size={iconSize} />
          </motion.div>
        );
      })}
    </motion.div>,
    document.body,
  );
}
