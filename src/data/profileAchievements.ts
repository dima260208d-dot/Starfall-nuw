import type { UserProfile } from "../utils/localStorageAPI";
import { BRAWLERS } from "../entities/BrawlerData";
import { MAX_BRAWLER_RANK, getBrawlerRank, getBrawlerTrophies } from "../utils/localStorageAPI";

export interface ProfileAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress?: string;
}

export function getProfileAchievements(profile: UserProfile): ProfileAchievement[] {
  const ownedBrawlers = profile.unlockedBrawlers.length;
  const maxRank = Math.max(
    0,
    ...BRAWLERS.map(b => getBrawlerRank(getBrawlerTrophies(profile, b.id))),
  );
  const totalStars = Object.values(profile.brawlerStars || {}).reduce((s, arr) => s + (arr?.length || 0), 0);
  const pins = (profile.ownedPins || []).length;
  const pets = (profile.unlockedPets || []).length;
  const passLevel = profile.clashPassLevel;
  const roadClaimed = profile.trophyRoadClaimed.length;

  const list: Omit<ProfileAchievement, "unlocked">[] = [
    { id: "first_win", title: "Первая победа", description: "Одержать первую победу", icon: "🥇" },
    { id: "wins_10", title: "Десятка", description: "10 побед", icon: "🏅" },
    { id: "wins_50", title: "Ветеран", description: "50 побед", icon: "⚔️" },
    { id: "wins_100", title: "Легенда арены", description: "100 побед", icon: "👑" },
    { id: "trophies_500", title: "Кубковый след", description: "500 кубков на аккаунте", icon: "🏆" },
    { id: "trophies_2000", title: "Звёздный путь", description: "2000 кубков", icon: "⭐" },
    { id: "trophies_5000", title: "Мастер кубков", description: "5000 кубков", icon: "💫" },
    { id: "brawler_3", title: "Отряд", description: "3 бойца в коллекции", icon: "🎭" },
    { id: "brawler_all", title: "Полный ростер", description: "Все бойцы открыты", icon: "🌟" },
    { id: "rank_25", title: "Ранг 25", description: "Ранг 25 на любом бойце", icon: "📈" },
    { id: "rank_50", title: "Ранг 50", description: "Ранг 50 на любом бойце", icon: "🔥" },
    { id: "rank_max", title: "Вершина", description: `Ранг ${MAX_BRAWLER_RANK}`, icon: "💎" },
    { id: "starpass_10", title: "Star Pass 10", description: "10 уровень пропуска", icon: "🎟️" },
    { id: "starpass_30", title: "Star Pass 30", description: "30 уровень пропуска", icon: "✨" },
    { id: "road_5", title: "Дорога наград", description: "5 наград трофейной дороги", icon: "🛤️" },
    { id: "pins_20", title: "Коллекционер пинов", description: "20 пинов", icon: "📌" },
    { id: "pets_3", title: "Питомник", description: "3 питомца", icon: "🐾" },
    { id: "stars_10", title: "Созвездия", description: "10 звёзд на бойцах", icon: "🌠" },
    { id: "games_100", title: "Боец арены", description: "100 матчей", icon: "🎮" },
    { id: "winrate_60", title: "Доминатор", description: "60% винрейта (мин. 20 игр)", icon: "📊" },
  ];

  const checks: Record<string, boolean> = {
    first_win: profile.totalWins >= 1,
    wins_10: profile.totalWins >= 10,
    wins_50: profile.totalWins >= 50,
    wins_100: profile.totalWins >= 100,
    trophies_500: profile.trophies >= 500,
    trophies_2000: profile.trophies >= 2000,
    trophies_5000: profile.trophies >= 5000,
    brawler_3: ownedBrawlers >= 3,
    brawler_all: ownedBrawlers >= BRAWLERS.length,
    rank_25: maxRank >= 25,
    rank_50: maxRank >= 50,
    rank_max: maxRank >= MAX_BRAWLER_RANK,
    starpass_10: passLevel >= 10,
    starpass_30: passLevel >= 30,
    road_5: roadClaimed >= 5,
    pins_20: pins >= 20,
    pets_3: pets >= 3,
    stars_10: totalStars >= 10,
    games_100: profile.totalGamesPlayed >= 100,
    winrate_60:
      profile.totalGamesPlayed >= 20 &&
      profile.totalWins / profile.totalGamesPlayed >= 0.6,
  };

  return list.map(a => ({
    ...a,
    unlocked: !!checks[a.id],
    progress: checks[a.id] ? undefined : getProgressHint(a.id, profile, { ownedBrawlers, maxRank, pins, pets, totalStars, passLevel, roadClaimed }),
  }));
}

function getProgressHint(
  id: string,
  profile: UserProfile,
  ctx: { ownedBrawlers: number; maxRank: number; pins: number; pets: number; totalStars: number; passLevel: number; roadClaimed: number },
): string | undefined {
  switch (id) {
    case "wins_10": return `${profile.totalWins}/10`;
    case "wins_50": return `${profile.totalWins}/50`;
    case "wins_100": return `${profile.totalWins}/100`;
    case "trophies_500": return `${profile.trophies}/500`;
    case "trophies_2000": return `${profile.trophies}/2000`;
    case "brawler_3": return `${ctx.ownedBrawlers}/3`;
    case "rank_25": return `макс. ранг ${ctx.maxRank}/25`;
    case "pins_20": return `${ctx.pins}/20`;
    default: return undefined;
  }
}
