#!/bin/bash
set -e
cd /opt/starfall/battle-server
INTERNAL_KEY="${INTERNAL_KEY:-starfall-prod-internal-2026}"
for i in 1 2 3 4 5 6 7 8 9; do
  pm2 delete "starfall-w$i" 2>/dev/null || true
  PORT=$((8100 + i)) WORKER_ID="w$i" INTERNAL_KEY="$INTERNAL_KEY" MM_URL=http://127.0.0.1:8090 BIND_HOST=127.0.0.1 pm2 start src/worker.mjs --name "starfall-w$i" --node-args="--import tsx"
done
pm2 save
sleep 3
pm2 logs starfall-w1 --lines 8 --nostream 2>/dev/null | tail -6
