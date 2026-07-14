/**
 * Interpolation buffer — render at serverTime - interpDelay.
 */
import type { V2State, V2Unit } from "./battleCodec";

export type InterpSample = { at: number; state: V2State };

export class InterpolationBuffer {
  private samples: InterpSample[] = [];
  private maxSamples = 12;
  interpDelayMs = 120;
  jitterMs = 0;

  push(state: V2State): void {
    const at = performance.now();
    this.samples.push({ at, state });
    if (this.samples.length > this.maxSamples) this.samples.shift();
  }

  setJitter(jitter: number): void {
    this.jitterMs = jitter;
    this.interpDelayMs = Math.max(80, Math.min(250, 100 + jitter * 2 + 50));
  }

  sample(now = performance.now()): V2Unit[] | null {
    if (this.samples.length < 1) return null;
    const renderTime = now - this.interpDelayMs;
    if (this.samples.length === 1 || renderTime <= this.samples[0].at) {
      return this.samples[this.samples.length - 1].state.units;
    }
    let a = this.samples[0];
    let b = this.samples[this.samples.length - 1];
    for (let i = 0; i < this.samples.length - 1; i++) {
      if (this.samples[i].at <= renderTime && this.samples[i + 1].at >= renderTime) {
        a = this.samples[i];
        b = this.samples[i + 1];
        break;
      }
    }
    const span = Math.max(1, b.at - a.at);
    const alpha = Math.max(0, Math.min(1, (renderTime - a.at) / span));
    const byId = new Map(b.state.units.map((u) => [u.id, u]));
    const out: V2Unit[] = [];
    for (const ua of a.state.units) {
      const ub = byId.get(ua.id) ?? ua;
      const dx = ub.x - ua.x;
      const dy = ub.y - ua.y;
      if (Math.hypot(dx, dy) > 400) {
        out.push(ub);
      } else {
        out.push({
          ...ub,
          x: ua.x + dx * alpha,
          y: ua.y + dy * alpha,
          a: ub.a,
        });
      }
    }
    return out;
  }

  /** Extrapolate up to 50ms when snapshots stall */
  extrapolate(now = performance.now()): V2Unit[] | null {
    const last = this.samples[this.samples.length - 1];
    if (!last) return null;
    const gap = now - last.at;
    if (gap < 150) return last.state.units;
    if (gap > 300) return last.state.units;
    return last.state.units;
  }
}
