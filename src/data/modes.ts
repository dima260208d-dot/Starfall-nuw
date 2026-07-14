import type { GameMode } from "../App";

export interface ModeInfo {
  id: GameMode;
  name: string;
  subtitle: string;
  desc: string;
  players: string;
  icon: string;
  color: string;
  gradient: string;
  mapName: string;
}

export const MODES: ModeInfo[] = [
  {
    id: "showdown",
    name: "Star Battle",
    subtitle: "Столкновение",
    desc: "Выберите формат: одиночное, парное или тройное. Газ постепенно сжимает арену, а усиления из ящиков и банок помогают пережить финал.",
    players: "Одиночное 10 • Парное 10 • Тройное 12",
    icon: "⚔️",
    color: "#FF5252",
    gradient: "linear-gradient(135deg, #B71C1C, #FF5252)",
    mapName: "Заброшенный храм",
  },
  {
    id: "crystals",
    name: "Crystal Carry",
    subtitle: "Вынос кристаллов",
    desc: "Собирайте кристаллы, что появляются в центре карты, и удерживайте их. Команда, набравшая 10 кристаллов и удержавшая их, побеждает.",
    players: "3 на 3",
    icon: "💎",
    color: "#40C4FF",
    gradient: "linear-gradient(135deg, #0D47A1, #40C4FF)",
    mapName: "Кристальная шахта",
  },
  {
    id: "siege",
    name: "Star Siege",
    subtitle: "Осада",
    desc: "Защитите свою базу от трёх волн врагов. Чем дольше держитесь — тем выше награда.",
    players: "4 против волн",
    icon: "🏰",
    color: "#69F0AE",
    gradient: "linear-gradient(135deg, #1B5E20, #69F0AE)",
    mapName: "Кристальная шахта",
  },
  {
    id: "heist",
    name: "Fallen Crown",
    subtitle: "Ограбление",
    desc: "У каждой команды есть сейф. Уничтожьте сейф врага раньше, чем они уничтожат ваш.",
    players: "3 на 3",
    icon: "🔐",
    color: "#FFD700",
    gradient: "linear-gradient(135deg, #F57F17, #FFD700)",
    mapName: "Кристальная шахта",
  },
  {
    id: "gemgrab",
    name: "Crystal Void",
    subtitle: "Ограбление кристаллов",
    desc: "Подбирайте камни, что выпадают из центрального источника. Команда, удержавшая 10 камней одновременно в течение 15 секунд, побеждает. Если носителя убивают — он роняет все камни.",
    players: "3 на 3",
    icon: "💠",
    color: "#CE93D8",
    gradient: "linear-gradient(135deg, #4A148C, #CE93D8)",
    mapName: "Кристальная шахта",
  },
  {
    id: "ranked",
    name: "Ranked Battle",
    subtitle: "Ранговый бой",
    desc: "Случайный 3 на 3 режим, ранговые кубки и лиги. Кубки не влияют на трофейную дорогу.",
    players: "3 на 3",
    icon: "🏆",
    color: "#CE93D8",
    gradient: "linear-gradient(135deg, #4A148C, #CE93D8)",
    mapName: "—",
  },
  {
    id: "starstrike",
    name: "Star Strike",
    subtitle: "Звёздный мяч",
    desc: "Футбольный бой с физическим мячом: ведите, пасуйте и забивайте. Формат матча можно выбрать: 3 на 3 или 5 на 5.",
    players: "3 на 3 или 5 на 5",
    icon: "⚽",
    color: "#66BB6A",
    gradient: "linear-gradient(135deg, #1B5E20, #66BB6A)",
    mapName: "Арена удара",
  },
  {
    id: "megashowdown",
    name: "Mega Star Battle",
    subtitle: "МЕГА-Столкновение",
    desc: "Возьмите отряд из 3 бойцов в королевскую битву. Когда активный боец умирает — в бой выходит следующий из отряда. Кнопка «Сменить» (кулдаун 3 сек) переключает между живыми бойцами. Банки усиления действуют на весь отряд. Награды — в 1.5 раза больше обычных.",
    players: "Отряд 3 на 5–10 врагов",
    icon: "✨",
    color: "#FFD54F",
    gradient: "linear-gradient(135deg, #B71C1C, #FFD54F)",
    mapName: "Заброшенный храм",
  },
  {
    id: "bossraid",
    name: "Бой с боссом",
    subtitle: "Рейд на босса",
    desc: "Пять бойцов против одного босса. Уровни 1–5 с наградой за первое прохождение, дальше бесконечное усиление. Кубки за матч не начисляются.",
    players: "5 против 1",
    icon: "👑",
    color: "#FFD54F",
    gradient: "linear-gradient(135deg, #4A148C, #FFD54F)",
    mapName: "Арена босса",
  },
  {
    id: "bounty",
    name: "Star Hunt",
    subtitle: "Охота за звёздами",
    desc: "5 на 5. За каждое убийство — звёзды в счёт команды (от 1 до 6 за врага). Соберите 25 звёзд раньше противника. Личные звёзды (max 6) сбрасываются при смерти, но командный счёт не теряется.",
    players: "5 на 5",
    icon: "⭐",
    color: "#FFE082",
    gradient: "linear-gradient(135deg, #311B92, #FFE082)",
    mapName: "Кристальная шахта",
  },
  {
    id: "monsterhide",
    name: "Monster Hide",
    subtitle: "Прятки монстров",
    desc: "5 бойцов против 10 монстров на карте столкновения. Монстры прячутся в кустах с особыми способностями. Убейте всех за 3 минуты — +15 сек за каждого (макс. +60). За каждого убитого монстра — +1 кубок лично вам.",
    players: "5 против 10 монстров",
    icon: "👾",
    color: "#AB47BC",
    gradient: "linear-gradient(135deg, #4A148C, #AB47BC)",
    mapName: "Заброшенный храм",
  },
  {
    id: "monsterInvasion",
    name: "Monster Invasion",
    subtitle: "Нашествие монстров",
    desc: "PvE на карте столкновения: отбивайте 10 волн монстров — каждая сильнее предыдущей. С 4-й волны элитные враги, с 7-й — мини-боссы. Кубки: −5 если меньше 3 волн, иначе +1 за каждую пройденную волну. Полное прохождение — случайный сундук, монеты, кристаллы и поинты.",
    players: "1–3 против волн",
    icon: "👹",
    color: "#FF7043",
    gradient: "linear-gradient(135deg, #BF360C, #FF7043)",
    mapName: "Заброшенный храм",
  },
  {
    id: "teamHunt",
    name: "Team Hunt",
    subtitle: "Командная охота",
    desc: "PvPvE на карте столкновения: 4 команды по 3 бойца, 5 минут. Очки только за монстров. PvP разрешён, но не даёт очков. Кубки как в тройном столкновении.",
    players: "4×3 игрока",
    icon: "🎯",
    color: "#26C6DA",
    gradient: "linear-gradient(135deg, #006064, #26C6DA)",
    mapName: "Арена столкновения",
  },
];

export function getModeInfo(id: string): ModeInfo {
  return MODES.find(m => m.id === id) || MODES[0];
}
