import { getGameServerHttpUrl, getGameServerWsUrl, isGameServerConfigured } from "../../lib/runtimeConfig";
import { tryCloudTimeout } from "./cloudFetch";

export type PartyRoomPayload = Record<string, unknown>;

let ws: WebSocket | null = null;
let wsRoom: string | null = null;
let wsHandlers = new Set<(room: PartyRoomPayload) => void>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const PARTY_FETCH_TIMEOUT_MS = 25_000;
const PARTY_WAKE_TIMEOUT_MS = 60_000;
const PARTY_PUSH_RETRIES = 3;
const PARTY_FETCH_RETRIES = 4;

function httpBase(): string | null {
  return getGameServerHttpUrl();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isOnlinePartySyncEnabled(): boolean {
  return isGameServerConfigured();
}

/** Разбудить Render free tier (до ~60 сек на холодный старт). */
export async function wakePartyServer(maxWaitMs = PARTY_WAKE_TIMEOUT_MS): Promise<boolean> {
  const base = httpBase();
  if (!base) return false;

  const started = Date.now();
  let attempt = 0;
  while (Date.now() - started < maxWaitMs) {
    attempt++;
    const probe = await tryCloudTimeout(
      fetch(`${base}/health`, { cache: "no-store" }).then(async (res) => {
        if (!res.ok) throw new Error(`health ${res.status}`);
        return res.json();
      }),
      Math.min(20_000, maxWaitMs - (Date.now() - started)),
      "party-wake",
    );
    if (probe.ok) {
      if (attempt > 1) {
        console.info(`[party] server awake after ${attempt} attempt(s)`);
      }
      return true;
    }
    await sleep(Math.min(2500 + attempt * 500, 6000));
  }
  return false;
}

export async function fetchPartyRoomFromServer(code: string): Promise<PartyRoomPayload | null> {
  const base = httpBase();
  if (!base || !code) return null;

  for (let i = 0; i < PARTY_FETCH_RETRIES; i++) {
    if (i > 0) await sleep(1200 + i * 800);

    const result = await tryCloudTimeout(
      fetch(`${base}/api/party/${encodeURIComponent(code.toUpperCase())}`, {
        cache: "no-store",
      }).then(async (res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`party GET ${res.status}`);
        const data = (await res.json()) as { room?: PartyRoomPayload };
        return data.room ?? null;
      }),
      PARTY_FETCH_TIMEOUT_MS,
      "party-fetch",
    );

    if (result.ok) return result.value;
  }
  return null;
}

export async function pushPartyRoomToServer(code: string, room: PartyRoomPayload): Promise<boolean> {
  const base = httpBase();
  if (!base || !code) return false;

  for (let i = 0; i < PARTY_PUSH_RETRIES; i++) {
    if (i > 0) {
      await wakePartyServer(30_000);
      await sleep(800);
    }

    const result = await tryCloudTimeout(
      fetch(`${base}/api/party/${encodeURIComponent(code.toUpperCase())}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room }),
      }).then((res) => {
        if (!res.ok) throw new Error(`party PUT ${res.status}`);
        return true;
      }),
      PARTY_FETCH_TIMEOUT_MS,
      "party-push",
    );

    if (result.ok) return true;
  }
  return false;
}

export async function deletePartyRoomOnServer(code: string): Promise<void> {
  const base = httpBase();
  if (!base || !code) return;
  try {
    await tryCloudTimeout(
      fetch(`${base}/api/party/${encodeURIComponent(code.toUpperCase())}`, { method: "DELETE" }),
      PARTY_FETCH_TIMEOUT_MS,
      "party-delete",
    );
  } catch {
    /* ignore */
  }
}

export function subscribePartyRoomOnServer(
  code: string,
  onUpdate: (room: PartyRoomPayload) => void,
): () => void {
  if (!isGameServerConfigured()) return () => {};

  wsHandlers.add(onUpdate);
  connectPartyWs(code.toUpperCase());

  return () => {
    wsHandlers.delete(onUpdate);
    if (wsHandlers.size === 0) {
      disconnectPartyWs();
    }
  };
}

function connectPartyWs(code: string): void {
  const wsUrl = getGameServerWsUrl();
  if (!wsUrl) return;

  if (ws && wsRoom === code && ws.readyState === WebSocket.OPEN) return;

  disconnectPartyWs();
  wsRoom = code;

  try {
    const url = new URL(wsUrl);
    url.searchParams.set("room", `party:${code}`);
    ws = new WebSocket(url.toString());

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type?: string; room?: PartyRoomPayload };
        if (msg.type === "party:update" && msg.room) {
          for (const h of wsHandlers) h(msg.room);
        }
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      if (wsHandlers.size === 0) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (wsRoom) connectPartyWs(wsRoom);
      }, 3000);
    };
  } catch {
    ws = null;
  }
}

function disconnectPartyWs(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  wsRoom = null;
}

/** Подтянуть комнату с сервера в локальный кэш. */
export async function hydratePartyFromServer(code: string): Promise<boolean> {
  await wakePartyServer(45_000);
  const room = await fetchPartyRoomFromServer(code);
  if (!room) return false;

  const PARTIES_KEY = "clash_parties_v1";
  try {
    const raw = localStorage.getItem(PARTIES_KEY);
    const all = raw ? JSON.parse(raw) as Record<string, PartyRoomPayload> : {};
    all[code.toUpperCase()] = room;
    localStorage.setItem(PARTIES_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event("clash_party_changed"));
    return true;
  } catch {
    return false;
  }
}
