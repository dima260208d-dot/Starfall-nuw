# Карта проекта Starfall (веб-игра)

Кратко: **точка входа** → **экраны** → **бой** → **режимы** → **ассеты**.

## Запуск и оболочка

| Файл | Назначение |
|------|------------|
| `index.html` | Корень SPA, `#root` |
| `src/main.tsx` | React mount, `autoSeedDefaultMaps()` |
| `src/App.tsx` | Роутинг экранов, `bossRaidBattle`, `lobbyBossRaidBossId`, `hydrateFromProfile` |
| `vite.config.ts` | `base`, сборка в `dist/public` |

## Босс-рейд (не трогать логику без нужды)

| Зона | Файлы |
|------|--------|
| Режим боя | `src/modes/ClashBossRaid.ts`, `src/modes/bossRaid/**` |
| Лобби / выбор | `src/components/BossRaidLobbyCarousel.tsx`, `src/pages/ModeSelect.tsx` (вкладка босса), `src/pages/MainMenu.tsx` (надпись над «Играть») |
| Прогресс / награды | `src/utils/bossRaidProgress.ts`, `src/utils/bossRaidRewards.ts`, `finalizeBossRaidVictory` из наград |
| Данные бойцов | `src/entities/BrawlerData.ts` (боссы = те же id, что в арене) |
| 3D в меню | `src/components/BrawlerViewer3D.tsx`, `BrawlerRevealModal` (реестр GLB) |

## Бой и рендер

| Файл | Назначение |
|------|------------|
| `src/pages/GameScreen.tsx` | Сборка матча, режим, `bossRaid` проп |
| `src/game/miyaTopDownRenderer.ts` | Top-down GLB бойцов/босса, `models/{id}.glb` |
| `src/game/MapRenderer.ts`, `TileMap.ts` | Карта, тайлы |
| `src/utils/tileModelCache.ts` | Какой `.glb` на какой тип тайла |
| `src/utils/platformTile.ts` | `platform.glb` |
| `src/utils/powerModelCache.ts` | Превью power box / jar / safe / gem / star_ball |
| `src/game/soccerBallRenderer.ts` | `star_ball.glb` (Star Strike) |

## Статика `public/`

- `public/models/*.glb` — модели тайлов, персонажей, сундуков, монет и т.д. (имена зашиты в `src`, см. выше).
- `public/brawlers/*_front.png` / `*_back.png` — fallback 2D, если WebGL недоступен (`BrawlerViewer3D`).
- `public/images/` — превью режимов, вкладки mode select и т.п.

## Что не коммитить

См. `.gitignore`: `node_modules/`, `dist/`, логи `.cursor`, кэш `*.tsbuildinfo`, папки Unity.
