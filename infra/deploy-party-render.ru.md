# Деплой сервера команд на Render (бесплатно)

**Диспетчер команд** — друзья видят одну пати с разных устройств.  
Папка в проекте: `server/`

---

## Ссылки

| Что | URL |
|-----|-----|
| Регистрация Render | https://render.com |
| Dashboard | https://dashboard.render.com |
| Документация | https://render.com/docs |

---

## Что уже подготовлено в проекте

- `server/` — API `/api/party/:code` + WebSocket `/ws`
- `server/Dockerfile` — для деплоя
- `render.yaml` — автоконфиг для Render (сервис `starfall-party`)
- `npm run party:apply` — пропишет URL в `.env.local`
- `npm run party:health` — проверка сервера

---

## Ваши шаги (10 минут)

### 1. GitHub (если ещё нет)

Код должен быть на GitHub — Render деплоит из репозитория.

1. https://github.com/new → создайте репозиторий (можно private)
2. Залейте проект (или попросите — дам команды)

### 2. Render — создать сервис

**Вариант A — через Blueprint (проще):**

1. https://dashboard.render.com → **New** → **Blueprint**
2. Подключите GitHub-репозиторий
3. Render найдёт `render.yaml` → выберите сервис **starfall-party**
4. **Apply** → дождитесь деплоя (3–5 мин)

**Вариант B — вручную:**

1. **New** → **Web Service** → ваш репозиторий
2. Настройки:

| Поле | Значение |
|------|----------|
| Name | `starfall-party` |
| Root Directory | `server` |
| Runtime | **Docker** |
| Plan | **Free** |
| Health Check Path | `/health` |

3. **Create Web Service**

### 3. Скопировать URL

После деплоя Render покажет URL вида:
```
https://starfall-party.onrender.com
```

Проверка в браузере:
```
https://starfall-party.onrender.com/health
```
→ `{"ok":true,"parties":0,...}`

> **Free tier:** сервер засыпает через 15 мин без игроков. Первый запрос после сна — 30–60 сек. Это нормально.

### 4. Подключить к игре (на вашем ПК)

В терминале в папке проекта:

```bash
npm run party:apply -- https://starfall-party.onrender.com
npm run sync:cloud
npm run dev
```

Ctrl+F5 в браузере.

Или проверка:
```bash
npm run party:health
```

### 5. Проверка команд

1. Создайте команду в игре → получите код
2. Откройте игру на **втором устройстве** (или другом браузере)
3. Войдите в другой аккаунт → введите код команды
4. Оба должны видеть одну команду

---

## Переменные в `.env.local` (автоматически)

```
VITE_GAME_SERVER_URL=https://starfall-party.onrender.com
VITE_GAME_SERVER_WS_URL=wss://starfall-party.onrender.com/ws
```

---

## Если что-то не работает

| Проблема | Решение |
|----------|---------|
| `/health` долго грузится | Render просыпается — подождите 60 сек |
| Команда не синхронится | `npm run party:health`, Ctrl+F5, проверьте URL в `.env.local` |
| Деплой упал | Render → Logs → проверьте ошибку Docker |

---

## Следующий шаг после команд

**Синхронизация боёв** (`edge-server/` на Render) — отдельный сервис, настроим позже.
