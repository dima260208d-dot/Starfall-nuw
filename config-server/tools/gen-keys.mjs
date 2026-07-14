// Generates every secret the config-server needs, writes config-server/.env, and
// prints the PUBLIC values the game needs.
//   node tools/gen-keys.mjs "<admin-password>"
import crypto from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword, generateSigningKeypair } from "../src/crypto.mjs";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node tools/gen-keys.mjs "<admin-password>"');
  process.exit(1);
}

const { publicKeyPem, privateKeyPem } = generateSigningKeypair();
const pwHash = hashPassword(password);
const sessionSecret = crypto.randomBytes(32).toString("hex");
const draftEncKey = crypto.randomBytes(32).toString("hex");
const internalKey = crypto.randomBytes(24).toString("hex");
const gateKey = crypto.randomBytes(32).toString("base64url"); // second-factor admin gate

const oneLine = (pem) => pem.replace(/\n/g, "\\n");

const envBody = [
  "# config-server secrets — KEEP PRIVATE, never commit",
  "PORT=8095",
  `ADMIN_PASSWORD_HASH=${pwHash}`,
  `SESSION_SECRET=${sessionSecret}`,
  `DRAFT_ENC_KEY=${draftEncKey}`,
  `INTERNAL_KEY=${internalKey}`,
  `ADMIN_GATE_KEY=${gateKey}`,
  `CONFIG_SIGN_PRIVATE_KEY=${oneLine(privateKeyPem)}`,
  "ADMIN_ORIGIN=*",
  "PUSH_TARGETS=",
  "",
].join("\n");

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env");
if (existsSync(envPath) && !process.argv.includes("--force")) {
  console.error(`Refusing to overwrite existing ${envPath} (pass --force to replace).`);
} else {
  writeFileSync(envPath, envBody);
  console.log(`Wrote ${envPath}`);
}

console.log("\n# ── GATE KEY (enter this in the admin panel's \"Ключ доступа\" field) ──");
console.log(gateKey);
console.log("\n# ── PUBLIC key — put in the game .env.local / cloud-config.json ──");
console.log(`VITE_CONFIG_PUBLIC_KEY=${oneLine(publicKeyPem)}`);
console.log("\n# (admin password is NEVER stored — only its scrypt hash in .env)\n");
