// ─────────────────────────────────────────────────────────────────────────────
// store.mjs — persistence for live-ops config.
//
//  published.json : the live, signed config the game/servers consume. Plain
//                   JSON (it's public anyway) but every fetch is Ed25519-signed.
//  drafts.enc     : pending/edited domains the admin hasn't published yet.
//                   AES-256-GCM encrypted at rest so the file is useless if stolen.
//
// Config is a flat map of domains → arbitrary JSON, mirroring the old admin tabs
// (balance, economy, chests, trophies, deals, news, mapSchedule, techBreak, …).
// Adding a new domain needs zero schema changes: just publish its key.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encryptJson, decryptJson } from "./crypto.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.CONFIG_DATA_DIR || resolve(__dir, "../data");
const PUBLISHED_PATH = resolve(DATA_DIR, "published.json");
const DRAFTS_PATH = resolve(DATA_DIR, "drafts.enc");

const EMPTY_PUBLISHED = { version: 0, updatedAt: 0, domains: {} };

export function createStore(encKeyHex) {
  mkdirSync(DATA_DIR, { recursive: true });

  let published = load(PUBLISHED_PATH, EMPTY_PUBLISHED);
  let drafts = loadDrafts();

  function load(path, fallback) {
    try { return JSON.parse(readFileSync(path, "utf8")); } catch { return structuredClone(fallback); }
  }
  function loadDrafts() {
    try {
      const blob = JSON.parse(readFileSync(DRAFTS_PATH, "utf8"));
      return decryptJson(encKeyHex, blob);
    } catch { return { domains: {}, meta: {} }; }
  }
  function persistPublished() {
    writeFileSync(PUBLISHED_PATH, JSON.stringify(published, null, 2));
  }
  function persistDrafts() {
    writeFileSync(DRAFTS_PATH, JSON.stringify(encryptJson(encKeyHex, drafts)));
  }

  return {
    getPublished() { return published; },
    getDrafts() { return drafts; },

    // Admin saves an in-progress edit for a domain (NOT live yet).
    saveDraft(domain, value, editor = "admin") {
      drafts.domains[domain] = value;
      drafts.meta[domain] = { editedAt: Date.now(), editor, pending: true };
      persistDrafts();
      return drafts.meta[domain];
    },

    discardDraft(domain) {
      delete drafts.domains[domain];
      delete drafts.meta[domain];
      persistDrafts();
    },

    // Promote one or more drafted domains into the live published config.
    publish(domains, editor = "admin") {
      const list = Array.isArray(domains) ? domains : Object.keys(drafts.domains);
      for (const d of list) {
        if (d in drafts.domains) {
          published.domains[d] = drafts.domains[d];
          delete drafts.domains[d];
          delete drafts.meta[d];
        }
      }
      published.version += 1;
      published.updatedAt = Date.now();
      published.publishedBy = editor;
      persistPublished();
      persistDrafts();
      return published;
    },

    // Publish a domain value directly (used by automated/server-side updates).
    publishDirect(domain, value, editor = "system") {
      published.domains[domain] = value;
      published.version += 1;
      published.updatedAt = Date.now();
      published.publishedBy = editor;
      persistPublished();
      return published;
    },
  };
}

export { DATA_DIR, PUBLISHED_PATH, DRAFTS_PATH };
