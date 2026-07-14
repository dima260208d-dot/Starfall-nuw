import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GameMode } from "../App";
import MapThumbCanvas from "../components/MapThumbCanvas";
import ModeSelectCard from "../components/ModeSelectCard";
import { getModeCardDef, MODE_CARD_W } from "../data/modeCardDefs";
import { useI18n, modeName } from "../i18n";
import { Tr } from "../i18n/Tr";
import { publicAssetBase, brawlerAvatarUrl } from "../utils/modeAssets";
import { resolvePublicAssetUrl } from "../lib/assetBase";
import {
  getRandomModePool,
  getUnlockedBrawlerPool,
  pickRandomMapForMode,
  pickRandomModeFromPool,
  pickRandomUnlockedBrawler,
} from "../utils/randomModePool";
import { setRandomBattleSession } from "../utils/randomBattleSession";
import { getSavedMaps } from "../utils/mapEditorAPI";
import {
  startMatchmakingEngine,
  type MatchmakingSnapshot,
} from "../utils/matchmaking/matchmakingEngine";
import { pickRandomMatchTip } from "../utils/matchmaking/matchTips";
import { getMatchmakingTotalPlayers, getMatchmakingInitialFound } from "../utils/matchmaking/matchmakingConfig";
import { getCurrentProfile, setSelectedBrawler } from "../utils/localStorageAPI";
import { BRAWLERS } from "../entities/BrawlerData";

type FlowPhase = "mode_roulette" | "mode_reveal" | "brawler_roulette" | "brawler_reveal" | "launch";

const ROULETTE_MAP_SIZE = 220;
const ROULETTE_TICK_MS = 80;
const ROULETTE_FINAL_TICKS_MIN = 18;
const ROULETTE_FINAL_TICKS_EXTRA = 12;
const BRAWLER_SPIN_WARMUP_MS = 1200;
const REVEAL_HOLD_MS = 3200;

function pickRouletteIdx(length: number, prevIdx: number): number {
  if (length <= 1) return 0;
  let idx: number;
  do {
    idx = Math.floor(Math.random() * length);
  } while (idx === prevIdx);
  return idx;
}

interface RandomMatchFlowPageProps {
  onBack: () => void;
  onStartBattle: (mode: GameMode, brawlerId: string, mapId: string | null) => void;
}

export default function RandomMatchFlowPage({ onBack, onStartBattle }: RandomMatchFlowPageProps) {
  const { t, locale } = useI18n();
  const profile = getCurrentProfile();
  const modePool = useMemo(() => getRandomModePool(), []);
  const brawlerPool = useMemo(() => getUnlockedBrawlerPool(), []);

  const [phase, setPhase] = useState<FlowPhase>("mode_roulette");
  const [modeSpinIdx, setModeSpinIdx] = useState(0);
  const [brawlerSpinIdx, setBrawlerSpinIdx] = useState(0);
  const [modeStopped, setModeStopped] = useState(false);
  const [brawlerStopped, setBrawlerStopped] = useState(false);
  const [brawlerSpinReady, setBrawlerSpinReady] = useState(false);
  const [pickedMode, setPickedMode] = useState<GameMode | null>(null);
  const [pickedMapId, setPickedMapId] = useState<string | null>(null);
  const [pickedBrawlerId, setPickedBrawlerId] = useState<string | null>(null);
  const [mmSnap, setMmSnap] = useState<MatchmakingSnapshot>(() => ({
    totalPlayers: 6,
    foundPlayers: 1,
    isComplete: false,
    canCancel: true,
    serverFilled: 0,
  }));
  const [tip, setTip] = useState(() => pickRandomMatchTip(undefined, locale));
  const [mmComplete, setMmComplete] = useState(false);
  const modeFinalizeStarted = useRef(false);
  const brawlerFinalizeStarted = useRef(false);
  const launched = useRef(false);
  const modeSpinPrev = useRef(-1);
  const brawlerSpinPrev = useRef(-1);

  const mmTotal = getMatchmakingTotalPlayers({ mode: "random" as GameMode });
  const mmInitial = getMatchmakingInitialFound(1, mmTotal);

  useEffect(() => {
    setMmSnap((s) => ({ ...s, totalPlayers: mmTotal, foundPlayers: mmInitial }));
    const engine = startMatchmakingEngine({
      totalPlayers: mmTotal,
      initialFound: mmInitial,
      seed: (Date.now() ^ 0x9c3a1f) >>> 0,
      onUpdate: setMmSnap,
      onComplete: () => setMmComplete(true),
    });
    return () => engine.stop();
  }, [mmTotal, mmInitial]);

  useEffect(() => {
    const id = window.setInterval(() => setTip((prev) => pickRandomMatchTip(prev, locale)), 5200);
    return () => window.clearInterval(id);
  }, [locale]);

  const rouletteModes = useMemo(
    () =>
      (modePool.length > 0 ? modePool : (["showdown"] as GameMode[])).map((id) => {
        const def = getModeCardDef(id);
        return {
          id,
          color: def?.color ?? "#CE93D8",
          name: modeName(id, def?.name ?? id),
          subtitle: def ? t(def.subtitleKey) : "",
          desc: def ? t(def.descKey) : "",
          players: def ? t(def.playersKey) : "",
        };
      }),
    [modePool, t],
  );

  const rouletteBrawlers = useMemo(
    () => (brawlerPool.length > 0 ? brawlerPool : ["hana"]),
    [brawlerPool],
  );

  // Mode roulette — spin until matchmaking completes (same cadence as ranked).
  useEffect(() => {
    if (phase !== "mode_roulette" || modeStopped || mmComplete) return;
    const id = setInterval(() => {
      setModeSpinIdx((prev) => {
        const next = pickRouletteIdx(rouletteModes.length, modeSpinPrev.current);
        modeSpinPrev.current = next;
        return next;
      });
    }, ROULETTE_TICK_MS);
    return () => clearInterval(id);
  }, [phase, modeStopped, mmComplete, rouletteModes.length]);

  // Finalize mode when matchmaking complete (do not depend on spin index — avoids infinite spin).
  useEffect(() => {
    if (!mmComplete || phase !== "mode_roulette" || modeStopped || modeFinalizeStarted.current) return;
    modeFinalizeStarted.current = true;

    const pool = modePool.length > 0 ? modePool : (["showdown"] as GameMode[]);
    const finalMode = pickRandomModeFromPool(pool);
    const finalMap = pickRandomMapForMode(finalMode);
    const finalIdx = Math.max(0, rouletteModes.findIndex((m) => m.id === finalMode));
    let tick = 0;
    let prevIdx = modeSpinPrev.current;
    const totalTicks = ROULETTE_FINAL_TICKS_MIN + Math.floor(Math.random() * ROULETTE_FINAL_TICKS_EXTRA);

    const id = setInterval(() => {
      tick++;
      if (tick < totalTicks) {
        const next = pickRouletteIdx(rouletteModes.length, prevIdx);
        prevIdx = next;
        modeSpinPrev.current = next;
        setModeSpinIdx(next);
      } else {
        clearInterval(id);
        modeSpinPrev.current = finalIdx;
        setModeSpinIdx(finalIdx);
        setPickedMode(finalMode);
        setPickedMapId(finalMap);
        setModeStopped(true);
        setTimeout(() => setPhase("mode_reveal"), 700);
      }
    }, ROULETTE_TICK_MS);

    return () => clearInterval(id);
  }, [mmComplete, phase, modeStopped, modePool, rouletteModes]);

  useEffect(() => {
    if (phase !== "mode_reveal") return;
    const id = setTimeout(() => {
      setPhase("brawler_roulette");
      setBrawlerStopped(false);
      setBrawlerSpinReady(false);
      brawlerFinalizeStarted.current = false;
      brawlerSpinPrev.current = -1;
    }, REVEAL_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase]);

  // Warm-up brawler spin before finalize (mirrors ranked mm + roulette pacing).
  useEffect(() => {
    if (phase !== "brawler_roulette") return;
    const id = setTimeout(() => setBrawlerSpinReady(true), BRAWLER_SPIN_WARMUP_MS);
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "brawler_roulette" || brawlerStopped || brawlerSpinReady) return;
    const id = setInterval(() => {
      setBrawlerSpinIdx((prev) => {
        const next = pickRouletteIdx(rouletteBrawlers.length, brawlerSpinPrev.current);
        brawlerSpinPrev.current = next;
        return next;
      });
    }, ROULETTE_TICK_MS);
    return () => clearInterval(id);
  }, [phase, brawlerStopped, brawlerSpinReady, rouletteBrawlers.length]);

  // Finalize brawler after warm-up spin.
  useEffect(() => {
    if (phase !== "brawler_roulette" || !brawlerSpinReady || brawlerStopped || brawlerFinalizeStarted.current) return;
    brawlerFinalizeStarted.current = true;

    const finalBrawler = pickRandomUnlockedBrawler(rouletteBrawlers);
    const finalIdx = Math.max(0, rouletteBrawlers.indexOf(finalBrawler));
    let tick = 0;
    let prevIdx = brawlerSpinPrev.current;
    const totalTicks = ROULETTE_FINAL_TICKS_MIN + Math.floor(Math.random() * ROULETTE_FINAL_TICKS_EXTRA);

    const id = setInterval(() => {
      tick++;
      if (tick < totalTicks) {
        const next = pickRouletteIdx(rouletteBrawlers.length, prevIdx);
        prevIdx = next;
        brawlerSpinPrev.current = next;
        setBrawlerSpinIdx(next);
      } else {
        clearInterval(id);
        brawlerSpinPrev.current = finalIdx;
        setBrawlerSpinIdx(finalIdx);
        setPickedBrawlerId(finalBrawler);
        setBrawlerStopped(true);
        setTimeout(() => setPhase("brawler_reveal"), 700);
      }
    }, ROULETTE_TICK_MS);

    return () => clearInterval(id);
  }, [phase, brawlerSpinReady, brawlerStopped, rouletteBrawlers]);

  const launchBattle = useCallback(() => {
    if (!pickedMode || !pickedBrawlerId || launched.current) return;
    launched.current = true;
    setSelectedBrawler(pickedBrawlerId);
    setRandomBattleSession({
      active: true,
      resolvedMode: pickedMode,
      mapId: pickedMapId,
      brawlerId: pickedBrawlerId,
      petId: profile?.equippedPetId ?? null,
    });
    onStartBattle(pickedMode, pickedBrawlerId, pickedMapId);
  }, [pickedMode, pickedBrawlerId, pickedMapId, profile?.equippedPetId, onStartBattle]);

  useEffect(() => {
    if (phase !== "brawler_reveal") return;
    const id = setTimeout(() => {
      setPhase("launch");
      launchBattle();
    }, REVEAL_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase, launchBattle]);

  const centerMode = rouletteModes[modeSpinIdx];
  const centerBrawlerId = rouletteBrawlers[brawlerSpinIdx];
  const centerBrawlerName = BRAWLERS.find((b) => b.id === centerBrawlerId)?.name ?? centerBrawlerId;
  const mapSave = pickedMapId ? getSavedMaps().find((m) => m.id === pickedMapId) ?? null : null;
  const menuBgImage = `url("${resolvePublicAssetUrl("main-menu-bg.png")}")`;
  const showModeTape = phase === "mode_roulette" || phase === "mode_reveal";
  const showBrawlerTape = phase === "brawler_roulette" || phase === "brawler_reveal";
  const showExitBtn = (showModeTape || showBrawlerTape) && mmSnap.canCancel;
  const compact = typeof window !== "undefined" && (window.innerWidth < 900 || window.innerHeight < 520);
  const starSrc = `${publicAssetBase}matchmaking-star.png`;

  return (
    <>
      <style>{`
        @keyframes rankedModeFlash {
          0% { opacity: 0.7; filter: brightness(0.92); }
          100% { opacity: 1; filter: brightness(1); }
        }
        @keyframes rankedStarSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          color: "#fff",
          overflow: "hidden",
          backgroundImage: menuBgImage,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#0a0028",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(ellipse at 50% 55%, transparent 35%, rgba(6,0,30,0.45) 100%)",
            zIndex: 0,
          }}
        />
        <div style={{ position: "relative", zIndex: 1, height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 16, display: "flex", alignItems: "center", flexShrink: 0 }}>
            {showExitBtn && (
              <button type="button" className="ui-back-btn" onClick={onBack}>
                <Tr id="common.back" />
              </button>
            )}
            <h1
              style={{
                flex: 1,
                textAlign: "center",
                margin: 0,
                fontSize: 22,
                fontWeight: 900,
                letterSpacing: "0.08em",
                paddingLeft: showExitBtn ? 0 : 8,
                paddingRight: showExitBtn ? 0 : 8,
              }}
            >
              <Tr id="random.matchTitle" />
            </h1>
            {showExitBtn && <div style={{ width: 88 }} />}
          </div>

          {showModeTape && centerMode && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 0 28px", minHeight: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  color: modeStopped ? "#69F0AE" : "rgba(255,255,255,0.75)",
                  marginBottom: 18,
                  textTransform: "uppercase",
                }}
              >
                {!mmComplete ? t("random.rouletteMode") : modeStopped ? t("random.modePicked") : t("random.rouletteMode")}
              </div>
              <div style={{ width: "100%", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
                {(() => {
                  const showMap = modeStopped && !!mapSave;
                  return (
                    <div
                      key={modeStopped ? centerMode.id : `${centerMode.id}-${modeSpinIdx}`}
                      style={{
                        position: "relative",
                        width: MODE_CARD_W,
                        transform: modeStopped ? "scale(1.06)" : "scale(1)",
                        transformOrigin: "center center",
                        transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
                        animation: modeStopped ? "none" : "rankedModeFlash 0.07s ease",
                      }}
                    >
                      <ModeSelectCard
                        modeId={centerMode.id}
                        name={centerMode.name}
                        subtitle={centerMode.subtitle}
                        desc={showMap ? "" : centerMode.desc}
                        players={centerMode.players}
                        color={centerMode.color}
                        highlighted
                        mapFooter={showMap}
                        style={showMap ? { paddingBottom: ROULETTE_MAP_SIZE + 36 } : undefined}
                      />
                      {showMap && (
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: 14,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                            pointerEvents: "none",
                          }}
                        >
                          <MapThumbCanvas map={mapSave} size={ROULETTE_MAP_SIZE} bare />
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "rgba(255,255,255,0.65)",
                              textAlign: "center",
                              lineHeight: 1.2,
                              maxWidth: ROULETTE_MAP_SIZE + 12,
                            }}
                          >
                            {mapSave.name}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {showBrawlerTape && centerBrawlerId && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 0 28px", minHeight: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  color: brawlerStopped ? "#69F0AE" : "rgba(255,255,255,0.75)",
                  marginBottom: 18,
                  textTransform: "uppercase",
                }}
              >
                {brawlerStopped ? t("random.brawlerPicked") : t("random.rouletteBrawler")}
              </div>
              <div
                key={brawlerStopped ? centerBrawlerId : `${centerBrawlerId}-${brawlerSpinIdx}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                  transform: brawlerStopped ? "scale(1.06)" : "scale(1)",
                  transformOrigin: "center center",
                  transition: "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
                  animation: brawlerStopped ? "none" : "rankedModeFlash 0.07s ease",
                }}
              >
                <div
                  style={{
                    width: compact ? 160 : 200,
                    height: compact ? 160 : 200,
                    borderRadius: "50%",
                    border: brawlerStopped ? "4px solid #69F0AE" : "4px solid rgba(255,255,255,0.45)",
                    overflow: "hidden",
                    background: "rgba(0,0,0,0.35)",
                    boxShadow: brawlerStopped ? "0 0 32px rgba(105,240,174,0.45)" : "0 8px 28px rgba(0,0,0,0.45)",
                  }}
                >
                  <img
                    src={brawlerAvatarUrl(centerBrawlerId)}
                    alt=""
                    draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div
                  style={{
                    fontSize: compact ? 18 : 22,
                    fontWeight: 900,
                    letterSpacing: "0.06em",
                    color: brawlerStopped ? "#69F0AE" : "rgba(255,255,255,0.88)",
                    textShadow: "0 2px 12px rgba(0,0,0,0.75)",
                  }}
                >
                  {centerBrawlerName}
                </div>
              </div>
            </div>
          )}

          {(showModeTape || showBrawlerTape) && (
            <div style={{ flexShrink: 0, padding: compact ? "0 12px 12px" : "0 20px 20px", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: compact ? 10 : 16 }}>
                <div
                  style={{
                    width: compact ? 44 : 56,
                    height: compact ? 44 : 56,
                    flexShrink: 0,
                    animation: "rankedStarSpin 5s linear infinite",
                    transformOrigin: "center center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img src={starSrc} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                </div>
                <div style={{ fontSize: compact ? 28 : 36, fontWeight: 900, letterSpacing: "0.05em", textShadow: "0 2px 16px rgba(0,0,0,0.85)" }}>
                  <Tr id="matchmaking.playersFound" params={{ found: mmSnap.foundPlayers, total: mmSnap.totalPlayers }} />
                </div>
              </div>
              <p style={{ margin: compact ? "10px 0 0" : "12px auto 0", maxWidth: 640, fontSize: compact ? 12 : 14, lineHeight: 1.45, color: "rgba(255,255,255,0.82)", fontWeight: 600 }}>
                {tip}
              </p>
            </div>
          )}
        </div>

        {showExitBtn && (
          <button
            type="button"
            className="ui-btn ui-btn--shear"
            onClick={onBack}
            style={{
              position: "absolute",
              right: compact ? 12 : 22,
              bottom: compact ? 14 : 22,
              zIndex: 5,
              padding: compact ? "10px 18px" : "12px 24px",
              fontSize: compact ? 13 : 15,
              fontWeight: 800,
              color: "#fff",
              ["--ui-shear-fill" as string]: "rgba(120,20,40,0.72)",
              ["--ui-shear-border" as string]: "rgba(255,120,120,0.55)",
            }}
          >
            <Tr id="matchmaking.cancel" />
          </button>
        )}
      </div>
    </>
  );
}
