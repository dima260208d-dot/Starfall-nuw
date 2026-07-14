/**
 * PetSvg — 3D GLB для питомцев с моделями; иначе SVG-заглушка.
 */
import type { PetDef } from "../entities/PetData";
import { getPetById } from "../entities/PetData";
import { PET_3D_IDS } from "../game/pet3DRenderer";
import PetViewer3D from "./PetViewer3D";
import PetThumb from "./PetThumb";

interface PetSvgProps {
  pet?: PetDef;
  petId?: string;
  size?: number;
  animated?: boolean;
  haloPulse?: boolean;
  /** Force WebGL even for small sizes (main menu companion). */
  force3D?: boolean;
  /** Custom nickname rendered above the pet model. */
  nameLabel?: string | null;
  /** Запас canvas по краям при вращении (только крупные 3D-превью). */
  clipPadding?: number;
  /** Клик без перетаскивания. */
  onTap?: () => void;
  /** Заморозить 3D-цикл (popup поверх превью). */
  paused?: boolean;
  /** Без мигания / паузы цикла (главное меню). */
  stablePreview?: boolean;
  /** Переопределить efficientPreview (главное меню — false). */
  efficientPreview?: boolean;
}

export default function PetSvg({
  pet, petId, size = 80, haloPulse = true, force3D = false, animated = false, nameLabel,
  clipPadding, onTap, paused, stablePreview, efficientPreview: efficientPreviewProp,
}: PetSvgProps) {
  const p = pet ?? getPetById(petId);
  if (!p) return null;

  const use3D = PET_3D_IDS.has(p.id) || force3D;
  const label = nameLabel?.trim() || null;
  const isSmallPreview = size < 110;
  const efficientPreview = efficientPreviewProp ?? isSmallPreview;

  const model = !use3D ? (
    <PetThumb pet={p} size={size} />
  ) : (
    <PetViewer3D
      petId={p.id}
      color={p.color}
      size={size}
      showBackdrop={haloPulse}
      efficientPreview={efficientPreview}
      pixelRatioCap={efficientPreview ? (isSmallPreview ? 1 : (animated ? 1.5 : 1)) : (animated ? 1.5 : 2)}
      animated={animated}
      clipPadding={clipPadding}
      onTap={onTap}
      paused={paused}
      stablePreview={stablePreview}
    />
  );

  if (!label) return model;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: Math.max(2, size * 0.04),
    }}>
      <div style={{
        fontSize: Math.max(9, size * 0.11),
        fontWeight: 900,
        color: "#fff",
        letterSpacing: 0.5,
        textAlign: "center",
        maxWidth: size * 1.35,
        lineHeight: 1.15,
        wordBreak: "break-word",
        textShadow: `0 0 8px ${p.color}, 0 2px 4px rgba(0,0,0,0.85)`,
        pointerEvents: "none",
      }}>{label}</div>
      {model}
    </div>
  );
}
