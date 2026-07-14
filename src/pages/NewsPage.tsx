import { useEffect, useMemo, useState } from "react";
import {
  getNewsSorted, getNewsCategories, markNewsSeen, isNewsUnread,
  type NewsItem, type NewsCategory,
} from "../utils/news";
import { getCurrentUsername } from "../utils/localStorageAPI";
import { PageBg, PageBody, PageHeader, PageToolbar } from "../components/PageChrome";
import NewsUnreadDot from "../components/NewsUnreadDot";
import { useI18n } from "../i18n";
import { EmojiIcon } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";
import { onLiveConfig, LIVE_CONFIG_APPLIED_EVENT } from "../lib/liveConfig";

interface NewsPageProps {
  onBack: () => void;
}

export default function NewsPage({ onBack }: NewsPageProps) {
  const { t } = useI18n();
  const [items, setItems] = useState<NewsItem[]>(() => getNewsSorted());
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  const [filter, setFilter] = useState<string>("all");
  const [seenTick, setSeenTick] = useState(0);
  const cats = useMemo(() => getNewsCategories(), []);
  const user = getCurrentUsername();

  useEffect(() => { setItems(getNewsSorted()); }, []);

  useEffect(() => {
    const refresh = () => setItems(getNewsSorted());
    const offLive = onLiveConfig(refresh);
    window.addEventListener(LIVE_CONFIG_APPLIED_EVENT, refresh);
    return () => {
      offLive();
      window.removeEventListener(LIVE_CONFIG_APPLIED_EVENT, refresh);
    };
  }, []);

  const markSeen = (id: string) => {
    if (!user) return;
    markNewsSeen(user, id);
    setSeenTick((n) => n + 1);
  };

  const selectNews = (id: string) => {
    setActiveId(id);
    markSeen(id);
  };

  const visible = useMemo(() => (
    filter === "all" ? items : items.filter(n => n.categoryId === filter)
  ), [items, filter]);

  const active = visible.find(n => n.id === activeId)
    ?? items.find(n => n.id === activeId)
    ?? visible[0]
    ?? null;

  // Mark auto-selected first item as seen.
  useEffect(() => {
    if (active && user) markSeen(active.id);
  }, [active?.id, user]);

  return (
    <PageBg variant="news" style={{
      display: "flex", flexDirection: "column",
      fontFamily: "var(--app-font-sans)",
    }}>
      <PageHeader onBack={onBack} title={<> <EmojiIcon emoji="📰" size={20} /> <Tr id="news.title" /></>} />

      <PageToolbar style={{
        display: "flex", gap: 8, padding: "10px 22px",
        overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.18)",
      }}>
        <Chip active={filter === "all"} color="#FFD54F" onClick={() => setFilter("all")}>
          <Tr id="news.allCount" params={{ count: items.length }} />
        </Chip>
        {cats.map(c => {
          const count = items.filter(n => n.categoryId === c.id).length;
          if (count === 0) return null;
          return (
            <Chip key={c.id} active={filter === c.id} color={c.color} onClick={() => setFilter(c.id)}>
              <EmojiIcon emoji={c.icon} size={18} /> {c.label} ({count})
            </Chip>
          );
        })}
      </PageToolbar>

      <PageBody style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {items.length === 0 ? (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.55)", textAlign: "center", padding: 40,
        }}>
          <div style={{ fontSize: 64, marginBottom: 14 }}><EmojiIcon emoji="📭" size={24} /></div>
          <div style={{ fontSize: 16, fontWeight: 800 }}><Tr id="news.emptyTitle" /></div>
          <div style={{ fontSize: 12, marginTop: 6, maxWidth: 360 }}>
            <Tr id="news.emptyHint" />
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: "flex", overflow: "hidden",
        }}>
          {/* List */}
          <div style={{
            flex: "0 0 320px", overflowY: "auto",
            borderRight: "1px solid var(--bd-1)",
            background: "linear-gradient(180deg, rgba(8,4,24,0.65), rgba(8,4,24,0.45))",
            backdropFilter: "blur(10px) saturate(1.15)",
            WebkitBackdropFilter: "blur(10px) saturate(1.15)",
          }}>
            {visible.map(n => {
              const cat = cats.find(c => c.id === n.categoryId);
              const isActive = active?.id === n.id;
              const isUnread = isNewsUnread(user, n.id);
              return (
                <button
                  key={n.id}
                  onClick={() => selectNews(n.id)}
                  style={{
                    width: "100%", display: "flex", flexDirection: "column",
                    gap: 6, padding: "14px 18px", textAlign: "left",
                    position: "relative",
                    background: isActive
                      ? `linear-gradient(135deg, ${cat?.color ?? "#FFD54F"}26, transparent)`
                      : isUnread
                        ? "rgba(255,23,68,0.06)"
                        : "transparent",
                    borderLeft: isActive ? `3px solid ${cat?.color ?? "#FFD54F"}` : isUnread ? "3px solid rgba(255,23,68,0.45)" : "3px solid transparent",
                    border: "none", borderBottom: "1px solid var(--bd-1)",
                    cursor: "pointer", color: "var(--t-1)",
                    transition: "all var(--ease-mid)",
                    boxShadow: isActive ? `inset 0 0 14px ${cat?.color ?? "#FFD54F"}33` : "none",
                  }}
                >
                  <div className="ui-eyebrow" style={{
                    display: "flex", alignItems: "center", gap: 6,
                    color: cat?.color ?? "var(--c-gold-3)",
                  }}>
                    <span><EmojiIcon emoji={cat?.icon} size={18} /></span>
                    <span>{cat?.label ?? "—"}</span>
                    {isUnread && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        marginLeft: 4, fontSize: 9, fontWeight: 900,
                        color: "#FF5252", letterSpacing: 0.8,
                      }}>
                        <NewsUnreadDot size={7} />
                        <Tr id="news.newBadge" />
                      </span>
                    )}
                    <span style={{ marginLeft: "auto", color: "var(--t-4)", letterSpacing: 0, fontSize: 10 }}>
                      {new Date(n.publishedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 13.5, fontWeight: 900, lineHeight: 1.3, letterSpacing: "0.01em",
                  }}>
                    {n.title}
                  </div>
                  <div style={{
                    fontSize: 11, color: "var(--t-3)",
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    lineHeight: 1.4,
                  }}>{n.body.slice(0, 120)}</div>
                </button>
              );
            })}
          </div>
          {/* Detail */}
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            {active ? (
              <NewsDetail item={active} cat={cats.find(c => c.id === active.categoryId)} />
            ) : (
              <div style={{ color: "rgba(255,255,255,0.55)" }}><Tr id="news.selectHint" /></div>
            )}
          </div>
        </div>
      )}
      </PageBody>
    </PageBg>
  );
}

function Chip({
  active, color, onClick, children,
}: {
  active: boolean; color: string; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="ui-pill"
      style={{
        padding: "6px 14px",
        background: active
          ? `linear-gradient(135deg, ${color}55, ${color}22)`
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? color : "var(--bd-1)"}`,
        color: active ? "#fff" : "var(--t-3)",
        fontWeight: 800, fontSize: 11, letterSpacing: "0.06em",
        whiteSpace: "nowrap", cursor: "pointer",
        boxShadow: active ? `0 0 14px ${color}88, inset 0 1px 0 rgba(255,255,255,0.12)` : "var(--sh-sm)",
        transition: "all var(--ease-mid)",
      }}
    >{children}</button>
  );
}

function NewsDetail({ item, cat }: { item: NewsItem; cat: NewsCategory | undefined }) {
  const hasMedia = !!(item.imageDataUrl || item.videoDataUrl || item.youtubeId);

  return (
    <article style={{ maxWidth: 820, margin: "0 auto" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        background: cat ? `${cat.color}26` : "rgba(255,255,255,0.05)",
        border: `1px solid ${cat?.color ?? "rgba(255,255,255,0.18)"}`,
        borderRadius: 999, padding: "4px 12px",
        fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: cat?.color ?? "#FFD54F",
      }}>
        <span><EmojiIcon emoji={cat?.icon ?? "📰"} size={21} /></span> {cat?.label ?? "—"}
      </div>
      <h1 style={{
        margin: "12px 0 4px",
        fontSize: 28, fontWeight: 900,
        color: "white", lineHeight: 1.2,
        textShadow: "0 2px 6px rgba(0,0,0,0.5)",
      }}>{item.title}</h1>
      <div style={{
        fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 18,
        fontWeight: 600,
      }}>{new Date(item.publishedAt).toLocaleString()}</div>
      <div style={{ overflow: "hidden" }}>
        {hasMedia && (
          <div style={{
            float: "left",
            marginRight: 16,
            marginBottom: 12,
            maxWidth: "52%",
          }}>
            <NewsMedia item={item} floated />
          </div>
        )}
        <div style={{
          whiteSpace: "pre-wrap", lineHeight: 1.6,
          fontSize: 14, color: "rgba(255,255,255,0.88)",
        }}>{item.body}</div>
      </div>
    </article>
  );
}

function NewsMedia({ item, floated = false }: { item: NewsItem; floated?: boolean }) {
  const frameStyle: React.CSSProperties = floated
    ? { width: "100%", borderRadius: 14, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", display: "block" }
    : {};
  if (item.youtubeId) {
    return (
      <div style={{
        width: floated ? "100%" : "100%", aspectRatio: "16/9", borderRadius: 14, overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        ...frameStyle,
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
          width: floated ? "100%" : "100%", maxHeight: floated ? 320 : 460, borderRadius: 14,
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)", background: "black",
          ...frameStyle,
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
          width: floated ? "100%" : "100%", maxHeight: floated ? 320 : 460, objectFit: "cover", borderRadius: 14,
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          ...frameStyle,
        }}
      />
    );
  }
  return null;
}
