/**
 * UDP snapshot broadcaster — port WS+1 per worker.
 */
import dgram from "node:dgram";
import { encodeState } from "../net/battleCodec.mjs";

export class UdpSnapshotHub {
  /** @type {import('node:dgram').Socket | null} */
  #socket = null;
  /** @type {Map<string, { host: string, port: number }>} */
  #routes = new Map();
  port = 0;

  async bind(port, host = "0.0.0.0") {
    if (this.#socket) return;
    this.port = port;
    this.#socket = dgram.createSocket("udp4");
    await new Promise((resolve, reject) => {
      this.#socket.once("error", reject);
      this.#socket.bind(port, host, resolve);
    });
    this.#socket.on("message", (msg, rinfo) => {
      if (msg.length < 4) return;
      const token = msg.toString("utf8", 0, Math.min(32, msg.length)).replace(/\0/g, "");
      if (token.length >= 8) {
        this.#routes.set(token, { host: rinfo.address, port: rinfo.port });
      }
    });
  }

  registerRoute(token, host, port) {
    this.#routes.set(token, { host, port });
  }

  /** @param {string} token */
  sendToSeat(token, stateBytes) {
    const route = this.#routes.get(token);
    if (!route || !this.#socket || !route.port) return false;
    try {
      this.#socket.send(stateBytes, route.port, route.host);
    } catch {
      return false;
    }
    return true;
  }

  /** Broadcast state to all registered seats */
  broadcastToRoom(seatTokens, stateBytes) {
    let n = 0;
    for (const token of seatTokens) {
      if (this.sendToSeat(token, stateBytes)) n += 1;
    }
    return n;
  }

  encodeAndSend(seatTokens, state) {
    const bytes = encodeState(state);
    this.broadcastToRoom(seatTokens, bytes);
    return bytes;
  }

  close() {
    this.#socket?.close();
    this.#socket = null;
    this.#routes.clear();
  }

  routeCount() {
    return this.#routes.size;
  }
}
