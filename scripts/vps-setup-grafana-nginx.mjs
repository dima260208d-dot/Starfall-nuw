#!/usr/bin/env node
/**
 * Expose Grafana + Prometheus via nginx (/grafana/, /prometheus/) with basic auth.
 * Usage: VPS_PASS='...' GRAFANA_NGINX_PASS='...' node scripts/vps-setup-grafana-nginx.mjs
 */
import { Client } from "ssh2";
import { buildBattleNginxConf, WORKER_BASE_PORT } from "./vps-nginx-conf.mjs";

const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const USER = process.env.VPS_USER ?? "root";
const PASS = process.env.VPS_PASS;
const BATTLE_WORKERS = Number(process.env.BATTLE_WORKERS || 12);
const GRAFANA_USER = process.env.GRAFANA_NGINX_USER || "starfall";
const GRAFANA_PASS = process.env.GRAFANA_NGINX_PASS || "starfall-metrics-2026";
const PUBLIC_HOST = process.env.VPS_HOST ?? "217.60.245.116";

if (!PASS) {
  console.error("Set VPS_PASS");
  process.exit(1);
}

function connectOnce() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on("ready", () => resolve(conn)).on("error", reject).connect({
      host: HOST,
      port: Number(process.env.VPS_PORT || 22),
      username: USER,
      password: PASS,
      readyTimeout: 180_000,
    });
  });
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = "";
      stream.on("data", (d) => { const s = d.toString(); out += s; process.stdout.write(s); });
      stream.stderr.on("data", (d) => process.stderr.write(d.toString()));
      stream.on("close", (code) => {
        if (code !== 0) reject(new Error(`exit ${code}: ${out.slice(-400)}`));
        else resolve(out);
      });
    });
  });
}

const nginxConf = buildBattleNginxConf(BATTLE_WORKERS, WORKER_BASE_PORT, {
  monitoring: true,
  publicHost: PUBLIC_HOST,
});

const REMOTE_CMD = `set -e
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq apache2-utils 2>/dev/null || true
htpasswd -bc /etc/nginx/.htpasswd-starfall '${GRAFANA_USER}' '${GRAFANA_PASS}'

# Grafana subpath behind nginx
if grep -q '^\\[server\\]' /etc/grafana/grafana.ini; then
  grep -q '^root_url' /etc/grafana/grafana.ini && \\
    sed -i 's|^root_url.*|root_url = http://${PUBLIC_HOST}/grafana/|' /etc/grafana/grafana.ini || \\
    sed -i '/^\\[server\\]/a root_url = http://${PUBLIC_HOST}/grafana/' /etc/grafana/grafana.ini
  grep -q '^serve_from_sub_path' /etc/grafana/grafana.ini && \\
    sed -i 's|^serve_from_sub_path.*|serve_from_sub_path = true|' /etc/grafana/grafana.ini || \\
    sed -i '/^\\[server\\]/a serve_from_sub_path = true' /etc/grafana/grafana.ini
  grep -q '^domain' /etc/grafana/grafana.ini && \\
    sed -i 's|^domain.*|domain = ${PUBLIC_HOST}|' /etc/grafana/grafana.ini || true
fi

systemctl restart grafana-server 2>/dev/null || true
nginx -t
systemctl reload nginx
sleep 2
curl -sf -u '${GRAFANA_USER}:${GRAFANA_PASS}' -o /dev/null -w 'grafana_http=%{http_code}\\n' http://127.0.0.1/grafana/api/health
curl -sf -u '${GRAFANA_USER}:${GRAFANA_PASS}' -o /dev/null -w 'prom_http=%{http_code}\\n' http://127.0.0.1/prometheus/-/healthy
echo GRAFANA_NGINX_OK
`;

try {
  const conn = await connectOnce();
  console.log("==> upload nginx config with /grafana/ + /prometheus/");
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.writeFile("/etc/nginx/sites-available/starfall", Buffer.from(nginxConf), { mode: 0o644 }, (e) => {
        if (e) reject(e);
        else resolve();
      });
    });
  });
  console.log("\n==> htpasswd + grafana subpath + reload nginx");
  await exec(conn, REMOTE_CMD);
  console.log(`\n✅ Grafana: http://${PUBLIC_HOST}/grafana/  user=${GRAFANA_USER}`);
  conn.end();
} catch (e) {
  console.error("\n❌", e.message);
  process.exit(1);
}
