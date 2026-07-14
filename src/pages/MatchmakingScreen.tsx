import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PARTY_CHANGED_EVENT,
  amIMatchmakingLeader,
  beginPartyMatchmaking,
  cancelPartyMatchmaking,
  clearPartyMatchmaking,
  completePartyMatchmaking,
  getPartyMatchmaking,
  getPartyMemberCount,
  syncPartyMatchmakingFound,
} from "../utils/social/party";
import {
  startMatchmakingEngine,
  snapshotAtElapsed,
  buildSlotArrivalTimes,
  type MatchmakingSnapshot,
} from "../utils/matchmaking/matchmakingEngine";
import { pickRandomMatchTip } from "../utils/matchmaking/matchTips";
import { preloadIntroBrawlerModels } from "../utils/battleIntro/battleIntroPreload";
import { getCurrentProfile } from "../utils/localStorageAPI";
import { getMyPartyRoom } from "../utils/social/party";
import { publicAssetBase } from "../utils/modeAssets";
import { resolvePublicAssetUrl } from "../lib/assetBase";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

export interface MatchmakingScreenProps {
  totalPlayers: number;
  initialFound: number;
  /** Ранговый бой — режим выберется после набора игроков. */
  ranked?: boolean;
  modeHint?: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function MatchmakingScreen({
  totalPlayers,
  initialFound,
  ranked = false,
  modeHint,
  onComplete,
  onCancel,
}: MatchmakingScreenProps) {
  const { t, locale } = useI18n();
  const menuBg = `url("${resolvePublicAssetUrl("main-menu-bg.png")}")`;
  const starSrc = resolvePublicAssetUrl("matchmaking-star.png");

  const inParty = getPartyMemberCount() > 0;
  const [snap, setSnap] = useState<MatchmakingSnapshot>(() => ({
    totalPlayers,
    foundPlayers: initialFound,
    isComplete: initialFound >= totalPlayers,
    canCancel: initialFound < totalPlayers,
    serverFilled: 0,
  }));
  const [tip, setTip] = useState(() => pickRandomMatchTip(undefined, locale));
  const prevTip = useRef(tip);
  const completedRef = useRef(false);
  const cancelledRef = useRef(false);

  const session = useMemo(() => {
    const partyMm = getPartyMatchmaking();
    if (partyMm?.status === "searching") {
      return {
        seed: partyMm.seed,
        startedAt: partyMm.startedAt,
        initialFound: partyMm.initialFound,
        total: partyMm.totalPlayers,
      };
    }
    return {
      seed: (Date.now() ^ totalPlayers) >>> 0,
      startedAt: Date.now(),
      initialFound,
      total: totalPlayers,
    };
  }, [initialFound, totalPlayers]);

  const finishComplete = useCallback(() => {
    if (completedRef.current || cancelledRef.current) return;
    completedRef.current = true;
    if (inParty && amIMatchmakingLeader()) {
      completePartyMatchmaking();
    }
    onComplete();
  }, [inParty, onComplete]);

  const finishCancel = useCallback(() => {
    if (completedRef.current || cancelledRef.current) return;
    cancelledRef.current = true;
    if (inParty) {
      cancelPartyMatchmaking();
    } else {
      clearPartyMatchmaking();
    }
    onCancel();
  }, [inParty, onCancel]);

  useEffect(() => {
    const profile = getCurrentProfile();
    const ids = new Set<string>();
    if (profile?.selectedBrawlerId) ids.add(profile.selectedBrawlerId);
    for (const mate of getMyPartyRoom()?.members ?? []) {
      if (mate.brawlerId) ids.add(mate.brawlerId);
    }
    if (ids.size > 0) preloadIntroBrawlerModels([...ids]);
  }, []);

  useEffect(() => {
    if (inParty && amIMatchmakingLeader()) {
      beginPartyMatchmaking(totalPlayers, initialFound);
    }
  }, [inParty, totalPlayers, initialFound]);

  useEffect(() => {
    if (!inParty) return;
    const onParty = () => {
      const mm = getPartyMatchmaking();
      if (!mm) return;
      if (mm.status === "cancelled") {
        finishCancel();
        return;
      }
      if (mm.status === "complete") {
        setSnap(s => ({
          ...s,
          foundPlayers: mm.totalPlayers,
          isComplete: true,
          canCancel: false,
        }));
        finishComplete();
        return;
      }
      if (!amIMatchmakingLeader()) {
        setSnap(s => ({
          ...s,
          foundPlayers: mm.foundPlayers,
          isComplete: mm.foundPlayers >= mm.totalPlayers,
          canCancel: mm.foundPlayers < mm.totalPlayers,
        }));
      }
    };
    window.addEventListener(PARTY_CHANGED_EVENT, onParty);
    return () => window.removeEventListener(PARTY_CHANGED_EVENT, onParty);
  }, [inParty, finishCancel, finishComplete]);

  useEffect(() => {
    if (completedRef.current || cancelledRef.current) return;

    const partyMm = getPartyMatchmaking();
    const seed = partyMm?.seed ?? session.seed;
    const startedAt = partyMm?.startedAt ?? session.startedAt;
    const init = partyMm?.initialFound ?? initialFound;
    const total = partyMm?.totalPlayers ?? totalPlayers;

    if (inParty && !amIMatchmakingLeader()) {
      const arrivalTimes = buildSlotArrivalTimes(Math.max(0, total - init), seed);
      const id = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const next = snapshotAtElapsed(total, init, arrivalTimes, elapsed);
        setSnap(next);
        if (next.isComplete) finishComplete();
      }, 120);
      return () => window.clearInterval(id);
    }

    const engine = startMatchmakingEngine({
      totalPlayers: total,
      initialFound: init,
      seed,
      onUpdate: (next) => {
        setSnap(next);
        if (inParty && amIMatchmakingLeader()) {
          syncPartyMatchmakingFound(next.foundPlayers);
        }
      },
      onComplete: finishComplete,
    });

    return () => engine.stop();
  }, [
    inParty,
    initialFound,
    totalPlayers,
    session.seed,
    session.startedAt,
    finishComplete,
  ]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTip(prev => {
        const next = pickRandomMatchTip(prev, locale);
        prevTip.current = next;
        return next;
      });
    }, 5200);
    return () => window.clearInterval(id);
  }, []);

  const compact = typeof window !== "undefined"
    && (window.innerWidth < 900 || window.innerHeight < 520);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 120,
        color: "#fff",
        overflow: "hidden",
        backgroundImage: menuBg,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#0a0028",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <style>{`
        @keyframes matchStarSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes matchCountPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 55%, transparent 35%, rgba(6,0,30,0.45) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: compact ? "16px 14px 88px" : "24px 24px 100px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            minHeight: 0,
          }}
        >
          <div
            style={{
              width: compact ? "min(62vw, 280px)" : "min(42vw, 360px)",
              height: compact ? "min(62vw, 280px)" : "min(42vw, 360px)",
              flexShrink: 0,
              animation: "matchStarSpin 6s linear infinite",
              transformOrigin: "center center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={starSrc}
              alt=""
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
                userSelect: "none",
              }}
            />
          </div>
        </div>

        <div style={{ textAlign: "center", width: "100%", maxWidth: 720, flexShrink: 0 }}>
          <div
            key={snap.foundPlayers}
            style={{
              fontSize: compact ? 34 : 48,
              fontWeight: 900,
              letterSpacing: "0.06em",
              textShadow: "0 4px 24px rgba(0,0,0,0.85), 0 0 40px rgba(255,200,100,0.35)",
              animation: "matchCountPop 0.35s ease-out",
              lineHeight: 1.1,
            }}
          >
            <Tr id="matchmaking.playersFound" params={{
              found: snap.foundPlayers,
              total: snap.totalPlayers,
            }} />
          </div>

          <div
            style={{
              marginTop: compact ? 10 : 14,
              fontSize: compact ? 13 : 16,
              fontWeight: 700,
              color: ranked ? "#E1BEE7" : "rgba(255,255,255,0.82)",
              textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            }}
          >
            {ranked
              ? t("matchmaking.rankedModeLater")
              : modeHint ?? t("matchmaking.searching")}
          </div>

          <div
            style={{
              marginTop: compact ? 18 : 26,
              padding: compact ? "12px 14px" : "14px 20px",
              borderRadius: 14,
              background: "rgba(8,4,28,0.55)",
              border: "1px solid rgba(255,255,255,0.12)",
              backdropFilter: "blur(8px)",
              minHeight: compact ? 52 : 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: compact ? 13 : 15,
                lineHeight: 1.45,
                color: "rgba(255,255,255,0.88)",
                fontWeight: 600,
              }}
            >
              {tip}
            </p>
          </div>
        </div>
      </div>

      {snap.canCancel && (
        <button
          type="button"
          className="ui-btn ui-btn--shear"
          onClick={finishCancel}
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
  );
}
