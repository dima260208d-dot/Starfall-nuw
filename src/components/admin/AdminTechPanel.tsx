import type { ReactNode } from "react";

/** Self-contained admin panel shell (avoids chunk/import issues in admin APK). */
export function AdminTechPanel({
  title,
  subtitle,
  accent = "#00E5FF",
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(0,20,40,0.92) 0%, rgba(0,8,18,0.96) 100%)",
        border: `1px solid ${accent}44`,
        borderRadius: 12,
        padding: 14,
        boxShadow: `0 0 24px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.35,
          backgroundImage:
            "linear-gradient(rgba(0,229,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2.2, color: accent, textTransform: "uppercase" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{subtitle}</div>}
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  );
}
