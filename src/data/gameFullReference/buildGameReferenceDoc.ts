/**
 * Builds the full game reference encyclopedia for admin Notes (seed documents).
 * Generated from live game data so stats stay in sync with BrawlerData, modes, etc.
 */
import { MODES } from "../modes";
import {
  BRAWLERS,
  BRAWLER_LORE,
  BRAWLER_GEM_COST,
  BRAWLER_RARITY_LABEL,
  MAX_BRAWLER_LEVEL,
  MELEE_BRAWLER_IDS,
} from "../../entities/BrawlerData";
import { PETS, PET_GEM_COST, PET_RARITY_LABEL } from "../../entities/PetData";
import { CHESTS, CHEST_RARITY_ORDER } from "../../utils/chests";
import {
  BRAWLER_CONSTELLATIONS,
  MAX_STARS_PER_BRAWLER,
  STAR_COST_GEMS,
  STAR_PACK3_COST_GEMS,
  STAR_COST_RUB,
  STAR_PACK3_COST_RUB,
} from "../../utils/constellations";
import {
  BRAWLER_MASTERY_TITLES,
  MAX_MASTERY_LEVEL,
  MAX_MASTERY_XP,
  MASTERY_WIN_XP_BY_TIER,
} from "../../data/brawlerMastery";
import { RANKED_LEAGUES, RANKED_WIN_CUPS, RANKED_LOSS_CUPS, RANKED_ROULETTE_MODES } from "../../utils/rankedProgress";

export interface GameReferencePart {
  id: string;
  title: string;
  text: string;
}

const SEP = "\n" + "═".repeat(72) + "\n";

function attackType(id: string): string {
  if (MELEE_BRAWLER_IDS.includes(id)) return "ближний (melee)";
  const lob = ["rin", "sora", "octavia", "callista", "airin", "silven"];
  if (lob.includes(id)) return "дуга/лоб (lob)";
  return "дальний (ranged)";
}

function buildOverview(): string {
  return `# ПОЛНАЯ ЭНЦИКЛОПЕДИЯ ИГРЫ (Starfall)
Версия документа: автогенерация из кодовой базы.
Назначение: полный отчёт для анализа без запуска игры — все экраны, кнопки, режимы, бойцы, экономика, прогрессия, бой, социальные системы.

${SEP}
## 0. КРАТКОЕ ОПИСАНИЕ ПРОЕКТА

Это браузерная игра в духе Brawl Stars: топ-down / 3D арена, бойцы с атаками и суперами, множество PvP/PvE режимов, прогрессия через трофеи, сундуки, Clash Pass, ранговый режим, клубы, друзья, питомцы, кастомизация (пины, иконки, скины), AI-боты и встроенный помощник «Астрал».

Визуальный стиль: cel-shading, яркие градиенты, 3D-модели бойцов в бою (Three.js), UI в стиле мобильных action-игр с pill-кнопками и боковыми колонками на главном меню.

Стартовый экран: auth (логин) → menu (главное меню). Данные профиля хранятся в localStorage.

${SEP}
## 1. ВСЕ ЭКРАНЫ ПРИЛОЖЕНИЯ (Screen IDs)

| ID экрана | Назначение |
|-----------|------------|
| auth | Авторизация / вход по нику |
| menu | Главное меню (лobby) |
| modeSelect | Выбор режима и формата матча |
| characterSelect | Выбор бойца, созвездие, мастерство, «Испытать» |
| matchmaking | Поиск матча / ожидание |
| game | Активный бой (canvas 3D/2D) |
| profile | Профиль игрока (статы, история, иконки) |
| shop | Магазин (6 вкладок) |
| customization | Пины, иконки профиля, подарки |
| settings | Настройки (управление PC/моб, звук, язык, LLM для Астрала) |
| collection | Коллекция всех бойцов |
| clashpass | Clash Pass — 100 уровней + бесконечная ветка |
| proStarPass | Pro Star Pass — ранговый платный трек |
| trophyroad | Trophy Road — награды за трофеи аккаунта |
| chests | Инвентарь сундуков |
| pets | Питомцы — экипировка и просмотр |
| news | Новости (из админки) |
| messages | Входящие / обратная связь с dev |
| clubs | Клубы — поиск, чат, казна, boss raid |
| friends | Друзья — список, подарки, XP дружбы |
| battleFeed | Лента боёв — посты, лайки, реплеи |
| battleHistory | История своих матчей |
| records | Рекорды / таблицы лидеров |
| starFeats | Звёздные подвиги — 90 заданий |
| mastery | Мастерство бойца — 27 уровней |
| comic | Комикс персонажа |
| rankedMenu | Ранговое меню — лиги, Pro Star Pass |
| rankedMatch | Ранговый матчмейкинг |
| megaSquad | Выбор отряда 3 бойцов для Mega Star Battle |
| starGuardianRewards | Награды подписки Star Guardian |
| mapEditorModeSelect | Выбор режима для редактора карт (dev) |
| mapeditor | Редактор карт |
| admin | Админ-панель (17 вкладок) |
| register | Регистрация нового аккаунта |
| accounts | Список аккаунтов на устройстве |
| accountDetail | Детали аккаунта |
| playerProfile | Просмотр чужого профиля |
| techBreakPreview | Превью экрана тех. перерыва |

Горячая клавиша: Shift+1 — полноэкранный режим (toggle fullscreen).

${SEP}
## 2. ГЛАВНОЕ МЕНЮ (MainMenu) — КАЖДАЯ КНОПКА

### 2.1 Верхняя панель (header)
- **Аватар + ник** → экран profile. Показывает выбранную иконку профиля и имя.
- **📺 Лента** → battleFeed (глобальная лента боёв, лайки, реплеи).
- **Trophy Road** — горизонтальная полоска прогресса трофеев; клик → trophyroad.
- **🏅 Ранговый** — badge текущей лиги; клик → rankedMenu.
- **Star Guardian** — badge подписки; клик → starGuardianRewards.
- **Ресурсы (pill-кнопки):** монеты (gold/coins), кристаллы (gems), очки силы (powerPoints/ОС). Только отображение, не кликабельны.
- **☰ Гамбургер** — открывает HamburgerDrawer (боковое меню).

### 2.2 Левая колонка (side buttons)
- **🛒 Магазин** → shop.
- **🎁 Подарки новичка** — модальное окно starter gifts (если доступны).
- **🦸 Персонаж** → characterSelect (выбор активного бойца для лobby).
- **🎁 Бонус дня** — модал Daily Reward Ladder (30-дневная лестница, dailyLadderDay).
- **🗝️ Сундуки** → chests.
- **🎨 Кастомизация** → customization.

### 2.3 Правая колонка
- **🎒 Коллекция** → collection (все бойцы, звёзды, «новые» метки).
- **🐾 Питомцы** → pets.
- **⭐ Звёздные подвиги** → starFeats.
- **🏛️ Клубы** → clubs.
- **👥 Друзья** → friends.

### 2.4 Центр и низ
- **Карточка режима** — показывает выбранный режим; клик → modeSelect.
- **Кнопка «ИГРАТЬ»** — запуск matchmaking → бой. Для megashowdown сначала megaSquad; для ranked — rankedMatch; для bossraid — выбор босса в modeSelect.
- **Clash Pass** (StarPassMenuButton) → clashpass.
- **Квесты** — модал ежедневных/недельных квестов (5 daily + weekly + paid).
- **DailyWinsStrip** — полоска «Победы дня» (до 10 слотов dailyWins).

### 2.5 Party (группа)
До 5 игроков в лобби: слоты слева/справа от центра, код группы, suggest бойца, «Play Again» после боя. Лидер запускает матч.

${SEP}
## 3. ГАМБУРГЕР-МЕНЮ (HamburgerDrawer)
- Настройки → settings
- Новости → news
- Сообщения → messages (inbox: system/gift, feedback-треды)
- История боёв → battleHistory
- Рекорды → records
- Аккаунты → accounts
- Регистрация → register
- Редактор карт → mapEditorModeSelect (только если isAdminUnlocked)
- Админка → admin
- Полноэкранный режим
- Выход (logout)

${SEP}
## 4. ВЫБОР РЕЖИМА (ModeSelect)
Список всех режимов из MODES + training (только через CharacterSelect «Испытать»).
- **showdown:** выбор формата solo (10) / duo (10) / trio (12).
- **starstrike:** 3×3 или 5×5.
- **ranked:** отдельная кнопка → ranked в лobby.
- **bossraid:** выбор босса (ур. 1–5), возврат в лobby.
- **megashowdown:** требуется ≥3 открытых бойца → megaSquad для выбора отряда.

${SEP}
## 5. ВЫБОР ПЕРСОНАЖА (CharacterSelect)
- Сетка всех бойцов; locked = не открыт (купить в shop / сундук).
- **Выбор активным** — сохраняет selectedBrawlerId (только открытые).
- **Испытать** — training на полигоне без смены lobby-режима.
- **Мастерство** → mastery (если есть badge — непрочитанная награда).
- **Комикс** → comic.
- **Созвездие** — 6 слотов звёзд (#1–#6), покупка за 💎/₽, просмотр эффектов.
- 3D-превью бойца, статы, описание атаки/супера.
- Кнопка «Назад» → menu.

${SEP}
## 6. МАГАЗИН (ShopPage) — 6 вкладок
| Вкладка | Содержимое |
|---------|------------|
| brawlers | Покупка бойцов за кристаллы по редкости |
| pets | Покупка питомцев за кристаллы |
| chests | Покупка и открытие сундуков за кристаллы |
| deals | Акции / daily deals (из админки) |
| stars | Покупка звёзд созвездия (250💎 / 600💎 пак 3) |
| donate | Донат / Star Guardian / Clash Pass Ultra |

${SEP}
## 7. КАСТОМИЗАЦИЯ (CustomizationPage)
- **Пины** — battle pins на kill-feed и кнопка pin в бою (BattlePinHud).
- **Иконки профиля** — avatar icons.
- **Подарки** — gift items от друзей/системы.

${SEP}
## 8. CLASH PASS
- 100 уровней + infinite ветка (2000 XP/ур. после 100).
- Треки: бесплатный, платный (clashPassPaid), ультра (clashPassUltraPaid).
- XP с боёв и открытия сундуков.
- Сунduки на ур.: 10/60 rare, 20/70 epic, 30/80 mega, 40/90 legendary, 50/100 mythic.

${SEP}
## 9. PRO STAR PASS (ранговый)
- 100 уровней + infinite.
- +25 токенов за победу в ranked, +200 за повышение тира лиги.
- Платная линия за рубли.

${SEP}
## 10. TROPHY ROAD
Пороги трофеев аккаунта (trophies): 50→2000 (+50), 2200→10000 (+200), 10500→30000 (+500), 31000→60000 (+1000), 62000→100000 (+2000).
Награды: монеты / ОС / кристаллы + сундуки на вехах (1000 epic … 100000 mythic).

${SEP}
## 11. РАНГОВАЯ СИСТЕМА
8 лиг × 3 тира (I, II, III):
${RANKED_LEAGUES.map((l, i) => {
    const ru: Record<string, string> = {
      shattered: "Осколочная", bronze: "Бронзовая", silver: "Серебряная", gold: "Золотая",
      platinum: "Платиновая", diamond: "Алмазная", master: "Мастерская", star: "Звёздная",
    };
    return `${i + 1}. ${ru[l.id] ?? l.id} (${l.id}) — тиры I, II, III`;
  }).join("\n")}

Победа: +${RANKED_WIN_CUPS} ранговых кубков. Поражение: −${RANKED_LOSS_CUPS}.
Рулетка режимов ranked: ${RANKED_ROULETTE_MODES.join(", ")}.
Ранговые кубки НЕ идут в Trophy Road.
Ранг бойца в ranked: floor(cups/30)+1, макс. 100.

${SEP}
## 12. МАСТЕРСТВО БОЙЦА
- ${MAX_MASTERY_LEVEL} уровней, макс. ${MAX_MASTERY_XP} XP.
- Тиры: bronze / silver / gold / diamond / star (по 5 ур., 26=пин, 27=титул).
- XP за победу: bronze ${MASTERY_WIN_XP_BY_TIER.bronze}, silver ${MASTERY_WIN_XP_BY_TIER.silver}, gold ${MASTERY_WIN_XP_BY_TIER.gold}, diamond ${MASTERY_WIN_XP_BY_TIER.diamond}, star ${MASTERY_WIN_XP_BY_TIER.star} (+10% лидеру группы).
- Уникальный титул на ур. 27 у каждого бойца (см. часть 2).

${SEP}
## 13. ЗВЁЗДНЫЕ ПОДВИГИ (Star Feats)
- 6 вкладок × 15 заданий = 90 подвигов.
- Типы: play_games, win_games, play_mode, win_mode, play_brawler, win_brawler, kill_brawler, kill_enemies, deal_damage, open_chests, use_super, earn_trophies, clash_pass и др.
- Цвета тиров: серый → зелёный → синий → фиолетовый → оранжевый → золотой.

${SEP}
## 14. РАНГ БОЙЦА (Brawler Rank)
- 1–100 по личным трофеям бойца (макс. 5000 на бойца).
- Порог: 10×rank + 0.4×rank² (ранг 100 ≈ 5000).
- Награды: монеты/ОС/кристаллы, сундуки (25/50/75/100), пины, иконки.

${SEP}
## 15. СОЗВЕЗДИЕ (Constellation Stars)
- ${MAX_STARS_PER_BRAWLER} звёзд на бойца, слоты #1–#6.
- Цена: ${STAR_COST_GEMS}💎 / ${STAR_COST_RUB}₽ за звезду; пак 3 = ${STAR_PACK3_COST_GEMS}💎 / ${STAR_PACK3_COST_RUB}₽.
- Дубликат бойца из сундука → бесплатный pick слота (pendingBrawlerStarPicks).
- Детали звёзд каждого бойца — в части 2.

${SEP}
## 16. ПРОКАЧКА БОЙЦА
- Макс. уровень: ${MAX_BRAWLER_LEVEL}.
- За уровень: +5% HP, +3% урона (настраивается в админ balance).
- Очки силы (ОС/powerPoints) тратятся на upgrade.

${SEP}
## 17. STAR GUARDIAN (подписка)
- Расширенные команды Астрала (открыть сундuk, прокачать, экипировать питомца).
- Autoplay в бою (кроме training/bossraid).
- Экран наград: starGuardianRewards.

КОНЕЦ ЧАСТИ 1 — продолжение в части 2 (бойцы), 3 (режимы и бой), 4 (экономика и админка).`;
}

function buildBrawlersSection(): string {
  const lines: string[] = [
    `# ЧАСТЬ 2: ВСЕ БОЙЦЫ (${BRAWLERS.length} шт.)`,
    "",
    "Для каждого: ID, имя, редкость, роль, базовые статы ур.1, тип атаки, описание, лор, атака, супер, 6 звёзд созвездия, цена в магазине.",
    SEP,
  ];

  for (const b of BRAWLERS) {
    const lore = BRAWLER_LORE[b.id] ?? "—";
    const stars = BRAWLER_CONSTELLATIONS[b.id] ?? [];
    const rarity = BRAWLER_RARITY_LABEL[b.rarity];
    const gemCost = BRAWLER_GEM_COST[b.rarity];
    const masteryTitle = BRAWLER_MASTERY_TITLES[b.id] ?? "—";

    lines.push(`### ${b.name} (id: ${b.id})`);
    lines.push(`- **Редкость:** ${rarity} | **Роль:** ${b.role} | **Цена:** ${gemCost}💎`);
    lines.push(`- **Тип атаки:** ${attackType(b.id)}`);
    lines.push(`- **Описание:** ${b.description}`);
    lines.push(`- **Лор:** ${lore}`);
    lines.push("");
    lines.push("**Базовые статы (ур. 1):**");
    lines.push(`  HP: ${b.hp} | Скорость: ${b.speed} | Реген: ${b.regenRate} HP/с`);
    lines.push(`  Урон атаки: ${b.attackDamage} | Дальность: ${b.attackRange} | CD атаки: ${b.attackCooldown}с`);
    lines.push(`  Заряды атаки: ${b.attackCharges} | CD супера: ${b.superCooldown}с | Заряд супера за попадание: ${b.superChargePerHit}%`);
    lines.push(`  Цвета UI: ${b.color} / ${b.secondaryColor} / ${b.accentColor}`);
    lines.push("");
    lines.push(`**Атака «${b.attackName}»:** ${b.attackDesc}`);
    lines.push(`**Супер «${b.superName}»:** ${b.superDesc}`);
    lines.push("");
    lines.push("**Звёзды созвездия:**");
    if (stars.length === 0) {
      lines.push("  (не заданы)");
    } else {
      for (const s of stars) {
        lines.push(`  #${s.index} «${s.name}» ${s.icon}: ${s.effect}`);
      }
    }
    lines.push(`**Титул мастерства (ур. 27):** «${masteryTitle}»`);
    lines.push(SEP);
  }

  return lines.join("\n");
}

function buildModesAndBattle(): string {
  const modeLines = MODES.map(m => {
    return `### ${m.name} (${m.id})
- Подзаголовок: ${m.subtitle}
- Игроки: ${m.players}
- Карта: ${m.mapName}
- Описание: ${m.desc}`;
  }).join("\n\n");

  return `# ЧАСТЬ 3: РЕЖИМЫ ИГРЫ И БОЕВАЯ СИСТЕМА

${SEP}
## 1. ВСЕ РЕЖИМЫ (${MODES.length} + training)

${modeLines}

### training (Тренировка)
- Не в ленте режимов. Запуск из CharacterSelect «Испытать».
- Карта «Тренировочный полигон», 5 монстров-колец (3D), без трофеев/ranked/Astral autoplay.
- forceMode=training.

${SEP}
## 2. УСЛОВИЯ ПОБЕДЫ (детально)

| Режим | Победа |
|-------|--------|
| showdown | Последняя команда/игрок; сжимающийся газ (poison) |
| crystals | 10 кристаллов у команды и удержание |
| siege | Пережить 3 волны врагов (награда растёт с волной) |
| heist | Уничтожить сейф врага раньше своего |
| gemgrab | 10 камней одновременно 15 сек; при смерти носитель роняет все |
| ranked | Победа в случайном 3×3; ранговые кубки |
| starstrike | Забить гол физическим мячом |
| megashowdown | Королевская битва; 3 бойца по очереди; кнопка «Сменить» (CD 3с) |
| bossraid | Победить босса; ур. 1–5 + бесконечное усиление; без трофеев |
| bounty | 25 звёзд команды; за убийство 1–6; личные сбрасываются при смерти |
| monsterhide | Убить всех 10 монстров за 3 мин (+15с/монстр, макс +60); +1 трофей/монстр |
| monsterInvasion | 10 волн; трофеи −5 если <3 волн, иначе +1/волна |
| teamHunt | 5 мин; очки только за монстров; PvP без очков |

${SEP}
## 3. POWER CUBES (усиления в бою)
- Режимы: showdown, megashowdown, teamHunt и др.
- За куб: +10% max HP, урона, регена; в showdown лечение ×(1+0.2×кубы).
- При смерти все кубы выпадают (+1 минимум).
- Ящики на карте (boxes) и банки (power cubes).

${SEP}
## 4. КАРТЫ
- Заброшенный храм (showdown, megashowdown, monster modes)
- Кристальная шахта (crystals, gemgrab, heist, siege, bounty)
- Арена удара (starstrike)
- Арена босса (bossraid)
- Арена столкновения (teamHunt)
- Тренировочный полигон (training)

Кусты (bushes): скрывают игроков. Стены блокируют снаряды и движение.

${SEP}
## 5. УПРАВЛЕНИЕ

### ПК (controlMode: pc)
| Действие | Клавиши |
|----------|---------|
| Движение | WASD / стрелки |
| Прицел | Мышь |
| Атака | ЛКМ / Пробел (авто-атака при удержании) |
| Супер | ПКМ / E |
| Пин | Кнопка на HUD |
| Выход | ESC |

### Телефон (controlMode: mobile)
| Действие | Элемент |
|----------|---------|
| Движение | Синий джойстик справа |
| Атака | Красный джойстик слева |
| Супер | Жёлтый джойстик над атакой |
| Авто-прицел | Короткий тап на джойстик атаки/супера |

Настройка controlMode в settings.

${SEP}
## 6. HUD В БОЮ
- Полоски HP команды/врагов
- Индикатор супера (заряжается только от попаданий)
- Kill feed с пинами
- Таймер матча / счёт режима (кристаллы, gem grab timer, bounty stars и т.д.)
- Battle intro card — имя бойца и титул перед стартом
- BattlePinHud — кнопка пина (без фона у иконки)
- StatChip — иконки статов (урон, HP, лечение и т.д.)
- Для megashowdown: кнопка смены бойца, индикатор отряда

${SEP}
## 7. БОЕВАЯ МЕХАНИКА
- Супер заряжается ТОЛЬКО от попаданий по врагам (superChargePerHit % за hit).
- Ближний бой (melee): goro, ronin, taro, vittoria — без снарядов, конус/AoE.
- Lob-атаки: дуга снаряда (rin, sora, octavia, callista, airin, silven).
- Игрок проходит сквозь союзников/врагов-бойцов (ghost), не толкает их.
- Боты требуют line-of-sight для атаки (не стреляют сквозь стены).
- Отражение урона, щиты, замедление, root, stun, poison DoT, invisibility, revive (phoenix pet).

${SEP}
## 8. BOT AI
- Пул = все BRAWLERS (равный вес), pickBotStats, Fisher–Yates shuffle.
- Архетипы: assassin / tank / sniper / lobs / healer / ranged (refBotBehavior).
- Mode-aware objectives (aiBotObjectives): захват gem, heist safe, bounty stars и т.д.
- Стрейф/уклонение под огнём, bush camping, wall navigation.
- Admin → ИИ / БОТЫ: headless-симы, циклическое обучение, телеметрия.

${SEP}
## 9. ASTRAL ASSISTANT
- Rule-based чат: бойцы, режимы, тактика, профиль, сундуки.
- Star Guardian: расширенные команды, autoplay в бою.
- Опциональный LLM в настройках (AstralLlmSetupGuide).
- Голоса: Light / Moon / Star.
- Floating icon на главном меню, модал чата AstralChatModal.
- Недоступен autoplay в training и bossraid.

${SEP}
## 10. РЕПЛЕИ И ЛЕНТА
- battleFeed: global / mine / leaders / best; посты, лайки, реплеи.
- BattleReplayViewer — просмотр записанных боёв.
- battleHistory — личная история.

КОНЕЦ ЧАСТИ 3.`;
}

function buildEconomyAndAdmin(): string {
  const chestLines = CHEST_RARITY_ORDER.map(r => {
    const c = CHESTS[r];
    const d = c.drops;
    return `### ${c.name} (${r}, tier ${c.tier})
- Цена: ${c.priceGems}💎 | Rolls: ${d.rolls} | XP Clash Pass: ${d.xp}
- Монеты/roll: ${d.coinsRange[0]}–${d.coinsRange[1]}
- Шанс 💎/roll: ${(d.gemsChance * 100).toFixed(0)}% (${d.gemsRange[0]}–${d.gemsRange[1]})
- Шанс ОС/roll: ${(d.powerPointsChance * 100).toFixed(0)}% (${d.powerPointsRange[0]}–${d.powerPointsRange[1]})
- Бонусы: ${d.bonusGems ? `+${d.bonusGems}💎 ` : ""}${d.bonusPowerPoints ? `+${d.bonusPowerPoints}ОС ` : ""}${d.bonusCoins ? `+${d.bonusCoins}🪙` : ""}
- ${c.description}`;
  }).join("\n\n");

  const petLines = PETS.map(p => {
    return `### ${p.name} (${p.id})
- Редкость: ${PET_RARITY_LABEL[p.rarity]} | Цена: ${PET_GEM_COST[p.rarity]}💎
- Эффект: ${p.effectLabel}
- Описание: ${p.description}`;
  }).join("\n\n");

  return `# ЧАСТЬ 4: ЭКОНОМИКА, СОЦИАЛЬНОЕ, АДМИНКА

${SEP}
## 1. РЕСУРСЫ ПРОФИЛЯ
| Ресурс | Поле | Назначение |
|--------|------|------------|
| Монеты | coins | Основная валюта, прокачка, магазин |
| Кристаллы | gems | Премиум: бойцы, питомцы, сундуки, звёзды |
| Очки силы | powerPoints | Прокачка бойцов до ур. 11 |
| XP | xp | Уровень Clash Pass |
| Трофеи | trophies | Глобальные кубки аккаунта → Trophy Road |
| Ранговые кубки | rankedCups | Отдельная лadder, не влияет на Trophy Road |

${SEP}
## 2. СУНДУКИ (${CHEST_RARITY_ORDER.length} типов)
Параллельные дропы при открытии: боец (по таблице редкости) + питомец (независимый roll).

${chestLines}

${SEP}
## 3. ПИТОМЦЫ (${PETS.length} шт.)
Экипируется один на бойца. Эффект активен в бою.

${petLines}

${SEP}
## 4. КВЕСТЫ
- DAILY_QUEST_COUNT = 5 ежедневных
- WEEKLY_QUEST_COUNT недельных
- PAID_QUEST_COUNT платных (Star Guardian)
- Типы: победы, убийства, урон, режимы, открытие сундуков и т.д.
- dailyLadderDay — 30-дневная лестница бонусов
- dailyWins — до 10 побед в день с наградами

${SEP}
## 5. СОЦИАЛЬНЫЕ СИСТЕМЫ

### Друзья (friends)
- friends[], friendship XP, титулы дружбы
- Подарки → customization gifts
- Presence: menu / battle / results / offline

### Клубы (clubs)
- clubId, чат, казна, клубный boss raid
- Счётчик боёв клуба, аватар клуба (ClubAvatar)
- CreateClubModal — создание

### Party
- До 5 в лobby, код группы, suggest бойца, play again

### Сообщения (messages)
- inbox: system, gift, feedback-треды dev↔игрок

### Battle Feed
- Вкладки: global, mine, leaders, best
- Посты, лайки, реплеи, конкурсы

${SEP}
## 6. СКИНЫ БОЙЦОВ
- brawlerSkins в профиле
- 10 бойцов со скинами в игре: miya, ronin, yuki, kenji, hana, goro, sora, rin, taro, zafkiel (по 3 скина: Классик + 2 альтернативных)
- Референсы всех скинов — seed-заметка «Скины бойцов» в админке

${SEP}
## 7. АДМИН-ПАНЕЛЬ (17 вкладок)
| ID | Название | Назначение |
|----|----------|------------|
| deals | АКЦИИ | Daily deals, акции магазина |
| news | НОВОСТИ | Публикация новостей |
| gifts | ПОДАРКИ | Массовые подарки игрокам |
| players | ИГРОКИ | Поиск, бан, редактирование профилей |
| ai | ИИ / БОТЫ | Симуляции, обучение ботов |
| security | БЕЗОПАСНОСТЬ | Античит, логи |
| maps | КАРТЫ | Управление картами |
| trophies | КУБКИ | Настройка трофеев |
| characters | ПЕРСОНАЖИ | Баланс бойцов |
| economy | СТОИМОСТЬ | Экономика |
| chests | СУНДУКИ | Таблицы дропа |
| inbox | ВХОДЯЩИЕ | Рассылка сообщений |
| notifications | УВЕДОМЛЕНИЯ | Push/in-app |
| notes | ЗАМЕТКИ | Dev-notepad (этот документ) |
| schedule | РАСПИСАНИЕ | События по расписанию |
| techbreak | ТЕХ ПЕРЕРЫВ | Экран maintenance |
| models3d | 3D МОДЕЛИ | Превью 3D ассетов |

${SEP}
## 8. РЕДАКТОР КАРТ
- mapEditorModeSelect → mapeditor
- Рисование стен, кустов, spawn points
- Привязка к режиму игры

${SEP}
## 9. ТЕХНИЧЕСКИЙ СТЕК (для AI-анализа)
- React + TypeScript + Vite
- Three.js — 3D бойцы и питомцы в бою
- localStorage API — профили, заметки, баланс
- Режимы: src/modes/Clash*.ts
- Сущности: src/entities/ (Brawler, Bot, Projectile)
- AI: src/ai/refBotBehavior/

${SEP}
## 10. ИТОГОВАЯ СВОДКА
- ${BRAWLERS.length} бойцов, ${PETS.length} питомцев, ${CHEST_RARITY_ORDER.length} типов сундуков
- ${MODES.length} боевых режимов + training
- 35+ экранов, 17 вкладок админки
- Star Feats: 90 заданий, Clash Pass и Pro Star Pass по 100 уровней
- 6 звёзд созвездия × каждый боец = ${BRAWLERS.length * 6} уникальных бонусов

КОНЕЦ ПОЛНОЙ ЭНЦИКЛОПЕДИИ.`;
}

/** Split text into chunks under maxLen (for localStorage note limit). */
function splitText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    if (rest.length <= maxLen) {
      chunks.push(rest);
      break;
    }
    let cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  return chunks;
}

const MAX_PART = 95_000;

/** Returns seed note descriptors for ensureSeedNotes. */
export function buildGameReferenceParts(): GameReferencePart[] {
  const sections = [
    { key: "overview", title: "Обзор, меню, прогрессия", build: buildOverview },
    { key: "brawlers", title: "Все бойцы", build: buildBrawlersSection },
    { key: "modes", title: "Режимы и бой", build: buildModesAndBattle },
    { key: "economy", title: "Экономика и админка", build: buildEconomyAndAdmin },
  ];

  const parts: GameReferencePart[] = [];
  let partIndex = 0;

  for (const sec of sections) {
    const text = sec.build();
    const chunks = splitText(text, MAX_PART);
    for (let i = 0; i < chunks.length; i++) {
      partIndex += 1;
      const suffix = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : "";
      parts.push({
        id: `seed:game_full_reference_v1_${sec.key}${chunks.length > 1 ? `_${i + 1}` : ""}`,
        title: `📖 Энциклопедия игры — ${sec.title}${suffix}`,
        text: chunks[i]!,
      });
    }
  }

  return parts;
}
