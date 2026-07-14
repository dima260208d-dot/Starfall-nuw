import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ClashShowdown } from "../modes/ClashShowdown";
import { ClashCrystals } from "../modes/ClashCrystals";
import { ClashHeist } from "../modes/ClashHeist";
import { ClashGemGrab } from "../modes/ClashGemGrab";
import { ClashSiege } from "../modes/ClashSiege";
import { ClashTraining } from "../modes/ClashTraining";
import { ClashMega } from "../modes/ClashMega";
import { ClashStarStrike } from "../modes/ClashStarStrike";
import { ClashBossRaid } from "../modes/ClashBossRaid";
import { ClashBounty } from "../modes/ClashBounty";
import { ClashMonsterHide } from "../modes/ClashMonsterHide";
import { ClashMonsterInvasion } from "../modes/ClashMonsterInvasion";
import { ClashTeamHunt } from "../modes/ClashTeamHunt";
import { getCurrentProfile, getQuestPool, getBrawlerStars, getBattleHistory } from "../utils/localStorageAPI";
import { getCustomizationAssetBaseUrl } from "../lib/assetBase";
import { getPlayerTreasuryBattleBonuses } from "../utils/clubTreasury";
import { BattleStageShell, useEffectiveControlScheme, usePlatformLayout } from "../platform";
import { setMyPresence, setMyBattlePresence, clearMyBattlePresence } from "../utils/social/presence";
import { getMatchStats, normalizeMatchStats } from "../utils/matchStats";
import { loadSpriteSheet, loadBrawlerImages } from "../game/sprites";
import { isBattleAssetsReady } from "../utils/battleAssetPreloader";
import { loadPowerModels, loadSafeGLBTemplate } from "../utils/powerModelCache";
import { preloadCharRenderers } from "../game/miyaTopDownRenderer";
import { setGameRenderDt } from "../game/frameClock";
import { clearEffects } from "../utils/effects";
import { resetShowdownSmokeParticles } from "../utils/showdownSmokeParticles";
import { BRAWLERS, getBrawlerById } from "../entities/BrawlerData";
import { getPetById } from "../entities/PetData";
import MobileControls from "../components/MobileControls";
import TrainingGestureEditor, { type GestureEditTarget } from "../components/TrainingGestureEditor";
import { loadGestureLayout, type GestureControlLayout } from "../utils/gestureLayout";
import { cycleOliverMemory } from "../utils/oliverMechanics";
import BattleSurvivorHud from "../components/BattleSurvivorHud";
import MegaSquadHud from "../components/MegaSquadHud";
import BattlePinHud from "../components/BattlePinHud";
import ShowdownStandoffOverlay from "../components/battle/ShowdownStandoffOverlay";
import GasCountdown10Overlay from "../components/battle/GasCountdown10Overlay";
import { gameMusic } from "../audio/gameMusicService";
import {
  startCountdown10OverlaySfx,
  stopCountdown10OverlaySfx,
} from "../audio/gameSfxService";
import AstralBattleTip from "../components/AstralBattleTip";
import KillFeedHud from "../components/KillFeedHud";
import ModeFirstPlayHintBanner from "../components/progression/ModeFirstPlayHintBanner";
import BattleIntroOverlay from "../components/battleIntro/BattleIntroOverlay";
import { disposeIntroSharedRenderer } from "../components/battleIntro/IntroSharedBrawler3D";
import { enrichIntroParticipants, type BattleIntroParticipant } from "../utils/battleIntro/battleIntroParticipants";
import { buildIntroCameraPath } from "../utils/battleIntro/battleIntroCamera";
import { preloadIntroBrawlerModels } from "../utils/battleIntro/battleIntroPreload";
import { resetKillFeedBus, setKillFeedPlayerTeam } from "../utils/killFeed";
import { AstralAutoplay, buildBattleSnapshot } from "../ai/AstralAutoplay";
import { recordHumanMatchEnd } from "../ai/aiCombatLearning";
import {
  beginPlayerObservation,
  endPlayerObservation,
  observePlayerBattleFrame,
  trackPlayerStuck,
} from "../ai/aiPlayerObserver";
import { gasSafeRadius, playerGasEdgeMargin } from "../ai/aiGas";
import { isStarGuardianActive, getAstralSettings } from "../utils/subscription";
import type { GameParticipant } from "../types/gameResult";
import type { GameMode, ShowdownFormat, StarStrikeFormat } from "../App";
import { applyPartySharedBossRaidVictory, type GrantBossRaidRewardResult } from "../utils/bossRaidRewards";
import { applyPartySharedSiegeVictory } from "../utils/siegeProgress";
import { BOSS_RAID_MAX_LEVEL } from "../utils/bossRaidProgress";
import { isAdminUnlocked } from "../utils/mapEditorAPI";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";
import { EmojiIcon } from "../components/EmojiIcon";
import { inputUsesManualAttackAim } from "../utils/battleAttackAim";
import TutorialBattleOverlay from "../components/tutorial/TutorialBattleOverlay";
import {
  createEmptyTutorialSignals,
  type TutorialSignals,
} from "../utils/tutorial/onboardingTutorial";
import { resetDevBattlePause, toggleDevBattlePauseFromCaps, isDevBattleWorldFrozen } from "../game/battleDevPause";
import { BattleAfkController, setBattleAfkController } from "../game/battleAfk";
import BattleAfkWarning from "../components/BattleAfkWarning";
import {
  detachBattleToBackground,
  consumeBackgroundBattleSession,
  hasActiveBackgroundBattle,
  stopBackgroundBattleLoop,
  type BackgroundBattleSessionMeta,
} from "../game/backgroundBattleSession";
import {
  setBattle3DCanvas,
  initBattle3DForBattle,
  isBattle3DActive,
  beginBattle3DSession,
  enableBattle3D,
  disposeBattle3D,
  tickAndRenderBattle3D,
  reloadBattle3DMap,
  resolveBattleTileGrid,
} from "../game/battle3DWorld";
import type { Battle3DSafe } from "../game/battle3DSafes";
import type { Brawler } from "../entities/Brawler";
import {
  amIPlayAgainReady,
  clearBattlePlayAgainState,
  clearAllPlayAgainState,
  getBattleTeamPlayAgainPanelMembers,
  getPlayAgainSecondsLeft,
  getPlayAgainState,
  isBattleTeamPlayAgainEligible,
  isPlayAgainTimerRunning,
  playAgainOnResultExit,
  pressBattlePlayAgain,
  shouldExitAfterBattlePlayAgain,
  shouldRematchBattlePlayAgain,
  stashBattlePlayAgainRematchRoster,
  stashBattleTeamRosterFromParticipants,
  tickBattlePlayAgainExpired,
} from "../utils/social/battleTeamPlayAgain";
import {
  getPlayerMapBattleSession,
  markPlayerMapVote,
} from "../utils/playerMaps/playerMapSession";
import { dislikePublishedMap } from "../utils/playerMaps/playerMapRegistry";
import { processPlayerMapLike } from "../utils/playerMaps/playerMapRewards";
import { PARTY_CHANGED_EVENT } from "../utils/social/party";
import { clearPartyBattleRoster, stashPartyBattleRoster } from "../utils/social/partyBattle";
import {
  startBattleReplayRecording,
  tickBattleReplayRecording,
  finishBattleReplayRecording,
  finishLiveBattleRecording,
  cancelBattleReplayRecording,
  getCurrentLiveBattleSessionId,
} from "../utils/battleReplayRecorder";
import { enrichLatestBattleRecord, extractBattleScore, buildBattleHistoryParticipants } from "../utils/battleHistoryEnrich";
import { ServerBattleBridge, type ServerBattleEndInfo } from "../game/serverBattleBridge";
import { showTrophyLockToast } from "../utils/progression/trophyLockToast";
import { applyServerMapToGame } from "../utils/net/netMapToTileGrid";
import { parsePinId } from "../entities/PinData";
import { playPinVoice, handleBattleVoiceMsg, warmBrawlerVoices } from "../audio/voiceLineService";
import { BattleVoiceTracker } from "../audio/battleVoiceTracker";
import { serializeGameSnapshot } from "../server/serializeGameSnapshot";
import type { NetSnapshot } from "../net/battleTypes";
import { getMyClub, shareBattleToClub } from "../utils/clubs";
import ResultScreen from "../components/ResultScreen";
import { applyForcedDevBattleExit } from "../utils/forcedBattleExit";
import { editorModeForGameMode, getActiveMap, mapSaveToServerBattlePayload } from "../utils/mapSchedule";
import { computeBattleMapHash } from "../utils/net/battleMapSync";

interface GameScreenProps {
  mode: GameMode;
  showdownFormat?: ShowdownFormat;
  starStrikeFormat?: StarStrikeFormat;
  brawlerId: string;
  megaSquad?: { ids: string[]; levels: number[] } | null;
  bossRaid?: { bossId: string; level: number } | null;
  siege?: { level: number } | null;
  onExit: () => void;
  onResultPlayAgain: (won: boolean) => void;
  /** Вернуться в бой, который продолжился в фоне после AFK-кика. */
  reattachFromBackground?: boolean;
  onReattachStarted?: () => void;
  /** Игрока выкинуло за AFK — бой уходит в фон, UI → меню. */
  onAfkKicked?: () => void;
  /** Server-authoritative mode key (gemGrab, showdown, …). Keeps full local 3D/HUD. */
  serverMode?: string;
  serverBrawlerOverride?: string;
  serverPlayerMapPublishId?: string;
  /** First-launch onboarding — Astral guides through training controls. */
  tutorialMode?: boolean;
  onTutorialComplete?: () => void;
  onTutorialSkipLogin?: () => void;
}

type AnyGame = ClashShowdown | ClashCrystals | ClashHeist | ClashGemGrab | ClashSiege | ClashTraining | ClashMega | ClashStarStrike | ClashBossRaid | ClashBounty | ClashMonsterHide | ClashMonsterInvasion | ClashTeamHunt;
type QuestDelta = { description: string; before: number; after: number; target: number; delta: number };

/** Собрать всех бойцов, которых нужно отрендерить в 3D-сцене боя. */
function collectBattleBrawlers(game: AnyGame): Brawler[] {
  const out: Brawler[] = [];
  const seen = new Set<string>();
  const g: any = game;

  const add = (b: unknown) => {
    if (!b || typeof b !== "object") return;
    const br = b as Brawler;
    if (!br.id || seen.has(br.id)) return;
    seen.add(br.id);
    out.push(br);
  };

  add(g.player);
  if (Array.isArray(g.allies)) for (const b of g.allies) add(b);
  if (Array.isArray(g.enemies)) for (const b of g.enemies) add(b);
  if (Array.isArray(g.bots)) for (const b of g.bots) add(b);
  add(g.boss);

  return out;
}

export default function GameScreen({ mode, showdownFormat = "solo", starStrikeFormat = "3v3", brawlerId, megaSquad, bossRaid = null, siege = null, onExit, onResultPlayAgain, reattachFromBackground = false, onReattachStarted, onAfkKicked, serverMode, serverBrawlerOverride, serverPlayerMapPublishId, tutorialMode = false, onTutorialComplete, onTutorialSkipLogin }: GameScreenProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas3DRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AnyGame | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [spriteLoaded, setSpriteLoaded] = useState(false);
  const spriteLoadedRef = useRef(false);
  const [result, setResult] = useState<{
    place: number;
    trophyDelta: number;
    xpGained: number;
    winStreak?: number;
    winStreakBonus?: number;
    masteryXpGained?: number;
    masteryLeaderBonus?: number;
    monsterKillTrophyBonus?: number;
  } | null>(null);
  const [participants, setParticipants] = useState<GameParticipant[]>([]);
  const [matchStatsData, setMatchStatsData] = useState(normalizeMatchStats());
  const [questDeltas, setQuestDeltas] = useState<QuestDelta[]>([]);
  const { width, shortSide } = usePlatformLayout();
  const mobileControlScheme = useEffectiveControlScheme();
  const controlMode = "mobile" as const;
  const autoplayRef = useRef<AstralAutoplay | null>(null);
  const tutorialSignalsRef = useRef<TutorialSignals>(createEmptyTutorialSignals());
  const getTutorialSignals = useCallback(() => tutorialSignalsRef.current, []);
  const [autoplayOn, setAutoplayOn] = useState(false);
  const [gestureEditorOpen, setGestureEditorOpen] = useState(false);
  const [gestureEditTarget, setGestureEditTarget] = useState<GestureEditTarget | null>(null);
  const [gestureLayout, setGestureLayout] = useState<GestureControlLayout>(() => loadGestureLayout());
  const autoplayOnRef = useRef(false);
  const battleStartRef = useRef<number>(0);
  const playerStuckRef = useRef({ x: 0, y: 0, stillSec: 0, wasStuckHeavy: false });
  const afkRef = useRef<BattleAfkController | null>(null);
  const [afkWarning, setAfkWarning] = useState({ visible: false, secondsLeft: 0 });
  const afkWarnKeyRef = useRef("");
  const detachingToBackgroundRef = useRef(false);
  const gameOverAtRef = useRef<number | null>(null);
  const gameOverHandledRef = useRef(false);
  const gameOverStateRef = useRef(false);
  const partyRematchResolvedRef = useRef(false);
  const [partyPlayAgainTick, setPartyPlayAgainTick] = useState(0);
  const [bossRaidGrant, setBossRaidGrant] = useState<GrantBossRaidRewardResult | null>(null);
  const [replayId, setReplayId] = useState<string | null>(null);
  const [battleShared, setBattleShared] = useState(false);
  const [introActive, setIntroActive] = useState(true);
  const [serverMapApplied, setServerMapApplied] = useState(false);
  const [tutorialBannerHeight, setTutorialBannerHeight] = useState(118);
  const introActiveRef = useRef(true);
  const showdownMusicRef = useRef(false);
  const [showdownStandoffVisible, setShowdownStandoffVisible] = useState(false);
  const [gasCountdownSec, setGasCountdownSec] = useState<number | null>(null);
  const introCamRef = useRef<{ x: number; y: number } | null>(null);
  const introDtZeroedRef = useRef(false);
  const startBattle3DRef = useRef<(() => void) | null>(null);
  const boot3dPromiseRef = useRef<Promise<void> | null>(null);
  const boot3dInitStartedRef = useRef(false);
  const pendingBattle3DInitRef = useRef<Parameters<typeof initBattle3DForBattle>[0] | null>(null);
  /** Server map bytes applied — battle ready only after intro + this. */
  const serverMapReadyRef = useRef(false);
  const [introParticipants, setIntroParticipants] = useState<BattleIntroParticipant[]>([]);
  const [introMeta, setIntroMeta] = useState<{
    playerX: number;
    playerY: number;
    camW: number;
    camH: number;
    mapW: number;
    mapH: number;
    playerTeam: string;
  } | null>(null);
  const [astralAvailable, setAstralAvailable] = useState(
    () => isStarGuardianActive() && getAstralSettings().enabled && mode !== "training" && mode !== "bossraid",
  );

  useEffect(() => {
    const refreshAstral = () => {
      setAstralAvailable(
        isStarGuardianActive() && getAstralSettings().enabled && mode !== "training" && mode !== "bossraid",
      );
    };
    refreshAstral();
    const id = window.setInterval(refreshAstral, 1500);
    return () => window.clearInterval(id);
  }, [mode]);
  const buildLocalVoiceCtx = useCallback((game: Record<string, unknown>) => {
    const player = game.player as Brawler | undefined;
    const cam = game.camera as { x: number; y: number; width?: number; height?: number } | undefined;
    const youId = player?.id ?? null;
    const yourTeam = player?.team === "red" ? "red" : "blue";
    const camera = cam
      ? { x: cam.x, y: cam.y, width: cam.width ?? 1200, height: cam.height ?? 800 }
      : null;
    const play = (msg: Parameters<typeof handleBattleVoiceMsg>[0]) => {
      handleBattleVoiceMsg(msg, { youId, yourTeam, camera });
    };
    return {
      youId,
      roomSeed: 0,
      sendVoice: () => {},
      playBotVoice: play,
      playLocalVoice: play,
    };
  }, []);

  const enableLocalBattleVoice = useCallback(() => {
    localVoiceEnabledRef.current = true;
    const g = gameRef.current as unknown as Record<string, unknown> | null;
    localVoiceRef.current.enableBattleVoice(
      localVoicePrevRef.current,
      buildLocalVoiceCtx(g ?? {}),
    );
  }, [buildLocalVoiceCtx]);

  // Snapshot quests before each battle starts so result deltas are reliable.
  const preQuestSnapshot = useRef<Array<{ id: string; progress: number }>>([]);
  const serverBridgeRef = useRef<ServerBattleBridge | null>(null);
  const serverLocalFallbackRef = useRef(false);
  const localVoiceRef = useRef(new BattleVoiceTracker());
  const localVoicePrevRef = useRef<NetSnapshot | null>(null);
  const localVoiceEnabledRef = useRef(false);
  const localVoiceTickRef = useRef(0);
  const onExitRef = useRef(onExit);
  const onAfkKickedRef = useRef(onAfkKicked);
  const onReattachStartedRef = useRef(onReattachStarted);
  onExitRef.current = onExit;
  onAfkKickedRef.current = onAfkKicked;
  onReattachStartedRef.current = onReattachStarted;
  const serverEndRef = useRef<ServerBattleEndInfo | null>(null);

  const computeQuestDeltas = (): QuestDelta[] => {
    const pool = getQuestPool();
    if (!pool) return [];
    const snapMap = new Map(preQuestSnapshot.current.map(q => [q.id, q.progress]));
    return pool.activeQuests
      .filter(q => !q.claimed)
      .map(q => {
        const before = snapMap.get(q.id);
        if (before === undefined) return null;
        const delta = q.progress - before;
        if (delta <= 0) return null;
        return {
          description: q.description,
          before,
          after: q.progress,
          target: q.target,
          delta,
        };
      })
      .filter((x): x is QuestDelta => x !== null)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 6);
  };

  useEffect(() => {
    if (gameOver && participants.length > 0) {
      stashBattleTeamRosterFromParticipants(participants);
      setPartyPlayAgainTick(t => t + 1);
    }
  }, [gameOver, participants]);

  useEffect(() => {
    partyRematchResolvedRef.current = false;
    stashPartyBattleRoster();
  }, [mode, brawlerId, showdownFormat, starStrikeFormat, bossRaid?.bossId, bossRaid?.level]);

  useEffect(() => {
    let mounted = true;
    if (isBattleAssetsReady()) {
      setSpriteLoaded(true);
      return () => { mounted = false; };
    }
    const base = getCustomizationAssetBaseUrl((import.meta as any).env?.BASE_URL ?? "/");
    Promise.all([
      loadSpriteSheet(`${base}characters.webp`),
      loadBrawlerImages(BRAWLERS.map(b => b.id), base),
      preloadCharRenderers(base),
    ]).then(() => {
      if (mounted) setSpriteLoaded(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    spriteLoadedRef.current = spriteLoaded;
    const g = gameRef.current as { spriteLoaded?: boolean } | null;
    if (g) g.spriteLoaded = spriteLoaded;
  }, [spriteLoaded]);

  useEffect(() => {
    autoplayOnRef.current = autoplayOn;
  }, [autoplayOn]);

  useEffect(() => {
    gameOverStateRef.current = gameOver;
  }, [gameOver]);

  useEffect(() => {
    const sessionId = getCurrentLiveBattleSessionId();
    if (sessionId) setMyBattlePresence(mode, sessionId);
    else setMyPresence("battle");
    return () => clearMyBattlePresence();
  }, [mode]);

  useEffect(() => {
    if (gameOver && result) setMyPresence("results");
  }, [gameOver, result]);

  useEffect(() => {
    if (gameOver) return;
    if (showdownMusicRef.current) return;
    const track = mode === "bossraid" || bossRaid ? "battle-boss" : "battle";
    gameMusic.crossfadeTo(track);
  }, [gameOver, mode, bossRaid]);

  useEffect(() => {
    if (!gameOver) return;
    gameMusic.crossfadeTo(won ? "victory" : "defeat");
  }, [gameOver, won]);

  useEffect(() => {
    if (mode !== "showdown") return;
    const onStandoff = () => {
      showdownMusicRef.current = true;
      setShowdownStandoffVisible(true);
      gameMusic.hardSwitchTo("showdown");
      window.setTimeout(() => setShowdownStandoffVisible(false), 1700);
    };
    window.addEventListener("game:showdown-standoff", onStandoff);
    return () => window.removeEventListener("game:showdown-standoff", onStandoff);
  }, [mode]);

  useEffect(() => {
    const onGas = (e: Event) => {
      const sec = (e as CustomEvent<{ seconds: number }>).detail.seconds;
      setGasCountdownSec(sec);
      if (sec === 10) startCountdown10OverlaySfx();
      if (sec <= 0) stopCountdown10OverlaySfx();
    };
    window.addEventListener("game:gas-countdown", onGas);
    return () => {
      window.removeEventListener("game:gas-countdown", onGas);
      stopCountdown10OverlaySfx();
    };
  }, []);

  useEffect(() => {
    if (!gameOver) {
      setReplayId(null);
      setBattleShared(false);
      return;
    }
    const syncReplay = () => {
      const id = getBattleHistory()[0]?.replayId;
      if (id) setReplayId(prev => prev ?? id);
    };
    syncReplay();
    const timer = window.setInterval(syncReplay, 250);
    return () => window.clearInterval(timer);
  }, [gameOver]);

  const handleShareBattle = (): { success: boolean; error?: string } => {
    const id = replayId ?? getBattleHistory()[0]?.replayId ?? null;
    if (!id) return { success: false, error: "Запись боя ещё сохраняется" };
    const game = gameRef.current;
    const score = game ? extractBattleScore(game) : null;
    const myTeam = (game as { player?: { team?: string } })?.player?.team;
    const teams = buildBattleHistoryParticipants(participants, myTeam);
    const res = shareBattleToClub({
      replayId: id,
      mode,
      won,
      place: result?.place ?? 1,
      totalPlayers: Math.max(1, participants.length),
      trophyDelta: result?.trophyDelta ?? 0,
      scoreBlue: score?.blue,
      scoreRed: score?.red,
      durationSec: (performance.now() - battleStartRef.current) / 1000,
      teams,
    });
    if (res.success) setBattleShared(true);
    return res;
  };

  const finalizeBattleNow = (forcedWon?: boolean) => {
    const currentGame = gameRef.current;
    if (!currentGame || gameOverStateRef.current) return;
    gameOverHandledRef.current = true;
    cancelAnimationFrame(rafRef.current);
    const ms = getMatchStats();
    const questDeltaNow = mode === "bossraid" ? [] : computeQuestDeltas();
    const wonNow = forcedWon ?? currentGame.won;
    let raidGrant: GrantBossRaidRewardResult | null = null;
    if (wonNow && mode === "bossraid" && bossRaid) {
      raidGrant = applyPartySharedBossRaidVictory(bossRaid.bossId, bossRaid.level);
    } else if (wonNow && mode === "siege" && siege) {
      applyPartySharedSiegeVictory(siege.level);
    } else if (mode === "bossraid") {
      raidGrant = null;
    }
    setGameOver(true);
    setWon(wonNow);
    setQuestDeltas(questDeltaNow);
    setBossRaidGrant(raidGrant);
    setMatchStatsData({
      damageDealt: ms.damageDealt ?? 0,
      healingDone: ms.healingDone ?? 0,
      superUses: ms.superUses ?? 0,
      killCount: ms.killCount ?? 0,
      powerCubesCollected: ms.powerCubesCollected ?? 0,
    });
    const p = getCurrentProfile();
    if (p?.lastResult) {
      setResult({
        place: p.lastResult.place,
        trophyDelta: p.lastResult.trophyDelta,
        xpGained: p.lastResult.xpGained,
        winStreak: p.lastResult.winStreak,
        winStreakBonus: p.lastResult.winStreakBonus,
        masteryXpGained: p.lastResult.masteryXpGained,
        masteryLeaderBonus: p.lastResult.masteryLeaderBonus,
        monsterKillTrophyBonus: p.lastResult.monsterKillTrophyBonus,
        rankedCupDelta: p.lastResult.rankedCupDelta,
        rankedBattle: p.lastResult.rankedBattle,
      });
    } else {
      setResult({ place: wonNow ? 1 : 2, trophyDelta: 0, xpGained: 0 });
    }
    if (mode !== "training") {
      const pl = (currentGame as any).player;
      const gas = (currentGame as any).gas;
      let lastGasMargin: number | null = null;
      if (pl && gas && gasSafeRadius(gas) > 0) {
        lastGasMargin = playerGasEdgeMargin(pl.x, pl.y, gas);
      }
      const durationSec = Math.max(1, Math.floor(((currentGame as any).matchTime ?? 0) || 0));
      recordHumanMatchEnd({
        mode,
        won: wonNow,
        brawlerId,
        durationSec,
        lastGasMargin,
        hpAtEnd: pl?.hp ?? 0,
        wasStuckHeavy: playerStuckRef.current.wasStuckHeavy,
      });
    }
    if (typeof (currentGame as any).getParticipants === "function") {
      setParticipants((currentGame as any).getParticipants());
    } else {
      const prof = getCurrentProfile();
      setParticipants([{
        brawlerId,
        displayName: prof?.username || t("common.player"),
        team: "blue",
        isPlayer: true,
        level: (prof?.brawlerLevels?.[brawlerId] || 1),
        trophies: prof?.trophies ?? 0,
      }]);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Delete") return;
      if (!isAdminUnlocked()) return;
      if (gameOverStateRef.current) return;
      const g = gameRef.current;
      if (!g) return;
      e.preventDefault();
      const outcome = applyForcedDevBattleExit(g, {
        mode,
        brawlerId,
        showdownFormat: mode === "showdown" ? showdownFormat : undefined,
        starStrikeFormat: mode === "starstrike" ? starStrikeFormat : undefined,
      });
      finalizeBattleNow(outcome?.won ?? false);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true } as any);
  }, []);

  /** Режим разработчика: Caps Lock — пауза мира (боты, таймеры, снаряды); игрок ходит и бьёт. */
  useEffect(() => {
    const onCaps = (e: KeyboardEvent) => {
      if (!isAdminUnlocked()) return;
      if (e.code !== "CapsLock" || e.repeat) return;
      e.preventDefault();
      toggleDevBattlePauseFromCaps();
    };
    window.addEventListener("keydown", onCaps, { capture: true });
    return () => window.removeEventListener("keydown", onCaps, { capture: true } as any);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    setBossRaidGrant(null);
    serverLocalFallbackRef.current = false;
    serverMapReadyRef.current = false;
    setServerMapApplied(false);
    (globalThis as { __onlineClientMode?: boolean }).__onlineClientMode = !!serverMode;
    if (!reattachFromBackground && hasActiveBackgroundBattle()) {
      stopBackgroundBattleLoop(true);
    }
    const reattachSession = reattachFromBackground ? consumeBackgroundBattleSession() : null;
    if (reattachFromBackground && !reattachSession) {
      onAfkKicked?.();
      return;
    }

    let introSafetyTimer = 0;
    let canvas = canvasRef.current;
    let canvas3D = canvas3DRef.current;
    if (reattachSession) {
      const parent2d = canvas.parentElement;
      const parent3d = canvas3D?.parentElement;
      if (parent2d) parent2d.replaceChild(reattachSession.canvas, canvas);
      if (parent3d && canvas3D && reattachSession.canvas3D) {
        parent3d.replaceChild(reattachSession.canvas3D, canvas3D);
      }
      canvas = reattachSession.canvas;
      canvas3D = reattachSession.canvas3D;
      canvasRef.current = canvas;
      canvas3DRef.current = canvas3D;
    }

    const poolBeforeBattle = getQuestPool();
    preQuestSnapshot.current = poolBeforeBattle
      ? poolBeforeBattle.activeQuests
          .filter(q => !q.claimed)
          .map(q => ({ id: q.id, progress: q.progress }))
      : [];
    localVoiceRef.current.reset();
    localVoicePrevRef.current = null;
    localVoiceEnabledRef.current = false;
    localVoiceTickRef.current = 0;
    const profile = getCurrentProfile();
    const level = profile?.brawlerLevels[brawlerId] || 1;
    const spritesReady = spriteLoadedRef.current;

    if (!reattachSession) {
      clearEffects();
      resetShowdownSmokeParticles();
    }
    if (tutorialMode) {
      tutorialSignalsRef.current = createEmptyTutorialSignals();
    }

    let game: AnyGame;
    const serverAuthoritative = !!serverMode;
    const handleAttack = () => {
      if (tutorialMode) {
        const g = gameRef.current;
        const inp = g?.input;
        if (inp) {
          if (inputUsesManualAttackAim(inp)) {
            tutorialSignalsRef.current.aimAttackFired = true;
          } else {
            tutorialSignalsRef.current.autoAttackFired = true;
          }
        }
      }
      gameRef.current?.handleAttack();
    };
    const handleSuper = () => {
      if (tutorialMode) {
        tutorialSignalsRef.current.superUsed = true;
      }
      if (serverAuthoritative) {
        serverBridgeRef.current?.requestSuper();
      }
      gameRef.current?.handleSuper();
    };

    if (reattachSession) {
      game = reattachSession.game as AnyGame;
      afkRef.current = reattachSession.afk;
      setBattleAfkController(reattachSession.afk);
      reattachSession.afk.onPlayerRejoined(reattachSession.game);
      battleStartRef.current = reattachSession.meta.battleStartMs;
      introActiveRef.current = false;
      introCamRef.current = null;
      introDtZeroedRef.current = false;
      setIntroActive(false);
      onReattachStartedRef.current?.();
    } else if (mode === "showdown") {
      game = new ClashShowdown(canvas, brawlerId, level, showdownFormat, handleAttack, handleSuper, spritesReady);
    } else if (mode === "hardcoreShowdown") {
      game = new ClashShowdown(canvas, brawlerId, level, "solo", handleAttack, handleSuper, spritesReady, {
        hardcoreRules: true,
        battleMode: "hardcoreShowdown",
      });
    } else if (mode === "crystals") {
      game = new ClashCrystals(canvas, brawlerId, level, handleAttack, handleSuper, spritesReady);
    } else if (mode === "heist") {
      game = new ClashHeist(canvas, brawlerId, level, handleAttack, handleSuper, spritesReady);
    } else if (mode === "gemgrab") {
      game = new ClashGemGrab(canvas, brawlerId, level, handleAttack, handleSuper, spritesReady);
    } else if (mode === "starstrike") {
      game = new ClashStarStrike(canvas, brawlerId, level, starStrikeFormat, handleAttack, handleSuper, spritesReady);
    } else if (mode === "training") {
      game = new ClashTraining(canvas, brawlerId, level, handleAttack, handleSuper, spritesReady);
    } else if (mode === "bossraid") {
      const br = bossRaid ?? { bossId: "miya", level: 1 };
      game = new ClashBossRaid(canvas, brawlerId, level, br.bossId, br.level, handleAttack, handleSuper, spritesReady);
    } else if (mode === "bounty") {
      game = new ClashBounty(canvas, brawlerId, level, handleAttack, handleSuper, spritesReady);
    } else if (mode === "monsterhide") {
      game = new ClashMonsterHide(canvas, brawlerId, level, handleAttack, handleSuper, spritesReady);
    } else if (mode === "monsterInvasion") {
      game = new ClashMonsterInvasion(canvas, brawlerId, level, handleAttack, handleSuper, spritesReady);
    } else if (mode === "teamHunt") {
      game = new ClashTeamHunt(canvas, brawlerId, level, handleAttack, handleSuper, spritesReady);
    } else if (mode === "megashowdown") {
      // Fall back to active brawler ×3 if the picker did not provide a squad
      // (e.g. direct route into the screen). Levels default to 1.
      const ids = (megaSquad?.ids && megaSquad.ids.length === 3)
        ? megaSquad.ids
        : [brawlerId, brawlerId, brawlerId];
      const levels = (megaSquad?.levels && megaSquad.levels.length === 3)
        ? megaSquad.levels
        : [level, level, level];
      game = new ClashMega(canvas, ids, levels, handleAttack, handleSuper, spritesReady);
    } else {
      const sl = siege?.level ?? 1;
      game = new ClashSiege(canvas, brawlerId, level, handleAttack, handleSuper, spritesReady, sl);
    }

    gameRef.current = game;
    (game as unknown as { __onlineClientMode?: boolean }).__onlineClientMode = serverAuthoritative;
    (game as unknown as { __serverMapApplied?: boolean }).__serverMapApplied = false;

    const editorMode = editorModeForGameMode(mode);
    const activeMap = editorMode ? getActiveMap(editorMode) : null;
    const battleMapForServer =
      serverMode && !serverPlayerMapPublishId && activeMap?.cells?.length && editorMode
        ? mapSaveToServerBattlePayload(activeMap, editorMode)
        : null;
    const battleMapHash = battleMapForServer ? computeBattleMapHash(battleMapForServer) : null;

    // ── Authoritative server battle: same GameScreen UI, server sim ──
    let serverBridge: ServerBattleBridge | null = null;
    if (serverMode && !reattachSession) {
      serverBridge = new ServerBattleBridge();
      serverBridgeRef.current = serverBridge;
      (game as unknown as { __onlineClientMode?: boolean }).__onlineClientMode = true;
      const battleBrawlerId = serverBrawlerOverride ?? brawlerId;
      const trySendServerBattleReady = () => {
        if (!serverBridgeRef.current?.isActive()) return;
        if (!serverMapReadyRef.current) return;
        if (introActiveRef.current) return;
        battleStartRef.current = performance.now();
        serverBridgeRef.current.markServerMapApplied();
      };
      const applyBattleMapToScene = (tileGrid: import("../game/TileMap").TileGrid, mapWidth: number, mapHeight: number) => {
        const camView = (game as any).camera ? { w: (game as any).camera.width, h: (game as any).camera.height } : { w: 857, h: 571 };
        pendingBattle3DInitRef.current = {
          tileGrid,
          mapWidth,
          mapHeight,
          camViewW: camView.w,
          camViewH: camView.h,
          canvasCssW: 1200,
          canvasCssH: 800,
        };
        serverMapReadyRef.current = true;
        if (isBattle3DActive()) {
          reloadBattle3DMap(tileGrid);
        } else {
          boot3dInitStartedRef.current = false;
          startBattle3DRef.current?.();
        }
        trySendServerBattleReady();
      };
      serverBridge.onSeed(() => {
        /* v2: map only from server START (onMap) — no local seed in online */
      });
      serverBridge.onMap((netMap) => {
        const applied = applyServerMapToGame(game as unknown as Record<string, unknown>, netMap);
        (game as unknown as { __serverMapApplied?: boolean }).__serverMapApplied = true;
        setServerMapApplied(true);
        applyBattleMapToScene(applied.tileGrid, applied.mapWidth, applied.mapHeight);
      });
      serverBridge.onEnd((info) => {
        serverEndRef.current = info;
        game.over = true;
        game.won = info.won;
      });
      serverBridge.onError((msg) => {
        if (msg.includes("aborted")) return;
        console.error("[serverBattle]", msg);
        showTrophyLockToast(msg === "map_mismatch" ? t("battle.mapMismatch") : msg);
        window.setTimeout(() => onExitRef.current(), 1500);
      });
      void serverBridge.connect(serverMode, battleBrawlerId, {
        playerMapPublishId: serverPlayerMapPublishId,
        clientMode: mode,
        battleMap: battleMapForServer,
        mapHash: battleMapHash,
      }).catch((err) => {
        const msg = String(err?.message || err);
        if (msg.includes("aborted")) return;
        console.error("[serverBattle] connect failed:", err);
        showTrophyLockToast(msg);
        window.setTimeout(() => onExitRef.current(), 1500);
      });
    }

    resetKillFeedBus();
    setKillFeedPlayerTeam((game as { player?: { team?: string } }).player?.team ?? "blue");

    const playerTeam = (game as { player?: { team?: string } }).player?.team ?? "blue";
    let rawParts: GameParticipant[];
    try {
      rawParts =
        typeof (game as { getParticipants?: () => GameParticipant[] }).getParticipants === "function"
          ? (game as { getParticipants: () => GameParticipant[] }).getParticipants()
          : [{
              brawlerId,
              displayName: getCurrentProfile()?.username || t("common.player"),
              team: playerTeam,
              isPlayer: true,
              level,
              trophies: getCurrentProfile()?.trophies ?? 0,
            }];
    } catch (err) {
      console.error("[battle] getParticipants failed:", err);
      rawParts = [{
        brawlerId,
        displayName: getCurrentProfile()?.username || t("common.player"),
        team: playerTeam,
        isPlayer: true,
        level,
        trophies: getCurrentProfile()?.trophies ?? 0,
      }];
    }
    const introParts = enrichIntroParticipants(rawParts, playerTeam);
    setIntroParticipants(introParts);
    preloadIntroBrawlerModels(rawParts.map(p => p.brawlerId));
    // Prefetch every combatant's voice clips so spawn/kill/super lines play
    // instantly instead of lagging on the first CDN fetch.
    for (const p of rawParts) warmBrawlerVoices(p.brawlerId);

    const anyGame: any = game;
    const tileGrid = resolveBattleTileGrid(anyGame);
    const mapW = anyGame.map?.width ?? 3000;
    const mapH = anyGame.map?.height ?? 3000;
    const camView = anyGame.camera ? { w: anyGame.camera.width, h: anyGame.camera.height } : { w: 857, h: 571 };
    const playerX = anyGame.player?.x ?? mapW / 2;
    const playerY = anyGame.player?.y ?? mapH / 2;
    const showIntro = !tutorialMode && mode !== "training" && !reattachSession && introParts.length > 0;

    // ── 3D сразу (фон интро = живая сцена, не чёрный экран) ──
    beginBattle3DSession();
    void loadPowerModels();
    void loadSafeGLBTemplate();
    let boot3dCancelled = false;
    let boot3dRaf = 0;
    let boot3dInitAttempts = 0;

    const failBattle3D = (err: unknown) => {
      if (boot3dCancelled) return;
      console.error("[battle3D] init failed:", err);
      showTrophyLockToast(t("battle.3dInitFailed"));
      window.setTimeout(() => onExitRef.current(), 2500);
    };

    pendingBattle3DInitRef.current = {
      tileGrid,
      mapWidth: mapW,
      mapHeight: mapH,
      camViewW: camView.w,
      camViewH: camView.h,
      canvasCssW: 1200,
      canvasCssH: 800,
    };

    const bootBattle3D = (): Promise<void> | undefined => {
      if (boot3dCancelled) return boot3dPromiseRef.current ?? undefined;
      const opts = pendingBattle3DInitRef.current;
      if (!opts) return boot3dPromiseRef.current ?? undefined;
      const canvas3DEl = canvas3DRef.current;
      if (!canvas3DEl) {
        boot3dRaf = requestAnimationFrame(bootBattle3D);
        return boot3dPromiseRef.current ?? undefined;
      }
      setBattle3DCanvas(canvas3DEl);
      if (reattachSession) return boot3dPromiseRef.current ?? undefined;
      if (boot3dInitStartedRef.current && isBattle3DActive()) return boot3dPromiseRef.current ?? undefined;
      if (boot3dInitStartedRef.current && !isBattle3DActive()) boot3dInitStartedRef.current = false;
      boot3dInitStartedRef.current = true;
      const runInit = (): Promise<void> => initBattle3DForBattle(opts).then(async (ok) => {
        if (ok) {
          boot3dInitAttempts = 0;
          return;
        }
        if (boot3dCancelled) return;
        await new Promise<void>((r) => window.setTimeout(r, 120));
        if (isBattle3DActive()) return;
        boot3dInitStartedRef.current = false;
        boot3dInitAttempts += 1;
        if (boot3dInitAttempts < 8) {
          await bootBattle3D();
          return;
        }
        failBattle3D(new Error("3D scene not ready"));
      }).catch((err) => {
        boot3dInitStartedRef.current = false;
        boot3dInitAttempts += 1;
        if (!boot3dCancelled && boot3dInitAttempts < 8) {
          return new Promise<void>((resolve, reject) => {
            window.setTimeout(() => {
              bootBattle3D()?.then(resolve).catch(reject);
            }, 600);
          });
        }
        failBattle3D(err);
        throw err;
      });
      boot3dPromiseRef.current = runInit();
      return boot3dPromiseRef.current;
    };

    startBattle3DRef.current = () => { void bootBattle3D(); };

    if (!reattachSession) {
      bootBattle3D();
      if (!showIntro && !serverMode) {
        void boot3dPromiseRef.current?.then(() => {
          if (!isBattle3DActive()) {
            failBattle3D(new Error("3D scene not ready"));
            return;
          }
          battleStartRef.current = performance.now();
          enableLocalBattleVoice();
        }).catch((err) => {
          failBattle3D(err);
        });
      }
    }

    if (!reattachSession) {
      setIntroMeta({
        playerX,
        playerY,
        camW: camView.w,
        camH: camView.h,
        mapW,
        mapH,
        playerTeam,
      });
      const camPath = buildIntroCameraPath(playerX, playerY, camView.w, camView.h, mapW, mapH);
      introActiveRef.current = showIntro;
      introCamRef.current = showIntro ? { x: camPath.startX, y: camPath.startY } : null;
      introDtZeroedRef.current = false;
      setIntroActive(showIntro);
      if (!showIntro) {
        canvas.focus({ preventScroll: true });
      } else {
        introSafetyTimer = window.setTimeout(() => {
          if (!introActiveRef.current) return;
          void (async () => {
            try { await boot3dPromiseRef.current; } catch { /* retried in boot */ }
            disposeIntroSharedRenderer();
            introActiveRef.current = false;
            introCamRef.current = null;
            introDtZeroedRef.current = false;
            setIntroActive(false);
            battleStartRef.current = performance.now();
            canvasRef.current?.focus({ preventScroll: true });
            if (serverBridgeRef.current?.isActive()) {
              serverBridgeRef.current.enableBattleVoice();
              if (serverMapReadyRef.current) {
                serverBridgeRef.current.markServerMapApplied();
              }
            } else {
              enableLocalBattleVoice();
            }
          })();
        }, 14000);
      }

      startBattleReplayRecording({
        mode,
        playerBrawlerId: brawlerId,
        mapId: activeMap?.id,
        myTeam: (game as { player?: { team?: string } }).player?.team,
        tileGrid,
        mapWidth: mapW,
        mapHeight: mapH,
        camViewW: camView.w,
        camViewH: camView.h,
        gameZoom: 1.4,
      });
    } else {
      setIntroMeta({
        playerX,
        playerY,
        camW: camView.w,
        camH: camView.h,
        mapW,
        mapH,
        playerTeam,
      });
    }

    const gameLike = game as unknown as { input: any; player: any; bots: any[]; drops: any[]; map: any; gas?: any };
    autoplayRef.current = new AstralAutoplay(gameLike, mode);
    autoplayRef.current.setSnapshotProvider(() => {
      const g = gameRef.current;
      if (!g?.player) return null;
      const dur = (performance.now() - battleStartRef.current) / 1000;
      return buildBattleSnapshot(
        g as typeof gameLike,
        mode,
        dur,
        getPetById(getCurrentProfile()?.equippedPetId ?? null)?.effectLabel ?? null,
      );
    });
    // Apply constellation bonuses once at battle start.
    if (!reattachSession) {
    try {
      const p = getCurrentProfile();
      const gp: any = (game as any).player;
      const starBrawlerId = gp?.stats?.id ?? brawlerId;
      const stars = getBrawlerStars(p, starBrawlerId);
      if (gp && gp.stats) {
        // Never mutate shared brawler stat templates (BRAWLERS entries),
        // otherwise bonuses stack between matches and break base speed/damage.
        gp.stats = { ...gp.stats };
        const baseStats = getBrawlerById(gp.stats.id);
        if (baseStats) {
          // Hard reset per-match runtime stats to canonical values from BRAWLERS.
          gp.stats.speed = baseStats.speed;
          if (typeof gp.speed === "number") gp.speed = baseStats.speed;
        }
        gp.constellationStars = stars;
        if (stars.includes(1)) { // survivability
          const hpBoost = Math.round((gp.maxHp || gp.hp || gp.stats.hp || 0) * 0.08);
          if (hpBoost > 0) {
            gp.maxHp = (gp.maxHp || gp.hp) + hpBoost;
            gp.hp = (gp.hp || 0) + hpBoost;
          }
        }
        if (stars.includes(2)) {
          if (typeof gp.stats.attackRange === "number") gp.stats.attackRange *= 1.12;
          if (typeof gp.stats.projectileSpeed === "number") gp.stats.projectileSpeed *= 1.1;
        }
        if (stars.includes(3) && typeof gp.stats.attackDamage === "number") gp.stats.attackDamage += 120;
        if (stars.includes(4) && typeof gp.stats.speed === "number" && gp.stats.id !== "zafkiel") {
          gp.stats.speed *= 1.08;
          if (typeof gp.speed === "number") gp.speed *= 1.08;
        }
        if (stars.includes(5) && typeof gp.stats.regenRate === "number") gp.stats.regenRate += 6;
        if (stars.includes(6) && typeof gp.stats.superChargePerHit === "number") gp.stats.superChargePerHit *= 1.1;
      }
      const clubBonuses = getPlayerTreasuryBattleBonuses(p, getMyClub());
      if (gp && gp.stats) {
        if (clubBonuses.damagePct > 0 && typeof gp.stats.attackDamage === "number") {
          gp.stats.attackDamage = Math.round(gp.stats.attackDamage * (1 + clubBonuses.damagePct / 100));
        }
        if (clubBonuses.speedPct > 0 && typeof gp.stats.speed === "number" && gp.stats.id !== "zafkiel") {
          const speedMult = 1 + clubBonuses.speedPct / 100;
          gp.stats.speed *= speedMult;
          if (typeof gp.speed === "number") gp.speed *= speedMult;
        }
        if (clubBonuses.hpPct > 0) {
          const hpBase = gp.maxHp || gp.hp || gp.stats.hp || 0;
          const hpBoost = Math.round(hpBase * (clubBonuses.hpPct / 100));
          if (hpBoost > 0) {
            gp.maxHp = (gp.maxHp || gp.hp) + hpBoost;
            gp.hp = (gp.hp || 0) + hpBoost;
          }
        }
      }
    } catch { /* no-op */ }
    if (mode !== "training") {
      beginPlayerObservation(mode);
      playerStuckRef.current = {
        x: game.player?.x ?? 0,
        y: game.player?.y ?? 0,
        stillSec: 0,
        wasStuckHeavy: false,
      };
    }
    const afkEnabled = mode !== "training";
    const afkController = new BattleAfkController(afkEnabled);
    afkRef.current = afkController;
    setBattleAfkController(afkController);
    }

    const afkEnabled = mode !== "training";
    const ctx = canvas.getContext("2d")!;

    const renderBattle3DForFrame = (introFrozen: boolean, frameDt: number) => {
      const cam: any = (game as any).camera;
      if (!cam) return;
      if (introFrozen && introCamRef.current) {
        cam.x = introCamRef.current.x;
        cam.y = introCamRef.current.y;
      }
      const brawlers = collectBattleBrawlers(game);
      const playerB: any = (game as any).player;
      const viewerTeam: string | undefined = playerB?.team;
      const crates: any[] | undefined = (game as any).map?.crates;
      const allDrops: any[] | undefined = (game as any).drops;
      const powerJars = allDrops
        ? allDrops
            .filter((d: any) => d && d.type === "powerup" && (typeof d.jarId === "number" || typeof d.id === "number"))
            .map((d: any) => ({
              id: d.jarId ?? d.id,
              x: d.x,
              y: d.y,
              radius: d.radius ?? 14,
              spawnX: d.spawnX,
              spawnY: d.spawnY,
            }))
        : undefined;
      let battleSafes: Battle3DSafe[] | undefined;
      if (mode === "heist" && Array.isArray((game as any).safes)) {
        battleSafes = (game as any).safes.map((s: any) => ({
          id: `heist-${s.team}`,
          x: s.x,
          y: s.y,
          team: s.team,
          hp: s.hp,
          maxHp: s.maxHp,
          size: 100,
        }));
      } else if (mode === "siege" && (game as any).baseHp > 0) {
        battleSafes = [{
          id: "siege-base",
          x: (game as any).baseX,
          y: (game as any).baseY,
          team: "blue",
          hp: (game as any).baseHp,
          maxHp: (game as any).baseMaxHp,
          size: 60,
        }];
      }
      tickAndRenderBattle3D(cam.x ?? 0, cam.y ?? 0, brawlers, introFrozen ? 0 : frameDt, viewerTeam, crates, powerJars, battleSafes, mode === "monsterhide");
    };

    const loop = (timestamp: number) => {
      const prev = lastTimeRef.current;
      lastTimeRef.current = timestamp;
      const rawDt = prev ? (timestamp - prev) / 1000 : 1 / 60;
      const dt = Math.min(Math.max(rawDt, 1 / 240), 0.05);

      if (autoplayOnRef.current && autoplayRef.current && !game.over && !isDevBattleWorldFrozen() && !introActiveRef.current) {
        autoplayRef.current.tick(timestamp);
      }
      const introFrozen = introActiveRef.current;
      const afk = afkRef.current;
      if (afk && afkEnabled && !game.over && !introFrozen) {
        afk.tick(dt, game as Record<string, unknown>, game.input);
        const ws = afk.getWarningState();
        const key = `${ws.visible}:${Math.ceil(ws.secondsLeft)}`;
        if (key !== afkWarnKeyRef.current) {
          afkWarnKeyRef.current = key;
          setAfkWarning(ws);
        }
        if (afk.consumeKickRequest()) {
          if (serverBridge?.isActive()) {
            serverBridge.requestServerBot();
            serverBridge.disconnect();
            onAfkKickedRef.current?.();
            return;
          }
          detachingToBackgroundRef.current = true;
          detachBattleToBackground({
            game: game as Record<string, unknown> & typeof game,
            canvas,
            canvas3D,
            ctx,
            afk,
            meta: {
              mode,
              brawlerId,
              showdownFormat,
              starStrikeFormat,
              bossRaid,
              siege,
              megaSquad,
              battleStartMs: battleStartRef.current || performance.now(),
            },
            collectBrawlers: () => collectBattleBrawlers(game),
            tick3D: (tickDt) => renderBattle3DForFrame(false, tickDt),
            lastTime: 0,
            rafId: 0,
            kicked: true,
          });
          cancelAnimationFrame(rafRef.current);
          onAfkKickedRef.current?.();
          return;
        }
      }
      if (!introFrozen) {
        afk?.beforeUpdate(game.input);
      }
      if (tutorialMode && !introFrozen) {
        const inp = game.input;
        const p = game.player;
        if (
          inp?.state.up || inp?.state.down || inp?.state.left || inp?.state.right
          || (inp?.movementJoystick.magnitude ?? 0) > 0.12
        ) {
          tutorialSignalsRef.current.moved = true;
        }
        if (p && (p.superReady || p.superCharge >= p.maxSuperCharge * 0.85)) {
          tutorialSignalsRef.current.superCharged = true;
        }
      }
      if (serverBridge?.isActive()) {
        const gAny = game as unknown as Record<string, unknown>;
        serverBridge.prepareRemotes(gAny, { visualDt: introFrozen ? 0 : dt });
        try {
          game.update(introFrozen ? 0 : dt);
        } catch (err) {
          console.error("[battle] update failed:", err);
        }
        if (!introFrozen) {
          serverBridge.sendTurn(gAny);
          if (afk && afkEnabled && !game.over) {
            afk.afterUpdate(game as Record<string, unknown>, mode, dt);
          }
        }
        serverBridge.applyAuthority(gAny, mode, { visualDt: introFrozen ? 0 : dt });
        if (!introFrozen) setGameRenderDt(dt);
      } else if (!introFrozen) {
        try {
          game.update(dt);
        } catch (err) {
          console.error("[battle] update failed:", err);
        }
        if (!serverBridge?.isActive() && localVoiceEnabledRef.current) {
          localVoiceTickRef.current += 1;
          const gAny = game as unknown as Record<string, unknown>;
          const dur = (performance.now() - battleStartRef.current) / 1000;
          const snap = serializeGameSnapshot(gAny as never, localVoiceTickRef.current, dur, mode);
          localVoiceRef.current.process(localVoicePrevRef.current, snap, buildLocalVoiceCtx(gAny));
          localVoicePrevRef.current = snap;
        }
        if (afk && afkEnabled && !game.over) {
          afk.afterUpdate(game as Record<string, unknown>, mode, dt);
        }
        setGameRenderDt(dt);
      } else if (!introDtZeroedRef.current) {
        setGameRenderDt(0);
        introDtZeroedRef.current = true;
      }

      if (mode !== "training" && !game.over && !introFrozen) {
        const pl = (game as any).player;
        if (pl) {
          const stuck = trackPlayerStuck(pl.x, pl.y, dt, playerStuckRef.current);
          playerStuckRef.current = { ...stuck, wasStuckHeavy: stuck.wasStuckHeavy };
          observePlayerBattleFrame(game as any, pl.id ?? brawlerId, dt);
        }
      }

      if (!game.over && !introFrozen) {
        tickBattleReplayRecording(game, collectBattleBrawlers(game), dt);
      }

      const cam: any = (game as any).camera;
      try {
        if (cam) {
          renderBattle3DForFrame(introFrozen, dt);
        }
        game.render(ctx);
      } catch (err) {
        console.error("[battle] frame render failed:", err);
      }

      if (game.over) {
        if (gameOverAtRef.current == null) gameOverAtRef.current = timestamp;
        // Keep rendering for a short post-battle transition instead of hard stop.
        const overFor = timestamp - gameOverAtRef.current;
        const fadeT = Math.min(1, overFor / 1400);
        ctx.save();
        ctx.fillStyle = `rgba(6,8,16,${0.12 + fadeT * 0.28})`;
        ctx.fillRect(0, 0, 1200, 800);
        ctx.restore();

        if (!gameOverHandledRef.current && overFor >= 1400) {
          gameOverHandledRef.current = true;
          const ms = getMatchStats();
          const currentGame = gameRef.current;
          const questDeltaNow = mode === "bossraid" ? [] : computeQuestDeltas();
          setGameOver(true);
          setWon(game.won);
          setQuestDeltas(questDeltaNow);
          const p = getCurrentProfile();
          const serverEnd = serverEndRef.current;
          let raidGrantLoop: GrantBossRaidRewardResult | null = null;
          if (!serverEnd && game.won && mode === "bossraid" && bossRaid) {
            raidGrantLoop = applyPartySharedBossRaidVictory(bossRaid.bossId, bossRaid.level);
          } else if (!serverEnd && game.won && mode === "siege" && siege) {
            applyPartySharedSiegeVictory(siege.level);
          } else if (mode === "bossraid") {
            raidGrantLoop = null;
          }
          setBossRaidGrant(raidGrantLoop);
          setMatchStatsData(normalizeMatchStats(ms));
          if (serverEnd?.myReward) {
            setResult({
              place: serverEnd.won ? 1 : 2,
              trophyDelta: serverEnd.myReward.trophyDelta,
              xpGained: serverEnd.myReward.xp,
            });
          } else if (p?.lastResult) {
            setResult({
        place: p.lastResult.place,
        trophyDelta: p.lastResult.trophyDelta,
        xpGained: p.lastResult.xpGained,
        winStreak: p.lastResult.winStreak,
        winStreakBonus: p.lastResult.winStreakBonus,
        masteryXpGained: p.lastResult.masteryXpGained,
        masteryLeaderBonus: p.lastResult.masteryLeaderBonus,
        monsterKillTrophyBonus: p.lastResult.monsterKillTrophyBonus,
        rankedCupDelta: p.lastResult.rankedCupDelta,
        rankedBattle: p.lastResult.rankedBattle,
      });
          }
          if (serverEnd?.result.scoreboard?.length) {
            const prof = getCurrentProfile();
            const myName = prof?.username || t("common.player");
            setParticipants(serverEnd.result.scoreboard.map((row) => ({
              brawlerId: row.b,
              displayName: row.name,
              team: row.t === 0 ? "blue" : "red",
              isPlayer: !row.bot && row.name === myName,
              level: prof?.brawlerLevels?.[row.b] || 1,
              trophies: prof?.trophies ?? 0,
              kills: row.kills,
            })));
          } else if (currentGame && typeof (currentGame as any).getParticipants === "function") {
            setParticipants((currentGame as any).getParticipants());
          } else {
            const prof = getCurrentProfile();
            setParticipants([{
              brawlerId,
              displayName: prof?.username || t("common.player"),
              team: "blue",
              isPlayer: true,
              level: level,
              trophies: prof?.trophies ?? 0,
            }]);
          }
          void (async () => {
            const replayId = await finishBattleReplayRecording();
            const parts =
              currentGame && typeof (currentGame as any).getParticipants === "function"
                ? (currentGame as any).getParticipants()
                : [];
            const score = currentGame ? extractBattleScore(currentGame) : null;
            finishLiveBattleRecording({
              won: game.won,
              participants: parts,
              result: p?.lastResult
                ? {
                    trophyDelta: p.lastResult.trophyDelta,
                    xpGained: p.lastResult.xpGained,
                    place: p.lastResult.place,
                  }
                : null,
              matchStats: normalizeMatchStats(ms),
              scoreBlue: score?.blue,
              scoreRed: score?.red,
            });
            const battleRecordId = getBattleHistory()[0]?.id;
            enrichLatestBattleRecord({
              recordId: battleRecordId,
              participants: parts,
              myTeam: (currentGame as { player?: { team?: string } })?.player?.team,
              scoreBlue: score?.blue,
              scoreRed: score?.red,
              replayId,
              durationSec: (performance.now() - battleStartRef.current) / 1000,
              mapId: activeMap?.id,
              showdownFormat: mode === "showdown" ? showdownFormat : undefined,
              bossId: mode === "bossraid" ? bossRaid?.bossId : undefined,
              bossLevel: mode === "bossraid" ? bossRaid?.level : undefined,
            });
            if (replayId) setReplayId(replayId);
          })();
        }
        if (!gameOverHandledRef.current) {
          rafRef.current = requestAnimationFrame(loop);
        }
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (introSafetyTimer) window.clearTimeout(introSafetyTimer);
      if (detachingToBackgroundRef.current) {
        detachingToBackgroundRef.current = false;
        return;
      }
      boot3dCancelled = true;
      cancelAnimationFrame(boot3dRaf);
      boot3dPromiseRef.current = null;
      startBattle3DRef.current = null;
      pendingBattle3DInitRef.current = null;
      if (mode !== "training") endPlayerObservation();
      setBattleAfkController(null);
      afkRef.current = null;
      cancelBattleReplayRecording();
      resetDevBattlePause();
      resetKillFeedBus();
      enableBattle3D(false);
      disposeBattle3D();
      setBattle3DCanvas(null);
      cancelAnimationFrame(rafRef.current);
      serverBridgeRef.current?.disconnect();
      serverBridgeRef.current = null;
      serverEndRef.current = null;
      game.destroy?.();
      gameRef.current = null;
      autoplayRef.current?.destroy();
      autoplayRef.current = null;
      lastTimeRef.current = 0;
      gameOverAtRef.current = null;
      gameOverHandledRef.current = false;
    };
  }, [mode, showdownFormat, starStrikeFormat, brawlerId, bossRaid?.bossId, bossRaid?.level, reattachFromBackground, serverMode, serverBrawlerOverride, serverPlayerMapPublishId, tutorialMode]);

  const handleIntroComplete = useCallback(() => {
    void (async () => {
      disposeIntroSharedRenderer();
      await new Promise<void>((r) => window.setTimeout(r, 100));
      if (!isBattle3DActive()) {
        boot3dInitStartedRef.current = false;
        startBattle3DRef.current?.();
      }
      try { await boot3dPromiseRef.current; } catch { /* retried in boot */ }
      if (!isBattle3DActive()) {
        showTrophyLockToast(t("battle.3dInitFailed"));
        window.setTimeout(() => onExitRef.current(), 2500);
        return;
      }
      introActiveRef.current = false;
      introCamRef.current = null;
      introDtZeroedRef.current = false;
      setIntroActive(false);
      battleStartRef.current = performance.now();
      canvasRef.current?.focus({ preventScroll: true });
      gameRef.current?.input?.resetBattleControls();
      if (serverBridgeRef.current?.isActive()) {
        serverBridgeRef.current.enableBattleVoice();
        if (serverMapReadyRef.current) {
          serverBridgeRef.current.markServerMapApplied();
        }
      } else {
        enableLocalBattleVoice();
      }
    })();
  }, [enableLocalBattleVoice, t]);

  const handleIntroCamera = useCallback((x: number, y: number) => {
    introCamRef.current = { x, y };
  }, []);

  const partyReplayEligible = gameOver && isBattleTeamPlayAgainEligible(mode, showdownFormat) && mode !== "training";

  useEffect(() => {
    if (!partyReplayEligible) return;
    const bump = () => {
      tickBattlePlayAgainExpired();
      setPartyPlayAgainTick(t => t + 1);
    };
    bump();
    const iv = window.setInterval(bump, 250);
    window.addEventListener(PARTY_CHANGED_EVENT, bump);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener(PARTY_CHANGED_EVENT, bump);
    };
  }, [partyReplayEligible]);

  useEffect(() => {
    if (!partyReplayEligible || partyRematchResolvedRef.current) return;
    const pa = getPlayAgainState();
    if (!pa?.finalized) return;
    partyRematchResolvedRef.current = true;
    if (shouldRematchBattlePlayAgain()) {
      stashBattlePlayAgainRematchRoster();
      clearBattlePlayAgainState();
      onResultPlayAgain(won);
    } else if (shouldExitAfterBattlePlayAgain()) {
      clearAllPlayAgainState();
      onExit();
    }
  }, [partyReplayEligible, partyPlayAgainTick, won, onExit, onResultPlayAgain]);

  const handlePlayAgain = () => {
    if (partyReplayEligible) {
      if (getPlayAgainState()?.finalized) return;
      pressBattlePlayAgain(mode);
      setPartyPlayAgainTick(t => t + 1);
      return;
    }
    onResultPlayAgain(won);
  };

  const handleResultExit = () => {
    if (partyReplayEligible && !getPlayAgainState()?.finalized) {
      playAgainOnResultExit();
    }
    clearAllPlayAgainState();
    onExit();
  };
  const partyPaActive = partyReplayEligible && isPlayAgainTimerRunning();
  const partyPaReady = partyReplayEligible && amIPlayAgainReady();
  const partyPaSecs = partyReplayEligible ? getPlayAgainSecondsLeft() : 0;

  const isRankedResult = !!result?.rankedBattle;
  let playAgainLabel = t("battle.playAgain");
  if (isRankedResult) playAgainLabel = t("ranked.playAgain");
  else if (mode === "bossraid" && won) playAgainLabel = t("battle.nextBossLevel");
  else if (partyPaActive && partyPaReady) playAgainLabel = t("party.waitingSeconds", { seconds: partyPaSecs });
  else if (partyPaActive) playAgainLabel = t("battle.playAgainCountdown", { seconds: partyPaSecs });

  const playAgainDisabled =
    (mode === "bossraid" && won && !!bossRaid && bossRaid.level >= BOSS_RAID_MAX_LEVEL)
    || (partyPaActive && partyPaReady);

  const stageCanvases = (
    <>
      <canvas
        ref={canvas3DRef}
        width={1200}
        height={800}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
          background: "transparent",
          zIndex: 0,
        }}
      />
      <canvas
        ref={canvasRef}
        width={1200}
        height={800}
        tabIndex={0}
        aria-label="Battle arena"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
          userSelect: "none",
          background: "transparent",
          transform: "translateZ(0)",
          border: "none",
          outline: "none",
          boxShadow: "inset 0 1px 0 0 #050508",
          zIndex: 1,
        }}
      />
    </>
  );

  const battleHud = (
    <>
      <ShowdownStandoffOverlay active={showdownStandoffVisible} />
      <GasCountdown10Overlay seconds={gasCountdownSec} />
      {serverMode && !serverMapApplied && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(3, 6, 15, 0.88)",
            color: "#fff",
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            pointerEvents: "all",
          }}
        >
          {t("loading.default")}
        </div>
      )}
      {introActive && introMeta && introParticipants.length > 0 && (
        <BattleIntroOverlay
          mode={mode}
          showdownFormat={showdownFormat}
          participants={introParticipants}
          playerTeam={introMeta.playerTeam}
          playerX={introMeta.playerX}
          playerY={introMeta.playerY}
          camW={introMeta.camW}
          camH={introMeta.camH}
          mapW={introMeta.mapW}
          mapH={introMeta.mapH}
          onCamera={handleIntroCamera}
          onComplete={handleIntroComplete}
        />
      )}

      {controlMode === "mobile" && !gameOver && !introActive && (
        <MobileControls
          getInput={() => gameRef.current?.input ?? null}
          getPlayerInfo={() => {
            const stats = gameRef.current?.player?.stats ?? getBrawlerById(brawlerId) ?? BRAWLERS[0];
            return {
            attackRange: stats.attackRange,
            canvas: canvasRef.current,
            brawlerId: stats.id,
            playerX: gameRef.current?.player?.x,
            playerY: gameRef.current?.player?.y,
            camX: gameRef.current?.camera?.x,
            camY: gameRef.current?.camera?.y,
            oliverMemoryCount: gameRef.current?.player?.oliverMemories?.length ?? 0,
            onOliverCycleMemory: () => {
              const p = gameRef.current?.player;
              if (p) cycleOliverMemory(p);
            },
          };
          }}
          gestureEditMode={mode === "training" && gestureEditorOpen}
          gestureEditTarget={gestureEditTarget}
          gestureLayout={gestureLayout}
          onGestureLayoutChange={setGestureLayout}
        />
      )}

      {!gameOver && !introActive && (
        <BattleSurvivorHud gameRef={gameRef as any} mode={mode} showdownFormat={showdownFormat} />
      )}

      {mode === "megashowdown" && !gameOver && !introActive && (
        <MegaSquadHud gameRef={gameRef as React.MutableRefObject<ClashMega | null>} />
      )}

      {mode === "training" && !gameOver && !tutorialMode && (
        <>
          <button
            type="button"
            onClick={() => setGestureEditorOpen((o) => !o)}
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              zIndex: 11,
              pointerEvents: "auto",
              background: gestureEditorOpen
                ? "linear-gradient(135deg, #1565C0, #42A5F5)"
                : "rgba(8,12,28,0.88)",
              border: "1.5px solid rgba(66,165,245,0.55)",
              borderRadius: 12,
              padding: "10px 14px",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <Tr id="training.gestureEditor.open" />
          </button>
          <TrainingGestureEditor
            open={gestureEditorOpen}
            onClose={() => { setGestureEditorOpen(false); setGestureEditTarget(null); }}
            selected={gestureEditTarget}
            onSelect={setGestureEditTarget}
            onLayoutChange={setGestureLayout}
          />
          <button
            onClick={onExit}
            style={{
              position: "absolute",
              top: 14, right: 14, zIndex: 11,
              pointerEvents: "auto",
              background: "linear-gradient(135deg, #C62828, #FF5252)",
              border: "none",
              borderRadius: 12,
              padding: "10px 18px",
              color: "white",
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: 1.5,
              cursor: "pointer",
              boxShadow: "0 4px 18px rgba(255,82,82,0.5)",
            }}
          >
            <Tr id="battle.exitTraining" />
          </button>
        </>
      )}

      {!gameOver && !introActive && (
        <BattleAfkWarning visible={afkWarning.visible} secondsLeft={afkWarning.secondsLeft} />
      )}

      {tutorialMode && !gameOver && !introActive && onTutorialComplete && onTutorialSkipLogin && (
        <TutorialBattleOverlay
          getSignals={getTutorialSignals}
          onComplete={onTutorialComplete}
          onSkipToLogin={onTutorialSkipLogin}
          joysticksVisible={controlMode === "mobile"}
          onBannerHeight={setTutorialBannerHeight}
        />
      )}

      {!gameOver && !introActive && (
        <ModeFirstPlayHintBanner mode={mode} active={!tutorialMode} />
      )}

      {!gameOver && !introActive && (
        <KillFeedHud top={tutorialMode ? tutorialBannerHeight : astralAvailable ? 96 : 18} />
      )}

      {astralAvailable && !gameOver && !introActive && (
        <>
          <AstralBattleTip
            getSnapshot={() => {
              const g = gameRef.current;
              if (!g || !g.player) return null;
              const dur = (performance.now() - battleStartRef.current) / 1000;
              return buildBattleSnapshot(
                g as unknown as { input: any; player: any; bots: any[]; drops: any[]; map: any; gas?: any },
                mode,
                dur,
                getPetById(getCurrentProfile()?.equippedPetId ?? null)?.effectLabel ?? null,
              );
            }}
          />
          <button
            onClick={() => {
              const next = !autoplayOn;
              setAutoplayOn(next);
            }}
            style={{
              position: "absolute",
              left: `${gestureLayout.autobattle.x * 100}%`,
              top: `${gestureLayout.autobattle.y * 100}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 11,
              pointerEvents: "auto",
              background: autoplayOn
                ? "linear-gradient(135deg, #FFD740, #FFA000)"
                : "rgba(74,20,140,0.85)",
              border: `1.5px solid ${autoplayOn ? "#FFD740" : "rgba(206,147,216,0.6)"}`,
              borderRadius: 12,
              padding: `${10 * gestureLayout.autobattle.size}px ${14 * gestureLayout.autobattle.size}px`,
              color: autoplayOn ? "#ffffff" : "#FFD740",
              textShadow: autoplayOn ? "0 1px 3px rgba(0,0,0,0.85), 0 0 1px rgba(0,0,0,0.9)" : undefined,
              fontWeight: 800,
              fontSize: 12 * gestureLayout.autobattle.size,
              letterSpacing: 1,
              cursor: "pointer",
              boxShadow: autoplayOn
                ? "0 4px 18px rgba(255,160,0,0.5)"
                : "0 4px 14px rgba(0,0,0,0.5)",
              outline: mode === "training" && gestureEditorOpen && gestureEditTarget === "autobattle"
                ? "2px dashed #FFD740"
                : undefined,
            }}
            title={t("battle.astralAutoplay")}
          >
            <EmojiIcon emoji="✨" size={18} /> {autoplayOn ? t("battle.autoplayOn") : t("battle.autoplayOff")}
          </button>
        </>
      )}

      {!gameOver && !introActive && (
        <BattlePinHud
          brawlerId={brawlerId}
          gameRef={gameRef as any}
          canvasRef={canvasRef}
          visible={!gameOver}
          gestureLayout={gestureLayout}
          gestureEditMode={mode === "training" && gestureEditorOpen}
          gestureEditTarget={gestureEditTarget}
          onGestureLayoutChange={setGestureLayout}
          onPinVoice={(pinId) => {
            const g = gameRef.current;
            if (serverBridgeRef.current?.isActive()) {
              serverBridgeRef.current.sendPinVoice(pinId, g as Record<string, unknown>);
              return;
            }
            const player = g?.player as Brawler | undefined;
            const parsed = parsePinId(pinId);
            if (player && parsed) {
              playPinVoice(player.stats?.id ?? parsed.brawlerId, parsed.kind);
            }
          }}
        />
      )}
    </>
  );

  const playerMapSession = getPlayerMapBattleSession();
  const isPlayerMapResult = !!result?.playerMapBattle || !!playerMapSession;

  const resultOverlay = gameOver ? (
    <ResultScreen
      won={won}
      mode={mode}
      participants={participants}
      result={result}
      matchStats={matchStatsData}
      questDeltas={questDeltas}
      bossRaidGrant={bossRaidGrant}
      playAgainLabel={playAgainLabel}
      playAgainDisabled={playAgainDisabled}
      partyPlayAgainMembers={partyReplayEligible ? getBattleTeamPlayAgainPanelMembers() : []}
      partyPlayAgainSecondsLeft={partyPaSecs}
      partyPlayAgainActive={partyPaActive}
      playerMapBattle={isPlayerMapResult}
      playerMapName={playerMapSession?.mapName}
      playerMapAuthor={playerMapSession?.authorName}
      playerMapVoted={!!playerMapSession?.voted}
      onPlayerMapLike={() => {
        if (!playerMapSession || playerMapSession.voted) return;
        processPlayerMapLike(playerMapSession.publishId, playerMapSession.mapName, playerMapSession.authorId);
        markPlayerMapVote("like");
        setPartyPlayAgainTick(t => t + 1);
      }}
      onPlayerMapDislike={() => {
        if (!playerMapSession || playerMapSession.voted) return;
        dislikePublishedMap(playerMapSession.publishId);
        markPlayerMapVote("dislike");
        setPartyPlayAgainTick(t => t + 1);
      }}
      canShareBattle={mode !== "training" && !!getMyClub()}
      replayReady={!!replayId || !!getBattleHistory()[0]?.replayId}
      battleShared={battleShared}
      onShareBattle={handleShareBattle}
      onExit={handleResultExit}
      onPlayAgain={handlePlayAgain}
    />
  ) : null;

  return (
    <>
      <BattleStageShell overlay={battleHud}>
        {stageCanvases}
      </BattleStageShell>
      {resultOverlay}
    </>
  );
}
