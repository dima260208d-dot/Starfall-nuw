import { useState, useEffect, useRef, useCallback, forwardRef, memo, type CSSProperties, type Ref, type ReactNode } from "react";
import {
  getCurrentProfile, clashPassXpForLevel, MAX_CLASHPASS_LEVEL,
  canClaimDailyLadder, getOrRollDailyQuests, getQuestPool,
  getUnclaimedTrophyRoadCount, getUnclaimedClashPassCount, getUnopenedChestCount,
  getClaimableQuestCount, getActiveQuestCount,
  collectAutoClaimableQuests,
  getBrawlerTrophies, getBrawlerStarsCount,
  getPendingBrawlerStarPicks,
  getUnclaimedBrawlerMasteryCount,
  type UserProfile,
} from "../utils/localStorageAPI";
import { warmUiImages, watchUiScreenRecovery } from "../utils/uiImageRetry";
import { getUiAssetBaseUrl, resolvePublicAssetUrl } from "../lib/assetBase";
import DailyWinsStrip from "../components/DailyWinsStrip";
import RewardDropQueue from "../components/RewardDropQueue";
import type { RewardInfo } from "../components/RewardDropModal";
import { BRAWLERS, getBrawlerById } from "../entities/BrawlerData";
import { getProfileIconImage } from "../utils/profileIconUtils";
import { resolveUsernameStyle, resolveUsernameAccent } from "../utils/usernameDisplay";
import { ensureDevPowerUpToken, isStarGuardianActive } from "../utils/subscription";
import { CoinIcon, GemIcon, PowerIcon, TrophyIcon } from "../components/GameIcons";
import TrophyRoadMenuButton from "../components/TrophyRoadMenuButton";
import {
  RANKED_LEAGUES,
  getProfileRankedCups,
  getProfileRankedPeakCups,
  rankedLeagueIconUrl,
  rankedStandingFromTotalCups,
} from "../utils/rankedProgress";
import TrophyFlyBurst from "../components/TrophyFlyBurst";
import PassXpFlyBurst from "../components/PassXpFlyBurst";
import MasteryXpFlyBurst from "../components/MasteryXpFlyBurst";
import RankedCupFlyBurst from "../components/RankedCupFlyBurst";
import ProPassTokenFlyBurst from "../components/ProPassTokenFlyBurst";
import { consumeMenuDailyWinsFx } from "../utils/dailyWinsMenuFx";
import { consumeMenuTrophyFx, type PendingMenuTrophyFx } from "../utils/trophyMenuFx";
import { gameMusic } from "../audio/gameMusicService";
import { playResourceBounceSfx } from "../audio/gameSfxService";
import { warmBrawlerVoices } from "../audio/voiceLineService";
import { consumeMenuPassXpFx, type PendingMenuPassXpFx } from "../utils/passMenuFx";
import { consumeMenuMasteryXpFx, type PendingMenuMasteryXpFx } from "../utils/masteryMenuFx";
import { consumeMenuRankedCupFx, type PendingMenuRankedCupFx } from "../utils/rankedCupMenuFx";
import { consumeMenuProPassTokenFx, type PendingMenuProPassTokenFx } from "../utils/proPassTokenMenuFx";
import { getTrophyRoadSegment } from "../utils/trophyRoadProgress";
import { getModeInfo, type ModeInfo } from "../data/modes";
import NotificationBadge, { cornerBadgeStyle, type NotifyCorner } from "../components/ui/NotificationBadge";
import VolProgressTrack from "../components/ui/VolProgressTrack";
import ModeIconImg from "../components/ModeIconImg";
import ModeInfoModal from "../components/ModeInfoModal";
import DailyRewardModal from "../components/DailyRewardModal";
import QuestsModal from "../components/QuestsModal";
import BrawlerRankBar from "../components/BrawlerRankBar";
import RankedLeagueBar from "../components/RankedLeagueBar";
import { getUnclaimedProStarPassCount } from "../utils/proStarPass";
import { MENU_RANK_BADGE_SCALE } from "../utils/brawlerRankUI";
import BrawlerViewer3D from "../components/BrawlerViewer3D";
import { usePlatformLayout } from "../platform/usePlatformLayout";
import PetSvg from "../components/PetSvg";
import { getPetById } from "../entities/PetData";
import { getProfileByPlayerId } from "../utils/playerGiftSend";
import HamburgerDrawer from "../components/HamburgerDrawer";
import { isAdminUnlocked } from "../utils/mapEditorAPI";
import {
  getTechBreakBattleBlockNotice,
  isBattleEntryBlockedByTechBreak,
  subscribeTechBreakChanges,
} from "../utils/techBreak";
import { ADMIN_SCHEDULE_CHANGED } from "../utils/adminScheduler";
import {
  hasAnyUnseenMap,
  MAP_SEEN_CHANGED_EVENT,
} from "../utils/mapSchedule";
import GiftClaimModal from "../components/GiftClaimModal";
import { getPendingGifts } from "../utils/gifts";
import { getUnreadClubChatCount, CLUB_CHAT_CHANGED_EVENT } from "../utils/clubs";
import { getUnreadNewsCount } from "../utils/news";
import { getUnreadInboxCount } from "../utils/messages";
import { getIncomingFriendRequests, FRIENDS_CHANGED_EVENT } from "../utils/social/friends";
import { getStarFeatMenuBadge } from "../utils/starFeatProgress";
import { syncStarFeatPeaks } from "../utils/localStorageAPI";
import { getCurrentUsername } from "../utils/localStorageAPI";
import StarGuardianBadge from "../components/StarGuardianBadge";
import { useI18n, localizedModeInfo, brawlerName } from "../i18n";
import WinStreakFlame from "../components/WinStreakFlame";
import { getBrawlerWinStreak, isWinStreakVisible } from "../utils/winStreak";
import AstralFloatingIcon from "../components/AstralFloatingIcon";
import CharFeatureIconButton from "../components/CharFeatureIconButton";
import { UI_BUTTON_ICONS } from "../data/uiButtonIcons";
import {
  menuBrawler3DSize,
} from "../utils/menuBrawler3DLayout";
import AstralMenuPopup from "../components/AstralMenuPopup";
import { isFeatureUnlocked, isModeUnlockedByTrophies, getTrophyRequirementForMode } from "../utils/progression/trophyUnlocks";
import { guardTrophyFeature, guardTrophyThreshold } from "../utils/progression/trophyGuard";
import TrophyLockIcon from "../components/progression/TrophyLockIcon";
import type { TrophyFeatureId } from "../utils/progression/trophyUnlocks";
import { isAnyDealsGiftAvailable, isShopDealsNew } from "../utils/shopDailyGifts";
import {
  canClaimNewcomerGift,
  ensureNewcomerGiftPreview,
  isNewcomerGiftsActive,
} from "../utils/newcomerGifts";
import NewcomerGiftsModal from "../components/NewcomerGiftsModal";
import { bumpDealsPreviewIfNeeded } from "../utils/dailyDealsSeen";
import { getBossRaidCurrentLevel } from "../utils/bossRaidProgress";
import BossRaidPendingRewardsGate from "../components/BossRaidPendingRewardsGate";
import StarGuardianMainDailyGate from "../components/StarGuardianMainDailyGate";
import GlowingStar from "../components/GlowingStar";
import PartySidePanel from "../components/menu/PartySidePanel";
import PartyChatPanel from "../components/menu/PartyChatPanel";
import { getPartyChatUnreadCount, PARTY_CHAT_READ_EVENT } from "../utils/social/partyChat";
import PartyInviteModal from "../components/menu/PartyInviteModal";
import PartyJoinRequestModal from "../components/menu/PartyJoinRequestModal";
import TeamBar from "../components/menu/TeamBar";
import TeammateActionMenu from "../components/menu/TeammateActionMenu";
import PartyBrawlerPickerModal from "../components/menu/PartyBrawlerPickerModal";
import PartyBrawlerSuggestBubble from "../components/menu/PartyBrawlerSuggestBubble";
import PartyBrawlerSuggestAcceptModal from "../components/menu/PartyBrawlerSuggestAcceptModal";
import PartyModeSuggestBubble from "../components/menu/PartyModeSuggestBubble";
import PartyModeSuggestAcceptModal from "../components/menu/PartyModeSuggestAcceptModal";
import PartySpeechBubble from "../components/menu/PartySpeechBubble";
import {
  PARTY_CHANGED_EVENT,
  PARTY_INVITE_DECLINED_EVENT,
  PARTY_JOIN_REQUEST_EVENT,
  amPartyLeader,
  acceptPartyBrawlerSuggestion,
  acceptPartyModeSuggestion,
  cancelOutgoingInviteForTarget,
  clearPartyBrawlerSuggestionIfRecipientChangedBrawler,
  declinePartyBrawlerSuggestion,
  declinePartyModeSuggestion,
  getPartyBrawlerSuggestion,
  getPartyModeSuggestion,
  getLatestPartySpeechForPlayer,
  getOutgoingInviteForSide,
  getOutgoingInvites,
  getMyPartyCode,
  getTeammatesForMenu,
  getPartyMemberCount,
  getMaxPartySizeForMenu,
  getPartyPlayReadyState,
  isPartyMemberPlayReady,
  isPartyPlayReadyActive,
  amIPartyPlayReady,
  allPartyMembersPlayReady,
  pressPartyPlayReady,
  cancelMyPartyPlayReady,
  clearPartyPlayReady,
  tickPartyPlayReadyExpired,
  getMyPartyRoom,
  kickPartyMember,
  maybeOfferTestBotModeSuggest,
  sendPartyBrawlerSuggestion,
  hasOfflinePartyMember,
  isPartyMemberOnline,
  isPartyLeaderPlayerId,
  getPendingJoinRequestForLeader,
  checkMyPartyRankedLeague,
  type PartySlot,
} from "../utils/social/party";
import { broadcastPartyMenuVoice } from "../audio/partyVoice";
import {
  canInviteToParty,
  canPlayWithParty,
  memberSlotsForMaxParty,
  partyModeFromProfile,
} from "../utils/social/partyConfig";
import { formatRankedPartyLeagueError } from "../utils/rankedPartyLeague";
import {
  isLeftPartySlot,
  teammatesOnLeftLine,
  teammatesOnRightLine,
  partyStatsStaggerOffset,
} from "../utils/social/partyMenuFormation";
import { setMyPresence, PRESENCE_CHANGED_EVENT } from "../utils/social/presence";
import {
  getMenuActivityLabelForPlayerId,
  setMyMenuActivity,
} from "../utils/social/presence";
import { purgeTestFriendsFromCurrentUser } from "../utils/social/seedTestFriends";
import type { PartyTeammateView, OutgoingPartyInvite, PartyBrawlerSuggestion, PartyChatMessage, PartyModeSuggestion } from "../utils/social/party";
import { canPartyObserveBattle, getPartySpectateTarget } from "../utils/social/partySpectate";
import { normalizePlayerIdQuery } from "../utils/playerId";
import { EmojiIcon } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";

function menuBottomInset(compact: boolean): number {
  return compact ? 4 : 10;
}

function menuBottomBtnH(compact: boolean): number {
  return compact ? 40 : 68;
}

function menuTopInset(compact: boolean): number {
  return compact ? 6 : 10;
}

function menuSideTop(compact: boolean): number {
  return compact ? 68 : 74;
}

function menuSideBottom(compact: boolean): number {
  return compact ? 90 : 102;
}

/** Vertical gap between side nav buttons (+5% vs prior 4/6). */
function menuSideButtonGap(compact: boolean): number {
  return compact ? 8 : 10;
}

function menuTrailsRowBottom(compact: boolean): number {
  return menuSideBottom(compact) - (compact ? 18 : 22);
}

function playButtonLabel(raw: string): string {
  return raw.replace(/^▶\s*/, "");
}

const MODE_MENU_ICON_SHRINK = new Set(["starstrike", "showdown", "megashowdown"]);

function menuModeIconSize(modeId: string, compact: boolean): number {
  const base = compact ? 80 : 112;
  return MODE_MENU_ICON_SHRINK.has(modeId) ? Math.round(base * 0.9) : base;
}

interface MainMenuProps {
  onPlay: () => void;
  /** Выбранный в ленте босс: над «Играть» показываем имя и уровень вызова */
  lobbyBossRaidBossId?: string | null;
  onCollection: () => void;
  onShop: () => void;
  onCustomization: () => void;
  onSettings: () => void;
  onProfile: () => void;
  onBattleFeed: () => void;
  onClashPass: () => void;
  onTrophyRoad: () => void;
  onRanked: () => void;
  onProStarPass: () => void;
  onChests: () => void;
  onPets: () => void;
  onStarFeats: () => void;
  onModeSelect: () => void;
  onBrawlerSelect: () => void;
  onMastery: (brawlerId: string) => void;
  onOpenRankRewards: (brawlerId: string) => void;
  onComic: (brawlerId: string) => void;
  onTrails: (brawlerId: string) => void;
  onLogout: () => void;
  onRegister?: () => void;
  onAccounts?: () => void;
  onMapEditor: () => void;
  onPlayerMapEditor?: () => void;
  onNews: () => void;
  onMessages: () => void;
  onClubs: () => void;
  onFriends: () => void;
  onBattleHistory?: () => void;
  onRecords?: () => void;
  onViewPlayerProfile: (playerId: string) => void;
  onStarGuardianRewards: () => void;
  onSpectate: (playerId: string) => void;
}

function menuProfileSignature(profile: UserProfile | null): string {
  if (!profile) return "";
  try {
    const pr = profile.socialPresence;
    const stablePresence = pr
      ? { screen: pr.screen, menuActivity: (pr as { menuActivity?: string | null }).menuActivity ?? null }
      : null;
    return JSON.stringify({ ...profile, socialPresence: stablePresence });
  } catch {
    return "";
  }
}

/** Сигнатура состава команды — меняется только при смене слотов/бойцов, не при активности. */
function partyMenuLayoutSignature(): string {
  const room = getMyPartyRoom();
  if (!room) return "";
  const invites = getOutgoingInvites();
  const inviteSig = invites
    .map(i => `${i.side}:${normalizePlayerIdQuery(i.targetPlayerId)}`)
    .sort()
    .join(",");
  const ready = getPartyPlayReadyState();
  const memberSig = [...room.members]
    .sort((a, b) => a.playerId.localeCompare(b.playerId))
    .map(m => `${normalizePlayerIdQuery(m.playerId)}:${m.brawlerId}:${m.slot}`)
    .join("|");
  return [
    room.code,
    normalizePlayerIdQuery(room.leaderPlayerId),
    memberSig,
    inviteSig,
    ready?.deadlineAt ?? 0,
  ].join(";");
}

/** Стабильный 3D-превью в командном меню — не пересоздаёт WebGL при смене плашек активности. */
const MenuPartyBrawler3D = memo(function MenuPartyBrawler3D({
  brawlerId,
  color,
  size,
  paused,
  selfCenter,
  stablePreview,
  onTap,
}: {
  brawlerId: string;
  color: string;
  size: number;
  paused?: boolean;
  selfCenter?: boolean;
  stablePreview?: boolean;
  onTap?: () => void;
}) {
  return (
    <BrawlerViewer3D
      brawlerId={brawlerId}
      color={color}
      size={size}
      paused={paused}
      pixelRatioCap={selfCenter ? 2.5 : 2}
      efficientPreview={false}
      snapBackAfterDragMs={0}
      stablePreview={stablePreview}
      onTap={onTap}
    />
  );
}, (prev, next) =>
  prev.brawlerId === next.brawlerId
  && prev.color === next.color
  && prev.size === next.size
  && prev.paused === next.paused
  && prev.selfCenter === next.selfCenter
  && prev.stablePreview === next.stablePreview
  && prev.onTap === next.onTap
);

/** Центральный герой — изолирован от partyTick / таймеров нижней панели. */
const MainMenuHeroShowcase = memo(function MainMenuHeroShowcase({
  brawlerId,
  brawlerColor,
  compact,
  rankStrip,
  onBrawlerSelect,
  guardPartyMenuAction,
}: {
  brawlerId: string;
  brawlerColor: string;
  compact: boolean;
  rankStrip?: ReactNode;
  onBrawlerSelect: () => void;
  guardPartyMenuAction: (fn: () => void) => void;
}) {
  const modelSize = menuBrawler3DSize(compact);
  const boxH = modelSize + 20;
  // Same offset as MENU_BRAWLER_TRANSFORM, but via left/top so hit-testing matches the visible model on Android.
  const offsetX = Math.round(modelSize * -0.44);
  const offsetY = Math.round(boxH * -0.14);
  return (
    <div
      style={{
        position: "relative",
        width: modelSize,
        height: boxH,
        overflow: "visible",
        pointerEvents: "none",
        flexShrink: 0,
      }}
    >
      <div
        onClick={() => guardPartyMenuAction(onBrawlerSelect)}
        style={{
          position: "absolute",
          left: offsetX,
          top: offsetY,
          width: modelSize,
          height: boxH,
          pointerEvents: "auto",
          cursor: "pointer",
          overflow: "visible",
        }}
      >
        {rankStrip && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: compact ? "translateX(calc(-50% + 42px))" : "translateX(calc(-50% + 52px))",
              marginBottom: compact ? -18 : -14,
              zIndex: 11,
              pointerEvents: "auto",
              whiteSpace: "nowrap",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {rankStrip}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(circle at 50% 60%, ${brawlerColor}55 0%, transparent 65%)`,
          }} />
          <MenuPartyBrawler3D
            brawlerId={brawlerId}
            color={brawlerColor}
            size={modelSize}
            selfCenter
            stablePreview
          />
        </div>
      </div>
    </div>
  );
}, (prev, next) =>
  prev.brawlerId === next.brawlerId
  && prev.brawlerColor === next.brawlerColor
  && prev.compact === next.compact
);

/** Питомец — уровень кнопки «Следы», −30% от прежнего размера. */
const MainMenuEquippedPet = memo(function MainMenuEquippedPet({
  petId,
  compact,
  onPets,
}: {
  petId: string;
  compact: boolean;
  onPets: () => void;
}) {
  const { t } = useI18n();
  const ep = getPetById(petId);
  const onPetsRef = useRef(onPets);
  onPetsRef.current = onPets;
  const handleTap = useCallback(() => onPetsRef.current(), []);
  const petSize = compact ? 37 : 45;

  if (!ep) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: menuTrailsRowBottom(compact),
        transform: "translateX(28px)",
        zIndex: 15,
        overflow: "visible",
        pointerEvents: "auto",
        filter: `drop-shadow(0 0 12px ${ep.color}aa)`,
      }}
      title={t("nav.pets")}
    >
      <div style={{
        transform: ep.id === "swift_rabbit"
          ? `translateY(${compact ? 3 : 4}px)`
          : undefined,
      }}>
        <PetSvg
          pet={ep}
          size={petSize}
          animated
          haloPulse
          force3D
          stablePreview
          efficientPreview={false}
          clipPadding={ep.id === "swift_rabbit" ? 1.34 : 1.25}
          onTap={handleTap}
        />
      </div>
    </div>
  );
}, (prev, next) => prev.petId === next.petId && prev.compact === next.compact);

export default function MainMenu(props: MainMenuProps) {
  const { t } = useI18n();
  const { compact, width: vw, height: vh } = usePlatformLayout();
  const {
    onPlay, lobbyBossRaidBossId = null, onCollection, onShop, onCustomization, onSettings,
    onProfile, onBattleFeed, onClashPass, onTrophyRoad, onRanked, onProStarPass, onChests, onPets, onStarFeats,
    onModeSelect, onBrawlerSelect, onMastery, onOpenRankRewards, onComic, onTrails, onLogout, onRegister, onAccounts, onMapEditor, onPlayerMapEditor, onNews,
    onMessages: openMessages, onClubs, onFriends, onViewPlayerProfile,
    onStarGuardianRewards, onBattleHistory, onRecords, onSpectate,
  } = props;
  useEffect(() => {
    bumpDealsPreviewIfNeeded();
  }, []);
  useEffect(() => {
    const b = getUiAssetBaseUrl();
    const nav = [
      "ui/nav-feed.png", "ui/nav-shop.png", "ui/nav-gifts.png", "ui/nav-character.png",
      "ui/nav-bonus.png", "ui/nav-chests.png", "ui/nav-customization.png",
      "ui/nav-collection.png", "ui/nav-pets.png", "ui/nav-feats.png",
      "ui/nav-clubs.png", "ui/nav-friends.png", "ui/drawer-messages.png",
      "ui/trophy-lock.png",
    ];
    const stop = watchUiScreenRecovery(4000);
    void warmUiImages(nav.map((p) => `${b}${p}`));
    return stop;
  }, []);
  const [hasGifts, setHasGifts] = useState(() => getPendingGifts().length > 0);
  const [unreadNews, setUnreadNews] = useState(() =>
    getUnreadNewsCount(getCurrentUsername()),
  );
  const [unreadMessages, setUnreadMessages] = useState(() => getUnreadInboxCount());
  const [unreadClub, setUnreadClub] = useState(() => getUnreadClubChatCount());
  const [incomingFriendRequests, setIncomingFriendRequests] = useState(
    () => getIncomingFriendRequests().length,
  );

  const [profile, setProfile] = useState(getCurrentProfile());
  const [notif, setNotif] = useState<string | null>(null);
  const [showDaily, setShowDaily] = useState(false);
  // Prefetch the shown brawler's voice clips so its menu/character lines play
  // instantly instead of lagging on the first CDN fetch.
  useEffect(() => {
    const id = profile?.selectedBrawlerId;
    if (id) warmBrawlerVoices(id);
  }, [profile?.selectedBrawlerId]);
  const [showNewcomerGifts, setShowNewcomerGifts] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [showModeInfo, setShowModeInfo] = useState(false);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const trophyRoadBarRef = useRef<HTMLDivElement>(null);
  const starPassBtnRef = useRef<HTMLButtonElement>(null);
  const rankedBtnRef = useRef<HTMLButtonElement>(null);
  const rankedBarRef = useRef<HTMLDivElement>(null);
  const masteryBtnRef = useRef<HTMLButtonElement>(null);
  const [menuTrophyFx, setMenuTrophyFx] = useState<PendingMenuTrophyFx | null>(null);
  const [menuPassXpFx, setMenuPassXpFx] = useState<PendingMenuPassXpFx | null>(null);
  const [menuMasteryXpFx, setMenuMasteryXpFx] = useState<PendingMenuMasteryXpFx | null>(null);
  const [menuRankedCupFx, setMenuRankedCupFx] = useState<PendingMenuRankedCupFx | null>(null);
  const [menuProPassTokenFx, setMenuProPassTokenFx] = useState<PendingMenuProPassTokenFx | null>(null);
  const [passFxPhase, setPassFxPhase] = useState<"idle" | "fly">("idle");
  const [masteryFxPhase, setMasteryFxPhase] = useState<"idle" | "fly">("idle");
  const [rankedFxPhase, setRankedFxPhase] = useState<"idle" | "pile" | "fly">("idle");
  const [proPassFxPhase, setProPassFxPhase] = useState<"idle" | "fly">("idle");
  const [hasModeMapNews, setHasModeMapNews] = useState(() => hasAnyUnseenMap());
  const profileMenuSigRef = useRef("");
  const [menuFxPhase, setMenuFxPhase] = useState<"idle" | "pile" | "fly">("idle");

  const MENU_TROPHY_PILE_SIZE = 70;
  const MENU_TROPHY_FLY_SIZE = 100;
  const MENU_PASS_XP_FLY_SIZE = 72;
  const MENU_MASTERY_XP_FLY_SIZE = 68;
  const MENU_RANKED_CUP_FLY_SIZE = 72;
  const MENU_PRO_PASS_TOKEN_FLY_SIZE = 68;

  const menuTrophyFxRef = useRef<PendingMenuTrophyFx | null>(null);
  menuTrophyFxRef.current = menuTrophyFx;

  const handleTrophyFlyArrive = useCallback((i: number) => {
    playResourceBounceSfx();
    const fx = menuTrophyFxRef.current;
    if (!fx) return;
    const t = fx.trophiesEnd - fx.count + i + 1;
    setRoadDisplayTrophies(t);
    setRoadBarFill(getTrophyRoadSegment(t).fill);
  }, []);

  const handleTrophyFlyComplete = useCallback(() => {
    setMenuFxPhase("idle");
    setMenuTrophyFx(null);
    setRoadDisplayTrophies(null);
    setRoadBarFill(undefined);
  }, []);

  const handlePassXpFlyComplete = useCallback(() => {
    setPassFxPhase("idle");
    setMenuPassXpFx(null);
    setProfile(getCurrentProfile());
  }, []);

  const handleMasteryXpFlyComplete = useCallback(() => {
    setMasteryFxPhase("idle");
    setMenuMasteryXpFx(null);
    setProfile(getCurrentProfile());
  }, []);

  const menuRankedCupFxRef = useRef<PendingMenuRankedCupFx | null>(null);
  menuRankedCupFxRef.current = menuRankedCupFx;

  const handleRankedCupFlyArrive = useCallback((i: number) => {
    playResourceBounceSfx();
    const fx = menuRankedCupFxRef.current;
    if (!fx) return;
    setRankedDisplayCups(fx.cupsEnd - fx.count + i + 1);
  }, []);

  const handlePassXpFlyArrive = useCallback(() => {
    playResourceBounceSfx();
  }, []);

  const handleMasteryXpFlyArrive = useCallback(() => {
    playResourceBounceSfx();
  }, []);

  const handleProPassTokenFlyArrive = useCallback(() => {
    playResourceBounceSfx();
  }, []);

  const resourceFxActive =
    menuFxPhase !== "idle" ||
    passFxPhase === "fly" ||
    masteryFxPhase === "fly" ||
    rankedFxPhase !== "idle" ||
    proPassFxPhase === "fly";

  useEffect(() => {
    if (resourceFxActive) gameMusic.duckMenu();
    else gameMusic.restoreMenu();
  }, [resourceFxActive]);

  const handleRankedCupFlyComplete = useCallback(() => {
    setRankedFxPhase("idle");
    setMenuRankedCupFx(null);
    setRankedDisplayCups(null);
    setProfile(getCurrentProfile());
  }, []);

  const handleProPassTokenFlyComplete = useCallback(() => {
    setProPassFxPhase("idle");
    setMenuProPassTokenFx(null);
    setProfile(getCurrentProfile());
  }, []);

  const [dailyWinsReward, setDailyWinsReward] = useState<RewardInfo | null>(null);
  const [questRewardQueue, setQuestRewardQueue] = useState<RewardInfo[] | null>(null);
  const menuWebGLPaused =
    !!dailyWinsReward
    || !!(questRewardQueue?.length);
  const [sgDailyPaused, setSgDailyPaused] = useState(true);
  const [roadDisplayTrophies, setRoadDisplayTrophies] = useState<number | null>(null);
  const [roadBarFill, setRoadBarFill] = useState<number | undefined>(undefined);
  const [rankedDisplayCups, setRankedDisplayCups] = useState<number | null>(null);
  const [showHamburger, setShowHamburger] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== "undefined" && !!document.fullscreenElement,
  );
  const [pseudoFullscreen, setPseudoFullscreen] = useState<boolean>(false);
  const resourcePillHudStyle: CSSProperties = {
    fontSize: compact ? 11 : 14,
    minHeight: compact ? 28 : 32,
    minWidth: compact ? 71 : 83,
    justifyContent: "center",
  };
  const artBase = (import.meta as any).env?.BASE_URL ?? "/";
  const [partyPanel, setPartyPanel] = useState<PartySlot | null>(null);
  const [showPartyChat, setShowPartyChat] = useState(false);
  const [partyChatBadgeTick, setPartyChatBadgeTick] = useState(0);
  const [partyActivityTick, setPartyActivityTick] = useState(0);
  const [partyReadyTick, setPartyReadyTick] = useState(0);
  const [partyTick, setPartyTick] = useState(0);
  const partyRefresh = () => setPartyTick(t => t + 1);
  const partyLaunchPendingRef = useRef(false);
  const partyLayoutSigRef = useRef("");
  const [teammateMenu, setTeammateMenu] = useState<{
    mate: PartyTeammateView;
    anchor: DOMRect;
    side: "left" | "right";
  } | null>(null);
  const [brawlerPickTarget, setBrawlerPickTarget] = useState<PartyTeammateView | null>(null);
  const [showSuggestAccept, setShowSuggestAccept] = useState(false);
  const [showModeSuggestLeader, setShowModeSuggestLeader] = useState(false);
  const prevSelectedBrawlerRef = useRef<string | null>(null);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  // True when the page is allowed to use the real Fullscreen API. Inside
  // sandboxed iframes (e.g. the Replit canvas preview) this is false, so we
  // fall back to a CSS-only "pseudo fullscreen" that fills the embed instead
  // of crashing.
  const canUseRealFullscreen =
    typeof document !== "undefined" &&
    (document.fullscreenEnabled ?? false) &&
    typeof document.documentElement?.requestFullscreen === "function";

  const toggleFullscreen = async () => {
    if (!canUseRealFullscreen) {
      setPseudoFullscreen((v) => !v);
      return;
    }
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        // Orientation lock only works while truly fullscreen, and only on
        // mobile. Desktop/iframe contexts reject silently.
        const so = (screen as any).orientation;
        if (so && typeof so.lock === "function") {
          try { await so.lock("landscape"); } catch { /* unsupported */ }
        }
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Permission denied or sandboxed — degrade to pseudo fullscreen.
      setPseudoFullscreen((v) => !v);
    }
  };

  useEffect(() => {
    profileMenuSigRef.current = menuProfileSignature(getCurrentProfile());
    void import("../utils/cloud/friendServerSync").then((m) => m.syncFriendsFromServer());

    const interval = setInterval(() => {
      const nextProfile = getCurrentProfile();
      const sig = menuProfileSignature(nextProfile);
      if (sig !== profileMenuSigRef.current) {
        profileMenuSigRef.current = sig;
        setProfile(nextProfile);
      }

      setUnreadMessages(prev => {
        const next = getUnreadInboxCount();
        return next === prev ? prev : next;
      });
      setUnreadNews(prev => {
        const next = getUnreadNewsCount(getCurrentUsername());
        return next === prev ? prev : next;
      });
      setHasGifts(prev => {
        const next = getPendingGifts().length > 0;
        return next === prev ? prev : next;
      });
      setUnreadClub(prev => {
        const next = getUnreadClubChatCount();
        return next === prev ? prev : next;
      });
      setIncomingFriendRequests(prev => {
        const next = getIncomingFriendRequests().length;
        return next === prev ? prev : next;
      });
      setHasModeMapNews(prev => {
        const next = hasAnyUnseenMap();
        return prev === next ? prev : next;
      });
    }, 500);
    const onClubChat = () => {
      setUnreadClub(getUnreadClubChatCount());
    };
    const onFriendsChanged = () => {
      setIncomingFriendRequests(getIncomingFriendRequests().length);
    };
    window.addEventListener(CLUB_CHAT_CHANGED_EVENT, onClubChat);
    window.addEventListener(FRIENDS_CHANGED_EVENT, onFriendsChanged);
    return () => {
      clearInterval(interval);
      window.removeEventListener(CLUB_CHAT_CHANGED_EVENT, onClubChat);
      window.removeEventListener(FRIENDS_CHANGED_EVENT, onFriendsChanged);
    };
  }, []);

  useEffect(() => {
    const onMapSeen = () => setHasModeMapNews(hasAnyUnseenMap());
    window.addEventListener(MAP_SEEN_CHANGED_EVENT, onMapSeen);
    return () => window.removeEventListener(MAP_SEEN_CHANGED_EVENT, onMapSeen);
  }, []);

  // Ensure today's quests are rolled the first time the lobby opens each day.
  useEffect(() => { getOrRollDailyQuests(); }, []);

  useEffect(() => {
    const rewards = collectAutoClaimableQuests();
    if (rewards.length > 0) {
      setQuestRewardQueue(rewards);
      setProfile(getCurrentProfile());
    }
  }, []);

  useEffect(() => {
    ensureNewcomerGiftPreview();
    ensureDevPowerUpToken();
    setProfile(getCurrentProfile());
  }, []);

  useEffect(() => {
    const dw = consumeMenuDailyWinsFx();
    if (dw) setDailyWinsReward(dw);
    else setSgDailyPaused(false);

    const pendingTrophy = consumeMenuTrophyFx();
    if (pendingTrophy) {
      const start = pendingTrophy.trophiesEnd - pendingTrophy.count;
      setMenuTrophyFx(pendingTrophy);
      setRoadDisplayTrophies(start);
      setRoadBarFill(getTrophyRoadSegment(start).fill);
      setMenuFxPhase("pile");
      window.setTimeout(() => setMenuFxPhase("fly"), 1500);
    }

    const pendingPass = consumeMenuPassXpFx();
    if (pendingPass) {
      setMenuPassXpFx(pendingPass);
      setPassFxPhase("fly");
    }

    const pendingMastery = consumeMenuMasteryXpFx();
    if (pendingMastery) {
      setMenuMasteryXpFx(pendingMastery);
      setMasteryFxPhase("fly");
    }

    const pendingRankedCup = consumeMenuRankedCupFx();
    if (pendingRankedCup) {
      const start = pendingRankedCup.cupsEnd - pendingRankedCup.count;
      setMenuRankedCupFx(pendingRankedCup);
      setRankedDisplayCups(start);
      setRankedFxPhase("pile");
      window.setTimeout(() => setRankedFxPhase("fly"), 1500);
    }

    const pendingProPass = consumeMenuProPassTokenFx();
    if (pendingProPass) {
      setMenuProPassTokenFx(pendingProPass);
      setProPassFxPhase("fly");
    }
  }, []);

  useEffect(() => {
    setMyPresence("menu");
    purgeTestFriendsFromCurrentUser();
    partyLayoutSigRef.current = partyMenuLayoutSignature();
    const onPartySocial = () => {
      const layoutSig = partyMenuLayoutSignature();
      if (layoutSig !== partyLayoutSigRef.current) {
        partyLayoutSigRef.current = layoutSig;
        partyRefresh();
      } else if (getPartyMemberCount() >= 2) {
        setPartyActivityTick(t => t + 1);
      }
      const nextProfile = getCurrentProfile();
      const sig = menuProfileSignature(nextProfile);
      if (sig !== profileMenuSigRef.current) {
        profileMenuSigRef.current = sig;
        setProfile(nextProfile);
      }
      if (getMyPartyCode()) {
        window.setTimeout(() => maybeOfferTestBotModeSuggest(), 1400);
      }
    };
    const onRemotePresence = () => {
      if (getPartyMemberCount() >= 2) {
        setPartyActivityTick(t => t + 1);
      }
    };
    const onDeclined = (e: Event) => {
      const name = (e as CustomEvent<{ username?: string }>).detail?.username ?? t("common.player");
      setNotif(t("nav.partyDeclined", { name }));
      setTimeout(() => setNotif(null), 2800);
      partyRefresh();
    };
    window.addEventListener(PARTY_CHANGED_EVENT, onPartySocial);
    window.addEventListener(PRESENCE_CHANGED_EVENT, onRemotePresence);
    window.addEventListener(PARTY_JOIN_REQUEST_EVENT, onPartySocial);
    window.addEventListener(PARTY_INVITE_DECLINED_EVENT, onDeclined);
    const iv = setInterval(onPartySocial, 6000);
    return () => {
      window.removeEventListener(PARTY_CHANGED_EVENT, onPartySocial);
      window.removeEventListener(PRESENCE_CHANGED_EVENT, onRemotePresence);
      window.removeEventListener(PARTY_JOIN_REQUEST_EVENT, onPartySocial);
      window.removeEventListener(PARTY_INVITE_DECLINED_EVENT, onDeclined);
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    const bumpChatBadge = () => setPartyChatBadgeTick(t => t + 1);
    window.addEventListener(PARTY_CHANGED_EVENT, bumpChatBadge);
    window.addEventListener(PARTY_CHAT_READ_EVENT, bumpChatBadge);
    return () => {
      window.removeEventListener(PARTY_CHANGED_EVENT, bumpChatBadge);
      window.removeEventListener(PARTY_CHAT_READ_EVENT, bumpChatBadge);
    };
  }, []);

  useEffect(() => {
    if (getPartyMemberCount() <= 1) return;
    setMyMenuActivity(showQuests ? "quests" : null);
  }, [showQuests, partyTick]);

  useEffect(() => {
    if (getPartyMemberCount() <= 1 || !amIPartyPlayReady()) return;
    setShowQuests(false);
    setShowDaily(false);
    setShowNewcomerGifts(false);
    setShowModeInfo(false);
    setShowHamburger(false);
    setPartyPanel(null);
    setTeammateMenu(null);
    setBrawlerPickTarget(null);
    setShowSuggestAccept(false);
  }, [partyTick]);

  useEffect(() => {
    const cur = profile?.selectedBrawlerId ?? null;
    if (prevSelectedBrawlerRef.current && cur && prevSelectedBrawlerRef.current !== cur) {
      clearPartyBrawlerSuggestionIfRecipientChangedBrawler(cur);
      partyRefresh();
    }
    prevSelectedBrawlerRef.current = cur;
  }, [profile?.selectedBrawlerId]);

  const showTechBreakBlockNotice = useCallback(() => {
    const notice = getTechBreakBattleBlockNotice()
      ?? "Тех перерыв скоро — бой недоступен";
    setNotif(notice);
    window.setTimeout(() => setNotif(null), 5000);
  }, []);

  const tryStartBattle = useCallback(() => {
    if (isBattleEntryBlockedByTechBreak()) {
      showTechBreakBlockNotice();
      return false;
    }
    if (profile?.selectedMode === "ranked" && getPartyMemberCount() > 1) {
      const leagueCheck = checkMyPartyRankedLeague();
      if (!leagueCheck.ok) {
        handleSoonNotice(formatRankedPartyLeagueError(leagueCheck, t));
        return false;
      }
    }
    onPlay();
    return true;
  }, [onPlay, showTechBreakBlockNotice, profile?.selectedMode, t]);

  useEffect(() => {
    if (!profile || getPartyMemberCount() <= 1) {
      partyLaunchPendingRef.current = false;
      return;
    }
    if (!isPartyPlayReadyActive()) {
      partyLaunchPendingRef.current = false;
      return;
    }
    const iv = window.setInterval(() => {
      tickPartyPlayReadyExpired();
      setPartyReadyTick(t => t + 1);
    }, 1000);
    return () => window.clearInterval(iv);
  }, [profile, partyTick]);

  useEffect(() => {
    if (!profile || getPartyMemberCount() <= 1) return;
    const room = getMyPartyRoom();
    if (!room?.playReady || !allPartyMembersPlayReady(room)) return;
    if (partyLaunchPendingRef.current) return;
    partyLaunchPendingRef.current = true;
    clearPartyPlayReady();
    if (!tryStartBattle()) {
      partyLaunchPendingRef.current = false;
    }
  }, [profile, partyTick, tryStartBattle]);

  if (!profile) return null;

  void partyTick;
  void partyChatBadgeTick;
  void partyActivityTick;
  void partyReadyTick;
  const outgoingInviteForSlot = (slot: PartySlot) => getOutgoingInviteForSide(slot);
  const partyBrawlerSuggest = getPartyBrawlerSuggestion();
  const partyModeSuggest = getPartyModeSuggestion();
  const teammates = getTeammatesForMenu();
  const maxParty = getMaxPartySizeForMenu();
  const partyCount = getPartyMemberCount();
  const inParty = partyCount > 1;
  const partyChatUnread = inParty ? getPartyChatUnreadCount() : 0;
  const partyPlayReady = getPartyPlayReadyState();
  const partyReadyActive = inParty && partyPlayReady !== null;
  const iAmPartyReady = amIPartyPlayReady();
  const partyMenuLocked = inParty && iAmPartyReady;
  const partyMenuLockedFilter: React.CSSProperties = partyMenuLocked
    ? { filter: "grayscale(1) saturate(0.2) brightness(0.88)", transition: "filter 0.22s ease" }
    : {};
  const partyHasOffline = inParty && hasOfflinePartyMember();
  const partyReadySecondsLeft = partyPlayReady
    ? Math.max(0, Math.ceil((partyPlayReady.deadlineAt - Date.now()) / 1000))
    : 0;
  const partyObserveTarget = canPartyObserveBattle() ? getPartySpectateTarget() : null;
  const showPartyObserve = !!partyObserveTarget && !partyReadyActive;
  const handleMenuPlayClick = () => {
    if (isBattleEntryBlockedByTechBreak()) {
      showTechBreakBlockNotice();
      return;
    }
    if (!inParty) {
      broadcastPartyMenuVoice(profile.selectedBrawlerId || "hana");
      const modeReq = getTrophyRequirementForMode(profile.selectedMode);
      if (!isModeUnlockedByTrophies(profile.selectedMode, accountTrophies)) {
        guardTrophyThreshold(modeReq, accountTrophies, () => {}, t);
        return;
      }
      tryStartBattle();
      return;
    }
    if (partyHasOffline && !iAmPartyReady) {
      handleSoonNotice(t("party.offlineBlocksStart"));
      return;
    }
    if (rankedPartyBlocked) {
      handleSoonNotice(rankedPartyBlockMsg);
      return;
    }
    if (rankedPartySizeBlocked) {
      handleSoonNotice(t("ranked.party.tooManyPlayers"));
      return;
    }
    if (iAmPartyReady) {
      cancelMyPartyPlayReady();
      partyRefresh();
      return;
    }
    broadcastPartyMenuVoice(profile.selectedBrawlerId || "hana");
    setMyMenuActivity(null);
    pressPartyPlayReady();
    partyRefresh();
  };
  const guardPartyMenuAction = (action: () => void) => {
    if (partyMenuLocked) {
      handleSoonNotice(t("party.menuLockedWhileReady"));
      return;
    }
    action();
  };
  const tryTrophyFeature = (featureId: TrophyFeatureId, action: () => void) => {
    guardPartyMenuAction(() => guardTrophyFeature(featureId, action, t));
  };
  const accountTrophies = profile.trophies ?? 0;
  const unlock = {
    battleFeed: isFeatureUnlocked("battleFeed", accountTrophies),
    ranked: isFeatureUnlocked("ranked", accountTrophies),
    pets: isFeatureUnlocked("pets", accountTrophies),
    starFeats: isFeatureUnlocked("starFeats", accountTrophies),
    clubs: isFeatureUnlocked("clubs", accountTrophies),
    customization: isFeatureUnlocked("customization", accountTrophies),
    quests: isFeatureUnlocked("quests", accountTrophies),
    clashpass: isFeatureUnlocked("clashpass", accountTrophies),
    dailyWins: isFeatureUnlocked("dailyWins", accountTrophies),
  };
  const handleModeSelectClick = () => {
    if (partyMenuLocked) {
      handleSoonNotice(t("party.menuLockedWhileReady"));
      return;
    }
    onModeSelect();
  };
  const handleObserveClick = () => {
    if (partyObserveTarget) onSpectate(partyObserveTarget);
  };
  const modeSel = partyModeFromProfile(profile);
  const canInvite = canInviteToParty(partyCount, modeSel);
  const rankedPartyLeagueCheck = profile.selectedMode === "ranked" && inParty
    ? checkMyPartyRankedLeague()
    : { ok: true as const };
  const rankedPartyBlocked = !rankedPartyLeagueCheck.ok;
  const rankedPartyBlockMsg = rankedPartyBlocked
    ? formatRankedPartyLeagueError(rankedPartyLeagueCheck, t)
    : "";
  const rankedPartySizeBlocked = inParty
    && profile.selectedMode === "ranked"
    && !canPlayWithParty(partyCount, modeSel);
  const allowedSlots = memberSlotsForMaxParty(maxParty);
  const mateBySlot = new Map(teammates.map(t => [t.slot, t]));
  const emptyInviteSlots = canInvite
    ? allowedSlots.filter(s => !mateBySlot.has(s))
    : [];
  const leftLine = teammatesOnLeftLine(teammates);
  const rightLine = teammatesOnRightLine(teammates);
  const staggerPartyStats = partyCount >= 4;
  let partyStatsStaggerIdx = 0;
  const leftEmptySlots = emptyInviteSlots.filter(isLeftPartySlot);
  const rightEmptySlots = emptyInviteSlots.filter(s => !isLeftPartySlot(s));
  const myPlayerId = profile.playerId ? normalizePlayerIdQuery(profile.playerId) : "";
  const suggestForPlayer = (playerId: string) => {
    if (!partyBrawlerSuggest || !playerId) return null;
    if (normalizePlayerIdQuery(partyBrawlerSuggest.fromPlayerId) !== normalizePlayerIdQuery(playerId)) {
      return null;
    }
    return partyBrawlerSuggest;
  };
  const canAnswerPartySuggest = !!partyBrawlerSuggest
    && normalizePlayerIdQuery(partyBrawlerSuggest.toPlayerId) === myPlayerId;
  const mySpeech = inParty ? getLatestPartySpeechForPlayer(myPlayerId) : null;
  const myModeSuggest = partyModeSuggest
    && normalizePlayerIdQuery(partyModeSuggest.fromPlayerId) === myPlayerId
    ? partyModeSuggest
    : null;

  const dailyWins = profile.dailyWins!;

  const mode = localizedModeInfo(getModeInfo(profile.selectedMode));
  const rankedStanding = rankedStandingFromTotalCups(getProfileRankedCups(profile));
  const rankedLeagueDef = RANKED_LEAGUES[rankedStanding.leagueIndex];
  const showRankedLobbyLine = profile.selectedMode === "ranked" && rankedLeagueDef;
  const showRankedBars = profile.selectedMode === "ranked";
  const rankedCups = rankedDisplayCups ?? getProfileRankedCups(profile);
  const rankedPeakCups = getProfileRankedPeakCups(profile);
  const proPassBadge = getUnclaimedProStarPassCount(profile);
  const brawler = BRAWLERS.find(b => b.id === profile.selectedBrawlerId) || BRAWLERS[0];
  const masteryBadge = getUnclaimedBrawlerMasteryCount(profile, brawler.id);
  const brawlerLevel = profile.brawlerLevels[brawler.id] || 1;
  const brawlerTrophies = getBrawlerTrophies(profile, brawler.id);
  const brawlerWinStreak = getBrawlerWinStreak(profile, brawler.id);
  const brawlerStarCount = getBrawlerStarsCount(profile, brawler.id);
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const profileIconSrc = getProfileIconImage(profile.profileIconId, base);
  const usernameAccent = resolveUsernameAccent(profile.usernameColor, isStarGuardianActive());
  const usernameStyle = resolveUsernameStyle(profile.usernameColor, isStarGuardianActive());
  const passLevel = profile.clashPassLevel;
  const passNeed = clashPassXpForLevel(passLevel);
  const passPct = passLevel >= MAX_CLASHPASS_LEVEL
    ? 100
    : Math.min(100, Math.round((profile.xp / passNeed) * 100));
  const canClaimDaily = canClaimDailyLadder(profile);
  const questPool = getQuestPool();
  const claimableQuestCount = getClaimableQuestCount({ ...profile, questPool: questPool ?? profile.questPool });
  const activeQuestCount = getActiveQuestCount({ ...profile, questPool: questPool ?? profile.questPool });
  const hasUnclaimedQuest = claimableQuestCount > 0;
  const trophyRoadBadge = getUnclaimedTrophyRoadCount(profile);
  const clashPassBadge = getUnclaimedClashPassCount(profile);
  const chestsBadge = getUnopenedChestCount(profile);
  const questsBadge = claimableQuestCount;
  const newBrawlerBadge = (profile.newBrawlers || []).length;
  const pendingStarBadge = getPendingBrawlerStarPicks(profile).length;
  const collectionBadge = newBrawlerBadge + pendingStarBadge;
  const newPetBadge = (profile.newPets || []).length;
  const starFeatBadge = getStarFeatMenuBadge(profile);
  const shopGiftBadge = isAnyDealsGiftAvailable();
  const shopDealsNewTag = isShopDealsNew();
  const newcomerGiftsVisible = isNewcomerGiftsActive(profile);
  const newcomerGiftsReady = newcomerGiftsVisible && canClaimNewcomerGift(profile);

  const raidBrawler = lobbyBossRaidBossId ? getBrawlerById(lobbyBossRaidBossId) : null;
  const raidBossLevel = lobbyBossRaidBossId ? getBossRaidCurrentLevel(profile, lobbyBossRaidBossId) : null;

  const handleSoonNotice = (text: string) => {
    setNotif(text);
    setTimeout(() => setNotif(null), 1800);
  };

  useEffect(() => {
    syncStarFeatPeaks(profile);
  }, [profile?.username, profile?.trophies, profile?.unlockedBrawlers?.length, profile?.clubId, profile?.clashPassLevel]);

  useEffect(() => {
    if (isAdminUnlocked()) return;
    let hideTimer = 0;
    let visible = false;

    const tick = () => {
      const notice = getTechBreakBattleBlockNotice();
      if (!notice) {
        visible = false;
        return;
      }
      setNotif(notice);
      if (!visible) {
        visible = true;
        if (hideTimer) window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => setNotif(null), 5000);
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    const onSched = () => tick();
    const offTb = subscribeTechBreakChanges(tick);
    window.addEventListener(ADMIN_SCHEDULE_CHANGED, onSched);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(ADMIN_SCHEDULE_CHANGED, onSched);
      offTb();
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  // Cinematic "Champions' Hall" main-menu background — a real painted scene
  // depicting a vast floor the selected brawler stands on, rather than a flat gradient.
  const menuBgImage = `url("${resolvePublicAssetUrl("main-menu-bg.png")}")`;
  const menuBgStyle: React.CSSProperties = {
    backgroundImage: menuBgImage,
    backgroundSize: "cover",
    backgroundPosition: "center 68%",
    backgroundRepeat: "no-repeat",
    backgroundColor: "#0a0028",
  };

  return (
    <div
      className="main-menu-shell"
      style={{
        ...(pseudoFullscreen
          ? {
              position: "fixed",
              inset: 0,
              width: "100vw",
              height: "100vh",
              zIndex: 99999,
              ...menuBgStyle,
            }
          : {
              height: "100%",
              minHeight: "100%",
              width: "100%",
              ...menuBgStyle,
              position: "relative",
            }),
        overflow: "visible",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <style>{`
        @keyframes pulse { 0%,100% { transform: scale(1);} 50% { transform: scale(1.04);} }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes floatY { 0%,100% { transform: translateY(0);} 50% { transform: translateY(-12px);} }
        @keyframes sparkle {
          0%,100% { opacity: 0.25; transform: scale(0.8);} 50% { opacity:1; transform:scale(1.2);}
        }
        @keyframes glow {
          0%,100% { box-shadow: 0 0 30px rgba(206,147,216,0.3);}
          50% { box-shadow: 0 0 60px rgba(206,147,216,0.6);}
        }
        @keyframes bossRaidLinePulse {
          0%, 100% {
            text-shadow: 0 0 10px rgba(255,213,79,0.5), 0 0 22px rgba(213,0,249,0.35);
            filter: brightness(1);
          }
          50% {
            text-shadow: 0 0 18px rgba(255,213,79,0.85), 0 0 36px rgba(213,0,249,0.55);
            filter: brightness(1.06);
          }
        }
      `}</style>

      {/* Subtle vignette to keep focus on the centre brawler and harmonise UI panels with the painted background. */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 55%, transparent 35%, rgba(6,0,30,0.45) 100%)",
      }} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 4,
          pointerEvents: undefined,
        }}
      >
      {/* TOP BAR: слева профиль/подписка — по центру команда — справа ресурсы */}
      <div style={{
        position: "absolute",
        top: menuTopInset(compact),
        left: compact ? 8 : 16,
        right: compact ? 8 : 16,
        zIndex: 8,
        display: "flex",
        alignItems: "center",
        gap: compact ? 3.6 : 7.2,
        pointerEvents: "none",
        ...partyMenuLockedFilter,
      }}>
      <div style={{ display: "flex", gap: compact ? 5.4 : 9, alignItems: "center", flexShrink: 0, pointerEvents: "auto" }}>
        <button
          className="menu-top-bar-flat"
          onClick={() => guardPartyMenuAction(onProfile)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "6px 14px 6px 6px",
            cursor: "pointer", color: "var(--t-1)",
            ["--ui-shear-fill" as string]: "linear-gradient(160deg, rgba(15,8,42,0.78), rgba(8,4,24,0.92))",
            ["--ui-shear-border" as string]: "var(--bd-2)",
            ["--ui-shear-shadow" as string]: "none",
            ["--menu-btn-glow" as string]: "rgba(123,47,190,0.28)",
            ["--ui-shear-blur" as string]: "blur(14px) saturate(1.2)",
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10, overflow: "hidden",
            border: `1.5px solid ${usernameAccent}88`,
            flexShrink: 0,
            boxShadow: `0 0 10px ${usernameAccent}44`,
          }}>
            <img
              src={profileIconSrc}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
          {usernameStyle.kind === "shimmer" ? (
            <span
              className="subscriber-name-shimmer"
              style={{
                display: "inline-block",
                textAlign: "left",
                fontSize: 14,
                fontWeight: 800,
                lineHeight: 1.2,
                backgroundImage: usernameStyle.def.gradient,
                filter: `drop-shadow(0 0 6px ${usernameStyle.def.glow}) drop-shadow(0 1px 2px rgba(0,0,0,0.8))`,
              }}
            >
              {profile.username}
            </span>
          ) : (
            <div
              style={{
                textAlign: "left",
                fontSize: 14,
                fontWeight: 800,
                color: usernameStyle.color,
                textShadow: `0 0 12px ${usernameStyle.color}66, 0 1px 2px rgba(0,0,0,0.8)`,
                lineHeight: 1.2,
              }}
            >
              {profile.username}
            </div>
          )}
        </button>
        <SideButton
          icon="📺"
          imgSrc="ui/nav-feed.png"
          label={t("nav.feed")}
          onClick={() => tryTrophyFeature("battleFeed", onBattleFeed)}
          color="#FF7043"
          compact={compact}
          menuBar
          menuTopBarSoft
          trophyLocked={!unlock.battleFeed}
          unlockTarget="battleFeed"
        />
        <TrophyRoadMenuButton
          trophies={profile.trophies}
          badgeCount={trophyRoadBadge}
          onClick={() => guardPartyMenuAction(onTrophyRoad)}
          displayTrophies={roadDisplayTrophies ?? undefined}
          barFillOverride={roadBarFill}
          barTargetRef={trophyRoadBarRef}
        />
        <SideButton
          icon="🏅"
          imgSrc={`images/ranked-league-${rankedStanding.leagueId}.png`}
          label={t("ranked.menuShort")}
          onClick={() => tryTrophyFeature("ranked", onRanked)}
          color={rankedLeagueDef.accent}
          compact={compact}
          menuBar
          menuBarWidth={compact ? 68 : 76}
          menuBarIconSize={compact ? 64 : 72}
          menuBarIconScale={compact ? 1.3 : 1.34}
          menuBarHeight={52}
          menuBarPadding="0 4px"
          hideLabel
          menuBarIconCenter
          innerRef={rankedBtnRef}
          badge={proPassBadge > 0 ? proPassBadge : undefined}
          trophyLocked={!unlock.ranked}
          unlockTarget="ranked"
        />
        <StarGuardianBadge onClick={() => guardPartyMenuAction(onStarGuardianRewards)} compact={compact} menuBarStyle />
      </div>

      <div style={{
        flex: "1 1 0",
        minWidth: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "visible",
        pointerEvents: "auto",
        padding: compact ? "0 4px" : "0 8px",
      }}>
        {getMyPartyCode() && (
          <TeamBar compact={compact} onLeave={partyRefresh} />
        )}
      </div>

      <div className="ui-resource-bar" style={{ gap: compact ? 2.19 : 3.65, pointerEvents: "auto", flexShrink: 0, marginLeft: "auto" }}>
          <span className="ui-resource-pill ui-resource-pill--gold menu-top-bar-soft" style={resourcePillHudStyle}>
            <CoinIcon size={compact ? 22 : 26} /> {profile.coins.toLocaleString("ru-RU")}
          </span>
          <span className="ui-resource-pill ui-resource-pill--cyan menu-top-bar-soft" style={resourcePillHudStyle}>
            <GemIcon size={compact ? 22 : 26} /> {profile.gems.toLocaleString("ru-RU")}
          </span>
          <span className="ui-resource-pill ui-resource-pill--violet menu-top-bar-soft" style={resourcePillHudStyle}>
            <PowerIcon size={compact ? 22 : 26} /> {profile.powerPoints.toLocaleString("ru-RU")}
          </span>
          <div style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
            <button
              type="button"
              className="ui-resource-pill ui-hamburger-btn menu-top-bar-soft"
              onClick={() => guardPartyMenuAction(() => setShowHamburger(true))}
              title={t("nav.menu")}
              style={{
                ...resourcePillHudStyle,
                minWidth: compact ? 44 : 52,
                color: "var(--t-1)",
                fontWeight: 900,
                cursor: "pointer",
                lineHeight: 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                fontFamily: "inherit",
                ["--ui-shear-fill" as string]: "linear-gradient(160deg, rgba(15,8,42,0.78), rgba(8,4,24,0.92))",
                ["--ui-shear-border" as string]: "var(--bd-2)",
                ["--ui-shear-shadow" as string]: "var(--sh-md), inset 0 1px 0 rgba(255,255,255,0.1)",
                ["--ui-shear-blur" as string]: "blur(12px) saturate(1.2)",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: compact ? 3 : 4,
                  width: compact ? 16 : 18,
                  height: compact ? 16 : 18,
                }}
              >
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    style={{
                      display: "block",
                      height: compact ? 2 : 2.5,
                      borderRadius: 2,
                      background: "currentColor",
                    }}
                  />
                ))}
              </span>
            </button>
            <NotificationBadge count={unreadMessages + unreadNews} notifyCorner="top-right" />
          </div>
        </div>
      </div>

      {/* CENTER: лидер + до 2 напарников — по центру экрана */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        paddingBottom: compact ? "4%" : "6%",
        overflow: "visible",
        zIndex: 5,
      }}>
        <div style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          width: "100%",
          boxSizing: "border-box",
          paddingLeft: compact ? 96 : 110,
          paddingRight: compact ? 96 : 110,
          gap: compact ? 10 : 14,
          overflow: "visible",
        }}>
          <div style={{
            flex: 1,
            minWidth: 0,
            alignSelf: "stretch",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: leftLine.length <= 1 ? "flex-end" : "space-between",
            paddingRight: compact ? 4 : 6,
            overflow: "visible",
            position: "relative",
            zIndex: partyCount >= 4 ? 1 : undefined,
          }}>
            {leftLine.map((mate, i) => {
              const stagger = partyStatsStaggerOffset(partyStatsStaggerIdx++, staggerPartyStats, compact);
              return (
              <PartySlotArea
                key={mate.playerId}
                mate={mate}
                side="left"
                compact={compact}
                overlapMargin={i > 0 ? (compact ? -98 : -112) : 0}
                statsStagger={stagger}
                showReadyBadge={isPartyMemberPlayReady(mate.playerId)}
                showLeaderCrown={isPartyLeaderPlayerId(mate.playerId)}
                showOfflineOverlay={!isPartyMemberOnline(mate.playerId)}
                activityLabel={
                  partyCount >= 2 && !isPartyMemberPlayReady(mate.playerId)
                    ? getMenuActivityLabelForPlayerId(mate.playerId)
                    : null
                }
                senderSuggest={suggestForPlayer(mate.playerId)}
                canAnswerSuggest={canAnswerPartySuggest && normalizePlayerIdQuery(partyBrawlerSuggest?.toPlayerId ?? "") === normalizePlayerIdQuery(mate.playerId)}
                speechMessage={getLatestPartySpeechForPlayer(mate.playerId)}
                modeSuggest={
                  partyModeSuggest
                  && normalizePlayerIdQuery(partyModeSuggest.fromPlayerId) === normalizePlayerIdQuery(mate.playerId)
                    ? partyModeSuggest
                    : null
                }
                onModeSuggestClick={amPartyLeader() ? () => setShowModeSuggestLeader(true) : undefined}
                onSpeechClick={() => guardPartyMenuAction(() => setShowPartyChat(true))}
                onTeammateClick={(rect) => setTeammateMenu({ mate, anchor: rect, side: "left" })}
                onSuggestBubbleClick={() => setShowSuggestAccept(true)}
                showRankedBars={showRankedBars}
                rankedCups={rankedCups}
                rankedPeakCups={rankedPeakCups}
              />
            );
            })}
            {leftEmptySlots.length > 0 && (
              <div style={{
                position: "absolute",
                top: "50%",
                ...(leftLine.length > 0
                  ? { right: compact ? 6 : 10, transform: "translateY(-50%)" }
                  : {
                    left: "50%",
                    transform: compact
                      ? "translate(calc(-50% + 18px), -50%)"
                      : "translate(calc(-50% + 24px), -50%)",
                  }),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: compact ? 6 : 8,
                pointerEvents: "auto",
                zIndex: 7,
              }}>
                {leftEmptySlots.map(slot => (
                  <PartyPlusButton
                    key={slot}
                    slot={slot}
                    compact={compact}
                    embedded
                    outgoingInvite={outgoingInviteForSlot(slot)}
                    onOpenPanel={() => guardPartyMenuAction(() => setPartyPanel(slot))}
                    onCancelInvite={() => {
                      const inv = outgoingInviteForSlot(slot);
                      if (inv) cancelOutgoingInviteForTarget(inv.targetPlayerId);
                      partyRefresh();
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <div style={{ flexShrink: 0, position: "relative", pointerEvents: "none", zIndex: partyCount >= 4 ? 12 : 5 }}>
          {(() => {
            const leaderStagger = partyStatsStaggerOffset(partyStatsStaggerIdx++, staggerPartyStats, compact);
            return (
              <>
          {suggestForPlayer(myPlayerId) && (
            <div style={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginBottom: 58 + leaderStagger,
              zIndex: 8,
              pointerEvents: "auto",
            }}>
              <PartyBrawlerSuggestBubble
                suggestion={suggestForPlayer(myPlayerId)!}
                compact={compact}
                onClick={canAnswerPartySuggest ? () => setShowSuggestAccept(true) : undefined}
              />
            </div>
          )}
          {(myModeSuggest || mySpeech) && (
            <>
              {myModeSuggest && (
                <div
                  style={{
                    position: "absolute",
                    left: "100%",
                    top: "14%",
                    marginLeft: compact ? 2 : 6,
                    transform: "translateY(-50%)",
                    zIndex: 8,
                    pointerEvents: "auto",
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <PartyModeSuggestBubble suggestion={myModeSuggest} compact={compact} />
                </div>
              )}
              {mySpeech && (
                <div
                  style={{
                    position: "absolute",
                    left: "100%",
                    top: "10%",
                    marginLeft: compact ? 2 : 6,
                    transform: "translateY(-50%)",
                    zIndex: 8,
                    pointerEvents: "auto",
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <PartySpeechBubble
                    message={mySpeech}
                    compact={compact}
                    onClick={() => guardPartyMenuAction(() => setShowPartyChat(true))}
                  />
                </div>
              )}
            </>
          )}
        <div style={{ position: "relative", pointerEvents: "auto" }}>
          <MainMenuHeroShowcase
            brawlerId={brawler.id}
            brawlerColor={brawler.color}
            compact={compact}
            rankStrip={(
              <>
                {amPartyLeader() && inParty && (
                  <div style={{
                    fontSize: compact ? 14 : 18,
                    lineHeight: 1,
                    filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.75))",
                    textAlign: "center",
                    marginBottom: compact ? 2 : 3,
                  }}>
                    👑
                  </div>
                )}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {showRankedBars ? (
                    <RankedLeagueBar
                      totalCups={rankedCups}
                      peakCups={rankedPeakCups}
                      layout="compact"
                      badgeScale={MENU_RANK_BADGE_SCALE}
                      powerLevel={brawlerLevel}
                      barRef={rankedBarRef}
                      onClick={() => guardPartyMenuAction(onProStarPass)}
                      unclaimedCount={proPassBadge}
                    />
                  ) : (
                    <BrawlerRankBar
                      brawlerId={brawler.id}
                      trophies={brawlerTrophies}
                      layout="compact"
                      badgeScale={MENU_RANK_BADGE_SCALE}
                      powerLevel={brawlerLevel}
                      onClick={() => guardPartyMenuAction(() => onOpenRankRewards(brawler.id))}
                    />
                  )}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "rgba(0,0,0,0.55)",
                    border: "1px solid rgba(255,215,0,0.45)",
                    borderRadius: 8, padding: "4px 8px",
                    color: "#FFE082", fontSize: 12, fontWeight: 800,
                  }}>
                    <EmojiIcon emoji="★" size={18} /> {brawlerStarCount}/6
                  </span>
                </div>
              </>
            )}
            onBrawlerSelect={onBrawlerSelect}
            guardPartyMenuAction={guardPartyMenuAction}
          />
          {inParty && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                right: compact ? -52 : -58,
                top: "46%",
                transform: "translate(100%, -50%)",
                zIndex: 9,
                pointerEvents: "auto",
              }}
            >
              <SideButton
                icon="💬"
                imgSrc="ui/drawer-messages.png"
                label={t("party.chatOpen")}
                onClick={() => guardPartyMenuAction(() => setShowPartyChat(true))}
                color="#CE93D8"
                compact={compact}
                badge={partyChatUnread > 0 ? partyChatUnread : undefined}
                notifyCorner="top-right"
                menuBar
                hideLabel
                menuBarIconCenter
                menuBarWidth={compact ? 46 : 52}
                menuBarHeight={compact ? 46 : 52}
                menuBarIconSize={compact ? 42 : 48}
                menuBarIconScale={compact ? 1.1 : 1.14}
              />
            </div>
          )}
          {isPartyMemberPlayReady(myPlayerId) && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PartyReadyBadge compact={compact} />
            </div>
          )}
        </div>
              </>
            );
          })()}
          </div>
          <div style={{
            flex: 1,
            minWidth: 0,
            alignSelf: "stretch",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-start",
            paddingLeft: compact ? 4 : 6,
            marginLeft: rightLine.length >= 2 ? (compact ? -20 : -28) : 0,
            overflow: "visible",
            position: "relative",
            zIndex: partyCount >= 4 ? 1 : undefined,
          }}>
            {rightLine.map((mate, i) => {
              const stagger = partyStatsStaggerOffset(partyStatsStaggerIdx++, staggerPartyStats, compact);
              return (
              <PartySlotArea
                key={mate.playerId}
                mate={mate}
                side="right"
                compact={compact}
                overlapMargin={i > 0 ? (compact ? -98 : -112) : 0}
                statsStagger={stagger}
                showReadyBadge={isPartyMemberPlayReady(mate.playerId)}
                showLeaderCrown={isPartyLeaderPlayerId(mate.playerId)}
                showOfflineOverlay={!isPartyMemberOnline(mate.playerId)}
                activityLabel={
                  partyCount >= 2 && !isPartyMemberPlayReady(mate.playerId)
                    ? getMenuActivityLabelForPlayerId(mate.playerId)
                    : null
                }
                senderSuggest={suggestForPlayer(mate.playerId)}
                canAnswerSuggest={canAnswerPartySuggest && normalizePlayerIdQuery(partyBrawlerSuggest?.toPlayerId ?? "") === normalizePlayerIdQuery(mate.playerId)}
                speechMessage={getLatestPartySpeechForPlayer(mate.playerId)}
                modeSuggest={
                  partyModeSuggest
                  && normalizePlayerIdQuery(partyModeSuggest.fromPlayerId) === normalizePlayerIdQuery(mate.playerId)
                    ? partyModeSuggest
                    : null
                }
                onModeSuggestClick={amPartyLeader() ? () => setShowModeSuggestLeader(true) : undefined}
                onSpeechClick={() => guardPartyMenuAction(() => setShowPartyChat(true))}
                onTeammateClick={(rect) => setTeammateMenu({ mate, anchor: rect, side: "right" })}
                onSuggestBubbleClick={() => setShowSuggestAccept(true)}
                showRankedBars={showRankedBars}
                rankedCups={rankedCups}
                rankedPeakCups={rankedPeakCups}
              />
            );
            })}
            {rightEmptySlots.length > 0 && (
              <div style={{
                position: "absolute",
                top: "50%",
                ...(rightLine.length > 0
                  ? { left: compact ? 6 : 10, transform: "translateY(-50%)" }
                  : { left: "50%", transform: "translate(-50%, -50%)" }),
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: compact ? 6 : 8,
                pointerEvents: "auto",
                zIndex: 7,
              }}>
                {rightEmptySlots.map(slot => (
                  <PartyPlusButton
                    key={slot}
                    slot={slot}
                    compact={compact}
                    embedded
                    outgoingInvite={outgoingInviteForSlot(slot)}
                    onOpenPanel={() => guardPartyMenuAction(() => setPartyPanel(slot))}
                    onCancelInvite={() => {
                      const inv = outgoingInviteForSlot(slot);
                      if (inv) cancelOutgoingInviteForTarget(inv.targetPlayerId);
                      partyRefresh();
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {partyPanel && (
        <PartySidePanel
          inviteSlot={partyPanel}
          onClose={() => { setPartyPanel(null); partyRefresh(); }}
          onViewProfile={(id) => { setPartyPanel(null); onViewPlayerProfile(id); }}
          onSpectate={(playerId) => onSpectate(playerId)}
        />
      )}

      {showPartyChat && inParty && (
        <PartyChatPanel
          brawlerId={brawler.id}
          onClose={() => setShowPartyChat(false)}
          onSuggestModeChange={() => {
            setShowPartyChat(false);
            onModeSelect();
          }}
        />
      )}

      {showModeSuggestLeader && partyModeSuggest && amPartyLeader() && (
        <PartyModeSuggestAcceptModal
          suggestion={partyModeSuggest}
          onAccept={() => {
            const r = acceptPartyModeSuggestion();
            if (!r.success) {
              handleSoonNotice(r.error ?? t("common.error"));
              return;
            }
            setShowModeSuggestLeader(false);
            partyRefresh();
          }}
          onDecline={() => {
            declinePartyModeSuggestion();
            setShowModeSuggestLeader(false);
            partyRefresh();
          }}
        />
      )}

      <PartyInviteModal
        onAccepted={partyRefresh}
        onDeclined={partyRefresh}
      />

      <PartyJoinRequestModal onHandled={partyRefresh} />

      {teammateMenu && (
        <TeammateActionMenu
          username={teammateMenu.mate.username}
          anchor={teammateMenu.anchor}
          side={teammateMenu.side}
          canKick={amPartyLeader()}
          onClose={() => setTeammateMenu(null)}
          onSuggest={() => {
            setBrawlerPickTarget(teammateMenu.mate);
            setTeammateMenu(null);
          }}
          onProfile={() => {
            setTeammateMenu(null);
            onViewPlayerProfile(teammateMenu.mate.playerId);
          }}
          onKick={() => {
            const r = kickPartyMember(teammateMenu.mate.playerId);
            setTeammateMenu(null);
            if (!r.success) setNotif(r.error ?? t("common.error"));
            else partyRefresh();
            setTimeout(() => setNotif(null), 2400);
          }}
        />
      )}

      {brawlerPickTarget && (
        <PartyBrawlerPickerModal
          targetPlayerId={brawlerPickTarget.playerId}
          targetUsername={brawlerPickTarget.username}
          onClose={() => setBrawlerPickTarget(null)}
          onPick={(brawlerId) => {
            const r = sendPartyBrawlerSuggestion(brawlerPickTarget.playerId, brawlerId);
            setBrawlerPickTarget(null);
            if (!r.success) setNotif(r.error ?? t("common.error"));
            else partyRefresh();
            setTimeout(() => setNotif(null), 2200);
          }}
        />
      )}

      {showSuggestAccept && partyBrawlerSuggest && canAnswerPartySuggest && (
        <PartyBrawlerSuggestAcceptModal
          suggestion={partyBrawlerSuggest}
          onAccept={() => {
            acceptPartyBrawlerSuggestion();
            setShowSuggestAccept(false);
            partyRefresh();
          }}
          onDecline={() => {
            declinePartyBrawlerSuggestion();
            setShowSuggestAccept(false);
            partyRefresh();
          }}
        />
      )}

      {profile.equippedPetId && (
        <MainMenuEquippedPet
          petId={profile.equippedPetId}
          compact={compact}
          onPets={onPets}
        />
      )}

      {/* Mastery / Comic / Trails — same vertical level as Friends button */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: "50%",
          bottom: menuTrailsRowBottom(compact),
          transform: "translateX(calc(-50% - 20px))",
          zIndex: 7,
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          ...partyMenuLockedFilter,
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", gap: compact ? 4 : 6, justifyContent: "center" }}>
          <CharFeatureIconButton
            ref={masteryBtnRef}
            size="menu"
            onClick={() => guardPartyMenuAction(() => onMastery(brawler.id))}
            iconSrc={UI_BUTTON_ICONS.character.mastery}
            labelId="nav.mastery"
            glowColor="#BA68FF"
            badge={masteryBadge}
          />
          <CharFeatureIconButton
            size="menu"
            onClick={() => guardPartyMenuAction(() => onComic(brawler.id))}
            iconSrc={UI_BUTTON_ICONS.character.comic}
            labelId="nav.comic"
            glowColor="#BA68FF"
          />
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: compact ? 2 : 4 }}>
          <CharFeatureIconButton
            size="menu"
            onClick={() => tryTrophyFeature("customization", () => onTrails(brawler.id))}
            iconSrc={UI_BUTTON_ICONS.character.trails}
            labelId="nav.trails"
            glowColor="#4FC3F7"
            trophyLocked={!unlock.customization}
          />
        </div>
      </div>

      {/* RIGHT SIDE BUTTONS — aligned between top bar and bottom play row */}
      <div style={{
        position: "absolute",
        right: compact ? 8 : 18,
        top: menuSideTop(compact),
        bottom: menuSideBottom(compact),
        display: "flex", flexDirection: "column", justifyContent: "space-between", gap: menuSideButtonGap(compact), zIndex: 6,
        ...partyMenuLockedFilter,
      }}>
        <SideButton icon="🎒" imgSrc="ui/nav-collection.png" label={t("nav.collection")} onClick={() => guardPartyMenuAction(onCollection)} color="#40C4FF" compact={compact} badge={collectionBadge || undefined} notifyCorner="top-left" />
        <SideButton icon="🐾" imgSrc="ui/nav-pets.png" label={t("nav.pets")} onClick={() => tryTrophyFeature("pets", onPets)} color="#76FF03" compact={compact} badge={newPetBadge} notifyCorner="top-left" trophyLocked={!unlock.pets} unlockTarget="pets" />
        <SideButton icon="⭐" imgSrc="ui/nav-feats.png" label={t("nav.feats")} onClick={() => tryTrophyFeature("starFeats", onStarFeats)} color="#FFD54F" compact={compact} badge={starFeatBadge} notifyCorner="top-left" trophyLocked={!unlock.starFeats} unlockTarget="starFeats" />
        <SideButton icon="🏛️" imgSrc="ui/nav-clubs.png" label={t("nav.clubs")} onClick={() => tryTrophyFeature("clubs", onClubs)} color="#FF8A65" compact={compact} badge={unreadClub || undefined} notifyCorner="top-left" trophyLocked={!unlock.clubs} unlockTarget="clubs" />
        <SideButton icon="👥" imgSrc="ui/nav-friends.png" label={t("nav.friends")} onClick={() => guardPartyMenuAction(onFriends)} color="#CE93D8" compact={compact} badge={incomingFriendRequests || undefined} notifyCorner="top-left" />
      </div>

      {/* LEFT SIDE — магазин, персонаж, бонус дня, сундуки */}
      <div style={{
        position: "absolute", left: compact ? 8 : 18,
        top: menuSideTop(compact),
        bottom: menuSideBottom(compact),
        display: "flex", flexDirection: "column", justifyContent: "space-between", gap: menuSideButtonGap(compact), zIndex: 4,
        ...partyMenuLockedFilter,
      }}>
        <div style={{ display: "flex", flexDirection: "row", gap: compact ? 6 : 12 }}>
          <SideButton icon="🛒" imgSrc="ui/nav-shop.png" label={t("nav.shop")} onClick={() => guardPartyMenuAction(onShop)} color="#FFD700" compact={compact} giftTag={shopGiftBadge} dealsNewTag={shopDealsNewTag} notifyCorner="top-right" />
          {newcomerGiftsVisible && (
            <SideButton
              icon="🎁"
              imgSrc="ui/nav-gifts.png"
              label={t("nav.gifts")}
              onClick={() => guardPartyMenuAction(() => setShowNewcomerGifts(true))}
              color="#E040FB"
              compact={compact}
              badge={newcomerGiftsReady ? 1 : undefined}
              pulse={newcomerGiftsReady}
              notifyCorner="top-right"
            />
          )}
        </div>
        <SideButton icon="🦸" imgSrc="ui/nav-character.png" label={t("nav.character")} onClick={() => guardPartyMenuAction(onBrawlerSelect)} color="#CE93D8" compact={compact} badge={newBrawlerBadge} notifyCorner="top-right" onboardingTarget="character" />
        <SideButton
          icon="🎁"
          imgSrc="ui/nav-bonus.png"
          label={t("nav.dailyBonus")}
          onClick={() => guardPartyMenuAction(() => setShowDaily(true))}
          color={canClaimDaily ? "#FFD700" : "#888"}
          pulse={canClaimDaily}
          badge={canClaimDaily ? 1 : undefined}
          compact={compact}
          notifyCorner="top-right"
        />
        <SideButton icon="🗝️" imgSrc="ui/nav-chests.png" label={t("nav.chests")} onClick={() => guardPartyMenuAction(onChests)} color="#FF7043" badge={chestsBadge} compact={compact} notifyCorner="top-right" />
        <SideButton icon="🎨" imgSrc="ui/nav-customization.png" label={t("nav.customization")} onClick={() => tryTrophyFeature("customization", onCustomization)} color="#BA68C8" compact={compact} notifyCorner="top-right" trophyLocked={!unlock.customization} unlockTarget="customization" />
      </div>

      {/* BOTTOM-LEFT: Quests button + Clash Pass card */}
      {compact ? (
        <button
          onClick={() => tryTrophyFeature("quests", () => setShowQuests(true))}
          title={t("nav.questsDaily")}
          data-unlock-target="quests"
          style={{
            position: "absolute", bottom: menuBottomInset(compact), left: compact ? 128 : 196, zIndex: 5,
            width: compact ? 48 : undefined,
            height: menuBottomBtnH(compact), minHeight: menuBottomBtnH(compact), maxHeight: menuBottomBtnH(compact), boxSizing: "border-box",
            background: hasUnclaimedQuest
              ? "linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,138,0,0.3))"
              : "rgba(0,0,0,0.4)",
            border: `1.5px solid ${hasUnclaimedQuest ? "#FFD700" : "rgba(206,147,216,0.5)"}`,
            borderRadius: 10,
            display: "inline-flex", flexDirection: "column",
            alignItems: "center", justifyContent: "flex-end",
            overflow: "visible",
            color: "white", cursor: "pointer",
            backdropFilter: "blur(10px)",
            padding: "2px 4px 3px",
            animation: hasUnclaimedQuest ? "pulse 1.6s ease-in-out infinite" : undefined,
            boxShadow: hasUnclaimedQuest ? "0 0 14px rgba(255,215,0,0.55)" : undefined,
            ...partyMenuLockedFilter,
          }}
        >
          <div style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            width: "100%",
            flex: 1,
            ...(!unlock.quests ? { opacity: 0.52, filter: "grayscale(0.85)" } : {}),
          }}>
            <NotificationBadge count={questsBadge} />
            <img
              src={`${artBase}ui/nav-quests.png`}
              alt=""
              className="ui-game-icon"
              style={{
                width: 54, height: 54, flexShrink: 0,
                marginTop: -22, marginBottom: -6,
                position: "relative", zIndex: 2,
              }}
            />
            <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: 0.4, marginTop: 0, position: "relative", zIndex: 1, color: "#fff" }}>
              <Tr id="nav.quests" /> {activeQuestCount > 0 ? activeQuestCount : ""}
            </span>
          </div>
          {!unlock.quests && (
            <TrophyLockIcon
              size="compact"
              style={{
                position: "absolute",
                left: "50%",
                top: "42%",
                transform: "translate(-50%, -50%)",
                zIndex: 14,
              }}
            />
          )}
        </button>
      ) : (
        <button
          onClick={() => tryTrophyFeature("quests", () => setShowQuests(true))}
          data-unlock-target="quests"
          style={{
            position: "absolute", bottom: menuBottomInset(compact), left: 196, zIndex: 5,
            overflow: "visible",
            background: hasUnclaimedQuest
              ? "linear-gradient(135deg, rgba(255,213,79,0.35), rgba(255,138,0,0.30))"
              : "linear-gradient(135deg, rgba(74,20,140,0.55), rgba(123,47,190,0.32))",
            border: `1px solid ${hasUnclaimedQuest ? "var(--bd-gold)" : "var(--bd-violet)"}`,
            borderRadius: "var(--r-md)",
            color: "var(--t-1)", cursor: "pointer",
            backdropFilter: "blur(12px) saturate(1.15)",
            WebkitBackdropFilter: "blur(12px) saturate(1.15)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 0,
            minWidth: 84,
            height: menuBottomBtnH(compact), minHeight: menuBottomBtnH(compact), maxHeight: menuBottomBtnH(compact), boxSizing: "border-box",
            padding: "2px 10px 5px",
            animation: hasUnclaimedQuest ? "pulse 1.6s ease-in-out infinite" : undefined,
            boxShadow: hasUnclaimedQuest
              ? "var(--sh-glow-gold), var(--sh-md)"
              : "var(--sh-md)",
            ...partyMenuLockedFilter,
          }}
          title={t("nav.questsDaily")}
        >
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 0,
            width: "100%",
            flex: 1,
            ...(!unlock.quests ? { opacity: 0.52, filter: "grayscale(0.85)" } : {}),
          }}>
            <NotificationBadge count={questsBadge} />
            <img
              src={`${artBase}ui/nav-quests.png`}
              alt=""
              className="ui-game-icon"
              style={{
                width: 66, height: 66, flexShrink: 0,
                marginTop: -30, marginBottom: -8,
                position: "relative", zIndex: 2,
              }}
            />
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.6, lineHeight: 1.1, position: "relative", zIndex: 1, color: "#fff" }}>
              <Tr id="nav.quests" /> {activeQuestCount > 0 ? activeQuestCount : ""}
            </span>
          </div>
          {!unlock.quests && (
            <TrophyLockIcon
              size="regular"
              style={{
                position: "absolute",
                left: "50%",
                top: "42%",
                transform: "translate(-50%, -50%)",
                zIndex: 14,
              }}
            />
          )}
        </button>
      )}

      <StarPassMenuButton
        ref={starPassBtnRef}
        compact={compact}
        onClick={() => tryTrophyFeature("clashpass", onClashPass)}
        artBase={artBase}
        passLevel={passLevel}
        passPct={passPct}
        xp={profile.xp}
        passNeed={passNeed}
        badge={clashPassBadge}
        atMax={passLevel >= MAX_CLASHPASS_LEVEL}
        menuLockedFilter={partyMenuLockedFilter}
        trophyLocked={!unlock.clashpass}
      />

      {/* BOTTOM-RIGHT: плашка побед дня + режим + ИГРАТЬ */}
      <div
        style={{
          position: "absolute",
          bottom: menuBottomInset(compact),
          right: compact ? 60 : 88,
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: compact ? 6 : 10,
          maxWidth: compact ? "52%" : 360,
          pointerEvents: "auto",
        }}
      >
        {raidBrawler != null && raidBossLevel != null && (
          <div
            style={{
              textAlign: "right",
              fontWeight: 900,
              fontSize: compact ? 11 : 15,
              letterSpacing: 0.4,
              lineHeight: 1.25,
              color: "#ffe082",
              animation: "bossRaidLinePulse 2.2s ease-in-out infinite",
              ...partyMenuLockedFilter,
            }}
          >
            {brawlerName(raidBrawler.id, raidBrawler.name)}
            <span style={{ color: "rgba(255,255,255,0.82)", fontWeight: 800 }}> · </span>
            <Tr id="nav.raidLevel" params={{ level: raidBossLevel }} />
          </div>
        )}
        {unlock.dailyWins && (
        <div style={{ position: "relative", width: "100%", ...partyMenuLockedFilter }}
          data-unlock-target="dailyWins"
        >
          <DailyWinsStrip
            dayType={dailyWins.dayType}
            slots={dailyWins.slots}
            claimedCount={dailyWins.claimedCount}
            compact={compact}
          />
          {menuFxPhase === "pile" && menuTrophyFx && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: "50%",
                bottom: "100%",
                transform: "translateX(-50%)",
                marginBottom: 6,
                width: 200,
                height: 120,
                pointerEvents: "none",
                zIndex: 8,
              }}
            >
              {Array.from({ length: Math.min(menuTrophyFx.count, 14) }, (_, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: 6 + (i % 4) * 46,
                    top: 4 + Math.floor(i / 4) * 44,
                    animation: `trophyPilePop 0.35s ease ${(i / Math.min(menuTrophyFx.count, 14)) * 1.2}s both`,
                    filter: "drop-shadow(0 4px 12px rgba(255,215,0,0.85))",
                  }}
                >
                  <TrophyIcon size={MENU_TROPHY_PILE_SIZE} lite />
                </div>
              ))}
            </div>
          )}
        </div>
        )}
        {partyReadyActive && (
          <div style={{
            textAlign: "right",
            fontSize: compact ? 10 : 12,
            fontWeight: 800,
            color: "rgba(255,255,255,0.72)",
            letterSpacing: "0.06em",
            ...partyMenuLockedFilter,
          }}>
            <Tr id="nav.partyWaiting" params={{ seconds: partyReadySecondsLeft }} />
          </div>
        )}
        {(rankedPartyBlocked || rankedPartySizeBlocked) && inParty && profile.selectedMode === "ranked" && (
          <div style={{
            textAlign: "right",
            fontSize: compact ? 10 : 12,
            fontWeight: 800,
            color: "#FF8A80",
            lineHeight: 1.35,
            letterSpacing: "0.02em",
            ...partyMenuLockedFilter,
          }}>
            {rankedPartyBlocked ? rankedPartyBlockMsg : t("ranked.party.tooManyPlayers")}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", gap: compact ? 6 : 8, ...partyMenuLockedFilter }}>
        <button
          className="ui-btn ui-btn--shear"
          data-unlock-target="modeSelect"
          onClick={handleModeSelectClick}
          style={{
            position: "relative",
            overflow: "hidden",
            height: menuBottomBtnH(compact),
            minHeight: menuBottomBtnH(compact),
            maxHeight: menuBottomBtnH(compact),
            boxSizing: "border-box",
            padding: compact ? "4px 8px" : "6px 14px",
            color: "var(--t-1)", cursor: "pointer",
            display: "flex", alignItems: "center", gap: compact ? 5 : 8,
            minWidth: compact ? 0 : 248,
            maxWidth: compact ? "38%" : 280,
            flex: "1 1 auto",
            fontFamily: "inherit",
            ["--ui-shear-text" as string]: "#ffffff",
            ["--ui-shear-fill" as string]: `linear-gradient(135deg, ${mode.color}40, rgba(8,4,24,0.78))`,
            ["--ui-shear-border" as string]: mode.color,
            ["--menu-btn-glow" as string]: `${mode.color}55`,
            ["--ui-shear-shadow" as string]: `0 8px 28px ${mode.color}55, var(--sh-md), inset 0 1px 0 rgba(255,255,255,0.08)`,
            ["--ui-shear-blur" as string]: "blur(14px) saturate(1.2)",
          }}
        >
          <div style={{ width: compact ? 34 : 48, height: compact ? 34 : 48, position: "relative", flexShrink: 0, overflow: "visible" }}>
            <ModeIconImg
              modeId={mode.id}
              alt={mode.name}
              size={Math.round(menuModeIconSize(mode.id, !!compact) * 0.9)}
              color={mode.color}
              style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }}
            />
          </div>
          <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
            {!compact && (
              <span style={{ display: "block", color: "rgba(255,255,255,0.55)", fontSize: 9, letterSpacing: 1 }}><Tr id="common.mode" /></span>
            )}
            <span style={{ display: "block", fontSize: compact ? 10 : 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{mode.name}</span>
            {!compact && (
              <span style={{ display: "block", fontSize: 10, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{mode.subtitle}</span>
            )}
          </span>
          {hasModeMapNews ? (
            <span className="no-ui-shear ui-vol-new-strip ui-vol-new-strip--pulse" style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: compact ? 36 : 58, minWidth: compact ? 36 : 58,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(180deg, #FFF59D 0%, #FFEB3B 50%, #FFC107 100%)",
              borderLeft: "2px solid rgba(0,0,0,0.35)", fontSize: compact ? 8 : 10, fontWeight: 900,
              letterSpacing: compact ? 0.5 : 1.2, color: "#fff", textShadow: "0 1px 5px rgba(255,143,0,0.9)", zIndex: 1,
            }}><Tr id="common.new" /></span>
          ) : inParty && !amPartyLeader() && !hasModeMapNews ? (
            <span className="no-ui-shear" style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: compact ? 44 : 68, minWidth: compact ? 44 : 68,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(180deg, rgba(120,120,130,0.55), rgba(70,70,80,0.65))",
              borderLeft: "2px solid rgba(255,255,255,0.25)", fontSize: compact ? 7 : 9, fontWeight: 800,
              letterSpacing: 0.3, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 1.15, padding: "0 4px", zIndex: 1,
            }}><Tr id="party.suggestModeBadge" /></span>
          ) : !compact ? (
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, flexShrink: 0 }}><Tr id="nav.changeMode" /></span>
          ) : null}
          <span
            role="button"
            title={t("nav.aboutMode")}
            onClick={(e) => { e.stopPropagation(); guardPartyMenuAction(() => setShowModeInfo(true)); }}
            style={{
              position: "absolute", top: compact ? -5 : -7, right: compact ? -5 : -7,
              width: compact ? 16 : 22, height: compact ? 16 : 22, borderRadius: "50%",
              background: "rgba(0,0,0,0.85)", border: `1.5px solid ${mode.color}`, color: mode.color,
              fontSize: compact ? 9 : 12, fontWeight: 900, fontStyle: "italic", fontFamily: "Georgia, serif",
              display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              boxShadow: `0 0 10px ${mode.color}88`, lineHeight: 1, zIndex: 5,
            }}
          >i</span>
        </button>
        <button
          ref={playBtnRef}
          onClick={showPartyObserve ? handleObserveClick : handleMenuPlayClick}
          style={{
            position: "relative",
            zIndex: partyMenuLocked ? 20 : undefined,
            filter: "none",
            overflow: showRankedLobbyLine && !partyReadyActive && !showPartyObserve ? "hidden" : "visible",
            alignSelf: "stretch",
            height: menuBottomBtnH(compact),
            minHeight: menuBottomBtnH(compact),
            maxHeight: menuBottomBtnH(compact),
            boxSizing: "border-box",
            display: "inline-flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            padding: compact ? "0 14px" : "0 36px",
            minWidth: compact ? 88 : 148,
            maxWidth: compact ? 120 : 200,
            flex: "0 0 auto",
            fontWeight: 900,
            fontSize: compact ? 13 : 21,
            letterSpacing: compact ? "0.16em" : "0.28em",
            cursor: "pointer",
            flexShrink: 0,
            transform: "none",
            ["--ui-shear-text" as string]: "#ffffff",
            ["--ui-shear-text-shadow" as string]: "0 2px 8px rgba(0,0,0,0.6)",
            fontFamily: "inherit",
            ["--ui-shear-fill" as string]: partyReadyActive && iAmPartyReady
              ? "linear-gradient(135deg, #B71C1C 0%, #E53935 45%, #FF5252 100%)"
              : showPartyObserve
                ? "linear-gradient(135deg, #004D40 0%, #00897B 45%, #26A69A 100%)"
                : "linear-gradient(135deg, #7B2FBE 0%, #D500F9 45%, #FF6F00 100%)",
            ["--ui-shear-border" as string]: partyReadyActive && iAmPartyReady
              ? "rgba(255,200,200,0.5)"
              : showPartyObserve
                ? "rgba(178,255,220,0.5)"
                : "rgba(255,255,255,0.45)",
            ["--ui-shear-shadow" as string]: partyReadyActive && iAmPartyReady
              ? "0 22px 56px rgba(229,57,53,0.55), 0 0 32px rgba(255,82,82,0.35), inset 0 1px 0 rgba(255,255,255,0.45)"
              : showPartyObserve
                ? "0 22px 56px rgba(0,137,123,0.55), 0 0 32px rgba(38,166,154,0.35), inset 0 1px 0 rgba(255,255,255,0.45)"
                : "0 22px 56px rgba(213,0,249,0.6), 0 0 44px rgba(255,111,0,0.35), 0 0 24px rgba(123,47,190,0.55), inset 0 1px 0 rgba(255,255,255,0.55)",
            ["--ui-shear-blur" as string]: "none",
            ["--ui-shear-outline" as string]: partyReadyActive && iAmPartyReady
              ? "rgba(255,180,180,0.35)"
              : showPartyObserve
                ? "rgba(128,255,212,0.35)"
                : "rgba(255,255,255,0.28)",
            ["--menu-btn-glow" as string]: partyReadyActive && iAmPartyReady
              ? "rgba(255,82,82,0.55)"
              : showPartyObserve
                ? "rgba(38,166,154,0.5)"
                : "rgba(213,0,249,0.55)",
          }}
        >
          {showRankedLobbyLine && !partyReadyActive && !showPartyObserve && (
            <div
              className="no-ui-shear"
              style={{
                position: "absolute",
                top: compact ? 5 : 7,
                left: compact ? 8 : 16,
                right: compact ? 8 : 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: compact ? 4 : 6,
                lineHeight: 1,
                maxWidth: "calc(100% - 16px)",
                overflow: "hidden",
                pointerEvents: "none",
              }}
            >
              <img
                src={rankedLeagueIconUrl(rankedStanding.leagueId)}
                alt=""
                className="ui-game-icon ranked-league-icon"
                style={{ width: compact ? 18 : 22, height: compact ? 18 : 22, objectFit: "contain", flexShrink: 0, filter: "none" }}
              />
              <span
                style={{
                  fontWeight: 900,
                  fontSize: compact ? 8 : 10,
                  letterSpacing: 0.2,
                  lineHeight: 1,
                  color: rankedLeagueDef.color,
                  textShadow: `0 1px 4px rgba(0,0,0,0.85), 0 0 12px ${rankedLeagueDef.accent}44`,
                  fontStyle: "italic",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                }}
              >
                {t(`ranked.leagueFull.${rankedStanding.leagueId}`)}
              </span>
            </div>
          )}
          <span style={{ lineHeight: 1, position: "relative", zIndex: 1 }}>
            {partyReadyActive && iAmPartyReady
              ? playButtonLabel(t("nav.partyCancel"))
              : showPartyObserve
                ? playButtonLabel(t("nav.observe"))
                : playButtonLabel(t("nav.play"))}
          </span>
        </button>
        </div>
      </div>

      <AstralFloatingIcon
        compact={compact}
        size={compact ? 42 : 48}
        style={{
          bottom: menuBottomInset(compact),
          left: compact ? 228 : 356,
        }}
      />
      {isWinStreakVisible(brawlerWinStreak) && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: menuBottomInset(compact) + (compact ? 4 : 6),
            left: compact ? 182 : 292,
            zIndex: 6,
            pointerEvents: "none",
          }}
        >
          <WinStreakFlame streak={brawlerWinStreak} size={compact ? 40 : 48} />
        </div>
      )}
      <div style={partyMenuLockedFilter}>
        <AstralMenuPopup
        onCta={(target) => {
          if (partyMenuLocked) return;
          if (target === "shop") onShop();
          else if (target === "starGuardianRewards") onStarGuardianRewards();
          else if (target === "collection") onCollection();
          else if (target === "pets") onPets();
          else if (target === "clashPass") onClashPass();
        }}
      />
      </div>
      </div>

      {partyMenuLocked && (
        <div
          aria-hidden
          onClick={() => handleSoonNotice(t("party.menuLockedWhileReady"))}
          style={{
            position: "absolute",
            inset: 0,
            bottom: menuBottomInset(compact) + menuBottomBtnH(compact) + 48,
            zIndex: 14,
            pointerEvents: "auto",
            cursor: "default",
          }}
        />
      )}

      {menuFxPhase === "fly" && menuTrophyFx && (
        <TrophyFlyBurst
          count={menuTrophyFx.count}
          fromEl={playBtnRef.current}
          toEl={trophyRoadBarRef.current}
          iconSize={MENU_TROPHY_FLY_SIZE}
          spawnDurationMs={1800}
          onArrive={handleTrophyFlyArrive}
          onComplete={handleTrophyFlyComplete}
        />
      )}

      {passFxPhase === "fly" && menuPassXpFx && (
        <PassXpFlyBurst
          count={menuPassXpFx.count}
          fromEl={playBtnRef.current}
          toEl={starPassBtnRef.current}
          iconSize={MENU_PASS_XP_FLY_SIZE}
          spawnDurationMs={1800}
          onArrive={handlePassXpFlyArrive}
          onComplete={handlePassXpFlyComplete}
        />
      )}

      {rankedFxPhase === "pile" && menuRankedCupFx && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: "50%",
            bottom: compact ? 72 : 96,
            transform: "translateX(-50%)",
            width: 200,
            height: 120,
            pointerEvents: "none",
            zIndex: 20000,
          }}
        >
          {Array.from({ length: Math.min(menuRankedCupFx.count, 14) }, (_, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 6 + (i % 4) * 46,
                top: 4 + Math.floor(i / 4) * 44,
                animation: `trophyPilePop 0.35s ease ${(i / Math.min(menuRankedCupFx.count, 14)) * 1.2}s both`,
                filter: "drop-shadow(0 4px 12px rgba(206,147,216,0.85))",
              }}
            >
              <TrophyIcon size={MENU_RANKED_CUP_PILE_SIZE} lite />
            </div>
          ))}
        </div>
      )}

      {rankedFxPhase === "fly" && menuRankedCupFx && (
        <RankedCupFlyBurst
          count={menuRankedCupFx.count}
          fromEl={playBtnRef.current}
          toEl={rankedBarRef.current ?? rankedBtnRef.current}
          iconSize={MENU_RANKED_CUP_FLY_SIZE}
          spawnDurationMs={1800}
          onArrive={handleRankedCupFlyArrive}
          onComplete={handleRankedCupFlyComplete}
        />
      )}

      {proPassFxPhase === "fly" && menuProPassTokenFx && (
        <ProPassTokenFlyBurst
          count={menuProPassTokenFx.count}
          fromEl={playBtnRef.current}
          toEl={rankedBtnRef.current}
          iconSize={MENU_PRO_PASS_TOKEN_FLY_SIZE}
          spawnDurationMs={1800}
          onArrive={handleProPassTokenFlyArrive}
          onComplete={handleProPassTokenFlyComplete}
        />
      )}

      {masteryFxPhase === "fly" && menuMasteryXpFx && (
        <MasteryXpFlyBurst
          count={menuMasteryXpFx.count}
          fromEl={playBtnRef.current}
          toEl={masteryBtnRef.current}
          iconSize={MENU_MASTERY_XP_FLY_SIZE}
          spawnDurationMs={1800}
          onArrive={handleMasteryXpFlyArrive}
          onComplete={handleMasteryXpFlyComplete}
        />
      )}

      <style>{`
        @keyframes trophyPilePop {
          from { transform: scale(0) translateY(12px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      {showDaily && <DailyRewardModal onClose={() => { setShowDaily(false); setProfile(getCurrentProfile()); }} />}
      {showNewcomerGifts && (
        <NewcomerGiftsModal
          onClose={() => { setShowNewcomerGifts(false); setProfile(getCurrentProfile()); }}
          onProfileChange={() => setProfile(getCurrentProfile())}
        />
      )}
      {showQuests && <QuestsModal onClose={() => { setShowQuests(false); setProfile(getCurrentProfile()); }} />}
      {showModeInfo && (
        <ModeInfoModal mode={mode} onClose={() => setShowModeInfo(false)} />
      )}
      {showHamburger && (
        <HamburgerDrawer
          onClose={() => setShowHamburger(false)}
          onSettings={() => { setShowHamburger(false); onSettings(); }}
          onLogout={() => { setShowHamburger(false); onLogout(); }}
          onRegister={onRegister ? () => { setShowHamburger(false); onRegister(); } : undefined}
          onAccounts={onAccounts ? () => { setShowHamburger(false); onAccounts(); } : undefined}
          onNews={() => { setShowHamburger(false); onNews(); }}
          unreadNews={unreadNews}
          onMessages={() => { setShowHamburger(false); openMessages(); }}
          unreadMessages={unreadMessages}
          onBattleHistory={onBattleHistory ? () => { setShowHamburger(false); onBattleHistory(); } : undefined}
          onRecords={onRecords ? () => { setShowHamburger(false); onRecords(); } : undefined}
          onMapEditor={isAdminUnlocked() ? () => { setShowHamburger(false); onMapEditor(); } : undefined}
          onPlayerMapEditor={onPlayerMapEditor ? () => { setShowHamburger(false); onPlayerMapEditor(); } : undefined}
          isFullscreen={isFullscreen || pseudoFullscreen}
          onToggleFullscreen={() => { toggleFullscreen(); }}
        />
      )}

      {dailyWinsReward && (
        <RewardDropQueue
          rewards={[dailyWinsReward]}
          onDone={() => {
            setDailyWinsReward(null);
            setSgDailyPaused(false);
            setProfile(getCurrentProfile());
          }}
        />
      )}

      {questRewardQueue && questRewardQueue.length > 0 && !dailyWinsReward && (
        <RewardDropQueue
          rewards={questRewardQueue}
          onDone={() => {
            setQuestRewardQueue(null);
            setProfile(getCurrentProfile());
          }}
        />
      )}

      <StarGuardianMainDailyGate
        paused={sgDailyPaused || !!dailyWinsReward || !!questRewardQueue?.length}
        onClaimed={() => setProfile(getCurrentProfile())}
      />

      {hasGifts && !dailyWinsReward && !questRewardQueue?.length && (
        <GiftClaimModal onAllClaimed={() => setHasGifts(false)} />
      )}

      <BossRaidPendingRewardsGate onRewardsApplied={() => setProfile(getCurrentProfile())} />

      {notif && (
        <div
          className="ui-glass-strong"
          style={{
            position: "absolute",
            top: 90,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 12,
            maxWidth: "min(92%, 520px)",
            padding: "10px 16px",
            color: "var(--t-1)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textAlign: "center",
            whiteSpace: "normal",
            lineHeight: 1.35,
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
            pointerEvents: "none",
          }}
        >
          {notif}
        </div>
      )}

    </div>
  );
}

const StarPassMenuButton = forwardRef<HTMLButtonElement, {
  compact?: boolean;
  onClick: () => void;
  artBase: string;
  passLevel: number;
  passPct: number;
  xp: number;
  passNeed: number;
  badge: number;
  atMax: boolean;
  menuLockedFilter?: React.CSSProperties;
  trophyLocked?: boolean;
}>(function StarPassMenuButton({
  compact,
  onClick,
  artBase,
  passLevel,
  passPct,
  xp,
  passNeed,
  badge,
  atMax,
  menuLockedFilter,
  trophyLocked,
}, ref) {
  const { t } = useI18n();
  const lockDimStyle: React.CSSProperties | undefined = trophyLocked
    ? { opacity: 0.52, filter: "grayscale(0.85)" }
    : undefined;
  const passW = compact ? 112 : 172;
  const ticketSize = compact ? 46 : 118;
  const starSize = compact ? 28 : 56;
  const barH = compact ? 16 : 22;
  const topRowH = compact ? 22 : 34;
  const xpLabel = compact ? 7 : 9;
  const xpInBar = compact ? 9 : 12;
  const xpText = atMax ? "MAX" : `${xp} / ${passNeed}`;

  return (
    <button
      ref={ref}
      type="button"
      data-unlock-target="clashpass"
      onClick={onClick}
      title={t("pass.title")}
      style={{
        position: "absolute",
        bottom: menuBottomInset(compact),
        left: compact ? 8 : 16,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: compact ? 2 : 3,
        padding: compact ? "4px 5px 4px" : "8px 10px 8px",
        width: passW,
        maxWidth: passW,
        height: menuBottomBtnH(compact),
        minHeight: menuBottomBtnH(compact),
        maxHeight: menuBottomBtnH(compact),
        boxSizing: "border-box",
        cursor: "pointer",
        ["--ui-shear-text" as string]: "#ffffff",
        ["--ui-shear-text-shadow" as string]: "0 1px 2px rgba(0,0,0,0.65)",
        overflow: "visible",
        animation: compact ? undefined : "glow 3s ease-in-out infinite",
        ["--ui-shear-fill" as string]: compact
          ? "linear-gradient(135deg, rgba(74,20,140,0.6), rgba(206,147,216,0.4))"
          : "linear-gradient(160deg, rgba(74,20,140,0.7), rgba(123,47,190,0.45))",
        ["--ui-shear-border" as string]: compact ? "rgba(206,147,216,0.6)" : "var(--bd-violet)",
        ["--ui-shear-shadow" as string]: compact ? undefined : "var(--sh-md), var(--sh-glow-violet)",
        ["--ui-shear-blur" as string]: compact ? "blur(10px)" : "blur(14px) saturate(1.2)",
        ["--ui-shear-outline" as string]: "rgba(206,147,216,0.35)",
        ["--menu-btn-glow" as string]: "rgba(206,147,216,0.5)",
        ...menuLockedFilter,
      }}
    >
      <NotificationBadge count={badge} notifyCorner="top-right" />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: compact ? 2 : 3, flex: 1, minHeight: 0, ...lockDimStyle }}>
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        width: "100%",
        height: topRowH,
        minHeight: topRowH,
        maxHeight: topRowH,
        padding: compact ? "0 2px" : "0 4px",
        boxSizing: "border-box",
        overflow: "visible",
      }}>
        <img
          src={`${artBase}ui/star-pass-ticket.png`}
          alt=""
          className="ui-game-icon"
          style={{
            width: ticketSize,
            height: ticketSize,
            flexShrink: 0,
            marginLeft: compact ? -8 : -10,
            marginTop: compact ? -12 : -26,
            marginBottom: compact ? -14 : -30,
            pointerEvents: "none",
            filter: compact
              ? "drop-shadow(0 3px 10px rgba(255,213,79,0.7))"
              : "drop-shadow(0 5px 14px rgba(255,213,79,0.75))",
          }}
        />
        <PassLevelStar level={passLevel} size={starSize} overlap={compact ? -6 : -10} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: compact ? 3 : 5, flexShrink: 0 }}>
        <span style={{
          flexShrink: 0,
          fontSize: xpLabel,
          fontWeight: 900,
          letterSpacing: 0.5,
          color: "rgba(255,255,255,0.92)",
          lineHeight: 1,
        }}>XP</span>
        <VolProgressTrack
          fitHeight={barH}
          fill={passPct}
          fillBackground="linear-gradient(90deg, #FFD700, #CE93D8)"
          style={{ flex: 1 }}
          overlay={(
            <span style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: xpInBar,
              fontWeight: 900,
              color: "#fff",
              textShadow: "0 1px 3px rgba(0,0,0,0.85)",
              lineHeight: 1,
            }}>
              {xpText}
            </span>
          )}
        />
      </div>
      </div>
      {trophyLocked && (
        <TrophyLockIcon
          size={compact ? "compact" : "regular"}
          style={{ position: "absolute", right: 4, top: 4, zIndex: 6 }}
        />
      )}
    </button>
  );
});

function PassLevelStar({ level, size, overlap = 0, pullLeft = 0 }: { level: number; size: number; overlap?: number; pullLeft?: number }) {
  const fontSize = Math.max(10, Math.round(size * 0.34));
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, marginBottom: overlap, marginLeft: pullLeft ? -pullLeft : undefined }}>
      <GlowingStar filled size={size} />
      <span style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 900,
        color: "#3E2723",
        textShadow: "0 1px 0 rgba(255,255,255,0.45)",
        lineHeight: 1,
        pointerEvents: "none",
      }}>
        {level}
      </span>
    </div>
  );
}

function partyPlusEdgeStyle(
  edgeSide: "left" | "right",
  edgeIndex: number,
  compact?: boolean,
): CSSProperties {
  const top = (compact ? 44 : 46) + edgeIndex * (compact ? 10 : 11);
  return {
    position: "absolute",
    top: `${top}%`,
    transform: "translateY(-50%)",
    zIndex: 7,
    pointerEvents: "auto",
    ...(edgeSide === "left"
      ? { left: compact ? 76 : 92 }
      : { right: compact ? 76 : 92 }),
  };
}

function PartyPlusButton({
  slot,
  edgeSide,
  edgeIndex,
  compact,
  embedded = false,
  outgoingInvite,
  onOpenPanel,
  onCancelInvite,
}: {
  slot: PartySlot;
  edgeSide?: "left" | "right";
  edgeIndex?: number;
  compact?: boolean;
  embedded?: boolean;
  outgoingInvite: OutgoingPartyInvite | null;
  onOpenPanel: () => void;
  onCancelInvite: () => void;
}) {
  const { t } = useI18n();
  const color = "#CE93D8";
  const pos = embedded
    ? undefined
    : partyPlusEdgeStyle(edgeSide ?? "left", edgeIndex ?? 0, compact);

  return (
    <div style={pos}>
      {outgoingInvite && (
        <div style={{
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: 6,
          display: "flex",
          alignItems: "center",
          gap: 4,
          whiteSpace: "nowrap",
          fontSize: 9,
          fontWeight: 800,
          color: "#FFE082",
          background: "rgba(0,0,0,0.72)",
          border: "1px solid rgba(255,224,130,0.45)",
          borderRadius: 8,
          padding: "4px 6px 4px 8px",
          zIndex: 8,
        }}>
          <span><Tr id="nav.inviting" params={{ username: outgoingInvite.targetUsername }} /></span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCancelInvite(); }}
            title={t("nav.inviteCancel")}
            style={{
              width: 18,
              height: 18,
              border: "none",
              borderRadius: 4,
              background: "rgba(255,80,80,0.35)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 900,
              lineHeight: 1,
              cursor: "pointer",
              padding: 0,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onOpenPanel}
        title={t("nav.inviteTeam")}
        style={{
          width: compact ? 48 : 56,
          height: compact ? 48 : 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: compact ? 28 : 32,
          fontWeight: 900,
          color: "#fff",
          cursor: "pointer",
          opacity: 0.82,
          transition: "opacity 0.2s, box-shadow 0.2s",
          ["--ui-shear-fill" as string]: "linear-gradient(160deg, rgba(15,8,42,0.68), rgba(8,4,24,0.78))",
          ["--ui-shear-border" as string]: color,
          ["--ui-shear-shadow" as string]: `0 0 18px ${color}55, var(--sh-md)`,
          ["--ui-shear-blur" as string]: "blur(12px) saturate(1.2)",
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = "0.82"; }}
      >
        +
      </button>
    </div>
  );
}

function PartyReadyBadge({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <PartyMemberStatusBadge
      compact={compact}
      label={t("nav.partyReady")}
      variant="ready"
    />
  );
}

function PartyOfflineBadge({ compact }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <PartyMemberStatusBadge
      compact={compact}
      label={t("presence.screen.offline")}
      variant="offline"
    />
  );
}

function PartyActivityBadge({ compact, label }: { compact?: boolean; label: string }) {
  return (
    <PartyMemberStatusBadge
      compact={compact}
      label={label}
      variant="activity"
    />
  );
}

function PartyMemberStatusBadge({
  compact,
  label,
  variant,
}: {
  compact?: boolean;
  label: string;
  variant: "ready" | "activity" | "offline";
}) {
  const ready = variant === "ready";
  const offline = variant === "offline";
  const long = label.length > 14;
  return (
    <div
      className="no-ui-shear"
      style={{
        position: "absolute",
        top: "52%",
        left: "58%",
        transform: "translate(-50%, -50%)",
        zIndex: 5,
        pointerEvents: "none",
        padding: compact ? "5px 10px" : "7px 14px",
        maxWidth: compact ? 118 : 148,
        background: "rgba(0, 0, 0, 0.42)",
        border: ready
          ? "1.5px solid rgba(129, 199, 132, 0.7)"
          : offline
            ? "1.5px solid rgba(189, 189, 189, 0.65)"
            : "1.5px solid rgba(100, 181, 246, 0.75)",
        borderRadius: 8,
        color: ready
          ? "rgba(220, 255, 225, 0.95)"
          : offline
            ? "rgba(235, 235, 235, 0.92)"
            : "rgba(210, 235, 255, 0.96)",
        fontSize: compact ? (long ? 8 : 10) : (long ? 10 : 12),
        fontWeight: 900,
        letterSpacing: ready ? "0.14em" : offline ? "0.08em" : "0.04em",
        textTransform: ready || offline ? "uppercase" : "none",
        textAlign: "center",
        lineHeight: 1.15,
        boxShadow: "0 4px 18px rgba(0,0,0,0.4)",
        backdropFilter: "blur(4px)",
      }}
    >
      {label}
    </div>
  );
}

function PartySlotArea({
  compact,
  mate,
  side,
  overlapMargin = 0,
  statsStagger = 0,
  showReadyBadge = false,
  showLeaderCrown = false,
  showOfflineOverlay = false,
  activityLabel = null,
  senderSuggest,
  canAnswerSuggest,
  speechMessage,
  modeSuggest,
  onModeSuggestClick,
  onSpeechClick,
  onTeammateClick,
  onSuggestBubbleClick,
  showRankedBars = false,
  rankedCups = 0,
  rankedPeakCups = 0,
}: {
  compact?: boolean;
  mate: PartyTeammateView;
  side: "left" | "right";
  overlapMargin?: number;
  statsStagger?: number;
  showReadyBadge?: boolean;
  showLeaderCrown?: boolean;
  showOfflineOverlay?: boolean;
  activityLabel?: string | null;
  senderSuggest?: PartyBrawlerSuggestion | null;
  canAnswerSuggest?: boolean;
  speechMessage?: PartyChatMessage | null;
  modeSuggest?: PartyModeSuggestion | null;
  onModeSuggestClick?: () => void;
  onSpeechClick?: () => void;
  onTeammateClick: (anchor: DOMRect) => void;
  onSuggestBubbleClick: () => void;
  showRankedBars?: boolean;
  rankedCups?: number;
  rankedPeakCups?: number;
}) {
  const { t } = useI18n();
  const brawlerW = compact ? 243 : 270;
  const brawlerH = compact ? 259 : 288;
  const b = getBrawlerById(mate.brawlerId);
  const mateProfile = getProfileByPlayerId(mate.playerId);
  const mateTrophies = getBrawlerTrophies(mateProfile, mate.brawlerId)
    || mateProfile?.trophies
    || 0;
  const mateLevel = mateProfile?.brawlerLevels?.[mate.brawlerId] || 1;
  const mateStars = getBrawlerStarsCount(mateProfile, mate.brawlerId);

  return (
    <div
      style={{
        width: brawlerW,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        pointerEvents: "auto",
        cursor: "pointer",
        flexShrink: 0,
        marginLeft: overlapMargin,
        overflow: "visible",
      }}
      onClick={(e) => onTeammateClick((e.currentTarget as HTMLElement).getBoundingClientRect())}
      title={mate.username}
    >
      <div style={{
        position: "relative",
        width: brawlerW,
        height: brawlerH,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        {senderSuggest && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginBottom: 52 + statsStagger,
              zIndex: 8,
            }}
            onClick={e => e.stopPropagation()}
          >
            <PartyBrawlerSuggestBubble
              suggestion={senderSuggest}
              compact={compact}
              onClick={canAnswerSuggest ? onSuggestBubbleClick : undefined}
            />
          </div>
        )}
        {modeSuggest && (
          <div
            style={{
              position: "absolute",
              left: "100%",
              top: "14%",
              marginLeft: compact ? 2 : 6,
              transform: "translateY(-50%)",
              zIndex: 9,
              pointerEvents: "auto",
            }}
            onClick={e => e.stopPropagation()}
          >
            <PartyModeSuggestBubble
              suggestion={modeSuggest}
              compact={compact}
              onClick={onModeSuggestClick}
            />
          </div>
        )}
        {speechMessage && (
          <div
            style={{
              position: "absolute",
              left: "100%",
              top: "10%",
              marginLeft: compact ? 2 : 6,
              transform: "translateY(-50%)",
              zIndex: 9,
              pointerEvents: "auto",
            }}
            onClick={e => e.stopPropagation()}
          >
            <PartySpeechBubble
              message={speechMessage}
              compact={compact}
              onClick={onSpeechClick}
            />
          </div>
        )}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            marginBottom: 10 + statsStagger,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            whiteSpace: "nowrap",
            zIndex: 6,
            maxWidth: brawlerW + 40,
          }}
        >
          <div style={{
            fontSize: compact ? 10 : 11,
            fontWeight: 800,
            color: "#CE93D8",
            maxWidth: brawlerW + 40,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}>
            {mate.username}
          </div>
          {showLeaderCrown && (
            <div style={{
              fontSize: compact ? 13 : 16,
              lineHeight: 1,
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.75))",
            }}>
              👑
            </div>
          )}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: compact ? 6 : 8,
          }}>
            {showRankedBars ? (
              <RankedLeagueBar
                totalCups={rankedCups}
                peakCups={rankedPeakCups}
                layout="compact"
                badgeScale={MENU_RANK_BADGE_SCALE}
                powerLevel={mateLevel}
              />
            ) : (
              <BrawlerRankBar
                brawlerId={mate.brawlerId}
                trophies={mateTrophies}
                layout="compact"
                badgeScale={MENU_RANK_BADGE_SCALE}
                powerLevel={mateLevel}
                clickable={false}
                showUnclaimedBadge={false}
              />
            )}
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,215,0,0.45)",
              borderRadius: 8,
              padding: compact ? "3px 6px" : "4px 8px",
              color: "#FFE082",
              fontSize: compact ? 11 : 12,
              fontWeight: 800,
            }}>
              <EmojiIcon emoji="★" size={18} /> {mateStars}/6
            </span>
          </div>
        </div>
        <div style={{
          position: "absolute",
          inset: 0,
          minWidth: brawlerW,
          minHeight: brawlerH,
          background: `radial-gradient(circle at 50% 60%, ${b?.color ?? "#CE93D8"}55 0%, transparent 65%)`,
        }} />
        <MenuPartyBrawler3D
          key={`mate-${mate.playerId}-${mate.brawlerId}`}
          brawlerId={mate.brawlerId}
          color={b?.color ?? "#CE93D8"}
          size={brawlerW}
        />
        {showReadyBadge && <PartyReadyBadge compact={compact} />}
        {!showReadyBadge && showOfflineOverlay && <PartyOfflineBadge compact={compact} />}
        {!showReadyBadge && !showOfflineOverlay && activityLabel && (
          <PartyActivityBadge compact={compact} label={activityLabel} />
        )}
      </div>
    </div>
  );
}

function SideButton({
  icon, imgSrc, label, onClick, color, pulse, badge, compact, giftTag, dealsNewTag, notifyCorner = "top-right", menuBar,
  menuBarWidth, menuBarIconSize, menuBarIconScale, menuBarIconBottom, menuBarHeight, menuBarPadding, labelWrap, hideLabel, menuBarIconCenter,
  menuTopBarSoft,
  innerRef,
  trophyLocked,
  unlockTarget,
  onboardingTarget,
}: {
  icon: string; imgSrc?: string; label: string; onClick: () => void; color: string;
  pulse?: boolean; badge?: number; compact?: boolean; giftTag?: boolean; dealsNewTag?: boolean; notifyCorner?: NotifyCorner;
  /** Compact top-bar variant: same icon/button ratio as side nav, fits menu header row */
  menuBar?: boolean;
  /** Softer volumetric highlight for top HUD buttons (not trophy road / ranked). */
  menuTopBarSoft?: boolean;
  /** Optional menu-bar overrides (e.g. ranked button: wider + larger icon). */
  menuBarWidth?: number;
  menuBarIconSize?: number;
  menuBarIconScale?: number;
  /** Icon anchor offset from slot bottom (more negative = lower). */
  menuBarIconBottom?: number;
  /** Fixed menu-bar height (e.g. 52 to match TrophyRoadMenuButton). */
  menuBarHeight?: number;
  menuBarPadding?: string;
  /** Allow multi-line label at the same font size when text is longer than btn width. */
  labelWrap?: boolean;
  /** Hide visible label (tooltip/alt still use label text). */
  hideLabel?: boolean;
  /** Center icon in the button instead of anchoring to bottom. */
  menuBarIconCenter?: boolean;
  innerRef?: Ref<HTMLButtonElement>;
  trophyLocked?: boolean;
  unlockTarget?: string;
  onboardingTarget?: string;
}) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const lockDimStyle: React.CSSProperties | undefined = trophyLocked
    ? { opacity: 0.52, filter: "grayscale(0.85)" }
    : undefined;
  const fill = hovered
    ? `linear-gradient(160deg, ${color}30, rgba(8,4,24,0.92))`
    : "linear-gradient(160deg, rgba(15,8,42,0.72), rgba(8,4,24,0.86))";
  const border = hovered ? color : "var(--bd-1)";
  const shadow = "inset 0 1px 0 rgba(255,255,255,0.12)";
  const btnW = menuBarWidth ?? (menuBar ? (compact ? 50 : 56) : (compact ? 56 : 64));
  const labelSize = menuBar ? (compact ? 9 : 10) : (compact ? 7 : 8);
  const labelLineH = labelSize * 1.1;
  const labelBlockH = hideLabel ? 0 : labelWrap ? labelLineH * 2 : labelLineH;
  const btnPadding = menuBarPadding ?? (menuBar ? (compact ? "0 1px 1px" : "0 2px 2px") : (compact ? "0 2px 0" : "0 2px 1px"));
  const iconSlotH = menuBarHeight && (hideLabel || menuBarIconCenter)
    ? menuBarHeight
    : menuBarHeight
      ? Math.max(16, menuBarHeight - 2 - 4 - labelBlockH)
      : menuBar ? (compact ? 34 : 38) : (compact ? 32 : 36);
  const iconPx = menuBarIconSize ?? (menuBar ? (compact ? 52 : 58) : (compact ? 52 : 58));
  const iconScale = menuBarIconScale ?? (menuBar ? (compact ? 1.14 : 1.18) : (compact ? 1.1 : 1.14));
  const iconBottom = menuBarIconBottom ?? (menuBar ? (compact ? -2 : -3) : (compact ? -1 : -2));
  const giftPos = cornerBadgeStyle(notifyCorner);
  return (
    <button
      ref={innerRef}
      className={menuTopBarSoft ? "menu-top-bar-soft" : undefined}
      data-unlock-target={unlockTarget}
      data-onboarding-target={onboardingTarget}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: menuBarIconCenter || hideLabel ? "center" : "flex-end",
        gap: 0,
        overflow: "visible",
        padding: btnPadding,
        color: "var(--t-1)", cursor: "pointer",
        width: btnW,
        minWidth: btnW,
        ...(menuBarHeight ? { minHeight: menuBarHeight, maxHeight: menuBarHeight, height: menuBarHeight } : {}),
        transition: "box-shadow var(--ease-mid), border-color var(--ease-mid)",
        animation: pulse ? "pulse 1.6s ease-in-out infinite" : undefined,
        letterSpacing: "0.04em",
        ["--ui-shear-text" as string]: "#ffffff",
        ["--ui-shear-fill" as string]: fill,
        ["--ui-shear-border" as string]: border,
        ["--ui-shear-shadow" as string]: shadow,
        ["--ui-shear-blur" as string]: "blur(12px) saturate(1.18)",
        ["--ui-shear-outline" as string]: hovered ? `${color}55` : "rgba(255,255,255,0.12)",
        ["--menu-btn-glow" as string]: `${color}55`,
        ["--menu-btn-accent" as string]: color,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: menuBarIconCenter || hideLabel ? "center" : "flex-end", gap: 0, width: "100%", flex: 1, minHeight: 0, ...lockDimStyle }}>
      <div style={{
        width: btnW,
        height: iconSlotH,
        position: "relative",
        flexShrink: 0,
        overflow: "visible",
      }}>
        {imgSrc ? (
          <img
            src={`${base}${imgSrc}`}
            alt={label}
            className="ui-game-icon"
            style={{
              position: "absolute",
              left: "50%",
              ...(menuBarIconCenter
                ? { top: "50%", transform: `translate(-50%, -50%) scale(${iconScale})`, transformOrigin: "50% 50%" }
                : { bottom: iconBottom, transform: `translateX(-50%) scale(${iconScale})`, transformOrigin: "50% 100%" }),
              width: iconPx,
              height: iconPx,
              maxWidth: "none",
              pointerEvents: "none",
              zIndex: 2,
              filter: hovered ? `drop-shadow(0 0 10px ${color})` : "none",
              transition: "filter 0.2s",
            }}
          />
        ) : (
          <span style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            transform: `translateX(-50%) scale(${iconScale})`,
            transformOrigin: "50% 100%",
            fontSize: iconPx * 0.55,
            lineHeight: 1,
            zIndex: 2,
          }}><EmojiIcon emoji={icon} size={Math.round(iconPx * 0.55)} /></span>
        )}
      </div>
      {!hideLabel && (
        <span style={{
          fontSize: labelSize,
          fontWeight: 900,
          letterSpacing: labelWrap ? 0.05 : 0.15,
          color: "#fff",
          whiteSpace: labelWrap ? "normal" : "nowrap",
          lineHeight: 1.1,
          textAlign: "center",
          maxWidth: labelWrap ? btnW : undefined,
          position: "relative",
          zIndex: 1,
          textShadow: "0 1px 2px rgba(0,0,0,0.85)",
          WebkitFontSmoothing: "antialiased",
        }}>{label}</span>
      )}
      </div>
      {giftTag && (
        <span className="no-ui-shear" style={{
          position: "absolute", zIndex: 12, ...giftPos,
          background: "linear-gradient(135deg, #00C853, #69F0AE)",
          border: "1px solid rgba(255,255,255,0.45)",
          color: "#003b1b",
          borderRadius: 999,
          fontSize: compact ? 7 : 9,
          fontWeight: 900,
          padding: compact ? "1px 5px" : "2px 7px",
          letterSpacing: 0.4,
          boxShadow: "0 0 14px rgba(105,240,174,0.95), 0 0 24px rgba(105,240,174,0.45)",
        }}><Tr id="common.gift" /></span>
      )}
      {dealsNewTag && (
        <span className="no-ui-shear ui-vol-new-pill" style={{
          position: "absolute",
          zIndex: 12,
          top: compact ? (giftTag ? 10 : 2) : (giftTag ? 12 : 4),
          right: compact ? -6 : -8,
          background: "linear-gradient(135deg, #FF1744, #D50000)",
          color: "#fff",
          borderRadius: 999,
          fontSize: compact ? 7 : 9,
          fontWeight: 900,
          padding: compact ? "1px 5px" : "2px 7px",
          letterSpacing: 0.4,
        }}><Tr id="common.new" /></span>
      )}
      <NotificationBadge count={badge ?? 0} notifyCorner={notifyCorner} />
      {trophyLocked && (
        <TrophyLockIcon
          size={compact ? "compact" : "regular"}
          style={{
            position: "absolute",
            left: "50%",
            top: "42%",
            transform: "translate(-50%, -50%)",
            zIndex: 14,
          }}
        />
      )}
    </button>
  );
}
