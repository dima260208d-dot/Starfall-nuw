# Деплой edge-сервера на Render (бесплатно, для боёв)

**Не для графики** — 3D идут напрямую с R2 (`infra/deploy-graphics.ru.md`).  
Render нужен только для WebSocket синхронизации боёв.

## Бесплатный тариф Render
- **$0**, карта **не нужна**
- 750 часов в месяц (хватает на 1 сервис 24/7)
- Засыпает после 15 минут без запросов → просыпается ~30 сек

## Шаги

1. https://render.com → Sign up (GitHub)
2. **New** → **Web Service** → подключить репозиторий
3. Настройки:

| Поле | Значение |
|------|----------|
| Root Directory | `edge-server` |
| Runtime | **Docker** |
| Plan | **Free** |
| Health Check Path | `/health` |

4. **Environment Variables:**

| Key | Value |
|-----|-------|
| `R2_PUBLIC_URL` | `https://pub-xxxx.r2.dev` (опционально, для /cdn прокси) |
| `PORT` | `8080` |

5. **Create Web Service** → дождаться деплоя
6. URL вида `https://starfall-edge.onrender.com`

## Подключить к игре

`.env.local`:
```env
VITE_ASSET_CDN_URL=https://pub-xxxx.r2.dev/
VITE_EDGE_SERVER_URL=https://starfall-edge.onrender.com
```

```bash
npm run dev
```
Ctrl+F5.

## Проверка
- `https://ваш-url.onrender.com/health` → `{"ok":true,...}`
- Первый запрос после сна может занять 30–60 сек — это нормально для бесплатного Render

## Если нужен сервер без сна
→ `infra/deploy-oracle.ru.md` (2 CPU, 12 ГБ RAM, $0)
