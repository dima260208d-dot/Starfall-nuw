import type React from "react";
import { EmojiIcon } from "../EmojiIcon";

export function TabHeader({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18, paddingLeft: 4 }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: "var(--t-1)", letterSpacing: "0.04em" }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 12.5, color: "var(--t-3)", marginTop: 4, letterSpacing: "0.02em" }}>{subtitle}</div>
      )}
      <div className="ui-divider" style={{ marginTop: 10 }} />
    </div>
  );
}

export function SectionLabel({ color, text }: { color: string; text: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 900, letterSpacing: 2,
      color: "#ffffff",
      marginBottom: 10,
      textShadow: `0 0 12px ${color}aa, 0 1px 3px rgba(0,0,0,0.85)`,
    }}>{text}</div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="ui-glass" style={{
      padding: "48px 20px", textAlign: "center",
      borderRadius: "var(--r-xl)",
    }}>
      <div className="ui-page-title" style={{ fontSize: 22, marginBottom: 8 }}><EmojiIcon emoji="✨" size={18} /> {title}</div>
      {subtitle && <div style={{ fontSize: 13, color: "var(--t-3)" }}>{subtitle}</div>}
    </div>
  );
}
