import {
  getSubscriberNameColorDef,
  isSubscriberNameColor,
  type SubscriberNameColorDef,
} from "../data/subscriberNameColors";
import { isStarGuardianActive } from "./subscription";

export const DEFAULT_USERNAME_COLOR = "#FFFFFF";

export type ResolvedUsernameStyle =
  | { kind: "solid"; color: string }
  | { kind: "shimmer"; def: SubscriberNameColorDef };

/** Effective name style: premium shimmer only while Star Guardian is active. */
export function resolveUsernameStyle(
  stored: string | undefined | null,
  subActive = isStarGuardianActive(),
): ResolvedUsernameStyle {
  const raw = stored || DEFAULT_USERNAME_COLOR;
  if (isSubscriberNameColor(raw)) {
    if (!subActive) return { kind: "solid", color: DEFAULT_USERNAME_COLOR };
    const def = getSubscriberNameColorDef(raw);
    if (def) return { kind: "shimmer", def };
    return { kind: "solid", color: DEFAULT_USERNAME_COLOR };
  }
  return { kind: "solid", color: raw };
}

/** Accent for borders and glows (menu chip, etc.). */
export function resolveUsernameAccent(
  stored: string | undefined | null,
  subActive = isStarGuardianActive(),
): string {
  const style = resolveUsernameStyle(stored, subActive);
  return style.kind === "shimmer" ? style.def.accent : style.color;
}
