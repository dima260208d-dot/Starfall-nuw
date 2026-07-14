import { useEffect, useRef } from "react";
import type { GameMode, ShowdownFormat } from "../App";
import { getActiveMap, editorModeForGameMode } from "../utils/mapSchedule";
import { drawStarStrikePreview } from "../utils/starStrikeMapPreview";
import { usePlatformLayout } from "../platform";
import { useI18n } from "../i18n";
import { getDevBattleMonsters } from "../utils/devBattleMonsters";

interface Brawler { x: number; y: number; alive: boolean; team?: string; inBush?: boolean; stats?: { id?: string }; hp?: number; maxHp?: number; }
interface GameInstance {
  player: Brawler & { team?: string };
  bots?: Brawler[];
  allies?: Brawler[];
  enemies?: Brawler[];
  map: { width: number; height: number; tileSize?: number };
  /** Живая сетка (тренировка и др.) — превью миникарты как в бою. */
  tileGrid?: { cells: Uint8Array; width: number; height: number };
  map?: { tileGrid?: { cells: Uint8Array; width: number; height: number } };
  over: boolean;
  gas?: { radius?: number; cx?: number; cy?: number };
}

interface Props {
  gameRef: React.RefObject<GameInstance | null>;
  mode: GameMode;
  showdownFormat?: ShowdownFormat;
  positionStyle?: React.CSSProperties;
  embedded?: boolean;
}

const MAP_SIZE = 150;
const BASE = (import.meta as any).env?.BASE_URL ?? "/";
const THUMB_GS = 60;
const TILE_THUMB_COLORS: Record<number, string> = {
  0: "#75A743", 1: "#8B6060", 2: "#607060", 3: "#4CAF50",
  4: "#1565C0", 5: "#BDBDBD", 6: "#C8A45A", 7: "#C2185B",
  9: "#558B2F", 10: "#8D6E63", 11: "#78909C", 12: "#FDD835",
};

function drawLiveTileGridThumb(
  ctx: CanvasRenderingContext2D,
  cells: Uint8Array,
  gw: number,
  gh: number,
  mapX: number,
  mapY: number,
  mapW: number,
  mapH: number,
  colors: Record<number, string>,
): void {
  const cellW = mapW / gw;
  const cellH = mapH / gh;
  ctx.fillStyle = colors[0] ?? "#75A743";
  ctx.fillRect(mapX, mapY, mapW, mapH);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const t = cells[y * gw + x] ?? 0;
      if (t !== 0) {
        ctx.fillStyle = colors[t] ?? "#888";
        ctx.fillRect(mapX + x * cellW, mapY + y * cellH, cellW + 0.2, cellH + 0.2);
      }
    }
  }
}

const MODE_BG: Record<string, string> = {
  showdown: `${BASE}images/mode-showdown.png`,
  crystals: `${BASE}images/mode-crystals.png`,
  siege: `${BASE}images/mode-siege.png`,
  heist: `${BASE}images/mode-heist.png`,
  gemgrab: `${BASE}images/mode-gemgrab.png`,
  starstrike: `${BASE}images/mode-starstrike.svg`,
  megashowdown: `${BASE}images/mode-showdown.png`,
  training: `${BASE}images/mode-showdown.png`,
  bossraid: `${BASE}images/mode-crystals.png`,
};

export default function MiniMap({ gameRef, mode, showdownFormat = "solo", positionStyle, embedded = false }: Props) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLImageElement | null>(null);
  const { battle, tier, width, shortSide } = usePlatformLayout();
  const isDesktop = tier === "desktop" || (width >= 1024 && shortSide > 520);
  const minimapScale = embedded || isDesktop ? 1 : battle.minimapScale;

  useEffect(() => {
    const img = new Image();
    img.src = MODE_BG[mode] || MODE_BG.showdown;
    bgRef.current = img;
  }, [mode]);

  useEffect(() => {
    const id = setInterval(() => {
      const game = gameRef.current;
      const canvas = cvs.current;
      if (!game || !canvas || game.over) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width: mw, height: mh } = game.map;
      const scale = MAP_SIZE / Math.max(mw, mh);

      ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

      // Background
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

      // Map area preview image (same theme image as mode card)
      const mapW = mw * scale;
      const mapH = mh * scale;
      const mapX = (MAP_SIZE - mapW) / 2;
      const mapY = (MAP_SIZE - mapH) / 2;
      // У каждого режима — своя опубликованная карта (включая bossraid и
      // bounty). Тренировка / мега-столкновение / crystals фолбэчатся на
      // showdown, потому что у них нет своих редакторских карт.
      const modeForPreview = editorModeForGameMode(mode)
        ?? ((mode === "training" || mode === "megashowdown" || mode === "crystals")
          ? "showdown"
          : null);
      const pubMap = modeForPreview ? getActiveMap(modeForPreview) : null;
      const bg = bgRef.current;
      const liveGrid = game.tileGrid ?? game.map?.tileGrid;
      if (pubMap) {
        const cellW = mapW / THUMB_GS;
        const cellH = mapH / THUMB_GS;
        ctx.fillStyle = TILE_THUMB_COLORS[0];
        ctx.fillRect(mapX, mapY, mapW, mapH);
        for (let y = 0; y < THUMB_GS; y++) {
          for (let x = 0; x < THUMB_GS; x++) {
            const t = pubMap.cells[y * THUMB_GS + x] ?? 0;
            if (t !== 0) {
              ctx.fillStyle = TILE_THUMB_COLORS[t] ?? "#888";
              ctx.fillRect(mapX + x * cellW, mapY + y * cellH, cellW + 0.2, cellH + 0.2);
            }
          }
        }
        if (pubMap.overlays) {
          for (let y = 0; y < THUMB_GS; y++) {
            for (let x = 0; x < THUMB_GS; x++) {
              const ov = pubMap.overlays[y * THUMB_GS + x] ?? 0;
              if (ov !== 0) {
                ctx.fillStyle = ov === 3 ? "#FF9800" : ov <= 2 ? (ov === 1 ? "#1976D2" : "#D32F2F") : "#9C27B0";
                ctx.fillRect(mapX + x * cellW, mapY + y * cellH, cellW + 0.2, cellH + 0.2);
              }
            }
          }
        }
      } else if (liveGrid && (mode === "training" || mode === "monsterInvasion" || mode === "monsterhide" || mode === "teamHunt")) {
        const { cells, width: gw, height: gh } = liveGrid;
        drawLiveTileGridThumb(ctx, cells, gw, gh, mapX, mapY, mapW, mapH, TILE_THUMB_COLORS);
      } else if (mode === "starstrike") {
        ctx.fillStyle = TILE_THUMB_COLORS[0];
        ctx.fillRect(mapX, mapY, mapW, mapH);
        ctx.save();
        ctx.translate(mapX, mapY);
        drawStarStrikePreview(ctx, mapW, mapH, 1);
        ctx.restore();
      } else if (bg && bg.complete) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.drawImage(bg, mapX, mapY, mapW, mapH);
        ctx.restore();
      } else {
        ctx.fillStyle = "rgba(40,60,30,0.9)";
        ctx.fillRect(mapX, mapY, mapW, mapH);
      }
      ctx.save();
      ctx.fillStyle = "rgba(8,16,28,0.42)";
      ctx.fillRect(mapX, mapY, mapW, mapH);
      ctx.restore();

      // Gas zone (Showdown)
      if (game.gas && game.gas.radius !== undefined) {
        const g = game.gas;
        const cx = mapX + ((g.cx ?? mw / 2) * scale);
        const cy = mapY + ((g.cy ?? mh / 2) * scale);
        const r = (g.radius ?? 0) * scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,200,0,0.06)";
        ctx.fill();
        ctx.strokeStyle = "rgba(100,255,50,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // Collect all enemies
      let enemies: Brawler[] = game.enemies
        ? game.enemies.filter(b => b.alive)
        : [...(game.bots ?? []), ...(game.enemies ?? [])].filter(b => b.alive);

      if (mode === "siege" || mode === "training" || mode === "bossraid" || mode === "monsterInvasion" || mode === "teamHunt") {
        const devDots = getDevBattleMonsters()
          .filter(m => m.alive)
          .map(m => ({ x: m.x, y: m.y, alive: true, team: "red", inBush: m.inBush ?? false } as Brawler));
        if (mode === "bossraid") {
          const bossDots = (game.enemies ?? []).filter(b => b.alive);
          enemies = [...bossDots, ...devDots];
        } else if (devDots.length > 0) {
          enemies = devDots;
        }
      }

      const allies: Brawler[] = (game.allies ?? []).filter(b => b.alive);

      // Те же правила «куст раскрывает врага» что и в 3D-сцене (battle3DWorld):
      // союзник, сам стоящий в кусте, «подсвечивает» 8 соседних клеток. Враг
      // в кусте виден на миникарте, только если он стоит в одной из этих
      // подсвеченных клеток (Chebyshev ≤ 1 по тайлам).
      const cellSize = game.map.tileSize ?? 50;
      interface FriendlyTile { tx: number; ty: number; inBush: boolean; }
      const friendliesInBush: FriendlyTile[] = [];
      const considerFriendly = (b: Brawler | undefined): void => {
        if (!b || !b.alive || !b.inBush) return;
        friendliesInBush.push({
          tx: Math.floor(b.x / cellSize),
          ty: Math.floor(b.y / cellSize),
          inBush: true,
        });
      };
      considerFriendly(game.player);
      for (const a of allies) considerFriendly(a);

      const isEnemyRevealed = (b: Brawler): boolean => {
        if (!b.inBush) return true;
        const bTx = Math.floor(b.x / cellSize);
        const bTy = Math.floor(b.y / cellSize);
        for (const f of friendliesInBush) {
          if (Math.abs(bTx - f.tx) <= 1 && Math.abs(bTy - f.ty) <= 1) return true;
        }
        return false;
      };

      // Draw enemies as red dots — hide if they are in a bush AND no friendly is
      // standing in a bush within 1 tile (same rule as in 3D world).
      for (const b of enemies) {
        if (!isEnemyRevealed(b)) continue;
        const ex = mapX + b.x * scale;
        const ey = mapY + b.y * scale;
        ctx.beginPath();
        ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#FF4444";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Draw allies as blue dots
      for (const b of allies) {
        const ax = mapX + b.x * scale;
        const ay = mapY + b.y * scale;
        ctx.beginPath();
        ctx.arc(ax, ay, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#40C4FF";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Draw player as white/yellow dot (larger)
      if (game.player) {
        const px = mapX + game.player.x * scale;
        const py = mapY + game.player.y * scale;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#FFD700";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Pulse ring
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,215,0,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Border
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, MAP_SIZE - 1, MAP_SIZE - 1);

    }, 100);

    return () => clearInterval(id);
  }, [gameRef, mode]);

  return (
    <div style={{
      position: embedded ? "relative" : "absolute",
      top: embedded ? undefined : 12,
      right: embedded ? undefined : 12,
      zIndex: embedded ? undefined : 8,
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 0 20px rgba(0,0,0,0.7), 0 0 0 1.5px rgba(255,255,255,0.15)",
      userSelect: "none",
      flexShrink: embedded ? 0 : undefined,
      transform: minimapScale === 1 ? undefined : `scale(${minimapScale})`,
      transformOrigin: "top right",
      ...positionStyle,
    }}>
      <canvas
        ref={cvs}
        width={MAP_SIZE}
        height={MAP_SIZE}
        style={{ display: "block" }}
      />
      {mode !== "starstrike" && mode !== "training" && (
        <BattleCounter gameRef={gameRef} mode={mode} showdownFormat={showdownFormat} />
      )}
    </div>
  );
}

function countAliveTeams(fighters: Brawler[]): number {
  const teams = new Set<string>();
  for (const f of fighters) {
    if (f.alive && f.team) teams.add(f.team);
  }
  return teams.size;
}

function countAliveEnemies(fighters: Brawler[], playerTeam: string | undefined): number {
  if (!playerTeam) {
    return fighters.filter(f => f.alive).length;
  }
  return fighters.filter(f => f.alive && f.team !== playerTeam).length;
}

function BattleCounter({
  gameRef,
  mode,
  showdownFormat,
}: {
  gameRef: React.RefObject<GameInstance | null>;
  mode: GameMode;
  showdownFormat: ShowdownFormat;
}) {
  const { t } = useI18n();
  const spanRef = useRef<HTMLSpanElement>(null);
  const useTeamCount = mode === "showdown" && (showdownFormat === "duo" || showdownFormat === "trio");

  useEffect(() => {
    const id = setInterval(() => {
      const g = gameRef.current;
      if (!g || !spanRef.current) return;
      const allFighters: Brawler[] = [g.player, ...(g.bots ?? [])];
      let value: number;
      if (useTeamCount) {
        value = countAliveTeams(allFighters);
      } else if (mode === "siege" || mode === "training" || mode === "bossraid" || mode === "monsterInvasion") {
        const devCount = getDevBattleMonsters().filter(m => m.alive).length;
        const bossCount = mode === "bossraid"
          ? (g.enemies ?? []).filter(b => b.alive).length
          : 0;
        value = devCount + bossCount;
      } else {
        value = countAliveEnemies(
          g.enemies?.length ? g.enemies : allFighters,
          g.player.team,
        );
      }
      spanRef.current.textContent = useTeamCount
        ? t("minimap.teams", { count: value })
        : t("minimap.enemies", { count: value });
    }, 250);
    return () => clearInterval(id);
  }, [gameRef, useTeamCount, mode, t]);

  return (
    <div style={{
      background: "rgba(0,0,0,0.75)",
      color: useTeamCount ? "#FFD54F" : "#FF7777",
      fontSize: 10,
      fontWeight: 800,
      textAlign: "center",
      padding: "3px 8px",
      letterSpacing: 0.5,
      borderTop: "1px solid rgba(255,255,255,0.1)",
    }}>
      <span ref={spanRef}>{useTeamCount ? t("minimap.teamsDash") : t("minimap.enemiesDash")}</span>
    </div>
  );
}
