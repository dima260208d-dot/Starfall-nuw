# Программы на VPS `217.60.245.116`

> Память для AI и разработчика. Обновлять при добавлении сервисов.

| Сервис | PM2 / процесс | Порт | URL | Назначение |
|--------|---------------|------|-----|------------|
| **Starfall party** | `starfall-party` | 8080 | `http://217.60.245.116/` | Команды, пати, WS `/ws` |
| **Starfall edge** | `starfall-edge` | 8081 | nginx `/cdn/`, `/ws/battle` | CDN-прокси, edge |
| **Battle matchmaker** | `starfall-mm` | 8090 | `http://217.60.245.116/mm` | Матчмейкер боёв |
| **Battle workers** | `starfall-w1…w12` | 8101–8112 | `http://217.60.245.116/wN/` | Headless battle sim |
| **Config server** | `starfall-config` | 8095 | `http://217.60.245.116/cfg` | Конфиг игры, новости |
| **AI Friend Cloud** | `ai-friend-cloud` | **8787** | `http://217.60.245.116:8787` | Brain для Minecraft AI Friend — **задеплоен 2026-07-06** |

## Деплой

| Что | Команда |
|-----|---------|
| Starfall (полный) | `VPS_PASS='…' node scripts/vps-deploy.mjs` |
| AI Friend Cloud | `VPS_PASS='…' node scripts/vps-deploy-ai-friend.mjs` |
| SSH команда | `VPS_PASS='…' node scripts/vps-cmd.mjs "pm2 ls"` |

Путь на сервере: Starfall → `/opt/starfall`, AI Friend → `/opt/ai-friend-cloud`.

## Minecraft AI Friend (телефон)

1. Brain APK → URL: `http://217.60.245.116:8787`
2. В игре: `!сервер http://217.60.245.116:8787`

Код cloud-server: `Projects/личное/sandbox/minecraft-ai-friend/cloud-server`
