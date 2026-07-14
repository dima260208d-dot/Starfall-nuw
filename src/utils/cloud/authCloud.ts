import {
  createProfile,
  deleteLocalAccount,
  findLocalProfileKeyForCloudAccount,
  findProfileStorageKey,
  findProfileStorageKeyByEmail,
  getAllProfiles,
  hashAccountPassword,
  isGuestProfile,
  setCurrentUsername,
} from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";
import { isSupabaseConfigured, getSupabaseConfigHint } from "../../lib/supabase";
import {
  getAccountCloudLastError,
  loginViaGateway,
  registerAccountInCloud,
} from "./accountCloud";
import { restoreProfileFromCloudForLogin, syncProfileWithCloud, ensureAutoCloudSyncRunning } from "./profileCloud";

export type AuthCloudResult = {
  success: boolean;
  error?: string;
  source?: "local" | "cloud";
};

export async function registerAccountCloud(
  username: string,
  password: string,
  email: string,
): Promise<AuthCloudResult> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail.includes("@")) {
    return { success: false, error: "Укажите корректный e-mail" };
  }

  const local = createProfile(username.trim(), password, trimmedEmail);
  if (!local.success) {
    return { success: false, error: local.error };
  }

  const profile = getAllProfiles()[username.trim()];
  if (!profile?.playerId) {
    return { success: false, error: "Не удалось создать профиль" };
  }

  if (isSupabaseConfigured()) {
    const cloud = await registerAccountInCloud({
      playerId: profile.playerId,
      username: username.trim(),
      email: trimmedEmail,
      passwordHash: profile.passwordHash,
    });
    if (!cloud.success) {
      deleteLocalAccount(username.trim());
      return { success: false, error: cloud.error };
    }
    void syncProfileWithCloud().finally(() => ensureAutoCloudSyncRunning());
  }

  return { success: true, source: "local" };
}

export async function loginAccountCloud(
  login: string,
  password: string,
): Promise<AuthCloudResult> {
  const trimmed = login.trim();
  if (!trimmed || !password) {
    return { success: false, error: "Введите логин и пароль" };
  }

  const passHash = hashAccountPassword(password);
  const localKey =
    findProfileStorageKey(trimmed)
    ?? (trimmed.includes("@") ? findProfileStorageKeyByEmail(trimmed) : null);

  if (localKey) {
    const profile = getAllProfiles()[localKey];
    if (profile?.accountBlocked) {
      return { success: false, error: "Аккаунт заблокирован администратором" };
    }
    if (!isGuestProfile(profile) && profile.passwordHash === passHash) {
      setCurrentUsername(localKey);
      ensureAutoCloudSyncRunning();
      void syncProfileWithCloud();
      return { success: true, source: "local" };
    }
  }

  if (!isSupabaseConfigured()) {
    if (localKey) return { success: false, error: "Неверный пароль" };
    const hint = getSupabaseConfigHint();
    return {
      success: false,
      error: hint
        ? `Облако не подключено (${hint}). Перезапустите npm run dev и обновите Ctrl+F5.`
        : "Облако не подключено. Перезапустите npm run dev и обновите Ctrl+F5.",
    };
  }

  // Server verifies the password (hash never leaves the DB).
  const gate = await loginViaGateway(trimmed, passHash);
  if (!gate.ok) {
    if (gate.code === "blocked") {
      return { success: false, error: "Аккаунт заблокирован администратором" };
    }
    if (gate.code === "bad_password") {
      return { success: false, error: "Неверный пароль" };
    }
    if (gate.code === "not_found") {
      if (localKey) return { success: false, error: "Неверный пароль" };
      return { success: false, error: "Пользователь не найден. Попробуйте войти по e-mail или перезапустите игру (npm run dev)." };
    }
    if (localKey) return { success: false, error: "Неверный пароль" };
    const cloudErr = gate.error || getAccountCloudLastError();
    if (cloudErr?.includes("timeout") || cloudErr?.includes("fetch")) {
      return { success: false, error: "Сервер не ответил вовремя. Проверьте интернет и попробуйте снова." };
    }
    return { success: false, error: "Пользователь не найден. Попробуйте войти по e-mail или перезапустите игру (npm run dev)." };
  }

  const account = gate.account!;

  const linkedLocalKey = findLocalProfileKeyForCloudAccount({
    playerId: account.playerId,
    email: account.email,
    username: account.username,
  });

  if (linkedLocalKey) {
    const localProfile = getAllProfiles()[linkedLocalKey];
    if (localProfile && localProfile.passwordHash === passHash) {
      setCurrentUsername(linkedLocalKey);
      ensureAutoCloudSyncRunning();
      void syncProfileWithCloud();
      return { success: true, source: "local" };
    }
  }

  const restored = await restoreProfileFromCloudForLogin({
    playerId: normalizePlayerIdQuery(account.playerId),
    username: account.username,
    email: account.email,
    passwordHash: passHash,
  });

  if (!restored) {
    return { success: false, error: "Не удалось загрузить профиль из облака" };
  }

  ensureAutoCloudSyncRunning();
  void syncProfileWithCloud();
  return { success: true, source: "cloud" };
}

export async function upgradeGuestAccountCloud(
  username: string,
  password: string,
  email: string,
): Promise<AuthCloudResult> {
  const { upgradeGuestToRegistered } = await import("../localStorageAPI");
  const trimmedEmail = email.trim();
  if (!trimmedEmail.includes("@")) {
    return { success: false, error: "Укажите корректный e-mail" };
  }

  const result = upgradeGuestToRegistered(username, password, trimmedEmail);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const profile = getAllProfiles()[username.trim()];
  if (!profile?.playerId) {
    return { success: false, error: "Не удалось обновить профиль" };
  }

  if (isSupabaseConfigured()) {
    const cloud = await registerAccountInCloud({
      playerId: profile.playerId,
      username: username.trim(),
      email: trimmedEmail,
      passwordHash: profile.passwordHash,
    });
    if (!cloud.success) {
      return { success: false, error: cloud.error };
    }
    void syncProfileWithCloud().finally(() => ensureAutoCloudSyncRunning());
  }

  return { success: true };
}
