/**
 * Biometric unlock for Starfall Admin (Android fingerprint / face).
 * Requests system permission on first use via Capacitor plugin.
 */
import { Capacitor } from "@capacitor/core";
import { getAdminSetting } from "../data/adminSettingsManifest";

export type BiometricStatus = {
  available: boolean;
  biometryType: "none" | "fingerprint" | "face" | "iris" | "multiple";
  reason?: string;
};

let permissionRequested = false;

async function loadBiometricPlugin() {
  try {
    const mod = await import("@aparajita/capacitor-biometric-auth");
    return mod.BiometricAuth;
  } catch {
    return null;
  }
}

export async function checkAdminBiometric(): Promise<BiometricStatus> {
  if (!Capacitor.isNativePlatform()) {
    return { available: false, biometryType: "none", reason: "web" };
  }
  const Bio = await loadBiometricPlugin();
  if (!Bio) return { available: false, biometryType: "none", reason: "plugin_missing" };

  try {
    const r = await Bio.checkBiometry();
    const raw = String(r.biometryType ?? "none");
    const type: BiometricStatus["biometryType"] =
      raw.includes("face") ? "face"
        : raw.includes("finger") ? "fingerprint"
          : raw.includes("iris") ? "iris"
            : raw.includes("multiple") ? "multiple"
              : "none";
    return {
      available: Boolean(r.isAvailable),
      biometryType: type,
      reason: r.reason ?? undefined,
    };
  } catch (e) {
    return {
      available: false,
      biometryType: "none",
      reason: e instanceof Error ? e.message : "check_failed",
    };
  }
}

/** Ask Android/iOS for biometric permission (first launch). */
export async function requestAdminBiometricPermission(): Promise<void> {
  if (permissionRequested) return;
  permissionRequested = true;
  if (!getAdminSetting<boolean>("sec.biometric_enabled", true)) return;
  await checkAdminBiometric();
}

export async function authenticateAdminBiometric(reason = "Подтвердите вход в Starfall Admin"): Promise<boolean> {
  if (!getAdminSetting<boolean>("sec.biometric_enabled", true)) return true;
  if (!Capacitor.isNativePlatform()) return true;

  const status = await checkAdminBiometric();
  if (!status.available) return !getAdminSetting<boolean>("sec.biometric_required", false);

  const allowFp = getAdminSetting<boolean>("sec.biometric_fingerprint", true);
  const allowFace = getAdminSetting<boolean>("sec.biometric_face", true);
  if (status.biometryType === "fingerprint" && !allowFp) return true;
  if (status.biometryType === "face" && !allowFace) return true;

  const Bio = await loadBiometricPlugin();
  if (!Bio) return !getAdminSetting<boolean>("sec.biometric_required", false);

  try {
    await Bio.authenticate({
      reason,
      cancelTitle: "Отмена",
      allowDeviceCredential: true,
      iosFallbackTitle: "Использовать пароль устройства",
      androidTitle: "Starfall Admin",
      androidSubtitle: reason,
    });
    return true;
  } catch {
    return false;
  }
}

export function isBiometricRequiredAfterLogin(): boolean {
  return getAdminSetting<boolean>("sec.biometric_required", false)
    && getAdminSetting<boolean>("sec.biometric_enabled", true);
}
