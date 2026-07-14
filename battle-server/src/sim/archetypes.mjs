// ─────────────────────────────────────────────────────────────────────────────
// archetypes.mjs — combat identity for every brawler.
// Each brawler maps to an ATTACK archetype and a SUPER archetype so they play
// distinctly (shotguns, snipers, melee, lobbed AoE; dashes, novas, heals,
// shields, turrets, barrages, beams). Numbers scale off the brawler's own stats.
// ─────────────────────────────────────────────────────────────────────────────

export const ATTACK_PARAMS = {
  single: { speedMul: 1, dmgMul: 1, rangeMul: 1, charges: true },
  shotgun: { pellets: 5, spread: 0.5, dmgMul: 0.42, rangeMul: 0.7, speedMul: 0.95 },
  sniper: { speedMul: 1.7, dmgMul: 1.35, rangeMul: 1.35 },
  burst: { count: 3, spread: 0.06, gap: 5, dmgMul: 0.5, speedMul: 1.15 }, // gap in ticks
  melee: { arc: 0.95, dmgMul: 1.15, rangeMul: 1.0 },
  lob: { dmgMul: 1.05, explodeRadius: 95, speedMul: 0.8 },
};

export const SUPER_PARAMS = {
  dash: { dist: 300, dmgMul: 1.5, radius: 80 },
  nova: { radius: 210, dmgMul: 1.7, knockback: 130 },
  barrage: { count: 9, spread: 0.95, dmgMul: 0.6, speedMul: 1.05 },
  heal: { radius: 250, amount: 0.45 },
  shield: { amount: 0.6, duration: 6 },
  turret: { hpFrac: 0.4, duration: 12, fireCd: 0.7, dmgMul: 0.5, range: 320 },
  beam: { dmgMul: 2.6, speedMul: 2.1, rangeMul: 1.7 },
};

// Per-brawler assignment (matches their kit's feel).
const BY_ID = {
  miya: { attack: "burst", super: "dash" },
  ronin: { attack: "melee", super: "dash" },
  yuki: { attack: "single", super: "heal" },
  lumina: { attack: "single", super: "shield" },
  callista: { attack: "shotgun", super: "barrage" },
  mirabel: { attack: "single", super: "shield" },
  kenji: { attack: "single", super: "nova" },
  silven: { attack: "single", super: "turret" },
  octavia: { attack: "single", super: "turret" },
  hana: { attack: "single", super: "heal" },
  goro: { attack: "melee", super: "nova" },
  vittoria: { attack: "shotgun", super: "dash" },
  sora: { attack: "lob", super: "barrage" },
  elian: { attack: "lob", super: "nova" },
  zephyrin: { attack: "single", super: "barrage" },
  rin: { attack: "single", super: "barrage" },
  taro: { attack: "shotgun", super: "turret" },
  oliver: { attack: "single", super: "turret" },
  zafkiel: { attack: "sniper", super: "beam" },
  verdeletta: { attack: "single", super: "turret" },
  airin: { attack: "burst", super: "barrage" },
};

const BY_ROLE = {
  "Ассасин": { attack: "burst", super: "dash" },
  "Танк": { attack: "melee", super: "dash" },
  "Берсерк": { attack: "melee", super: "nova" },
  "Снайпер": { attack: "sniper", super: "beam" },
  "Стрелок": { attack: "burst", super: "barrage" },
  "Маг": { attack: "lob", super: "barrage" },
  "Хилер": { attack: "single", super: "heal" },
  "Поддержка": { attack: "single", super: "shield" },
  "Контроллер": { attack: "single", super: "turret" },
  "Инженер": { attack: "shotgun", super: "turret" },
  "Отравитель": { attack: "single", super: "barrage" },
};

export function getCombatArchetype(id, role) {
  const sel = BY_ID[id] || BY_ROLE[role] || { attack: "single", super: "nova" };
  return {
    attack: { type: sel.attack, ...(ATTACK_PARAMS[sel.attack] || ATTACK_PARAMS.single) },
    super: { type: sel.super, ...(SUPER_PARAMS[sel.super] || SUPER_PARAMS.nova) },
  };
}
