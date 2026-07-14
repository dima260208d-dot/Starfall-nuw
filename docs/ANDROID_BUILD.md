# Starfall — Android (Capacitor)

Нативное Android-приложение: **весь UI и меню внутри APK**, 3D/музыка/онлайн-бой — через интернет (CDN + VPS из `public/cloud-config.json`).

## Требования

- Node.js 22+
- **JDK 17+** ([Adoptium](https://adoptium.net/))
- **Android Studio** (SDK Platform 36, Build-Tools, Android SDK Command-line Tools)
- Переменная `ANDROID_HOME` (или SDK через Android Studio)

Проверка:

```bash
java -version
```

## Сборка (каждый раз перед APK/AAB)

```bash
npm ci
node scripts/setup-android-sdk.mjs   # один раз, если SDK ещё не установлен
npm run android:release              # игра + админ → Рабочий стол
```

Или по отдельности:

```bash
npm run android:sync
npm run android:apk                  # → android/app/build/outputs/apk/release/
npm run admin:android:apk            # → android-admin/.../app-release.apk
```

## Release-подпись (обязательно для RuStore и Google Play)

1. Создай keystore (один раз):

```bash
keytool -genkey -v -keystore android/starfall-release.keystore -alias starfall -keyalg RSA -keysize 2048 -validity 10000
```

2. Скопируй `android/keystore.properties.example` → `android/keystore.properties` и укажи пароли.

3. **Не коммить** keystore и `keystore.properties`.

## Сборка артефактов

| Цель | Команда | Файл |
|------|---------|------|
| **AAB** (Google Play) | `npm run android:bundle` | `android/app/build/outputs/bundle/release/app-release.aab` |
| **APK** (RuStore, sideload) | `npm run android:apk` | `android/app/build/outputs/apk/release/app-release.apk` |

Или открой Android Studio:

```bash
npm run cap:open
```

→ **Build → Generate Signed Bundle / APK**.

## RuStore

1. Зарегистрируй приложение `com.dima.starfall` / **Starfall**
2. Загрузи подписанный **APK** или **AAB**
3. Укажи категорию «Игры», возрастной рейтинг, скриншоты с телефона
4. **Политика конфиденциальности** (URL) — обязательна; поддержка: **starfall_game@bk.ru**
5. Иконка **512×512**: `public/app-icons/play-store-512.png`
6. Описание: онлайн-игра, требуется интернет

## Google Play

1. Google Play Console → Create app
2. Загрузи **AAB** (`android:bundle`)
3. Play App Signing — рекомендуется включить (Google хранит ключ подписи)
4. Store listing: иконка **512×512** — `public/app-icons/play-store-512.png` (если стор не возьмёт из APK)
5. Data safety: указать сбор данных (Supabase аккаунт, если есть)
6. Поддержка в документах: **starfall_game@bk.ru**
7. **Cleartext HTTP** к `217.60.245.116` — для долгосрочного одобрения лучше **HTTPS/WSS на VPS** (сейчас разрешено через `network_security_config.xml`)

## Размер приложения

В APK остаются все **меню-ассеты** (UI, brawlers, pins, images). Тяжёлые **3D-модели** и **музыка** не включаются — грузятся с CDN при игре.

Если Play Console ругается на лимит ~150–200 МБ download — напиши, вынесем pins/brawlers на CDN (код уже умеет CDN для music/3D).

## Конфиг серверов

Перед сборкой убедись, что `public/cloud-config.json` актуален:

```bash
npm run sync:cloud
```

Файл попадает в APK при `build:capacitor`.

## Отладка на телефоне

```bash
npm run android:sync
npm run cap:open
```

Android Studio → Run на устройстве (USB debugging).

## Версия для стора

В `android/app/build.gradle`:

- `versionCode` — целое, увеличивать каждый релиз
- `versionName` — строка для пользователя (`"1.0.1"`)
