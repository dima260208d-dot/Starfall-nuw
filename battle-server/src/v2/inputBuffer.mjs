/**
 * Input buffering — apply turns at predicted_tick (pt), not arrival time.
 */
import { INPUT_BUFFER_TICKS } from "../net/constants.mjs";

/** @typedef {{ pt: number, mx: number, my: number, ax: number, ay: number, wx?: number, wy?: number, attack: boolean, super: boolean, manual?: boolean, pending?: boolean }} BufferedInput */

export class InputBuffer {
  /** @type {Map<string, Map<number, BufferedInput>>} */
  #byUnit = new Map();
  #maxTick = 0;

  push(unitId, input) {
    const pt = Math.max(0, input.pt | 0);
    let ring = this.#byUnit.get(unitId);
    if (!ring) {
      ring = new Map();
      this.#byUnit.set(unitId, ring);
    }
    ring.set(pt, input);
    this.#maxTick = Math.max(this.#maxTick, pt);
    const minKeep = pt - INPUT_BUFFER_TICKS * 4;
    for (const t of [...ring.keys()]) {
      if (t < minKeep) ring.delete(t);
    }
  }

  /** Inputs whose pt === currentTick */
  consume(currentTick) {
    /** @type {Array<{ unitId: string, input: BufferedInput }>} */
    const out = [];
    for (const [unitId, ring] of this.#byUnit) {
      const input = ring.get(currentTick);
      if (input) {
        out.push({ unitId, input });
        ring.delete(currentTick);
      }
    }
    return out;
  }

  /** Hold last input between packets (move/aim/fire, not super edge). */
  holdLast(unitId, last) {
    if (!last) return null;
    return {
      ...last,
      pt: last.pt,
      super: false,
      pending: false,
      attack: !!(last.attack || last.manual || last.pending),
    };
  }
}
