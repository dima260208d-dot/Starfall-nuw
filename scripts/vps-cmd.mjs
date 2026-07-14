#!/usr/bin/env node
// Run an arbitrary command on the VPS over SSH.
// Usage: VPS_PASS='...' node scripts/vps-cmd.mjs "pm2 ls"
import { Client } from "ssh2";

const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const USER = process.env.VPS_USER ?? "root";
const PASS = process.env.VPS_PASS;
const CMD = process.argv.slice(2).join(" ");

if (!PASS) { console.error("Set VPS_PASS"); process.exit(1); }
if (!CMD) { console.error("Provide a command"); process.exit(1); }

const conn = new Client();
conn
  .on("ready", () => {
    conn.exec(CMD, { pty: true }, (err, stream) => {
      if (err) { console.error(err); conn.end(); process.exit(1); }
      stream.on("data", (d) => process.stdout.write(d.toString()));
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      stream.on("close", (code) => { conn.end(); process.exit(code || 0); });
    });
  })
  .on("error", (e) => { console.error(e); process.exit(1); })
  .connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 30000 });
