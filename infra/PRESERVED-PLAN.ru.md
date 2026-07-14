# Постоянный план Starfall (сохранено при очистке Cursor, 2026-06-20)

Этот файл — **память проекта**. Не удалять. AI и разработчик читают его после очистки истории чатов.

---

## Текущая облачная архитектура (работает)

| Сервис | Назначение | URL / статус |
|--------|------------|--------------|
| **Supabase** | Логин, профиль, карты | `wjlbtbzypogndakoorym.supabase.co` |
| **Cloudflare R2 + Worker** | 3D-модели (~818 MB CDN) | `starfall-assets-cdn.dima260208.workers.dev/cdn/` |
| **Render starfall-party** | Пати, друзья, presence, WS | `starfall-party.onrender.com` v0.4.0 |
| **Config server** | `starfall-config` | 8095 | `http://217.60.245.116/cfg` | Конфиг игры |
| **AI Friend Cloud** | `ai-friend-cloud` | 8787 | `http://217.60.245.116:8787` | Minecraft AI Friend (отдельный проект) |

Подробнее: **`infra/SERVICES.ru.md`**

Конфиг: `public/cloud-config.json`

---

## План: серверы (приоритет)

### Сейчас (без боевого edge)
1. **Выложить игру онлайн 24/7** — Cloudflare Pages (не npm run dev)
   - Build: `npm run build`, output: `dist/public`
   - Env: `VITE_*` + `cloud-config.json`
2. **Party/друзья** — уже на Render free (засыпает 15 мин → cold start 30–60 сек)
3. **Персистентность party** — перенести в Supabase (`005_party_rooms.sql`), чтобы рестарты Render не обнуляли данные

### Бои — отложено (по решению пользователя)
- Не группировать режимы против воли пользователя
- Идеал: отдельный сервер на режим — **нереально бесплатно** (макс. 4 VM Oracle)
- Реалистично: 1 edge-server пилот (showdown) → карта `battleServers` в `cloud-config.json`

### Бесплатные хостинги (справка)
| Платформа | Для чего | Лимит |
|-----------|----------|-------|
| **Oracle Always Free** | Мощный VPS 24/7 | 4 ARM CPU + 24 GB RAM max, 1 аккаунт/человек |
| **Render Free** | Party / edge | 750 ч/мес, сон 15 мин, ~512 MB RAM |
| **Cloudflare Pages** | Статика игры | Без сна |
| **Supabase Free** | DB + auth | 500 MB, 5 GB egress/мес |

Oracle регистрация у пользователя **не прошла** (адрес US vs телефон 702, email .ru).

---

## План: Unity

- **Unity уже установлен:** Editor `6000.4.6f1` (~20 GB), Hub 3.18.3
- AI **не подключается** к Unity Editor — пишет `.cs` в папку проекта, пользователь проверяет в Editor
- **Unity WebView не ускорит** web-игру — только оболочка
- **Полный порт** React+Three.js → Unity = переписывание месяцами, не «быстро»
- **APK для RuStore/Google Play:** Capacitor/TWA поверх **онлайн-версии**, не полный Unity-порт
- Проект Unity: **`C:\dev\starfall-unity`** (отдельно от `zip-repl`, web-игра не трогается)
- Карта переноса: `C:\dev\starfall-unity\PORT-MAP.ru.md`

---

## План: Blender

- **Не установлен** на ПК (на момент сохранения)
- Скачать: https://www.blender.org/download/
- AI пишет **Python-скрипты** (`scripts/*.py`) → пользователь Run Script → экспорт **.glb** → R2 CDN
- 2D-референсы для рига уже в `public/dev-notes/` (Verdeletta, shadow minion)
- GLB для игры грузятся с CDN, не из Unity

---

## План: производительность Android (без Unity)

1. Профили устройства: low / mid / high (тени, 30 FPS, меньше WebGL в меню)
2. Draco + LOD для `.glb`
3. Один shared WebGL в меню вместо множества превью
4. Не грузить все brawler GLB сразу

---

## План: деплой игры (APK vs браузер)

1. **Сначала** — ссылка Cloudflare Pages (постоянно без npm run dev)
2. **Потом** — APK (Capacitor/TWA) для RuStore и Google Play
3. **Не** полный нативный порт без необходимости

---

## Игрок / аккаунт

- Dev: `РАЗРАБОТЧИК 1.0`, player ID `7JTQJGBRYQD9`
- GitHub: `dima260208d-dot/starfall-game-clean`

---

## Не трогать при очистках

- `Downloads/zip-repl/src`, `server`, `public/cloud-config.json`, `package.json`
- **Kinetic Kids** — любые папки с этим именем
- `public/dev-notes/` — референсы для Blender
