import { MapBuilder } from "./mapBuilder";

export type Stamp =
  | { kind: "set"; x: number; y: number; tile: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; tile: number }
  | { kind: "hline"; x: number; y: number; len: number; tile: number }
  | { kind: "vline"; x: number; y: number; len: number; tile: number }
  | { kind: "L"; x: number; y: number; len: number; ori: number; tile: number }
  | { kind: "cross"; x: number; y: number; arm: number; tile: number }
  | { kind: "room"; x: number; y: number; w: number; h: number; wall: number; inner?: number }
  | { kind: "waterRect"; x: number; y: number; w: number; h: number };

export function applyStamps(b: MapBuilder, stamps: readonly Stamp[]): void {
  for (const s of stamps) {
    switch (s.kind) {
      case "set": b.set(s.x, s.y, s.tile); break;
      case "rect": b.rect(s.x, s.y, s.w, s.h, s.tile); break;
      case "hline": b.hline(s.x, s.y, s.len, s.tile); break;
      case "vline": b.vline(s.x, s.y, s.len, s.tile); break;
      case "L": b.L(s.x, s.y, s.len, s.ori, s.tile); break;
      case "cross": b.cross(s.x, s.y, s.arm, s.tile); break;
      case "room": b.room(s.x, s.y, s.w, s.h, s.wall, s.inner); break;
      case "waterRect": b.waterRect(s.x, s.y, s.w, s.h); break;
    }
  }
}
