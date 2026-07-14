import Brawler3DModel from "./Brawler3DModel";
import { resolveHeavyAssetUrl } from "../lib/assetBase";
import { registerWebGLCleanup } from "../utils/devWebGLRecovery";
import { brawlerGlbPath } from "../game/brawler3DScale";

interface BrawlerViewer3DProps {
  brawlerId: string;
  color: string;
  /** Canvas / viewer square side length in CSS pixels (e.g. 320). Not a 3D world scale. */
  size?: number;
  autoRotateInitial?: boolean;
  /** Passed to WebGL renderer (default 2). Lower in lists to reduce GPU load. */
  pixelRatioCap?: number;
  /** Лёгкий режим превью: без MSAA, low-power WebGL. */
  efficientPreview?: boolean;
  /** @deprecated Ignored — previews always use 3D when a GLB exists. */
  forceBillboard?: boolean;
  /** Заморозить 3D-цикл (popup поверх превью). */
  paused?: boolean;
  /** Цветное свечение за моделью (по умолчанию включено). */
  showBackdrop?: boolean;
  /** После ручного вращения — через N мс плавно вернуть в исходный угол (0°). */
  snapBackAfterDragMs?: number;
  /** Без мигания при remount (главное меню). */
  stablePreview?: boolean;
  /** Тап по модели (без вращения) — открыть меню персонажей. */
  onTap?: () => void;
}

// Brawlers that have a real 3D GLB model. Listed brawlers render via the GLTF viewer.
// idleIdx = direct clip index inside the GLB (most reliable selector)
// Extracted from the binary GLB files; animation order confirmed from raw GLTF JSON.
const MODEL_URLS: Record<string, { url: string; idleAnim: string; idleIdx?: number }> = {
  miya:    { url: "models/miya.glb",    idleAnim: "Walking",  idleIdx: 3 },
  ronin:   { url: "models/ronin.glb",   idleAnim: "Walking",  idleIdx: 2 },
  yuki:    { url: "models/yuki.glb",    idleAnim: "Walking",  idleIdx: 2 },
  kenji:   { url: "models/kenji.glb",   idleAnim: "Walking",  idleIdx: 2 },
  hana:    { url: "models/hana.glb",    idleAnim: "Walking",  idleIdx: 2 },
  goro:    { url: "models/goro.glb",    idleAnim: "Running"             },
  sora:    { url: "models/sora.glb",    idleAnim: "Running",  idleIdx: 0 },
  rin:     { url: "models/rin.glb",     idleAnim: "Running"             },
  taro:    { url: "models/taro.glb",    idleAnim: "Walking",  idleIdx: 2 },
  zafkiel: { url: "models/zafkiel.glb", idleAnim: "Walking",  idleIdx: 2 },
  verdeletta: { url: "models/verdeletta.glb", idleAnim: "Walking", idleIdx: 2 },
  lumina: { url: brawlerGlbPath("lumina"), idleAnim: "Walking", idleIdx: 1 },
  oliver: { url: brawlerGlbPath("oliver"), idleAnim: "Walking", idleIdx: 1 },
  callista: { url: brawlerGlbPath("callista"), idleAnim: "Walking", idleIdx: 1 },
  airin: { url: brawlerGlbPath("airin"), idleAnim: "Walking", idleIdx: 1 },
  elian: { url: brawlerGlbPath("elian"), idleAnim: "Walking", idleIdx: 1 },
  silven: { url: brawlerGlbPath("silven"), idleAnim: "Walking", idleIdx: 1 },
  vittoria: { url: brawlerGlbPath("vittoria"), idleAnim: "Walking", idleIdx: 2 },
  octavia: { url: brawlerGlbPath("octavia"), idleAnim: "Walking", idleIdx: 1 },
  zephyrin: { url: brawlerGlbPath("zephyrin"), idleAnim: "Walking", idleIdx: 1 },
  mirabel: { url: brawlerGlbPath("mirabel"), idleAnim: "Walking", idleIdx: 1 },
};

// Cached one-shot WebGL availability check. We try to create a tiny WebGL
// context once; if it fails (e.g. headless preview, hardware blocklisted),
// we treat 3D-model brawlers as if they had no GLB and render their 2D
// billboard fallback so the user always sees the character.
// Cache only successful probes — a transient context loss must not permanently
// force every brawler preview into a loading placeholder.
let _webglOk: boolean | null = null;
function isWebGLAvailable(): boolean {
  if (_webglOk === true) return true;
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    const ok = !!gl;
    if (ok) _webglOk = true;
    return ok;
  } catch {
    return false;
  }
}

export function resetWebGLAvailabilityProbe(): void {
  _webglOk = null;
}

registerWebGLCleanup(resetWebGLAvailabilityProbe);

export const DEFAULT_SNAP_BACK_MS = 3000;

function resolveSnapBackMs(snapBackAfterDragMs?: number): number | undefined {
  if (snapBackAfterDragMs === 0) return undefined;
  return snapBackAfterDragMs ?? DEFAULT_SNAP_BACK_MS;
}

export function getBrawler3DPreviewConfig(brawlerId: string) {
  return MODEL_URLS[brawlerId] ?? null;
}

function Brawler3DLoadingPulse({ color, size, showBackdrop }: { color: string; size: number; showBackdrop?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        userSelect: "none",
        pointerEvents: "none",
      }}
      aria-hidden
    >
      {showBackdrop && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 55%, ${color}55 0%, ${color}15 35%, transparent 70%)`,
            filter: "blur(2px)",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 60%, ${color}33 0%, transparent 65%)`,
          animation: "pulse 1.4s ease-in-out infinite",
        }}
      />
    </div>
  );
}

export default function BrawlerViewer3D({ brawlerId, color, size = 320, autoRotateInitial = false, pixelRatioCap, efficientPreview, paused, showBackdrop = true, snapBackAfterDragMs, stablePreview, onTap }: BrawlerViewer3DProps) {
  const snapMs = resolveSnapBackMs(snapBackAfterDragMs);
  const model = MODEL_URLS[brawlerId];

  if (!model || !isWebGLAvailable()) {
    return <Brawler3DLoadingPulse color={color} size={size} showBackdrop={showBackdrop} />;
  }

  return (
    <Brawler3DModel
      modelUrl={resolveHeavyAssetUrl(model.url)}
      animation={model.idleAnim}
      animationIdx={model.idleIdx}
      color={color}
      size={size}
      autoRotateInitial={autoRotateInitial}
      pixelRatioCap={pixelRatioCap}
      efficientPreview={efficientPreview}
      paused={paused}
      showBackdrop={showBackdrop}
      snapBackAfterDragMs={snapMs}
      stablePreview={stablePreview}
      onTap={onTap}
    />
  );
}
