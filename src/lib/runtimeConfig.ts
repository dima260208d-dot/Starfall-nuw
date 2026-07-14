/**
 * Единая runtime-конфигурация: build-time env + public/cloud-config.json
 */
import { applySupabaseRuntimeConfig, isSupabaseConfigured } from "./supabase";
import { fetchJsonWithDiskCache } from "../utils/assetDiskCache";

export type CloudRuntimeConfig = {
  url?: string;
  anonKey?: string;
  gameServerUrl?: string;
  gameServerWsUrl?: string;
  edgeServerUrl?: string;
  assetCdnUrl?: string;
  battleMatchmakerUrl?: string;
  battleWsBase?: string;
  configServerUrl?: string;
  configServerWsUrl?: string;
  configPublicKey?: string;
  clubsUrl?: string;
  updatedAt?: string;
};

let runtime: CloudRuntimeConfig = {};
let loaded = false;

function resolveWsUrl(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) return httpUrl.replace(/^https:/, "wss:") + "/ws";
  if (httpUrl.startsWith("http://")) return httpUrl.replace(/^http:/, "ws:") + "/ws";
  return httpUrl;
}

export function getRuntimeConfig(): CloudRuntimeConfig {
  return runtime;
}

export function getGameServerHttpUrl(): string | null {
  const fromEnv = import.meta.env?.VITE_GAME_SERVER_URL as string | undefined;
  const url = fromEnv || runtime.gameServerUrl;
  if (!url) return null;
  return url.replace(/\/$/, "");
}

export function getGameServerWsUrl(): string | null {
  const fromEnv = import.meta.env?.VITE_GAME_SERVER_WS_URL as string | undefined;
  if (fromEnv) return fromEnv;
  if (runtime.gameServerWsUrl) return runtime.gameServerWsUrl;
  const http = getGameServerHttpUrl();
  return http ? resolveWsUrl(http) : null;
}

export function getEdgeServerHttpUrl(): string | null {
  const fromEnv = import.meta.env?.VITE_EDGE_SERVER_URL as string | undefined;
  const url = fromEnv || runtime.edgeServerUrl;
  if (!url) return null;
  return url.replace(/\/$/, "");
}

export function getAssetCdnUrl(): string | null {
  const fromEnv = import.meta.env?.VITE_ASSET_CDN_URL as string | undefined;
  const url = fromEnv || runtime.assetCdnUrl;
  if (!url) return null;
  return url.replace(/\/?$/, "/");
}

/** WebSocket для синхронизации боёв (Koyeb edge). */
export function getBattleWsUrl(): string | null {
  const edge = getEdgeServerHttpUrl();
  if (!edge) return null;
  const wsBase = edge.startsWith("https://")
    ? edge.replace(/^https:/, "wss:")
    : edge.replace(/^http:/, "ws:");
  return `${wsBase}/ws/battle`;
}

/** Authoritative battle matchmaker base URL (e.g. http://host/mm). */
export function getBattleMatchmakerUrl(): string | null {
  const fromEnv = import.meta.env?.VITE_BATTLE_MM_URL as string | undefined;
  const url = fromEnv || runtime.battleMatchmakerUrl;
  if (url) return url.replace(/\/$/, "");
  // Fall back to <gameServer>/mm when matchmaker shares the host.
  const game = getGameServerHttpUrl();
  return game ? `${game}/mm` : null;
}

/** WebSocket base for battle workers (e.g. ws://host). The matchmaker returns the path. */
export function getBattleWsBase(): string | null {
  const fromEnv = import.meta.env?.VITE_BATTLE_WS_BASE as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (runtime.battleWsBase) return runtime.battleWsBase.replace(/\/$/, "");
  const game = getGameServerHttpUrl();
  if (!game) return null;
  return game.startsWith("https://") ? game.replace(/^https:/, "wss:") : game.replace(/^http:/, "ws:");
}

export function isOnlineBattleConfigured(): boolean {
  return Boolean(getBattleMatchmakerUrl() && getBattleWsBase());
}

/** UDP snapshot host — same machine as matchmaker. */
export function getBattleUdpHost(): string | null {
  const mm = getBattleMatchmakerUrl();
  if (!mm) return null;
  try {
    return new URL(mm).hostname;
  } catch {
    return null;
  }
}

/** Live-ops config service (replaces the in-game admin panel). HTTP base, e.g. http://host/cfg. */
export function getConfigServerUrl(): string | null {
  const fromEnv = import.meta.env?.VITE_CONFIG_SERVER_URL as string | undefined;
  const url = fromEnv || runtime.configServerUrl;
  return url ? url.replace(/\/$/, "") : null;
}

export function getConfigServerWsUrl(): string | null {
  const fromEnv = import.meta.env?.VITE_CONFIG_SERVER_WS_URL as string | undefined;
  if (fromEnv) return fromEnv;
  if (runtime.configServerWsUrl) return runtime.configServerWsUrl;
  const http = getConfigServerUrl();
  if (!http) return null;
  const ws = http.startsWith("https://") ? http.replace(/^https:/, "wss:") : http.replace(/^http:/, "ws:");
  return `${ws}/config/live`;
}

/** Ed25519 public key (SPKI PEM) used to verify signed published config. */
export function getConfigPublicKey(): string | null {
  const fromEnv = import.meta.env?.VITE_CONFIG_PUBLIC_KEY as string | undefined;
  const pem = (fromEnv || runtime.configPublicKey || "").replace(/\\n/g, "\n");
  return pem || null;
}

export function isConfigServerConfigured(): boolean {
  return Boolean(getConfigServerUrl());
}

/** Clubs service on Cloudflare (Workers + D1). */
export function getClubsServerUrl(): string | null {
  const fromEnv = import.meta.env?.VITE_CLUBS_URL as string | undefined;
  const url = fromEnv || runtime.clubsUrl;
  return url ? url.replace(/\/$/, "") : null;
}

export function isClubsServerConfigured(): boolean {
  return Boolean(getClubsServerUrl());
}

export function isEdgeServerConfigured(): boolean {
  return Boolean(getEdgeServerHttpUrl());
}

export function isGameServerConfigured(): boolean {
  return Boolean(getGameServerHttpUrl());
}

export async function loadCloudRuntimeConfig(): Promise<boolean> {
  if (loaded) return isSupabaseConfigured() || isGameServerConfigured();
  loaded = true;

  try {
    const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");
    const configUrl = `${base}cloud-config.json`;
    const data = await fetchJsonWithDiskCache<CloudRuntimeConfig>(configUrl, () =>
      fetch(configUrl, { cache: "no-cache" }),
    );
    if (data && typeof data === "object") {
      runtime = data;

      if (!isSupabaseConfigured() && data.url && data.anonKey && data.url.includes("supabase.co")) {
        applySupabaseRuntimeConfig(data.url, data.anonKey);
      }

      if (data.gameServerUrl || data.gameServerWsUrl) {
        console.info("[runtime] game server:", data.gameServerUrl ?? data.gameServerWsUrl);
      }
      if (data.edgeServerUrl) {
        console.info("[runtime] edge (Koyeb+R2):", data.edgeServerUrl);
      }
      if (data.assetCdnUrl) {
        console.info("[runtime] asset CDN (R2 direct):", data.assetCdnUrl);
      }
    }
  } catch {
    /* offline / no file */
  }

  return isSupabaseConfigured() || isGameServerConfigured();
}
