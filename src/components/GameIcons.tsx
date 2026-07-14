/**
 * Shared 3D spinning icon helpers used across all menu pages (singleton WebGL).
 */
import SpinningModel3D from "./SpinningModel3D";
import GlowingStar from "./GlowingStar";

interface IconProps {
  size?: number;
  style?: React.CSSProperties;
  alt?: string;
  /** Меньше нагрузка: медленнее вращение (списки, дорожка славы). */
  lite?: boolean;
  /** Один кадр из GLB (без RAF) — для длинных списков; всё равно 3D, не 2D PNG. */
  static?: boolean;
}

export function CoinIcon({ size = 18, style, lite, static: isStatic }: IconProps) {
  return (
    <SpinningModel3D
      modelPath="models/coin.glb"
      size={Math.round(size * (lite ? 1.15 : 1.3))}
      color="#FFD700"
      ambientMult={lite ? 2.8 : 3.5}
      dirMult={lite ? 2.8 : 3.5}
      rotSpeed={isStatic ? 0 : lite ? 0.012 : 0.025}
      frozen={!!isStatic}
      style={style}
    />
  );
}

export function GemIcon({ size = 18, style, lite, static: isStatic }: IconProps) {
  return (
    <SpinningModel3D
      modelPath="models/gem.glb"
      size={Math.round(size * (lite ? 1.15 : 1.3))}
      modelScale={0.82}
      color="#40C4FF"
      ambientMult={lite ? 2.0 : 2.5}
      dirMult={lite ? 2.0 : 2.5}
      rotSpeed={isStatic ? 0 : lite ? 0.012 : 0.025}
      frozen={!!isStatic}
      style={style}
    />
  );
}

export function PowerIcon({ size = 18, style, lite, static: isStatic }: IconProps) {
  return (
    <SpinningModel3D
      modelPath="models/powerpoint.glb"
      size={Math.round(size * (lite ? 1.15 : 1.3))}
      modelScale={0.86}
      color="#CE93D8"
      ambientMult={lite ? 2.4 : 3.0}
      dirMult={lite ? 2.4 : 3.0}
      rotSpeed={isStatic ? 0 : lite ? 0.012 : 0.025}
      frozen={!!isStatic}
      style={style}
    />
  );
}

export function TrophyIcon({ size = 18, style, lite, static: isStatic }: IconProps) {
  return (
    <SpinningModel3D
      modelPath="models/trophy.glb"
      size={Math.round(size * (lite ? 1.15 : 1.3))}
      color="#FFD700"
      ambientMult={lite ? 2.8 : 3.5}
      dirMult={lite ? 2.8 : 3.5}
      rotSpeed={isStatic ? 0 : lite ? 0.012 : 0.025}
      frozen={!!isStatic}
      style={style}
    />
  );
}

/** Опыт Star Pass — звезда (SVG), не 3D-мяч. */
export function PassXpIcon({ size = 18, style, lite }: IconProps) {
  return (
    <GlowingStar
      filled
      glow={!lite}
      size={size}
      style={style}
    />
  );
}

export function BoxIcon({ size = 18, style }: IconProps) {
  return (
    <SpinningModel3D
      modelPath="models/power_box.glb"
      size={Math.round(size * 1.3)}
      color="#CE93D8"
      ambientMult={2.8}
      dirMult={2.8}
      style={style}
    />
  );
}

export function CoinBadge({ value, size = 16 }: { value: number | string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#FFD700" }}>
      <CoinIcon size={size} /> {value}
    </span>
  );
}

export function GemBadge({ value, size = 16 }: { value: number | string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#40C4FF" }}>
      <GemIcon size={size} /> {value}
    </span>
  );
}

export function PowerBadge({ value, size = 16 }: { value: number | string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#CE93D8" }}>
      <PowerIcon size={size} /> {value}
    </span>
  );
}
