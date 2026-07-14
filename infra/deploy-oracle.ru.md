# Деплой игрового сервера на Oracle Cloud (бесплатно, самый мощный)

**Always Free:** 2 CPU ARM + 12 ГБ RAM — навсегда $0.  
Подходит, если нужен сервер команд **без засыпания**.

## 1. Регистрация
1. https://www.oracle.com/cloud/free  
2. Создайте аккаунт (нужна банковская карта для верификации, при Always Free списаний нет).  
3. Выберите домашний регион ближе к игрокам (например Frankfurt).

## 2. Создать VM
1. **Compute** → **Instances** → **Create instance**
2. Имя: `starfall-game-server`
3. **Image:** Ubuntu 22.04 (Always Free eligible)
4. **Shape:** `VM.Standard.A1.Flex` (ARM, Always Free)
   - OCPUs: **2**
   - Memory: **12 GB**
5. Сеть: публичный IP (Assign a public IPv4 address)
6. SSH-ключ: сгенерируйте и скачайте `.key`
7. **Create**

## 3. Открыть порты
1. **Networking** → **Virtual Cloud Networks** → ваша сеть → **Security Lists**
2. **Ingress Rules** → Add:
   - TCP **22** (SSH)
   - TCP **80** (HTTP)
   - TCP **443** (HTTPS)
   - TCP **8080** (игровой сервер, временно для теста)

## 4. Установить Node.js на VM
Подключитесь по SSH:
```bash
ssh -i ваш-ключ.key ubuntu@ПУБЛИЧНЫЙ_IP
```

На сервере:
```bash
sudo apt update && sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # должно быть v22.x
```

## 5. Загрузить и запустить сервер
```bash
git clone https://github.com/ВАШ-РЕПО/zip-repl.git
cd zip-repl/server
npm install
```

Автозапуск через systemd:
```bash
sudo tee /etc/systemd/system/starfall-game.service << 'EOF'
[Unit]
Description=Starfall Game Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/zip-repl/server
ExecStart=/usr/bin/npm start
Restart=always
Environment=PORT=8080

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable starfall-game
sudo systemctl start starfall-game
sudo systemctl status starfall-game
```

Проверка: `curl http://localhost:8080/health`

## 6. HTTPS (рекомендуется)
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo tee /etc/nginx/sites-available/starfall << 'EOF'
server {
    listen 80;
    server_name ваш-домен.ru;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/starfall /etc/nginx/sites-enabled/
sudo certbot --nginx -d ваш-домен.ru
```

Без домена можно использовать IP:
```env
VITE_GAME_SERVER_URL=http://ПУБЛИЧНЫЙ_IP:8080
```

## 7. Подключить к игре
`.env.local`:
```env
VITE_GAME_SERVER_URL=https://ваш-домен.ru
# или http://ПУБЛИЧНЫЙ_IP:8080
```
```bash
npm run dev
```

## Почему Oracle, а не Fly.io
| | Oracle Always Free | Fly.io |
|--|-------------------|--------|
| Цена | $0 навсегда | ~$5+/мес |
| RAM | 12 ГБ | платно |
| Сон | нет | зависит от тарифа |
| Сложность | выше | ниже |

Для быстрого старта сначала попробуйте **Koyeb** (`deploy-koyeb.ru.md`).
