import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { MASTERY_XP_ICON } from "../utils/brawlerMasteryUI";

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

export default function MasteryXpFlyBurst({
  count,
  fromEl,
  toEl,
  spawnDurationMs = 1500,
  iconSize = DEFAULT_ICON_SIZE,
  onArrive,
  onComplete,
}: Props) {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/?$/, "/");
  const [particles, setParticles] = useState<Particle[]>([]);
  const arrivedRef = useRef(0);
  const arriveAccRef = useRef(0);
  const doneRef = useRef(false);
  const onArriveRef = useRef(onArrive);
  const onCompleteRef = useRef(onComplete);
  onArriveRef.current = onArrive;
  onCompleteRef.current = onComplete;

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
    const safety = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      setParticles([]);
      onCompleteRef.current?.();
    }, spawnDurationMs + 1600);
    return () => {
      window.clearTimeout(safety);
      setParticles([]);
    };
  }, [count, fromEl, toEl, spawnDurationMs]);

  if (!particles.length || !fromEl || !toEl) return null;
  const from = centerOf(fromEl);
  const to = centerOf(toEl);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 20000 }}>
      {particles.map((p) => (
        <motion.img
          key={p.id}
          src={`${base}${MASTERY_XP_ICON}`}
          alt=""
          className="ui-game-icon"
          initial={{
            x: from.x + p.jitterX - iconSize / 2,
            y: from.y + p.jitterY - iconSize / 2,
            opacity: 0,
            scale: 0.35,
          }}
          animate={{
            x: to.x - iconSize / 2,
            y: to.y - iconSize / 2,
            opacity: [0, 1, 1, 0.85],
            scale: [0.35, 1.15, 1, 0.75],
          }}
          transition={{
            duration: 0.95,
            delay: p.delay,
            ease: [0.22, 0.68, 0.2, 1],
          }}
          onAnimationComplete={() => {
            arrivedRef.current += 1;
            const per = count / particles.length;
            arriveAccRef.current += per;
            while (arriveAccRef.current >= 1) {
              arriveAccRef.current -= 1;
              onArriveRef.current?.(Math.floor(arrivedRef.current));
            }
            if (arrivedRef.current >= particles.length && !doneRef.current) {
              doneRef.current = true;
              setParticles([]);
              onCompleteRef.current?.();
            }
          }}
          style={{
            position: "absolute",
            width: iconSize,
            height: iconSize,
            objectFit: "contain",
            filter: "drop-shadow(0 0 10px rgba(186,104,255,0.85))",
          }}
        />
      ))}
    </div>,
    document.body,
  );
}
