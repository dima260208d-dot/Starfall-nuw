// feedbackStore.mjs — player ↔ developer support threads (encrypted at rest).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { encryptJson, decryptJson } from "./crypto.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.CONFIG_DATA_DIR || resolve(__dir, "../data");
const FEEDBACK_PATH = resolve(DATA_DIR, "feedback.enc");

const MAX_THREADS = 400;
const MAX_MESSAGES = 100;

function pruneMessages(messages) {
  if (!Array.isArray(messages)) return [];
  if (messages.length <= MAX_MESSAGES) return messages;
  return messages.slice(-MAX_MESSAGES);
}

export function createFeedbackStore(encKeyHex) {
  mkdirSync(DATA_DIR, { recursive: true });

  let state = { threads: [] };

  function load() {
    try {
      const blob = JSON.parse(readFileSync(FEEDBACK_PATH, "utf8"));
      state = decryptJson(encKeyHex, blob);
      if (!Array.isArray(state.threads)) state = { threads: [] };
    } catch {
      state = { threads: [] };
    }
  }

  function persist() {
    writeFileSync(FEEDBACK_PATH, JSON.stringify(encryptJson(encKeyHex, state)));
  }

  load();

  return {
    listAll() {
      return [...state.threads].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    },

    listForUser(username) {
      const u = String(username ?? "").toLowerCase();
      return state.threads
        .filter((t) => String(t.username ?? "").toLowerCase() === u)
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    },

    getThread(id) {
      return state.threads.find((t) => t.id === id) ?? null;
    },

    upsertThread(thread) {
      const idx = state.threads.findIndex((t) => t.id === thread.id);
      thread.messages = pruneMessages(thread.messages);
      if (idx >= 0) state.threads[idx] = thread;
      else {
        state.threads.unshift(thread);
        if (state.threads.length > MAX_THREADS) state.threads.length = MAX_THREADS;
      }
      persist();
      return thread;
    },

    createThread({ id, username, category, subject, message }) {
      const stamp = Date.now();
      const thread = {
        id,
        username,
        category: category || "other",
        subject: String(subject ?? "").slice(0, 80) || "Без темы",
        messages: [message],
        updatedAt: stamp,
        readByDev: false,
      };
      return this.upsertThread(thread);
    },

    appendMessage(threadId, msg, opts = {}) {
      const thread = this.getThread(threadId);
      if (!thread) return null;
      thread.messages = pruneMessages([...(thread.messages ?? []), msg]);
      thread.updatedAt = Date.now();
      if (msg.from === "player") thread.readByDev = false;
      if (opts.markReadByDev) thread.readByDev = true;
      return this.upsertThread(thread);
    },

    markRead(threadId) {
      const thread = this.getThread(threadId);
      if (!thread) return null;
      thread.readByDev = true;
      return this.upsertThread(thread);
    },

    markAllRead() {
      for (const t of state.threads) t.readByDev = true;
      persist();
    },

    replaceAll(threads) {
      state.threads = Array.isArray(threads) ? threads.slice(0, MAX_THREADS) : [];
      for (const t of state.threads) {
        t.messages = pruneMessages(t.messages ?? []);
      }
      persist();
    },
  };
}

export { FEEDBACK_PATH, MAX_MESSAGES };
