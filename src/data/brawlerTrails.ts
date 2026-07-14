/** Movement trail cosmetics — 200 gems each, unique visual presets. */
export const TRAIL_GEM_COST = 200;

export type TrailLayer = "ground" | "air" | "both";

export type TrailPattern =
  | "petals"
  | "wind"
  | "stars"
  | "sparkle"
  | "leaves"
  | "snow"
  | "flame"
  | "bubbles"
  | "ink"
  | "goldDust"
  | "blossom"
  | "lightning"
  | "butterfly"
  | "moon"
  | "runes"
  | "feather"
  | "crystal"
  | "mist"
  | "ember"
  | "lotus"
  | "comet"
  | "ribbon"
  | "dew"
  | "aurora"
  | "vine";

export interface BrawlerTrailDef {
  id: string;
  name: string;
  pattern: TrailPattern;
  layer: TrailLayer;
  color: string;
  secondary: string;
  accent?: string;
  spawnRate: number;
  particleLife: number;
  sizeMin: number;
  sizeMax: number;
}

export const BRAWLER_TRAILS: BrawlerTrailDef[] = [
  { id: "trail:petal-pink", name: "Розовые лепестки", pattern: "petals", layer: "ground", color: "#FF80AB", secondary: "#F48FB1", spawnRate: 0.045, particleLife: 1.1, sizeMin: 4, sizeMax: 9 },
  { id: "trail:wind-teal", name: "Бирюзовый ветерок", pattern: "wind", layer: "air", color: "#80DEEA", secondary: "#4DD0E1", spawnRate: 0.05, particleLife: 0.75, sizeMin: 6, sizeMax: 14 },
  { id: "trail:star-gold", name: "Золотые звёзды", pattern: "stars", layer: "air", color: "#FFD54F", secondary: "#FFECB3", spawnRate: 0.04, particleLife: 0.9, sizeMin: 3, sizeMax: 7 },
  { id: "trail:spark-violet", name: "Фиолетовые искры", pattern: "sparkle", layer: "both", color: "#CE93D8", secondary: "#BA68C8", spawnRate: 0.055, particleLife: 0.65, sizeMin: 2, sizeMax: 6 },
  { id: "trail:leaf-green", name: "Листья весны", pattern: "leaves", layer: "ground", color: "#81C784", secondary: "#A5D6A7", spawnRate: 0.042, particleLife: 1.2, sizeMin: 5, sizeMax: 10 },
  { id: "trail:snow-blue", name: "Снежная пыль", pattern: "snow", layer: "both", color: "#E3F2FD", secondary: "#BBDEFB", spawnRate: 0.048, particleLife: 1.0, sizeMin: 2, sizeMax: 5 },
  { id: "trail:flame-orange", name: "Огненные языки", pattern: "flame", layer: "ground", color: "#FF7043", secondary: "#FFAB91", spawnRate: 0.05, particleLife: 0.55, sizeMin: 4, sizeMax: 11 },
  { id: "trail:bubble-cyan", name: "Мыльные пузыри", pattern: "bubbles", layer: "air", color: "#80D8FF", secondary: "#E1F5FE", accent: "#FFFFFF", spawnRate: 0.038, particleLife: 1.3, sizeMin: 5, sizeMax: 12 },
  { id: "trail:ink-purple", name: "Чернильные брызги", pattern: "ink", layer: "ground", color: "#7E57C2", secondary: "#4527A0", spawnRate: 0.044, particleLife: 0.85, sizeMin: 3, sizeMax: 8 },
  { id: "trail:gold-dust", name: "Золотая пыль", pattern: "goldDust", layer: "both", color: "#FFC107", secondary: "#FFE082", spawnRate: 0.06, particleLife: 0.7, sizeMin: 1, sizeMax: 4 },
  { id: "trail:blossom-sakura", name: "Сакура", pattern: "blossom", layer: "air", color: "#F8BBD0", secondary: "#F48FB1", spawnRate: 0.04, particleLife: 1.15, sizeMin: 4, sizeMax: 8 },
  { id: "trail:lightning-blue", name: "Грозовые искры", pattern: "lightning", layer: "air", color: "#64B5F6", secondary: "#E3F2FD", spawnRate: 0.052, particleLife: 0.45, sizeMin: 3, sizeMax: 9 },
  { id: "trail:butterfly-lilac", name: "Бабочки", pattern: "butterfly", layer: "air", color: "#B39DDB", secondary: "#EDE7F6", spawnRate: 0.032, particleLife: 1.4, sizeMin: 6, sizeMax: 11 },
  { id: "trail:moon-silver", name: "Лунная пыль", pattern: "moon", layer: "both", color: "#CFD8DC", secondary: "#ECEFF1", spawnRate: 0.043, particleLife: 1.0, sizeMin: 2, sizeMax: 6 },
  { id: "trail:runes-amber", name: "Руны света", pattern: "runes", layer: "ground", color: "#FFB74D", secondary: "#FFF3E0", spawnRate: 0.036, particleLife: 0.95, sizeMin: 5, sizeMax: 9 },
  { id: "trail:feather-white", name: "Перья", pattern: "feather", layer: "air", color: "#FAFAFA", secondary: "#EEEEEE", spawnRate: 0.035, particleLife: 1.25, sizeMin: 5, sizeMax: 12 },
  { id: "trail:crystal-ice", name: "Ледяные кристаллы", pattern: "crystal", layer: "ground", color: "#81D4FA", secondary: "#E1F5FE", spawnRate: 0.041, particleLife: 0.8, sizeMin: 3, sizeMax: 7 },
  { id: "trail:mist-lavender", name: "Лавандовый туман", pattern: "mist", layer: "both", color: "#B39DDB", secondary: "#D1C4E9", spawnRate: 0.058, particleLife: 0.6, sizeMin: 8, sizeMax: 16 },
  { id: "trail:ember-red", name: "Тлеющие угольки", pattern: "ember", layer: "ground", color: "#EF5350", secondary: "#FFCDD2", spawnRate: 0.047, particleLife: 0.9, sizeMin: 2, sizeMax: 5 },
  { id: "trail:lotus-teal", name: "Лотосы", pattern: "lotus", layer: "ground", color: "#4DB6AC", secondary: "#B2DFDB", spawnRate: 0.033, particleLife: 1.3, sizeMin: 5, sizeMax: 10 },
  { id: "trail:comet-indigo", name: "Кометы", pattern: "comet", layer: "air", color: "#7986CB", secondary: "#C5CAE9", spawnRate: 0.046, particleLife: 0.7, sizeMin: 4, sizeMax: 10 },
  { id: "trail:ribbon-rose", name: "Ленты роз", pattern: "ribbon", layer: "air", color: "#EC407A", secondary: "#F8BBD0", spawnRate: 0.039, particleLife: 0.85, sizeMin: 6, sizeMax: 14 },
  { id: "trail:dew-mint", name: "Утренняя роса", pattern: "dew", layer: "ground", color: "#A5D6A7", secondary: "#E8F5E9", accent: "#FFFFFF", spawnRate: 0.051, particleLife: 0.75, sizeMin: 2, sizeMax: 5 },
  { id: "trail:aurora-green", name: "Северное сияние", pattern: "aurora", layer: "both", color: "#69F0AE", secondary: "#B9F6CA", spawnRate: 0.054, particleLife: 0.65, sizeMin: 6, sizeMax: 18 },
  { id: "trail:vine-emerald", name: "Изумрудные лозы", pattern: "vine", layer: "ground", color: "#66BB6A", secondary: "#C8E6C9", spawnRate: 0.037, particleLife: 1.05, sizeMin: 4, sizeMax: 9 },
  { id: "trail:shadow-void", name: "Тень пустоты", pattern: "ink", layer: "ground", color: "#424242", secondary: "#757575", spawnRate: 0.043, particleLife: 0.9, sizeMin: 4, sizeMax: 10 },
  { id: "trail:cherry-burst", name: "Вишнёвый взрыв", pattern: "petals", layer: "both", color: "#E53935", secondary: "#FFCDD2", spawnRate: 0.048, particleLife: 0.85, sizeMin: 3, sizeMax: 8 },
  { id: "trail:sand-gold", name: "Золотой песок", pattern: "goldDust", layer: "ground", color: "#FFB300", secondary: "#FFE082", spawnRate: 0.062, particleLife: 0.65, sizeMin: 2, sizeMax: 5 },
  { id: "trail:nebula-pink", name: "Розовая туманность", pattern: "aurora", layer: "air", color: "#F06292", secondary: "#F8BBD0", spawnRate: 0.052, particleLife: 0.75, sizeMin: 7, sizeMax: 16 },
  { id: "trail:rainbow-prism", name: "Радужная призма", pattern: "sparkle", layer: "both", color: "#AB47BC", secondary: "#80DEEA", accent: "#FFD54F", spawnRate: 0.05, particleLife: 0.7, sizeMin: 3, sizeMax: 8 },
  { id: "trail:frost-crystal", name: "Морозные осколки", pattern: "crystal", layer: "ground", color: "#B3E5FC", secondary: "#E1F5FE", spawnRate: 0.04, particleLife: 1.0, sizeMin: 4, sizeMax: 9 },
  { id: "trail:night-moon", name: "Лунный след", pattern: "moon", layer: "air", color: "#ECEFF1", secondary: "#CFD8DC", spawnRate: 0.038, particleLife: 1.15, sizeMin: 4, sizeMax: 9 },
];

export const BRAWLER_TRAIL_BY_ID = new Map(BRAWLER_TRAILS.map(t => [t.id, t]));

export function getTrailDef(trailId: string | null | undefined): BrawlerTrailDef | null {
  if (!trailId) return null;
  return BRAWLER_TRAIL_BY_ID.get(trailId) ?? null;
}
