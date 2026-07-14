# Starfall config-server (live-ops backend)

Authoritative live-ops config service. The **external admin panel** (`../admin-panel`)
writes drafts and publishes here. The game client and every game server read the
**Ed25519-signed** published config and receive **instant pushes** over WebSocket.
This replaces the old in-game admin panel — no admin code or credentials ship in the game anymore.

## Why it's safe
- Admin password is never stored — only its scrypt hash (`ADMIN_PASSWORD_HASH`).
- Admin sessions are short-lived HMAC tokens.
- Published config is **Ed25519-signed**; clients/servers reject any tampered config.
- Unpublished drafts are **AES-256-GCM encrypted at rest** (`drafts.enc`).
- Brute-force throttling on `/admin/login`; admin origin is restricted (`ADMIN_ORIGIN`).

## Setup
```bash
npm install
npm run gen-keys "your-strong-admin-password"   # prints all secrets, paste into env
```
Put the printed values in your process env (or a `.env` loaded by your runner), then:
```bash
npm start            # listens on :8095
npm test             # end-to-end security test
```

`VITE_CONFIG_PUBLIC_KEY` (also printed) goes into the **game** `.env.local` /
`public/cloud-config.json` so the client can verify config signatures.

## Endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET  | `/config/public` | none | signed `{ config, signature }` for game + servers |
| GET  | `/config/pubkey` | none | Ed25519 public key (PEM) |
| WS   | `/config/live`   | none | push `{ type:"config", config, signature }` on publish |
| POST | `/admin/login`   | password | issues session token |
| GET  | `/admin/state`   | token | `{ published, drafts }` editor view |
| POST | `/admin/draft`   | token | `{ domain, value }` save pending edit |
| POST | `/admin/discard` | token | `{ domain }` drop a draft |
| POST | `/admin/publish` | token | `{ domains? }` go live + push + fan-out |

## Fan-out to other servers
Set `PUSH_TARGETS` to a comma-separated list of server endpoints (e.g. the
battle-server's `/internal/config`). On every publish, the signed config is POSTed
there with `x-internal-key: INTERNAL_KEY` so all servers update immediately.
