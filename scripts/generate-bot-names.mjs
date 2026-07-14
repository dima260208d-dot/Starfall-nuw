/**
 * Generate 1000 unique gaming-style bot nicknames.
 * Run: node scripts/generate-bot-names.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../src/utils/botNames.ts");

const BANNED = /ст[её]п|stepa|stepan/i;

/** Curated realistic nicknames (games, memes, CIS + global). */
const CURATED = [
  "LagLegend", "NoScopeNoodle", "AFKLegend", "LootGoblin", "RageQuitPro", "PotatoAim", "PingPanic",
  "OopsIDied", "CampfireCamper", "ButtonMasher", "RespawnRookie", "SnackReload", "GGezMaybe", "BrainAFK",
  "MissedAgain", "CarryMePls", "OofMachine", "GGNotEZ", "AlmostPro", "JustOneMore", "WhyAmIDead",
  "PanicButton", "CasualTryhard", "LaggyLegend", "FreeKillHere", "PressFPls", "WhoInvitedMe", "OopsMyBad",
  "ShadowVortex", "NovaStrike", "PixelReaper", "NightSpecter", "StormBreaker", "FrostWarden", "BlazeCipher",
  "VoidHunter", "PrimeSlayer", "DarkOrbit", "EchoKnight", "ClutchGod", "HeadshotHero", "TryHardFame",
  "FrostNova", "NeonStrike", "SilentDrift", "CyberHawk", "SteelEcho", "LunarShade", "PhantomWave",
  "ApexFrost", "NovaGhost", "QuantumToast", "CosmicNibble", "OrbitalGiggle", "SoftGlitch", "CloudRiddle",
  "MoonDust", "PastelHaze", "CloudVeil", "StarDust", "NightBloom", "IceMint", "CherryLag", "MintWave",
  "CerealKiller", "SpicyChicken", "BroCode", "NoPainNoGain", "GrumpyGamer", "NoGameNoLife", "YouTriedIt",
  "DiscoNinja", "ProLooter", "SchnitzelBro", "WillyDaWaffel", "CerealBox", "ToastMaster", "PizzaRat",
  "MemeLord", "PepeHands", "DogeCoin", "MonkeBrain", "Gigachad", "BasedKing", "SigmaGrind", "TouchGrass",
  "SkillIssue", "RatioKing", "CopiumTank", "MainCharacter", "SideQuest", "NPCVibes", "SideCharacter",
  "SweatLord", "SweatSeason", "MetaMiss", "RankRiot", "ClipChaos", "StreamStorm", "PingPeak", "LootLegacy",
  "ViralFrag", "RespawnRush", "NPCNova", "CritHit", "QuickScope", "GlitchHunter", "SpeedrunAny", "PacketLoss",
  "xDarkWolf", "xNeonFox", "xSilentCat", "xProGamer", "xLagMaster", "xClutchBoy", "xNoobSlayer", "xTryHard",
  "Xx_Shadow_xX", "Xx_Nova_xX", "Xx_Pixel_xX", "Xx_Void_xX", "Xx_Frost_xX", "Xx_Blaze_xX", "Xx_Storm_xX",
  "iDark", "iNova", "iPixel", "iClutch", "iTryHard", "iNoob", "iPro", "iLag", "iPing", "iGG",
  "MrFox", "MrWolf", "MrLag", "MrPing", "MrPro", "MrNoob", "MrMeme", "MrClutch", "MrToxic", "MrChill",
  "ProSniper", "ProTank", "ProHealer", "ProFarmer", "ProCamper", "ProTroll", "ProBuilder", "ProMiner",
  "NoobSlayer", "NoobHunter", "NoobCarry", "NoobKing", "NoobQueen", "NoobLife", "NoobMaster", "NoobLegend",
  "DarkPhoenix", "SilentStorm", "WildTiger", "LuckyShot", "CrazyAim", "EpicFail", "ToxicPlayer", "NeonWolf",
  "FrozenHeart", "GoldenEagle", "SilverFox", "ShadowBlade", "StormRider", "BlazeFury", "GhostWalker", "RoyalGuard",
  "SavageMode", "MysticMage", "CosmicRay", "PixelHero", "TurboBoost", "HyperBeam", "UltraInstinct", "MegaMind",
  "IronFist", "FireStorm", "IceBreaker", "ThunderBolt", "NightOwl", "SolarFlare", "LunarEclipse", "CyberPunk",
  "RogueAgent", "PrimeTime", "AlphaWolf", "OmegaZero", "DeltaForce", "NovaPulse", "VoidWalker", "ChillPill",
  "SneakySnake", "AngryBird", "HappyCamper", "SleepyHead", "LazyPanda", "SmartCookie", "DizzyDuck", "FuzzyBear",
  "SaltyCracker", "SpicyMeme", "SweetDream", "FreshStart", "RustySpoon", "DustyOld", "ChunkyMonkey", "SlimShady",
  "TinyTitan", "BigBoss", "OldSchool", "YoungBlood", "CoolDude", "HotShot", "ColdBrew", "FastLane", "SlowMo",
  "RealDeal", "FakePro", "SuperNova", "MiniMe", "GigaChad", "NanoBot", "MicroWave", "MacroKing",
  "Димка", "Киря", "Саша", "Миша", "Паша", "Вова", "Женя", "Лёша", "Костя", "Игорь",
  "Артём", "Макс", "Никита", "Даня", "Толя", "Витя", "Серёга", "Андрей", "Олег", "Юра",
  "Катя", "Маша", "Даша", "Настя", "Лена", "Оля", "Ира", "Света", "Аня", "Юля",
  "Вика", "Полина", "Алина", "Кристина", "Марина", "Таня", "Соня", "Лиза", "Вера", "Ника",
  "Боря", "Гена", "Петя", "Вася", "Коля", "Слава", "Рома", "Стас", "Тёма", "Федя",
  "Глеб", "Ярик", "Семён", "Матвей", "Егор", "Илья", "Лёня", "Богдан", "Тимур", "Руслан",
  "Арсений", "Захар", "Марк", "Лев", "Мирон", "Платон", "Ярослав", "Денис", "Родион", "Влад",
  "Медведь", "Волк", "Лиса", "Заяц", "Сова", "Орёл", "Ястреб", "Сокол", "Кот", "Пёс",
  "Хомяк", "Енот", "Белка", "Кролик", "Лисичка", "Рыжик", "Снежок", "Пушок", "Барсук", "Бобёр",
  "Пельмень", "Вареник", "Борщ", "Кефир", "Сметана", "Пирожок", "Блины", "Оладушек", "Батон", "Булка",
  "Чебур", "Колобок", "Буратино", "Шапокляк", "Крокодил", "Слон", "Жираф", "Пингвин", "Капибара", "Жабка",
  "Танкист", "Снайпер", "Разведчик", "Медик", "Инженер", "Штурмовик", "Берсерк", "Маг", "Ведьма", "Пират",
  "Киборг", "Робот", "Дроид", "Нейрон", "Чип", "Проц", "Видюха", "Лагун", "Пинг", "Скилл",
  "Нуб", "Про", "Читер", "Легит", "Токсик", "Кек", "Лол", "Рофл", "Мемас", "Пепе",
  "Батя", "Братан", "Бро", "Чел", "Пацан", "Мужик", "Тип", "Кент", "Школьник", "Студент",
  "Лентяй", "Гений", "Ботan", "Солнышко", "Звёздочка", "Радуга", "Молния", "Гром", "Ветер", "Снег",
  "Огонь", "Лёд", "Пар", "Дым", "Пепел", "Искра", "Пламя", "Мороз", "Жара", "Шторм",
  "Космос", "Orbit", "Comet", "Nebula", "Void", "Nova", "Pulse", "Wave", "Beam", "Spark",
  "Kirill", "Anton", "Dima", "Sergey", "Alex", "Maxim", "Nikolay", "Pavel", "Ivan", "Artem",
  "Denis", "Roman", "Egor", "Timur", "Ruslan", "Bogdan", "Yarik", "Gleb", "Vlad", "Oleg",
  "Токсик228", "Про1337", "Нуб007", "Читер666", "Лаг999", "Пинг404", "Скилл777", "Кек420", "Лол69", "Мем777",
  "Волк_007", "Лиса_99", "Кот_228", "Медведь_13", "Сова_42", "Заяц_777", "Енот_666", "Белка_007", "Пингвин_99",
  "DarkRU", "NeonRU", "CyberRU", "PixelRU", "TurboRU", "EliteRU", "MasterRU", "LegendRU", "KingRU", "ProRU",
  "JustDima", "JustKirya", "JustMax", "JustAlex", "JustVlad", "NotAPro", "NotNoob", "NotBot", "RealPro", "RealNoob",
  "BrawlFan", "ClashFan", "StarFan", "RoyaleFan", "CraftFan", "FortFan", "MineFan", "RobloxFan", "AmongFan", "ValorantFan",
  "LagMaster3000", "NoScopeKing", "CampKing", "FragMachine", "KillStealer", "TeamCarry", "SoloQueue", "DuoPartner",
  "RankedOnly", "CasualGuy", "TryHard", "ChillGuy", "Tilted", "Clutched", "WipedSquad", "LastAlive",
  "OneTap", "TwoTap", "SprayAndPray", "Prefire", "Wallbang", "NadeKing", "SmokeGod", "FlashBang",
  "HealBot", "TankMain", "DPSMain", "SupportMain", "JungleDiff", "MidGap", "TopDiff", "BotGap",
  "WoodDivision", "BronzeLife", "SilverHand", "GoldRush", "PlatinumMind", "DiamondHands", "MasterClass", "GrandMaster",
  "ZeroDeaths", "OneLife", "FullHP", "LowHP", "OneHP", "ClutchOrKick", "KickMe", "SaveMe",
  "WoodPecker", "StoneCold", "IronWill", "SteelNerve", "CopperWire", "BronzeAge", "SilverLining", "GoldenBoy",
  "PlatinumBlonde", "DiamondCut", "RubyRed", "SapphireBlue", "EmeraldEye", "OnyxBlack", "IvoryTower", "AmberGlow",
  "CrimsonTide", "AzureSky", "JadeDragon", "VioletStorm", "ScarletWitch", "IndigoChild", "TealDeer", "CoralReef",
  "WalrusKing", "PenguinDance", "KoalaBear", "RedPanda", "BlueWhale", "GreenFrog", "YellowBee", "BlackCat",
  "WhiteRabbit", "GreyWolf", "BrownBear", "PinkFlamingo", "PurpleRain", "OrangeJuice", "LimeZest", "MintTea",
  "VanillaSky", "CaramelMac", "ChocolateMilk", "StrawberryJam", "BlueberryPie", "RaspberryTea", "CherryBomb", "PeachFuzz",
  "BananaSplit", "ApplePie", "GrapeJuice", "MelonHead", "Watermelon", "Pineapple", "Coconut", "Avocado",
  "TacoBell", "BurgerKing", "PizzaHut", "KebabMan", "SushiRoll", "RamenBowl", "NoodleSoup", "Dumpling",
  "CoffeeAddict", "TeaTime", "EnergyDrink", "ColaZero", "SpriteFan", "FantaOrange", "RedBull", "MonsterEnergy",
  "KeyboardWarrior", "MouseClicker", "Controller", "StickDrift", "DeadZone", "HighSens", "LowSens", "DpiKing",
  "FpsDrops", "FrameSkip", "RenderBug", "ShaderFail", "TexturePop", "LoadingScreen", "QueueTime", "MatchFound",
  "WarmUp", "Cooldown", "Overheat", "Recharge", "Reloading", "OutOfAmmo", "EmptyClip", "FullMag",
  "HeadGlitch", "BodyShot", "LegShot", "FootShot", "MissClick", "Accidental", "FriendlyFire", "TeamKill",
  "ReportMe", "BanWave", "AntiCheat", "VacBan", "SmurfAccount", "AltAccount", "MainAccount", "BackupAcc",
  "OldAccount", "NewAccount", "FreshAcc", "BannedAcc", "Unbanned", "MutedChat", "ChatBan", "VoiceMute",
  "PingSpike", "PacketLoss", "RubberBand", "Desync", "ServerLag", "ClientSide", "HostAdvantage", "PeerToPeer",
  "CrossPlay", "Platformer", "MobileGamer", "PCTeam", "ConsoleKid", "Handheld", "CloudGaming", "StreamPlay",
  "NightShift", "EarlyBird", "WeekendWar", "MondayBlues", "FridayNight", "SaturdayGrind", "SundayFunday", "HolidayMode",
  "WinterArc", "SummerVibes", "SpringBreak", "AutumnLeaf", "RainyDay", "SunnySide", "CloudySky", "FoggyMind",
  "DeepFocus", "ZoneOut", "InTheZone", "OffDay", "OnFire", "IceCold", "RedHot", "BlueMood",
  "GreenLight", "YellowCard", "BlackFlag", "WhiteFlag", "GreyArea", "PinkSlip", "PurpleHaze", "OrangeCrush",
  "VoidMain", "NullPointer", "ZeroCool", "OneShot", "TwoFace", "ThreeStooge", "FourWinds", "FiveStar",
  "SixSense", "SevenLuck", "EightBall", "NineLives", "TenToes", "ElevenHours", "TwelveGauge", "ThirteenGhost",
  "FourteenK", "FifteenMin", "SixteenBit", "Seventeen", "EighteenPlus", "Nineteen", "TwentyOne", "TwentyTwo",
  "Agent007", "Agent47", "AgentSmith", "CaptainHook", "GeneralLee", "MajorPain", "ColonelSand", "PrivateRyan",
  "SergeantPep", "LieutenantDan", "AdmiralAck", "CommanderShep", "ChiefKeef", "BossMan", "KingPin", "QueenBee",
  "LordFarquaad", "DukeNukem", "BaronVon", "SirLancelot", "LadyLuck", "PrinceCharming", "PrincessPeach", "DwarfMiner",
  "ElfRanger", "OrcBerserk", "GoblinKing", "TrollFace", "FairyDust", "PixieDust", "SpriteZero", "WispLight",
  "NinjaTurtle", "SamuraiJack", "RoninSpirit", "ShogunWar", "GeishaGirl", "SenseiMode", "DojoMaster", "KatanaEdge",
  "Shuriken", "KunaiThrow", "SmokeBomb", "ShadowStep", "Backstab", "AssassinCreed", "Hitman47", "MercenaryX",
  "GladiatorMax", "SpartanWar", "Centurion", "Legionnaire", "Crusader", "PaladinLight", "DarkKnight", "HolyGrail",
  "WizardHat", "WarlockDark", "SorcererSupreme", "Enchanter", "AlchemistGold", "Necromancer", "SummonerMain", "HealerMain",
  "ArcherElite", "CrossbowMan", "SlingShot", "Boomerang", "JavelinThrow", "HammerTime", "AxeMurderer", "SpearHead",
  "ShieldWall", "SwordMaster", "BladeRunner", "DaggerQuick", "MaceWindu", "StaffOnly", "WandWave", "OrbitalStrike",
  "MeteorShower", "CometTail", "AsteroidBelt", "BlackHole", "WhiteDwarf", "RedGiant", "BlueSuper", "NeutronStar",
  "GalaxyBrain", "UniverseEnd", "Multiverse", "DimensionX", "ParallelMe", "Timeline", "TimeLoop", "Rewind",
  "FastForward", "PauseMenu", "SkipCutscene", "AutoSave", "Checkpoint", "SavePoint", "GameOver", "Continue",
  "NewGamePlus", "HardMode", "EasyMode", "NormalDiff", "Nightmare", "InsaneMode", "Impossible", "TutorialSkip",
  "SpeedRunner", "AnyPercent", "WorldRecord", "PersonalBest", "TopScore", "HighScore", "Leaderboard", "RankOne",
  "BottomFeeder", "MidTable", "TopTier", "MetaSlave", "OffMeta", "BrokenBuild", "NerfThis", "BuffPlease",
  "PatchNotes", "HotfixNow", "BugReport", "FeatureReq", "DevBlog", "Community", "ModTeam", "AdminAbuse",
  "EventPass", "BattlePass", "SeasonOne", "DailyLogin", "WeeklyQuest", "MonthlySub", "PremiumUser", "FreeToPlay",
  "PayToWin", "GrindForever", "LootBox", "GachaPull", "RareDrop", "EpicPull", "Legendary", "MythicDrop",
  "CommonTrash", "UncommonFind", "CraftingMat", "ResourceFarm", "GoldRush", "CoinFlip", "GemHoard", "CrystalFarm",
  "XPBoost", "LevelUp", "MaxLevel", "PrestigeOne", "Rebirth", "Respec", "SkillTree", "TalentPoint",
  "StatBoost", "GearScore", "ItemLevel", "EnchantPlus", "SocketGem", "RefineMax", "UpgradeFail", "EnhanceSuccess",
  "TradeOffer", "AuctionHouse", "MarketFlip", "PriceCheck", "Undercut", "Overprice", "FairDeal", "ScamAlert",
  "GuildLeader", "ClanWar", "Alliance", "PartyLeader", "SoloPlayer", "DuoQueue", "TriStack", "FullStack",
  "VoiceComms", "PingsOnly", "TextChat", "EmoteSpam", "DanceOff", "TauntMaster", "RespectGG", "SaltShaker",
  "FlameWar", "ToxicChat", "Wholesome", "WholesomeGG", "GoodVibes", "BadVibes", "NeutralMood", "ChaosMode",
  "LawfulGood", "ChaoticEvil", "TrueNeutral", "Alignment", "KarmaFarm", "HonorSystem", "Reputation", "Notoriety",
  "FameSeeker", "CloutChaser", "StreamerBTW", "ContentCreator", "ClipFarmer", "ViralMoment", "TrendSetter", "OldMeta",
  "NewMeta", "DeadMeta", "LiveMeta", "ProScene", "EsportsFan", "Tournament", "BracketRun", "FinalsDay",
  "ChampionRing", "RunnerUp", "ThirdPlace", "Eliminated", "Qualified", "Disqualified", "ForfeitWin", "Rematch",
  "BestOfThree", "SuddenDeath", "Overtime", "GoldenGoal", "LastStand", "FinalPush", "AllIn", "NoMercy",
  "ShowMercy", "GoodGame", "WellPlayed", "NiceTry", "BetterLuck", "NextTime", "SeeYou", "GGWP",
];

const ADJ = [
  "Dark", "Silent", "Swift", "Wild", "Lucky", "Crazy", "Epic", "Toxic", "Neon", "Frozen", "Golden", "Silver",
  "Shadow", "Storm", "Blaze", "Ghost", "Royal", "Savage", "Mystic", "Cosmic", "Pixel", "Turbo", "Hyper", "Ultra",
  "Iron", "Fire", "Ice", "Thunder", "Night", "Solar", "Lunar", "Cyber", "Rogue", "Prime", "Alpha", "Omega",
  "Nova", "Void", "Chill", "Sneaky", "Angry", "Happy", "Sleepy", "Lazy", "Smart", "Salty", "Spicy", "Sweet",
  "Fresh", "Rusty", "Tiny", "Big", "Old", "Young", "Cool", "Hot", "Cold", "Fast", "Slow", "Mad", "Calm", "Bold",
  "Dead", "Feral", "Noble", "Brave", "Rapid", "Stealth", "Pro", "Noob", "Tryhard", "Casual", "Ranked", "Clutch",
  "Tilted", "Based", "Cursed", "Blessed", "Random", "Secret", "Lost", "Hidden", "Broken", "Wicked", "Holy", "Evil",
];

const NOUN = [
  "Wolf", "Fox", "Bear", "Tiger", "Eagle", "Hawk", "Raven", "Owl", "Snake", "Dragon", "Phoenix", "Shark",
  "Panda", "Cat", "Dog", "Rat", "Bat", "Spider", "Ninja", "Knight", "Wizard", "Mage", "Hunter", "Sniper",
  "Gunner", "King", "Queen", "Lord", "Hero", "Villain", "Rebel", "Pirate", "Thief", "Ghost", "Demon", "Angel",
  "Blade", "Sword", "Bow", "Shield", "Gun", "Star", "Moon", "Sun", "Storm", "Flame", "Spark", "Bolt", "Rock",
  "Crystal", "Pixel", "Byte", "Bug", "Lag", "Ping", "Tank", "Slayer", "Reaper", "Legend", "Meme", "Potato",
  "Tomato", "Pizza", "Burger", "Taco", "Sushi", "Ramen", "Kebab", "Gamer", "Player", "Bot", "Noob", "Pro",
  "Goblin", "Orc", "Troll", "Elf", "Vortex", "Nexus", "Apex", "Zenith", "Guardian", "Sentinel", "Scout", "Raider",
];

const VERB = [
  "Kill", "Slay", "Smash", "Dash", "Rush", "Shoot", "Snipe", "Blast", "Run", "Hide", "Hunt", "Chase", "Win",
  "Fight", "Heal", "Nuke", "Burn", "Freeze", "Grind", "Loot", "Craft", "Build", "Break", "Camp", "Rush", "Flank",
  "Trick", "Troll", "Carry", "Feed", "Clutch", "Miss", "Aim", "Scope", "Reload", "Respawn", "Rage", "Quit",
];

const PREFIX = [
  "x", "X", "i", "Mr", "Pro", "Noob", "The", "Real", "Fake", "Super", "Mini", "Mega", "Ultra", "Dark", "Neon",
  "Cyber", "Pixel", "Turbo", "Elite", "Master", "Legend", "King", "Queen", "Lord", "Sir", "Lady", "Captain",
  "Agent", "Team", "Clan", "Old", "Young", "Just", "Not", "Only", "OG", "AFK", "GG", "EZ", "OP", "Meta",
];

const SUFFIX = [
  "", "228", "007", "1337", "666", "777", "404", "69", "420", "99", "13", "42", "X", "Pro", "YT", "GG", "WP",
  "EZ", "OP", "RU", "UA", "EU", "BR", "DE", "FR", "JP", "KR",
];

const SEP = ["", "_", "-", "."];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function maybe(s, p = 0.4) {
  return Math.random() < p ? s : "";
}

function isBanned(name) {
  return BANNED.test(name);
}

function normalize(name) {
  return name.replace(/__+/g, "_").replace(/--+/g, "-").replace(/\.\.+/g, ".").replace(/^[_\-.]+|[_\-.]+$/g, "");
}

function genCombo() {
  const kind = Math.floor(Math.random() * 6);
  if (kind === 0) {
    const a = pick(ADJ);
    const n = pick(NOUN);
    return normalize(`${a}${pick(SEP)}${n}${maybe(pick(SUFFIX))}`);
  }
  if (kind === 1) {
    const v = pick(VERB);
    const n = pick(NOUN);
    return normalize(`${v}${pick(SEP)}${n}${maybe(pick(SUFFIX))}`);
  }
  if (kind === 2) {
    const p = pick(PREFIX);
    const b = pick([...NOUN, ...ADJ]);
    return normalize(`${p}${pick(["", "_"])}${b}${maybe(pick(SUFFIX))}`);
  }
  if (kind === 3) {
    const core = pick([...NOUN, ...ADJ, ...VERB]);
    const num = maybe(String(Math.floor(Math.random() * 9999)), 0.55);
    const style = pick([
      () => `x${core}${num}x`,
      () => `Xx_${core}_${num}_xX`,
      () => `${core}${num}`,
      () => `_${core}_`,
      () => `${core}_${num}`,
      () => `${core}-${num}`,
    ]);
    return normalize(style());
  }
  if (kind === 4) {
    const base = pick(CURATED.filter((n) => n.length <= 14));
    const num = maybe(String(Math.floor(Math.random() * 999)), 0.45);
    const style = pick([
      () => `${base}${num}`,
      () => `${base}_${num}`,
      () => `${base}-${num}`,
      () => `x${base}x`,
    ]);
    return normalize(style());
  }
  const w1 = pick([...ADJ, ...NOUN, ...VERB]);
  const w2 = pick([...NOUN, ...ADJ]);
  const w3 = maybe(pick(SUFFIX), 0.35);
  return normalize(`${w1}${pick(SEP)}${w2}${w3}`);
}

function generateNames(target = 1000) {
  const names = new Set();

  for (const n of CURATED) {
    if (!isBanned(n) && n.length >= 3 && n.length <= 20) names.add(n);
  }

  let attempts = 0;
  while (names.size < target && attempts < 80000) {
    attempts++;
    const name = genCombo();
    if (name.length < 3 || name.length > 20) continue;
    if (isBanned(name)) continue;
    names.add(name);
  }

  if (names.size < target) {
    throw new Error(`Only generated ${names.size} names, need ${target}`);
  }

  return [...names].slice(0, target).sort((a, b) => a.localeCompare(b, "en"));
}

const names = generateNames(1000);
const lines = [
  "// Auto-generated gaming-style bot nicknames (1000 unique names).",
  "// Regenerate: node scripts/generate-bot-names.mjs",
  "",
  "const BOT_NAMES: readonly string[] = [",
  ...names.map((n) => `  ${JSON.stringify(n)},`),
  "];",
  "",
  "export function pickBotName(): string {",
  "  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];",
  "}",
  "",
];

fs.writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(`Wrote ${names.length} bot names to ${OUT}`);
