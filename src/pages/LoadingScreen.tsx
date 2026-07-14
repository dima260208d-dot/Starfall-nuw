import { useEffect, useRef, useState } from "react";
import { gameMusic } from "../audio/gameMusicService";
import { resolvePublicAssetUrl } from "../lib/assetBase";
import "./loadingScreen.css";

interface Props {
  onDone: () => void;
  duration?: number;
  /** @deprecated Labels above the bar are no longer shown. */
  label?: string;
  progress?: number;
  /** Если false — только фон и логотип, без полосы и процентов. */
  showProgressBar?: boolean;
}

export default function LoadingScreen({
  onDone,
  duration,
  progress: externalProgress,
  showProgressBar = true,
}: Props) {
  const hasExternal = externalProgress !== undefined;
  const minDuration = duration ?? (hasExternal ? 1500 : 4500);
  const [timerProgress, setTimerProgress] = useState(0);
  const startRef = useRef(performance.now());
  const doneCalledRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const callDone = () => {
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;
    window.setTimeout(() => onDoneRef.current(), 300);
  };

  useEffect(() => {
    gameMusic.crossfadeTo("loading");
  }, []);

  useEffect(() => {
    startRef.current = performance.now();
    doneCalledRef.current = false;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - startRef.current) / minDuration);
      setTimerProgress(p);
      if (!hasExternal && p >= 1) {
        callDone();
        return;
      }
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasExternal, minDuration]);

  useEffect(() => {
    if (!hasExternal) return;
    if ((externalProgress ?? 0) >= 1 && timerProgress >= 1) callDone();
  }, [hasExternal, externalProgress, timerProgress]);

  // Preload can keep updating parent progress — never block exit once assets are ready.
  useEffect(() => {
    if (!hasExternal) return;
    if ((externalProgress ?? 0) < 1) return;
    const timer = window.setTimeout(callDone, minDuration + 400);
    return () => window.clearTimeout(timer);
  }, [hasExternal, externalProgress, minDuration]);

  const displayProgress = hasExternal
    ? Math.min(1, Math.max(externalProgress ?? 0, timerProgress * 0.35))
    : timerProgress;
  const percent = Math.floor(displayProgress * 100);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#06031a",
      overflow: "hidden", zIndex: 1000,
      fontFamily: "var(--app-font-sans)",
    }}>
      <img
        src={resolvePublicAssetUrl("loading-battle.png")}
        alt=""
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          objectPosition: "center",
        }}
      />

      <div style={{
        position: "absolute", inset: 0,
        background: [
          "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 20%, transparent 65%, rgba(0,0,10,0.88) 100%)",
          "linear-gradient(90deg,  rgba(0,0,0,0.2)  0%, transparent 15%, transparent 85%, rgba(0,0,0,0.2)  100%)",
        ].join(", "),
        pointerEvents: "none",
      }} />

      <img
        className="loading-screen-logo"
        src={resolvePublicAssetUrl("starfall-logo.png")}
        alt="Starfall"
        draggable={false}
      />

      {showProgressBar && (
        <div className="loading-bar-wrap">
          <div className="loading-bar-pct">{percent}%</div>
          <div className="loading-bar-outer">
            <div className="loading-bar-inner">
              <div
                className="loading-bar-fill"
                style={{
                  width: `${percent}%`,
                  transition: hasExternal ? "width 0.28s ease" : undefined,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
