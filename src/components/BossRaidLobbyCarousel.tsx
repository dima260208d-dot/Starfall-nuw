import { memo, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { BRAWLERS, type BrawlerStats } from "../entities/BrawlerData";
import BrawlerViewer3D from "./BrawlerViewer3D";
import ChestVisual from "./ChestVisual";
import { CoinIcon, PowerIcon } from "./GameIcons";
import { getCurrentProfile } from "../utils/localStorageAPI";
import { getBossRaidCurrentLevel, isBossRaidLevelFirstClearDone } from "../utils/bossRaidProgress";
import { getBossRaidLevelReward, type BossRaidLevelReward } from "../utils/bossRaidRewards";
import { CHESTS, type ChestRarity } from "../utils/chests";
import { BRAWLER_RARITY_LABEL } from "../entities/BrawlerData";
import { useI18n, brawlerName, brawlerRole, brawlerRarityLabel, chestName } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

interface BossRaidLobbyCarouselProps {
  onSelectBoss: (bossId: string) => void;
}

/** 3D через общий SpinningModel3D (один canvas), как в остальном UI. */
function LevelRewardIcons({ reward }: { reward: BossRaidLevelReward }) {
  const n: CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "nowrap",
        minWidth: 0,
      }}
    >
      {reward.coins > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <CoinIcon size={13} />
          <span style={n}>{reward.coins}</span>
        </span>
      )}
      {reward.powerPoints > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          <PowerIcon size={13} />
          <span style={n}>{reward.powerPoints}</span>
        </span>
      )}
    </div>
  );
}

/** Без SpinningModel3D — на неактивных карточках, чтобы не плодить десятки 3D-иконок в общем цикле. */
function LevelRewardCompact({ reward }: { reward: BossRaidLevelReward }) {
  const n: CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 1,
    whiteSpace: "nowrap",
  };
  const dot = (bg: string) => (
    <span style={{ width: 6, height: 6, borderRadius: "50%", background: bg, flexShrink: 0 }} />
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "nowrap", minWidth: 0 }}>
      {reward.coins > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {dot("#FFD54F")}
          <span style={n}>{reward.coins}</span>
        </span>
      )}
      {reward.powerPoints > 0 && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {dot("#CE93D8")}
          <span style={n}>{reward.powerPoints}</span>
        </span>
      )}
    </div>
  );
}

function ChestRarityMini({ rarity }: { rarity: ChestRarity }) {
  const def = CHESTS[rarity];
  return (
    <div
      title={chestName(rarity)}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        border: `1px solid ${def.borderColor}`,
        background: `linear-gradient(145deg, ${def.color}33, rgba(0,0,0,0.35))`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      {def.emoji}
    </div>
  );
}

type BossRaidLobbyCardProps = {
  b: BrawlerStats;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  onSelectBoss: (bossId: string) => void;
  current: number;
};

const BossRaidLobbyCard = memo(function BossRaidLobbyCard({
  b,
  scrollRootRef,
  onSelectBoss,
  current,
}: BossRaidLobbyCardProps) {
  const { t } = useI18n();
  const profile = getCurrentProfile();
  const cardRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    const root = scrollRootRef.current;
    if (!el) return;
    if (!root) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target !== el) continue;
          const vis = e.isIntersecting && e.intersectionRatio > 0.06;
          setInView(vis);
        }
      },
      { root, rootMargin: "0px", threshold: [0, 0.08, 0.15, 0.3] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRootRef]);

  return (
    <div
      ref={cardRef}
      data-boss-lobby-card
      data-boss-id={b.id}
      style={{
        flex: "0 0 min(92vw, 480px)",
        scrollSnapAlign: "center",
        borderRadius: "var(--r-xl)",
        border: "1px solid var(--bd-gold)",
        background: "linear-gradient(160deg, rgba(60,20,80,0.78), rgba(25,15,45,0.94), rgba(40,25,70,0.86))",
        boxShadow: "0 18px 48px rgba(0,0,0,0.45), 0 0 32px rgba(213,0,249,0.18), inset 0 1px 0 rgba(255,255,255,0.08)",
        padding: 8,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        contentVisibility: "auto",
        backdropFilter: "blur(14px) saturate(1.18)",
        WebkitBackdropFilter: "blur(14px) saturate(1.18)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "row", gap: 8, flex: 1, minHeight: 0, alignItems: "stretch" }}>
        <div
          style={{
            flex: "0 0 42%",
            maxWidth: 200,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              flex: 1,
              minHeight: 172,
              height: 172,
              borderRadius: 14,
              background: "radial-gradient(ellipse at center, rgba(126,87,194,0.38), rgba(0,0,0,0.52))",
              border: "1px solid rgba(255,255,255,0.12)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 256,
                height: 256,
                transform: "translate(-50%, calc(-50% + 18px))",
                pointerEvents: "auto",
              }}
            >
              <BrawlerViewer3D
                brawlerId={b.id}
                color={b.color}
                size={220}
                pixelRatioCap={1}
                efficientPreview
                paused={!inView}
              />
            </div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, marginTop: 4, textAlign: "center", lineHeight: 1.1 }}>
            {brawlerName(b.id, b.name)}
          </div>
          <div style={{ fontSize: 9, opacity: 0.76, textAlign: "center", marginTop: 1 }}>
            {brawlerRole(b.id, b.role)} · {brawlerRarityLabel(b.rarity, BRAWLER_RARITY_LABEL[b.rarity])}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.95)", lineHeight: 1.1 }}>
            <Tr id="bossRaid.levelsRewards" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 1 }}>
            {[1, 2, 3, 4, 5].map((lv) => {
              const done = isBossRaidLevelFirstClearDone(profile, b.id, lv);
              const locked = lv > current;
              const reward = getBossRaidLevelReward(b.id, lv);
              return (
                <div
                  key={lv}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 5px",
                    borderRadius: 8,
                    background: locked ? "rgba(0,0,0,0.38)" : done ? "rgba(30,40,55,0.88)" : "rgba(60,40,90,0.42)",
                    border: `1px solid ${done ? "rgba(100,200,120,0.28)" : "rgba(255,255,255,0.1)"}`,
                    opacity: locked ? 0.68 : 1,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 900,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      width: 38,
                      letterSpacing: 0.1,
                    }}
                  >
                    <Tr id="common.levelShort" /> {lv}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "row",
                      flexWrap: "nowrap",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      gap: 4,
                      overflow: "hidden",
                    }}
                  >
                    {reward && (inView ? <LevelRewardIcons reward={reward} /> : <LevelRewardCompact reward={reward} />)}
                    {reward?.chest && (
                      <div
                        style={{
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transform: inView ? "translateX(-2px) scale(0.55)" : "translateX(-1px)",
                          transformOrigin: "center center",
                          width: inView ? 34 : 28,
                          height: inView ? 34 : 28,
                        }}
                      >
                        {inView ? (
                          <ChestVisual rarity={reward.chest.rarity} size={62} animated={!locked} />
                        ) : (
                          <ChestRarityMini rarity={reward.chest.rarity} />
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      flexShrink: 0,
                      width: 46,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                    }}
                  >
                    {done && (
                      <span
                        style={{
                          color: "#66bb6a",
                          fontSize: 22,
                          fontWeight: 900,
                          lineHeight: 1,
                          textShadow: "0 0 10px rgba(102,187,106,0.55)",
                        }}
                        aria-hidden
                      >
                        <EmojiIcon emoji="✓" size={20} />
                      </span>
                    )}
                    {locked && (
                      <span style={{ fontSize: 9, fontWeight: 800, opacity: 0.72, lineHeight: 1.05 }}>
                        <Tr id="bossRaid.locked" />
                      </span>
                    )}
                    {!locked && !done && lv === current && (
                      <span style={{ color: "#ffd54f", fontSize: 10, fontWeight: 900, lineHeight: 1.05 }}>
                        <Tr id="common.now" />
                      </span>
                    )}
                    {!locked && !done && lv !== current && (
                      <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 700 }}>—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onSelectBoss(b.id)}
        className="ui-btn ui-btn--accent"
        style={{
          marginTop: 4,
          width: "100%",
          padding: "10px 0",
          letterSpacing: "0.16em",
        }}
      >
        <Tr id="char.select" />
      </button>
    </div>
  );
});

export default function BossRaidLobbyCarousel({ onSelectBoss }: BossRaidLobbyCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [, setRefresh] = useState(0);
  const profile = getCurrentProfile();

  useEffect(() => {
    const bump = () => setRefresh((n) => n + 1);
    const t = window.setInterval(bump, 8000);
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", bump);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", bump);
    };
  }, []);

  const mid = Math.ceil(BRAWLERS.length / 2);
  const topRow = BRAWLERS.slice(0, mid);
  const bottomRow = BRAWLERS.slice(mid);

  const renderCard = (b: BrawlerStats) => (
    <BossRaidLobbyCard
      key={b.id}
      b={b}
      scrollRootRef={scrollRef}
      onSelectBoss={onSelectBoss}
      current={getBossRaidCurrentLevel(profile, b.id)}
    />
  );

  return (
    <div
      ref={scrollRef}
      style={{
        width: "100%",
        maxWidth: 1120,
        overflowX: "auto",
        padding: "4px 8px 6px",
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "safe center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "row", gap: 14, flexShrink: 0 }}>
          {topRow.map(renderCard)}
        </div>
        <div style={{ display: "flex", flexDirection: "row", gap: 14, flexShrink: 0 }}>
          {bottomRow.map(renderCard)}
        </div>
      </div>
    </div>
  );
}
