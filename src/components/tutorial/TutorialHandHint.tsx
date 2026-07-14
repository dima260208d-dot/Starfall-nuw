import { useEffect, useState } from "react";
import { getUiAssetBaseUrl } from "../../lib/assetBase";

export type TutorialStickTarget = "move" | "attack" | "super";

interface Props {
  stick: TutorialStickTarget;
  visible: boolean;
}

const HAND_SRC = `${getUiAssetBaseUrl()}ui/tutorial-hand-pointer.png`;

interface HandPose {
  /** Hand anchor — beside the stick, not on top of it */
  x: number;
  y: number;
  /** Stick center — bounce nudges toward this point */
  targetX: number;
  targetY: number;
  rotate: number;
}

function readHandPose(stick: TutorialStickTarget): HandPose | null {
  const el = document.querySelector(`[data-tutorial-stick="${stick}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const w = r.width;
  const h = r.height;

  switch (stick) {
    case "move":
      return {
        x: cx - w * 1.15,
        y: cy - h * 0.05,
        targetX: cx,
        targetY: cy,
        rotate: 38,
      };
    case "attack":
      return {
        x: cx + w * 1.12,
        y: cy - h * 0.08,
        targetX: cx,
        targetY: cy,
        rotate: -158,
      };
    case "super":
      return {
        x: cx + w * 1.05,
        y: cy - h * 1.15,
        targetX: cx,
        targetY: cy,
        rotate: -128,
      };
    default:
      return null;
  }
}

/** Hand beside the joystick, animated tap toward the button. */
export default function TutorialHandHint({ stick, visible }: Props) {
  const [phase, setPhase] = useState(0);
  const [pose, setPose] = useState<HandPose | null>(null);

  useEffect(() => {
    if (!visible) return;
    const update = () => setPose(readHandPose(stick));
    update();
    const id = window.setInterval(update, 150);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [stick, visible]);

  useEffect(() => {
    if (!visible) return;
    const id = window.setInterval(() => setPhase((p) => (p + 1) % 60), 50);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible || !pose) return null;

  const t = phase / 60;
  const pulse = (Math.sin(t * Math.PI * 2) + 1) / 2;
  const nudge = pulse * 0.22;
  const x = pose.x + (pose.targetX - pose.x) * nudge;
  const y = pose.y + (pose.targetY - pose.y) * nudge;
  const scale = 1 + pulse * 0.05;

  return (
    <img
      src={HAND_SRC}
      alt=""
      draggable={false}
      className="ui-game-icon"
      style={{
        position: "fixed",
        left: x,
        top: y,
        width: 80,
        height: "auto",
        transform: `rotate(${pose.rotate}deg) scale(${scale})`,
        transformOrigin: "70% 85%",
        zIndex: 30,
        pointerEvents: "none",
        filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.65))",
      }}
    />
  );
}
