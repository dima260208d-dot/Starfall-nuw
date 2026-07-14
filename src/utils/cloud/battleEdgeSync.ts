import { getBattleWsUrl, isEdgeServerConfigured } from "../../lib/runtimeConfig";

export type BattleRelayMessage = Record<string, unknown>;

let ws: WebSocket | null = null;
let roomId: string | null = null;
let handlers = new Set<(msg: BattleRelayMessage) => void>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function isBattleEdgeEnabled(): boolean {
  return isEdgeServerConfigured();
}

export function connectBattleRelay(battleRoom: string, onMessage: (msg: BattleRelayMessage) => void): () => void {
  if (!isEdgeServerConfigured()) return () => {};

  handlers.add(onMessage);
  openBattleWs(battleRoom);

  return () => {
    handlers.delete(onMessage);
    if (handlers.size === 0) closeBattleWs();
  };
}

function openBattleWs(room: string): void {
  const wsUrl = getBattleWsUrl();
  if (!wsUrl) return;

  if (ws && roomId === room && ws.readyState === WebSocket.OPEN) return;

  closeBattleWs();
  roomId = room;

  try {
    const url = new URL(wsUrl);
    url.searchParams.set("room", room);
    ws = new WebSocket(url.toString());

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as BattleRelayMessage;
        if (msg.type === "welcome" || msg.type === "pong") return;
        for (const h of handlers) h(msg);
      } catch {
        /* ignore */
      }
    };

    ws.onclose = () => {
      if (handlers.size === 0) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        if (roomId) openBattleWs(roomId);
      }, 3000);
    };
  } catch {
    ws = null;
  }
}

export function sendBattleRelay(msg: BattleRelayMessage): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(msg));
}

function closeBattleWs(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  roomId = null;
}
