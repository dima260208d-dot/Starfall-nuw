import { CHEST_RARITY_ORDER, type ChestRarity } from "../utils/chests";
import {
  computeTierOpenChances,
  formatTierChancePct,
  tierDropRows,
} from "../utils/chestDropChances";

/** Максимальный уровень прокачки бойца (включительно). */
export const MAX_BRAWLER_LEVEL = 11;

export interface BrawlerStats {
  id: string;
  name: string;
  role: string;
  rarity: ChestRarity;
  hp: number;
  speed: number;
  regenRate: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  attackCharges: number;
  superCooldown: number;
  // Percent of the super bar gained per successful hit on an enemy (0-100).
  // Super now charges *only* from landing hits — no passive/auto-charge.
  superChargePerHit: number;
  color: string;
  secondaryColor: string;
  accentColor: string;
  description: string;
  attackName: string;
  superName: string;
  attackDesc: string;
  superDesc: string;
  spriteRow: number;
  spriteCol: number;
}

// Russian labels for the chest-style rarity tiers when used on a brawler.
export const BRAWLER_RARITY_LABEL: Record<ChestRarity, string> = {
  common:         "Обычный",
  rare:           "Редкий",
  epic:           "Эпический",
  mega:           "Мега",
  legendary:      "Легендарный",
  mythic:         "Мифический",
  ultralegendary: "Ультралегендарный",
};

// Gem cost to unlock a brawler in the shop, scaled by rarity.
export const BRAWLER_GEM_COST: Record<ChestRarity, number> = {
  common:         20,
  rare:           60,
  epic:           150,
  mega:           300,
  legendary:      600,
  mythic:         1200,
  ultralegendary: 5000,
};

/** Minimum displayed / configured chance for a brawler of the chest's own tier. */
export const CHEST_BRAWLER_DROP_CHANCE: Record<ChestRarity, number> = {
  common:         0.025,
  rare:           0.05,
  epic:           0.10,
  mega:           0.15,
  mythic:         0.17,
  legendary:      0.25,
  ultralegendary: 0.37,
};

/** Brawler tiers that exist in-game (no «обычный» персонаж). */
export const BRAWLER_DROP_RARITIES: ChestRarity[] = CHEST_RARITY_ORDER.filter(
  r => r !== "common",
);

function brawlerMaxNormalTier(chestRarity: ChestRarity): ChestRarity {
  if (chestRarity === "common") return "rare";
  return chestRarity;
}

function brawlerFloorTier(chestRarity: ChestRarity): ChestRarity {
  if (chestRarity === "common") return "rare";
  return chestRarity;
}

/** Per-tier open chance for this chest (brawler rarities only). */
export function getChestBrawlerTierChances(
  chestRarity: ChestRarity,
): Partial<Record<ChestRarity, number>> {
  const floor = CHEST_BRAWLER_DROP_CHANCE[chestRarity];
  return computeTierOpenChances(
    BRAWLER_DROP_RARITIES,
    chestRarity,
    floor,
    brawlerMaxNormalTier(chestRarity),
    brawlerFloorTier(chestRarity),
  );
}

// Relative weights inside a tier when several brawlers share it (fallback).
export const CHEST_BRAWLER_RARITY_WEIGHTS: Record<ChestRarity, Partial<Record<ChestRarity, number>>> = {
  common:         { common: 1 },
  rare:           { common: 0.85, rare: 0.15 },
  epic:           { common: 0.6, rare: 0.3, epic: 0.1 },
  mega:           { common: 0.5, rare: 0.3, epic: 0.15, mega: 0.05 },
  mythic:         { common: 0.4, rare: 0.25, epic: 0.2, mega: 0.1, mythic: 0.05 },
  legendary:      { common: 0.35, rare: 0.25, epic: 0.2, mega: 0.12, legendary: 0.08 },
  ultralegendary: {
    common: 0.08, rare: 0.1, epic: 0.12, mega: 0.14,
    mythic: 0.28, legendary: 0.24, ultralegendary: 0.14,
  },
};

/** Highest brawler tier in the normal band for this chest. */
export function maxBrawlerTierIndexFromChest(chestRarity: ChestRarity): number {
  return BRAWLER_DROP_RARITIES.indexOf(brawlerMaxNormalTier(chestRarity));
}

/** Any brawler tier may be rolled; chances are near-zero above the normal band. */
export function brawlerCanDropFromChestTier(
  _brawlerRarity: ChestRarity,
  _chestRarity: ChestRarity,
): boolean {
  return true;
}

/** Weighted pick among brawlers using chest rarity table. */
export function pickWeightedBrawlerFromPool<T extends { rarity: ChestRarity }>(
  pool: T[],
  chestRarity: ChestRarity,
): T | null {
  if (pool.length === 0) return null;
  const weights = CHEST_BRAWLER_RARITY_WEIGHTS[chestRarity];
  let total = 0;
  const entries: { item: T; w: number }[] = [];
  for (const item of pool) {
    const w = weights[item.rarity] ?? 0;
    if (w <= 0) continue;
    total += w;
    entries.push({ item, w });
  }
  if (total <= 0 || entries.length === 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  let roll = Math.random() * total;
  for (const { item, w } of entries) {
    roll -= w;
    if (roll <= 0) return item;
  }
  return entries[entries.length - 1].item;
}

/** Floor chance: brawler of the chest's own tier (shown on chest card). */
export function getChestBrawlerFloorChance(chestRarity: ChestRarity): number {
  return CHEST_BRAWLER_DROP_CHANCE[chestRarity];
}

/** One roll: returns brawler rarity tier for this chest open, or null. */
export function rollChestBrawlerTier(chestRarity: ChestRarity): ChestRarity | null {
  const chances = getChestBrawlerTierChances(chestRarity);
  const entries = BRAWLER_DROP_RARITIES
    .filter(r => (chances[r] ?? 0) > 0)
    .map(r => ({ rarity: r, chance: chances[r]! }));
  if (entries.length === 0) return null;
  const rawTotal = entries.reduce((s, e) => s + e.chance, 0);
  const total = Math.min(0.99, rawTotal);
  if (Math.random() >= total) return null;
  let roll = Math.random() * rawTotal;
  for (const e of entries) {
    roll -= e.chance;
    if (roll <= 0) return e.rarity;
  }
  return entries[entries.length - 1].rarity;
}

/** Per-tier open chance rows for chest info UI. */
export function getBrawlerRarityDropRows(
  chestRarity: ChestRarity,
): { rarity: ChestRarity; label: string; pctLabel: string }[] {
  const chances = getChestBrawlerTierChances(chestRarity);
  const floorTier = brawlerFloorTier(chestRarity);
  return tierDropRows(
    BRAWLER_DROP_RARITIES,
    chances,
    floorTier,
    CHEST_BRAWLER_DROP_CHANCE[chestRarity],
    BRAWLER_RARITY_LABEL,
  ).map(row => ({
    rarity: row.tier as ChestRarity,
    label: row.label,
    pctLabel: row.pctLabel,
  }));
}

export function getChestBrawlerFloorPctLabel(chestRarity: ChestRarity): string {
  return formatTierChancePct(
    CHEST_BRAWLER_DROP_CHANCE[chestRarity],
    CHEST_BRAWLER_DROP_CHANCE[chestRarity],
  );
}

// Backstory/lore for each brawler, shown on the character detail page.
export const BRAWLER_LORE: Record<string, string> = {
  miya:    "Мия выросла в скрытой деревне теневых клинков. После того как враждебный клан уничтожил её дом, она поклялась вершить правосудие в одиночку. За один бросок она выпускает три сюрикена — те не знают промаха, а тренировки в искусстве телепортации сделали её самым быстрым убийцей в Арене.",
  ronin:   "Когда-то Ронин был генералом императорской армии. Преданный собственными лордами, он надел старые доспехи и стал вольным самураем. Его катана разрубает камень, а щит выдерживает залпы из десятка винтовок.",
  yuki:    "Юки родилась в горном храме, где училась искусству целительной магии льда. Она пришла в Арену, чтобы найти брата, пропавшего в одном из турниров. До тех пор она лечит союзников и замораживает любого, кто встанет на пути.",
  kenji:   "Кендзи — гениальный изобретатель, выгнанный из университета за «слишком опасные эксперименты». Его электрошокеры собраны из деталей старых автоматов, а молнии прыгают между врагами как живые. Он выходит на арену, чтобы доказать, что был прав.",
  hana:    "Хана — фронтовой медик из Розового госпиталя. Её пистолет одинаково хорошо лечит союзников и продырявливает броню врагов. Она верит, что добро и сила могут идти рука об руку, и ни разу не сдалась перед безнадёжным пациентом.",
  goro:    "Горо — горный варвар, сошедший с северных вершин. Он не помнит своего детства, но помнит вкус победы. Двойные топоры он выковал собственными руками, и ни один щит не выдерживал двух его ударов подряд.",
  sora:    "Сора — придворный маг, изгнанный за то, что осмелился изучать запретные звёздные руны. Его летающая книга шепчет ему древние формулы, а метеоритный дождь оставляет шрамы на самой арене.",
  rin:     "Рин выросла в зелёных джунглях среди ядовитых растений. Каждый её кинжал смазан личным составом яда, формулу которого не знает никто. Она появляется бесшумно, отравляет цель и исчезает в зарослях прежде, чем кто-то успеет среагировать.",
  taro:    "Таро — пожилой инженер, который собрал свой первый шагоход в шесть лет. Гаечный ключ в его руках — оружие пострашнее меча, а турели, что он расставляет на поле боя, держат позиции часами. Не недооценивайте старика.",
  zafkiel: "Зафкиэль — хранитель времени и пространства, последний из ордена Хроностражей. Он управляет потоками времени, возвращая врагов в прошлое или ускоряя их к неизбежной судьбе. Его Врата Вечности — точка, где прошлое и будущее сливаются в одно мгновение. Те, кто встаёт на его пути, обнаруживают, что их движения уже давно предрешены.",
  verdeletta: "Верделетта — адский церемонимейстер. Она организует самые хаотичные и опасные торжества в преисподней. Её задача — развлекать грешников и демонов, но она давно вышла за рамки протокола. Верделетта устраивает «вечеринки» прямо в мире живых, приглашая всех без разбора. Её волшебный пистолет — не оружие, а инструмент приглашения. Те, кого она метит, становятся гостями её теневого бала. А тени... тени всегда находят тех, кто не заплатил за вход. Говорят, что увидеть свою тень, шевелящуюся отдельно — значит, Верделетта уже выбрала вас для следующего торжества. Отказаться нельзя. Потому что это ад.",
  lumina: "Люмина — дочь падшего ангела и смертной женщины. Она не помнит небес, но её крылья светятся тоской по дому. Говорят, что её световые нити связывают не только врагов, но и потерянные души, помогая им найти покой. В бою она не убивает — она примиряет, запирая противников в золотой клетке правосудия.",
  oliver: "Оливер — гениальный механик, чьи механические жуки — уменьшенные копии его умершего брата, превращённого в машину. Он научился копировать вражеские суперы, потому что считает, что любой дар можно использовать во благо. Однако его репликатор хранит и память о том, как жук-брат однажды спас ему жизнь.",
  callista: "Каллиста — алхимик, которая взорвала свою лабораторию, пытаясь создать лекарство от всех болезней. После этого она носит очки с разноцветными линзами, потому что каждый свой реактив видит в новом свете. Её супер — взрывная смесь всех рецептов, которые она накопила. Она не знает, вылечит это или убьёт, но готова рискнуть ради науки.",
  airin: "Айрин — бывший военный лётчик королевства стимпанк, которую предали и бросили в дымовой ловушке. Она выжила, но с тех пор носит очки на лбу и дымовые шашки. Её эвакуация спасает не только тела, но и души — она верит, что каждый заслуживает второго шанса. Даже врагам.",
  silven: "Сильвен был обычным мальчиком-лешим, пока люди не выжгли его лес. Оставшись один, он отдал своё сердце древнему дубу, и тот ответил. Теперь Сильвен сажает деревья жизни везде, где проходит бой.",
  vittoria: "Виттория — последняя из вампирского рода, уничтоженного охотниками. Она носит кастет с шипами не для убийства, а как память о брате, который заслонил её собой. Кровавая луна — её проклятие и благословение: чем больше жизней она забирает, тем дольше может сражаться. Но она мечтает лишь о том, чтобы однажды лечить, а не кусать.",
  octavia: "Октавия — русалка-мутант из подземного озера, которое отравили алхимики. Её щупальца — результат экспериментов. Чернила, которые она оставляет, ядовиты для врагов, но для союзников они как туман, скрывающий их от опасности. Она ищет способ очистить воду, но пока что её ловушки с щупальцами хватают лишь тех, кто не верит в чудеса.",
  zephyrin: "Зефирин — дух ветра, который устал быть невидимым. Она приняла форму девушки, чтобы почувствовать, что значит быть уязвимой. Её торнадо — это её попытки обнять мир, но они отбрасывают врагов прочь. В моменты неуязвимости она становится чистой воздушной субстанцией, недосягаемой для чужой боли. Она ищет того, кто сможет остановить её ветер.",
  mirabel: "Мирабель выросла в библиотеке академии, где каждая книга шептала ей тайны. Она не стреляет огнём — она бросает искры знания, ускоряя союзников быстрее, чем враги успевают понять, что произошло. Её супер «Ускоренное обучение» превращает целую команду в мастеров, чьи следующие удары приходят дважды.",
};

export const BRAWLERS: BrawlerStats[] = [
  // New playable brawlers: append here — they auto-enter getBotPool() for AI spawns.
  {
    id: "miya",
    name: "Мия",
    role: "Ассасин",
    rarity: "legendary",
    hp: 3600,
    speed: 5.2,
    regenRate: 360,
    attackDamage: 400,
    attackRange: 220,
    attackCooldown: 1.2,
    attackCharges: 3,
    superCooldown: 20,
    superChargePerHit: 8,
    color: "#7B2FBE",
    secondaryColor: "#4A0080",
    accentColor: "#FF1744",
    description: "Девушка-ниндзя с фиолетовыми волосами; в бою бросает три сюрикена веером",
    attackName: "Теневые клинки",
    superName: "Разрыв реальности",
    attackDesc: "Мия быстро бросает 3 сюрикена веером: центральный летит прямо на 220 ед., боковые — под углом ±15° от прицела. Каждый наносит 400 урона при попадании (до 1200 суммарно, если все три попадут). 3 заряда атаки, перезарядка 1.2 сек. Удобно перекрывать коридор или добивать цель плотным веером и сразу отступать.",
    superDesc: "Мия мгновенно телепортируется за спину ближайшему врагу в радиусе 400 ед., наносит ему усиленный удар и накладывает замедление -40% на 2 секунды; сама получает +20% скорости на 1 сек. Используй супер → три заряда атаки по три сюрикена (до 9 снарядов подряд) для добивания.",
    spriteRow: 0,
    spriteCol: 0,
  },
  {
    id: "ronin",
    name: "Ронин",
    role: "Танк",
    rarity: "epic",
    hp: 5500,
    speed: 3.2,
    regenRate: 240,
    attackDamage: 300,
    attackRange: 160,
    attackCooldown: 1.4,
    attackCharges: 2,
    superCooldown: 22,
    superChargePerHit: 18,
    color: "#B71C1C",
    secondaryColor: "#FFD700",
    accentColor: "#FF6F00",
    description: "Огромный самурай в красных доспехах с катаной",
    attackName: "Столб земли",
    superName: "Несокрушимая стена",
    attackDesc: "Ронин делает широкий взмах катаной, поражая всех в конусе 60° перед собой (дальность 160 ед.). Наносит 300 урона каждой цели. 2 заряда, перезарядка 1.4 сек — можно нанести 2 удара подряд (до 600 одной цели). Чем ближе враг — тем выше вероятность обоих попаданий.",
    superDesc: "Ронин поднимает бронированный щит на 5 секунд: входящий урон снижается на 50%, а 30% поглощённого урона отражается обратно атакующему. Скорость снижается на 15%, но атаки катаной продолжаются. Оптимален для принятия огня группы врагов — наносит им reflected-урон суммарно.",
    spriteRow: 0,
    spriteCol: 2,
  },
  {
    id: "yuki",
    name: "Юки",
    role: "Поддержка",
    rarity: "mega",
    hp: 3200,
    speed: 4.2,
    regenRate: 420,
    attackDamage: 200,
    attackRange: 350,
    attackCooldown: 1.0,
    attackCharges: 3,
    superCooldown: 18,
    superChargePerHit: 14,
    color: "#0288D1",
    secondaryColor: "#E1F5FE",
    accentColor: "#B2EBF2",
    description: "Девушка в синем кимоно с посохом и снежинкой",
    attackName: "Снежный шар",
    superName: "Исцеляющий снег",
    attackDesc: "Юки выпускает ледяной шар прямолинейно на 350 ед. При попадании: 200 урона + мгновенное замедление цели на -35% движения и скорострельности на 2 сек. 3 заряда, перезарядка 1.0 сек. Три быстрых броска могут одновременно замедлить 3 врагов — идеально для контроля при прорывах.",
    superDesc: "Юки выпускает снежный вихрь — исцеляющее облако радиусом 140 ед. на 6 секунд. Союзники внутри восстанавливают 300 ХП/сек (до 1800 ХП суммарно), враги замедляются на 25%. Облако стоит на месте — расставляй его на точке захвата, за прикрытием или под обстрелом для максимальной эффективности.",
    spriteRow: 0,
    spriteCol: 3,
  },
  {
    id: "kenji",
    name: "Кендзи",
    role: "Контроллер",
    rarity: "epic",
    hp: 4000,
    speed: 3.8,
    regenRate: 330,
    attackDamage: 250,
    attackRange: 200,
    attackCooldown: 1.3,
    attackCharges: 2,
    superCooldown: 20,
    superChargePerHit: 16,
    color: "#F9A825",
    secondaryColor: "#212121",
    accentColor: "#40C4FF",
    description: "Парень в жёлтом костюме с электрошокерами на руках",
    attackName: "Электрическая цепь",
    superName: "Клетка молний",
    attackDesc: "Кендзи выпускает молнию (дальность 200 ед.), которая прыгает цепью: первая цель — 250 урона, вторая в радиусе 130 ед. — 175 (70%), третья — 120 (48%). 2 заряда, перезарядка 1.3 сек. В плотных группах наносит до 545 суммарного урона одним выстрелом.",
    superDesc: "Кендзи создаёт электрическую клетку радиусом 110 ед. на 5 секунд. Все враги внутри получают 200 урона/сек от электрошока (до 1000 суммарно) и замедляются на 50%. Клетка видима — заставляй врагов выбирать: оставаться и гореть или выходить под атаки союзников у краёв.",
    spriteRow: 0,
    spriteCol: 4,
  },
  {
    id: "hana",
    name: "Хана",
    role: "Хилер",
    rarity: "rare",
    hp: 3000,
    speed: 4.5,
    regenRate: 480,
    attackDamage: 150,
    attackRange: 400,
    attackCooldown: 0.9,
    attackCharges: 4,
    superCooldown: 16,
    superChargePerHit: 12,
    color: "#E91E8C",
    secondaryColor: "#FCE4EC",
    accentColor: "#FF80AB",
    description: "Девушка в розовом медицинском халате с лечебным пистолетом",
    attackName: "Лечебная пуля",
    superName: "Цветущий сад",
    attackDesc: "Хана стреляет розовой пулей (дальность 400 ед.) с двойным режимом: если прицел на союзнике — лечит его на 150 ХП; если на враге — наносит 150 урона. 4 заряда, перезарядка 0.9 сек. На пиковой скорострельности: лечение 600 ХП/сек союзника или 600 урона/сек врагу — один из лучших показателей DPS и хила.",
    superDesc: "Хана создаёт цветущий сад радиусом 160 ед. на 5 секунд. Союзники внутри получают 200 ХП/сек исцеления (до 1000 ХП) и +20% к скорости передвижения. Хана продолжает стрелять в пределах или вне сада. Идеален для медленных танков — резко повышает их выживаемость под огнём. Комбинируй с Ронином или Горо.",
    spriteRow: 1,
    spriteCol: 0,
  },
  {
    id: "goro",
    name: "Горо",
    role: "Берсерк",
    rarity: "mythic",
    hp: 6200,
    speed: 2.9,
    regenRate: 210,
    attackDamage: 450,
    attackRange: 90,
    attackCooldown: 1.5,
    attackCharges: 2,
    superCooldown: 22,
    superChargePerHit: 20,
    color: "#8D4E2B",
    secondaryColor: "#FF3D00",
    accentColor: "#BF360C",
    description: "Огромный бородатый мужчина с двумя боевыми топорами",
    attackName: "Двойной топор",
    superName: "Ярость берсерка",
    attackDesc: "Горо вращается на 360°, атакуя двумя топорами всех в радиусе 90 ед. вокруг — 450 урона каждому. 2 заряда, перезарядка 1.5 сек. В плотной группе из 3 врагов наносит 2700 суммарного урона за два оборота. Лучший ближний AoE в игре — зайди в центр группы и активируй два заряда подряд.",
    superDesc: "Горо впадает в ярость берсерка на 5 секунд: +40% к скорости передвижения и +50% к урону каждого удара (450 × 1.5 = 675 за оборот). В режиме берсерка мобильность Горо позволяет догнать любого врага. Комбо: включи супер → рви в ближний бой → два оборота = 1350 урона одной цели за 3 секунды.",
    spriteRow: 1,
    spriteCol: 1,
  },
  {
    id: "sora",
    name: "Сора",
    role: "Маг",
    rarity: "mega",
    hp: 3400,
    speed: 4.0,
    regenRate: 270,
    attackDamage: 300,
    attackRange: 400,
    attackCooldown: 1.1,
    attackCharges: 3,
    superCooldown: 24,
    superChargePerHit: 14,
    color: "#1A237E",
    secondaryColor: "#FFD700",
    accentColor: "#FF6F00",
    description: "Парень в синей мантии с летающей книгой заклинаний",
    attackName: "Огненный шар",
    superName: "Метеоритный дождь",
    attackDesc: "Сора выпускает огненный шар (дальность 400 ед.): прямое попадание — 300 урона + взрыв в радиусе 60 ед. — 150 урона всем рядом. Суммарно 450 по одной цели в эпицентре. 3 заряда, перезарядка 1.1 сек. Против групп каждый выстрел поражает несколько целей взрывной волной — мощный контроль площади.",
    superDesc: "Сора вызывает дождь из 5 метеоров в выбранной зоне за 3 секунды. Каждый метеор: 250 урона при ударе + взрыв в радиусе 70 ед. (дополнительный урон). По одной цели — до 1250 суммарно. Падение случайно в кругу 120 ед. от прицела. Эффективен против плотных групп, засевших за прикрытием или на точке захвата.",
    spriteRow: 1,
    spriteCol: 2,
  },
  {
    id: "rin",
    name: "Рин",
    role: "Отравитель",
    rarity: "legendary",
    hp: 3300,
    speed: 5.0,
    regenRate: 300,
    attackDamage: 350,
    attackRange: 300,
    attackCooldown: 1.0,
    attackCharges: 3,
    superCooldown: 19,
    superChargePerHit: 13,
    color: "#2E7D32",
    secondaryColor: "#8BC34A",
    accentColor: "#CE93D8",
    description: "Девушка с зелёными волосами и ядовитыми кинжалами",
    attackName: "Отравленный кинжал",
    superName: "Облако яда",
    attackDesc: "Рин бросает отравленный кинжал (дальность 300 ед.): 350 урона при попадании + яд на 3 секунды (100 урона/сек = 300 ДоТ). Итого 650 урона с одного броска. 3 заряда, перезарядка 1.0 сек. Яд не суммируется — новый бросок обновляет таймер. Оптимальная стратегия: поддерживать яд постоянно, добивая через кинжалы.",
    superDesc: "Рин метает ядовитую гранату, создавая облако радиусом 100 ед. на 4 секунды. Все враги внутри получают 150 урона/сек (до 600 суммарно). Можно комбинировать с кинжалами: яд от гранаты + яд от кинжала = двойной урон по времени. Облако прозрачно — враги не всегда замечают его, пока не получат урон от первого тика.",
    spriteRow: 1,
    spriteCol: 3,
  },
  {
    id: "taro",
    name: "Таро",
    role: "Инженер",
    rarity: "rare",
    hp: 3700,
    speed: 3.5,
    regenRate: 240,
    attackDamage: 400,
    attackRange: 80,
    attackCooldown: 0.8,
    attackCharges: 3,
    superCooldown: 25,
    superChargePerHit: 16,
    color: "#5D4037",
    secondaryColor: "#CD9B39",
    accentColor: "#78909C",
    description: "Старик с гаечным ключом и механическим рюкзаком",
    attackName: "Гаечный ключ",
    superName: "Турель",
    attackDesc: "Таро наносит мощный удар гаечным ключом (дальность 80 ед.): 400 урона основной цели + 80 урона всем врагам в радиусе 50 ед. вокруг точки удара (взрывная волна). 3 заряда, перезарядка 0.8 сек. Высокий DPS в ближнем бою — если стоять вплотную, за 3 удара можно нанести 1200 чистого урона одной цели.",
    superDesc: "Таро мгновенно устанавливает боевую турель в текущей позиции: 200 ХП, дальность обнаружения 250 ед., стреляет каждые 0.6 сек по 150 урона ближайшему врагу (DPS турели: 250/сек). Живёт 12 сек или до уничтожения. Новая турель заменяет старую. Тактика: поставь у прохода и атакуй с другой стороны — враги оказываются под двойным огнём.",
    spriteRow: 1,
    spriteCol: 4,
  },
  {
    id: "zafkiel",
    name: "Зафкиэль",
    role: "Контроллер/Стратег",
    rarity: "ultralegendary",
    hp: 3800,
    speed: 4.2,
    regenRate: 325,
    attackDamage: 350,
    attackRange: 375,
    attackCooldown: 1.4,
    attackCharges: 3,
    superCooldown: 22,
    superChargePerHit: 13,
    color: "#9C27B0",
    secondaryColor: "#4A148C",
    accentColor: "#FFD700",
    description: "Хранитель времени с пистолями и механизмом песочных часов",
    attackName: "Цикл времени",
    superName: "Врата Вечности",
    attackDesc: "Зафкиэль использует 3 уникальных заряда по очереди: ① Далет (зелёный) — снаряд телепортирует цель туда, где она была 2 секунды назад, сбрасывая импульс движения. ② Бет (синий) — снаряд замедляет цель на -40% скорости и скорострельности на 3 секунды. ③ Заин (жёлтый) — снаряд станит цель на 0.6 сек (полная остановка). После активации супера 3 следующих заряда становятся усиленными: Алеф (×2 скорость полёта снаряда), Гимель (яд 100 урона/сек на 3 сек), Йуд (самонаводящийся снаряд, преследует ближайшего врага). Перезарядка 1.4 сек, дальность 375 ед.",
    superDesc: "Зафкиэль открывает Врата Вечности — временную аномалию радиусом 120 ед. на 4 секунды. Все враги внутри каждую секунду откатываются на 2 секунды назад по своей траектории: теряют позицию, скорость и набранный импульс. Фактически превращает область в ловушку — враги не могут через неё пройти без потерь. После активации Зафкиэль получает 3 усиленных заряда (Алеф/Гимель/Йуд), кардинально меняя стиль атаки на следующие 3 выстрела.",
    spriteRow: 2,
    spriteCol: 0,
  },
  {
    id: "verdeletta",
    name: "Верделетта",
    role: "Контроллер/Призыватель",
    rarity: "ultralegendary",
    hp: 4000,
    speed: 4.0,
    regenRate: 330,
    attackDamage: 600,
    attackRange: 225,
    attackCooldown: 1.2,
    attackCharges: 3,
    superCooldown: 20,
    superChargePerHit: 25,
    color: "#2E7D32",
    secondaryColor: "#1B5E20",
    accentColor: "#69F0AE",
    description: "Адский церемонимейстер; устраивает «вечеринки» в мире живых и зовёт всех на теневой бал",
    attackName: "Адское приглашение",
    superName: "Бал сатаны",
    attackDesc: "Выстрел из волшебного пистолета — не атака, а пригласительный билет. Пуля летит на ~225 ед. (4.5 клетки), наносит 600 урона и накладывает Адскую Метку на 2 сек.: на цели вспыхивает зелёная руна, а рядом с Верделеттой материализуется обычная тень-гостья (1200 HP, дальний бой, 350 урона). 3 заряда, перезарядка 1.2 сек. Супер заряжается только её собственными попаданиями — 4 прямых выстрела до полного заряда. На карте одновременно не больше 6 теней; при превышении исчезает самая старая.",
    superDesc: "Верделетта объявляет открытие главного зала преисподней и призывает 3 тени-распорядителя (4500 HP, 600 урона, дальний бой). Они медленнее гостей, но мощнее и держат дистанцию, стреляя теневыми болтами. Каждая тень идёт по своей траектории и не сбивается в кучу. Если распорядитель убивает врага — на месте жертвы появляется ещё один распорядитель. Суммарный лимит — 6 теней на поле. Удары теней не заряжают супер Верделетты.",
    spriteRow: 2,
    spriteCol: 1,
  },
  {
    id: "lumina",
    name: "Люмина",
    role: "Поддержка",
    rarity: "mythic",
    hp: 3800,
    speed: 4.2,
    regenRate: 330,
    attackDamage: 1200,
    attackRange: 250,
    attackCooldown: 1.5,
    attackCharges: 2,
    superCooldown: 22,
    superChargePerHit: 20,
    color: "#ECEFF1",
    secondaryColor: "#FFD54F",
    accentColor: "#FFFFFF",
    description: "Мифическая девушка со светящимися крыльями; связывает врагов золотыми нитями",
    attackName: "Световая нить",
    superName: "Божественное заточение",
    attackDesc: "Тонкий золотистый луч из груди бьёт первого врага на 5 клеток (1200 урона), затем ищет второго в радиусе 4 клеток и связывает их золотой цепью на 3 сек.: 100 урона/сек и невидимая стена не дальше 3 клеток. 2 заряда, перезарядка 1.5 сек. Супер заряжается за 5 попаданий или 3 успешные связки.",
    superDesc: "Над областью (радиус 120px) появляется мерцающий золотой купол с рунами на 4 сек. Внутри все замедлены на 50%, не могут выйти и связываются золотыми нитями. Урон не наносит.",
    spriteRow: 2,
    spriteCol: 2,
  },
  {
    id: "oliver",
    name: "Оливер",
    role: "Инженер",
    rarity: "mythic",
    hp: 4000,
    speed: 4.0,
    regenRate: 355,
    attackDamage: 132,
    attackRange: 250,
    attackCooldown: 1.6,
    attackCharges: 2,
    superCooldown: 22,
    superChargePerHit: 20,
    color: "#795548",
    secondaryColor: "#FFD54F",
    accentColor: "#42A5F5",
    description: "Мальчик с русыми волосами, круглыми очками и механическими жуками",
    attackName: "Рой механических жуков",
    superName: "Репликатор",
    attackDesc: "Оливер выпускает 5 бронзовых жуков из руки: каждый ищет ближайшего врага в радиусе 5 клеток и наносит 220 урона при контакте. Жуки живут 3 сек., летят по прямой. Дальность 5 клеток, 2 заряда, перезарядка 1.6 сек. Супер заряжается за 5 попаданий.",
    superDesc: "Оливер запоминает последний супер любого врага и копирует его с теми же параметрами в выбранном направлении. Память не стирается — можно копить. Перезарядка супера 22 сек.",
    spriteRow: 2,
    spriteCol: 3,
  },
  {
    id: "callista",
    name: "Каллиста",
    role: "Поддержка",
    rarity: "epic",
    hp: 4700,
    speed: 4.0,
    regenRate: 355,
    attackDamage: 750,
    attackRange: 200,
    attackCooldown: 1.3,
    attackCharges: 3,
    superCooldown: 22,
    superChargePerHit: 20,
    color: "#43A047",
    secondaryColor: "#FFFFFF",
    accentColor: "#A5D6A7",
    description: "Эпическая алхимик с зелёными волосами, очками-конвертерами и колбами на поясе",
    attackName: "Случайный реактив",
    superName: "Взрывная смесь",
    attackDesc: "Бросок колбы по дуге на 4 клетки: случайный эффект в зоне 100px — кислота 750 урона, заморозка −40% на 2с, яд 350/сек 4с или лечение союзников 800 HP. 3 заряда, CD 1.3 сек. Супер: 5 попаданий.",
    superDesc: "Большая колба создаёт зону 120px на 4 сек. с сразу всеми четырьмя эффектами одновременно.",
    spriteRow: 2,
    spriteCol: 4,
  },
  {
    id: "elian",
    name: "Элиан",
    role: "Маг",
    rarity: "legendary",
    hp: 3700,
    speed: 4.0,
    regenRate: 350,
    attackDamage: 500,
    attackRange: 300,
    attackCooldown: 1.4,
    attackCharges: 3,
    superCooldown: 22,
    superChargePerHit: 25,
    color: "#1565C0",
    secondaryColor: "#FFD54F",
    accentColor: "#E3F2FD",
    description: "Легендарный юноша в пальто со звёздами",
    attackName: "Звёздный заряд",
    superName: "Гравитационная аномалия",
    attackDesc: "Медленный голубой шар до 6 клеток: урон и радиус взрыва растут с дистанцией (500/700/1000, радиус 60/70/130). 3 заряда, CD 1.4 сек. Супер: 4 попадания.",
    superDesc: "Тёмно-синяя воронка на 5 клеток: 3 сек. притягивает врагов в 150px (2 клетки/сек), затем взрыв на 600 урона. Притяжение не оглушает, но мешает двигаться.",
    spriteRow: 2,
    spriteCol: 6,
  },
  {
    id: "airin",
    name: "Айрин",
    role: "Стрелок",
    rarity: "epic",
    hp: 4000,
    speed: 4.3,
    regenRate: 360,
    attackDamage: 800,
    attackRange: 225,
    attackCooldown: 1.3,
    attackCharges: 3,
    superCooldown: 22,
    superChargePerHit: 100 / 6,
    color: "#37474F",
    secondaryColor: "#78909C",
    accentColor: "#B0BEC5",
    description: "Эпическая лётчица в стимпанк-стиле с дымовыми шашками",
    attackName: "Дымовая метка",
    superName: "Эвакуация",
    attackDesc: "Бросок металлической капсулы по дуге на 4.5 клетки: взрыв создаёт дым 150px — 800 урона и обзор врагов сокращается до 2 клеток на 2 сек. 3 заряда, CD 1.3 сек. Супер: 6 попаданий.",
    superDesc: "Серебряный знак над Айрин: союзники в радиусе 200px телепортируются к ней, с них снимаются все отрицательные эффекты.",
    spriteRow: 2,
    spriteCol: 5,
  },
  {
    id: "silven",
    name: "Сильвен",
    role: "Контроллер",
    rarity: "epic",
    hp: 4200,
    speed: 3.8,
    regenRate: 365,
    attackDamage: 950,
    attackRange: 250,
    attackCooldown: 1.4,
    attackCharges: 2,
    superCooldown: 22,
    superChargePerHit: 20,
    color: "#558B2F",
    secondaryColor: "#33691E",
    accentColor: "#AED581",
    description: "Эпический мальчик-леший с корнями вместо ног",
    attackName: "Колючий плющ",
    superName: "Древо жизни",
    attackDesc: "Зелёная лоза по земле до 5 клеток: 950 урона, −30% на 1 сек. Если враг уже замедлен — обездвиживает на 1.5 сек. (может атаковать). 2 заряда, CD 1.4 сек. Супер: 5 попаданий.",
    superDesc: "Сажает дерево жизни на 3 клетки: 1000 HP, лечит союзников в 150px на 100 HP/сек, пока не разрушат.",
    spriteRow: 2,
    spriteCol: 7,
  },
  {
    id: "vittoria",
    name: "Виттория",
    role: "Берсерк",
    rarity: "epic",
    hp: 3900,
    speed: 4.4,
    regenRate: 350,
    attackDamage: 750,
    attackRange: 125,
    attackCooldown: 1.1,
    attackCharges: 3,
    superCooldown: 22,
    superChargePerHit: 14.3,
    color: "#6A1B9A",
    secondaryColor: "#212121",
    accentColor: "#CE93D8",
    description: "Эпическая вампирша с шипованным кастетом",
    attackName: "Укус вампира",
    superName: "Кровавая луна",
    attackDesc: "Выпад кастетом на 2.5 клетки: 750 урона и лечит на 30% от урона. 3 заряда, CD 1.1 сек. Супер: 7 попаданий.",
    superDesc: "На 5 сек. атаки лечат на 80% урона, +23% скорости и +25% урона. Глаза светятся красным под багровой луной.",
    spriteRow: 2,
    spriteCol: 8,
  },
  {
    id: "octavia",
    name: "Октавия",
    role: "Контроллер",
    rarity: "epic",
    hp: 4800,
    speed: 4.1,
    regenRate: 360,
    attackDamage: 200,
    attackRange: 250,
    attackCooldown: 1.3,
    attackCharges: 2,
    superCooldown: 22,
    superChargePerHit: 20,
    color: "#EC407A",
    secondaryColor: "#F8BBD0",
    accentColor: "#F48FB1",
    description: "Эпическая русалка-мутант с щупальцами вместо ног",
    attackName: "Чернильная завеса",
    superName: "Ловушка с щупальцами",
    attackDesc: "Чёрно-фиолетовый шар: полоса чернил 60×120px на 4 сек. Союзники в чернилах невидимы для врагов (кроме атак), враги: 100 урона/сек и −30% скорости. 2 заряда, CD 1.3 сек. Супер: 5 попаданий.",
    superDesc: "В точке (4 клетки) вырываются розовые щупальца: зона 100px, корень 1.5 сек и 600 урона при захвате. Зона 3 сек без новых захватов.",
    spriteRow: 2,
    spriteCol: 9,
  },
  {
    id: "zephyrin",
    name: "Зефирин",
    role: "Маг",
    rarity: "legendary",
    hp: 3800,
    speed: 4.3,
    regenRate: 355,
    attackDamage: 900,
    attackRange: 250,
    attackCooldown: 1.2,
    attackCharges: 3,
    superCooldown: 22,
    superChargePerHit: 20,
    color: "#AB47BC",
    secondaryColor: "#E1BEE7",
    accentColor: "#FFFFFF",
    description: "Легендарная девушка из ветра с полупрозрачным платьем",
    attackName: "Вихрь",
    superName: "Неуязвимость",
    attackDesc: "Серо-белый торнадо летит по прямой до 5 клеток: 900 урона. Каждая 3-я атака отбрасывает врагов на 2 клетки (зарядный выстрел подсвечивается жёлтым). Проходит сквозь врагов. 3 заряда, CD 1.2 сек. Супер: 5 попаданий.",
    superDesc: "На 4 сек. полная неуязвимость к урону и эффектам, но без атак и супера. Скорость +50%. После окончания — эффекты звёзд.",
    spriteRow: 2,
    spriteCol: 10,
  },
  {
    id: "mirabel",
    name: "Мирабель",
    role: "Поддержка",
    rarity: "rare",
    hp: 3500,
    speed: 4.2,
    regenRate: 360,
    attackDamage: 950,
    attackRange: 225,
    attackCooldown: 1.2,
    attackCharges: 3,
    superCooldown: 22,
    superChargePerHit: 100 / 6,
    color: "#E53935",
    secondaryColor: "#FFCDD2",
    accentColor: "#FF7043",
    description: "Редкая девочка с волшебной книгой; искры знаний ускоряют союзников",
    attackName: "Искра знаний",
    superName: "Ускоренное обучение",
    attackDesc: "Из книги вылетает жёлтая искра на 4.5 клетки: 950 урона. При попадании союзники в радиусе 100px от врага получают −0.3 сек. перезарядки атак. 3 заряда, CD 1.2 сек. Супер: 6 попаданий.",
    superDesc: "Над союзниками в радиусе 500px появляется светящаяся книга: 5 сек. следующая атака каждого двойная (два снаряда с полным уроном), бафф сгорает после выстрела.",
    spriteRow: 2,
    spriteCol: 11,
  },
];

/** Brawlers that use meleeAttack() instead of projectiles. */
export const MELEE_BRAWLER_IDS: readonly string[] = ["goro", "ronin", "taro", "vittoria"];

export function isMeleeBrawler(id: string): boolean {
  return MELEE_BRAWLER_IDS.includes(id);
}

function shuffleBrawlers<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Playable brawlers eligible as AI bots/allies. Add new fighters to `BRAWLERS` only —
 * they join this pool automatically with equal spawn weight.
 */
export function getBotPool(...excludeIds: string[]): BrawlerStats[] {
  const exclude = new Set(excludeIds.filter(Boolean));
  return BRAWLERS
    .filter(b => !exclude.has(b.id))
    .map(b => getBrawlerById(b.id) ?? b);
}

/** Fisher–Yates shuffle; cycles if `count` exceeds pool size. */
export function pickBotStats(playerBrawlerId: string, count: number): BrawlerStats[] {
  const pool = getBotPool(playerBrawlerId);
  if (pool.length === 0) {
    const fallback = getBrawlerById(BRAWLERS[0].id) ?? BRAWLERS[0];
    return Array.from({ length: count }, () => fallback);
  }
  const shuffled = shuffleBrawlers(pool);
  const result: BrawlerStats[] = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]!);
  }
  return result;
}

/** Unique brawler ids first; repeats only if the pool is smaller than `count`. */
export function pickUniqueBotIds(excludeIds: string[], count: number): string[] {
  const pool = getBotPool(...excludeIds);
  if (pool.length === 0) {
    return Array.from({ length: count }, () => BRAWLERS[0].id);
  }
  const shuffled = shuffleBrawlers(pool);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(shuffled[i % shuffled.length].id);
  }
  return out;
}

export function pickRandomBotStats(...excludeIds: string[]): BrawlerStats {
  const pool = getBotPool(...excludeIds);
  return pool[Math.floor(Math.random() * pool.length)] ?? getBrawlerById(BRAWLERS[0].id) ?? BRAWLERS[0];
}

export function getBrawlerById(id: string): BrawlerStats | undefined {
  const base = BRAWLERS.find((b) => b.id === id);
  if (!base) return undefined;
  if (typeof localStorage === "undefined") return { ...base };
  try {
    const raw = localStorage.getItem("clash_character_balance_v1");
    if (!raw) return { ...base };
    const parsed = JSON.parse(raw) as { brawlers?: Record<string, Partial<BrawlerStats>> };
    const patch = parsed.brawlers?.[id];
    return patch ? { ...base, ...patch } : { ...base };
  } catch {
    return { ...base };
  }
}

export function getScaledStats(brawler: BrawlerStats, level: number) {
  const lvl = Math.max(1, Math.min(MAX_BRAWLER_LEVEL, level));
  let hpScale = 0.05;
  let dmgScale = 0.03;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem("clash_character_balance_v1") : null;
    if (raw) {
      const e = (JSON.parse(raw) as { economy?: { scaleHpPerLevel?: number; scaleDmgPerLevel?: number } }).economy;
      if (e?.scaleHpPerLevel != null && Number.isFinite(e.scaleHpPerLevel)) hpScale = e.scaleHpPerLevel;
      if (e?.scaleDmgPerLevel != null && Number.isFinite(e.scaleDmgPerLevel)) dmgScale = e.scaleDmgPerLevel;
    }
  } catch { /* ignore */ }
  return {
    hp: Math.floor(brawler.hp * (1 + hpScale * (lvl - 1))),
    attackDamage: Math.floor(brawler.attackDamage * (1 + dmgScale * (lvl - 1))),
    speed: brawler.speed,
    regenRate: brawler.regenRate,
    attackCooldown: brawler.attackCooldown,
    attackCharges: brawler.attackCharges,
    attackRange: brawler.attackRange,
  };
}
