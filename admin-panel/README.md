# Starfall Admin — личное приложение (не сайт, не магазины)

**Starfall Admin** — это **отдельное Android-приложение (APK)**, собранное так же,
как игра Starfall (Capacitor + React). Интерфейс **упакован внутрь APK** и работает
**на телефоне как обычное приложение** с иконкой на рабочем столе — **не** через
браузер и **не** через RuStore / Google Play.

| | Игра Starfall | Starfall Admin |
|---|---------------|----------------|
| Тип | Android APK | Android APK |
| Пакет | `com.dima.starfall` | `com.starfall.admin` |
| Для кого | Тестировщики / игроки | **Только вы** (личная sideload-установка) |
| Магазины | RuStore (игра) | **Нет** — только файл APK |

Код админки **не входит** в сборку игры — игроки не могут её найти в APK Starfall.

## Сборка APK

```bash
npm run admin:android:apk
```

Результат:
- **`Starfall-Admin.apk`** на рабочем столе
- копия в `admin-panel/Starfall-Admin.apk`

Иконка — та же, что у ярлыка **Starfall Admin** на ПК (`admin-panel/icon.ico`).

Полная сборка игры + админки: `npm run android:release`.

## Установка на телефон (sideload)

1. Перекиньте **`Starfall-Admin.apk`** на телефон (USB, Telegram **как файл**, не архив).
2. **Не распаковывайте** — APK ставится целиком, это не ZIP.
3. Настройки → Безопасность → разрешите **установку из неизвестных источников**
   для «Файлы» / «Chrome» / «Telegram».
4. Откройте APK → **Установить**. Старую версию админки сначала удалите.
5. На рабочем столе появится приложение **Starfall Admin** — отдельно от игры **Starfall**.

Если «Приложение не установлено»: удалите старый Starfall Admin, проверьте размер ~9 МБ,
скачайте файл заново.

После запуска: URL сервера по умолчанию `http://217.60.245.116/cfg`, пароль админа.

## ПК (опционально, не замена APK)

На компьютере можно открыть `index.html` в Chrome или ярлык **Starfall Admin** на рабочем
столе — это **удобство для ПК**, не основной способ на телефоне. На телефоне используйте
**только APK-приложение**.

## Map constructor (вкладка «Конструктор карт»)
Top-right button opens a 60×60 tile editor:
- pick **mode**, name the map, paint **tiles** (walls, bushes, water…) and **overlay
  points** (spawns, gem center, bases, goals, power boxes, boss spawn);
- **Export/Import** a map as JSON, queue maps into a **set**, then **Publish**.
- Published maps are Ed25519-signed and pushed to every online player + game
  server under the `editorMaps` domain; the game merges them into each player's
  map library and makes them active per mode (see `src/lib/liveConfig.ts`).

## Cloudflare Pages (не нужно для личного APK)

Публикация админки как сайта **не используется** для вашего сценария. Админка — только
личное APK на телефоне (и опционально ярлык на ПК).

## What it does
- Encrypted login to the config-server (password → scrypt-verified, HMAC session token).
- Edit any **domain** (balance, economy, chests, trophies, deals, news, mapSchedule,
  techBreak, notifications, featureFlags, …) as JSON.
- **Save draft** (stored encrypted on the server, not yet live) or **Publish**
  (Ed25519-signed, pushed instantly to all online players and game servers).
- Pending drafts are kept on the server so edits are never lost.

## Security model
- No secrets are stored in this file. The admin password is verified server-side
  against an scrypt hash; only a short-lived session token is held in `localStorage`.
- All authority lives in the config-server. This panel is just a thin client.
