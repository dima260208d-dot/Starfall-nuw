import { useEffect, useState } from "react";
import type { Brawler } from "../entities/Brawler";
import PinIcon from "./PinIcon";

const BATTLE_PIN_SIZE = 82;
const DEFAULT_RADIUS = 24;

type PinOverlay = { key: string; pinId: string; x: number; y: number };

interface Props {
  brawlersRef: React.RefObject<Brawler[]>;
  playTRef: React.RefObject<number>;
  camRef: React.RefObject<{ x: number; y: number }>;
  camW: number;
  camH: number;
  viewportRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
}

export default function BattleReplayPinHud({
  brawlersRef, playTRef, camRef, camW, camH, viewportRef, visible,
}: Props) {
  const [overlays, setOverlays] = useState<PinOverlay[]>([]);

  useEffect(() => {
    if (!visible) {
      setOverlays([]);
      return;
    }

    const overlaysEqual = (a: PinOverlay[], b: PinOverlay[]) =>
      a.length === b.length && a.every((o, i) =>
        o.key === b[i].key && o.pinId === b[i].pinId
        && Math.abs(o.x - b[i].x) < 2 && Math.abs(o.y - b[i].y) < 2,
      );

    let raf = 0;
    let last: PinOverlay[] = [];
    const tick = () => {
      const viewport = viewportRef.current;
      const next: PinOverlay[] = [];

      if (viewport) {
        const rect = viewport.getBoundingClientRect();
        const brawlers = brawlersRef.current ?? [];
        const playT = playTRef.current ?? 0;
        const cam = camRef.current ?? { x: 0, y: 0 };
        for (const b of brawlers) {
          if (!b.alive) continue;
          const rb = b as Brawler & { _replayPinId?: string; _replayPinUntilT?: number };
          if (!rb._replayPinId || rb._replayPinUntilT == null || rb._replayPinUntilT <= playT) continue;

          const pos = worldToScreenPinAnchor(b, cam.x, cam.y, camW, camH, rect);
          if (!pos) continue;
          if (pos.x < rect.left - 140 || pos.x > rect.right + 40 || pos.y < rect.top - 80 || pos.y > rect.bottom + 80) {
            continue;
          }

          next.push({
            key: b.id,
            pinId: rb._replayPinId,
            x: pos.x,
            y: pos.y,
          });
        }
      }

      if (!overlaysEqual(last, next)) {
        last = next;
        setOverlays(next);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [brawlersRef, playTRef, camRef, camW, camH, viewportRef, visible]);

  if (!visible) return null;

  return (
    <>
      {overlays.map(pin => (
        <PinBubble key={pin.key} pinId={pin.pinId} x={pin.x} y={pin.y} />
      ))}
    </>
  );
}

function worldToScreenPinAnchor(
  b: Brawler,
  camX: number,
  camY: number,
  camW: number,
  camH: number,
  rect: DOMRect,
): { x: number; y: number } | null {
  const r = b.radius ?? DEFAULT_RADIUS;
  const bw = r * 2.6;
  const sx = b.x - camX;
  const sy = b.y - camY;
  const labelY = sy - r - 56;
  const x = rect.left + ((sx + bw / 2 + 18) / camW) * rect.width;
  const y = rect.top + ((labelY + 4) / camH) * rect.height;
  return { x, y };
}

function PinBubble({ pinId, x, y }: { pinId: string; x: number; y: number }) {
  return (
    <div
      style={{
        position: "fixed",
        left: x,
        top: y,
        transform: "translate(0, -50%)",
        zIndex: 15,
        pointerEvents: "none",
        animation: "bsReplayPinPop 0.22s cubic-bezier(0.22, 1.55, 0.36, 1) both",
      }}
    >
      <style>{`
        @keyframes bsReplayPinPop {
          0% { opacity: 0; transform: translate(0, -50%) scale(0.45); }
          100% { opacity: 1; transform: translate(0, -50%) scale(1); }
        }
      `}</style>
      <div style={{ position: "relative", display: "inline-block" }}>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px 10px",
            background: "#ffffff",
            border: "3.5px solid #1a1a1a",
            borderRadius: 20,
            boxShadow: "0 4px 0 #1a1a1a, 0 8px 18px rgba(0,0,0,0.35)",
          }}
        >
          <PinIcon pinId={pinId} size={BATTLE_PIN_SIZE} bare animated={false} />
        </div>
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 14,
            bottom: -10,
            width: 18,
            height: 18,
            background: "#ffffff",
            border: "3.5px solid #1a1a1a",
            borderTop: "none",
            borderRight: "none",
            transform: "rotate(-45deg)",
            zIndex: 0,
          }}
        />
      </div>
    </div>
  );
}
