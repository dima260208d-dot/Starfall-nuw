/**
 * Игровой контекст для ответов Астрала в чате клуба / команды.
 */
import type { Club } from "../utils/clubs";
import { getClub } from "../utils/clubs";
import { getCurrentProfile, getAllProfiles } from "../utils/localStorageAPI";
import {
  fundTreasurePoints,
  getClubTreasury,
  getClubTreasuryBattleBonuses,
  getMemberShare,
  getTreasuryProfileState,
  TREASURY_FUND_CAP_COINS,
} from "../utils/clubTreasury";
import { getMyPartyRoom } from "../utils/social/party";
import { normalizePlayerIdQuery } from "../utils/playerId";
import type { AstralChatChannel } from "./astralChatMention";
import type { ChatReply } from "./AstralAssistant";

export interface ClubChatSnapshot {
  clubName: string;
  memberCount: number;
  treasuryCoins: number;
  treasuryGems: number;
  treasuryPowerPoints: number;
  fundPoints: number;
  fundCap: number;
  battleHpPct: number;
  battleSpeedPct: number;
  battleDamagePct: number;
  senderShareCoins: number;
  senderShareGems: number;
  senderSharePowerPoints: number;
  senderContributionPct: number;
  personalCoins: number;
  personalGems: number;
  personalPowerPoints: number;
  boostActive: boolean;
  voteActive: boolean;
  voteYesCount: number;
}

export interface AstralGameChatContext {
  channel: AstralChatChannel;
  systemBlock: string;
  clubSnapshot?: ClubChatSnapshot;
}

function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

export function buildClubChatSnapshot(club: Club, senderUsername: string): ClubChatSnapshot {
  const treasury = getClubTreasury(club);
  const share = getMemberShare(treasury, senderUsername);
  const bonuses = getClubTreasuryBattleBonuses(club);
  const profile = getCurrentProfile();
  const senderProf = getAllProfiles()[senderUsername];
  const senderState = senderProf ? getTreasuryProfileState(senderProf) : null;
  const vote = treasury.boostVote;
  const voteActive = !!(vote && Date.now() < vote.endsAt);

  return {
    clubName: club.name,
    memberCount: club.members.length,
    treasuryCoins: treasury.coins,
    treasuryGems: treasury.gems,
    treasuryPowerPoints: treasury.powerPoints,
    fundPoints: fundTreasurePoints(treasury),
    fundCap: TREASURY_FUND_CAP_COINS,
    battleHpPct: bonuses.hpPct,
    battleSpeedPct: bonuses.speedPct,
    battleDamagePct: bonuses.damagePct,
    senderShareCoins: share.coins,
    senderShareGems: share.gems,
    senderSharePowerPoints: share.powerPoints,
    senderContributionPct: senderState?.contributionPct ?? 0,
    personalCoins: profile?.coins ?? 0,
    personalGems: profile?.gems ?? 0,
    personalPowerPoints: profile?.powerPoints ?? 0,
    boostActive: !!(treasury.boostActiveUntil && Date.now() < treasury.boostActiveUntil),
    voteActive,
    voteYesCount: voteActive ? vote!.yes.length : 0,
  };
}

export function buildClubChatContext(clubId: string, senderUsername: string): AstralGameChatContext | null {
  const club = getClub(clubId);
  if (!club) return null;
  const snap = buildClubChatSnapshot(club, senderUsername);

  const lines = [
    "===== КОНТЕКСТ ЧАТА: КЛУБ =====",
    `Ты отвечаешь в чате клуба «${snap.clubName}» (${snap.memberCount} участников).`,
    "",
    "СОКРОВИЩНИЦА КЛУБА — общий фонд всех участников (НЕ личный кошелёк):",
    `  • Монеты фонда: ${fmt(snap.treasuryCoins)}`,
    `  • Кристаллы фонда: ${fmt(snap.treasuryGems)}`,
    `  • Очки силы фонда: ${fmt(snap.treasuryPowerPoints)}`,
    `  • Прогресс фонда: ${fmt(snap.fundPoints)} / ${fmt(snap.fundCap)} очков`,
    "",
    "Бонусы в бою от наполненности сокровищницы:",
    `  • HP (от монет фонда): +${snap.battleHpPct.toFixed(1)}%`,
    `  • Скорость (от гемов фонда): +${snap.battleSpeedPct.toFixed(1)}%`,
    `  • Урон (от очков силы фонда): +${snap.battleDamagePct.toFixed(1)}%`,
    "",
    `Вклад ${senderUsername} во фонд: ${fmt(snap.senderShareCoins)} монет, ${fmt(snap.senderShareGems)} гемов, ${fmt(snap.senderSharePowerPoints)} очков силы`,
    `Процент отчислений ${senderUsername} в сокровищницу: ${snap.senderContributionPct}%`,
  ];

  if (snap.boostActive) lines.push("⚡ Сейчас активно ускорение ×2 бонусов сокровищницы (24 ч).");
  if (snap.voteActive) lines.push(`📊 Идёт голосование за ускорение ×2: ${snap.voteYesCount} голосов «за».`);

  lines.push(
    "",
    "ЛИЧНЫЙ КОШЕЛЁК ИГРОКА (отдельно от фонда клуба):",
    `  • ${fmt(snap.personalCoins)} монет, ${fmt(snap.personalGems)} гемов, ${fmt(snap.personalPowerPoints)} очков силы`,
    "",
    "ПРАВИЛА ОТВЕТА:",
    "• «Фонд клуба», «сокровищница», «монеты клуба», «сколько в клубе» → числа из СОКРОВИЩНИЦЫ КЛУБА.",
    "• «Мои монеты», «у меня», «личный баланс» → ЛИЧНЫЙ КОШЕЛЁК.",
    "• Никогда не подменяй фонд клуба личными монетами игрока.",
  );

  return {
    channel: "club",
    systemBlock: lines.join("\n"),
    clubSnapshot: snap,
  };
}

export function buildPartyChatContext(senderUsername: string): AstralGameChatContext | null {
  const room = getMyPartyRoom();
  const profile = getCurrentProfile();
  if (!room) return null;

  const roster = room.members.map(m => `${m.username} (${m.brawlerId})`).join(", ");
  const leader = room.members.find(m => normalizePlayerIdQuery(m.playerId) === normalizePlayerIdQuery(room.leaderPlayerId));

  const lines = [
    "===== КОНТЕКСТ ЧАТА: КОМАНДА =====",
    `Ты отвечаешь в чате команды (код ${room.code}).`,
    `Лидер: ${leader?.username ?? "?"}. Состав: ${roster || "только лидер"}.`,
    "",
    "Здесь НЕТ фонда клуба и сокровищницы — только командный чат перед/после боя.",
  ];

  if (profile) {
    lines.push(
      "",
      `Личный кошелёк ${senderUsername}:`,
      `  • ${fmt(profile.coins)} монет, ${fmt(profile.gems)} гемов, ${fmt(profile.powerPoints)} очков силы`,
    );
  }

  if (room.brawlerSuggestion) {
    lines.push(`💡 Активно предложение сменить бойца: ${room.brawlerSuggestion.toUsername} → ${room.brawlerSuggestion.brawlerId}`);
  }

  return {
    channel: "party",
    systemBlock: lines.join("\n"),
  };
}

function isClubFundQuestion(m: string): boolean {
  const aboutClub = /(фонд|сокровищ|клубн|в\s+клубе|клуба|treasury|vault)/i.test(m);
  const aboutResources = /(монет|кристалл|гем|очк|сил|ресурс|сколько|состояни|баланс)/i.test(m);
  return aboutClub && aboutResources;
}

function isPersonalWalletQuestion(m: string): boolean {
  return /(мо[ихйе]|у\s+меня|личн|мой\s+кош|мои\s+монет|моих\s+монет)/i.test(m);
}

/** Rule-based ответ по данным клуба — без путаницы фонда и личного кошелька. */
export function tryClubChatRuleReply(message: string, snap: ClubChatSnapshot): ChatReply | null {
  const m = message.toLowerCase();

  if (isPersonalWalletQuestion(m) && !isClubFundQuestion(m)) {
    return {
      text: [
        `💰 Личный кошелёк: ${fmt(snap.personalCoins)} монет, ${fmt(snap.personalGems)} гемов, ${fmt(snap.personalPowerPoints)} очков силы.`,
        `(Это не фонд клуба — фонд: ${fmt(snap.treasuryCoins)} монет.)`,
      ].join("\n"),
    };
  }

  if (isClubFundQuestion(m) || /(фонд|сокровищ)/i.test(m)) {
    if (/(монет|coins)/i.test(m) || (/сколько/i.test(m) && !/(гем|кристалл|очк|сил)/i.test(m))) {
      return {
        text: [
          `🏛️ Фонд клуба «${snap.clubName}»: ${fmt(snap.treasuryCoins)} монет в сокровищнице.`,
          `Твой вклад во фонд: ${fmt(snap.senderShareCoins)} монет (${snap.senderContributionPct}% отчислений).`,
          `Бонус HP в бою от монет фонда: +${snap.battleHpPct.toFixed(1)}%.`,
        ].join("\n"),
      };
    }
    if (/(гем|кристалл|gems)/i.test(m)) {
      return {
        text: `💎 В сокровищнице клуба «${snap.clubName}»: ${fmt(snap.treasuryGems)} кристаллов. Бонус скорости: +${snap.battleSpeedPct.toFixed(1)}%.`,
      };
    }
    if (/(очк|сил|power)/i.test(m)) {
      return {
        text: `⚡ В сокровищнице клуба «${snap.clubName}»: ${fmt(snap.treasuryPowerPoints)} очков силы. Бонус урона: +${snap.battleDamagePct.toFixed(1)}%.`,
      };
    }
    return {
      text: [
        `🏛️ Сокровiщница клуба «${snap.clubName}»:`,
        `🪙 ${fmt(snap.treasuryCoins)} монет · 💎 ${fmt(snap.treasuryGems)} гемов · ⚡ ${fmt(snap.treasuryPowerPoints)} очков силы`,
        `Прогресс фонда: ${fmt(snap.fundPoints)} / ${fmt(snap.fundCap)} очков`,
        `Бонусы в бою: HP +${snap.battleHpPct.toFixed(1)}%, скорость +${snap.battleSpeedPct.toFixed(1)}%, урон +${snap.battleDamagePct.toFixed(1)}%`,
      ].join("\n"),
    };
  }

  if (/(бонус|hp|скорост|урон).*(бою|сокровищ|фонд|клуб)/i.test(m) || /(сокровищ|фонд).*(бонус|hp)/i.test(m)) {
    return {
      text: `⚔️ Бонусы от сокровищницы «${snap.clubName}»: HP +${snap.battleHpPct.toFixed(1)}%, скорость +${snap.battleSpeedPct.toFixed(1)}%, урон +${snap.battleDamagePct.toFixed(1)}%.`,
    };
  }

  return null;
}

export function buildAstralGameChatContext(
  channel: AstralChatChannel,
  senderUsername: string,
  clubId?: string,
): AstralGameChatContext | null {
  if (channel === "club" && clubId) return buildClubChatContext(clubId, senderUsername);
  if (channel === "party") return buildPartyChatContext(senderUsername);
  return null;
}
