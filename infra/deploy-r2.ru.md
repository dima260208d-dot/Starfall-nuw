# Cloudflare R2 — CDN для тяжёлых файлов (бесплатно)

**Отдельно от Supabase и игрового сервера.**  
Сюда — 3D-модели, большие текстуры, звуки. Не логин, не прогресс, не команды.

## Бесплатный лимит R2
- 10 ГБ хранения в месяц
- Исходящий трафик через Cloudflare — **без платы**
- Подходит для разгрузки вашего основного хостинга

## Шаги

### 1. Регистрация
1. https://dash.cloudflare.com → аккаунт (бесплатный)
2. **R2** → **Create bucket**
3. Имя: `starfall-assets`

### 2. Публичный доступ
1. Bucket → **Settings** → **Public access** → Enable
2. **R2.dev subdomain** → Allow → скопируйте URL вида  
   `https://pub-xxxxxxxx.r2.dev`

### 3. Загрузить файлы
Залейте тяжёлые папки из `public/`:
- `models/`
- большие изображения
- звуки (если есть)

Структура на R2 должна совпадать с `public/`:
```
starfall-assets/
  models/
  textures/
  ...
```

Через веб-интерфейс Cloudflare или утилиту `rclone` / `wrangler`.

### 4. Подключить к игре
`.env.local`:
```env
VITE_ASSET_CDN_URL=https://pub-xxxxxxxx.r2.dev/
```
```bash
npm run dev
```

Игра начнёт грузить тяжёлые ассеты с R2, лёгкий UI останется на вашем хостинге.

## Что НЕ класть в R2
- Пароли и ключи API
- JSON прогресса игроков (это Supabase)
- Данные команд (это игровой сервер Koyeb/Oracle)
