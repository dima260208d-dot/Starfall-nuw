import type { CSSProperties, ReactNode } from "react";

function shearForHeight(outerH: number) {
  const outer = Math.max(3, Math.min(14, Math.round(outerH * 0.22)));
  const inner = Math.max(2, Math.round(outer * 0.72));
  return { outer, inner };
}

export type VolProgressTrackProps = {
  /** Fill amount 0–100 */
  fill: number;
  /** Optional peak marker 0–100 (rank bars) */
  peak?: number;
  /** Total outer height including padding (px) — horizontal bars */
  fitHeight?: number;
  /** Total outer width including padding (px) — vertical bars */
  fitWidth?: number;
  orientation?: "horizontal" | "vertical";
  fillBackground?: string;
  fillBoxShadow?: string;
  peakBackground?: string;
  className?: string;
  style?: CSSProperties;
  overlay?: ReactNode;
  overlayStyle?: CSSProperties;
  absoluteFill?: boolean;
};

export default function VolProgressTrack({
  fill,
  peak,
  fitHeight = 26,
  fitWidth = 14,
  orientation = "horizontal",
  fillBackground = "#9c27b0",
  fillBoxShadow,
  peakBackground,
  className,
  style,
  overlay,
  overlayStyle,
  absoluteFill = true,
}: VolProgressTrackProps) {
  const safeFill = Number.isFinite(fill) ? fill : 0;
  const clampedFill = Math.max(0, Math.min(100, safeFill));
  const clampedPeak = peak != null && Number.isFinite(peak)
    ? Math.max(0, Math.min(100, peak))
    : null;
  const vertical = orientation === "vertical";
  const fitDim = vertical ? fitWidth : fitHeight;
  const { outer, inner } = shearForHeight(fitDim);

  return (
    <div
      className={[
        "ui-vol-progress",
        vertical ? "ui-vol-progress--fit-v" : "ui-vol-progress--fit",
        className,
      ].filter(Boolean).join(" ")}
      style={{
        ...(vertical ? { width: fitWidth, height: "100%" } : { height: fitHeight }),
        ["--vol-shear-outer" as string]: `${outer}px`,
        ["--vol-shear-inner" as string]: `${inner}px`,
        ...style,
      }}
    >
      <div className="ui-vol-progress__inner">
        {clampedPeak != null && clampedPeak > clampedFill + 0.5 && (
          <div
            className={vertical ? "ui-vol-progress__peak ui-vol-progress__peak--v" : "ui-vol-progress__peak"}
            style={{
              ...(vertical ? { height: `${clampedPeak}%` } : { width: `${clampedPeak}%` }),
              background: peakBackground,
            }}
          />
        )}
        <div
          className={[
            "ui-vol-progress__fill",
            absoluteFill ? "ui-vol-progress__fill--absolute" : undefined,
            vertical ? "ui-vol-progress__fill--v" : undefined,
            vertical && absoluteFill ? "ui-vol-progress__fill--absolute-v" : undefined,
          ].filter(Boolean).join(" ")}
          style={{
            ...(vertical ? { height: `${clampedFill}%` } : { width: `${clampedFill}%` }),
            background: fillBackground,
            boxShadow: fillBoxShadow,
          }}
        />
        {overlay ? <div className="ui-vol-progress__overlay" style={overlayStyle}>{overlay}</div> : null}
      </div>
    </div>
  );
}
