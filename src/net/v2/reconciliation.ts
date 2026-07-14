/**
 * Client reconciliation — input ring + rewind threshold.
 */
import type { BattleInput } from "../battleTypes";

export type BufferedTurn = BattleInput & { pt: number; sentAt: number };

const REWIND_THRESHOLD_PX = 10;
const BUFFER_TICKS = 60;

export class ReconciliationBuffer {
  private inputs: BufferedTurn[] = [];
  private lastServerTick = 0;

  push(input: BufferedTurn): void {
    this.inputs.push(input);
    if (this.inputs.length > BUFFER_TICKS) this.inputs.shift();
  }

  noteServerTick(tick: number): void {
    this.lastServerTick = tick;
    this.inputs = this.inputs.filter((i) => i.pt >= tick - BUFFER_TICKS);
  }

  needsRewind(
    serverTick: number,
    localX: number,
    localY: number,
    serverX: number,
    serverY: number,
  ): boolean {
    if (serverTick < this.lastServerTick) return false;
    this.lastServerTick = serverTick;
    return Math.hypot(localX - serverX, localY - serverY) > REWIND_THRESHOLD_PX;
  }

  /** Inputs to replay after rewind from serverTick */
  replayFrom(serverTick: number): BufferedTurn[] {
    return this.inputs.filter((i) => i.pt > serverTick);
  }
}
