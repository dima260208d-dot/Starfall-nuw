/**
 * Battle haptics — light impact per hit, heavy on death. Toggle in settings.
 */
import { Capacitor } from "@capacitor/core";

const STORAGE_KEY = "sf_battle_haptics_v1";

export type BattleHapticSettings = {
  recoilEnabled: boolean;
  vibrationEnabled: boolean;
};

const DEFAULTS: BattleHapticSettings = {
  recoilEnabled: true,
  vibrationEnabled: true,
};

let lastPulseAt = 0;
const MIN_GAP_MS = 45;

export function getBattleHapticSettings(): BattleHapticSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) as Partial<BattleHapticSettings> };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setBattleHapticSettings(patch: Partial<BattleHapticSettings>): void {
  const next = { ...getBattleHapticSettings(), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

async function loadHaptics() {
  try {
    const mod = await import("@capacitor/haptics");
    return mod.Haptics;
  } catch {
    return null;
  }
}

async function pulse(style: "Light" | "Medium" | "Heavy") {
  if (!Capacitor.isNativePlatform()) return;
  const now = Date.now();
  if (now - lastPulseAt < MIN_GAP_MS) return;
  lastPulseAt = now;
  const H = await loadHaptics();
  if (!H) return;
  try {
    const { ImpactStyle } = await import("@capacitor/haptics");
    const map = { Light: ImpactStyle.Light, Medium: ImpactStyle.Medium, Heavy: ImpactStyle.Heavy };
    await H.impact({ style: map[style] });
  } catch { /* ignore */ }
}

export function onPlayerHitDealt(): void {
  if (!getBattleHapticSettings().recoilEnabled) return;
  void pulse("Light");
}

export function onPlayerHitReceived(): void {
  if (!getBattleHapticSettings().recoilEnabled) return;
  void pulse("Medium");
}

export function onPlayerDeath(): void {
  if (!getBattleHapticSettings().vibrationEnabled) return;
  void pulse("Heavy");
}
