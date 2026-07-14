import { useCallback, useEffect, useRef, useState } from "react";
import { getBrawlerById } from "../entities/BrawlerData";
import { brawlerAvatarUrl } from "../utils/modeAssets";
import { subscribeKillFeed, type KillFeedEvent } from "../utils/killFeed";
import killFeedSkullImg from "../assets/ui/kill-feed-skull.png";
import killFeedPistolImg from "../assets/ui/kill-feed-pistol.png";
import { EmojiIcon } from "./EmojiIcon";

const SLIDE_MS = 520;
const HOLD_MS = 3000;
const FADE_MS = 2000;

const FRIENDLY_BG = "#2B6CB0";
const ENEMY_BG = "#C62828";
const FRIENDLY_BORDER = "#64B5F6";
const ENEMY_BORDER = "#EF5350";

const ICON_SIZE = 58;
/** How much the icon sticks above the blue bar top edge. */
const ICON_LIFT = 34;
const BAR_H = 58;
const SLOT_W = 80;
const PISTOL_W = 34;
const SKULL_W = 50;

type Phase = "idle" | "slide" | "hold" | "fade";

function fitNameFontSize(name: string, maxPx = 13, minPx = 9): number {
  const len = Math.max(1, name.length);
  return Math.max(minPx, Math.min(maxPx, Math.floor(92 / len)));
}

function BrawlerKillSlot({
  brawlerId,
  name,
  borderColor,
  dead,
}: {
  brawlerId: string;
  name: string;
  borderColor: string;
  dead?: boolean;
}) {
  const def = getBrawlerById(brawlerId);
  const avatarBg = def
    ? `linear-gradient(180deg, ${def.color} 0%, rgba(0,0,0,0.55) 100%)`
    : "linear-gradient(180deg, #546E7A 0%, rgba(0,0,0,0.6) 100%)";
  const fontSize = fitNameFontSize(name);
  const nameTop = ICON_SIZE;
  const nameH = ICON_LIFT + BAR_H - nameTop;

  return (
    <div
      style={{
        width: SLOT_W,
        flexShrink: 0,
        height: ICON_LIFT + BAR_H,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: ICON_SIZE,
          height: ICON_SIZE,
          borderRadius: 11,
          overflow: "hidden",
          background: avatarBg,
          border: `2.5px solid ${borderColor}`,
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          zIndex: 2,
        }}
      >
        <img
          src={brawlerAvatarUrl(brawlerId)}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center top",
            display: "block",
            filter: dead ? "grayscale(0.35) brightness(0.88)" : "none",
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        {dead && (
          <div style={{
            position: "absolute", top: 2, right: 2,
            width: 16, height: 16, borderRadius: "50%",
            background: "rgba(0,0,0,0.78)",
            border: "1.5px solid rgba(255,255,255,0.9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, lineHeight: 1,
          }}><EmojiIcon emoji="💀" size={24} /></div>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: nameTop,
          height: Math.max(18, nameH),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 2px",
          boxSizing: "border-box",
          zIndex: 3,
        }}
      >
        <span
          style={{
            fontSize,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: 0.1,
            lineHeight: 1.05,
            textAlign: "center",
            whiteSpace: "nowrap",
            textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,1)",
          }}
        >
          {name}
        </span>
      </div>
    </div>
  );
}

function KillFeedCard({ entry }: { entry: KillFeedEvent }) {
  const bg = entry.isFriendly ? FRIENDLY_BG : ENEMY_BG;
  const border = entry.isFriendly ? FRIENDLY_BORDER : ENEMY_BORDER;
  const cardH = ICON_LIFT + BAR_H;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "flex-end",
        height: cardH,
        width: "max-content",
        maxWidth: "100%",
        filter: "drop-shadow(0 5px 14px rgba(0,0,0,0.55))",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <div style={{
        width: SKULL_W,
        height: BAR_H,
        flexShrink: 0,
        background: bg,
        borderRadius: "10px 0 0 10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `2px solid ${border}`,
        borderRight: "none",
      }}>
        <img
          src={killFeedSkullImg}
          alt=""
          style={{ width: 40, height: 40, objectFit: "contain", display: "block" }}
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
            const parent = el.parentElement;
            if (parent && !parent.querySelector("[data-kill-skull-fallback]")) {
              const span = document.createElement("span");
              span.dataset.killSkullFallback = "1";
              span.textContent = "💀";
              span.style.fontSize = "28px";
              span.style.lineHeight = "1";
              parent.appendChild(span);
            }
          }}
        />
      </div>

      <div style={{
        position: "relative",
        width: "max-content",
        height: cardH,
        flexShrink: 0,
      }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: BAR_H,
            background: bg,
            borderTop: `2px solid ${border}`,
            borderBottom: `2px solid ${border}`,
            clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "flex-end",
            height: "100%",
            paddingRight: 14,
          }}
        >
          <BrawlerKillSlot
            brawlerId={entry.killerBrawlerId}
            name={entry.killerName}
            borderColor={border}
          />

          <div style={{
            width: PISTOL_W,
            height: cardH,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: BAR_H * 0.38,
          }}>
            <img
              src={killFeedPistolImg}
              alt=""
              style={{ width: 30, height: 20, objectFit: "contain", display: "block" }}
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
                const parent = el.parentElement;
                if (parent && !parent.querySelector("[data-kill-pistol-fallback]")) {
                  const span = document.createElement("span");
                  span.dataset.killPistolFallback = "1";
                  span.textContent = "🔫";
                  span.style.fontSize = "18px";
                  span.style.lineHeight = "1";
                  parent.appendChild(span);
                }
              }}
            />
          </div>

          <BrawlerKillSlot
            brawlerId={entry.victimBrawlerId}
            name={entry.victimName}
            borderColor={border}
            dead
          />
        </div>
      </div>
    </div>
  );
}

interface Props {
  top?: number;
}

export default function KillFeedHud({ top = 92 }: Props) {
  const [current, setCurrent] = useState<KillFeedEvent | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const queueRef = useRef<KillFeedEvent[]>([]);
  const busyRef = useRef(false);

  const pumpQueue = useCallback(() => {
    if (busyRef.current) return;
    const next = queueRef.current.shift();
    if (!next) {
      setCurrent(null);
      setPhase("idle");
      return;
    }
    busyRef.current = true;
    setCurrent(next);
    setPhase("slide");
  }, []);

  useEffect(() => {
    return subscribeKillFeed((event) => {
      queueRef.current.push(event);
      if (!busyRef.current) pumpQueue();
    });
  }, [pumpQueue]);

  useEffect(() => {
    if (phase === "slide") {
      const id = window.setTimeout(() => setPhase("hold"), SLIDE_MS);
      return () => window.clearTimeout(id);
    }
    if (phase === "hold") {
      const id = window.setTimeout(() => setPhase("fade"), HOLD_MS);
      return () => window.clearTimeout(id);
    }
    if (phase === "fade") {
      const id = window.setTimeout(() => {
        busyRef.current = false;
        setPhase("idle");
        setCurrent(null);
        pumpQueue();
      }, FADE_MS);
      return () => window.clearTimeout(id);
    }
  }, [phase, pumpQueue]);

  if (!current) return null;

  const fading = phase === "fade";
  const sliding = phase === "slide";

  return (
    <div
      key={current.id}
      style={{
        position: "absolute",
        top,
        left: 14,
        zIndex: 13,
        width: "max-content",
        maxWidth: "calc(100% - 28px)",
        pointerEvents: "none",
        animation: sliding ? "killFeedSlideIn 0.52s cubic-bezier(0.22, 0.85, 0.25, 1) forwards" : undefined,
        opacity: fading ? 0 : 1,
        transition: fading ? `opacity ${FADE_MS}ms ease-out` : undefined,
      }}
    >
      <style>{`
        @keyframes killFeedSlideIn {
          from { transform: translateX(calc(-100% - 24px)); opacity: 0.2; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <KillFeedCard entry={current} />
    </div>
  );
}
