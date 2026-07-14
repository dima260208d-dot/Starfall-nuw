/**
 * Расположение мобильных джойстиков и кнопок (тренировка + глобально).
 */
export type GestureAnchor = "fixed" | "floating";

export interface GestureControlLayout {
  move: { anchor: GestureAnchor; x: number; y: number; size: number; mirror: boolean };
  attack: { anchor: GestureAnchor; x: number; y: number; size: number; mirror: boolean };
  super: { anchor: GestureAnchor; x: number; y: number; size: number; mirror: boolean };
  emoji: { x: number; y: number; size: number };
  autobattle: { x: number; y: number; size: number };
}

const STORAGE_KEY = "sf_gesture_layout_v2";

export const DEFAULT_GESTURE_LAYOUT: GestureControlLayout = {
  // Floating (dynamic) sticks: the joystick spawns wherever the finger touches
  // its half of the screen — move on the left half, attack/super on the right.
  move: { anchor: "floating", x: 0.12, y: 0.72, size: 1, mirror: false },
  attack: { anchor: "floating", x: 0.88, y: 0.72, size: 1, mirror: false },
  super: { anchor: "floating", x: 0.88, y: 0.52, size: 1, mirror: false },
  emoji: { x: 0.88, y: 0.42, size: 1 },
  autobattle: { x: 0.12, y: 0.28, size: 1 },
};

export function loadGestureLayout(): GestureControlLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_GESTURE_LAYOUT);
    return { ...DEFAULT_GESTURE_LAYOUT, ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_GESTURE_LAYOUT);
  }
}

export function saveGestureLayout(layout: GestureControlLayout): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

export function resetGestureLayout(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GESTURE_LAYOUT));
}
