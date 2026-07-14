# Cloudflare Worker + R2

**Полная инструкция со ссылками:** [`../infra/CLOUDFLARE-WORKER-R2.ru.md`](../infra/CLOUDFLARE-WORKER-R2.ru.md)

## Быстрый старт

```bash
npm run cf:install
npm run cf:login          # браузер → Allow
npm run cf:setup          # bucket + upload + deploy + .env.local
npm run dev               # Ctrl+F5
```

## Команды

| Команда | Действие |
|---------|----------|
| `npm run cf:login` | Войти в Cloudflare |
| `npm run cf:bucket` | Создать bucket `starfall-assets` |
| `npm run cf:upload` | Загрузить `public/models/` в R2 |
| `npm run cf:deploy` | Опубликовать Worker |
| `npm run cf:apply` | Записать CDN URL в `.env.local` |
| `npm run cf:setup` | Всё сразу (после login) |

## URL в игре

Worker отдаёт файлы по пути:
```
https://starfall-assets-cdn.XXX.workers.dev/cdn/models/miya.glb
```

В `.env.local` автоматически:
```
VITE_ASSET_CDN_URL=https://starfall-assets-cdn.XXX.workers.dev/cdn/
```
