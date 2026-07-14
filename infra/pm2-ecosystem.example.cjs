/**
 * PM2 — раскладка под 12 vCore (черновик)
 * party: 1 процесс (лёгкий)
 * battle: N воркеров (когда будет Colyseus — по 1 vCPU на процесс)
 *
 * cp infra/pm2-ecosystem.example.cjs /opt/starfall/ecosystem.config.cjs
 * pm2 start ecosystem.config.cjs
 * pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "starfall-party",
      cwd: "/opt/starfall/server",
      script: "src/index.mjs",
      instances: 1,
      exec_mode: "fork",
      env: { PORT: 8080, NODE_ENV: "production" },
      max_memory_restart: "512M",
    },
    {
      name: "starfall-edge",
      cwd: "/opt/starfall/edge-server",
      script: "src/index.mjs",
      instances: 1,
      exec_mode: "fork",
      env: { PORT: 8081, NODE_ENV: "production" },
      max_memory_restart: "512M",
    },
    // Когда добавим Colyseus battle:
    // {
    //   name: "starfall-battle",
    //   cwd: "/opt/starfall/battle-server",
    //   script: "dist/index.js",
    //   instances: 8,
    //   exec_mode: "cluster",
    //   env: { PORT: 2567, REDIS_URL: "redis://127.0.0.1:6379" },
    // },
  ],
};
