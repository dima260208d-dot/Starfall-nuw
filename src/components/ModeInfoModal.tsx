import { useEffect, useRef } from "react";
import type { ModeInfo } from "../data/modes";
import { editorModeForGameMode, getActiveMap } from "../utils/mapSchedule";
import { drawStarStrikePreview } from "../utils/starStrikeMapPreview";
import { useI18n } from "../i18n";
import ModeIconImg from "./ModeIconImg";
import ModalCloseButton from "./ModalCloseButton";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

const TILE_THUMB_COLORS: Record<number, string> = {
  0: "#75A743", 1: "#8B6060", 2: "#607060", 3: "#4CAF50",
  4: "#1565C0", 5: "#BDBDBD", 6: "#C8A45A", 7: "#C2185B",
  9: "#558B2F", 10: "#8D6E63", 11: "#78909C", 12: "#FDD835",
};
const THUMB_GS = 60;
const THUMB_PX = 3;
const MODE_ICON_SIZE = 66;

function MapThumbnail({ modeId, color }: { modeId: string; color: string }) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorMode = editorModeForGameMode(modeId);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const pubMap = editorMode ? getActiveMap(editorMode) : null;
    const size = THUMB_GS * THUMB_PX;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = TILE_THUMB_COLORS[0];
    ctx.fillRect(0, 0, size, size);
    if (!pubMap && modeId !== "starstrike") {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "22px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🗺️", size / 2, size / 2);
      return;
    }
    if (modeId === "starstrike" && !pubMap) {
      drawStarStrikePreview(ctx, size, size, 1);
    } else if (pubMap) {
      for (let y = 0; y < THUMB_GS; y++) {
        for (let x = 0; x < THUMB_GS; x++) {
          const t = pubMap.cells[y * THUMB_GS + x] ?? 0;
          if (t !== 0) {
            ctx.fillStyle = TILE_THUMB_COLORS[t] ?? "#888";
            ctx.fillRect(x * THUMB_PX, y * THUMB_PX, THUMB_PX, THUMB_PX);
          }
        }
      }
      if (pubMap.overlays) {
        for (let y = 0; y < THUMB_GS; y++) {
          for (let x = 0; x < THUMB_GS; x++) {
            const ov = pubMap.overlays[y * THUMB_GS + x] ?? 0;
            if (ov !== 0) {
              ctx.fillStyle = ov === 3 ? "#FF9800" : ov <= 2 ? (ov === 1 ? "#1976D2" : "#D32F2F") : "#9C27B0";
              ctx.fillRect(x * THUMB_PX, y * THUMB_PX, THUMB_PX, THUMB_PX);
            }
          }
        }
      }
    }
  }, [modeId, editorMode]);
  const size = THUMB_GS * THUMB_PX;
  const pubMap = editorMode ? getActiveMap(editorMode) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase" }}>
        {pubMap ? pubMap.name : modeId === "starstrike" ? t("nav.mapArena") : t("nav.mapNotLoaded")}
      </div>
      <div style={{
        borderRadius: 10, overflow: "hidden",
        border: `2px solid ${color}55`,
        boxShadow: `0 0 18px ${color}44`,
        lineHeight: 0,
      }}>
        <canvas ref={canvasRef} width={size} height={size} style={{ display: "block", width: size, height: size }} />
      </div>
    </div>
  );
}

export default function ModeInfoModal({ mode, onClose }: { mode: ModeInfo; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(2,0,18,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: `linear-gradient(160deg, ${mode.color}33, rgba(12,8,40,0.22))`,
          border: `1px solid ${mode.color}88`,
          borderRadius: "var(--r-xl)", padding: 24,
          maxWidth: 640, width: "100%",
          boxShadow: `0 24px 60px rgba(0,0,0,0.35), 0 0 40px ${mode.color}33, inset 0 1px 0 rgba(255,255,255,0.10)`,
          color: "var(--t-1)",
          position: "relative",
          display: "flex", gap: 24, alignItems: "flex-start",
          backdropFilter: "blur(10px) saturate(1.2)",
          WebkitBackdropFilter: "blur(10px) saturate(1.2)",
        }}
      >
        <ModalCloseButton onClick={onClose} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <ModeIconImg
              modeId={mode.id}
              alt={mode.name}
              size={MODE_ICON_SIZE}
              color={mode.color}
              bare
              style={{ flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: mode.color, letterSpacing: 1 }}>
                {mode.name}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", letterSpacing: 1 }}>
                {mode.subtitle.toUpperCase()}
              </div>
            </div>
          </div>

          <div
            className="ui-glass"
            style={{
              padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 22 }}><EmojiIcon emoji="👥" size={24} /></span>
            <div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1 }}><Tr id="common.format" /></div>
              <div style={{ fontSize: 13, fontWeight: 800, color: mode.color }}>{mode.players}</div>
            </div>
          </div>

          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 1, marginBottom: 6 }}>
            <Tr id="nav.howToPlay" />
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,0.92)" }}>
            {mode.desc}
          </div>
        </div>

        <MapThumbnail modeId={mode.id} color={mode.color} />
      </div>
    </div>
  );
}
