import type {
  StarFeatDef,
  StarFeatKind,
  StarFeatMeta,
  StarFeatTier,
} from "./starFeatsData";
import { buildStarFeatReward } from "../utils/starFeatRewards";

const FEATS_PER_STAR_TIER = 15;

const STAR_FEAT_TIER_COLORS: Record<StarFeatTier, string> = {
  1: "#90A4AE",
  2: "#66BB6A",
  3: "#42A5F5",
  4: "#AB47BC",
  5: "#FFA726",
  6: "#FFD700",
};

type SlotTemplate = {
  kind: StarFeatKind;
  targetMul: number;
  titleKey: string;
  descKey: string;
  meta?: StarFeatMeta;
  /** 0..1 difficulty within tier — drives reward size */
  weight: number;
  chestAt?: number;
};

function scaleTarget(tier: StarFeatTier, base: number): number {
  return Math.max(1, Math.round(base * tier));
}

function slot(
  tier: StarFeatTier,
  index: number,
  tpl: SlotTemplate,
  baseTarget: number,
): StarFeatDef {
  const preferChest = tpl.chestAt !== undefined && tpl.chestAt === index % 5;
  const id = `sf${tier}_${String(index + 1).padStart(2, "0")}_${tpl.kind}${tpl.meta?.mode ? `_${tpl.meta.mode}` : ""}${tpl.meta?.brawlerId ? `_${tpl.meta.brawlerId}` : ""}`;
  return {
    id,
    tier,
    kind: tpl.kind,
    target: scaleTarget(tier, baseTarget * tpl.targetMul),
    borderColor: STAR_FEAT_TIER_COLORS[tier],
    titleKey: tpl.titleKey,
    descKey: tpl.descKey,
    meta: tpl.meta,
    reward: buildStarFeatReward(tier, index, tpl.weight, preferChest || index % 5 === 4, id),
  };
}

/** 15 slots per tier — concrete + general goals. */
const TIER_SLOT_TEMPLATES: SlotTemplate[] = [
  { kind: "play_games", targetMul: 1, titleKey: "starFeat.tpl.play_games.title", descKey: "starFeat.tpl.play_games.desc", weight: 0.25 },
  { kind: "win_games", targetMul: 1, titleKey: "starFeat.tpl.win_games.title", descKey: "starFeat.tpl.win_games.desc", weight: 0.35 },
  { kind: "play_mode", targetMul: 1, meta: { mode: "showdown" }, titleKey: "starFeat.tpl.play_mode.title", descKey: "starFeat.tpl.play_mode.desc", weight: 0.3 },
  { kind: "play_mode", targetMul: 1, meta: { mode: "gemgrab" }, titleKey: "starFeat.tpl.play_mode.title", descKey: "starFeat.tpl.play_mode.desc", weight: 0.32 },
  { kind: "win_mode", targetMul: 1, meta: { mode: "gemgrab" }, titleKey: "starFeat.tpl.win_mode.title", descKey: "starFeat.tpl.win_mode.desc", weight: 0.45, chestAt: 4 },
  { kind: "play_mode", targetMul: 1, meta: { mode: "heist" }, titleKey: "starFeat.tpl.play_mode.title", descKey: "starFeat.tpl.play_mode.desc", weight: 0.34 },
  { kind: "win_mode", targetMul: 1, meta: { mode: "bounty" }, titleKey: "starFeat.tpl.win_mode.title", descKey: "starFeat.tpl.win_mode.desc", weight: 0.48 },
  { kind: "play_mode", targetMul: 1, meta: { mode: "starstrike" }, titleKey: "starFeat.tpl.play_mode.title", descKey: "starFeat.tpl.play_mode.desc", weight: 0.36 },
  { kind: "play_brawler", targetMul: 1, meta: { brawlerId: "colt" }, titleKey: "starFeat.tpl.play_brawler.title", descKey: "starFeat.tpl.play_brawler.desc", weight: 0.38 },
  { kind: "win_brawler", targetMul: 1, meta: { brawlerId: "colt" }, titleKey: "starFeat.tpl.win_brawler.title", descKey: "starFeat.tpl.win_brawler.desc", weight: 0.5 },
  { kind: "kill_brawler", targetMul: 1, meta: { brawlerId: "bull" }, titleKey: "starFeat.tpl.kill_brawler.title", descKey: "starFeat.tpl.kill_brawler.desc", weight: 0.42 },
  { kind: "kill_enemies", targetMul: 1, titleKey: "starFeat.tpl.kill_enemies.title", descKey: "starFeat.tpl.kill_enemies.desc", weight: 0.4 },
  { kind: "deal_damage", targetMul: 1, titleKey: "starFeat.tpl.deal_damage.title", descKey: "starFeat.tpl.deal_damage.desc", weight: 0.55 },
  { kind: "open_chests", targetMul: 1, titleKey: "starFeat.tpl.open_chests.title", descKey: "starFeat.tpl.open_chests.desc", weight: 0.35, chestAt: 3 },
  { kind: "use_super", targetMul: 1, titleKey: "starFeat.tpl.use_super.title", descKey: "starFeat.tpl.use_super.desc", weight: 0.3 },
];

const BASE_TARGETS: Record<StarFeatKind, number> = {
  play_games: 8,
  win_games: 4,
  play_mode: 4,
  win_mode: 2,
  play_brawler: 5,
  win_brawler: 2,
  kill_brawler: 15,
  kill_enemies: 12,
  deal_damage: 8000,
  open_chests: 2,
  use_super: 8,
  heal_hp: 3000,
  collect_powercubes: 6,
  play_showdown: 5,
  win_showdown: 2,
  play_team: 6,
  win_team: 3,
  place_showdown_top4: 3,
  place_top3: 2,
  place_top1_showdown: 1,
  kill_monsters: 8,
  earn_trophies: 150,
  brawlers_unlocked: 3,
  clash_pass_level: 8,
  join_club: 1,
  upgrade_brawler: 2,
};

/** Extra rotating slots for tiers 2–6 (adds variety beyond base 15). */
const EXTRA_BY_TIER: Partial<Record<StarFeatTier, SlotTemplate[]>> = {
  2: [
    { kind: "play_showdown", targetMul: 1.2, titleKey: "starFeat.tpl.play_showdown.title", descKey: "starFeat.tpl.play_showdown.desc", weight: 0.4 },
    { kind: "heal_hp", targetMul: 1, titleKey: "starFeat.tpl.heal_hp.title", descKey: "starFeat.tpl.heal_hp.desc", weight: 0.38 },
    { kind: "collect_powercubes", targetMul: 1, titleKey: "starFeat.tpl.collect_powercubes.title", descKey: "starFeat.tpl.collect_powercubes.desc", weight: 0.36 },
    { kind: "place_showdown_top4", targetMul: 1, titleKey: "starFeat.tpl.place_top4.title", descKey: "starFeat.tpl.place_top4.desc", weight: 0.44 },
    { kind: "play_brawler", targetMul: 1, meta: { brawlerId: "spike" }, titleKey: "starFeat.tpl.play_brawler.title", descKey: "starFeat.tpl.play_brawler.desc", weight: 0.42 },
    { kind: "win_mode", targetMul: 1, meta: { mode: "heist" }, titleKey: "starFeat.tpl.win_mode.title", descKey: "starFeat.tpl.win_mode.desc", weight: 0.52 },
    { kind: "play_team", targetMul: 1, titleKey: "starFeat.tpl.play_team.title", descKey: "starFeat.tpl.play_team.desc", weight: 0.35 },
    { kind: "win_team", targetMul: 1, titleKey: "starFeat.tpl.win_team.title", descKey: "starFeat.tpl.win_team.desc", weight: 0.48 },
    { kind: "kill_monsters", targetMul: 1, titleKey: "starFeat.tpl.kill_monsters.title", descKey: "starFeat.tpl.kill_monsters.desc", weight: 0.4 },
    { kind: "upgrade_brawler", targetMul: 1, titleKey: "starFeat.tpl.upgrade_brawler.title", descKey: "starFeat.tpl.upgrade_brawler.desc", weight: 0.45 },
    { kind: "play_mode", targetMul: 1, meta: { mode: "megashowdown" }, titleKey: "starFeat.tpl.play_mode.title", descKey: "starFeat.tpl.play_mode.desc", weight: 0.5 },
    { kind: "win_mode", targetMul: 1, meta: { mode: "starstrike" }, titleKey: "starFeat.tpl.win_mode.title", descKey: "starFeat.tpl.win_mode.desc", weight: 0.55 },
    { kind: "play_brawler", targetMul: 1, meta: { brawlerId: "mortis" }, titleKey: "starFeat.tpl.play_brawler.title", descKey: "starFeat.tpl.play_brawler.desc", weight: 0.46 },
    { kind: "place_top3", targetMul: 1, titleKey: "starFeat.tpl.place_top3.title", descKey: "starFeat.tpl.place_top3.desc", weight: 0.5 },
    { kind: "earn_trophies", targetMul: 1, titleKey: "starFeat.tpl.earn_trophies.title", descKey: "starFeat.tpl.earn_trophies.desc", weight: 0.6 },
  ],
  3: [
    { kind: "win_showdown", targetMul: 1, titleKey: "starFeat.tpl.win_showdown.title", descKey: "starFeat.tpl.win_showdown.desc", weight: 0.55 },
    { kind: "play_mode", targetMul: 1, meta: { mode: "teamHunt" }, titleKey: "starFeat.tpl.play_mode.title", descKey: "starFeat.tpl.play_mode.desc", weight: 0.48 },
    { kind: "win_brawler", targetMul: 1, meta: { brawlerId: "spike" }, titleKey: "starFeat.tpl.win_brawler.title", descKey: "starFeat.tpl.win_brawler.desc", weight: 0.58 },
    { kind: "kill_brawler", targetMul: 1, meta: { brawlerId: "crow" }, titleKey: "starFeat.tpl.kill_brawler.title", descKey: "starFeat.tpl.kill_brawler.desc", weight: 0.52 },
    { kind: "deal_damage", targetMul: 1.5, titleKey: "starFeat.tpl.deal_damage.title", descKey: "starFeat.tpl.deal_damage.desc", weight: 0.62 },
    { kind: "heal_hp", targetMul: 1.2, titleKey: "starFeat.tpl.heal_hp.title", descKey: "starFeat.tpl.heal_hp.desc", weight: 0.5 },
    { kind: "win_mode", targetMul: 1, meta: { mode: "showdown" }, titleKey: "starFeat.tpl.win_mode.title", descKey: "starFeat.tpl.win_mode.desc", weight: 0.56 },
    { kind: "place_top1_showdown", targetMul: 1, titleKey: "starFeat.tpl.place_top1.title", descKey: "starFeat.tpl.place_top1.desc", weight: 0.65 },
    { kind: "collect_powercubes", targetMul: 1.2, titleKey: "starFeat.tpl.collect_powercubes.title", descKey: "starFeat.tpl.collect_powercubes.desc", weight: 0.48 },
    { kind: "play_brawler", targetMul: 1, meta: { brawlerId: "leon" }, titleKey: "starFeat.tpl.play_brawler.title", descKey: "starFeat.tpl.play_brawler.desc", weight: 0.5 },
    { kind: "win_team", targetMul: 1.2, titleKey: "starFeat.tpl.win_team.title", descKey: "starFeat.tpl.win_team.desc", weight: 0.58 },
    { kind: "kill_monsters", targetMul: 1.2, titleKey: "starFeat.tpl.kill_monsters.title", descKey: "starFeat.tpl.kill_monsters.desc", weight: 0.52 },
    { kind: "open_chests", targetMul: 1, titleKey: "starFeat.tpl.open_chests.title", descKey: "starFeat.tpl.open_chests.desc", weight: 0.45 },
    { kind: "brawlers_unlocked", targetMul: 1, titleKey: "starFeat.tpl.brawlers_unlocked.title", descKey: "starFeat.tpl.brawlers_unlocked.desc", weight: 0.7 },
    { kind: "play_games", targetMul: 1.5, titleKey: "starFeat.tpl.play_games.title", descKey: "starFeat.tpl.play_games.desc", weight: 0.55 },
  ],
  4: [
    { kind: "win_games", targetMul: 1.5, titleKey: "starFeat.tpl.win_games.title", descKey: "starFeat.tpl.win_games.desc", weight: 0.6 },
    { kind: "play_mode", targetMul: 1.2, meta: { mode: "bounty" }, titleKey: "starFeat.tpl.play_mode.title", descKey: "starFeat.tpl.play_mode.desc", weight: 0.55 },
    { kind: "win_mode", targetMul: 1, meta: { mode: "megashowdown" }, titleKey: "starFeat.tpl.win_mode.title", descKey: "starFeat.tpl.win_mode.desc", weight: 0.65 },
    { kind: "kill_enemies", targetMul: 1.5, titleKey: "starFeat.tpl.kill_enemies.title", descKey: "starFeat.tpl.kill_enemies.desc", weight: 0.58 },
    { kind: "deal_damage", targetMul: 2, titleKey: "starFeat.tpl.deal_damage.title", descKey: "starFeat.tpl.deal_damage.desc", weight: 0.7 },
    { kind: "heal_hp", targetMul: 1.5, titleKey: "starFeat.tpl.heal_hp.title", descKey: "starFeat.tpl.heal_hp.desc", weight: 0.58 },
    { kind: "use_super", targetMul: 1.2, titleKey: "starFeat.tpl.use_super.title", descKey: "starFeat.tpl.use_super.desc", weight: 0.52 },
    { kind: "place_showdown_top4", targetMul: 1.2, titleKey: "starFeat.tpl.place_top4.title", descKey: "starFeat.tpl.place_top4.desc", weight: 0.6 },
    { kind: "play_brawler", targetMul: 1, meta: { brawlerId: "shelly" }, titleKey: "starFeat.tpl.play_brawler.title", descKey: "starFeat.tpl.play_brawler.desc", weight: 0.54 },
    { kind: "win_brawler", targetMul: 1, meta: { brawlerId: "nita" }, titleKey: "starFeat.tpl.win_brawler.title", descKey: "starFeat.tpl.win_brawler.desc", weight: 0.62 },
    { kind: "earn_trophies", targetMul: 1.5, titleKey: "starFeat.tpl.earn_trophies.title", descKey: "starFeat.tpl.earn_trophies.desc", weight: 0.75 },
    { kind: "upgrade_brawler", targetMul: 1, titleKey: "starFeat.tpl.upgrade_brawler.title", descKey: "starFeat.tpl.upgrade_brawler.desc", weight: 0.55 },
    { kind: "play_team", targetMul: 1.2, titleKey: "starFeat.tpl.play_team.title", descKey: "starFeat.tpl.play_team.desc", weight: 0.5 },
    { kind: "win_showdown", targetMul: 1, titleKey: "starFeat.tpl.win_showdown.title", descKey: "starFeat.tpl.win_showdown.desc", weight: 0.64 },
    { kind: "open_chests", targetMul: 1, titleKey: "starFeat.tpl.open_chests.title", descKey: "starFeat.tpl.open_chests.desc", weight: 0.5 },
  ],
  5: [
    { kind: "join_club", targetMul: 1, titleKey: "starFeat.tpl.join_club.title", descKey: "starFeat.tpl.join_club.desc", weight: 0.8 },
    { kind: "brawlers_unlocked", targetMul: 1, titleKey: "starFeat.tpl.brawlers_unlocked.title", descKey: "starFeat.tpl.brawlers_unlocked.desc", weight: 0.75 },
    { kind: "win_mode", targetMul: 1.2, meta: { mode: "teamHunt" }, titleKey: "starFeat.tpl.win_mode.title", descKey: "starFeat.tpl.win_mode.desc", weight: 0.68 },
    { kind: "kill_brawler", targetMul: 1.2, meta: { brawlerId: "leon" }, titleKey: "starFeat.tpl.kill_brawler.title", descKey: "starFeat.tpl.kill_brawler.desc", weight: 0.65 },
    { kind: "deal_damage", targetMul: 2.5, titleKey: "starFeat.tpl.deal_damage.title", descKey: "starFeat.tpl.deal_damage.desc", weight: 0.78 },
    { kind: "place_top1_showdown", targetMul: 1.2, titleKey: "starFeat.tpl.place_top1.title", descKey: "starFeat.tpl.place_top1.desc", weight: 0.72 },
    { kind: "win_team", targetMul: 1.5, titleKey: "starFeat.tpl.win_team.title", descKey: "starFeat.tpl.win_team.desc", weight: 0.7 },
    { kind: "play_games", targetMul: 2, titleKey: "starFeat.tpl.play_games.title", descKey: "starFeat.tpl.play_games.desc", weight: 0.6 },
    { kind: "collect_powercubes", targetMul: 1.5, titleKey: "starFeat.tpl.collect_powercubes.title", descKey: "starFeat.tpl.collect_powercubes.desc", weight: 0.58 },
    { kind: "kill_monsters", targetMul: 1.5, titleKey: "starFeat.tpl.kill_monsters.title", descKey: "starFeat.tpl.kill_monsters.desc", weight: 0.62 },
    { kind: "play_mode", targetMul: 1, meta: { mode: "heist" }, titleKey: "starFeat.tpl.play_mode.title", descKey: "starFeat.tpl.play_mode.desc", weight: 0.56 },
    { kind: "win_brawler", targetMul: 1, meta: { brawlerId: "mortis" }, titleKey: "starFeat.tpl.win_brawler.title", descKey: "starFeat.tpl.win_brawler.desc", weight: 0.66 },
    { kind: "heal_hp", targetMul: 2, titleKey: "starFeat.tpl.heal_hp.title", descKey: "starFeat.tpl.heal_hp.desc", weight: 0.64 },
    { kind: "use_super", targetMul: 1.5, titleKey: "starFeat.tpl.use_super.title", descKey: "starFeat.tpl.use_super.desc", weight: 0.58 },
    { kind: "open_chests", targetMul: 1.2, titleKey: "starFeat.tpl.open_chests.title", descKey: "starFeat.tpl.open_chests.desc", weight: 0.55 },
  ],
  6: [
    { kind: "clash_pass_level", targetMul: 1, titleKey: "starFeat.tpl.clash_pass_level.title", descKey: "starFeat.tpl.clash_pass_level.desc", weight: 0.85 },
    { kind: "earn_trophies", targetMul: 2, titleKey: "starFeat.tpl.earn_trophies.title", descKey: "starFeat.tpl.earn_trophies.desc", weight: 0.9 },
    { kind: "win_games", targetMul: 2, titleKey: "starFeat.tpl.win_games.title", descKey: "starFeat.tpl.win_games.desc", weight: 0.75 },
    { kind: "play_games", targetMul: 2.5, titleKey: "starFeat.tpl.play_games.title", descKey: "starFeat.tpl.play_games.desc", weight: 0.7 },
    { kind: "deal_damage", targetMul: 3, titleKey: "starFeat.tpl.deal_damage.title", descKey: "starFeat.tpl.deal_damage.desc", weight: 0.88 },
    { kind: "kill_enemies", targetMul: 2, titleKey: "starFeat.tpl.kill_enemies.title", descKey: "starFeat.tpl.kill_enemies.desc", weight: 0.72 },
    { kind: "win_showdown", targetMul: 1.5, titleKey: "starFeat.tpl.win_showdown.title", descKey: "starFeat.tpl.win_showdown.desc", weight: 0.78 },
    { kind: "place_top3", targetMul: 1.5, titleKey: "starFeat.tpl.place_top3.title", descKey: "starFeat.tpl.place_top3.desc", weight: 0.74 },
    { kind: "win_mode", targetMul: 1.5, meta: { mode: "starstrike" }, titleKey: "starFeat.tpl.win_mode.title", descKey: "starFeat.tpl.win_mode.desc", weight: 0.76 },
    { kind: "play_brawler", targetMul: 1.2, meta: { brawlerId: "crow" }, titleKey: "starFeat.tpl.play_brawler.title", descKey: "starFeat.tpl.play_brawler.desc", weight: 0.68 },
    { kind: "kill_brawler", targetMul: 1.2, meta: { brawlerId: "spike" }, titleKey: "starFeat.tpl.kill_brawler.title", descKey: "starFeat.tpl.kill_brawler.desc", weight: 0.7 },
    { kind: "heal_hp", targetMul: 2.5, titleKey: "starFeat.tpl.heal_hp.title", descKey: "starFeat.tpl.heal_hp.desc", weight: 0.72 },
    { kind: "collect_powercubes", targetMul: 2, titleKey: "starFeat.tpl.collect_powercubes.title", descKey: "starFeat.tpl.collect_powercubes.desc", weight: 0.66 },
    { kind: "upgrade_brawler", targetMul: 1.2, titleKey: "starFeat.tpl.upgrade_brawler.title", descKey: "starFeat.tpl.upgrade_brawler.desc", weight: 0.65 },
    { kind: "brawlers_unlocked", targetMul: 1, titleKey: "starFeat.tpl.brawlers_unlocked.title", descKey: "starFeat.tpl.brawlers_unlocked.desc", weight: 0.82 },
  ],
};

function templatesForTier(tier: StarFeatTier): SlotTemplate[] {
  if (tier === 1) return TIER_SLOT_TEMPLATES;
  const extra = EXTRA_BY_TIER[tier];
  if (extra && extra.length >= FEATS_PER_STAR_TIER) return extra.slice(0, FEATS_PER_STAR_TIER);
  const merged = [...TIER_SLOT_TEMPLATES];
  if (extra) {
    for (let i = 0; i < extra.length && merged.length < FEATS_PER_STAR_TIER; i++) {
      merged[i] = extra[i];
    }
  }
  while (merged.length < FEATS_PER_STAR_TIER) {
    merged.push(TIER_SLOT_TEMPLATES[merged.length % TIER_SLOT_TEMPLATES.length]);
  }
  return merged.slice(0, FEATS_PER_STAR_TIER);
}

export function buildStarFeatCatalog(): StarFeatDef[] {
  const out: StarFeatDef[] = [];
  for (let tier = 1 as StarFeatTier; tier <= 6; tier++) {
    const tpls = templatesForTier(tier);
    for (let i = 0; i < FEATS_PER_STAR_TIER; i++) {
      const tpl = tpls[i];
      const base = BASE_TARGETS[tpl.kind] ?? 5;
      out.push(slot(tier, i, tpl, base));
    }
  }
  return out;
}
