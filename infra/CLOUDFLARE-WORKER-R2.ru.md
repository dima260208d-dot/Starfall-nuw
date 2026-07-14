# Cloudflare Worker + R2 — полная инструкция для Starfall

Бесплатный CDN для 3D-моделей. Карта **не нужна**.

---

## Ссылки (откройте по порядку)

| Шаг | Что | Ссылка |
|-----|-----|--------|
| 1 | Регистрация Cloudflare | https://dash.cloudflare.com/sign-up |
| 2 | R2 в панели | https://dash.cloudflare.com/?to=/:account/r2/overview |
| 3 | Workers в панели | https://dash.cloudflare.com/?to=/:account/workers-and-pages |
| 4 | Документация R2 | https://developers.cloudflare.com/r2/ |
| 5 | Документация Workers | https://developers.cloudflare.com/workers/ |
| 6 | Бесплатные лимиты | https://developers.cloudflare.com/workers/platform/pricing/ |

---

## Что уже сделано в проекте

| Файл | Назначение |
|------|------------|
| `cloudflare-worker/src/worker.js` | CDN: отдаёт файлы из R2 по `/cdn/...` |
| `cloudflare-worker/wrangler.toml` | Настройки Worker + привязка bucket `starfall-assets` |
| `scripts/r2-upload-models.mjs` | Загрузка `public/models/` в R2 |
| `scripts/cloudflare-deploy.mjs` | Деплой Worker |
| `scripts/cloudflare-apply-cdn-url.mjs` | Запись URL в `.env.local` |

Игра уже читает `VITE_ASSET_CDN_URL` и грузит 3D с CDN.

---

## Ваши шаги (10–15 минут)

### Шаг 1 — Аккаунт Cloudflare
1. Откройте https://dash.cloudflare.com/sign-up  
2. Зарегистрируйтесь (email + пароль, **карта не нужна**)

### Шаг 2 — Установка и вход

```bash
npm run cf:install
```

#### Вход (выберите один способ)

**Способ A — если Яндекс.Браузер (рекомендуется вам):**
```bash
npm run cf:login:manual
```
1. Скопируйте ссылку из терминала → откройте в **Chrome** или **Edge**
2. Нажмите **Allow**
3. Страница `localhost` может показать ошибку — **скопируйте весь адрес** из строки браузера
4. Вставьте в терминал → Enter

**Способ B — API-токен (самый надёжный, без localhost):**

1. Откройте https://dash.cloudflare.com/profile/api-tokens
2. **Create Token** → **Create Custom Token**
3. Права:
   - Account → **Workers Scripts** → Edit
   - Account → **Workers R2 Storage** → Edit
   - Account → **Account Settings** → Read
4. **Continue** → **Create Token** → скопируйте токен (показывается один раз)
5. В `.env.local` добавьте строку:
   ```
   CLOUDFLARE_API_TOKEN=ваш_токен_сюда
   ```
6. Проверка:
   ```bash
   npm run cf:whoami
   ```
   Должно быть ✅

**Способ C — обычный (Chrome/Edge по умолчанию):**
```bash
npm run cf:login
```

### Ошибка «Timed out» / «Страница не найдена» на localhost

Яндекс.Браузер **не передаёт** код на `localhost:8976`. Wrangler ждёт и падает с таймаутом.

→ Используйте **Способ A** или **Способ B** выше.

Проверка входа: `npm run cf:whoami`

### Шаг 3 — Создать bucket R2

```bash
npm run cf:bucket
```

Если bucket уже есть — можно пропустить (будет сообщение что существует).

### Шаг 4 — Положить модели в проект

Убедитесь, что 3D-файлы лежат здесь:
```
public/models/
  miya.glb
  ronin.glb
  ...
```

### Шаг 5 — Загрузить файлы в R2

```bash
npm run cf:upload
```

Скрипт зальёт все файлы из `public/models/` и `public/textures/` в облако.

### Шаг 6 — Задеплоить Worker

```bash
npm run cf:deploy
```

В конце появится URL вида:
```
https://starfall-assets-cdn.ваш-аккаунт.workers.dev
```

### Шаг 7 — Подключить к игре

```bash
npm run cf:apply
```

(берёт URL из прошлого шага автоматически)

Или вручную:
```bash
npm run cf:apply -- https://starfall-assets-cdn.ваш-аккаунт.workers.dev
```

### Шаг 8 — Запустить игру

```bash
npm run dev
```

В браузере **Ctrl+F5**.

---

## Всё одной командой (после cf:login)

```bash
npm run cf:setup
```

Сделает: bucket → upload → deploy → запись в `.env.local` → sync cloud-config.

---

## Проверка

1. **Health Worker:**  
   https://starfall-assets-cdn.ВАШ.workers.dev/health  
   → `{"ok":true,"service":"starfall-assets-cdn",...}`

2. **Модель:**  
   https://starfall-assets-cdn.ВАШ.workers.dev/cdn/models/miya.glb  
   → скачивается GLB

3. **В игре:** откройте бой — 3D-модели грузятся с Worker, не с localhost.

---

## Лимиты (бесплатно)

| Ресурс | Лимит |
|--------|-------|
| R2 хранение | 10 ГБ |
| R2 трафик | **$0** (без платы за исходящий) |
| Worker запросы | 100 000 / день |
| Worker CPU | 10 мс на запрос (бесплатно) |

Для игры с моделями этого хватает с запасом.

---

## Если что-то не работает

| Ошибка | Решение |
|--------|---------|
| `Not logged in` | `npm run cf:login:manual` или токен в `.env.local` |
| Таймаут после Allow | Яндекс.Браузер → Chrome/Edge или API-токен |
| `localhost` ошибка | Нормально — скопируйте URL из адресной строки в терминал |
| `No files in public/models` | скопируйте `.glb` в `public/models/` |
| `404` на модель | `npm run cf:upload` ещё раз |
| `R2_BUCKET not bound` | `npm run cf:deploy` |
| Игра всё ещё с localhost | Ctrl+F5, проверьте `.env.local` |

---

## Панель Cloudflare (вручную)

- Список файлов в R2: https://dash.cloudflare.com → R2 → `starfall-assets`  
- Список Workers: https://dash.cloudflare.com → Workers & Pages → `starfall-assets-cdn`

---

## Что я не могу сделать за вас

- Зарегистрировать аккаунт Cloudflare (нужен ваш email)
- Нажать «Allow» в браузере при `cf:login`

Всё остальное — команды выше в терминале на вашем ПК.
