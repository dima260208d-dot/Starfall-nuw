import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClick?: () => void;
}

/** Click target for party speech/mode bubbles — no native button chrome or focus ring. */
export default function PartyBubbleTap({ children, onClick }: Props) {
  if (!onClick) return <>{children}</>;

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="party-bubble-tap"
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={handleKey}
    >
      {children}
    </div>
  );
}
