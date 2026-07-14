import SpinningModel3D from "../SpinningModel3D";
import type { LuckyRushType } from "../../utils/luckyRush";

const RESOURCE_MODELS: Record<
  LuckyRushType,
  { modelPath: string; color: string; ambientMult: number; dirMult: number }
> = {
  coins: { modelPath: "models/coin.glb", color: "#FFD700", ambientMult: 3.5, dirMult: 3.5 },
  powerPoints: { modelPath: "models/powerpoint.glb", color: "#CE93D8", ambientMult: 3.0, dirMult: 3.0 },
  gems: { modelPath: "models/gem.glb", color: "#40C4FF", ambientMult: 2.5, dirMult: 2.5 },
  trophies: { modelPath: "models/trophy.glb", color: "#FFD700", ambientMult: 3.5, dirMult: 3.5 },
  chests: { modelPath: "models/chest_mega.glb", color: "#FF7043", ambientMult: 2.8, dirMult: 2.8 },
};

interface LuckyRushResourceIconProps {
  type: LuckyRushType;
  size: number;
  frozen?: boolean;
  style?: React.CSSProperties;
}

export default function LuckyRushResourceIcon({
  type,
  size,
  frozen,
  style,
}: LuckyRushResourceIconProps) {
  const cfg = RESOURCE_MODELS[type];
  return (
    <SpinningModel3D
      modelPath={cfg.modelPath}
      size={size}
      color={cfg.color}
      ambientMult={cfg.ambientMult}
      dirMult={cfg.dirMult}
      rotSpeed={frozen ? 0 : 0.022}
      frozen={frozen}
      style={{ background: "transparent", pointerEvents: "none", ...style }}
    />
  );
}
