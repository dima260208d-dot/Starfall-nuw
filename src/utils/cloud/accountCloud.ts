import { isSupabaseConfigured } from "../../lib/supabase";
import { getBattleMatchmakerUrl } from "../../lib/runtimeConfig";
import {
  getCurrentProfile,
  getCurrentUsername,
  hashAccountPassword,
  isGuestProfile,
} from "../localStorageAPI";
import { normalizePlayerIdQuery } from "../playerId";

export type CloudAccountRow = {
  player_id: string;
  username: string;
  email: string | null;
  password_hash: string;
  account_blocked: boolean;
  updated_at: string;
};

// Non-secret account view returned by the server gateway (no password hash).
type PublicAccount = { playerId: string; username: string; email: string | null; accountBlocked: boolean };

let accountPushTimer: ReturnType<typeof setTimeout> | null = null;
let accountPushInFlight: Promise<boolean> | null = null;
let lastAccountError: string | null = null;

export function getAccountCloudLastError(): string | null {
  return lastAccountError;
}

// All account reads/writes go through the server gateway (service role). The
// player_accounts table is locked to anon, so password hashes never reach the
// client and nobody can forge or overwrite accounts with the shipped anon key.
async function authPost(path: string, body: Record<string, unknown>): Promise<any> {
  const mm = getBattleMatchmakerUrl();
  if (!mm) { lastAccountError = "Matchmaker URL not configured"; return { ok: false, error: lastAccountError }; }
  try {
    const r = await fetch(`${mm}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { lastAccountError = j?.error || `HTTP ${r.status}`; return { ok: false, error: lastAccountError, ...j }; }
    return j;
  } catch (e) {
    lastAccountError = e instanceof Error ? e.message : "request failed";
    return { ok: false, error: lastAccountError };
  }
}

function publicToRow(a: PublicAccount): CloudAccountRow {
  return {
    player_id: a.playerId,
    username: a.username,
    email: a.email ?? null,
    password_hash: "", // never exposed by the gateway
    account_blocked: !!a.accountBlocked,
    updated_at: "",
  };
}

/** Server-verified login. Password is checked on the server; no hash returned. */
export async function loginViaGateway(
  login: string,
  secret: string,
): Promise<{ ok: boolean; account?: PublicAccount; code?: string; error?: string }> {
  const res = await authPost("/auth/login", { login: normalizeLoginText(login), secret });
  if (res.ok && res.account) return { ok: true, account: res.account as PublicAccount };
  return { ok: false, code: res.code, error: res.error };
}

function normalizeLoginText(value: string): string {
  return value.trim().normalize("NFC");
}

function normalizeEmail(email: string | undefined | null): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  return trimmed && trimmed.includes("@") ? trimmed : null;
}

// All "fetch account" helpers now resolve through the server gateway, which
// returns only non-secret fields (no password_hash). Callers that previously
// compared hashes must use loginViaGateway instead.
export async function fetchAccountByLogin(login: string): Promise<CloudAccountRow | null> {
  const trimmed = normalizeLoginText(login);
  if (!trimmed) return null;
  if (!isSupabaseConfigured()) { lastAccountError = "Supabase not configured"; return null; }
  const res = await authPost("/auth/lookup", { login: trimmed });
  if (res.ok && res.account) return publicToRow(res.account as PublicAccount);
  return null;
}

export async function fetchAccountByUsername(username: string): Promise<CloudAccountRow | null> {
  return fetchAccountByLogin(username);
}

export async function fetchAccountByEmail(email: string): Promise<CloudAccountRow | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return fetchAccountByLogin(normalized);
}

export async function fetchAccountByPlayerId(playerId: string): Promise<CloudAccountRow | null> {
  return fetchAccountByLogin(normalizePlayerIdQuery(playerId));
}

export async function isUsernameTakenInCloud(username: string, exceptPlayerId?: string): Promise<boolean> {
  const res = await authPost("/auth/check", { username, exceptPlayerId });
  return res.ok ? !!res.usernameTaken : false;
}

export async function isEmailTakenInCloud(email: string, exceptPlayerId?: string): Promise<boolean> {
  const res = await authPost("/auth/check", { email, exceptPlayerId });
  return res.ok ? !!res.emailTaken : false;
}

// Ownership-verified metadata sync (username/email/blocked). The server requires
// the matching account secret; password changes go through updateAccountPasswordInCloud.
export async function upsertAccountToCloud(input: {
  playerId: string;
  username: string;
  email?: string | null;
  passwordHash: string;
  accountBlocked?: boolean;
}): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    lastAccountError = "Supabase not configured";
    return false;
  }
  const playerId = normalizePlayerIdQuery(input.playerId);
  const res = await authPost("/auth/sync", {
    playerId,
    username: input.username.trim(),
    email: input.email === undefined ? undefined : normalizeEmail(input.email),
    secret: input.passwordHash,
    accountBlocked: input.accountBlocked ?? false,
  });
  if (res.ok) {
    lastAccountError = null;
    return true;
  }
  lastAccountError = res.error || res.code || "account sync failed";
  console.error("[accountCloud] sync failed:", lastAccountError);
  return false;
}

export function scheduleAccountCloudPush(): void {
  if (!isSupabaseConfigured()) return;
  const profile = getCurrentProfile();
  if (!profile?.playerId || isGuestProfile(profile)) return;

  if (accountPushTimer) clearTimeout(accountPushTimer);
  accountPushTimer = setTimeout(() => {
    accountPushTimer = null;
    void syncCurrentAccountToCloud();
  }, 600);
}

export async function syncCurrentAccountToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  if (accountPushInFlight) return accountPushInFlight;

  const username = getCurrentUsername();
  const profile = getCurrentProfile();
  if (!username || !profile?.playerId || isGuestProfile(profile)) return false;
  if (!profile.passwordHash) return false;

  accountPushInFlight = (async () => {
    return upsertAccountToCloud({
      playerId: profile.playerId!,
      username,
      email: profile.email,
      passwordHash: profile.passwordHash,
      accountBlocked: profile.accountBlocked ?? false,
    });
  })().finally(() => {
    accountPushInFlight = null;
  });

  return accountPushInFlight;
}

export async function registerAccountInCloud(input: {
  playerId: string;
  username: string;
  email: string;
  passwordHash: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: "Облако не настроено — перезапустите npm run dev" };
  }

  const email = normalizeEmail(input.email);
  if (!email) {
    return { success: false, error: "Укажите корректный e-mail" };
  }

  // The server checks uniqueness + creates the row atomically (service role).
  const res = await authPost("/auth/register", {
    playerId: normalizePlayerIdQuery(input.playerId),
    username: input.username.trim(),
    email,
    secret: input.passwordHash,
  });
  if (res.ok) return { success: true };
  return { success: false, error: res.error ?? "Не удалось сохранить аккаунт в облаке" };
}

export async function updateAccountEmailInCloud(
  playerId: string,
  email: string,
): Promise<{ success: boolean; error?: string }> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { success: false, error: "Invalid email" };
  }
  if (await isEmailTakenInCloud(normalized, playerId)) {
    return { success: false, error: "Этот e-mail уже привязан к другому аккаунту" };
  }

  const profile = getCurrentProfile();
  if (!profile?.passwordHash) {
    return { success: false, error: "Not logged in" };
  }

  const ok = await upsertAccountToCloud({
    playerId,
    username: getCurrentUsername() ?? profile.username,
    email: normalized,
    passwordHash: profile.passwordHash,
    accountBlocked: profile.accountBlocked,
  });

  return ok
    ? { success: true }
    : { success: false, error: lastAccountError ?? "Cloud update failed" };
}

export async function updateAccountPasswordInCloud(
  playerId: string,
  oldPasswordHash: string,
  newPasswordHash: string,
): Promise<boolean> {
  const res = await authPost("/auth/password", {
    playerId: normalizePlayerIdQuery(playerId),
    secret: oldPasswordHash,
    newSecret: newPasswordHash,
  });
  if (res.ok) return true;
  lastAccountError = res.error || res.code || "password update failed";
  return false;
}

export async function changeAccountEmailCloud(newEmail: string): Promise<{ success: boolean; error?: string }> {
  const profile = getCurrentProfile();
  const username = getCurrentUsername();
  if (!username || !profile?.playerId || isGuestProfile(profile)) {
    return { success: false, error: "Register the account first" };
  }

  const email = newEmail.trim();
  if (!email.includes("@")) {
    return { success: false, error: "Invalid email" };
  }

  if (isSupabaseConfigured()) {
    if (await isEmailTakenInCloud(email, profile.playerId)) {
      return { success: false, error: "Этот e-mail уже привязан к другому аккаунту" };
    }
  }

  const { changeAccountEmail } = await import("../localStorageAPI");
  const local = changeAccountEmail(email);
  if (!local.success) return local;

  await syncCurrentAccountToCloud();
  return { success: true };
}

export async function changeAccountPasswordCloud(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  const profile = getCurrentProfile();
  if (!profile?.playerId || isGuestProfile(profile)) {
    return { success: false, error: "Guest accounts have no password" };
  }

  if (!verifyAccountPassword(currentPassword, profile.passwordHash)) {
    return { success: false, error: "Wrong password" };
  }
  if (!newPassword || newPassword.length < 3) {
    return { success: false, error: "Password must be at least 3 characters" };
  }

  const oldHash = hashAccountPassword(currentPassword);
  const { changeAccountPassword } = await import("../localStorageAPI");
  const local = changeAccountPassword(currentPassword, newPassword);
  if (!local.success) return local;

  await updateAccountPasswordInCloud(profile.playerId, oldHash, hashAccountPassword(newPassword));
  return { success: true };
}

export function verifyAccountPassword(password: string, passwordHash: string): boolean {
  return hashAccountPassword(password) === passwordHash;
}

let accountCloudListenersInit = false;

export function initAccountCloudListeners(): void {
  if (typeof window === "undefined" || accountCloudListenersInit) return;
  accountCloudListenersInit = true;

  window.addEventListener("clash-profile-local-changed", () => {
    scheduleAccountCloudPush();
  });
}

if (typeof window !== "undefined") {
  queueMicrotask(() => initAccountCloudListeners());
}
