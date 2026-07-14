import { memo } from "react";
import Brawler3DModel from "./Brawler3DModel";
import { resolveHeavyAssetUrl } from "../lib/assetBase";
import { PET_3D_IDS, PET_UI_MODEL_URLS, getPetPreviewAnim } from "../game/pet3DRenderer";
import { DEFAULT_SNAP_BACK_MS } from "./BrawlerViewer3D";

interface PetViewer3DProps {
  petId: string;
  color: string;
  size?: number;
  autoRotateInitial?: boolean;
  pixelRatioCap?: number;
  efficientPreview?: boolean;
  paused?: boolean;
  showBackdrop?: boolean;
  /** Loop locomotion clip (menu companion). */
  animated?: boolean;
  /** После ручного вращения — через N мс вернуть в исходный угол (как у бойцов). */
  snapBackAfterDragMs?: number;
  /** Запас canvas по краям (модель того же размера). */
  clipPadding?: number;
  /** Клик без перетаскивания. */
  onTap?: () => void;
  /** Без мигания (главное меню). */
  stablePreview?: boolean;
}

function Pet3DLoadingPulse({ color, size, showBackdrop }: { color: string; size: number; showBackdrop?: boolean }) {
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

function isWebGLAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function PetViewer3D({
  petId,
  color,
  size = 120,
  autoRotateInitial = false,
  pixelRatioCap,
  efficientPreview,
  paused,
  showBackdrop = true,
  animated = false,
  snapBackAfterDragMs = DEFAULT_SNAP_BACK_MS,
  clipPadding,
  onTap,
  stablePreview,
}: PetViewer3DProps) {
  const pad = clipPadding ?? (size >= 100 ? 1.3 : 1);

  if (!PET_3D_IDS.has(petId) || !isWebGLAvailable()) {
    return <Pet3DLoadingPulse color={color} size={size} showBackdrop={showBackdrop} />;
  }

  const url = PET_UI_MODEL_URLS[petId];
  const preview = getPetPreviewAnim(petId);

  return (
    <Brawler3DModel
      modelUrl={resolveHeavyAssetUrl(url)}
      animation={preview.anim}
      animationIdx={preview.idx}
      color={color}
      size={size}
      autoRotateInitial={autoRotateInitial}
      pixelRatioCap={pixelRatioCap}
      efficientPreview={efficientPreview}
      paused={paused}
      animationActive={animated}
      showBackdrop={showBackdrop}
      snapBackAfterDragMs={snapBackAfterDragMs}
      clipPadding={pad}
      onTap={onTap}
      stablePreview={stablePreview}
    />
  );
}

const MemoPetViewer3D = memo(PetViewer3D, (a, b) =>
  a.petId === b.petId
  && a.size === b.size
  && a.color === b.color
  && a.animated === b.animated
  && a.paused === b.paused
  && a.showBackdrop === b.showBackdrop
  && a.efficientPreview === b.efficientPreview
  && a.pixelRatioCap === b.pixelRatioCap
  && a.clipPadding === b.clipPadding
  && a.onTap === b.onTap
  && a.stablePreview === b.stablePreview
);

export default MemoPetViewer3D;
