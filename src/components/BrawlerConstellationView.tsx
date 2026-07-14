import type { CSSProperties } from "react";
import { BATTLE_STAR_PATH } from "../utils/battleStarPath";
import { GlowingStarStyles } from "./GlowingStar";
import { useI18n } from "../i18n";

interface NodeDef { x: number; y: number }
type Theme = {
  nodes: NodeDef[];
  edges: Array<[number, number]>;
  glyph: string;
  edgeLit?: string;
  edgeDim?: string;
};

const THEMES: Record<string, Theme> = {
  miya: { nodes: [{ x: 50, y: 10 }, { x: 82, y: 32 }, { x: 50, y: 50 }, { x: 18, y: 32 }, { x: 50, y: 82 }, { x: 50, y: 32 }], edges: [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [0, 1], [1, 2], [2, 3], [3, 0]], glyph: "🥷" },
  ronin: { nodes: [{ x: 15, y: 20 }, { x: 50, y: 10 }, { x: 85, y: 20 }, { x: 30, y: 45 }, { x: 70, y: 45 }, { x: 50, y: 80 }], edges: [[0, 1], [1, 2], [0, 3], [2, 4], [3, 5], [4, 5], [3, 4]], glyph: "🛡️" },
  yuki: { nodes: [{ x: 50, y: 10 }, { x: 70, y: 26 }, { x: 70, y: 52 }, { x: 50, y: 68 }, { x: 30, y: 52 }, { x: 30, y: 26 }], edges: [[0, 2], [2, 4], [4, 0], [1, 3], [3, 5], [5, 1]], glyph: "❄️" },
  kenji: { nodes: [{ x: 12, y: 30 }, { x: 30, y: 20 }, { x: 48, y: 34 }, { x: 66, y: 22 }, { x: 84, y: 36 }, { x: 60, y: 70 }], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]], glyph: "⚡" },
  hana: { nodes: [{ x: 50, y: 12 }, { x: 68, y: 26 }, { x: 62, y: 48 }, { x: 50, y: 62 }, { x: 38, y: 48 }, { x: 32, y: 26 }], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4], [2, 5]], glyph: "🌸" },
  goro: { nodes: [{ x: 20, y: 16 }, { x: 78, y: 16 }, { x: 50, y: 34 }, { x: 24, y: 54 }, { x: 76, y: 54 }, { x: 50, y: 82 }], edges: [[0, 2], [1, 2], [2, 3], [2, 4], [3, 5], [4, 5]], glyph: "🪓" },
  sora: { nodes: [{ x: 50, y: 8 }, { x: 74, y: 24 }, { x: 78, y: 52 }, { x: 50, y: 72 }, { x: 22, y: 52 }, { x: 26, y: 24 }], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 3]], glyph: "🔥" },
  rin: { nodes: [{ x: 30, y: 14 }, { x: 62, y: 16 }, { x: 80, y: 34 }, { x: 68, y: 58 }, { x: 38, y: 70 }, { x: 18, y: 44 }], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4]], glyph: "🦂" },
  taro: { nodes: [{ x: 50, y: 10 }, { x: 72, y: 22 }, { x: 72, y: 48 }, { x: 50, y: 60 }, { x: 28, y: 48 }, { x: 28, y: 22 }], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 4], [2, 5]], glyph: "⚙️" },
  zafkiel: { nodes: [{ x: 50, y: 8 }, { x: 72, y: 18 }, { x: 72, y: 46 }, { x: 50, y: 58 }, { x: 28, y: 46 }, { x: 28, y: 18 }], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 3], [1, 4], [2, 5]], glyph: "⏳" },
  verdeletta: {
    // Asymmetric chandelier → dance floor (hell ball motif; not a hexagon like zafkiel/taro)
    nodes: [
      { x: 50, y: 6 },
      { x: 84, y: 24 },
      { x: 74, y: 54 },
      { x: 50, y: 80 },
      { x: 26, y: 54 },
      { x: 16, y: 24 },
    ],
    edges: [[0, 1], [0, 5], [1, 2], [2, 3], [3, 4], [4, 5], [1, 4], [2, 5], [0, 3]],
    glyph: "🎭",
  },
  lumina: {
    // Angel wings + golden spine (unique; not a hexagon like zafkiel/taro)
    nodes: [
      { x: 50, y: 5 },
      { x: 14, y: 30 },
      { x: 86, y: 30 },
      { x: 50, y: 42 },
      { x: 24, y: 72 },
      { x: 76, y: 72 },
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [2, 5], [4, 3], [5, 3], [4, 5], [0, 3]],
    glyph: "🪽",
    edgeLit: "rgba(255,241,118,0.92)",
    edgeDim: "rgba(236,239,241,0.28)",
  },
  oliver: {
    nodes: [
      { x: 50, y: 8 },
      { x: 22, y: 28 },
      { x: 78, y: 28 },
      { x: 50, y: 38 },
      { x: 28, y: 68 },
      { x: 72, y: 68 },
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 3], [1, 4], [2, 5], [4, 3], [5, 3], [4, 5], [0, 3]],
    glyph: "🪲",
    edgeLit: "rgba(255,213,79,0.9)",
    edgeDim: "rgba(191,161,129,0.28)",
  },
  callista: {
    nodes: [
      { x: 50, y: 10 },
      { x: 18, y: 32 },
      { x: 82, y: 32 },
      { x: 34, y: 58 },
      { x: 66, y: 58 },
      { x: 50, y: 82 },
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [1, 2], [3, 4], [0, 3], [0, 4]],
    glyph: "⚗️",
    edgeLit: "rgba(129,199,132,0.95)",
    edgeDim: "rgba(67,160,71,0.28)",
  },
  airin: {
    nodes: [
      { x: 50, y: 8 },
      { x: 22, y: 28 },
      { x: 78, y: 28 },
      { x: 12, y: 56 },
      { x: 88, y: 56 },
      { x: 50, y: 88 },
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [1, 2], [3, 5], [4, 5], [0, 5], [3, 4]],
    glyph: "✈️",
    edgeLit: "rgba(176,190,197,0.95)",
    edgeDim: "rgba(55,71,79,0.32)",
  },
  elian: {
    nodes: [
      { x: 50, y: 10 },
      { x: 18, y: 30 },
      { x: 82, y: 30 },
      { x: 14, y: 58 },
      { x: 86, y: 58 },
      { x: 50, y: 86 },
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [1, 2], [3, 5], [4, 5], [0, 5], [3, 4]],
    glyph: "🌌",
    edgeLit: "rgba(255,213,79,0.9)",
    edgeDim: "rgba(21,101,192,0.35)",
  },
  silven: {
    nodes: [
      { x: 50, y: 8 },
      { x: 28, y: 28 },
      { x: 72, y: 28 },
      { x: 38, y: 50 },
      { x: 62, y: 50 },
      { x: 50, y: 88 },
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [1, 2], [3, 4], [0, 3], [0, 4]],
    glyph: "🌲",
    edgeLit: "rgba(174,213,129,0.95)",
    edgeDim: "rgba(51,105,30,0.32)",
  },
  vittoria: {
    nodes: [
      { x: 50, y: 6 },
      { x: 22, y: 24 },
      { x: 78, y: 24 },
      { x: 14, y: 52 },
      { x: 86, y: 52 },
      { x: 50, y: 90 },
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [0, 5], [1, 2], [3, 4]],
    glyph: "🌙",
    edgeLit: "rgba(229,57,53,0.92)",
    edgeDim: "rgba(106,27,154,0.35)",
  },
  octavia: {
    nodes: [
      { x: 50, y: 8 },
      { x: 18, y: 28 },
      { x: 82, y: 28 },
      { x: 28, y: 58 },
      { x: 72, y: 58 },
      { x: 50, y: 88 },
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [0, 3], [0, 4], [1, 2]],
    glyph: "🦑",
    edgeLit: "rgba(236,64,122,0.95)",
    edgeDim: "rgba(49,27,146,0.38)",
  },
  zephyrin: {
    nodes: [
      { x: 50, y: 10 },
      { x: 14, y: 34 },
      { x: 86, y: 34 },
      { x: 26, y: 62 },
      { x: 74, y: 62 },
      { x: 50, y: 90 },
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [0, 5], [1, 4], [2, 3]],
    glyph: "🌪️",
    edgeLit: "rgba(225,190,231,0.95)",
    edgeDim: "rgba(171,71,188,0.35)",
  },
  mirabel: {
    nodes: [
      { x: 50, y: 8 },
      { x: 18, y: 32 },
      { x: 82, y: 32 },
      { x: 30, y: 58 },
      { x: 70, y: 58 },
      { x: 50, y: 88 },
    ],
    edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [1, 2], [3, 4], [0, 5]],
    glyph: "📖",
    edgeLit: "rgba(255,235,59,0.95)",
    edgeDim: "rgba(229,57,53,0.3)",
  },
};

const STAR_SCALE = 0.95;

function ConstellationBattleStar({
  cx, cy, filled, pickable,
}: {
  cx: number;
  cy: number;
  filled: boolean;
  pickable: boolean;
}) {
  const sc = STAR_SCALE;
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${sc})`}>
      {filled && (
        <>
          <circle cx={0} cy={0} r={9} fill="rgba(255,235,59,0.45)" />
          <path
            d={BATTLE_STAR_PATH}
            fill="#FFEB3B"
            stroke="#FF6F00"
            strokeWidth={0.9}
            style={{ filter: "drop-shadow(0 0 3px rgba(255,171,0,0.85))" }}
          />
          <circle cx={0} cy={0} r={1.35} fill="rgba(255,255,255,0.95)" />
        </>
      )}
      {!filled && pickable && (
        <>
          <circle cx={0} cy={0} r={8} fill="rgba(255,235,59,0.25)" className="constellation-star-pick" />
          <path
            d={BATTLE_STAR_PATH}
            fill="rgba(255,235,59,0.35)"
            stroke="#FFD54F"
            strokeWidth={1}
            className="constellation-star-pick"
          />
        </>
      )}
      {!filled && !pickable && (
        <path
          d={BATTLE_STAR_PATH}
          fill="rgba(0,0,0,0.35)"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={0.7}
        />
      )}
    </g>
  );
}

export default function BrawlerConstellationView({
  brawlerId,
  ownedStars,
  pickableStars,
  onPick,
  style,
}: {
  brawlerId: string;
  ownedStars: number[];
  pickableStars?: number[];
  onPick?: (starIndex: number) => void;
  style?: CSSProperties;
}) {
  const { t } = useI18n();
  const theme = THEMES[brawlerId] || THEMES.hana;
  const owned = new Set(ownedStars);
  const pickable = new Set(pickableStars ?? []);
  const title = t(`constellation.${brawlerId in THEMES ? brawlerId : "hana"}`);

  return (
    <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.28)", padding: 10, ...style }}>
      <GlowingStarStyles />
      <style>{`
        .constellation-star-pick {
          animation: glowStarPulse 1.5s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
      `}</style>
      <div style={{ marginBottom: 6, fontSize: 11, letterSpacing: 1, color: "rgba(255,255,255,0.72)", fontWeight: 800 }}>
        {title}
      </div>
      <svg viewBox="0 0 100 90" style={{ width: "100%", height: 180 }}>
        {theme.edges.map(([a, b], i) => {
          const lit = owned.has(a + 1) && owned.has(b + 1);
          return (
            <line
              key={i}
              x1={theme.nodes[a].x}
              y1={theme.nodes[a].y}
              x2={theme.nodes[b].x}
              y2={theme.nodes[b].y}
              stroke={lit ? (theme.edgeLit ?? "rgba(255,213,79,0.75)") : (theme.edgeDim ?? "rgba(255,255,255,0.22)")}
              strokeWidth={lit ? 1.8 : 1.1}
            />
          );
        })}
        {theme.nodes.map((n, i) => {
          const idx = i + 1;
          return (
            <g
              key={idx}
              onClick={() => onPick?.(idx)}
              style={{ cursor: onPick ? "pointer" : "default" }}
            >
              <ConstellationBattleStar
                cx={n.x}
                cy={n.y}
                filled={owned.has(idx)}
                pickable={pickable.has(idx)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
