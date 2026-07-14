// PM2 ecosystem for the authoritative battle cluster.
// 1 matchmaker + N battle workers (one per CPU core). On the 12-vCPU VPS we run
// 12 workers — one dedicated battle process per virtual core. Override with BATTLE_WORKERS.
const WORKERS = Number(process.env.BATTLE_WORKERS || 12);
const BASE_PORT = Number(process.env.WORKER_BASE_PORT || 8101);
const INTERNAL_KEY = process.env.INTERNAL_KEY || "dev-internal-key";

const apps = [];
for (let i = 1; i <= WORKERS; i++) {
  apps.push({
    name: `starfall-w${i}`,
    cwd: __dirname,
    script: "src/worker.mjs",
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "400M",
    env: {
      PORT: String(BASE_PORT + i - 1),
      UDP_PORT: String(BASE_PORT + i - 1 + 1000),
      WORKER_ID: `w${i}`,
      INTERNAL_KEY,
      BIND_HOST: "127.0.0.1",
    },
  });
}
apps.push({
  name: "starfall-mm",
  cwd: __dirname,
  script: "src/matchmaker.mjs",
  instances: 1,
  exec_mode: "fork",
  env: {
    PORT: "8090",
    WORKER_COUNT: String(WORKERS),
    WORKER_BASE_PORT: String(BASE_PORT),
    INTERNAL_KEY,
    BIND_HOST: "127.0.0.1",
  },
});

module.exports = { apps };
