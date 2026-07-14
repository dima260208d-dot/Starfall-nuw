from pathlib import Path

content = r'''import { useMemo, useState, type ReactNode } from "react";

function GridOverlay() {
  return (
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
  );
}

export function TechPanel({
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
    <motionGrid />
  );
}
'''

# Replace motionGrid placeholders with real JSX
content = content.replace("<motionGrid />", "<PLACEHOLDER_DIV/>")

out = Path(__file__).resolve().parents[1] / "src/utils/devAnalytics/devCharts.tsx"

full = '''import { useMemo, useState, type ReactNode } from "react";

function GridOverlay() {
  return (
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
  );
}

export function TechPanel({
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
      <GridOverlay />
      <motionGrid />
    </motionGrid>
  );
}
'''

# Still has motionGrid in template - fix manually in python
full = full.replace(
    '      <GridOverlay />\n      <motionGrid />\n    </motionGrid>\n  );\n}',
    '''      <GridOverlay />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div>
            <motionGrid />
          </motionGrid>
        </motionGrid>
        {children}
      </motionGrid>
    </motionGrid>
  );
}''')

print("broken")
