import type { GameParticipant, ParticipantBattleStats } from "../types/gameResult";

export type BattleTitleKind = "mvp" | "kills" | "damage" | "healing" | "sacrifice";

const EMPTY: ParticipantBattleStats = {
  deaths: 0,
  kills: 0,
  damageDealt: 0,
  healingDone: 0,
};

export function participantResultKey(p: GameParticipant): string {
  return `${p.team}:${p.brawlerId}:${p.displayName}`;
}

function statsOf(p: GameParticipant): ParticipantBattleStats {
  return p.battleStats ?? EMPTY;
}

/** Каждый kill в MVP-очке ≈ 500 урона (убийства учитываются вместе с уроном). */
function mvpScore(stats: ParticipantBattleStats): number {
  return stats.damageDealt + stats.kills * 500;
}

/** Единственный победитель по метрике; при ничьей — null (титул не выдаётся). */
function pickUniqueWinner(
  entries: Array<{ key: string; stats: ParticipantBattleStats }>,
  score: (s: ParticipantBattleStats) => number,
  requirePositive = true,
): string | null {
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(e => score(e.stats)));
  if (requirePositive && max <= 0) return null;
  const winners = entries.filter(e => score(e.stats) === max);
  return winners.length === 1 ? winners[0].key : null;
}

function addTitle(map: Map<string, BattleTitleKind[]>, key: string, kind: BattleTitleKind): void {
  const arr = map.get(key) ?? [];
  if (!arr.includes(kind)) arr.push(kind);
  map.set(key, arr);
}

/** MVP + специальные титулы по макс. киллам, урону, лечению, смертям. */
export function computeBattleTitles(participants: GameParticipant[]): Map<string, BattleTitleKind[]> {
  const map = new Map<string, BattleTitleKind[]>();
  const entries = participants.map(p => ({
    key: participantResultKey(p),
    stats: statsOf(p),
  }));

  const mvpKey = pickUniqueWinner(entries, mvpScore);
  if (mvpKey) addTitle(map, mvpKey, "mvp");

  const killsKey = pickUniqueWinner(entries, s => s.kills);
  if (killsKey) addTitle(map, killsKey, "kills");

  const damageKey = pickUniqueWinner(entries, s => s.damageDealt);
  if (damageKey) addTitle(map, damageKey, "damage");

  const healingKey = pickUniqueWinner(entries, s => s.healingDone);
  if (healingKey) addTitle(map, healingKey, "healing");

  const sacrificeKey = pickUniqueWinner(entries, s => s.deaths);
  if (sacrificeKey) addTitle(map, sacrificeKey, "sacrifice");

  return map;
}

const TITLE_I18N: Record<BattleTitleKind, string> = {
  mvp: "result.title.mvp",
  kills: "result.title.kills",
  damage: "result.title.damage",
  healing: "result.title.healing",
  sacrifice: "result.title.sacrifice",
};

export function battleTitleI18nKey(kind: BattleTitleKind): string {
  return TITLE_I18N[kind];
}
