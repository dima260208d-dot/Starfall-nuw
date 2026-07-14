import { useEffect, useMemo, useState } from "react";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import { useI18n } from "../i18n";
import { getCurrentProfile, getBattleHistory, type BattleRecord } from "../utils/localStorageAPI";
import {
  getBattleFeed,
  getMyBattleFeedPosts,
  publishFeedPost,
  toggleFeedPostLike,
  hasLikedFeedPost,
  feedTimeLeftMs,
  updateFeedPostCaption,
  deleteFeedPost,
  type BattleFeedPost,
} from "../utils/battleFeed";
import {
  getFeedContestTimeLeftMs,
  getFeedContestLeaders,
  getFeedContestMonthlyArchive,
  getFeedPeriodEnd,
  type FeedContestEntry,
  type FeedContestPeriodArchive,
} from "../utils/battleFeedContest";
import { getProfileIconImage } from "../utils/profileIconUtils";
import BattleReplayViewer from "../components/BattleReplayViewer";
import BattleHistoryCard from "../components/BattleHistoryCard";
import { formatPlayerIdDisplay } from "../utils/playerId";
import { EmojiIcon } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";

interface Props {
  onBack: () => void;
  onViewProfile: (playerId: string) => void;
}

type FeedTab = "global" | "mine" | "leaders" | "best";

function formatLeft(ms: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return t("feed.expiresDays", { days: d });
  if (h >= 1) return t("feed.expiresHours", { hours: h });
  const m = Math.max(1, Math.floor(ms / 60_000));
  return t("feed.expiresMinutes", { minutes: m });
}

function formatCountdown(ms: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}д ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function postToBattleRecord(post: BattleFeedPost): BattleRecord {
  return {
    id: post.id,
    ts: post.battleTs ?? post.createdAt,
    mode: post.mode,
    brawlerId: post.brawlerId,
    won: post.won,
    place: post.place ?? 1,
    totalPlayers: post.totalPlayers ?? 1,
    trophyDelta: post.trophyDelta,
    xpGained: 0,
    coinsEarned: 0,
    durationSec: post.durationSec,
    enemies: [],
    teams: post.teams,
    scoreBlue: post.scoreBlue,
    scoreRed: post.scoreRed,
    replayId: post.replayId,
    showdownFormat: post.showdownFormat,
    bossId: post.bossId,
    bossLevel: post.bossLevel,
  };
}

export default function BattleFeedPage({ onBack, onViewProfile }: Props) {
  const { t, localeMeta } = useI18n();
  const base = (import.meta as any).env?.BASE_URL ?? "/";
  const profile = getCurrentProfile();
  const [tab, setTab] = useState<FeedTab>("global");
  const [tick, setTick] = useState(0);
  const [showCompose, setShowCompose] = useState(false);
  const [editPost, setEditPost] = useState<BattleFeedPost | null>(null);
  const [caption, setCaption] = useState("");
  const [pickBattleId, setPickBattleId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [watchReplayId, setWatchReplayId] = useState<string | null>(null);

  const globalPosts = useMemo(() => getBattleFeed(), [tick]);
  const myPosts = useMemo(() => getMyBattleFeedPosts(profile?.playerId), [tick, profile?.playerId]);
  const leaders = useMemo(() => getFeedContestLeaders(globalPosts), [globalPosts]);
  const archive = useMemo(() => getFeedContestMonthlyArchive(), [tick]);
  const contestLeftMs = getFeedContestTimeLeftMs();
  const posts = tab === "mine" ? myPosts : tab === "global" ? globalPosts : [];
  const replayBattles = useMemo(
    () => getBattleHistory().filter((r) => r.replayId),
    [tick, showCompose],
  );
  const pickedBattle = replayBattles.find((r) => r.id === pickBattleId) ?? replayBattles[0] ?? null;

  const flash = (text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 2800);
  };

  const refresh = () => setTick((n) => n + 1);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const tabTitle = tab === "mine"
    ? t("feed.myFeedTitle")
    : tab === "leaders"
      ? t("feed.tabLeaders")
      : tab === "best"
        ? t("feed.tabBest")
        : t("feed.title");

  const handlePublish = () => {
    if (!pickedBattle?.replayId) {
      flash(t("feed.noReplays"));
      return;
    }
    const r = publishFeedPost(pickedBattle.replayId, caption, pickedBattle);
    if (r.success) {
      setShowCompose(false);
      setCaption("");
      setPickBattleId(null);
      setTab("mine");
      refresh();
      flash(t("feed.published"));
    } else {
      flash(r.error || t("common.error"));
    }
  };

  const handleSaveEdit = () => {
    if (!editPost) return;
    const r = updateFeedPostCaption(editPost.id, caption);
    if (r.success) {
      setEditPost(null);
      setCaption("");
      refresh();
      flash(t("feed.updated"));
    } else {
      flash(r.error || t("common.error"));
    }
  };

  const handleDelete = (postId: string) => {
    if (!window.confirm(t("feed.deleteConfirm"))) return;
    const r = deleteFeedPost(postId);
    if (r.success) {
      refresh();
      flash(t("feed.deleted"));
    } else {
      flash(r.error || t("common.error"));
    }
  };

  const handleLike = (postId: string) => {
    const r = toggleFeedPostLike(postId);
    if (r.success) refresh();
  };

  const formatTs = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(localeMeta.bcp47) + " " + d.toLocaleTimeString(localeMeta.bcp47, { hour: "2-digit", minute: "2-digit" });
  };

  const openCompose = () => {
    setCaption("");
    setPickBattleId(null);
    setShowCompose(true);
  };

  const openEdit = (post: BattleFeedPost) => {
    setEditPost(post);
    setCaption(post.caption);
  };

  return (
    <PageBg variant="feed" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)", overflow: "hidden" }}>
      <PageHeader onBack={onBack} title={tabTitle} />

      <PageBody
        className="ui-scroll-hidden"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "12px 20px 24px",
          maxWidth: 720,
          margin: "0 auto",
          width: "100%",
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10, alignItems: "center" }}>
          {(["global", "mine", "leaders", "best"] as FeedTab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={tab === key ? "ui-btn ui-btn--primary" : "ui-btn ui-btn--secondary"}
              onClick={() => setTab(key)}
              style={{ flex: "1 1 auto", minWidth: 72, fontWeight: 800, fontSize: 11, padding: "8px 6px" }}
            >
              {key === "global" ? t("feed.tabGlobal")
                : key === "mine" ? t("feed.tabMine")
                  : key === "leaders" ? t("feed.tabLeaders")
                    : t("feed.tabBest")}
            </button>
          ))}
          <div
            style={{
              flex: "1 1 100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "8px 12px",
              background: "rgba(255,213,79,0.08)",
              border: "1px solid rgba(255,213,79,0.35)",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 800,
              color: "#FFD54F",
            }}
          >
            <span>⏱</span>
            <Tr id="feed.contestCountdown" params={{ time: formatCountdown(contestLeftMs, t) }} />
          </div>
        </div>

        {(tab === "global" || tab === "mine") && (
          <div style={{ fontSize: 11, color: "var(--t-3)", marginBottom: 14, textAlign: "center", lineHeight: 1.45 }}>
            {tab === "global" ? t("feed.contestSubtitle") : t("feed.contestHint")}
          </div>
        )}

        {tab === "global" && profile && (
          <button
            type="button"
            onClick={() => setTab("mine")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              marginBottom: 16,
              padding: "10px 12px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--bd-1)",
              borderRadius: 12,
              cursor: "pointer",
              color: "inherit",
              fontFamily: "inherit",
              textAlign: "left",
            }}
          >
            <img
              src={getProfileIconImage(profile.profileIconId, base)}
              alt=""
              style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--bd-2)", objectFit: "cover" }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{profile.username}</div>
              <div style={{ fontSize: 11, color: "var(--t-3)" }}><Tr id="feed.openMyFeed" /> · {myPosts.length}</div>
            </div>
            <span style={{ color: "var(--t-3)", fontSize: 18 }}>›</span>
          </button>
        )}

        {tab === "mine" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            {profile && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <img
                  src={getProfileIconImage(profile.profileIconId, base)}
                  alt=""
                  style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--bd-2)", objectFit: "cover" }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 14 }}>{profile.username}</div>
                  {profile.playerId && (
                    <div style={{ fontSize: 10, color: "var(--t-3)" }}>{formatPlayerIdDisplay(profile.playerId)}</div>
                  )}
                </div>
              </div>
            )}
            <button type="button" className="ui-btn ui-btn--primary" onClick={openCompose} style={{ flexShrink: 0, fontWeight: 800, fontSize: 12 }}>
              <Tr id="feed.postBattle" />
            </button>
          </div>
        )}

        {tab === "leaders" && (
          <LeadersPanel
            leaders={leaders}
            t={t}
            base={base}
            formatTs={formatTs}
            onAuthor={onViewProfile}
            onWatch={(replayId) => setWatchReplayId(replayId)}
          />
        )}

        {tab === "best" && (
          <BestArchivePanel
            archive={archive}
            t={t}
            base={base}
            localeTag={localeMeta.bcp47}
            onAuthor={onViewProfile}
            onWatch={(replayId) => setWatchReplayId(replayId)}
          />
        )}

        {(tab === "global" || tab === "mine") && !posts.length ? (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--t-3)" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}><EmojiIcon emoji="📺" size={24} /></div>
            {tab === "mine" ? t("feed.myFeedEmpty") : t("feed.empty")}
            {tab === "mine" && (
              <div style={{ marginTop: 16 }}>
                <button type="button" className="ui-btn ui-btn--primary" onClick={openCompose} style={{ fontWeight: 800 }}>
                  <Tr id="feed.postBattle" />
                </button>
              </div>
            )}
          </div>
        ) : (tab === "global" || tab === "mine") ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {posts.map((post) => (
              <FeedCard
                key={post.id}
                post={post}
                t={t}
                base={base}
                formatTs={formatTs}
                formatLeft={(ms) => formatLeft(ms, t)}
                myPlayerId={profile?.playerId}
                localeTag={localeMeta.bcp47}
                isMineTab={tab === "mine"}
                onLike={() => handleLike(post.id)}
                onWatch={() => setWatchReplayId(post.replayId)}
                onAuthor={() => onViewProfile(post.authorPlayerId)}
                onEdit={() => openEdit(post)}
                onDelete={() => handleDelete(post.id)}
              />
            ))}
          </div>
        ) : null}

        {msg && (
          <div className="ui-glass" style={{ textAlign: "center", padding: 10, color: "#69F0AE", fontWeight: 700, marginTop: 16 }}>
            {msg}
          </div>
        )}
      </PageBody>

      {showCompose && (
        <ComposeModal
          t={t}
          title={t("feed.composeTitle")}
          caption={caption}
          onCaption={setCaption}
          battles={replayBattles}
          pickedId={pickBattleId ?? pickedBattle?.id ?? null}
          onPick={setPickBattleId}
          onClose={() => setShowCompose(false)}
          onSubmit={handlePublish}
          submitLabel={t("feed.publish")}
          locale={localeMeta.bcp47}
          showBattlePicker
        />
      )}

      {editPost && (
        <ComposeModal
          t={t}
          title={t("feed.editTitle")}
          caption={caption}
          onCaption={setCaption}
          onClose={() => { setEditPost(null); setCaption(""); }}
          onSubmit={handleSaveEdit}
          submitLabel={t("feed.saveEdit")}
          locale={localeMeta.bcp47}
          showBattlePicker={false}
        />
      )}

      {watchReplayId && (
        <BattleReplayViewer
          replayId={watchReplayId}
          onClose={() => setWatchReplayId(null)}
          onFinished={() => setWatchReplayId(null)}
        />
      )}
    </PageBg>
  );
}

function FeedCard({
  post,
  t,
  base,
  myPlayerId,
  localeTag,
  isMineTab,
  formatTs,
  formatLeft,
  onLike,
  onWatch,
  onAuthor,
  onEdit,
  onDelete,
}: {
  post: BattleFeedPost;
  t: (k: string, p?: Record<string, string | number>) => string;
  base: string;
  localeTag: string;
  myPlayerId?: string;
  isMineTab: boolean;
  formatTs: (ts: number) => string;
  formatLeft: (ms: number) => string;
  onLike: () => void;
  onWatch: () => void;
  onAuthor: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const liked = hasLikedFeedPost(post, myPlayerId);
  const left = feedTimeLeftMs(post);
  const battleRecord = postToBattleRecord(post);

  return (
    <article>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        {!isMineTab && (
          <button type="button" onClick={onAuthor} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit", fontFamily: "inherit" }}>
            <img
              src={getProfileIconImage(post.authorProfileIconId, base)}
              alt=""
              style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid var(--bd-1)", objectFit: "cover" }}
            />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{post.authorUsername}</div>
              <div style={{ fontSize: 10, color: "var(--t-3)" }}>{formatTs(post.createdAt)}</div>
            </div>
          </button>
        )}
        {isMineTab && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: "var(--t-3)" }}>{formatTs(post.createdAt)}</div>
            <div style={{ fontSize: 11, color: "#FFD54F", fontWeight: 700, marginTop: 2 }}>
              <Tr id="feed.expiresIn" params={{ time: formatLeft(left) }} />
            </div>
          </div>
        )}
        {!isMineTab && (
          <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--t-3)" }}>{formatLeft(left)}</div>
        )}
        {isMineTab && (
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button type="button" className="ui-btn ui-btn--secondary" onClick={onEdit} style={{ fontSize: 11, padding: "6px 10px", fontWeight: 700 }}>
              <Tr id="feed.editPost" />
            </button>
            <button type="button" className="ui-btn ui-btn--secondary" onClick={onDelete} style={{ fontSize: 11, padding: "6px 10px", fontWeight: 700, color: "#FF8A80" }}>
              <Tr id="feed.deletePost" />
            </button>
          </div>
        )}
      </div>

      {post.caption && (
        <div style={{ fontSize: 14, lineHeight: 1.45, marginBottom: 12, whiteSpace: "pre-wrap" }}>{post.caption}</div>
      )}

      <BattleHistoryCard
        record={battleRecord}
        localeTag={localeTag}
        onWatch={onWatch}
        canShare={false}
      />

      {!isMineTab && (
        <button
          type="button"
          onClick={onLike}
          className="ui-btn ui-btn--secondary"
          style={{
            marginTop: 12,
            fontWeight: 800,
            color: liked ? "#FF8A80" : undefined,
            borderColor: liked ? "rgba(255,138,128,0.5)" : undefined,
          }}
        >
          {liked ? <EmojiIcon emoji="❤️" size={24} /> : <EmojiIcon emoji="🤍" size={24} />} <Tr id="feed.likes" params={{ count: post.likes.length }} />
        </button>
      )}
    </article>
  );
}

function placeMedal(place: number): string {
  if (place === 1) return "🥇";
  if (place === 2) return "🥈";
  if (place === 3) return "🥉";
  return `#${place}`;
}

function LeadersPanel({
  leaders,
  t,
  base,
  formatTs,
  onAuthor,
  onWatch,
}: {
  leaders: BattleFeedPost[];
  t: (k: string, p?: Record<string, string | number>) => string;
  base: string;
  formatTs: (ts: number) => string;
  onAuthor: (playerId: string) => void;
  onWatch: (replayId: string) => void;
}) {
  const ranked = leaders.filter((p) => p.likes.length > 0);
  if (!ranked.length) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--t-3)" }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}><EmojiIcon emoji="🏆" size={24} /></div>
        <Tr id="feed.leadersEmpty" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ranked.map((post, i) => (
        <div
          key={post.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            background: i === 0 ? "rgba(255,213,79,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${i === 0 ? "rgba(255,213,79,0.35)" : "var(--bd-1)"}`,
            borderRadius: 12,
          }}
        >
          <span style={{ fontSize: 22, width: 32, textAlign: "center", flexShrink: 0 }}>{placeMedal(i + 1)}</span>
          <button
            type="button"
            onClick={() => onAuthor(post.authorPlayerId)}
            style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit", fontFamily: "inherit", flex: 1, minWidth: 0 }}
          >
            <img
              src={getProfileIconImage(post.authorProfileIconId, base)}
              alt=""
              style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--bd-1)", objectFit: "cover", flexShrink: 0 }}
            />
            <div style={{ textAlign: "left", minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{post.authorUsername}</div>
              <div style={{ fontSize: 10, color: "var(--t-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {post.caption || formatTs(post.createdAt)}
              </div>
            </div>
          </button>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#FF8A80", display: "flex", alignItems: "center", gap: 6 }}><EmojiIcon emoji="❤️" size={24} /> {post.likes.length}</div>
            <button type="button" className="ui-btn ui-btn--secondary" onClick={() => onWatch(post.replayId)} style={{ fontSize: 10, padding: "4px 8px", marginTop: 4, fontWeight: 700 }}>
              <Tr id="feed.watch" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function BestArchivePanel({
  archive,
  t,
  base,
  localeTag,
  onAuthor,
  onWatch,
}: {
  archive: FeedContestPeriodArchive[];
  t: (k: string, p?: Record<string, string | number>) => string;
  base: string;
  localeTag: string;
  onAuthor: (playerId: string) => void;
  onWatch: (replayId: string) => void;
}) {
  if (!archive.length) {
    return (
      <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--t-3)" }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>⭐</div>
        <Tr id="feed.bestEmpty" />
      </div>
    );
  }

  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString(localeTag);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {archive.map((period) => (
        <section key={period.periodStart}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#FFD54F", marginBottom: 10, letterSpacing: 0.5 }}>
            {t("feed.periodRange", {
              from: fmtDate(period.periodStart),
              to: fmtDate(getFeedPeriodEnd(period.periodStart) - 1),
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {period.entries.map((entry) => (
              <ArchiveEntryRow
                key={`${period.periodStart}-${entry.postId}`}
                entry={entry}
                t={t}
                base={base}
                onAuthor={onAuthor}
                onWatch={onWatch}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ArchiveEntryRow({
  entry,
  t,
  base,
  onAuthor,
  onWatch,
}: {
  entry: FeedContestEntry;
  t: (k: string, p?: Record<string, string | number>) => string;
  base: string;
  onAuthor: (playerId: string) => void;
  onWatch: (replayId: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--bd-1)",
        borderRadius: 10,
      }}
    >
      <span style={{ fontSize: 20, width: 28, textAlign: "center", flexShrink: 0 }}>{placeMedal(entry.place)}</span>
      <button
        type="button"
        onClick={() => onAuthor(entry.authorPlayerId)}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: 0, color: "inherit", fontFamily: "inherit", flex: 1, minWidth: 0 }}
      >
        <img
          src={getProfileIconImage(entry.authorProfileIconId, base)}
          alt=""
          style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--bd-1)", objectFit: "cover" }}
        />
        <div style={{ textAlign: "left", minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 12 }}>{entry.authorUsername}</div>
          {entry.caption && (
            <div style={{ fontSize: 10, color: "var(--t-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.caption}</div>
          )}
        </div>
      </button>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#FF8A80" }}><Tr id="feed.likesCount" params={{ count: entry.likes }} /></div>
        <button type="button" className="ui-btn ui-btn--secondary" onClick={() => onWatch(entry.replayId)} style={{ fontSize: 10, padding: "4px 8px", marginTop: 4, fontWeight: 700 }}>
          <Tr id="feed.watch" />
        </button>
      </div>
    </div>
  );
}

function ComposeModal({
  t,
  title,
  caption,
  onCaption,
  battles,
  pickedId,
  onPick,
  onClose,
  onSubmit,
  submitLabel,
  locale,
  showBattlePicker,
}: {
  t: (k: string, p?: Record<string, string | number>) => string;
  title: string;
  caption: string;
  onCaption: (v: string) => void;
  battles?: BattleRecord[];
  pickedId?: string | null;
  onPick?: (id: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  locale: string;
  showBattlePicker: boolean;
}) {
  const formatTs = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString(locale) + " " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "rgba(0,0,12,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backdropFilter: "blur(6px)",
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="ui-card"
        style={{ width: "min(480px, 100%)", maxHeight: "90vh", overflow: "auto", padding: 20 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{title}</h3>
          <button type="button" className="ui-back-btn" onClick={onClose} style={{ width: 32, height: 32, padding: 0 }}>×</button>
        </div>

        {showBattlePicker && (!battles?.length ? (
          <p style={{ color: "var(--t-3)", fontSize: 13 }}><Tr id="feed.noReplays" /></p>
        ) : (
          <>
            <label style={{ fontSize: 11, color: "var(--t-3)", fontWeight: 700, letterSpacing: 1, display: "block", marginBottom: 8 }}>
              <Tr id="feed.pickBattle" />
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", marginBottom: 14 }} className="ui-scroll-hidden">
              {battles!.slice(0, 20).map((b) => {
                const active = (pickedId ?? battles![0]?.id) === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onPick?.(b.id)}
                    className="ui-btn"
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      background: active ? "rgba(255,213,79,0.15)" : "rgba(255,255,255,0.04)",
                      border: active ? "1px solid var(--bd-gold)" : "1px solid var(--bd-1)",
                      color: "var(--t-1)",
                      fontWeight: 600,
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: active ? "2px solid #FFD54F" : "2px solid var(--bd-2)",
                      background: active ? "rgba(255,213,79,0.35)" : "transparent",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      fontSize: 14,
                      fontWeight: 900,
                      color: active ? "#FFD54F" : "transparent",
                    }}>
                      {active ? <EmojiIcon emoji="✓" size={21} /> : ""}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {formatTs(b.ts)} · {b.mode} · {b.won ? <EmojiIcon emoji="🏆" size={18} /> : <EmojiIcon emoji="💀" size={18} />} {b.trophyDelta >= 0 ? "+" : ""}{b.trophyDelta}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ))}

        {(showBattlePicker ? !!battles?.length : true) && (
          <>
            <label style={{ fontSize: 11, color: "var(--t-3)", fontWeight: 700, letterSpacing: 1, display: "block", marginBottom: 8 }}>
              <Tr id="feed.captionLabel" />
            </label>
            <textarea
              className="ui-input"
              value={caption}
              onChange={(e) => onCaption(e.target.value)}
              placeholder={t("feed.captionPlaceholder")}
              maxLength={280}
              rows={4}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", marginBottom: 8 }}
            />
            {showBattlePicker && (
              <div style={{ fontSize: 10, color: "var(--t-3)", marginBottom: 14 }}><Tr id="feed.expiresHint" /></div>
            )}

            <button type="button" className="ui-btn ui-btn--primary ui-btn--block" onClick={onSubmit} style={{ fontWeight: 900 }}>
              {submitLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
