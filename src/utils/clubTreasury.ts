/**
 * Club Treasure Vault 2.0 — shared fund, battle bonuses, exit refunds.
 */
import type { Club } from "./clubs";
import { appendClubSystemMessage, getClub, getMyClub, patchClub } from "./clubs";
import { pushInboxToUsername } from "./messages";
import {
  getCurrentProfile,
  getCurrentUsername,
  updateProfile,
  getAllProfiles,
  type UserProfile,
} from "./localStorageAPI";

export const TREASURY_MAX_PCT = 15;
export const TREASURY_MIN_PCT_FOR_REFUND = 5;
export const TREASURY_MIN_DAYS_FOR_REFUND = 30;
export const TREASURY_PCT_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const TREASURY_FUND_CAP_COINS = 1_000_000;
export const TREASURY_MAX_BATTLE_BONUS = 15;
export const TREASURY_BOOST_DURATION_MS = 24 * 60 * 60 * 1000;
export const TREASURY_VOTE_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
export const TREASURY_GEM_VALUE_COINS = 100;
export const TREASURY_PP_VALUE_COINS = 50;
export const TREASURY_BATTLE_BONUS_STEP = 0.1;

/** Сколько ресурса нужно для +15% соответствующего боя-бонуса (эквивалент 1M очков фонда). */
export const TREASURY_BATTLE_RESOURCE_CAP: Record<TreasuryResource, number> = {
  coins: 1_000_000,
  gems: 10_000,
  powerPoints: 20_000,
};

export interface ClubTreasuryBattleBonuses {
  hpPct: number;
  speedPct: number;
  damagePct: number;
}

export type TreasuryResource = "coins" | "gems" | "powerPoints";

export interface ClubTreasuryMemberShare {
  coins: number;
  gems: number;
  powerPoints: number;
}

export interface ClubTreasuryBoostVote {
  id: string;
  startedAt: number;
  endsAt: number;
  yes: string[];
  no: string[];
  startedBy: string;
}

export interface ClubTreasury {
  coins: number;
  gems: number;
  powerPoints: number;
  memberShares: Record<string, ClubTreasuryMemberShare>;
  boostActiveUntil?: number;
  boostVote?: ClubTreasuryBoostVote;
}

export interface ClubTreasuryProfileState {
  contributionPct: number;
  pctChangedAt: number;
  clubJoinedAt: number;
  /** Средний % отчислений за всё время (для комиссии при выходе). */
  avgContributionPct: number;
  pctWeightedSum: number;
  pctWeightedMs: number;
}

export interface TreasuryLeaderboardRow {
  username: string;
  contributionPct: number;
  coins: number;
  gems: number;
  powerPoints: number;
  treasurePoints: number;
}

export interface LeaveTreasuryPreview {
  eligible: boolean;
  reason?: string;
  refundCoins: number;
  refundGems: number;
  refundPowerPoints: number;
  commissionPct: number;
  keptCoins: number;
  keptGems: number;
  keptPowerPoints: number;
  daysInClub: number;
  currentPct: number;
}

function emptyShare(): ClubTreasuryMemberShare {
  return { coins: 0, gems: 0, powerPoints: 0 };
}

export function emptyClubTreasury(): ClubTreasury {
  return { coins: 0, gems: 0, powerPoints: 0, memberShares: {} };
}

export function treasurePointsFromAmounts(coins: number, gems: number, powerPoints: number): number {
  return coins + gems * TREASURY_GEM_VALUE_COINS + powerPoints * TREASURY_PP_VALUE_COINS;
}

export function fundTreasurePoints(treasury: ClubTreasury): number {
  return treasurePointsFromAmounts(treasury.coins, treasury.gems, treasury.powerPoints);
}

export function getClubTreasury(club: Club): ClubTreasury {
  const t = club.treasury ?? emptyClubTreasury();
  return {
    coins: t.coins ?? 0,
    gems: t.gems ?? 0,
    powerPoints: t.powerPoints ?? 0,
    memberShares: { ...(t.memberShares ?? {}) },
    boostActiveUntil: t.boostActiveUntil,
    boostVote: t.boostVote,
  };
}

export function getTreasuryProfileState(profile: UserProfile): ClubTreasuryProfileState {
  const raw = profile.clubTreasury;
  const pct = Math.max(0, Math.min(TREASURY_MAX_PCT, raw?.contributionPct ?? 0));
  return {
    contributionPct: pct,
    /** 0 = ещё не меняли — кулдаун не блокирует первое сохранение */
    pctChangedAt: raw?.pctChangedAt ?? 0,
    clubJoinedAt: raw?.clubJoinedAt ?? Date.now(),
    avgContributionPct: raw?.avgContributionPct ?? pct,
    pctWeightedSum: raw?.pctWeightedSum ?? 0,
    pctWeightedMs: raw?.pctWeightedMs ?? 0,
  };
}

function touchAvgPct(state: ClubTreasuryProfileState, now = Date.now()): ClubTreasuryProfileState {
  const since = state.pctChangedAt > 0 ? state.pctChangedAt : state.clubJoinedAt;
  const elapsed = Math.max(0, now - since);
  const weightedSum = state.pctWeightedSum + state.contributionPct * elapsed;
  const weightedMs = state.pctWeightedMs + elapsed;
  const avg = weightedMs > 0 ? weightedSum / weightedMs : state.contributionPct;
  return {
    ...state,
    pctWeightedSum: weightedSum,
    pctWeightedMs: weightedMs,
    pctChangedAt: now,
    avgContributionPct: avg,
  };
}

export function ensureMemberShare(treasury: ClubTreasury, username: string): ClubTreasuryMemberShare {
  if (!treasury.memberShares[username]) treasury.memberShares[username] = emptyShare();
  return treasury.memberShares[username]!;
}

export function getMemberShare(treasury: ClubTreasury, username: string): ClubTreasuryMemberShare {
  return { ...(treasury.memberShares[username] ?? emptyShare()) };
}

/** Бонус в бою от накопленного ресурса (шаг 0.1%, макс. 15%). Любой ненулевой вклад → минимум 0.1%. */
export function treasuryResourceToBattleBonusPct(amount: number, resource: TreasuryResource): number {
  const cap = TREASURY_BATTLE_RESOURCE_CAP[resource];
  if (amount <= 0 || cap <= 0) return 0;
  const raw = Math.min(TREASURY_MAX_BATTLE_BONUS, (amount / cap) * TREASURY_MAX_BATTLE_BONUS);
  const rounded = Math.round(raw * 10) / 10;
  if (rounded >= TREASURY_BATTLE_BONUS_STEP) return rounded;
  return TREASURY_BATTLE_BONUS_STEP;
}

function applyTreasuryBoostToBonuses(
  bonuses: ClubTreasuryBattleBonuses,
  treasury: ClubTreasury,
): ClubTreasuryBattleBonuses {
  if (!treasury.boostActiveUntil || Date.now() >= treasury.boostActiveUntil) return bonuses;
  const double = (v: number) => Math.min(TREASURY_MAX_BATTLE_BONUS * 2, Math.round(v * 2 * 10) / 10);
  return {
    hpPct: double(bonuses.hpPct),
    speedPct: double(bonuses.speedPct),
    damagePct: double(bonuses.damagePct),
  };
}

export function getClubTreasuryBattleBonuses(club: Club | null): ClubTreasuryBattleBonuses {
  if (!club) return { hpPct: 0, speedPct: 0, damagePct: 0 };
  const treasury = getClubTreasury(club);
  const base: ClubTreasuryBattleBonuses = {
    hpPct: treasuryResourceToBattleBonusPct(treasury.coins, "coins"),
    speedPct: treasuryResourceToBattleBonusPct(treasury.gems, "gems"),
    damagePct: treasuryResourceToBattleBonusPct(treasury.powerPoints, "powerPoints"),
  };
  return applyTreasuryBoostToBonuses(base, treasury);
}

export function getPlayerTreasuryBattleBonuses(
  profile: UserProfile | null,
  club: Club | null,
): ClubTreasuryBattleBonuses {
  if (!profile?.clubId || !club) return { hpPct: 0, speedPct: 0, damagePct: 0 };
  if (getTreasuryProfileState(profile).contributionPct <= 0) {
    return { hpPct: 0, speedPct: 0, damagePct: 0 };
  }
  return getClubTreasuryBattleBonuses(club);
}

export function getResourceBattleBonusPct(
  resource: TreasuryResource,
  profile: UserProfile | null,
  club: Club | null,
): number {
  const b = getPlayerTreasuryBattleBonuses(profile, club);
  if (resource === "coins") return b.hpPct;
  if (resource === "gems") return b.speedPct;
  return b.damagePct;
}

/** @deprecated Используйте getPlayerTreasuryBattleBonuses — оставлено для совместимости. */
export function clubBattleBonusPct(profile: UserProfile | null, club: Club | null): number {
  const b = getPlayerTreasuryBattleBonuses(profile, club);
  return Math.max(b.hpPct, b.speedPct, b.damagePct);
}

const PILE_MIN_VISUAL = 8;
export const PILE_MAX_VISUAL = 1000;

export interface TreasuryDepositEvent {
  resource: TreasuryResource;
  amount: number;
  username: string;
  at: number;
}

const treasuryDepositListeners = new Set<(event: TreasuryDepositEvent) => void>();

/** Подписка на отчисления в сокровищницу (для анимации кучи). */
export function subscribeTreasuryDeposits(listener: (event: TreasuryDepositEvent) => void): () => void {
  treasuryDepositListeners.add(listener);
  return () => treasuryDepositListeners.delete(listener);
}

function emitTreasuryDeposit(event: TreasuryDepositEvent): void {
  treasuryDepositListeners.forEach((listener) => listener(event));
}

/** Сколько из прироста уходит в клуб и остаётся игроку. */
export function computeTreasuryDeduction(
  grossGain: number,
  contributionPct: number,
): { toVault: number; toPlayer: number } {
  if (grossGain <= 0) return { toVault: 0, toPlayer: 0 };
  const pct = Math.max(0, Math.min(TREASURY_MAX_PCT, contributionPct)) / 100;
  const toVault = Math.floor(grossGain * pct);
  return { toVault, toPlayer: grossGain - toVault };
}

function findProfileByUsername(
  all: Record<string, UserProfile>,
  username: string,
): UserProfile | null {
  if (all[username]) return all[username]!;
  const lower = username.toLowerCase();
  for (const key of Object.keys(all)) {
    if (key.toLowerCase() === lower) return all[key]!;
  }
  return null;
}

/** Текущий % отчислений игрока (закреплён в профиле до следующего сохранения). */
export function getMemberContributionPct(username: string): number {
  const all = getAllProfiles() as Record<string, UserProfile>;
  const prof = findProfileByUsername(all, username);
  if (!prof) return 0;
  return getTreasuryProfileState(prof).contributionPct;
}

export function buildTreasuryLeaderboard(club: Club): TreasuryLeaderboardRow[] {
  const treasury = getClubTreasury(club);
  const all = getAllProfiles() as Record<string, UserProfile>;
  return club.members
    .map((m) => {
      const share = getMemberShare(treasury, m.username);
      const prof = findProfileByUsername(all, m.username);
      const contributionPct = prof ? getTreasuryProfileState(prof).contributionPct : 0;
      return {
        username: m.username,
        contributionPct,
        ...share,
        treasurePoints: treasurePointsFromAmounts(share.coins, share.gems, share.powerPoints),
      };
    })
    .sort((a, b) => b.treasurePoints - a.treasurePoints);
}
export function pileVisualCount(total: number, resource: TreasuryResource): number {
  const scale = resource === "coins" ? 8000 : resource === "gems" ? 40 : 200;
  if (total <= 0) return 0;
  const raw = Math.ceil(Math.sqrt(total / scale));
  return Math.min(PILE_MAX_VISUAL, Math.max(PILE_MIN_VISUAL, raw));
}

export function canChangeTreasuryPct(profile: UserProfile): { ok: boolean; msLeft?: number } {
  const state = getTreasuryProfileState(profile);
  if (state.pctChangedAt <= 0) return { ok: true };
  const elapsed = Date.now() - state.pctChangedAt;
  if (elapsed >= TREASURY_PCT_CHANGE_COOLDOWN_MS) return { ok: true };
  return { ok: false, msLeft: TREASURY_PCT_CHANGE_COOLDOWN_MS - elapsed };
}

export function setTreasuryContributionPct(pct: number): { success: boolean; error?: string } {
  const profile = getCurrentProfile();
  if (!profile?.clubId) return { success: false, error: "notInClub" };
  const next = Math.max(0, Math.min(TREASURY_MAX_PCT, Math.round(pct)));
  const gate = canChangeTreasuryPct(profile);
  const state = getTreasuryProfileState(profile);
  if (!gate.ok && next !== state.contributionPct) {
    return { success: false, error: "cooldown" };
  }
  let updated = touchAvgPct(state);
  if (next !== state.contributionPct) {
    updated = { ...updated, contributionPct: next, pctChangedAt: Date.now() };
  }
  updateProfile({ clubTreasury: updated }, { skipTreasury: true });
  return { success: true };
}

export function ensureTreasuryProfileReady(): void {
  const username = getCurrentUsername();
  if (!username) return;
  const profiles = getAllProfiles() as Record<string, UserProfile>;
  const profile = profiles[username];
  if (!profile?.clubId) return;
  if (profile.clubTreasury) return;
  initTreasuryOnJoin();
}

export function initTreasuryOnJoin(_username?: string): void {
  updateProfile({
    clubTreasury: {
      contributionPct: 0,
      pctChangedAt: 0,
      clubJoinedAt: Date.now(),
      avgContributionPct: 0,
      pctWeightedSum: 0,
      pctWeightedMs: 0,
    },
  }, { skipTreasury: true });
}

export function initTreasuryForUsername(
  profiles: Record<string, UserProfile>,
  username: string,
): void {
  if (!profiles[username]) return;
  profiles[username].clubTreasury = {
    contributionPct: 0,
    pctChangedAt: 0,
    clubJoinedAt: Date.now(),
    avgContributionPct: 0,
    pctWeightedSum: 0,
    pctWeightedMs: 0,
  };
}

export function buildLeaveClubConfirmMessage(
  profile: UserProfile,
  club: Club,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const preview = getLeaveTreasuryPreview(profile, club);
  const lines = [t("clubs.leaveConfirm"), "", t("clubs.treasury.leaveWarning")];
  if (preview.reason === "minDays") {
    lines.push(t("clubs.treasury.leaveNoRefundDays", { days: preview.daysInClub, need: TREASURY_MIN_DAYS_FOR_REFUND }));
  } else if (preview.reason === "minPct") {
    lines.push(t("clubs.treasury.leaveNoRefundPct", { pct: preview.currentPct, need: TREASURY_MIN_PCT_FOR_REFUND }));
  } else if (preview.eligible && (preview.refundCoins + preview.refundGems + preview.refundPowerPoints) > 0) {
    lines.push(t("clubs.treasury.leaveRefundHint", {
      commission: preview.commissionPct,
      coins: preview.refundCoins,
      gems: preview.refundGems,
      pp: preview.refundPowerPoints,
    }));
  } else if (preview.eligible) {
    lines.push(t("clubs.treasury.leaveEligibleEmpty"));
  }
  return lines.join("\n");
}

function depositToClub(
  clubId: string,
  username: string,
  delta: Partial<Record<TreasuryResource, number>>,
): void {
  const depositor = username || getCurrentUsername() || "";
  const deposits: TreasuryDepositEvent[] = [];

  patchClub(clubId, (club) => {
    const treasury = getClubTreasury(club);
    const share = ensureMemberShare(treasury, depositor);
    for (const key of ["coins", "gems", "powerPoints"] as TreasuryResource[]) {
      const amt = Math.max(0, Math.floor(delta[key] ?? 0));
      if (amt <= 0) continue;
      treasury[key] += amt;
      share[key] += amt;
      deposits.push({ resource: key, amount: amt, username: depositor, at: Date.now() });
    }
    return { ...club, treasury };
  });

  for (const event of deposits) emitTreasuryDeposit(event);
}

export function applyTreasuryOnResourceGrant(
  profile: UserProfile,
  updates: Partial<UserProfile>,
): Partial<UserProfile> {
  if (!profile.clubId) return updates;
  const state = getTreasuryProfileState(profile);
  if (state.contributionPct <= 0) return updates;

  const out = { ...updates };
  const pct = state.contributionPct;

  if (updates.coins !== undefined && updates.coins > profile.coins) {
    const gross = updates.coins - profile.coins;
    const { toVault, toPlayer } = computeTreasuryDeduction(gross, pct);
    if (toVault > 0) {
      depositToClub(profile.clubId, profile.username, { coins: toVault });
      out.coins = profile.coins + toPlayer;
    }
  }
  if (updates.gems !== undefined && updates.gems > profile.gems) {
    const gross = updates.gems - profile.gems;
    const { toVault, toPlayer } = computeTreasuryDeduction(gross, pct);
    if (toVault > 0) {
      depositToClub(profile.clubId, profile.username, { gems: toVault });
      out.gems = profile.gems + toPlayer;
    }
  }
  if (updates.powerPoints !== undefined && updates.powerPoints > profile.powerPoints) {
    const gross = updates.powerPoints - profile.powerPoints;
    const { toVault, toPlayer } = computeTreasuryDeduction(gross, pct);
    if (toVault > 0) {
      depositToClub(profile.clubId, profile.username, { powerPoints: toVault });
      out.powerPoints = profile.powerPoints + toPlayer;
    }
  }
  return out;
}

export function getLeaveTreasuryPreview(profile: UserProfile, club: Club): LeaveTreasuryPreview {
  const state = getTreasuryProfileState(profile);
  const treasury = getClubTreasury(club);
  const share = getMemberShare(treasury, profile.username);
  const daysInClub = (Date.now() - state.clubJoinedAt) / (24 * 60 * 60 * 1000);
  const commissionPct = Math.round(state.avgContributionPct * 10) / 10;
  const keepRatio = Math.max(0, 1 - commissionPct / 100);

  const base: LeaveTreasuryPreview = {
    eligible: false,
    refundCoins: 0,
    refundGems: 0,
    refundPowerPoints: 0,
    commissionPct,
    keptCoins: share.coins,
    keptGems: share.gems,
    keptPowerPoints: share.powerPoints,
    daysInClub: Math.floor(daysInClub),
    currentPct: state.contributionPct,
  };

  if (daysInClub < TREASURY_MIN_DAYS_FOR_REFUND) {
    return { ...base, reason: "minDays" };
  }
  if (state.contributionPct < TREASURY_MIN_PCT_FOR_REFUND) {
    return { ...base, reason: "minPct" };
  }
  if (share.coins + share.gems + share.powerPoints <= 0) {
    return { ...base, reason: "nothing", eligible: true };
  }

  return {
    ...base,
    eligible: true,
    refundCoins: Math.floor(share.coins * keepRatio),
    refundGems: Math.floor(share.gems * keepRatio),
    refundPowerPoints: Math.floor(share.powerPoints * keepRatio),
    keptCoins: share.coins - Math.floor(share.coins * keepRatio),
    keptGems: share.gems - Math.floor(share.gems * keepRatio),
    keptPowerPoints: share.powerPoints - Math.floor(share.powerPoints * keepRatio),
  };
}

export function processTreasuryLeaveRefund(profile: UserProfile, clubId: string): Partial<UserProfile> | null {
  const club = getMyClub();
  if (!club || club.id !== clubId) return null;
  const preview = getLeaveTreasuryPreview(profile, club);
  const share = getMemberShare(getClubTreasury(club), profile.username);

  patchClub(clubId, (c) => {
    const treasury = getClubTreasury(c);
    treasury.coins = Math.max(0, treasury.coins - share.coins);
    treasury.gems = Math.max(0, treasury.gems - share.gems);
    treasury.powerPoints = Math.max(0, treasury.powerPoints - share.powerPoints);
    delete treasury.memberShares[profile.username];
    return { ...c, treasury };
  });

  if (!preview.eligible) return null;
  return {
    coins: profile.coins + preview.refundCoins,
    gems: profile.gems + preview.refundGems,
    powerPoints: profile.powerPoints + preview.refundPowerPoints,
  };
}

function applyTreasuryBoostSpend(treasury: ClubTreasury): void {
  const spendRatio = 0.5;
  treasury.coins = Math.floor(treasury.coins * (1 - spendRatio));
  treasury.gems = Math.floor(treasury.gems * (1 - spendRatio));
  treasury.powerPoints = Math.floor(treasury.powerPoints * (1 - spendRatio));
  for (const username of Object.keys(treasury.memberShares)) {
    const s = treasury.memberShares[username]!;
    s.coins = Math.floor(s.coins * (1 - spendRatio));
    s.gems = Math.floor(s.gems * (1 - spendRatio));
    s.powerPoints = Math.floor(s.powerPoints * (1 - spendRatio));
  }
  treasury.boostActiveUntil = Date.now() + TREASURY_BOOST_DURATION_MS;
  treasury.boostVote = undefined;
}

type TreasuryVoteResult = { passed: boolean; yes: number; no: number; total: number };

function finalizeBoostVote(club: Club, treasury: ClubTreasury): TreasuryVoteResult | null {
  const vote = treasury.boostVote;
  if (!vote) return null;
  const yes = vote.yes.length;
  const no = vote.no.length;
  const total = club.members.length;
  const passed = yes > total / 2;
  treasury.boostVote = undefined;
  if (passed) applyTreasuryBoostSpend(treasury);
  return { passed, yes, no, total };
}

function notifyClubMembersInbox(members: Club["members"], title: string, body: string): void {
  const stamp = Date.now();
  const baseId = `tv_${stamp.toString(36)}`;
  for (const m of members) {
    pushInboxToUsername(m.username, {
      id: `${baseId}_${m.username}`,
      kind: "system",
      title,
      body,
      sentAt: stamp,
      read: false,
    });
  }
}

function announceTreasuryVoteStarted(club: Club, founder: string): void {
  const left = formatMsLeft(TREASURY_VOTE_DURATION_MS);
  const chatText =
    `⚡ ${founder} объявил(а) голосование: ускорение ×2 бонусов сокровищницы на 1 день. ` +
    `При принятии списывается 50% фонда. Голосование длится 3 дня (осталось ${left}).`;
  appendClubSystemMessage(club.id, chatText);
  notifyClubMembersInbox(
    club.members,
    "Голосование в сокровищнице",
    `В клубе «${club.name}» началось голосование за ускорение ×2 бонусов сокровищницы на 1 день. ` +
      `При принятии с фонда спишется 50% ресурсов. Проголосуйте в разделе «Сокровищница».`,
  );
}

function announceTreasuryVoteResult(club: Club, result: TreasuryVoteResult, early: boolean): void {
  const earlyNote = early ? " Голосование завершено досрочно создателем клуба." : "";
  if (result.passed) {
    appendClubSystemMessage(
      club.id,
      `✅ Голосование завершено: ускорение ×2 на 1 день принято (${result.yes} за / ${result.total} участников). ` +
        `С фонда списано 50%.${earlyNote}`,
    );
    notifyClubMembersInbox(
      club.members,
      "Ускорение ×2 активировано",
      `В клубе «${club.name}» голосование принято (${result.yes} за из ${result.total}). ` +
        `Бонусы сокровищницы удвоены на 1 день, с фонда списано 50% ресурсов.`,
    );
  } else {
    appendClubSystemMessage(
      club.id,
      `❌ Голосование завершено: ускорение отклонено (${result.yes} за / ${result.total} участников).${earlyNote}`,
    );
    notifyClubMembersInbox(
      club.members,
      "Голосование отклонено",
      `В клубе «${club.name}» голосование за ускорение ×2 не прошло (${result.yes} за из ${result.total}).`,
    );
  }
}

/** По окончании 3-дневного голосования: >50% «за» → −50% фонда и ускорение ×2 на 1 день. */
export function resolveTreasuryBoostVote(clubId: string): boolean {
  let result: TreasuryVoteResult | null = null;
  let clubForAnnounce: Club | null = null;
  patchClub(clubId, (club) => {
    const treasury = getClubTreasury(club);
    const vote = treasury.boostVote;
    if (!vote || Date.now() < vote.endsAt) return club;
    result = finalizeBoostVote(club, treasury);
    clubForAnnounce = { ...club, treasury: { ...treasury } };
    return clubForAnnounce;
  });
  if (result && clubForAnnounce) announceTreasuryVoteResult(clubForAnnounce, result, false);
  return !!result;
}

export function getMyTreasuryBoostVote(club: Club | null): "yes" | "no" | null {
  const me = getCurrentUsername();
  if (!me || !club?.treasury?.boostVote) return null;
  const vote = club.treasury.boostVote;
  if (Date.now() >= vote.endsAt) return null;
  if (vote.yes.includes(me)) return "yes";
  if (vote.no.includes(me)) return "no";
  return null;
}

export function startTreasuryBoostVote(clubId: string): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  if (!me) return { success: false, error: "auth" };
  resolveTreasuryBoostVote(clubId);
  const patched = patchClub(clubId, (club) => {
    if (club.createdBy !== me) return club;
    const treasury = getClubTreasury(club);
    if (treasury.boostVote && Date.now() < treasury.boostVote.endsAt) return club;
    treasury.boostVote = {
      id: `tv_${Date.now()}`,
      startedAt: Date.now(),
      endsAt: Date.now() + TREASURY_VOTE_DURATION_MS,
      yes: [],
      no: [],
      startedBy: me,
    };
    return { ...club, treasury };
  });
  if (!patched?.treasury?.boostVote) {
    const club = getMyClub();
    if (club?.id === clubId && club.createdBy !== me) return { success: false, error: "notOwner" };
    if (club?.treasury?.boostVote && Date.now() < club.treasury.boostVote.endsAt) {
      return { success: false, error: "activeVote" };
    }
    return { success: false, error: "failed" };
  }
  const club = getClub(clubId);
  if (club) announceTreasuryVoteStarted(club, me);
  return { success: true };
}

export function voteTreasuryBoost(clubId: string, yes: boolean): { success: boolean; error?: string } {
  const me = getCurrentUsername();
  if (!me) return { success: false, error: "auth" };
  resolveTreasuryBoostVote(clubId);
  let alreadyVoted = false;
  const patched = patchClub(clubId, (club) => {
    if (!club.treasury?.boostVote) return club;
    const vote = club.treasury.boostVote;
    if (Date.now() >= vote.endsAt) return club;
    if (vote.yes.includes(me) || vote.no.includes(me)) {
      alreadyVoted = true;
      return club;
    }
    const treasury = getClubTreasury(club);
    treasury.boostVote = {
      ...vote,
      yes: yes ? [...vote.yes, me] : vote.yes,
      no: yes ? vote.no : [...vote.no, me],
    };
    return { ...club, treasury };
  });
  if (alreadyVoted) return { success: false, error: "alreadyVoted" };
  if (!patched?.treasury?.boostVote) return { success: false, error: "noVote" };
  const v = patched.treasury.boostVote;
  if (!v.yes.includes(me) && !v.no.includes(me)) return { success: false, error: "failed" };
  return { success: true };
}

/** Создатель клуба досрочно завершает голосование; результат по большинству «за». */
export function endTreasuryBoostVoteEarly(clubId: string): { success: boolean; error?: string; passed?: boolean } {
  const me = getCurrentUsername();
  if (!me) return { success: false, error: "auth" };
  resolveTreasuryBoostVote(clubId);
  let result: TreasuryVoteResult | null = null;
  let clubForAnnounce: Club | null = null;
  const patched = patchClub(clubId, (club) => {
    const treasury = getClubTreasury(club);
    const vote = treasury.boostVote;
    if (!vote || Date.now() >= vote.endsAt) return club;
    if (club.createdBy !== me) return club;
    result = finalizeBoostVote(club, treasury);
    clubForAnnounce = { ...club, treasury: { ...treasury } };
    return clubForAnnounce;
  });
  if (!result) {
    if (!patched) return { success: false, error: "notFound" };
    if (patched.createdBy !== me) return { success: false, error: "notOwner" };
    return { success: false, error: "noVote" };
  }
  if (clubForAnnounce) announceTreasuryVoteResult(clubForAnnounce, result, true);
  return { success: true, passed: result.passed };
}

export function formatMsLeft(ms: number): string {
  const days = Math.floor(ms / 86400000);
  if (days >= 1) {
    const h = Math.floor((ms % 86400000) / 3600000);
    return h > 0 ? `${days}д ${h}ч` : `${days}д`;
  }
  const h = Math.floor(ms / 3600000);
  const m = Math.ceil((ms % 3600000) / 60000);
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}

export function getMyClubTreasuryBonus(): ClubTreasuryBattleBonuses {
  return getPlayerTreasuryBattleBonuses(getCurrentProfile(), getMyClub());
}
