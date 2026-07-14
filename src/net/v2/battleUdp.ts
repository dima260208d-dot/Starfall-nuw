/**
 * Native UDP snapshot channel — Capacitor BattleUdp plugin (Android + iOS).
 * Browsers fall back to WS binary STATE on the same socket.
 * iOS: native/BattleUdp/ios/BattleUdpPlugin.swift (register after `npx cap add ios`).
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export interface BattleUdpPlugin {
  connect(opts: { host: string; port: number; token: string }): Promise<{ ok: boolean }>;
  disconnect(): Promise<void>;
  addListener(event: "packet", handler: (data: { data: string }) => void): Promise<PluginListenerHandle>;
}

const BattleUdp = registerPlugin<BattleUdpPlugin>("BattleUdp", {
  web: () => import("./battleUdpWeb").then((m) => m.BattleUdpWeb),
});

export function isBattleUdpAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type UdpPacketHandler = (bytes: Uint8Array) => void;

export async function startBattleUdp(
  opts: { host: string; port: number; token: string },
  onPacket: UdpPacketHandler,
): Promise<() => void> {
  if (!isBattleUdpAvailable() || !opts.port) return () => {};
  try {
    const res = await BattleUdp.connect(opts);
    if (!res.ok) return () => {};
    const handle = await BattleUdp.addListener("packet", (ev) => {
      if (!ev.data) return;
      try {
        onPacket(base64ToBytes(ev.data));
      } catch {
        /* ignore malformed */
      }
    });
    return () => {
      void handle.remove();
      void BattleUdp.disconnect();
    };
  } catch {
    return () => {};
  }
}
