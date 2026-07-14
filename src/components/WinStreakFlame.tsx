import { WIN_STREAK_MIN_DISPLAY } from "../utils/winStreak";
import { TrophyIcon } from "./GameIcons";

interface WinStreakFlameProps {
  streak: number;
  size?: number;
  /** Show streak count on the flame (default true). */
  showNumber?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

/** Animated anime-style flame badge with optional streak count. */
export default function WinStreakFlame({
  streak,
  size = 40,
  showNumber = true,
  style,
  className,
}: WinStreakFlameProps) {
  if (streak < WIN_STREAK_MIN_DISPLAY) return null;

  const flameSize = Math.round(size * 1.2);
  const fontSize = Math.max(10, Math.round(flameSize * 0.34));

  return (
    <div
      className={`win-streak-flame${className ? ` ${className}` : ""}`}
      style={{ width: flameSize, height: Math.round(flameSize * 1.15), ...style }}
      aria-label={`${streak}`}
    >
      <div className="win-streak-flame__layers" aria-hidden>
        <div className="win-streak-flame__blob win-streak-flame__blob--outer" />
        <div className="win-streak-flame__blob win-streak-flame__blob--mid" />
        <div className="win-streak-flame__blob win-streak-flame__blob--core" />
        <div className="win-streak-flame__spark win-streak-flame__spark--a" />
        <div className="win-streak-flame__spark win-streak-flame__spark--b" />
      </div>
      {showNumber && (
        <span
          className="win-streak-flame__num"
          style={{ fontSize }}
        >
          {streak}
        </span>
      )}
    </div>
  );
}

interface WinStreakBonusProps {
  bonus: number;
  size?: number;
}

/** Victory screen: +N bonus trophies with 3D cup. */
export function WinStreakBonus({ bonus, size = 18 }: WinStreakBonusProps) {
  if (bonus <= 0) return null;
  return (
    <div className="win-streak-bonus">
      <span className="win-streak-bonus__plus">+{bonus}</span>
      <TrophyIcon size={size} />
    </div>
  );
}
