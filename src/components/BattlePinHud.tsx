/**
 * Battle pin HUD — Brawl Stars style.
 * Picker: oval white buttons in a grid. Active pin: speech bubble beside the name/HP bar.
 */
import { useEffect, useMemo, useState } from "react";
import { getCurrentProfile, getEquippedPins } from "../utils/localStorageAPI";
import { usePlatformLayout } from "../platform";
import PinIcon from "./PinIcon";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";
import { UI_BUTTON_ICONS } from "../data/uiButtonIcons";
import type { GestureControlLayout } from "../utils/gestureLayout";
import type { GestureEditTarget } from "./TrainingGestureEditor";
import { saveGestureLayout } from "../utils/gestureLayout";
import { setBattlePinTrayOpen, pulseBattlePinUiInteraction } from "../game/battlePinInputGate";

const HUD_TOP = 262;
const HUD_RIGHT = 14;
const BATTLE_PIN_SIZE = 82;
const DEFAULT_RADIUS = 24;
const PIN_DURATION_MS = 3000;

type BattlePinState = { pinId: string; expiresAt: number };
type BattlePinBrawler = {
  id?: string;
  x: number;
  y: number;
  radius?: number;
  alive?: boolean;
  battlePin?: BattlePinState;
};
type BattlePinGame = {
  player?: BattlePinBrawler | null;
  allies?: BattlePinBrawler[];
  enemies?: BattlePinBrawler[];
  bots?: BattlePinBrawler[];
  boss?: BattlePinBrawler | null;
  camera?: { x: number; y: number; width: number; height: number } | null;
};
type PinOverlay = { key: string; pinId: string; x: number; y: number };

interface BattlePinHudProps {
  brawlerId: string;
  gameRef: React.MutableRefObject<BattlePinGame | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  visible: boolean;
  onPinVoice?: (pinId: string) => void;
  gestureLayout?: GestureControlLayout;
  gestureEditMode?: boolean;
  gestureEditTarget?: GestureEditTarget | null;
  onGestureLayoutChange?: (layout: GestureControlLayout) => void;
}

export default function BattlePinHud({
  brawlerId, gameRef, canvasRef, visible, onPinVoice,
  gestureLayout,
  gestureEditMode = false,
  gestureEditTarget = null,
  onGestureLayoutChange,
}: BattlePinHudProps) {
  const { t } = useI18n();
  const { battle } = usePlatformLayout();
  const emojiPos = gestureLayout?.emoji;
  const pinSize = 52 * (emojiPos?.size ?? 1);
  const [trayOpen, setTrayOpen] = useState(false);
  const [pinActiveUntil, setPinActiveUntil] = useState(0);
  const [overlays, setOverlays] = useState<PinOverlay[]>([]);

  const equipped = useMemo(() => {
    const p = getCurrentProfile();
    return getEquippedPins(brawlerId, p).filter(id => !!id);
  }, [brawlerId]);

  useEffect(() => {
    setBattlePinTrayOpen(trayOpen);
    return () => setBattlePinTrayOpen(false);
  }, [trayOpen]);

  useEffect(() => {
    if (!visible) {
      setOverlays([]);
      return;
    }

    let raf = 0;
    const tick = () => {
      const game = gameRef.current;
      const canvas = canvasRef.current;
      const next: PinOverlay[] = [];

      if (game?.camera && canvas) {
        const rect = canvas.getBoundingClientRect();
        const cam = game.camera;
        const camW = cam.width || 1200;
        const camH = cam.height || 800;
        const now = performance.now();

        for (const b of collectVisibleBrawlers(game)) {
          if (b.alive === false || !b.battlePin) continue;
          if (b.battlePin.expiresAt <= now) {
            delete b.battlePin;
            continue;
          }

          const pos = worldToScreenPinAnchor(b, cam.x ?? 0, cam.y ?? 0, camW, camH, rect);
          if (!pos) continue;
          if (pos.x < rect.left - 140 || pos.x > rect.right + 40 || pos.y < rect.top - 80 || pos.y > rect.bottom + 80) {
            continue;
          }

          next.push({
            key: b.id ?? `${b.x}:${b.y}`,
            pinId: b.battlePin.pinId,
            x: pos.x,
            y: pos.y,
          });
        }
      }

      setOverlays(next);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, gameRef, visible]);

  function handlePinPick(pinId: string) {
    const now = performance.now();
    if (now < pinActiveUntil) return;
    pulseBattlePinUiInteraction();

    const expiresAt = now + PIN_DURATION_MS;
    const player = gameRef.current?.player;
    if (player) {
      player.battlePin = { pinId, expiresAt };
    }

    setPinActiveUntil(expiresAt);
    setTrayOpen(false);
    onPinVoice?.(pinId);
  }

  if (!visible) return null;

  const cooldownActive = performance.now() < pinActiveUntil;

  return (
    <div
      data-battle-pin-hud
      style={{ position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none" }}
    >
      {overlays.map(pin => (
        <PinBubble key={pin.key} pinId={pin.pinId} x={pin.x} y={pin.y} />
      ))}

      {trayOpen && (
        <div
          data-ui-interactive
          data-battle-pin-interactive
          onClick={() => setTrayOpen(false)}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 11,
            pointerEvents: "auto",
            background: "rgba(0,0,0,0.15)",
          }}
        />
      )}

      <button
        type="button"
        data-ui-interactive
        data-battle-pin-interactive
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (gestureEditMode && gestureEditTarget === "emoji" && gestureLayout && onGestureLayoutChange) {
            e.preventDefault();
            const host = (e.currentTarget as HTMLElement).closest("[data-battle-pin-hud]") as HTMLElement | null ?? document.body;
            const r = host.getBoundingClientRect();
            const startX = e.clientX;
            const startY = e.clientY;
            const origX = gestureLayout.emoji.x;
            const origY = gestureLayout.emoji.y;
            const onMove = (ev: PointerEvent) => {
              const dx = (ev.clientX - startX) / r.width;
              const dy = (ev.clientY - startY) / r.height;
              const next = {
                ...gestureLayout,
                emoji: {
                  ...gestureLayout.emoji,
                  x: Math.max(0.05, Math.min(0.95, origX + dx)),
                  y: Math.max(0.05, Math.min(0.95, origY + dy)),
                },
              };
              saveGestureLayout(next);
              onGestureLayoutChange(next);
            };
            const onUp = () => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            return;
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          pulseBattlePinUiInteraction();
          if (cooldownActive) return;
          setTrayOpen(o => !o);
        }}
        disabled={cooldownActive}
        title={cooldownActive ? t("battlePin.waitCooldown") : t("battlePin.title")}
        style={{
          position: "absolute",
          left: emojiPos ? `${emojiPos.x * 100}%` : undefined,
          top: emojiPos ? `${emojiPos.y * 100}%` : battle.hudTop,
          right: emojiPos ? undefined : battle.hudRight,
          transform: emojiPos ? "translate(-50%, -50%)" : undefined,
          zIndex: 13,
          pointerEvents: "auto",
          width: pinSize,
          height: pinSize,
          borderRadius: 14,
          background: trayOpen
            ? "linear-gradient(180deg, #fff 0%, #e8e8e8 100%)"
            : cooldownActive
              ? "rgba(120,120,120,0.75)"
              : "linear-gradient(180deg, #fff 0%, #e0e0e0 100%)",
          border: "3px solid #1a1a1a",
          color: "#1a1a1a",
          fontSize: 22,
          cursor: cooldownActive ? "not-allowed" : "pointer",
          opacity: cooldownActive ? 0.65 : 1,
          boxShadow: trayOpen
            ? "0 4px 0 #1a1a1a, 0 8px 20px rgba(0,0,0,0.45)"
            : "0 3px 0 #1a1a1a, 0 6px 14px rgba(0,0,0,0.4)",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          outline: gestureEditMode && gestureEditTarget === "emoji" ? "2px dashed #FFD740" : undefined,
        }}
      >
        <img
          src={`${(import.meta as any).env?.BASE_URL ?? "/"}${UI_BUTTON_ICONS.character.pins}`}
          alt=""
          draggable={false}
          style={{ width: 34, height: 34, objectFit: "contain", pointerEvents: "none" }}
        />
      </button>

      {trayOpen && (
        <div
          data-ui-interactive
          data-battle-pin-interactive
          onClick={e => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: battle.hudTop - 8,
            right: battle.hudRight + 64,
            zIndex: 13,
            pointerEvents: "auto",
            transform: "translateY(-100%)",
            display: "grid",
            gridTemplateColumns: equipped.length <= 4
              ? `repeat(${Math.max(equipped.length, 1)}, 76px)`
              : "repeat(4, 76px)",
            gap: 10,
            padding: 4,
          }}
        >
          {equipped.length === 0 ? (
            <div style={{
              gridColumn: "1 / -1",
              padding: "10px 14px",
              background: "rgba(255,255,255,0.95)",
              border: "3px solid #1a1a1a",
              borderRadius: 16,
              fontSize: 12,
              fontWeight: 800,
              color: "#333",
              boxShadow: "0 3px 0 #1a1a1a",
            }}>
              <Tr id="battlePin.equipHint" />
            </div>
          ) : (
            equipped.map((pinId, i) => (
              <button
                type="button"
                data-ui-interactive
                data-battle-pin-interactive
                key={`${pinId}-${i}`}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  pulseBattlePinUiInteraction();
                  handlePinPick(pinId);
                }}
                title={t("battlePin.send")}
                style={{
                  width: 76,
                  height: 88,
                  borderRadius: "42% / 48%",
                  background: "linear-gradient(180deg, #ffffff 0%, #f2f2f2 100%)",
                  border: "3.5px solid #1a1a1a",
                  boxShadow: "0 4px 0 #1a1a1a",
                  padding: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PinIcon pinId={pinId} size={58} bare animated={false} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Pin anchor: right of the name/HP HUD, same height as the name label. */
function worldToScreenPinAnchor(
  b: BattlePinBrawler,
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

function collectVisibleBrawlers(game: BattlePinGame): BattlePinBrawler[] {
  const out: BattlePinBrawler[] = [];
  const seen = new Set<string>();

  const add = (brawler: BattlePinBrawler | null | undefined) => {
    if (!brawler) return;
    const key = brawler.id ?? `${brawler.x}:${brawler.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(brawler);
  };

  add(game.player);
  if (Array.isArray(game.allies)) for (const ally of game.allies) add(ally);
  if (Array.isArray(game.enemies)) for (const enemy of game.enemies) add(enemy);
  if (Array.isArray(game.bots)) for (const bot of game.bots) add(bot);
  add(game.boss);

  return out;
}

/** Brawl Stars style speech bubble — white, thick black outline, large pin only. */
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
        animation: "bsPinPop 0.22s cubic-bezier(0.22, 1.55, 0.36, 1) both",
      }}
    >
      <style>{`
        @keyframes bsPinPop {
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
        {/* Tail pointing toward the brawler (down-left) */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 14,
            bottom: -11,
            width: 22,
            height: 22,
            background: "#ffffff",
            border: "3.5px solid #1a1a1a",
            borderTop: "none",
            borderRight: "none",
            transform: "rotate(45deg)",
            zIndex: 0,
            boxShadow: "2px 2px 0 #1a1a1a",
          }}
        />
      </div>
    </div>
  );
}
