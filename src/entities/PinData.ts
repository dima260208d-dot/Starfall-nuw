// ─── Pin (emote) system ─────────────────────────────────────────────────
//
// Pins are little circular emote stickers, one per (brawler, kind) plus a
// "общий" (universal) row that works on every brawler. They appear:
//   • in the in-battle messenger HUD as a 3-second speech bubble
//   • in the character menu via the "Пины" button next to "Выбрать"
//   • in the Shop's "Pins" tab where the locked ones can be purchased
//
// The renderer (PinIcon) is fully procedural: it composites the existing
// brawler avatar with a colourful ring + emoji overlay per emotion kind, so
// we don't ship 70+ new PNGs. Universal pins use a generic emoji on a
// solid coloured disc.

import { BRAWLERS } from "./BrawlerData";
import {
  isCollectiblePinId,
  getCollectiblePin,
  COLLECTIBLE_PIN_GEM_COST,
} from "./CollectiblePinData";

export type PinKind =
  | "default"     // plain face — free, granted at start per brawler
  | "happy"       // 15 💎
  | "sad"         // 15 💎
  | "thumbs_up"   // 15 💎
  | "angry"       // 15 💎
  | "hard"        // 50 💎 — "было трудно" / GG-effort
  | "heart"       // 50 💎
  | "special";    // 50 💎 — exclusive shiny pin

export const PIN_KIND_ORDER: PinKind[] = [
  "default", "happy", "sad", "thumbs_up", "angry", "hard", "heart", "special",
];

export interface PinKindMeta {
  kind: PinKind;
  /** Russian label shown in UI */
  label: string;
  /** Emoji glyph composited on top of the avatar */
  emoji: string;
  /** Ring / glow accent colour (CSS) */
  color: string;
  /** Secondary colour used for the gradient ring */
  secondaryColor: string;
  /** Gem cost when bought from the shop; 0 = freebie at account creation */
  cost: number;
  /** Optional CSS filter applied to the underlying avatar */
  avatarFilter?: string;
  /** Optional small extra glyph layered behind the main emoji (e.g. sweat) */
  extraEmoji?: string;
}

export const PIN_KIND_META: Record<PinKind, PinKindMeta> = {
  default: {
    kind: "default",
    label: "Обычный",
    emoji: "",
    color: "#90CAF9",
    secondaryColor: "#1976D2",
    cost: 0,
  },
  happy: {
    kind: "happy",
    label: "Радостный",
    emoji: "😄",
    color: "#FFD740",
    secondaryColor: "#FFB300",
    cost: 15,
    avatarFilter: "brightness(1.08) saturate(1.15)",
  },
  sad: {
    kind: "sad",
    label: "Грусть",
    emoji: "😢",
    color: "#64B5F6",
    secondaryColor: "#1976D2",
    cost: 15,
    avatarFilter: "saturate(0.55) brightness(0.92) hue-rotate(-10deg)",
  },
  thumbs_up: {
    kind: "thumbs_up",
    label: "Палец вверх",
    emoji: "👍",
    color: "#66BB6A",
    secondaryColor: "#1B5E20",
    cost: 15,
  },
  angry: {
    kind: "angry",
    label: "Злой",
    emoji: "😠",
    color: "#EF5350",
    secondaryColor: "#B71C1C",
    cost: 15,
    avatarFilter: "saturate(1.4) hue-rotate(-12deg) contrast(1.1)",
  },
  hard: {
    kind: "hard",
    label: "Было трудно",
    emoji: "😤",
    extraEmoji: "💦",
    color: "#7E57C2",
    secondaryColor: "#311B92",
    cost: 50,
  },
  heart: {
    kind: "heart",
    label: "Любовь",
    emoji: "😍",
    extraEmoji: "❤️",
    color: "#EC407A",
    secondaryColor: "#880E4F",
    cost: 50,
    avatarFilter: "saturate(1.25) brightness(1.05)",
  },
  special: {
    kind: "special",
    label: "Особый",
    emoji: "✨",
    color: "#FFD600",
    secondaryColor: "#D500F9",
    cost: 50,
  },
};

// ─── Universal pins ──────────────────────────────────────────────────────
// These are shared across all brawlers. Players own all of them by default
// (free) so they're never gated — they're the always-available fallback.
export interface UniversalPinDef {
  id: string;
  kind: PinKind;
  /** Russian label */
  label: string;
  /** Emoji used as the icon */
  emoji: string;
  /** Background gradient colour pair */
  color: string;
  secondaryColor: string;
  /** Speech bubble text shown when used in battle */
  bubbleText: string;
}

export const UNIVERSAL_PINS: UniversalPinDef[] = [
  { id: "u_hello",   kind: "default",   label: "Привет!",     emoji: "👋", color: "#42A5F5", secondaryColor: "#1565C0", bubbleText: "Привет!" },
  { id: "u_happy",   kind: "happy",     label: "Ха-ха!",      emoji: "😂", color: "#FFD740", secondaryColor: "#FFB300", bubbleText: "Хa-ха!" },
  { id: "u_sad",     kind: "sad",       label: "Эх...",       emoji: "😭", color: "#64B5F6", secondaryColor: "#1976D2", bubbleText: "Эх..." },
  { id: "u_thumbs",  kind: "thumbs_up", label: "Отлично!",    emoji: "👍", color: "#66BB6A", secondaryColor: "#2E7D32", bubbleText: "GG!" },
  { id: "u_angry",   kind: "angry",     label: "Грр!",        emoji: "😡", color: "#EF5350", secondaryColor: "#B71C1C", bubbleText: "Грр!" },
  { id: "u_hard",    kind: "hard",      label: "Жесть...",    emoji: "😵", color: "#7E57C2", secondaryColor: "#311B92", bubbleText: "Жесть..." },
  { id: "u_heart",   kind: "heart",     label: "Спасибо!",    emoji: "❤️", color: "#EC407A", secondaryColor: "#880E4F", bubbleText: "Спасибо!" },
  { id: "u_special", kind: "special",   label: "Изи!",        emoji: "💎", color: "#FFD600", secondaryColor: "#D500F9", bubbleText: "Изи!" },
  { id: "u_friend_handshake", kind: "thumbs_up", label: "Рукопожатие", emoji: "🤝", color: "#FFB74D", secondaryColor: "#E65100", bubbleText: "Друзья!" },
];

// ─── Pin ID helpers ──────────────────────────────────────────────────────
// Character pins use a deterministic id "pin:<brawlerId>:<kind>". Universal
// pins use their explicit id ("u_..."). Keeping it stringly-typed lets us
// store ownership as a flat string[] in the user profile and reference pins
// from the shop without needing a registry table.

/** Build the canonical pin id for a (brawler, kind) pair. */
export function pinIdFor(brawlerId: string, kind: PinKind): string {
  return `pin:${brawlerId}:${kind}`;
}

/** Inverse of pinIdFor — returns null for universal/unknown ids. */
export function parsePinId(id: string): { brawlerId: string; kind: PinKind } | null {
  if (!id.startsWith("pin:")) return null;
  const [, brawlerId, kind] = id.split(":");
  if (!brawlerId || !kind) return null;
  if (!(kind in PIN_KIND_META)) return null;
  return { brawlerId, kind: kind as PinKind };
}

export function isUniversalPinId(id: string): boolean {
  return id.startsWith("u_");
}

export function getUniversalPin(id: string): UniversalPinDef | null {
  return UNIVERSAL_PINS.find(p => p.id === id) ?? null;
}

// ─── All character pins (computed) ───────────────────────────────────────
export interface CharacterPinDef {
  id: string;
  brawlerId: string;
  brawlerName: string;
  kind: PinKind;
  label: string;
  cost: number;
}

export function listCharacterPins(brawlerId: string): CharacterPinDef[] {
  const b = BRAWLERS.find(x => x.id === brawlerId);
  if (!b) return [];
  return PIN_KIND_ORDER.map(kind => ({
    id: pinIdFor(brawlerId, kind),
    brawlerId,
    brawlerName: b.name,
    kind,
    label: `${b.name} · ${PIN_KIND_META[kind].label}`,
    cost: PIN_KIND_META[kind].cost,
  }));
}

export function listAllCharacterPins(): CharacterPinDef[] {
  return BRAWLERS.flatMap(b => listCharacterPins(b.id));
}

/** Short label for pin lists (profile / collection). */
export function getPinDisplayLabel(pinId: string): string {
  const parsed = parsePinId(pinId);
  if (parsed) {
    const b = BRAWLERS.find(x => x.id === parsed.brawlerId);
    return `${b?.name ?? parsed.brawlerId} · ${PIN_KIND_META[parsed.kind].label}`;
  }
  const u = getUniversalPin(pinId);
  if (u) return u.label;
  const c = getCollectiblePin(pinId);
  if (c) return c.label;
  return "Пин";
}

/** Owned pin ids: character → universal → collectible, stable within groups. */
export function sortOwnedPinIds(ids: string[]): string[] {
  const rank = (id: string) => {
    if (parsePinId(id)) return 0;
    if (isUniversalPinId(id)) return 1;
    if (isCollectiblePinId(id)) return 2;
    return 3;
  };
  return [...ids].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const pa = parsePinId(a);
    const pb = parsePinId(b);
    if (pa && pb) {
      const na = BRAWLERS.find(x => x.id === pa.brawlerId)?.name ?? pa.brawlerId;
      const nb = BRAWLERS.find(x => x.id === pb.brawlerId)?.name ?? pb.brawlerId;
      const byName = na.localeCompare(nb, "ru");
      if (byName !== 0) return byName;
      return PIN_KIND_ORDER.indexOf(pa.kind) - PIN_KIND_ORDER.indexOf(pb.kind);
    }
    return getPinDisplayLabel(a).localeCompare(getPinDisplayLabel(b), "ru");
  });
}

/** Pins a brawler owns by default (the plain-face one), granted on unlock. */
export function defaultPinsForBrawler(brawlerId: string): string[] {
  return [pinIdFor(brawlerId, "default")];
}

/** Universal pins every account starts with — all of them, free. */
export function defaultUniversalPins(): string[] {
  return UNIVERSAL_PINS.map(p => p.id);
}

/** Equipped loadout: 4 character slots + 4 universal slots (8 total). */
export const PIN_CHARACTER_SLOTS = 4;
export const PIN_UNIVERSAL_SLOT_START = PIN_CHARACTER_SLOTS;
export const PIN_EQUIP_SLOTS = PIN_CHARACTER_SLOTS + 4;

export function isCharacterEquipSlot(slot: number): boolean {
  return slot >= 0 && slot < PIN_CHARACTER_SLOTS;
}

export function isUniversalEquipSlot(slot: number): boolean {
  return slot >= PIN_UNIVERSAL_SLOT_START && slot < PIN_EQUIP_SLOTS;
}

/** Whether `pinId` may be placed in `slot` (empty pinId always allowed). */
export function slotAcceptsPin(slot: number, pinId: string): boolean {
  if (!pinId) return true;
  if (isCharacterEquipSlot(slot)) return !isUniversalPinId(pinId) && !isCollectiblePinId(pinId);
  if (isUniversalEquipSlot(slot)) return isUniversalPinId(pinId) || isCollectiblePinId(pinId);
  return false;
}

export function defaultEquippedPins(brawlerId: string): string[] {
  return [
    pinIdFor(brawlerId, "default"),
    pinIdFor(brawlerId, "happy"),
    pinIdFor(brawlerId, "thumbs_up"),
    "",
    "u_hello",
    "u_thumbs",
    "u_happy",
    "u_heart",
  ];
}

/** Expand a legacy 4-slot loadout into the 8-slot character/universal layout. */
export function migrateEquippedPinSlots(existing: string[], brawlerId: string): string[] {
  const def = defaultEquippedPins(brawlerId);
  if (existing.length >= PIN_EQUIP_SLOTS) {
    return existing.slice(0, PIN_EQUIP_SLOTS);
  }

  const char: string[] = [];
  const uni: string[] = [];
  for (const id of existing) {
    if (!id) continue;
    if (isUniversalPinId(id)) uni.push(id);
    else char.push(id);
  }

  const out = [...def];
  char.slice(0, PIN_CHARACTER_SLOTS).forEach((id, i) => { out[i] = id; });
  uni.slice(0, 4).forEach((id, i) => { out[PIN_UNIVERSAL_SLOT_START + i] = id; });
  return out.slice(0, PIN_EQUIP_SLOTS);
}

/** Look up the gem cost of a pin id (0 if it's a freebie / unknown). */
export function pinCostGems(id: string): number {
  if (isUniversalPinId(id)) return 0;
  const collectible = getCollectiblePin(id);
  if (collectible) return COLLECTIBLE_PIN_GEM_COST[collectible.rarity];
  const parsed = parsePinId(id);
  if (!parsed) return 0;
  return PIN_KIND_META[parsed.kind].cost;
}

export { isCollectiblePinId, getCollectiblePin } from "./CollectiblePinData";
