import type { PartySlot } from "./party";

const LEFT_LINE_ORDER: PartySlot[] = ["back2_left", "back1_left", "left"];
const RIGHT_LINE_ORDER: PartySlot[] = ["right", "back1_right", "back2_right"];

function isLeftWingSlot(slot: string): boolean {
  return slot === "left" || slot.includes("_left");
}

function isRightWingSlot(slot: string): boolean {
  return slot === "right" || slot.includes("_right");
}

function orderWing<T extends { slot: PartySlot; playerId: string }>(
  mates: T[],
  order: PartySlot[],
): T[] {
  const bySlot = new Map(mates.map(m => [m.slot, m]));
  const out: T[] = [];
  const used = new Set<string>();
  for (const s of order) {
    const m = bySlot.get(s);
    if (m) {
      out.push(m);
      used.add(m.playerId);
    }
  }
  for (const m of mates) {
    if (!used.has(m.playerId)) out.push(m);
  }
  return out;
}

export function teammatesOnLeftLine<T extends { slot: PartySlot; playerId: string }>(mates: T[]): T[] {
  const wing = mates.filter(m => isLeftWingSlot(m.slot));
  return orderWing(wing, LEFT_LINE_ORDER);
}

export function teammatesOnRightLine<T extends { slot: PartySlot; playerId: string }>(mates: T[]): T[] {
  const wing = mates.filter(m => isRightWingSlot(m.slot));
  return orderWing(wing, RIGHT_LINE_ORDER);
}

export function isLeftPartySlot(slot: PartySlot): boolean {
  return isLeftWingSlot(slot);
}

/** Смещение блока имени/ранга/силы/звёзд в шахматном порядке (4–5 в команде). */
export function partyStatsStaggerOffset(
  index: number,
  enabled: boolean,
  compact?: boolean,
): number {
  if (!enabled) return 0;
  return index % 2 === 0 ? 0 : (compact ? 22 : 30);
}
