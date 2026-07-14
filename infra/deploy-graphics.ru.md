# Графика и 3D — бесплатно (без Koyeb)

Koyeb у многих просит оплату. Для **графики** отдельный сервер вообще **не нужен**.

---

## ⭐ Лучший вариант: только Cloudflare R2 (бесплатно)

R2 — это и есть «мощный CDN» для 3D. Без посредников.

| | |
|--|--|
| Цена | **$0** |
| Хранение | 10 ГБ бесплатно |
| Трафик | **без платы** (главное преимущество) |
| Скорость | CDN Cloudflare по всему миру |
| Карта | не нужна на бесплатном аккаунте Cloudflare |

### Шаги

1. https://dash.cloudflare.com → **R2** → **Create bucket** → `starfall-assets`
2. Загрузить папку `public/models/` (все `.glb`)
3. **Settings** → **Public access** → Enable → скопировать URL:  
   `https://pub-xxxxxxxx.r2.dev`
4. В `.env.local`:
   ```env
   VITE_ASSET_CDN_URL=https://pub-xxxxxxxx.r2.dev/
   ```
5. `npm run dev` + **Ctrl+F5**

Игра сразу грузит 3D с R2. **Никакой Koyeb, никакой Oracle.**

Проверка: откройте в браузере  
`https://pub-xxxxxxxx.r2.dev/models/miya.glb` — должен скачаться файл.

---

## Ещё мощнее: Cloudflare Worker + R2 (опционально)

Если нужен свой домен и кэш — в проекте есть папка `cloudflare-worker/`.  
Тот же аккаунт Cloudflare, тоже бесплатно (100 000 запросов/день).

См. `cloudflare-worker/README.ru.md`

---

## WebSocket боёв (отдельно от графики)

Графика = R2.  
Синхронизация боёв в реальном времени = нужен **маленький сервер** (не для файлов).

### Вариант A — **Render** (проще Oracle, бесплатно)
- 750 часов/мес, **карта не нужна**
- Засыпает через 15 мин без игроков (просыпается за ~30 сек)
- Инструкция: `infra/deploy-render.ru.md`

### Вариант B — **Oracle Cloud** (самый мощный, 2 CPU + 12 ГБ RAM)
- Работает 24/7, $0
- Регистрация сложнее, нужна карта (без списаний)
- Инструкция: `infra/deploy-oracle.ru.md`

На этот сервер ставится только `edge-server/` (WebSocket боёв), **не** 3D-файлы.

---

## Итоговая схема (бесплатно)

```
3D модели, текстуры  →  Cloudflare R2 напрямую  (VITE_ASSET_CDN_URL)
Синхронизация боёв   →  Render или Oracle       (VITE_EDGE_SERVER_URL)
Команды / пати       →  другой хост             (VITE_GAME_SERVER_URL)
Логин, сохранения    →  Supabase
```

| Задача | Сервис | Переменная |
|--------|--------|------------|
| Графика / 3D | **R2** | `VITE_ASSET_CDN_URL` |
| Бои (WS) | **Render** или **Oracle** | `VITE_EDGE_SERVER_URL` |
| Команды | отдельный сервер | `VITE_GAME_SERVER_URL` |
