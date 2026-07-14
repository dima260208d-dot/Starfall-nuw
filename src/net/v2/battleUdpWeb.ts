/** Web stub — UDP snapshots only on native Android. */
import type { PluginListenerHandle } from "@capacitor/core";
import type { BattleUdpPlugin } from "./battleUdp";

export const BattleUdpWeb: BattleUdpPlugin = {
  async connect() {
    return { ok: false };
  },
  async disconnect() {},
  async addListener(): Promise<PluginListenerHandle> {
    return { remove: async () => {} };
  },
};
