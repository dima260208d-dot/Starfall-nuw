/**
 * Minimal browser polyfills — Bot AI patch only (DOM/Image stubs live in bootstrapHeadless.mjs).
 */
import { Bot } from "../entities/Bot";

let installed = false;

/** When set, Clash* constructors load this map instead of schedule/session (headless server only). */
export type HeadlessMapOverride = {
  name: string;
  mode: string;
  cells: number[];
  overlays: number[];
  rotations?: number[];
};

let headlessMapOverride: HeadlessMapOverride | null = null;

export function setHeadlessMapOverride(map: HeadlessMapOverride | null): void {
  headlessMapOverride = map;
}

export function getHeadlessMapOverride(): HeadlessMapOverride | null {
  return headlessMapOverride;
}

export function installHeadlessEnv(): void {
  if (installed) return;
  installed = true;
  (globalThis as { __HEADLESS_BATTLE_SERVER?: boolean }).__HEADLESS_BATTLE_SERVER = true;

  const origAi = Bot.prototype.updateAI;
  Bot.prototype.updateAI = function (this: Bot & { __humanRemote?: boolean }, ...args: unknown[]) {
    if (this.__humanRemote) return;
    return origAi.apply(this, args as never);
  };
}

export function getHeadlessCanvas(): HTMLCanvasElement {
  installHeadlessEnv();
  const doc = globalThis.document!;
  return doc.createElement("canvas") as HTMLCanvasElement;
}
