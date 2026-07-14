import { useState, useEffect, useRef, useCallback } from "react";
import { gameMusic } from "./audio/gameMusicService";
import { MENU_BGM_SCREENS } from "./audio/gameAudioManifest";
import { installGlobalButtonSfx } from "./audio/installGlobalButtonSfx";
import { installAudioUnlock, noteUserGesture } from "./audio/audioUnlock";
import {
  getCurrentUsername,
  getCurrentProfile,
  getControlMode,
  setSelectedBrawler as persistBrawler,
  setSelectedMode as persistMode,
  setSelectedShowdownFormat as persistShowdownFormat,
  setSelectedStarStrikeFormat as persistStarStrikeFormat,
  logout,
} from "./utils/localStorageAPI";
import AuthPage from "./pages/AuthPage";
import MainMenu from "./pages/MainMenu";
import ModeSelect from "./pages/ModeSelect";
import CharacterSelect from "./pages/CharacterSelect";
import GameScreen from "./pages/GameScreen";
import OnlineBattle from "./components/online/OnlineBattle";
import { lookupOnlineSpectate } from "./net/v2/BattleConnection";
import { routeToServer, BATTLES_ON_SERVER } from "./utils/net/battleModeRouting";
import { isOnlineBattleConfigured } from "./lib/runtimeConfig";
import { getProfileByPlayerId } from "./utils/playerGiftSend";
import CollectionPage from "./pages/CollectionPage";
import ShopPage from "./pages/ShopPage";
import CustomizationPage from "./pages/CustomizationPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import ClashPassPage from "./pages/ClashPassPage";
import ProStarPassPage from "./pages/ProStarPassPage";
import PageErrorBoundary from "./components/PageErrorBoundary";
import TrophyRoadPage from "./pages/TrophyRoadPage";
import ChestsPage from "./pages/ChestsPage";
import PetsPage from "./pages/PetsPage";
import LoadingScreen from "./pages/LoadingScreen";
import FirstLaunchIntroVideo from "./components/FirstLaunchIntroVideo";
import { isBootIntroConfigured } from "./utils/firstLaunchIntro";
import MapEditorPage from "./pages/MapEditorPage";
import NewsPage from "./pages/NewsPage";
import MessagesPage from "./pages/MessagesPage";
import ClubsPage from "./pages/ClubsPage";
import FriendsPage from "./pages/FriendsPage";
import PlayerProfilePage from "./pages/PlayerProfilePage";
import { setMyPresence } from "./utils/social/presence";
import { screenToMenuActivity, setMyMenuActivity } from "./utils/social/presence";
import { clearPartyBattleRoster, readPartyBattleRoster, stashPartyBattleRoster } from "./utils/social/partyBattle";
import { clearAllPlayAgainState } from "./utils/social/battleTeamPlayAgain";
import MatchmakingScreen from "./pages/MatchmakingScreen";
import {
  getMatchmakingInitialFound,
  getMatchmakingTotalPlayers,
  matchmakingModeLabel,
} from "./utils/matchmaking/matchmakingConfig";
import {
  clearPartyMatchmaking,
  clearPartyPlayReady,
  getPartyMemberCount,
} from "./utils/social/party";
import { getPartyCount, canPlayWithParty, partyModeFromProfile } from "./utils/social/partyConfig";
import { checkMyPartyRankedLeague } from "./utils/social/party";
import MegaSquadPickerPage from "./pages/MegaSquadPickerPage";
import StarGuardianRewardsPage from "./pages/StarGuardianRewardsPage";
import BattleHistoryPage from "./pages/BattleHistoryPage";
import BattleFeedPage from "./pages/BattleFeedPage";
import RecordsPage from "./pages/RecordsPage";
import RegisterPage from "./pages/RegisterPage";
import AccountsPage from "./pages/AccountsPage";
import AccountDetailPage from "./pages/AccountDetailPage";
import BrawlerMasteryPage from "./pages/BrawlerMasteryPage";
import BrawlerComicPage from "./pages/BrawlerComicPage";
import BrawlerRankRewardsModal from "./components/BrawlerRankRewardsModal";
import PinSelectModal from "./components/PinSelectModal";
import BrawlerTrailPage from "./pages/BrawlerTrailPage";
import StarFeatsPage from "./pages/StarFeatsPage";
import RankedMenuPage, { RankedMatchFlowPage } from "./pages/RankedMenuPage";
import RandomMatchFlowPage from "./pages/RandomMatchFlowPage";
import { clearRankedBattleSession } from "./utils/rankedMapPick";
import { clearRandomBattleSession } from "./utils/randomBattleSession";
import { pickRandomMegaSquad } from "./utils/randomModePool";
import {
  beginPlayerMapBattle,
  clearMapSourceCategory,
  clearPlayerMapBattleSession,
  getPlayerMapBattleSession,
  isPlayerMapsModeSelected,
} from "./utils/playerMaps/playerMapSession";
import { tickPlayerMapMaintenance } from "./utils/playerMaps/playerMapRegistry";
import { syncProfileWithCloud, ensureAutoCloudSyncRunning } from "./utils/cloud/profileCloud";
import LiveBattleSpectator from "./components/LiveBattleSpectator";
import BackgroundBattleRejoinBanner from "./components/BackgroundBattleRejoinBanner";
import { ensureBotLiveBattleSim } from "./utils/social/botLiveBattleSim";
import {
  hasActiveBackgroundBattle,
  BACKGROUND_BATTLE_CHANGED,
  BACKGROUND_BATTLE_FINISHED,
  getBackgroundBattleMeta,
} from "./game/backgroundBattleSession";
import { syncAiBattleTrainingFromControl, stopAiBattleTraining } from "./ai/aiTrainingRuntime";
import { isAdminUnlocked } from "./utils/mapEditorAPI";
import { editorModeForGameMode } from "./utils/mapSchedule";
import type { EditorMode } from "./utils/mapEditorAPI";
import { isTechBreakActive, subscribeTechBreakChanges, isBattleEntryBlockedByTechBreak, ensureTechBreakTicker } from "./utils/techBreak";
import TechBreakScreen from "./components/TechBreakScreen";
// Side-effect import: installs the battle-finished listener so the club battle
// counter starts ticking the moment the app boots, even before the player ever
// opens the Clubs page.
import "./utils/clubs";
import RotateDeviceOverlay from "./components/RotateDeviceOverlay";
import { PlatformLayoutProvider, setUiStageFullBleed } from "./platform";
import { translate } from "./i18n";
import TrophyLockToastHost from "./components/progression/TrophyLockToastHost";
import UnlockGuideOverlay from "./components/progression/UnlockGuideOverlay";
import { isFeatureUnlocked, getFeatureTrophyRequirement } from "./utils/progression/trophyUnlocks";
import { showTrophyLockToast } from "./utils/progression/trophyLockToast";
import type { TrophyFeatureId } from "./utils/progression/trophyUnlocks";
import { preloadAllModels } from "./utils/modelPreloader";
import { retryBrokenUiImages } from "./utils/uiImageRetry";
import { preloadBattleAssets, BATTLE_LOADING_MIN_MS } from "./utils/battleAssetPreloader";
import { getHeavyAssetBaseUrl } from "./lib/assetBase";
import LegalConsentScreen from "./components/LegalConsentScreen";
import { hasLegalConsent } from "./legal/legalConsent";
import TutorialGuestNameModal from "./components/tutorial/TutorialGuestNameModal";
import TutorialPostBattleOverlay from "./components/tutorial/TutorialPostBattleOverlay";
import {
  abandonTutorialSession,
  guestNeedsOnboardingTutorial,
  markOnboardingTutorialDone,
  startPostBattleGuide,
  getPostBattleGuideStep,
  TUTORIAL_BRAWLER_ID,
} from "./utils/tutorial/onboardingTutorial";
import { resolvePartyBossRaidLevel } from "./utils/partyRaidLevel";
import { BOSS_RAID_MAX_LEVEL } from "./utils/bossRaidProgress";
import { resolvePartySiegeLevel } from "./utils/siegeProgress";

type Screen =
  | "auth"
  | "menu"
  | "modeSelect"
  | "characterSelect"
  | "game"
  | "collection"
  | "shop"
  | "customization"
  | "settings"
  | "profile"
  | "clashpass"
  | "trophyroad"
  | "chests"
  | "pets"
  | "mapeditor"
  | "mapEditorModeSelect"
  | "playerMapEditor"
  | "playerMapEditorModeSelect"
  | "news"
  | "messages"
  | "clubs"
  | "friends"
  | "playerProfile"
  | "megaSquad"
  | "starGuardianRewards"
  | "battleHistory"
  | "records"
  | "techBreakPreview"
  | "register"
  | "accounts"
  | "accountDetail"
  | "battleFeed"
  | "mastery"
  | "comic"
  | "rankRewards"
  | "pins"
  | "brawlerTrail"
  | "starFeats"
  | "rankedMenu"
  | "rankedMatch"
  | "randomMatch"
  | "matchmaking"
  | "onlineBattle"
  | "proStarPass";

/** Screens that render as top-level menu pages (shop/trophy road shell — outside overflow clip). */
const MENU_STACKED_SCREENS: ReadonlySet<Screen> = new Set([
  "mastery",
  "clashpass",
  "rankRewards",
  "pins",
]);

export type GameMode = "showdown" | "crystals" | "siege" | "heist" | "gemgrab" | "training" | "megashowdown" | "hardcoreShowdown" | "random" | "starstrike" | "bossraid" | "bounty" | "monsterhide" | "monsterInvasion" | "teamHunt" | "ranked";
export type ShowdownFormat = "solo" | "duo" | "trio";
export type StarStrikeFormat = "3v3" | "5v5";

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    return getCurrentUsername() ? "menu" : "auth";
  });
  const initial = getCurrentProfile();
  const [selectedMode, setSelectedMode] = useState<GameMode>((initial?.selectedMode as GameMode) || "showdown");
  const [selectedShowdownFormat, setSelectedShowdownFormat] = useState<ShowdownFormat>((initial?.selectedShowdownFormat as ShowdownFormat) || "solo");
  const [selectedStarStrikeFormat, setSelectedStarStrikeFormat] = useState<StarStrikeFormat>((initial?.selectedStarStrikeFormat as StarStrikeFormat) || "3v3");
  const [selectedBrawler, setSelectedBrawler] = useState(initial?.selectedBrawlerId || "miya");
  const [masteryBrawlerId, setMasteryBrawlerId] = useState(initial?.selectedBrawlerId || "hana");
  const [comicBrawlerId, setComicBrawlerId] = useState(initial?.selectedBrawlerId || "hana");
  const [trailBrawlerId, setTrailBrawlerId] = useState(initial?.selectedBrawlerId || "hana");
  const [rankBrawlerId, setRankBrawlerId] = useState(initial?.selectedBrawlerId || "hana");
  const [pinsBrawlerId, setPinsBrawlerId] = useState(initial?.selectedBrawlerId || "hana");
  const [featureBackScreen, setFeatureBackScreen] = useState<Screen>("menu");
  const [customizationTab, setCustomizationTab] = useState<"pins" | "icons" | "gifts" | "backgrounds" | "trails">("pins");

  // Always rehydrate selections from the active profile when entering the menu/game,
  // so a profile switch never carries stale picks across accounts.
  const hydrateFromProfile = () => {
    const p = getCurrentProfile();
    if (!p) return { mode: "showdown" as GameMode, brawler: "miya" };
    const m = (p.selectedMode as GameMode) || "showdown";
    const b = p.selectedBrawlerId || "miya";
    setSelectedMode(m);
    setSelectedBrawler(b);
    const f = (p.selectedShowdownFormat as ShowdownFormat) || "solo";
    const sf = (p.selectedStarStrikeFormat as StarStrikeFormat) || "3v3";
    setSelectedShowdownFormat(f);
    setSelectedStarStrikeFormat(sf);
    return { mode: m, brawler: b };
  };
  const [bootIntroVideo, setBootIntroVideo] = useState(() => isBootIntroConfigured());
  const [bootLoading, setBootLoading] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [legalAccepted, setLegalAccepted] = useState(() => hasLegalConsent());

  const finishBootLoading = useCallback(() => {
    setBootLoading(false);
    gameMusic.requestTrack("menu");
    gameMusic.ensurePlaying();
  }, []);
  const [onboardingTutorialActive, setOnboardingTutorialActive] = useState(false);
  const [showTutorialNameModal, setShowTutorialNameModal] = useState(false);
  const [techBreakActive, setTechBreakActive] = useState(() => isTechBreakActive());
  const [transitionTo, setTransitionTo] = useState<Screen | null>(null);
  const [transitionLabel, setTransitionLabel] = useState(() => translate("loading.default"));
  const [transitionProgress, setTransitionProgress] = useState(0);
  // Transient one-shot mode override (used by "Испытать" → training).
  // Cleared automatically as soon as the player exits the game so the
  // persisted lobby mode is restored on the next "Играть".
  const [forceMode, setForceMode] = useState<GameMode | null>(null);
  /** Actual 3v3 mode picked in ranked match flow (gemgrab, crystals, …). */
  const [rankedBattleMode, setRankedBattleMode] = useState<GameMode | null>(null);
  const [mapEditorMode, setMapEditorMode] = useState<EditorMode | null>(null);
  // Mega Star Battle squad picked on the squad-picker page; consumed by GameScreen.
  const [megaSquad, setMegaSquad] = useState<{ ids: string[]; levels: number[] } | null>(null);
  /** Активный бой с боссом (id + уровень). Если задан — `GameScreen` в режиме `bossraid`. */
  const [bossRaidBattle, setBossRaidBattle] = useState<{ bossId: string; level: number } | null>(null);
  const [siegeBattle, setSiegeBattle] = useState<{ level: number } | null>(null);
  const [viewPlayerId, setViewPlayerId] = useState<string | null>(null);
  const [viewClubId, setViewClubId] = useState<string | null>(null);
  const [profileBackScreen, setProfileBackScreen] = useState<Screen>("menu");
  const [spectateTargetId, setSpectateTargetId] = useState<string | null>(null);
  const [onlineSpectate, setOnlineSpectate] = useState<{ playerId: string; name?: string; mode: string } | null>(null);
  /** Active server battle — GameScreen keeps full 3D/HUD; server runs sim. */
  const [serverBattle, setServerBattle] = useState<{
    mode: string;
    brawlerOverride?: string;
    playerMapPublishId?: string;
  } | null>(null);
  const [reattachBackgroundBattle, setReattachBackgroundBattle] = useState(false);
  const [backgroundBattleActive, setBackgroundBattleActive] = useState(() => hasActiveBackgroundBattle());
  /** Босс, выбранный в ленте режимов; «Играть» в лобби запускает bossraid с этим id */
  // Сохраняется между сессиями, чтобы при перезаходе в игру выбранный босс
  // (а вместе с ним — корректный «текущий уровень» из профиля) восстанавливался,
  // а не сбрасывался на первого/первый уровень.
  const LOBBY_BOSS_KEY = "lobby_bossraid_boss_v1";
  const [lobbyBossRaidBossId, _setLobbyBossRaidBossIdRaw] = useState<string | null>(() => {
    try { return localStorage.getItem(LOBBY_BOSS_KEY) || null; } catch { return null; }
  });
  const setLobbyBossRaidBossId = (id: string | null) => {
    _setLobbyBossRaidBossIdRaw(id);
    try {
      if (id) localStorage.setItem(LOBBY_BOSS_KEY, id);
      else localStorage.removeItem(LOBBY_BOSS_KEY);
    } catch { /* localStorage disabled */ }
  };

  const matchmakingCompleteRef = useRef<() => void>(() => {});
  const [matchmakingUi, setMatchmakingUi] = useState<{
    totalPlayers: number;
    initialFound: number;
    ranked?: boolean;
    modeHint?: string;
  } | null>(null);

  const startMatchmaking = useCallback((
    onComplete: () => void,
    opts?: { ranked?: boolean; modeHint?: string; totalPlayers?: number; initialFound?: number },
  ) => {
    const p = getCurrentProfile();
    const sel = partyModeFromProfile(p);
    const partyCount = getPartyCount(getPartyMemberCount());
    const total = opts?.totalPlayers ?? getMatchmakingTotalPlayers(sel);
    const initial = opts?.initialFound ?? getMatchmakingInitialFound(partyCount, total);
    matchmakingCompleteRef.current = () => {
      setMatchmakingUi(null);
      clearPartyMatchmaking();
      onComplete();
    };
    setMatchmakingUi({
      totalPlayers: total,
      initialFound: initial,
      ranked: opts?.ranked,
      modeHint: opts?.modeHint ?? (opts?.ranked ? undefined : matchmakingModeLabel(sel)),
    });
    setScreen("matchmaking");
  }, []);

  const cancelMatchmakingToMenu = useCallback(() => {
    setMatchmakingUi(null);
    clearPartyMatchmaking();
    clearPartyPlayReady();
    setScreen("menu");
  }, []);

  useEffect(() => {
    if (screen === "mapeditor" && !mapEditorMode) {
      go("mapEditorModeSelect");
    }
  }, [screen, mapEditorMode]);

  // Battle fills the whole device (full-bleed); menus render inside the 973×440
  // reference stage that scales the etalon layout onto any screen.
  useEffect(() => {
    setUiStageFullBleed(screen === "game");
  }, [screen]);

  useEffect(() => {
    if (screen === "auth" || screen === "game") return;
    setMyPresence("menu");
    setMyMenuActivity(screenToMenuActivity(screen));
  }, [screen]);

  useEffect(() => {
    tickPlayerMapMaintenance();
    ensureTechBreakTicker();
  }, []);

  useEffect(() => {
    void import("./audio/voiceLineService").then(({ preloadVoiceManifest }) => preloadVoiceManifest());
    void import("./audio/partyVoice").then(({ initPartyVoiceListener }) => initPartyVoiceListener());
  }, []);

  useEffect(() => {
    if (bootLoading) return;
    if (!getCurrentUsername()) return;
    void syncProfileWithCloud().finally(() => ensureAutoCloudSyncRunning());
  }, [bootLoading]);

  useEffect(() => subscribeTechBreakChanges(() => {
    setTechBreakActive(isTechBreakActive());
  }), []);

  useEffect(() => {
    try {
      const migrated = localStorage.getItem("ai_training_manual_control_v1");
      if (!migrated) {
        stopAiBattleTraining();
        localStorage.setItem("ai_training_manual_control_v1", "1");
        return;
      }
    } catch { /* ignore */ }
    syncAiBattleTrainingFromControl();
  }, []);

  useEffect(() => {
    if (bootLoading) return;
    // Bot battle sim + localStorage writes pause during live gameplay.
    if (screen === "game") return;
    return ensureBotLiveBattleSim();
  }, [bootLoading, screen]);

  useEffect(() => {
    const syncBg = () => setBackgroundBattleActive(hasActiveBackgroundBattle());
    syncBg();
    window.addEventListener(BACKGROUND_BATTLE_CHANGED, syncBg);
    window.addEventListener(BACKGROUND_BATTLE_FINISHED, syncBg);
    return () => {
      window.removeEventListener(BACKGROUND_BATTLE_CHANGED, syncBg);
      window.removeEventListener(BACKGROUND_BATTLE_FINISHED, syncBg);
    };
  }, []);

  const screenRef = useRef(screen);
  screenRef.current = screen;

  useEffect(() => {
    const guards: Partial<Record<Screen, TrophyFeatureId>> = {
      battleFeed: "battleFeed",
      pets: "pets",
      starFeats: "starFeats",
      clubs: "clubs",
      customization: "customization",
      clashpass: "clashpass",
      rankedMenu: "ranked",
      playerMapEditorModeSelect: "playerMapEditor",
    };
    const featureId = guards[screen];
    if (!featureId || isFeatureUnlocked(featureId)) return;
    showTrophyLockToast(translate("unlock.needTrophies", { count: getFeatureTrophyRequirement(featureId) }));
    go("menu");
  }, [screen]);

  useEffect(() => installGlobalButtonSfx(() => screenRef.current === "game" || screenRef.current === "onlineBattle" || screenRef.current === "rankedMatch"), []);
  useEffect(() => installAudioUnlock(), []);

  const syncScreenBgm = useCallback(() => {
    if (bootIntroVideo || bootLoading || transitionTo || onboardingTutorialActive) return;
    if (matchmakingUi) {
      gameMusic.crossfadeTo("matchmaking");
      return;
    }
    if (screen === "game" || screen === "onlineBattle" || screen === "rankedMatch" || screen === "randomMatch") return;
    if (MENU_BGM_SCREENS.has(screen)) {
      const cur = gameMusic.getCurrentTrack();
      if (!cur || cur === "victory" || cur === "defeat" || cur === "matchmaking" || cur === "loading" || cur === "battle" || cur === "battle-boss" || cur === "showdown") {
        gameMusic.requestTrack("menu");
      } else {
        gameMusic.ensurePlaying();
      }
    }
  }, [screen, matchmakingUi, bootIntroVideo, bootLoading, transitionTo, onboardingTutorialActive]);

  useEffect(() => {
    syncScreenBgm();
  }, [syncScreenBgm]);

  useEffect(() => {
    const onUnlock = () => syncScreenBgm();
    window.addEventListener("starfall:audio-unlocked", onUnlock);
    return () => window.removeEventListener("starfall:audio-unlocked", onUnlock);
  }, [syncScreenBgm]);

  useEffect(() => {
    if (bootLoading) return;
    const t1 = window.setTimeout(() => retryBrokenUiImages(), 200);
    const t2 = window.setTimeout(() => retryBrokenUiImages(), 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [bootLoading, screen]);

  useEffect(() => {
    const base = getHeavyAssetBaseUrl();
    const progressRef = { current: 0 };
    let lastChange = Date.now();
    const stallIv = window.setInterval(() => {
      if (Date.now() - lastChange > 8000 && progressRef.current < 1) {
        console.warn("[boot] preload stall — continuing");
        setBootProgress(1);
        window.setTimeout(() => retryBrokenUiImages(), 400);
      }
    }, 1000);
    const startDelay = window.setTimeout(() => {
      void preloadAllModels(base, (p) => {
        progressRef.current = p;
        lastChange = Date.now();
        setBootProgress(p);
      })
        .catch(() => setBootProgress(1))
        .finally(() => {
          window.clearInterval(stallIv);
          setBootProgress(1);
        });
    }, 900);
    const hardCap = window.setTimeout(() => {
      console.warn("[boot] hard cap — entering menu");
      setBootProgress(1);
      finishBootLoading();
    }, 15000);
    return () => {
      window.clearInterval(stallIv);
      window.clearTimeout(startDelay);
      window.clearTimeout(hardCap);
    };
  }, [finishBootLoading]);

  useEffect(() => {
    if (!bootLoading) return;
    const safety = window.setTimeout(finishBootLoading, 12000);
    return () => window.clearTimeout(safety);
  }, [bootLoading, finishBootLoading]);

  useEffect(() => {
    const listenerOpts: AddEventListenerOptions = { capture: true };
    const onKeyDown = async (e: KeyboardEvent) => {
      if (getControlMode() !== "pc") return;
      const shiftOne =
        e.shiftKey &&
        (e.code === "Digit1" || e.key === "!" || e.key === "1" || e.key === "№");
      if (!shiftOne) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      try {
        if (document.fullscreenElement) {
          if (typeof document.exitFullscreen === "function") await document.exitFullscreen();
        } else if (typeof document.documentElement?.requestFullscreen === "function") {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Ignore browser/sandbox fullscreen rejections.
      }
    };
    window.addEventListener("keydown", onKeyDown, listenerOpts);
    return () => window.removeEventListener("keydown", onKeyDown, listenerOpts);
  }, []);

  const go = (s: Screen) => setScreen(s);

  const openRankRewards = (id: string, back: Screen) => {
    setRankBrawlerId(id);
    setFeatureBackScreen(back);
    go("rankRewards");
  };

  const openPins = (id: string, back: Screen) => {
    setPinsBrawlerId(id);
    setFeatureBackScreen(back);
    go("pins");
  };

  /** Queue matchmaking → GameScreen with authoritative server sim (full local UI). */
  const queueServerBattle = useCallback((
    mode: GameMode,
    opts?: { brawlerOverride?: string; isPlayerMaps?: boolean; playerMapPublishId?: string; skipMatchmakingUi?: boolean },
    loadingLabel?: string,
  ) => {
    const serverModeKey = routeToServer({ mode, isPlayerMaps: opts?.isPlayerMaps });
    if (!serverModeKey) return false;
    if (opts?.brawlerOverride) setSelectedBrawler(opts.brawlerOverride);
    const pmSession = opts?.playerMapPublishId ?? (opts?.isPlayerMaps ? getPlayerMapBattleSession()?.publishId : undefined);
    setServerBattle({
      mode: serverModeKey,
      brawlerOverride: opts?.brawlerOverride,
      playerMapPublishId: pmSession,
    });
    setMyPresence("battle");
    const launch = () => goWithLoad("game", loadingLabel ?? translate("loading.arena"));
    if (opts?.skipMatchmakingUi) {
      launch();
    } else {
      startMatchmaking(launch);
    }
    return true;
  }, [startMatchmaking]);

  /** Local GameScreen only when server is off or mode is player-maps / background reattach. */
  const goLocalBattle = useCallback((mode: GameMode, label: string, opts?: { isPlayerMaps?: boolean }) => {
    if (BATTLES_ON_SERVER && isOnlineBattleConfigured() && routeToServer({ mode, isPlayerMaps: opts?.isPlayerMaps })) {
      window.alert(translate("battle.serverRequired"));
      return false;
    }
    goWithLoad("game", label);
    return true;
  }, []);

  // Animated transition with a loading screen (real asset progress for battles).
  const goWithLoad = (s: Screen, label?: string) => {
    if (s === "game" && isBattleEntryBlockedByTechBreak()) {
      return;
    }
    setTransitionLabel(label ?? translate("loading.default"));
    setTransitionTo(s);

    if (s !== "game") {
      setTransitionProgress(1);
      return;
    }

    setTransitionProgress(0);
    const base = getHeavyAssetBaseUrl();
    const mode = forceMode ?? selectedMode;
    const progressRef = { current: 0 };
    let lastChange = Date.now();
    const stallIv = window.setInterval(() => {
      if (Date.now() - lastChange > 45_000 && progressRef.current < 1) {
        console.warn("[battle] preload stall — continuing");
        setTransitionProgress(1);
      }
    }, 1000);
    void preloadBattleAssets(base, (p) => {
      progressRef.current = p;
      lastChange = Date.now();
      setTransitionProgress(p);
    }, { mode })
      .catch((err) => {
        console.error("[battle] preload failed:", err);
      })
      .finally(() => {
        window.clearInterval(stallIv);
        setTransitionProgress(1);
      });
  };

  const launchGuestOnboardingTutorial = useCallback(() => {
    setSelectedBrawler(TUTORIAL_BRAWLER_ID);
    setForceMode("training");
    setOnboardingTutorialActive(true);
    goWithLoad("game", translate("loading.tutorial"));
  }, []);

  const handleGuestAuth = useCallback(() => {
    hydrateFromProfile();
    if (guestNeedsOnboardingTutorial()) {
      launchGuestOnboardingTutorial();
      return;
    }
    go("menu");
  }, [launchGuestOnboardingTutorial]);

  // Guest who quit mid-tutorial — resume after boot (intro + welcome loading).
  useEffect(() => {
    if (bootIntroVideo || bootLoading || transitionTo || onboardingTutorialActive || showTutorialNameModal) return;
    if (!getCurrentUsername()) return;
    if (!guestNeedsOnboardingTutorial()) return;
    const p = getCurrentProfile();
    if (p?.onboardingPostBattleGuideActive) {
      const step = getPostBattleGuideStep(p);
      if (step === "open_character_menu" && screen !== "menu") go("menu");
      else if ((step === "select_hana" || step === "upgrade_hana") && screen !== "characterSelect") {
        go("characterSelect");
      }
      return;
    }
    if (p?.onboardingBattleTutorialCompleted) return;
    if (screen === "game") return;
    launchGuestOnboardingTutorial();
  }, [
    bootIntroVideo,
    bootLoading,
    transitionTo,
    onboardingTutorialActive,
    showTutorialNameModal,
    screen,
    launchGuestOnboardingTutorial,
  ]);

  const rejoinBackgroundBattle = useCallback(() => {
    const meta = getBackgroundBattleMeta();
    if (!meta) return;
    setSelectedMode(meta.mode);
    setSelectedBrawler(meta.brawlerId);
    if (meta.showdownFormat) setSelectedShowdownFormat(meta.showdownFormat);
    if (meta.starStrikeFormat) setSelectedStarStrikeFormat(meta.starStrikeFormat);
    setBossRaidBattle(meta.bossRaid ?? null);
    setSiegeBattle(meta.siege ?? null);
    setMegaSquad(meta.megaSquad ?? null);
    setReattachBackgroundBattle(true);
    goWithLoad("game", translate("loading.rejoinBattle"));
  }, []);

  function renderContent() {
  if (showTutorialNameModal) {
    return (
      <TutorialGuestNameModal
        onDone={() => {
          setShowTutorialNameModal(false);
          hydrateFromProfile();
          goWithLoad("menu", translate("loading.welcome"));
        }}
      />
    );
  }

  if (bootIntroVideo) {
    return (
      <FirstLaunchIntroVideo onFinished={() => setBootIntroVideo(false)} />
    );
  }

  if (bootLoading) {
    return (
      <LoadingScreen
        onDone={finishBootLoading}
        duration={4500}
        label={translate("loading.welcome")}
        progress={bootProgress}
      />
    );
  }

  if (!legalAccepted) {
    return (
      <LegalConsentScreen
        onAccepted={() => {
          noteUserGesture();
          setLegalAccepted(true);
          gameMusic.requestTrack("menu");
          gameMusic.ensurePlaying();
        }}
      />
    );
  }

  if (screen === "techBreakPreview") {
    return (
      <TechBreakScreen
        showDevExit
        onDevExit={() => go("menu")}
      />
    );
  }

  if (techBreakActive && !isAdminUnlocked()) {
    return <TechBreakScreen />;
  }

  if (transitionTo) {
    return (
      <LoadingScreen
        label={transitionLabel}
        duration={BATTLE_LOADING_MIN_MS}
        progress={transitionProgress}
        onDone={() => {
          const target = transitionTo;
          setTransitionTo(null);
          setTransitionProgress(0);
          if (target) go(target);
        }}
      />
    );
  }

  if (screen === "auth") {
    return <AuthPage onAuth={handleGuestAuth} />;
  }

  if (screen === "menu") {
    return (
      <>
      <MainMenu
        lobbyBossRaidBossId={lobbyBossRaidBossId}
        onPlay={() => {
          const p = getCurrentProfile();
          if (p) {
            const sel = partyModeFromProfile(p);
            const n = getPartyMemberCount();
            if (!canPlayWithParty(n, sel)) {
              return;
            }
            if (sel.mode === "ranked" && n > 1 && !checkMyPartyRankedLeague().ok) {
              return;
            }
          }
          stashPartyBattleRoster();
          clearAllPlayAgainState();
          if (isPlayerMapsModeSelected()) {
            const prof = getCurrentProfile();
            const playMode = (prof?.selectedMode as GameMode) || selectedMode;
            if (playMode !== "ranked") {
              const picked = beginPlayerMapBattle(playMode);
              if (!picked) {
                window.alert(translate("playerMaps.noMapsAvailable"));
                return;
              }
            }
          } else {
            clearPlayerMapBattleSession();
          }
          if (lobbyBossRaidBossId) {
            startMatchmaking(() => {
              hydrateFromProfile();
              if (queueServerBattle("bossraid", undefined, translate("loading.bossBattle"))) return;
              const lv = resolvePartyBossRaidLevel(lobbyBossRaidBossId);
              setBossRaidBattle({ bossId: lobbyBossRaidBossId, level: lv });
              setSiegeBattle(null);
              goLocalBattle("bossraid", translate("loading.bossBattle"));
            });
            return;
          }
          setBossRaidBattle(null);
          const { mode } = hydrateFromProfile();
          if (queueServerBattle(mode, { isPlayerMaps: isPlayerMapsModeSelected() })) return;
          if (mode === "siege") {
            setSiegeBattle({ level: resolvePartySiegeLevel() });
          } else {
            setSiegeBattle(null);
          }
          if (mode === "megashowdown") {
            go("megaSquad");
            return;
          }
          if (mode === "ranked") {
            go("rankedMatch");
            return;
          }
          if (mode === "random") {
            go("randomMatch");
            return;
          }
          startMatchmaking(() => goLocalBattle(mode, translate("loading.arena"), { isPlayerMaps: isPlayerMapsModeSelected() }));
        }}
        onRanked={() => go("rankedMenu")}
        onProStarPass={() => go("proStarPass")}
        onCollection={() => go("collection")}
        onShop={() => go("shop")}
        onCustomization={() => go("customization")}
        onSettings={() => go("settings")}
        onProfile={() => go("profile")}
        onBattleFeed={() => go("battleFeed")}
        onClashPass={() => go("clashpass")}
        onTrophyRoad={() => go("trophyroad")}
        onChests={() => go("chests")}
        onPets={() => go("pets")}
        onStarFeats={() => go("starFeats")}
        onModeSelect={() => go("modeSelect")}
        onBrawlerSelect={() => go("characterSelect")}
        onMastery={(id) => { setMasteryBrawlerId(id); go("mastery"); }}
        onOpenRankRewards={(id) => openRankRewards(id, "menu")}
        onComic={(id) => { setComicBrawlerId(id); go("comic"); }}
        onTrails={(id) => {
          if (!isFeatureUnlocked("customization")) {
            showTrophyLockToast(translate("unlock.needTrophies", { count: getFeatureTrophyRequirement("customization") }));
            return;
          }
          setTrailBrawlerId(id);
          go("brawlerTrail");
        }}
        onLogout={() => { logout(); go("auth"); }}
        onRegister={() => go("register")}
        onAccounts={() => go("accounts")}
        onMapEditor={() => go("mapEditorModeSelect")}
        onPlayerMapEditor={() => {
          if (!isFeatureUnlocked("playerMapEditor")) {
            showTrophyLockToast(translate("unlock.needTrophies", { count: getFeatureTrophyRequirement("playerMapEditor") }));
            return;
          }
          go("playerMapEditorModeSelect");
        }}
        onNews={() => go("news")}
        onMessages={() => go("messages")}
        onClubs={() => { setViewClubId(null); go("clubs"); }}
        onFriends={() => go("friends")}
        onBattleHistory={() => go("battleHistory")}
        onRecords={() => go("records")}
        onViewPlayerProfile={(id) => {
          setViewPlayerId(id);
          setProfileBackScreen("menu");
          go("playerProfile");
        }}
        onStarGuardianRewards={() => go("starGuardianRewards")}
        onSpectate={(playerId) => {
          // Prefer real server-side spectating when the target is in an online
          // battle; otherwise fall back to the legacy local feed.
          void (async () => {
            try {
              const info = await lookupOnlineSpectate(playerId);
              if (info.ok) {
                const prof = getProfileByPlayerId(playerId) as { username?: string } | null;
                setOnlineSpectate({ playerId, name: prof?.username, mode: info.mode || "gemGrab" });
                return;
              }
            } catch { /* fall through to local */ }
            setSpectateTargetId(playerId);
          })();
        }}
      />
      </>
    );
  }

  if (screen === "battleHistory") {
    return (
      <BattleHistoryPage
        onBack={() => go("menu")}
        onViewProfile={(id) => {
          setViewPlayerId(id);
          setProfileBackScreen("battleHistory");
          go("playerProfile");
        }}
      />
    );
  }

  if (screen === "records") {
    return (
      <RecordsPage
        onBack={() => go("menu")}
        onViewProfile={(id) => {
          setViewPlayerId(id);
          setProfileBackScreen("records");
          go("playerProfile");
        }}
        onViewClub={(clubId) => {
          setViewClubId(clubId);
          go("clubs");
        }}
      />
    );
  }

  if (screen === "friends") {
    return (
      <FriendsPage
        onBack={() => go("menu")}
        onViewProfile={(id) => {
          setViewPlayerId(id);
          setProfileBackScreen("friends");
          go("playerProfile");
        }}
        onGiftShop={() => go("customization")}
      />
    );
  }

  if (screen === "playerProfile" && viewPlayerId) {
    return (
      <PlayerProfilePage
        playerId={viewPlayerId}
        onBack={() => go(profileBackScreen)}
        onViewClub={(clubId) => {
          setViewClubId(clubId);
          go("clubs");
        }}
      />
    );
  }

  if (screen === "starGuardianRewards") {
    return <StarGuardianRewardsPage onBack={() => go("menu")} />;
  }

  if (screen === "playerMapEditorModeSelect") {
    return (
      <ModeSelect
        mapEditorPick={(gameMode) => {
          const editorMode = editorModeForGameMode(gameMode);
          if (!editorMode) return;
          setMapEditorMode(editorMode);
          go("playerMapEditor");
        }}
        onSelect={() => {}}
        selectedShowdownFormat={selectedShowdownFormat}
        selectedStarStrikeFormat={selectedStarStrikeFormat}
        onBack={() => go("menu")}
        playerMapEditorPick
      />
    );
  }

  if (screen === "playerMapEditor") {
    if (!mapEditorMode) return null;
    return (
      <MapEditorPage
        variant="player"
        initialMode={mapEditorMode}
        onBack={() => {
          setMapEditorMode(null);
          go("playerMapEditorModeSelect");
        }}
      />
    );
  }

  if (screen === "mapEditorModeSelect") {
    return (
      <ModeSelect
        mapEditorPick={(gameMode) => {
          const editorMode = editorModeForGameMode(gameMode);
          if (!editorMode) return;
          setMapEditorMode(editorMode);
          go("mapeditor");
        }}
        onSelect={() => {}}
        selectedShowdownFormat={selectedShowdownFormat}
        selectedStarStrikeFormat={selectedStarStrikeFormat}
        onBack={() => go("menu")}
      />
    );
  }

  if (screen === "mapeditor") {
    if (!mapEditorMode) return null;
    return (
      <MapEditorPage
        initialMode={mapEditorMode}
        onBack={() => {
          setMapEditorMode(null);
          go("mapEditorModeSelect");
        }}
      />
    );
  }

  if (screen === "news") {
    return <NewsPage onBack={() => go("menu")} />;
  }

  if (screen === "messages") {
    return <MessagesPage onBack={() => go("menu")} />;
  }

  if (screen === "clubs") {
    return (
      <ClubsPage
        onBack={() => { setViewClubId(null); go("menu"); }}
        viewClubId={viewClubId}
        onGoToMainMenu={(bossId) => {
          setSelectedMode("bossraid");
          persistMode("bossraid");
          setLobbyBossRaidBossId(bossId);
          go("menu");
        }}
      />
    );
  }

  if (screen === "matchmaking" && matchmakingUi) {
    return (
      <MatchmakingScreen
        totalPlayers={matchmakingUi.totalPlayers}
        initialFound={matchmakingUi.initialFound}
        ranked={matchmakingUi.ranked}
        modeHint={matchmakingUi.modeHint}
        onComplete={() => matchmakingCompleteRef.current()}
        onCancel={cancelMatchmakingToMenu}
      />
    );
  }

  if (screen === "megaSquad") {
    return (
      <MegaSquadPickerPage
        onConfirm={(ids, levels) => {
          setMegaSquad({ ids, levels });
          startMatchmaking(() => {
            if (queueServerBattle("megashowdown", undefined, translate("loading.squad"))) return;
            goLocalBattle("megashowdown", translate("loading.squad"));
          });
        }}
        onBack={() => go("menu")}
      />
    );
  }

  if (screen === "modeSelect") {
    return (
      <ModeSelect
        selectedMode={selectedMode}
        onSelect={(mode, showdownFormat, starStrikeFormat) => {
          setLobbyBossRaidBossId(null);
          setSelectedMode(mode);
          persistMode(mode);
          if (showdownFormat) {
            setSelectedShowdownFormat(showdownFormat);
            persistShowdownFormat(showdownFormat);
          }
          if (starStrikeFormat) {
            setSelectedStarStrikeFormat(starStrikeFormat);
            persistStarStrikeFormat(starStrikeFormat);
          }
          go("menu");
        }}
        selectedShowdownFormat={selectedShowdownFormat}
        selectedStarStrikeFormat={selectedStarStrikeFormat}
        onBack={() => go("menu")}
        onClashPass={() => go("clashpass")}
        onBossRaidLobbyPick={(bossId) => {
          setLobbyBossRaidBossId(bossId);
          setSelectedMode("bossraid");
          persistMode("bossraid");
          go("menu");
        }}
      />
    );
  }

  if (screen === "characterSelect") {
    return (
      <CharacterSelect
        onPickAsActive={(id) => {
          // persistBrawler is gated on unlocked status; if it fails, keep the
          // currently active brawler as the menu selection.
          const r = persistBrawler(id);
          if (r.success) {
            setSelectedBrawler(id);
            go("menu");
          }
        }}
        onOpenComic={(id) => { setComicBrawlerId(id); go("comic"); }}
        onOpenTrails={(id) => { setTrailBrawlerId(id); go("brawlerTrail"); }}
        onOpenMastery={(id) => { setMasteryBrawlerId(id); go("mastery"); }}
        onOpenRankModal={(id) => openRankRewards(id, "characterSelect")}
        onOpenPins={(id) => openPins(id, "characterSelect")}
        onTraining={(id) => {
          // Training is a purely local practice arena (its own map with training
          // dummies/monsters) — no matchmaking, no server, no intro. Launch it
          // straight into GameScreen like the tutorial does. The chosen brawler
          // is a transient override so any brawler can be tried without
          // persisting it as the active pick or touching the lobby mode.
          setSelectedBrawler(id);
          setServerBattle(null);
          // Clear any leftover ranked/boss battle so `activeMode` resolves to
          // "training" (otherwise the training map/exit button never appear).
          setRankedBattleMode(null);
          setBossRaidBattle(null);
          setForceMode("training");
          goWithLoad("game", translate("loading.training"));
        }}
        onBack={() => go("menu")}
      />
    );
  }

  if (screen === "profile") {
    return (
      <ProfilePage
        onBack={() => go("menu")}
        onViewClub={(clubId) => {
          setViewClubId(clubId);
          go("clubs");
        }}
      />
    );
  }
  if (screen === "clashpass") {
    return <ClashPassPage onBack={() => go("menu")} />;
  }
  if (screen === "trophyroad") {
    return <TrophyRoadPage onBack={() => go("menu")} />;
  }

  if (screen === "rankedMenu") {
    return (
      <RankedMenuPage
        onBack={() => go("menu")}
        onProStarPass={() => go("proStarPass")}
        onGoToLobby={() => {
          setSelectedMode("ranked");
          persistMode("ranked");
          go("menu");
        }}
      />
    );
  }

  if (screen === "proStarPass") {
    return (
      <PageErrorBoundary name="proStarPass">
        <ProStarPassPage onBack={() => go("rankedMenu")} />
      </PageErrorBoundary>
    );
  }

  if (screen === "rankedMatch") {
    return (
      <RankedMatchFlowPage
        onBack={() => go("rankedMenu")}
        onStartBattle={(mode, brawlerId, _pet) => {
          setRankedBattleMode(mode);
          setSelectedBrawler(brawlerId);
          persistBrawler(brawlerId);
          if (queueServerBattle(mode, { brawlerOverride: brawlerId, skipMatchmakingUi: true }, translate("loading.ranked"))) return;
          goLocalBattle(mode, translate("loading.ranked"));
        }}
      />
    );
  }

  if (screen === "randomMatch") {
    return (
      <RandomMatchFlowPage
        onBack={() => go("menu")}
        onStartBattle={(mode, brawlerId, _mapId) => {
          setRankedBattleMode(mode);
          setSelectedBrawler(brawlerId);
          persistBrawler(brawlerId);
          if (mode === "megashowdown") {
            const ids = pickRandomMegaSquad(brawlerId);
            const profile = getCurrentProfile();
            const levels: Record<string, number> = {};
            for (const id of ids) levels[id] = profile?.brawlerLevels[id] ?? 1;
            setMegaSquad({ ids, levels });
          }
          if (mode === "siege") {
            setSiegeBattle({ level: resolvePartySiegeLevel() });
          }
          if (queueServerBattle(mode, { brawlerOverride: brawlerId, skipMatchmakingUi: true }, translate("loading.arena"))) return;
          goLocalBattle(mode, translate("loading.arena"));
        }}
      />
    );
  }

  if (screen === "chests") {
    return <ChestsPage onBack={() => go("menu")} />;
  }
  if (screen === "pets") {
    return <PetsPage onBack={() => go("menu")} />;
  }

  if (screen === "game") {
    const activeMode: GameMode = bossRaidBattle
      ? "bossraid"
      : (rankedBattleMode ?? forceMode ?? selectedMode);
    return (
      <GameScreen
        mode={activeMode}
        showdownFormat={selectedShowdownFormat}
        starStrikeFormat={rankedBattleMode ? "3v3" : selectedStarStrikeFormat}
        brawlerId={selectedBrawler}
        megaSquad={activeMode === "megashowdown" ? megaSquad : null}
        bossRaid={bossRaidBattle}
        siege={siegeBattle}
        serverMode={serverBattle?.mode}
        serverBrawlerOverride={serverBattle?.brawlerOverride}
        serverPlayerMapPublishId={serverBattle?.playerMapPublishId}
        tutorialMode={onboardingTutorialActive}
        onTutorialComplete={() => {
          setOnboardingTutorialActive(false);
          setForceMode(null);
          startPostBattleGuide();
          setServerBattle(null);
          setScreen("menu");
        }}
        onTutorialSkipLogin={() => {
          setOnboardingTutorialActive(false);
          setForceMode(null);
          abandonTutorialSession();
          setServerBattle(null);
          setMyPresence("menu");
          go("auth");
        }}
        reattachFromBackground={reattachBackgroundBattle}
        onReattachStarted={() => setReattachBackgroundBattle(false)}
        onAfkKicked={() => {
          setServerBattle(null);
          setMyPresence("menu");
          goWithLoad("menu", translate("loading.lobbyReturn"));
        }}
        onExit={() => {
          setServerBattle(null);
          clearAllPlayAgainState();
          setForceMode(null);
          setRankedBattleMode(null);
          clearRankedBattleSession();
          clearRandomBattleSession();
          clearPlayerMapBattleSession();
          clearMapSourceCategory();
          setMegaSquad(null);
          setBossRaidBattle(null);
          setSiegeBattle(null);
          setMyPresence("menu");
          goWithLoad("menu", translate("loading.lobbyReturn"));
        }}
        onResultPlayAgain={(won) => {
          const partyRematch = readPartyBattleRoster().length > 1;
          if (rankedBattleMode !== null && !partyRematch) {
            clearRankedBattleSession();
            clearRandomBattleSession();
          clearPlayerMapBattleSession();
          clearMapSourceCategory();
            setRankedBattleMode(null);
            go("menu");
            return;
          }
          if (activeMode === "megashowdown" && !partyRematch) {
            setMegaSquad(null);
            go("megaSquad");
            return;
          }
          const launchRematch = () => {
            const rematchMode = rankedBattleMode ?? activeMode;
            if (queueServerBattle(rematchMode, { brawlerOverride: selectedBrawler })) return;
            if (activeMode === "bossraid" && bossRaidBattle && !partyRematch) {
              if (won && bossRaidBattle.level < BOSS_RAID_MAX_LEVEL) {
                setBossRaidBattle({ ...bossRaidBattle, level: bossRaidBattle.level + 1 });
                goLocalBattle("bossraid", translate("loading.nextLevel"));
                return;
              }
              goLocalBattle(activeMode, translate("loading.restart"));
              return;
            }
            if (!partyRematch) stashPartyBattleRoster();
            goLocalBattle(activeMode, partyRematch ? translate("loading.rematch") : translate("loading.restart"));
          };
          startMatchmaking(launchRematch);
        }}
      />
    );
  }

  if (screen === "collection") {
    return <CollectionPage onBack={() => go("menu")} />;
  }

  if (screen === "shop") {
    return (
      <ShopPage
        onBack={() => go("menu")}
        onOpenStarGuardianRewards={() => go("starGuardianRewards")}
      />
    );
  }

  if (screen === "customization") {
    return (
      <CustomizationPage
        initialTab={customizationTab}
        onBack={() => go("menu")}
      />
    );
  }

  if (screen === "settings") {
    return (
      <SettingsPage
        onBack={() => go("menu")}
        onSwitchProfile={() => go("accounts")}
        onOpenAccount={() => go("accountDetail")}
        onRegister={() => go("register")}
      />
    );
  }

  if (screen === "register") {
    return (
      <RegisterPage
        onBack={() => go("menu")}
        onDone={() => { hydrateFromProfile(); go("menu"); }}
      />
    );
  }

  if (screen === "accounts") {
    return (
      <AccountsPage
        onBack={() => go("menu")}
        onOpenAccount={() => go("accountDetail")}
        onRegister={() => go("register")}
        onAuth={() => { logout(); go("auth"); }}
      />
    );
  }

  if (screen === "accountDetail") {
    return (
      <AccountDetailPage
        onBack={() => go("accounts")}
        onDeleted={() => {
          if (getCurrentUsername()) go("menu");
          else go("auth");
        }}
        onLogout={() => { logout(); go("auth"); }}
        onOpenAppSettings={() => go("settings")}
        onSwitchAccounts={() => go("accounts")}
        onRegister={() => go("register")}
      />
    );
  }

  if (screen === "battleFeed") {
    return (
      <BattleFeedPage
        onBack={() => go("menu")}
        onViewProfile={(id) => {
          setViewPlayerId(id);
          setProfileBackScreen("battleFeed");
          go("playerProfile");
        }}
      />
    );
  }

  if (screen === "mastery") {
    return (
      <BrawlerMasteryPage
        brawlerId={masteryBrawlerId}
        onBack={() => go("menu")}
      />
    );
  }

  if (screen === "rankRewards") {
    return (
      <BrawlerRankRewardsModal
        brawlerId={rankBrawlerId}
        onClose={() => go(featureBackScreen)}
        layout="page"
      />
    );
  }

  if (screen === "pins") {
    return (
      <PinSelectModal
        brawlerId={pinsBrawlerId}
        onClose={() => go(featureBackScreen)}
        layout="page"
      />
    );
  }

  if (screen === "comic") {
    return (
      <BrawlerComicPage
        brawlerId={comicBrawlerId}
        onBack={() => go("menu")}
      />
    );
  }

  if (screen === "brawlerTrail") {
    return (
      <BrawlerTrailPage
        brawlerId={trailBrawlerId}
        onBack={() => go("menu")}
        onOpenShop={() => {
          setCustomizationTab("trails");
          go("customization");
        }}
      />
    );
  }

  if (screen === "starFeats") {
    return <StarFeatsPage onBack={() => go("menu")} />;
  }

  return null;
  }

  const content = renderContent();
  const isGame = screen === "game";
  const menuStacked = MENU_STACKED_SCREENS.has(screen);

  return (
    <PlatformLayoutProvider>
      {menuStacked ? (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
        }}>
          {content}
        </div>
      ) : isGame ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 0, width: "100vw", height: "100dvh", overflow: "hidden" }}>
          {content}
        </div>
      ) : (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          width: "100%",
          height: "100%",
          background: "#0a0028",
        }}>
          <div style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}>
            {content}
          </div>
          {screen === "menu" && backgroundBattleActive && (
            <BackgroundBattleRejoinBanner onRejoin={rejoinBackgroundBattle} />
          )}
        </div>
      )}
      <RotateDeviceOverlay />
      <TrophyLockToastHost />
      <UnlockGuideOverlay
        screen={screen}
        customizationTab={customizationTab}
        onRequestCustomizationTab={(tabId) => {
          const tab = tabId as typeof customizationTab;
          setCustomizationTab(tab);
        }}
      />
      <TutorialPostBattleOverlay
        screen={screen}
        onComplete={() => setShowTutorialNameModal(true)}
      />
      {spectateTargetId && (
        <LiveBattleSpectator
          targetPlayerId={spectateTargetId}
          onClose={() => setSpectateTargetId(null)}
          onExitToMenu={() => {
            setSpectateTargetId(null);
            go("menu");
          }}
        />
      )}
      {onlineSpectate && (
        <OnlineBattle
          spectatePlayerId={onlineSpectate.playerId}
          spectateName={onlineSpectate.name}
          mode={onlineSpectate.mode}
          onExit={() => setOnlineSpectate(null)}
        />
      )}
    </PlatformLayoutProvider>
  );
}
