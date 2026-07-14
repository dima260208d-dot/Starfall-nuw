#!/usr/bin/env node
/**
 * Install Prometheus + Grafana on VPS (Debian apt) and open UDP snapshot ports.
 * Usage: VPS_PASS='...' node scripts/vps-setup-monitoring.mjs
 */
import { Client } from "ssh2";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.VPS_HOST ?? "217.60.245.116";
const USER = process.env.VPS_USER ?? "root";
const PASS = process.env.VPS_PASS;
const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const REMOTE = "/opt/starfall";

const OPS_FILES = [
  "battle-server/ops/prometheus-debian.yml",
  "battle-server/ops/prometheus.yml",
  "battle-server/ops/grafana-dashboard.json",
];

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

async function upload(conn) {
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      (async () => {
        const mkdir = (p) => new Promise((res, rej) => {
          sftp.mkdir(p, { mode: 0o755 }, (e) => {
            if (e && e.code !== 4) return rej(e);
            res();
          });
        });
        await mkdir(`${REMOTE}/battle-server/ops`);
        await mkdir(`${REMOTE}/battle-server/ops/grafana-dashboards`);
        for (const rel of OPS_FILES) {
          const local = join(ROOT, rel);
          const remote = `${REMOTE}/${rel.replace(/\\/g, "/")}`;
          await new Promise((res, rej) => {
            sftp.writeFile(remote, readFileSync(local), { mode: 0o644 }, (e) => (e ? rej(e) : res()));
          });
          console.log(`  uploaded ${rel}`);
        }
        resolve();
      })().catch(reject);
    });
  });
}

const REMOTE_CMD = `set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y prometheus wget gnupg 2>&1 | tail -8

if ! dpkg -s grafana >/dev/null 2>&1; then
  wget -q -O /usr/share/keyrings/grafana.gpg https://apt.grafana.com/gpg.key
  echo "deb [signed-by=/usr/share/keyrings/grafana.gpg] https://apt.grafana.com stable main" > /etc/apt/sources.list.d/grafana.list
  apt-get update -qq
  apt-get install -y grafana 2>&1 | tail -8
fi

mkdir -p /etc/prometheus
cp ${REMOTE}/battle-server/ops/prometheus-debian.yml /etc/prometheus/prometheus.yml
systemctl enable prometheus
systemctl restart prometheus

mkdir -p /etc/grafana/provisioning/datasources
mkdir -p /etc/grafana/provisioning/dashboards
mkdir -p ${REMOTE}/battle-server/ops/grafana-dashboards
cp ${REMOTE}/battle-server/ops/grafana-dashboard.json ${REMOTE}/battle-server/ops/grafana-dashboards/

cat > /etc/grafana/provisioning/datasources/prometheus.yml <<'DS'
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://127.0.0.1:9090
    isDefault: true
    uid: prometheus
DS

cat > /etc/grafana/provisioning/dashboards/starfall.yml <<'DB'
apiVersion: 1
providers:
  - name: starfall
    folder: Starfall
    type: file
    disableDeletion: false
    options:
      path: ${REMOTE}/battle-server/ops/grafana-dashboards
DB

grep -q '^http_addr' /etc/grafana/grafana.ini && \\
  sed -i 's/^;\\?http_addr = .*/http_addr = 127.0.0.1/' /etc/grafana/grafana.ini || \\
  echo 'http_addr = 127.0.0.1' >> /etc/grafana/grafana.ini

# Subpath for nginx reverse proxy (updated fully by vps-setup-grafana-nginx.mjs)
grep -q '^root_url' /etc/grafana/grafana.ini 2>/dev/null || \\
  sed -i '/^\\[server\\]/a root_url = http://217.60.245.116/grafana/' /etc/grafana/grafana.ini
grep -q '^serve_from_sub_path' /etc/grafana/grafana.ini 2>/dev/null || \\
  sed -i '/^\\[server\\]/a serve_from_sub_path = true' /etc/grafana/grafana.ini

systemctl enable grafana-server
systemctl restart grafana-server

ufw allow 9101:9112/udp comment 'starfall battle udp' 2>/dev/null || true

sleep 2
curl -sf http://127.0.0.1:9090/-/healthy && echo prometheus_ok
curl -sf http://127.0.0.1:3000/api/health && echo grafana_ok
echo MONITORING_OK
`;

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

try {
  const conn = await connectOnce();
  console.log("==> upload ops files");
  await upload(conn);
  console.log("\n==> install prometheus + grafana");
  await exec(conn, REMOTE_CMD);
  console.log("\n✅ Monitoring ready");
  console.log("   Grafana: ssh -L 3000:127.0.0.1:3000 root@" + HOST + "  →  http://localhost:3000 (admin/admin)");
  console.log("   Prometheus: ssh -L 9090:127.0.0.1:9090 root@" + HOST);
  conn.end();
} catch (e) {
  console.error("\n❌", e.message);
  process.exit(1);
}
