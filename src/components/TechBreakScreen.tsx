import { useEffect, useMemo, useState } from "react";
import {
  getNewsCategories,
  getNewsSorted,
  markNewsSeen,
  isNewsUnread,
  type NewsCategory,
  type NewsItem,
} from "../utils/news";
import { getCurrentUsername } from "../utils/localStorageAPI";
import NewsUnreadDot from "./NewsUnreadDot";
import {
  getTechBreakState,
  getTechBreakTimeDisplay,
  subscribeTechBreakChanges,
} from "../utils/techBreak";
import { useI18n } from "../i18n";
import { EmojiIcon } from "./EmojiIcon";
import { Tr } from "../i18n/Tr";

/** Базовые размеры панели до уменьшения на 20%. */
const BASE_PANEL_WIDTH = 760;
const BASE_PANEL_MAX_HEIGHT = 820;
const BASE_PANEL_VIEWPORT_W = 92;
const BASE_OUTER_PAD_TOP = 44;
const BASE_OUTER_PAD_BOTTOM = 36;
const BASE_OUTER_PAD_X = 20;

/** Множитель −20% по ширине. */
const PANEL_SCALE = 0.8;
/** Ещё −20% только по высоте, затем чуть ниже (−10%). Итого ~58% от базовой. */
const PANEL_HEIGHT_SCALE = PANEL_SCALE * 0.8 * 0.9;
const PANEL_WIDTH = BASE_PANEL_WIDTH * PANEL_SCALE;
const PANEL_MAX_HEIGHT = BASE_PANEL_MAX_HEIGHT * PANEL_HEIGHT_SCALE;
const PANEL_VIEWPORT_W = BASE_PANEL_VIEWPORT_W * PANEL_SCALE;
const px = (n: number) => n * PANEL_SCALE;

interface Props {
  showDevExit?: boolean;
  onDevExit?: () => void;
}

export default function TechBreakScreen({ showDevExit, onDevExit }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeTechBreakChanges(() => setTick(t => t + 1)), []);

  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const state = getTechBreakState();
  const timeLabel = getTechBreakTimeDisplay(state);
  const base = (import.meta as any).env?.BASE_URL ?? "/";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#06031a",
      overflow: "hidden", zIndex: 1000,
      fontFamily: "var(--app-font-sans)",
    }}>
      <img
        src={`${base}loading-battle.png`}
        alt=""
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          objectPosition: "center",
        }}
      />

      <div style={{
        position: "absolute", inset: 0,
        background: [
          "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 20%, transparent 65%, rgba(0,0,10,0.88) 100%)",
          "linear-gradient(90deg,  rgba(0,0,0,0.2)  0%, transparent 15%, transparent 85%, rgba(0,0,0,0.2)  100%)",
        ].join(", "),
        pointerEvents: "none",
      }} />

      <div style={{
        position: "absolute", top: 28, right: 32, zIndex: 5,
        lineHeight: 1, userSelect: "none", textAlign: "right",
      }}>
        <div style={{
          fontSize: 52, fontWeight: 900, letterSpacing: 6, color: "white",
          textShadow: [
            "0 0 22px rgba(255,210,0,0.95)",
            "0 0 60px rgba(200,80,255,0.75)",
            "0 3px 0 rgba(0,0,0,1)",
            "0 5px 20px rgba(0,0,0,0.95)",
          ].join(", "),
        }}>
          STARFALL
        </div>
        <div style={{
          fontSize: 12, letterSpacing: 7, color: "rgba(255,225,100,0.9)",
          marginTop: 4, textShadow: "0 0 12px rgba(255,200,0,0.8)", fontWeight: 700,
        }}>
          BATTLE ARENA
        </div>
      </div>

      <div style={{
        position: "absolute", inset: 0, zIndex: 6,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: `${BASE_OUTER_PAD_TOP}px ${BASE_OUTER_PAD_X}px ${BASE_OUTER_PAD_BOTTOM}px`,
        boxSizing: "border-box",
      }}>
        <div style={{
          width: `min(${PANEL_WIDTH}px, ${PANEL_VIEWPORT_W}vw)`,
          height: `min(${PANEL_MAX_HEIGHT}px, calc((100vh - ${BASE_OUTER_PAD_TOP + BASE_OUTER_PAD_BOTTOM}px) * ${PANEL_HEIGHT_SCALE}))`,
          maxHeight: `min(${PANEL_MAX_HEIGHT}px, calc((100vh - ${BASE_OUTER_PAD_TOP + BASE_OUTER_PAD_BOTTOM}px) * ${PANEL_HEIGHT_SCALE}))`,
          flexShrink: 0,
          display: "flex", flexDirection: "column",
          borderRadius: px(12),
          background: "rgba(8, 4, 24, 0.78)",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
          backdropFilter: "blur(14px) saturate(1.2)",
          WebkitBackdropFilter: "blur(14px) saturate(1.2)",
          overflow: "hidden",
        }}>
          <div style={{
            flexShrink: 0,
            position: "relative",
            padding: `${px(16)}px ${px(22)}px ${px(14)}px`,
            textAlign: "center",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(180deg, rgba(123,47,190,0.22), transparent)",
          }}>
            {showDevExit && onDevExit && (
              <button
                type="button"
                onClick={onDevExit}
                style={{
                  position: "absolute", top: px(10), right: px(12),
                  padding: `${px(4)}px ${px(10)}px`,
                  borderRadius: px(8),
                  border: "1px solid rgba(64,196,255,0.45)",
                  background: "rgba(64,196,255,0.12)",
                  color: "#81D4FA",
                  fontSize: px(10), fontWeight: 800,
                  letterSpacing: "0.06em",
                  cursor: "pointer",
                }}
              >
                ← ПАНЕЛЬ
              </button>
            )}
            <div style={{
              fontSize: px(10), letterSpacing: px(4), fontWeight: 800,
              color: "rgba(255,213,79,0.85)", marginBottom: px(4),
            }}>
              ТЕХНИЧЕСКОЕ ОБСЛУЖИВАНИЕ
            </div>
            <div style={{
              fontSize: px(24), fontWeight: 900, letterSpacing: px(3),
              background: "linear-gradient(135deg, #ffe57f 0%, #ffb300 40%, #d500f9 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              ТЕХ ПЕРЕРЫВ
            </div>
            <div style={{
              marginTop: px(6), fontSize: px(14), fontWeight: 800,
              color: timeLabel === "Скоро закончится" ? "#76FF03" : "rgba(255,255,255,0.88)",
            }}>
              {timeLabel}
            </div>
            <div style={{
              marginTop: px(4), fontSize: px(11), lineHeight: 1.45,
              color: "rgba(255,255,255,0.52)",
            }}>
              Игра временно недоступна. Мы улучшаем STARFALL — скоро вернёмся!
            </div>
          </div>

          <MiniNewsPanel tick={tick} />
        </div>
      </div>
    </div>
  );
}

function MiniNewsPanel({ tick }: { tick: number }) {
  const { t } = useI18n();
  const items = useMemo(() => getNewsSorted(), [tick]);
  const cats = useMemo(() => getNewsCategories(), [tick]);
  const [activeId, setActiveId] = useState<string | null>(() => items[0]?.id ?? null);
  const [filter, setFilter] = useState<string>("all");
  const [seenTick, setSeenTick] = useState(0);
  const user = getCurrentUsername();

  const markSeen = (id: string) => {
    if (!user) return;
    markNewsSeen(user, id);
    setSeenTick((n) => n + 1);
  };

  const selectNews = (id: string) => {
    setActiveId(id);
    markSeen(id);
  };

  useEffect(() => {
    if (!items.some(n => n.id === activeId)) {
      setActiveId(items[0]?.id ?? null);
    }
  }, [items, activeId]);

  const visible = useMemo(() => (
    filter === "all" ? items : items.filter(n => n.categoryId === filter)
  ), [items, filter]);

  const active = visible.find(n => n.id === activeId)
    ?? items.find(n => n.id === activeId)
    ?? visible[0]
    ?? null;

  useEffect(() => {
    if (active && user) markSeen(active.id);
  }, [active?.id, user]);

  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: "flex", flexDirection: "column",
      borderTop: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{
        flexShrink: 0,
        display: "flex", gap: px(6), padding: `${px(8)}px ${px(12)}px`,
        overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.22)",
        WebkitOverflowScrolling: "touch",
      }}>
        <NewsChip active={filter === "all"} color="#FFD54F" onClick={() => setFilter("all")}>
          <Tr id="news.allCount" params={{ count: items.length }} />
        </NewsChip>
        {cats.map(c => {
          const count = items.filter(n => n.categoryId === c.id).length;
          if (count === 0) return null;
          return (
            <NewsChip key={c.id} active={filter === c.id} color={c.color} onClick={() => setFilter(c.id)}>
              <EmojiIcon emoji={c.icon} size={18} /> {c.label} ({count})
            </NewsChip>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.55)", textAlign: "center", padding: 24,
        }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}><EmojiIcon emoji="📭" size={24} /></div>
          <div style={{ fontSize: 14, fontWeight: 800 }}><Tr id="news.emptyTitle" /></div>
          <div style={{ fontSize: 11, marginTop: 4, maxWidth: 320 }}><Tr id="news.emptyHint" /></div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
          <div style={{
            flex: `0 0 min(${px(210)}px, 32%)`,
            overflowY: "auto",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(180deg, rgba(8,4,24,0.65), rgba(8,4,24,0.45))",
          }}>
            {visible.map(n => {
              const cat = cats.find(c => c.id === n.categoryId);
              const isActive = active?.id === n.id;
              const isUnread = isNewsUnread(user, n.id);
              const accent = cat?.color ?? "#FFD54F";
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => selectNews(n.id)}
                  style={{
                    width: "100%", display: "flex", flexDirection: "column",
                    gap: 4, padding: "10px 12px", textAlign: "left",
                    background: isActive
                      ? `linear-gradient(135deg, ${accent}26, transparent)`
                      : isUnread
                        ? "rgba(255,23,68,0.06)"
                        : "transparent",
                    border: "none",
                    borderLeft: `3px solid ${isActive ? accent : isUnread ? "rgba(255,23,68,0.45)" : "transparent"}`,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    cursor: "pointer", color: "var(--t-1)",
                    boxShadow: isActive ? `inset 0 0 12px ${accent}33` : "none",
                  }}
                >
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5,
                    fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
                    color: accent,
                  }}>
                    <span><EmojiIcon emoji={cat?.icon} size={18} /></span>
                    <span>{cat?.label ?? "—"}</span>
                    {isUnread && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        marginLeft: 2, fontSize: 8, fontWeight: 900,
                        color: "#FF5252", letterSpacing: 0.6,
                      }}>
                        <NewsUnreadDot size={6} />
                        <Tr id="news.newBadge" />
                      </span>
                    )}
                    <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.35)", fontSize: 9 }}>
                      {new Date(n.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.3 }}>
                    {n.title}
                  </div>
                  <div style={{
                    fontSize: 10, color: "rgba(255,255,255,0.55)",
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    lineHeight: 1.35,
                  }}>
                    {n.body.slice(0, 100)}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{
            flex: 1, minWidth: 0, minHeight: 0,
            display: "flex", flexDirection: "column",
            overflow: "hidden", padding: `${px(10)}px ${px(14)}px`,
          }}>
            {active ? (
              <MiniNewsDetail item={active} cat={cats.find(c => c.id === active.categoryId)} />
            ) : (
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}><Tr id="news.selectHint" /></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewsChip({
  active, color, onClick, children,
}: {
  active: boolean; color: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ui-pill"
      style={{
        padding: `${px(5)}px ${px(11)}px`,
        background: active
          ? `linear-gradient(135deg, ${color}55, ${color}22)`
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? color : "rgba(255,255,255,0.12)"}`,
        color: active ? "#fff" : "rgba(255,255,255,0.55)",
        fontWeight: 800, fontSize: px(10), letterSpacing: "0.05em",
        whiteSpace: "nowrap", cursor: "pointer",
        boxShadow: active ? `0 0 10px ${color}66` : "none",
      }}
    >
      {children}
    </button>
  );
}

function MiniNewsDetail({ item, cat }: { item: NewsItem; cat?: NewsCategory }) {
  const hasMedia = !!(item.imageDataUrl || item.videoDataUrl || item.youtubeId);

  return (
    <article style={{
      display: "flex", flexDirection: "column",
      height: "100%", minHeight: 0,
    }}>
      <div style={{ flexShrink: 0, marginBottom: px(8) }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: px(5),
          background: cat ? `${cat.color}26` : "rgba(255,255,255,0.05)",
          border: `1px solid ${cat?.color ?? "rgba(255,255,255,0.18)"}`,
          borderRadius: 999, padding: `${px(3)}px ${px(10)}px`,
          fontSize: px(10), fontWeight: 800, letterSpacing: 1,
          color: cat?.color ?? "#FFD54F",
        }}>
          <span><EmojiIcon emoji={cat?.icon ?? "📰"} size={21} /></span> {cat?.label ?? "—"}
        </div>
        <h2 style={{
          margin: `${px(6)}px 0 ${px(2)}px`,
          fontSize: px(15), fontWeight: 900,
          color: "white", lineHeight: 1.25,
        }}>
          {item.title}
        </h2>
        <div style={{
          fontSize: px(10), color: "rgba(255,255,255,0.45)",
          fontWeight: 600,
        }}>
          {new Date(item.publishedAt).toLocaleString()}
        </div>
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
      }}>
        {hasMedia && (
          <div style={{
            float: "left",
            marginRight: px(12),
            marginBottom: px(10),
            maxWidth: "52%",
          }}>
            <MiniNewsMedia item={item} />
          </div>
        )}
        <div style={{
          whiteSpace: "pre-wrap", lineHeight: 1.55,
          fontSize: px(12), color: "rgba(255,255,255,0.86)",
        }}>
          {item.body}
        </div>
      </div>
    </article>
  );
}

function MiniNewsMedia({ item }: { item: NewsItem }) {
  const frameStyle: React.CSSProperties = {
    borderRadius: px(10),
    boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
    display: "block",
  };

  if (item.youtubeId) {
    return (
      <div style={{
        width: px(280),
        aspectRatio: "16/9",
        ...frameStyle,
        overflow: "hidden",
      }}>
        <iframe
          src={`https://www.youtube.com/embed/${item.youtubeId}`}
          title={item.title}
          width="100%" height="100%"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ border: "none", display: "block" }}
        />
      </div>
    );
  }
  if (item.videoDataUrl) {
    return (
      <video
        src={item.videoDataUrl}
        controls
        style={{
          ...frameStyle,
          width: "auto",
          height: "auto",
          maxWidth: "100%",
          background: "black",
        }}
      />
    );
  }
  if (item.imageDataUrl) {
    return (
      <img
        src={item.imageDataUrl}
        alt={item.title}
        style={{
          ...frameStyle,
          width: "auto",
          height: "auto",
          maxWidth: "100%",
        }}
      />
    );
  }
  return null;
}
