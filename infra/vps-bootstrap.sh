#!/bin/bash
# Starfall VPS bootstrap — Debian 13, 12 vCore
# Run as root on fresh VPS: bash vps-bootstrap.sh
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "==> apt update & base packages"
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx redis-server ufw htop

echo "==> Node.js 22"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
node -v
npm -v

echo "==> PM2"
npm install -g pm2

echo "==> deploy user"
if ! id deploy >/dev/null 2>&1; then
  useradd -m -s /bin/bash deploy
fi

APP_DIR=/opt/starfall
mkdir -p "$APP_DIR"
chown deploy:deploy "$APP_DIR"

echo "==> firewall"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> redis"
systemctl enable --now redis-server

echo "==> done"
echo "Next: clone repo to $APP_DIR, npm install in server/, pm2 start"
echo "Health: curl http://127.0.0.1:8080/health (after server start)"
