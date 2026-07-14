import type { CSSProperties, MouseEvent } from "react";

interface ModalCloseButtonProps {
  onClick: (e: MouseEvent) => void;
  style?: CSSProperties;
  className?: string;
  /** absolute top-right corner (default) or inline */
  variant?: "corner" | "inline";
  label?: string;
}

/** Wider × close control used across modals. */
export default function ModalCloseButton({
  onClick,
  style,
  className,
  variant = "corner",
  label = "×",
}: ModalCloseButtonProps) {
  const base: CSSProperties = variant === "corner"
    ? {
        position: "absolute",
        top: 8,
        right: 8,
        zIndex: 5,
      }
    : {};

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className={className}
      style={{
        ...base,
        minWidth: 40,
        height: 36,
        padding: "0 10px",
        background: "transparent",
        border: "none",
        color: "rgba(255,255,255,0.65)",
        fontSize: 24,
        fontWeight: 300,
        cursor: "pointer",
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      {label}
    </button>
  );
}
