import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, memo } from "react";
import ChatPinTray from "../components/ChatPinTray";
import { ChatPinBubble } from "../components/ChatPinBubble";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import { motion } from "framer-motion";
import {
  getMyClub, getAllClubs, getMyClubInvites,
  joinClub, leaveClub, sendChatMessage, sendClubChatPin,
  deleteClub,
  kickMember, inviteUser, updateClubInfo,
  approveJoinRequest, denyJoinRequest, acceptInvite, declineInvite,
  CLUB_CHAT_MAX, CLUB_DESC_MAX, CLUB_NAME_MAX,
  CLUB_MEMBERS_MAX, CLUB_REWARD_COINS, CLUB_REWARD_GEMS, CLUB_REWARD_PP,
  CLUB_WINS_PER_MEMBER, claimClubCycleReward, formatClubCycleTimeLeft,
  getClubRewardStatus, memberCycleComplete, CLUB_RANK_META, CLUB_RANK_ORDER,
  getMemberRank, setMemberRank, setClubProfileIconAvatar, rankIndex,
  getClub, markClubChatRead, getUnreadClubChatCount, CLUB_CHAT_CHANGED_EVENT,
  CLUBS_UPDATED_EVENT,
  cancelGuardianAiClubRescan, scheduleGuardianAiClubRescan,
  type Club, type ClubMember, type ClubMessage, type ClubRank, type ClubRewardPick, type ClubBattleSharePayload,
} from "../utils/clubs";
import {
  cancelClubBossRaidRecruitment,
  emitClubBossRaidChanged,
  getClubBossRaidMemberViews,
  joinClubBossRaidRecruitment,
  setClubBossRaidBoss,
  startClubBossRaidRecruitment,
  subscribeClubBossRaidChanged,
  syncClubBossRaidFromParty,
} from "../utils/clubBossRaid";
import {
  getCurrentUsername, getAllProfiles, getCurrentProfile,
} from "../utils/localStorageAPI";
import { getUnlockedProfileIconIds, getProfileIconImage } from "../utils/profileIconUtils";
import { normalizePlayerIdQuery } from "../utils/playerId";
import {
  getPresenceForPlayerId,
  getClubMemberStatusText,
  getBattleModeForPlayerId,
  PRESENCE_CHANGED_EVENT,
} from "../utils/social/presence";
import { getModeIconUrl } from "../utils/modeAssets";
import { getBrawlerById } from "../entities/BrawlerData";
import { getBossRaidCurrentLevel } from "../utils/bossRaidProgress";
import ClubAvatar from "../components/ClubAvatar";
import VolProgressTrack from "../components/ui/VolProgressTrack";
import { FriendAvatar } from "../components/FriendRowCard";
import ClubBattleShareCard from "../components/ClubBattleShareCard";
import BattleReplayViewer from "../components/BattleReplayViewer";
import CreateClubModal from "../components/CreateClubModal";
import BossRaidLobbyCarousel from "../components/BossRaidLobbyCarousel";
import BrawlerViewer3D from "../components/BrawlerViewer3D";
import { CoinIcon, GemIcon, PowerIcon, TrophyIcon } from "../components/GameIcons";
import { TextWithEmojis, EmojiIcon } from "../components/EmojiIcon";
import { Tr } from "../i18n/Tr";
import ClubTreasuryView from "../components/ClubTreasuryView";
import { buildLeaveClubConfirmMessage } from "../utils/clubTreasury";
import { useI18n, brawlerName } from "../i18n";
import { textOnSolidFill, textOnTintedAccent, textShadowOnSolidFill } from "../utils/contrastText";

const CLUB_RANK_LABEL_KEYS: Record<ClubRank, string> = {
  junior: "clubs.rank.junior",
  middle: "clubs.rank.middle",
  senior: "clubs.rank.senior",
  president: "clubs.rank.president",
  owner: "clubs.rank.owner",
};

interface Props {
  onBack: () => void;
  /** Открыть карточку клуба (например из профиля друга). */
  viewClubId?: string | null;
  /** Перейти в главное меню после сбора клубной команды на босса. */
  onGoToMainMenu?: (bossId: string) => void;
}

export default function ClubsPage({ onBack, viewClubId = null, onGoToMainMenu }: Props) {
  const { t } = useI18n();
  const [tick, setTick] = useState(0);
  const [replayWatch, setReplayWatch] = useState<{ replayId: string; share?: ClubBattleSharePayload } | null>(null);
  // Re-read from storage every render so chat messages and members stay in sync.
  const myClub = useMemo(() => getMyClub(), [tick]);
  const foreignClub = useMemo(() => {
    if (myClub || !viewClubId) return null;
    return getAllClubs().find(c => c.id === viewClubId) ?? null;
  }, [myClub, viewClubId, tick]);
  const refresh = () => setTick(x => x + 1);

  // Pull the global club directory from Cloudflare when the page opens and
  // re-render whenever the cloud sync updates the local cache.
  useEffect(() => {
    let alive = true;
    void import("../utils/clubCloudSync").then(({ refreshClubsFromCloud }) => {
      if (alive) void refreshClubsFromCloud();
    });
    const bump = () => setTick(x => x + 1);
    window.addEventListener(CLUBS_UPDATED_EVENT, bump);
    return () => { alive = false; window.removeEventListener(CLUBS_UPDATED_EVENT, bump); };
  }, []);

  if (foreignClub) {
    return (
      <PageBg variant="clubs" style={{ display: "flex", flexDirection: "column", fontFamily: "var(--app-font-sans)" }}>
        <PageHeader onBack={onBack} title={<><EmojiIcon emoji="🏛️" size={20} /> <Tr id="clubs.single" /></>} />
        <PageBody style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20 }}>
          <ClubForeignView club={foreignClub} onChange={refresh} />
        </PageBody>
      </PageBg>
    );
  }

  return (
    <>
      <PageBg variant="clubs" style={{
        display: replayWatch ? "none" : "flex",
        flexDirection: "column",
        fontFamily: "var(--app-font-sans)",
      }}>
        <PageHeader onBack={onBack} title={<><EmojiIcon emoji="🏛️" size={20} /> <Tr id="clubs.title" /></>} />

        <PageBody style={{ flex: 1, minHeight: 0, overflowY: myClub ? "hidden" : "auto" }}>
        {myClub ? (
          <MyClubView
            club={myClub}
            onChange={refresh}
            onGoToMainMenu={onGoToMainMenu}
            onWatchReplay={(replayId, share) => setReplayWatch({ replayId, share })}
          />
        ) : (
          <ClubsBrowse onChange={refresh} />
        )}
        </PageBody>
      </PageBg>

      {replayWatch && typeof document !== "undefined" && createPortal(
        <BattleReplayViewer
          replayId={replayWatch.replayId}
          sharePayload={replayWatch.share}
          onClose={() => setReplayWatch(null)}
          onFinished={() => setReplayWatch(null)}
        />,
        document.body,
      )}
    </>
  );
}

function ClubForeignView({ club, onChange }: { club: Club; onChange: () => void }) {
  const { t } = useI18n();
  const [msg, setMsg] = useState("");
  const myClub = getMyClub();

  const handleJoin = () => {
    if (myClub) {
      setMsg(t("clubs.leaveFirst"));
      setTimeout(() => setMsg(""), 2400);
      return;
    }
    const r = joinClub(club.id);
    setMsg(r.success ? (r.pending ? t("clubs.applicationSent") : t("clubs.joined")) : (r.error ?? t("common.error")));
    if (r.success && !r.pending) onChange();
    setTimeout(() => setMsg(""), 2400);
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{
        display: "flex", gap: 14, alignItems: "center",
        padding: 16, borderRadius: 14,
        background: "rgba(0,0,0,0.4)",
        border: "1px solid rgba(255,138,101,0.35)",
      }}>
        <ClubAvatar club={club} size={72} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>{club.name}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
            {club.members.length}/{CLUB_MEMBERS_MAX} · {club.type === "open" ? t("clubs.type.open") : t("clubs.type.closed")}
          </div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 14, lineHeight: 1.45 }}>
        {club.description || t("common.noDescription")}
      </p>
      {msg && (
        <div style={{ marginTop: 12, padding: 10, textAlign: "center", color: "#FFD54F", fontSize: 12, fontWeight: 700 }}>
          {msg}
        </div>
      )}
      {!myClub && (
        <button
          type="button"
          onClick={handleJoin}
          style={{
            marginTop: 16, width: "100%", padding: "12px 20px",
            background: "linear-gradient(135deg, #FF7043, #FF8A65)",
            border: "none", borderRadius: 12, color: "#fff",
            fontWeight: 900, fontSize: 15, cursor: "pointer",
          }}
        >
          {club.type === "open" ? t("clubs.join") : t("clubs.apply")}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// BROWSE / JOIN / CREATE
// ─────────────────────────────────────────────────────────────────────────
function ClubsBrowse({ onChange }: { onChange: () => void }) {
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const me = getCurrentUsername();
  const all = useMemo(() => getAllClubs(), [showCreate, msg]);
  const invites = useMemo(() => getMyClubInvites(), [msg]);

  const visible = all.filter(c => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
  });

  const handleJoin = (club: Club) => {
    const r = joinClub(club.id);
    if (r.success) {
      setMsg(r.pending ? t("clubs.applicationSentShort") : t("clubs.joinedShort"));
      onChange();
    } else {
      setMsg(r.error ?? t("common.error"));
    }
    setTimeout(() => setMsg(""), 2400);
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
      {msg && (
        <div style={{
          marginBottom: 12, padding: "8px 14px", textAlign: "center",
          background: "rgba(255,213,79,0.12)",
          border: "1px solid rgba(255,213,79,0.3)",
          borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#FFD54F",
        }}>{msg}</div>
      )}

      {invites.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <SectionTitle>{t("clubs.invites")}</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {invites.map(c => (
              <div key={c.id} style={cardStyle("#FFD54F")}>
                <ClubAvatar club={c} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "white" }}>{c.name}</div>
                  <div style={{
                    fontSize: 11, color: "rgba(255,255,255,0.55)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{c.description || "—"}</div>
                </div>
                <button onClick={() => {
                  const r = acceptInvite(c.id);
                  if (r.success) onChange();
                  else setMsg(r.error ?? t("common.error"));
                }} style={primaryBtn("#76FF03")}>{t("common.accept")}</button>
                <button onClick={() => { declineInvite(c.id); onChange(); }} style={primaryBtn("#888")}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        display: "flex", gap: 10, marginBottom: 14,
      }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t("common.searchPlaceholder")}
          style={{ ...inputStyle(), flex: 1 }}
        />
        <button onClick={() => setShowCreate(true)} style={primaryBtn("#76FF03")}>
          {t("clubs.create")}
        </button>
      </div>

      <SectionTitle>{visible.length === 0 ? t("clubs.listEmpty") : t("clubs.listTitle")}</SectionTitle>
      {visible.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center",
          color: "rgba(255,255,255,0.55)",
        }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}><EmojiIcon emoji="🏛️" size={56} /></div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{t("clubs.createFirstTitle")}</div>
          <div style={{ fontSize: 11, marginTop: 6 }}>
            {t("clubs.createFirstHint")}
          </div>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 10,
        }}>
          {visible.map(c => {
            const full = c.members.length >= CLUB_MEMBERS_MAX;
            const youAlreadyAsked = c.pendingRequests.some(r => r.username === me);
            return (
              <div key={c.id} style={cardStyle(c.type === "open" ? "#76FF03" : "#FF7043", true)}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <ClubAvatar club={c} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "white",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{c.name}</span>
                      <span style={typeBadge(c.type)}>{c.type === "open" ? t("clubs.type.openShort") : t("clubs.type.closedShort")}</span>
                    </div>
                    <div style={{
                      fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2,
                      overflow: "hidden", textOverflow: "ellipsis",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>{c.description || t("common.noDescription")}</div>
                  </div>
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.65)",
                }}>
                  <span><EmojiIcon emoji="👥" size={21} /> {c.members.length}/{CLUB_MEMBERS_MAX}</span>
                  <span><EmojiIcon emoji="⚔️" size={21} /> {c.totalBattles}</span>
                  <span>{t("clubs.cycles", { count: c.rewardsClaimed })}</span>
                </div>
                <button
                  onClick={() => handleJoin(c)}
                  disabled={full || youAlreadyAsked}
                  className={`ui-btn ui-btn--block ${
                    full || youAlreadyAsked
                      ? "ui-btn--ghost"
                      : c.type === "open"
                        ? "ui-btn--success"
                        : "ui-btn--accent"
                  }`}
                  style={{
                    marginTop: 10,
                    padding: "9px 0", fontSize: 12, letterSpacing: "0.12em",
                  }}
                >
                  {full ? t("clubs.full")
                    : youAlreadyAsked ? t("clubs.applicationPending")
                    : c.type === "open" ? t("clubs.joinBtn") : t("clubs.applyBtn")}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateClubModal
          onCancel={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); onChange(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MEMBER / OWNED CLUB VIEW
// ─────────────────────────────────────────────────────────────────────────
type ClubView = "menu" | "club" | "treasury";

function MyClubView({
  club, onChange, onGoToMainMenu, onWatchReplay,
}: {
  club: Club;
  onChange: () => void;
  onGoToMainMenu?: (bossId: string) => void;
  onWatchReplay: (replayId: string, share?: ClubBattleSharePayload) => void;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<ClubView>("menu");
  const [unreadChat, setUnreadChat] = useState(() => getUnreadClubChatCount());
  const me = getCurrentUsername();
  const isFounder = me === club.createdBy;

  useEffect(() => {
    const syncUnread = () => setUnreadChat(getUnreadClubChatCount());
    syncUnread();
    window.addEventListener(CLUB_CHAT_CHANGED_EVENT, syncUnread);
    return () => window.removeEventListener(CLUB_CHAT_CHANGED_EVENT, syncUnread);
  }, []);

  const handleChatMarkedRead = useCallback(() => {
    setUnreadChat(getUnreadClubChatCount());
  }, []);

  useLayoutEffect(() => {
    if (view !== "club") return;
    markClubChatRead();
    setUnreadChat(getUnreadClubChatCount());
  }, [view, club.chat.length]);

  const openClubChat = () => {
    setView("club");
  };

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {view !== "treasury" && (
      <div style={{
        display: "flex", gap: view === "menu" ? 10 : 14, alignItems: "center",
        padding: view === "menu" ? "10px 18px" : "16px 22px",
        background: "rgba(0,0,0,0.3)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        <ClubAvatar club={club} size={view === "menu" ? 48 : 64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: view === "menu" ? 17 : 20, fontWeight: 900, color: "white" }}>{club.name}</span>
            <span style={typeBadge(club.type)}>{club.type === "open" ? t("clubs.type.openShort") : t("clubs.type.closedShort")}</span>
          </div>
          {view !== "menu" && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
              {club.description || t("common.noDescription")}
            </div>
          )}
          <div style={{
            fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: view === "menu" ? 2 : 4,
            display: "flex", gap: 14, flexWrap: "wrap",
          }}>
            <span><EmojiIcon emoji="👥" size={21} /> {club.members.length}/{CLUB_MEMBERS_MAX}</span>
            <span>{t("clubs.totalBattles", { count: club.totalBattles })}</span>
            {view !== "menu" && (
              <>
                <span>{t("clubs.cycles", { count: club.rewardsClaimed })}</span>
                <span>{t("clubs.createdSince", { date: new Date(club.createdAt).toLocaleDateString() })}</span>
              </>
            )}
          </div>
        </div>
        {view === "menu" ? (
          <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
            <div style={{ position: "relative", display: "inline-flex" }}>
              <button onClick={openClubChat} style={primaryBtn("#FFD54F")}>{t("clubs.openSection")}</button>
              <ClubNotifyBadge count={unreadChat} />
            </div>
            <button onClick={() => setView("treasury")} style={primaryBtn("#FFB300")}>{t("clubs.treasury.tab")}</button>
          </div>
        ) : view === "club" ? (
          <button onClick={() => setView("menu")} style={primaryBtn("#40C4FF")}>{t("clubs.backToMenu")}</button>
        ) : null}
      </div>
      )}

      {view === "menu" ? (
        <ClubMenuView
          club={club}
          isFounder={isFounder}
          onChange={onChange}
          onGoToMainMenu={onGoToMainMenu}
        />
      ) : view === "club" ? (
        <ClubRoomView club={club} onChange={onChange} onWatchReplay={onWatchReplay} onMarkedRead={handleChatMarkedRead} />
      ) : (
        <ClubTreasuryView club={club} onChange={onChange} onBack={() => setView("menu")} />
      )}
    </div>
  );
}

function ClubProgressBar({ club, onChange, embedded = false }: { club: Club; onChange: () => void; embedded?: boolean }) {
  const { t } = useI18n();
  const me = getCurrentUsername();
  const myMember = club.members.find(m => m.username === me);
  const doneCount = club.members.filter(memberCycleComplete).length;
  const total = club.members.length;
  const status = getClubRewardStatus(club);
  const myPct = myMember
    ? Math.min(100, (myMember.cycleWins / CLUB_WINS_PER_MEMBER) * 100)
    : 0;
  const pct = myPct;
  return (
    <div style={{
      padding: embedded ? "8px 12px" : "10px 22px",
      background: embedded ? "transparent" : "rgba(0,0,0,0.18)",
      borderBottom: embedded ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(255,255,255,0.05)",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: embedded ? 10 : 11, marginBottom: embedded ? 4 : 6,
        gap: 8, flexWrap: "wrap",
      }}>
        <span style={{ color: "#FFD54F", fontWeight: 800, letterSpacing: 1 }}>
          {t("clubs.cycleProgress", {
            done: doneCount,
            total,
            timeLeft: formatClubCycleTimeLeft(status.cycleTimeLeftMs),
          })}
        </span>
        <span style={{ color: "rgba(255,255,255,0.65)", fontWeight: 700 }}>
          {status.allMembersDone
            ? t("clubs.allRewardsAvailable")
            : t("clubs.partialRewards")}
        </span>
      </div>
      <VolProgressTrack
        fitHeight={16}
        fill={pct}
        fillBackground="linear-gradient(90deg, #FFD54F, #FF8A00)"
        fillBoxShadow="0 0 12px rgba(255,213,79,0.55)"
      />
      {myMember && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", marginTop: 6 }}
        >
          {t("clubs.yourWins", { wins: myMember.cycleWins, target: CLUB_WINS_PER_MEMBER })}
        </motion.div>
      )}
      <ClubRewardsClaimRow club={club} status={status} onChange={onChange} />
    </div>
  );
}

function ClubRewardsClaimRow({
  club, status, onChange,
}: {
  club: Club;
  status: ReturnType<typeof getClubRewardStatus>;
  onChange: () => void;
}) {
  const { t } = useI18n();
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [pickMember, setPickMember] = useState<string | null>(null);
  const usedPicks = new Set(Object.values(status.myClaims));

  const tryClaim = (fromMember: string, pick: ClubRewardPick) => {
    const r = claimClubCycleReward(club.id, fromMember, pick);
    if (r.success) {
      setMsg(t("clubs.rewardClaimed"));
      setMsgOk(true);
      setPickMember(null);
      onChange();
    } else {
      setMsg(r.error ?? t("common.error"));
      setMsgOk(false);
    }
    setTimeout(() => setMsg(""), 2200);
  };

  const claimable = status.qualifiedMembers.filter(u => !status.myClaims[u]);
  if (claimable.length === 0 && status.slotsUsed >= status.maxRewardSlots) return null;

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginBottom: 4, lineHeight: 1.35 }}>
        {t("clubs.rewardPickCompact", {
          coins: CLUB_REWARD_COINS,
          gems: CLUB_REWARD_GEMS,
          pp: CLUB_REWARD_PP,
          used: status.slotsUsed,
          max: status.maxRewardSlots,
        })}
      </div>
      {claimable.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {claimable.map(u => (
            <button
              key={u}
              onClick={() => setPickMember(pickMember === u ? null : u)}
              style={primaryBtn(pickMember === u ? "#FFD54F" : "#5C6BC0")}
            >
              {u}
            </button>
          ))}
        </div>
      )}
      {pickMember && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {(["coins", "gems", "pp"] as const).map(pick => {
            const disabled = usedPicks.has(pick) || status.slotsUsed >= status.maxRewardSlots;
            const label = pick === "coins"
              ? t("clubs.rewardCoinsPick", { count: CLUB_REWARD_COINS })
              : pick === "gems"
                ? t("clubs.rewardGemsPick", { count: CLUB_REWARD_GEMS })
                : t("clubs.rewardPpPick", { count: CLUB_REWARD_PP });
            return (
              <button
                key={pick}
                disabled={disabled}
                onClick={() => tryClaim(pickMember, pick)}
                style={{
                  ...primaryBtn(pick === "coins" ? "#FFD54F" : pick === "gems" ? "#40C4FF" : "#CE93D8"),
                  opacity: disabled ? 0.45 : 1,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {msg && (
        <div style={{ marginTop: 6, fontSize: 11, color: msgOk ? "#76FF03" : "#FF7070" }}>
          {msg}
        </div>
      )}
    </div>
  );
}

function ClubBossRaidPanel({
  club,
  onChange,
  onGoToMainMenu,
  embedded = false,
}: {
  club: Club;
  onChange: () => void;
  onGoToMainMenu?: (bossId: string) => void;
  embedded?: boolean;
}) {
  const { t } = useI18n();
  const profile = getCurrentProfile();
  const myId = profile?.playerId ? normalizePlayerIdQuery(profile.playerId) : null;
  const [pickingBoss, setPickingBoss] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    syncClubBossRaidFromParty(club.id);
    return subscribeClubBossRaidChanged(() => {
      syncClubBossRaidFromParty(club.id);
      setTick(x => x + 1);
      onChange();
    });
  }, [club.id, onChange]);

  const freshClub = getClub(club.id);
  const activeClub = freshClub ?? club;
  const raid = activeClub.bossRaid;
  const bossId = raid?.bossId ?? null;
  const boss = bossId ? getBrawlerById(bossId) : null;
  const bossLevel = bossId && profile ? getBossRaidCurrentLevel(profile, bossId) : 1;
  const recruiting = !!raid?.partyCode;
  const amLeader = !!(myId && raid?.leaderPlayerId && normalizePlayerIdQuery(raid.leaderPlayerId) === myId);
  const amJoined = !!(myId && raid?.joinedPlayerIds?.some(id => normalizePlayerIdQuery(id) === myId));
  const memberViews = getClubBossRaidMemberViews(activeClub);
  const joinedOnlineCount = memberViews.filter(m => m.joined).length;

  const flash = (text: string, ok: boolean) => {
    setMsg(text);
    setMsgOk(ok);
    setTimeout(() => setMsg(""), 2400);
  };

  const pickBoss = (id: string) => {
    const r = setClubBossRaidBoss(club.id, id);
    if (r.success) {
      setPickingBoss(false);
      emitClubBossRaidChanged();
      onChange();
    } else {
      flash(r.error ?? t("common.error"), false);
    }
  };

  const goMenu = (id: string) => {
    if (onGoToMainMenu) onGoToMainMenu(id);
  };

  const onStart = () => {
    const r = startClubBossRaidRecruitment(club.id);
    if (r.success && r.bossId) {
      flash(t("clubs.bossRaid.teamReady"), true);
      onChange();
      goMenu(r.bossId);
    } else {
      flash(r.error ?? t("common.error"), false);
    }
  };

  const onJoin = () => {
    void joinClubBossRaidRecruitment(club.id).then((r) => {
      if (r.success && r.bossId) {
        flash(t("clubs.bossRaid.joined"), true);
        onChange();
        goMenu(r.bossId);
      } else {
        flash(r.error ?? t("common.error"), false);
      }
    });
  };

  const onCancel = () => {
    const r = cancelClubBossRaidRecruitment(club.id);
    if (r.success) {
      flash(t("clubs.bossRaid.cancelled"), true);
      onChange();
    } else {
      flash(r.error ?? t("common.error"), false);
    }
  };

  const myOnline = myId ? getPresenceForPlayerId(myId).online : false;
  const canJoin = recruiting && !amJoined && myOnline && bossId && !amLeader;

  return (
    <div style={{
      padding: embedded ? "8px 12px" : "8px 22px 10px",
      background: embedded ? "rgba(80,20,120,0.14)" : "rgba(80,20,120,0.22)",
      borderBottom: embedded ? "1px solid rgba(186,104,255,0.12)" : "1px solid rgba(186,104,255,0.2)",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: embedded ? 4 : 6,
      }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#CE93D8", letterSpacing: "0.08em" }}>
          {t("clubs.bossRaid.title")}
        </span>
        {joinedOnlineCount > 1 && (
          <span style={{ fontSize: 9, fontWeight: 800, color: "#FFD54F" }}>
            {t("clubs.bossRaid.doubleHint")}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: embedded ? 8 : 12, alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{
          flex: embedded ? "0 0 88px" : "0 0 120px",
          minHeight: embedded ? 96 : 128,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: embedded ? "4px 2px 6px" : "6px 4px 8px",
        }}>
          {boss ? (
            <>
              <div style={{
                width: embedded ? 72 : 96,
                height: embedded ? 62 : 86,
                flexShrink: 0,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
              }}>
                <div style={{ transform: "translateX(-5px)" }}>
                  <BrawlerViewer3D brawlerId={boss.id} color={boss.color} size={embedded ? 58 : 76} />
                </div>
              </div>
              <div style={{
                fontSize: 10,
                fontWeight: 800,
                color: "white",
                textAlign: "center",
                padding: "0 4px",
                marginTop: 6,
                lineHeight: 1.2,
              }}>
                {brawlerName(boss.id)}
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                {t("nav.raidLevel", { level: bossLevel })}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textAlign: "center", padding: 8 }}>
              {t("clubs.bossRaid.noBoss")}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          {pickingBoss ? (
            <div style={{
              maxHeight: 360,
              minHeight: 300,
              overflowX: "hidden",
              overflowY: "auto",
              paddingBottom: 8,
            }}>
              <BossRaidLobbyCarousel onSelectBoss={pickBoss} />
              <button
                type="button"
                onClick={() => setPickingBoss(false)}
                style={{ ...primaryBtn("#5C6BC0"), marginTop: 6, fontSize: 10 }}
              >
                {t("common.cancel")}
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                {!recruiting && (
                  <button type="button" onClick={() => setPickingBoss(true)} style={primaryBtn("#AB47BC")}>
                    {boss ? t("clubs.bossRaid.changeBoss") : t("clubs.bossRaid.pickBoss")}
                  </button>
                )}
                {bossId && !recruiting && (
                  <button type="button" onClick={onStart} style={primaryBtn("#FFD54F")}>
                    {t("clubs.bossRaid.assembleTeam")}
                  </button>
                )}
                {canJoin && (
                  <button type="button" onClick={onJoin} style={primaryBtn("#76FF03")}>
                    {t("clubs.bossRaid.joinTeam")}
                  </button>
                )}
                {recruiting && amLeader && (
                  <button type="button" onClick={onCancel} style={primaryBtn("#FF7070")}>
                    {t("clubs.bossRaid.cancelRecruit")}
                  </button>
                )}
                {recruiting && amJoined && amLeader && (
                  <button type="button" onClick={() => bossId && goMenu(bossId)} style={primaryBtn("#40C4FF")}>
                    {t("clubs.bossRaid.toMainMenu")}
                  </button>
                )}
                {recruiting && amJoined && !amLeader && (
                  <button type="button" onClick={() => bossId && goMenu(bossId)} style={primaryBtn("#40C4FF")}>
                    {t("clubs.bossRaid.toMainMenu")}
                  </button>
                )}
              </div>
              {recruiting && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>
                  {t("clubs.bossRaid.recruiting", { leader: raid?.leaderUsername ?? "?" })}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {memberViews.map(m => {
                  const online = m.playerId ? getPresenceForPlayerId(m.playerId).online : false;
                  return (
                    <span
                      key={m.username}
                      title={online ? t("presence.online") : t("presence.longAgo")}
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "3px 7px",
                        borderRadius: 6,
                        border: `1px solid ${m.joined ? "rgba(118,255,3,0.45)" : "rgba(255,255,255,0.12)"}`,
                        background: m.joined ? "rgba(118,255,3,0.12)" : "rgba(255,255,255,0.05)",
                        color: m.joined ? "#C5E1A5" : "rgba(255,255,255,0.55)",
                      }}
                    >
                      <span style={{
                        display: "inline-block",
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        marginRight: 4,
                        background: online ? "#76FF03" : "rgba(255,255,255,0.25)",
                        verticalAlign: "middle",
                      }} />
                      {m.username}{m.isLeader ? <> <EmojiIcon emoji="★" size={18} /></> : ""}
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      {msg && (
        <div style={{ marginTop: 6, fontSize: 10, color: msgOk ? "#76FF03" : "#FF7070" }}>
          {msg}
        </div>
      )}
    </div>
  );
}

// ─── Chat panel ─────────────────────────────────────────────────────────
const ClubChatMessages = memo(function ClubChatMessages({
  clubId,
  onWatchReplay,
  onMarkedRead,
}: {
  clubId: string;
  onWatchReplay: (replayId: string, share?: ClubBattleSharePayload) => void;
  onMarkedRead?: () => void;
}) {
  const { t } = useI18n();
  const [chatTick, setChatTick] = useState(0);
  const me = getCurrentUsername();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bump = () => setChatTick(n => n + 1);
    window.addEventListener(CLUB_CHAT_CHANGED_EVENT, bump);
    return () => window.removeEventListener(CLUB_CHAT_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    scheduleGuardianAiClubRescan(clubId, 2500);
    return () => cancelGuardianAiClubRescan(clubId);
  }, [clubId]);

  const chatMessages = useMemo(() => {
    void chatTick;
    return getClub(clubId)?.chat ?? [];
  }, [clubId, chatTick]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const tryMarkRead = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (dist > 96) return;
    markClubChatRead();
    onMarkedRead?.();
  }, [onMarkedRead]);

  useLayoutEffect(() => {
    scrollToBottom();
    markClubChatRead();
    onMarkedRead?.();
  }, [chatMessages.length, scrollToBottom, onMarkedRead]);

  return (
    <div
      ref={scrollRef}
      onScroll={tryMarkRead}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehavior: "contain",
        WebkitOverflowScrolling: "touch",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {chatMessages.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", padding: 40 }}>
          {t("clubs.chatEmpty")}
        </div>
      ) : (
        chatMessages.map(m => (
          <ChatMessageRow
            key={m.id}
            message={m}
            isMine={m.username === me}
            onWatchReplay={onWatchReplay}
          />
        ))
      )}
      <div ref={bottomRef} style={{ height: 1, flexShrink: 0 }} aria-hidden />
    </div>
  );
});

const ClubChatComposer = memo(function ClubChatComposer({ clubId }: { clubId: string }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [pinCooldownUntil, setPinCooldownUntil] = useState(0);
  const profile = getCurrentProfile();
  const brawlerId = profile?.selectedBrawlerId ?? "hana";
  const pinCooldown = Date.now() < pinCooldownUntil;

  const send = async () => {
    if (!text.trim()) return;
    const r = await sendChatMessage(clubId, text);
    if (r.success) setText("");
  };

  const sendPin = (pinId: string) => {
    if (Date.now() < pinCooldownUntil) return;
    const r = sendClubChatPin(clubId, pinId, brawlerId);
    if (r.success) {
      setPinCooldownUntil(Date.now() + 2500);
      setShowPins(false);
    }
  };

  return (
    <>
      {showPins && (
        <div style={{
          padding: "6px 16px 0",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(0,0,0,0.22)",
          flexShrink: 0,
        }}>
          <ChatPinTray brawlerId={brawlerId} onPick={sendPin} disabled={pinCooldown} compact />
        </div>
      )}
      <div style={{
        display: "flex", gap: 8, padding: "10px 22px",
        background: "rgba(0,0,0,0.35)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        <button
          type="button"
          title={t("chatPin.title")}
          disabled={pinCooldown}
          onClick={() => setShowPins(v => !v)}
          style={{
            ...primaryBtn("#76FF03"),
            minWidth: 44,
            padding: "8px 10px",
            fontSize: 18,
            opacity: pinCooldown ? 0.55 : 1,
          }}
        >
          <EmojiIcon emoji="📌" size={20} />
        </button>
        <input
          value={text}
          onChange={e => setText(e.target.value.slice(0, CLUB_CHAT_MAX))}
          onKeyDown={e => { if (e.key === "Enter") void send(); }}
          placeholder={t("clubs.chatPlaceholder")}
          maxLength={CLUB_CHAT_MAX}
          style={{ ...inputStyle(), flex: 1 }}
        />
        <button onClick={() => void send()} disabled={!text.trim()} style={{
          ...primaryBtn("#76FF03"),
          color: "#FFFFFF",
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: "0.06em",
          textShadow: "0 1px 3px rgba(0,0,0,0.65)",
          minWidth: 44,
          opacity: text.trim() ? 1 : 0.45,
        }}>
          {t("common.send")}
        </button>
      </div>
    </>
  );
});

function ChatPanel({
  club,
  onWatchReplay,
  onMarkedRead,
}: {
  club: Club;
  onChange: () => void;
  onWatchReplay: (replayId: string, share?: ClubBattleSharePayload) => void;
  onMarkedRead?: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%", overflow: "hidden" }}>
      <ClubChatMessages
        clubId={club.id}
        onWatchReplay={onWatchReplay}
        onMarkedRead={onMarkedRead}
      />
      <ClubChatComposer clubId={club.id} />
    </div>
  );
}

function ClubMenuView({
  club, isFounder, onChange, onGoToMainMenu,
}: {
  club: Club;
  isFounder: boolean;
  onChange: () => void;
  onGoToMainMenu?: (bossId: string) => void;
}) {
  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      padding: "10px 14px 14px",
    }}>
      <div style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: "minmax(300px, 1.12fr) minmax(260px, 1fr)",
        gap: 12,
        alignItems: "stretch",
      }}>
        <div style={{
          background: "rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          alignSelf: "start",
          width: "100%",
        }}>
          <InfoPanel club={club} isFounder={isFounder} onChange={onChange} layout="menu" />
        </div>
        <div style={{
          background: "rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          <ClubProgressBar club={club} onChange={onChange} embedded />
          <ClubBossRaidPanel club={club} onChange={onChange} onGoToMainMenu={onGoToMainMenu} embedded />
          <MembersPanel club={club} isFounder={isFounder} canModerate={isFounder} onChange={onChange} compact scrollable />
        </div>
      </div>
    </div>
  );
}

function ClubRoomView({
  club,
  onChange,
  onWatchReplay,
  onMarkedRead,
}: {
  club: Club;
  onChange: () => void;
  onWatchReplay: (replayId: string, share?: ClubBattleSharePayload) => void;
  onMarkedRead?: () => void;
}) {
  const { t } = useI18n();
  const status = getClubRewardStatus(club);
  const doneCount = club.members.filter(memberCycleComplete).length;
  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      height: "100%",
      display: "grid",
      gridTemplateColumns: "1.25fr 0.75fr",
      gridTemplateRows: "minmax(0, 1fr)",
      gap: 10,
      padding: "10px 14px",
      overflow: "hidden",
    }}>
      <div style={{
        background: "rgba(0,0,0,0.28)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        overflow: "hidden",
        minHeight: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}>
        <ChatPanel club={club} onChange={onChange} onWatchReplay={onWatchReplay} onMarkedRead={onMarkedRead} />
      </div>
      <div style={{
        background: "rgba(0,0,0,0.28)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "12px 14px",
        alignSelf: "start",
        maxHeight: "100%",
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}>
        <SectionTitle>{t("clubs.resultsTitle")}</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <StatRow label={t("clubs.statTotalWins")} value={String(club.totalBattles)} />
          <StatRow label={t("clubs.statGoalComplete")} value={`${doneCount}/${club.members.length}`} />
          <StatRow label={t("clubs.statCycleEnd")} value={formatClubCycleTimeLeft(status.cycleTimeLeftMs)} />
        </div>
        <SectionTitle>{t("clubs.rewardsTitle")}</SectionTitle>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
          {t("clubs.rewardRuleCompact", { count: CLUB_WINS_PER_MEMBER })}
        </div>
      </div>
    </div>
  );
}

const ChatMessageRow = memo(function ChatMessageRow({
  message,
  isMine,
  onWatchReplay,
}: {
  message: ClubMessage;
  isMine: boolean;
  onWatchReplay: (replayId: string, share?: ClubBattleSharePayload) => void;
}) {
  const { t, localeMeta } = useI18n();
  if (message.astral) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width: "100%",
      }}>
        <div style={{
          fontSize: 10, fontWeight: 800, color: "#CE93D8",
          marginBottom: 2, letterSpacing: 0.5, padding: "0 4px",
        }}>{message.username}</div>
        <div style={{
          maxWidth: "85%",
          background: "linear-gradient(135deg, rgba(123,31,162,0.45), rgba(74,20,140,0.55))",
          border: "1px solid rgba(206,147,216,0.55)",
          borderRadius: 12,
          padding: "8px 12px",
          boxShadow: "0 0 12px rgba(156,39,176,0.25)",
        }}>
          <div style={{ fontSize: 13, color: "#F3E5F5", lineHeight: 1.4, wordBreak: "break-word" }}>
            <TextWithEmojis text={message.text} emojiSize={24} />
          </div>
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2, padding: "0 4px" }}>
          {new Date(message.sentAt).toLocaleString(localeMeta.bcp47, {
            hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
          })}
        </div>
      </div>
    );
  }
  if (message.system) {
    return (
      <div style={{
        alignSelf: "center", maxWidth: "80%",
        padding: "5px 12px",
        background: "rgba(255,213,79,0.08)",
        border: "1px solid rgba(255,213,79,0.3)",
        borderRadius: 8,
        fontSize: 11, color: "#FFD54F", fontWeight: 700, textAlign: "center",
      }}><TextWithEmojis text={message.text} emojiSize={24} /></div>
    );
  }
  if (message.pinId) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
      }}>
        {!isMine && (
          <div style={{
            fontSize: 10, fontWeight: 800, color: "#FFD54F",
            marginBottom: 2, letterSpacing: 0.5, padding: "0 4px",
          }}>{message.username}</div>
        )}
        <ChatPinBubble pinId={message.pinId} size={56} />
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2, padding: "0 4px" }}>
          {new Date(message.sentAt).toLocaleString(localeMeta.bcp47, {
            hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
          })}
        </div>
      </div>
    );
  }
  if (message.battleShare) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        width: "100%",
      }}>
        <div style={{
          width: "100%",
          maxWidth: "100%",
          display: "flex", flexDirection: "column", gap: 6,
          alignItems: isMine ? "flex-end" : "flex-start",
        }}>
          {!isMine && (
            <div style={{
              fontSize: 10, fontWeight: 800, color: "#FFD54F",
              letterSpacing: 0.5, padding: "0 4px",
            }}>
              {message.username}
            </div>
          )}
          <div style={{
            fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.72)",
            padding: "0 4px",
          }}>
            {t("clubs.battleSharePosted")}
          </div>
          <ClubBattleShareCard
            payload={message.battleShare}
            sentAt={message.sentAt}
            localeTag={localeMeta.bcp47}
            compact
            onWatch={() => onWatchReplay(message.battleShare!.replayId, message.battleShare!)}
          />
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2, padding: "0 4px" }}>
          {new Date(message.sentAt).toLocaleString(localeMeta.bcp47, {
            hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
          })}
        </div>
      </div>
    );
  }
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: isMine ? "flex-end" : "flex-start",
    }}>
      <div style={{
        maxWidth: "75%",
        background: isMine
          ? "linear-gradient(135deg, #1976D2, #0D47A1)"
          : "rgba(255,255,255,0.06)",
        border: `1px solid ${isMine ? "rgba(64,196,255,0.45)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 12,
        padding: "8px 12px",
      }}>
        {!isMine && (
          <div style={{
            fontSize: 10, fontWeight: 800, color: "#FFD54F",
            marginBottom: 2, letterSpacing: 0.5,
          }}>{message.username}</div>
        )}
        <div style={{ fontSize: 13, color: "white", lineHeight: 1.35, wordBreak: "break-word" }}>
          <TextWithEmojis text={message.text} emojiSize={24} />
        </div>
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 2, padding: "0 4px" }}>
        {new Date(message.sentAt).toLocaleString(localeMeta.bcp47, {
          hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
        })}
      </div>
    </div>
  );
});

// ─── Members panel ──────────────────────────────────────────────────────
function MembersPanel({
  club, isFounder, canModerate, onChange, compact = false, scrollable = false,
}: {
  club: Club;
  isFounder: boolean;
  canModerate: boolean;
  onChange: () => void;
  compact?: boolean;
  scrollable?: boolean;
}) {
  const { t } = useI18n();
  const me = getCurrentUsername();
  const [, setPresenceTick] = useState(0);

  useEffect(() => {
    const bump = () => setPresenceTick(x => x + 1);
    bump();
    window.addEventListener(PRESENCE_CHANGED_EVENT, bump);
    const iv = window.setInterval(bump, 8000);
    return () => {
      window.removeEventListener(PRESENCE_CHANGED_EVENT, bump);
      window.clearInterval(iv);
    };
  }, []);

  const sorted = [...club.members].sort((a, b) => {
    const order = { leader: 0, helper: 1, member: 2 };
    if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
    return rankIndex(getMemberRank(b)) - rankIndex(getMemberRank(a)) || b.cycleWins - a.cycleWins;
  });

  return (
    <div style={{
      padding: compact ? 12 : 16,
      display: "flex",
      flexDirection: "column",
      flex: scrollable ? 1 : undefined,
      minHeight: scrollable ? 0 : undefined,
      overflow: scrollable ? "hidden" : undefined,
    }}>
      {canModerate && club.pendingRequests.length > 0 && (
        <div style={{ marginBottom: compact ? 10 : 16, flexShrink: 0 }}>
          <SectionTitle>{t("clubs.requests", { count: club.pendingRequests.length })}</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {club.pendingRequests.map(r => (
              <div key={r.username} style={cardStyle("#FFD54F")}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "white", fontWeight: 800, fontSize: 13 }}>{r.username}</div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}>
                    {t("clubs.appliedOn", { date: new Date(r.requestedAt).toLocaleDateString() })}
                  </div>
                </div>
                <button onClick={() => {
                  const res = approveJoinRequest(club.id, r.username);
                  if (res.success) onChange();
                }} style={primaryBtn("#76FF03")}>{t("common.accept")}</button>
                <button onClick={() => { denyJoinRequest(club.id, r.username); onChange(); }} style={primaryBtn("#888")}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <SectionTitle>{t("clubs.members")}</SectionTitle>
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        flex: scrollable ? 1 : undefined,
        minHeight: scrollable ? 0 : undefined,
        overflowY: scrollable ? "auto" : undefined,
        overscrollBehavior: scrollable ? "contain" : undefined,
        paddingRight: scrollable ? 2 : 0,
      }}>
        {sorted.map(m => (
          <MemberRow
            key={m.username}
            member={m}
            isMe={m.username === me}
            isFounder={m.username === club.createdBy}
            canModerate={isFounder}
            club={club}
            onSetRank={(rank) => {
              const r = setMemberRank(club.id, m.username, rank);
              if (r.success) onChange();
            }}
            onKick={() => {
              if (confirm(t("clubs.kickConfirm", { name: m.username }))) {
                const r = kickMember(club.id, m.username);
                if (r.success) onChange();
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function InviteRow({ club, onInvited, compact = false, inline = false }: { club: Club; onInvited: () => void; compact?: boolean; inline?: boolean }) {
  const { t } = useI18n();
  const [playerId, setPlayerId] = useState("");
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);

  const handleInvite = () => {
    const r = inviteUser(club.id, playerId.trim());
    setMsg(r.success ? t("clubs.inviteSent") : (r.error ?? t("common.error")));
    setMsgOk(r.success);
    if (r.success) {
      setPlayerId("");
      onInvited();
    }
    setTimeout(() => setMsg(""), 2400);
  };

  return (
    <div style={{
      marginBottom: compact && !inline ? 0 : 16,
      padding: inline ? 0 : (compact ? 10 : 12),
      background: inline ? "transparent" : "rgba(64,196,255,0.06)",
      border: inline ? "none" : "1px solid rgba(64,196,255,0.25)",
      borderRadius: inline ? 0 : 10,
    }}>
      {!inline && <SectionTitle>{t("clubs.invitePlayer")}</SectionTitle>}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={playerId}
          onChange={e => setPlayerId(normalizePlayerIdQuery(e.target.value))}
          placeholder={inline ? t("clubs.invitePlayer") : t("clubs.inviteIdPlaceholder")}
          maxLength={12}
          style={{ ...inputStyle(), flex: 1, fontFamily: "monospace", letterSpacing: 1, fontSize: inline ? 12 : undefined }}
        />
        <button onClick={handleInvite} disabled={!playerId.trim()} style={{ ...primaryBtn("#40C4FF"), fontSize: inline ? 11 : undefined, whiteSpace: "nowrap" }}>
          {t("clubs.inviteBtn")}
        </button>
      </div>
      {msg && (
        <div style={{
          marginTop: 6, fontSize: 11, color: msgOk ? "#76FF03" : "#FF7070",
        }}>{msg}</div>
      )}
    </div>
  );
}

function MemberRow({
  member, isMe, isFounder, canModerate, club, onSetRank, onKick,
}: {
  member: ClubMember;
  isMe: boolean;
  isFounder: boolean;
  canModerate: boolean;
  club: Club;
  onSetRank: (rank: ClubRank) => void;
  onKick: () => void;
}) {
  const { t } = useI18n();
  const profile = getAllProfiles()[member.username];
  const playerId = profile?.playerId;
  const presence = playerId
    ? getPresenceForPlayerId(playerId)
    : { online: false, updatedAt: 0, screen: "offline" as const };
  const statusText = getClubMemberStatusText(playerId);
  const battleMode = playerId ? getBattleModeForPlayerId(playerId) : null;
  const modeIconUrl = battleMode ? getModeIconUrl(battleMode) : null;
  const rank = getMemberRank(member);
  const meta = CLUB_RANK_META[rank];
  const roleColor = meta.color;
  const roleLabel = t(CLUB_RANK_LABEL_KEYS[rank]);
  const rankIdx = rankIndex(rank);
  const avatarSize = 40;
  const brawlerId = profile?.selectedBrawlerId || profile?.favoriteBrawlerId || "miya";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: canModerate && !isFounder
        ? `${avatarSize}px minmax(0, 1fr) auto auto`
        : `${avatarSize}px minmax(0, 1fr) auto`,
      alignItems: "center",
      gap: 10,
      background: isMe ? "rgba(64,196,255,0.10)" : "rgba(0,0,0,0.30)",
      border: `1px solid ${isMe ? "rgba(64,196,255,0.4)" : presence.online ? "rgba(105,240,174,0.28)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 10,
      padding: "8px 10px",
    }}>
      <div style={{ position: "relative", width: avatarSize, height: avatarSize }}>
        <FriendAvatar
          profileIconId={profile?.profileIconId}
          brawlerId={brawlerId}
          username={member.username}
          online={presence.online}
          size={avatarSize}
        />
        {modeIconUrl && (
          <img
            src={modeIconUrl}
            alt=""
            style={{
              position: "absolute",
              right: -3,
              bottom: -3,
              width: 18,
              height: 18,
              borderRadius: 5,
              border: "2px solid rgba(8,4,24,0.95)",
              objectFit: "cover",
              boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
            }}
          />
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 13, fontWeight: 800, color: "white",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            maxWidth: "100%",
          }}>{member.username}{isMe ? t("clubs.you") : ""}</span>
          {isFounder && (
            <span style={{
              fontSize: 9, background: "#FFD54F", color: "#ffffff",
              textShadow: "0 1px 2px rgba(0,0,0,0.85)",
              padding: "1px 5px", borderRadius: 4, fontWeight: 900,
              flexShrink: 0,
            }}>{t("clubs.creator")}</span>
          )}
          <span style={{
            fontSize: 9, fontWeight: 800, color: roleColor,
            padding: "1px 6px", borderRadius: 4,
            border: `1px solid ${roleColor}66`,
            background: `${roleColor}18`,
            flexShrink: 0,
          }}>{roleLabel}</span>
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          marginTop: 3,
          color: presence.online ? "#69F0AE" : "rgba(255,255,255,0.5)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {statusText}
        </div>
        <div style={{
          fontSize: 10,
          color: memberCycleComplete(member) ? "#76FF03" : "rgba(255,255,255,0.45)",
          marginTop: 2,
          fontWeight: 700,
        }}>
          {t("clubs.cycleProgressShort", { wins: member.cycleWins, target: CLUB_WINS_PER_MEMBER })}
        </div>
      </div>
      <div style={{
        fontSize: 14,
        fontWeight: 900,
        color: "#FFD700",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
        justifySelf: "end",
      }}>
        <TrophyIcon size={13} lite />
        {profile?.trophies ?? 0}
      </div>
      {canModerate && !isFounder && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {rankIdx > 0 && rank !== "owner" && (
            <button
              onClick={() => onSetRank(CLUB_RANK_ORDER[rankIdx - 1])}
              style={smallBtn("#888")}
              title={t("clubs.demote")}
            >▼</button>
          )}
          {rankIdx < CLUB_RANK_ORDER.length - 2 && (
            <button
              onClick={() => onSetRank(CLUB_RANK_ORDER[rankIdx + 1])}
              style={smallBtn("#40C4FF")}
              title={t("clubs.promote")}
            >▲</button>
          )}
          <button onClick={onKick} style={smallBtn("#FF5252")}>{t("clubs.kick")}</button>
        </div>
      )}
    </div>
  );
}

// ─── Info panel (founder edit) ──────────────────────────────────────────
function InfoPanel({
  club, isFounder, onChange, compact = false, layout = "panel",
}: { club: Club; isFounder: boolean; onChange: () => void; compact?: boolean; layout?: "panel" | "menu" }) {
  const { t } = useI18n();
  const [name, setName]     = useState(club.name);
  const [desc, setDesc]     = useState(club.description);
  const [type, setType]     = useState(club.type);
  const [profileIconId, setProfileIconId] = useState<string | undefined>(club.avatarProfileIconId);
  const [saved, setSaved] = useState("");
  const ownedIcons = useMemo(() => {
    const p = getCurrentProfile();
    return p ? getUnlockedProfileIconIds(p) : [];
  }, []);
  const CLUB_ICON_PREVIEW = 14;
  const allIconCount = ownedIcons.length;
  const iconsListCollapsible = allIconCount > CLUB_ICON_PREVIEW;
  const [iconsListExpanded, setIconsListExpanded] = useState(false);
  const visibleProfileIcons = iconsListExpanded
    ? ownedIcons
    : ownedIcons.slice(0, CLUB_ICON_PREVIEW);
  const base = (import.meta as any).env?.BASE_URL ?? "/";

  const previewClub = {
    name: name || club.name,
    avatarDataUrl: club.avatarDataUrl,
    avatarProfileIconId: profileIconId ?? club.avatarProfileIconId,
  };

  const save = () => {
    const r = updateClubInfo(club.id, {
      name, description: desc, type,
      avatarDataUrl: null,
      avatarProfileIconId: profileIconId ?? null,
    });
    if (r.success) {
      setSaved(t("common.saved"));
      onChange();
    } else {
      setSaved(r.error ?? t("common.error"));
    }
    setTimeout(() => setSaved(""), 2400);
  };

  const pickProfileIcon = (id: string) => {
    setProfileIconId(id);
    const r = setClubProfileIconAvatar(club.id, id);
    if (r.success) {
      setSaved(t("clubs.iconUpdated"));
      onChange();
    } else {
      setSaved(r.error ?? t("common.error"));
    }
    setTimeout(() => setSaved(""), 2400);
  };

  const renderClubIcons = (menuStyle: boolean) => {
    const cell = menuStyle ? 40 : 48;
    return (
      <Field label={t("clubs.field.avatar")} compact={menuStyle || compact}>
        {ownedIcons.length === 0 ? (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", lineHeight: 1.4 }}>
            {t("clubs.noProfileIcons")}
          </div>
        ) : (
          <>
            {iconsListCollapsible && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 8, marginBottom: 6,
              }}>
                <div style={{ fontSize: menuStyle ? 10 : 11, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>
                  {!iconsListExpanded && (
                    <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                      {t("clubs.iconsShown", { shown: visibleProfileIcons.length, total: allIconCount })}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIconsListExpanded(v => !v)}
                  style={{
                    ...primaryBtn(iconsListExpanded ? "#888" : "#40C4FF"),
                    padding: "5px 10px",
                    fontSize: 10,
                    letterSpacing: 0.5,
                    whiteSpace: "nowrap",
                  }}
                >
                  {iconsListExpanded ? t("clubs.hideList") : t("clubs.showList")}
                </button>
              </div>
            )}
            <div style={{
              overflowY: iconsListExpanded ? "auto" : "hidden",
              overflowX: "hidden",
              maxHeight: iconsListExpanded ? (menuStyle ? 176 : 220) : undefined,
              overscrollBehavior: "contain",
              paddingRight: iconsListExpanded ? 2 : 0,
            }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill, ${cell}px)`,
                gap: menuStyle ? 6 : 8,
                justifyContent: "start",
              }}>
                {visibleProfileIcons.map(id => {
                  const active = profileIconId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => pickProfileIcon(id)}
                      style={{
                        width: cell,
                        height: cell,
                        padding: 0,
                        border: active ? "2px solid #FFD54F" : "1px solid rgba(255,255,255,0.12)",
                        borderRadius: menuStyle ? 8 : 10,
                        overflow: "hidden",
                        cursor: "pointer",
                        background: "rgba(0,0,0,0.35)",
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={getProfileIconImage(id, base)}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </Field>
    );
  };

  if (!isFounder) {
    if (layout === "menu") {
      return (
        <div style={{ padding: 12 }}>
          <SectionTitle>{t("clubs.editSection")}</SectionTitle>
          <div style={{
            padding: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            display: "flex", gap: 10, alignItems: "center",
          }}>
            <ClubAvatar club={club} size={52} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "white" }}>{club.name}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 3, lineHeight: 1.35 }}>
                {club.description || t("common.noDescription")}
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 10, padding: 10,
            background: "rgba(255,213,79,0.08)",
            border: "1px solid rgba(255,213,79,0.3)",
            borderRadius: 10, fontSize: 11, color: "rgba(255,255,255,0.7)",
          }}>
            {t("clubs.editHint")}
          </div>
          <button onClick={() => {
            const profile = getCurrentProfile();
            const msg = profile
              ? buildLeaveClubConfirmMessage(profile, club, t)
              : t("clubs.leaveConfirm");
            if (confirm(msg)) {
              const r = leaveClub();
              if (r.success) onChange();
            }
          }} style={{ ...primaryBtn("#FF5252"), marginTop: 10, width: "100%" }}>{t("clubs.leaveBtn")}</button>
        </div>
      );
    }
    return (
      <div style={{ padding: compact ? 12 : 22 }}>
        <div style={{
          padding: 16,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          display: "flex", gap: 14, alignItems: "center",
        }}>
          <ClubAvatar club={club} size={64} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "white" }}>{club.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
              {club.description || t("common.noDescription")}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>
              {t("clubs.creatorLabel", { name: club.createdBy })} · {new Date(club.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 14, padding: 14,
          background: "rgba(255,213,79,0.08)",
          border: "1px solid rgba(255,213,79,0.3)",
          borderRadius: 10, fontSize: 12, color: "rgba(255,255,255,0.7)",
        }}>
          {t("clubs.editHint")}
        </div>
        <button onClick={() => {
          const profile = getCurrentProfile();
          const msg = profile
            ? buildLeaveClubConfirmMessage(profile, club, t)
            : t("clubs.leaveConfirm");
          if (confirm(msg)) {
            const r = leaveClub();
            if (r.success) onChange();
          }
        }} style={{ ...primaryBtn("#FF5252"), marginTop: 12 }}>{t("clubs.leaveBtn")}</button>
      </div>
    );
  }

  if (layout === "menu") {
    return (
      <div style={{ padding: 12 }}>
        <SectionTitle>{t("clubs.editSection")}</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 10px" }}>
          <Field label={t("clubs.field.name", { len: name.length, max: CLUB_NAME_MAX })} compact>
            <input
              value={name} maxLength={CLUB_NAME_MAX}
              onChange={e => setName(e.target.value.slice(0, CLUB_NAME_MAX))}
              style={inputStyle()}
            />
          </Field>
          <Field label={t("clubs.field.entryType")} compact>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setType("open")} style={{ ...typeChoiceStyle(type === "open", "#76FF03"), flex: 1, padding: "8px 6px", fontSize: 11 }}>
                {t("clubs.field.open")}
              </button>
              <button onClick={() => setType("closed")} style={{ ...typeChoiceStyle(type === "closed", "#FF7043"), flex: 1, padding: "8px 6px", fontSize: 11 }}>
                {t("clubs.field.closed")}
              </button>
            </div>
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label={t("clubs.field.desc", { len: desc.length, max: CLUB_DESC_MAX })} compact>
              <textarea
                value={desc} maxLength={CLUB_DESC_MAX} rows={2}
                onChange={e => setDesc(e.target.value.slice(0, CLUB_DESC_MAX))}
                style={{ ...inputStyle(), minHeight: 52, resize: "none" }}
              />
            </Field>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            {renderClubIcons(true)}
          </div>
        </div>

          {saved && (
            <div style={{
              marginTop: 8, padding: 6, fontSize: 11, fontWeight: 700,
              background: saved.startsWith("✓") || saved === t("common.saved") || saved === t("clubs.iconUpdated")
                ? "rgba(118,255,3,0.10)" : "rgba(255,112,112,0.10)",
              border: `1px solid ${saved.startsWith("✓") || saved === t("common.saved") || saved === t("clubs.iconUpdated")
                ? "rgba(118,255,3,0.4)" : "rgba(255,112,112,0.4)"}`,
              borderRadius: 8,
              color: saved.startsWith("✓") || saved === t("common.saved") || saved === t("clubs.iconUpdated") ? "#76FF03" : "#FF7070",
              textAlign: "center",
            }}>{saved}</div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 10, alignItems: "start" }}>
            <button onClick={save} style={{ ...primaryBtn("#FFD54F"), fontSize: 12, letterSpacing: "0.08em" }}>
              {t("clubs.saveBtn")}
            </button>
            <button onClick={() => {
              if (confirm(t("clubs.deleteConfirm"))) {
                const r = deleteClub(club.id);
                if (r.success) onChange();
              }
            }} style={{ ...primaryBtn("#FF5252"), fontSize: 11, whiteSpace: "nowrap" }}>
              {t("clubs.deleteBtn")}
            </button>
          </div>

          <div style={{ marginTop: 8 }}>
            <InviteRow club={club} onInvited={onChange} compact inline />
          </div>
        </div>
    );
  }

  return (
    <div style={{ padding: compact ? 12 : 22, maxWidth: compact ? undefined : 560, margin: compact ? 0 : "0 auto" }}>
      <SectionTitle>{t("clubs.editSection")}</SectionTitle>
      <div style={{ display: "flex", gap: compact ? 10 : 14, alignItems: "center", marginBottom: compact ? 10 : 14 }}>
        <ClubAvatar club={previewClub} size={compact ? 56 : 72} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: compact ? 14 : 16, fontWeight: 900, color: "white" }}>{previewClub.name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
            {desc || t("common.noDescription")}
          </div>
        </div>
      </div>

      <Field label={t("clubs.field.name", { len: name.length, max: CLUB_NAME_MAX })} compact={compact}>
        <input
          value={name} maxLength={CLUB_NAME_MAX}
          onChange={e => setName(e.target.value.slice(0, CLUB_NAME_MAX))}
          style={inputStyle()}
        />
      </Field>
      <Field label={t("clubs.field.desc", { len: desc.length, max: CLUB_DESC_MAX })} compact={compact}>
        <textarea
          value={desc} maxLength={CLUB_DESC_MAX} rows={compact ? 2 : 3}
          onChange={e => setDesc(e.target.value.slice(0, CLUB_DESC_MAX))}
          style={inputStyle()}
        />
      </Field>
      <Field label={t("clubs.field.entryType")} compact={compact}>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setType("open")}
            style={typeChoiceStyle(type === "open", "#76FF03")}
          >{t("clubs.field.open")}</button>
          <button
            onClick={() => setType("closed")}
            style={typeChoiceStyle(type === "closed", "#FF7043")}
          >{t("clubs.field.closed")}</button>
        </div>
      </Field>

      {renderClubIcons(false)}

      {saved && (
        <div style={{
          marginTop: 10, padding: 8, fontSize: 12, fontWeight: 700,
          background: saved.startsWith("✓") ? "rgba(118,255,3,0.10)" : "rgba(255,112,112,0.10)",
          border: `1px solid ${saved.startsWith("✓") ? "rgba(118,255,3,0.4)" : "rgba(255,112,112,0.4)"}`,
          borderRadius: 8, color: saved.startsWith("✓") ? "#76FF03" : "#FF7070",
          textAlign: "center",
        }}>{saved}</div>
      )}

      <button onClick={save} style={{
        ...primaryBtn("#FFD54F"),
        marginTop: compact ? 10 : 14,
        width: "100%",
        fontSize: 13,
        letterSpacing: "0.1em",
      }}>{t("clubs.saveBtn")}</button>
      <div style={{ marginTop: compact ? 8 : 12 }}>
        <InviteRow club={club} onInvited={onChange} compact={compact} />
      </div>
      <button onClick={() => {
        if (confirm(t("clubs.deleteConfirm"))) {
          const r = deleteClub(club.id);
          if (r.success) onChange();
        }
      }} style={{ ...primaryBtn("#FF5252"), marginTop: compact ? 6 : 8, width: "100%" }}>{t("clubs.deleteBtn")}</button>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 8,
      padding: "8px 10px",
      fontSize: 12,
    }}>
      <span style={{ color: "rgba(255,255,255,0.7)" }}>{label}</span>
      <strong style={{ color: "#FFD54F" }}>{value}</strong>
    </div>
  );
}

// ─── Style helpers ──────────────────────────────────────────────────────
const backButtonStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.24)",
  borderRadius: 10, padding: "7px 16px",
  color: "rgba(255,255,255,0.85)", cursor: "pointer",
  fontSize: 13, fontWeight: 700,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, color: "#FFD54F", letterSpacing: 2, fontWeight: 800,
      marginBottom: 8,
    }}>{children}</div>
  );
}

function cardStyle(accent: string, withGlow = false): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 10,
    padding: 14,
    background: `linear-gradient(160deg, ${accent}1f 0%, rgba(8,4,24,0.85) 100%)`,
    border: `1px solid ${accent}66`,
    borderRadius: "var(--r-md)",
    boxShadow: withGlow
      ? `0 0 22px ${accent}33, var(--sh-sm), inset 0 1px 0 rgba(255,255,255,0.05)`
      : "var(--sh-sm), inset 0 1px 0 rgba(255,255,255,0.04)",
    backdropFilter: "blur(10px) saturate(1.15)",
    WebkitBackdropFilter: "blur(10px) saturate(1.15)",
    transition: "all var(--ease-mid)",
    flexWrap: "wrap",
  };
}

function typeBadge(type: "open" | "closed"): React.CSSProperties {
  const color = type === "open" ? "#76FF03" : "#FF7043";
  return {
    background: `linear-gradient(135deg, ${color}55, ${color}22)`,
    color: "#fff",
    border: `1px solid ${color}`,
    borderRadius: "var(--r-pill)", padding: "3px 10px",
    fontSize: 9, fontWeight: 900, letterSpacing: "0.12em",
    boxShadow: `0 0 10px ${color}66`,
    textShadow: "0 1px 2px rgba(0,0,0,0.6)",
  };
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "9px 18px",
    background: active
      ? "linear-gradient(135deg, rgba(255,213,79,0.30), rgba(255,138,0,0.20))"
      : "rgba(255,255,255,0.04)",
    border: `1px solid ${active ? "var(--bd-gold)" : "var(--bd-1)"}`,
    borderRadius: "var(--r-pill)",
    color: active ? "var(--c-gold-3)" : "var(--t-3)",
    fontWeight: 800, fontSize: 12, letterSpacing: "0.06em",
    cursor: "pointer",
    boxShadow: active
      ? "0 0 14px rgba(255,213,79,0.45), inset 0 1px 0 rgba(255,255,255,0.1)"
      : "var(--sh-sm)",
    transition: "all var(--ease-mid)",
    fontFamily: "inherit",
  };
}

function primaryBtn(color: string): React.CSSProperties {
  const isMuted = color === "#888";
  return {
    ["--ui-shear-fill" as string]: isMuted
      ? "linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))"
      : `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
    ["--ui-shear-border" as string]: isMuted ? "var(--bd-2)" : color,
    ["--ui-shear-text" as string]: textOnSolidFill(color),
    ["--ui-shear-text-shadow" as string]: isMuted ? undefined : textShadowOnSolidFill(),
    ["--ui-shear-blur" as string]: "none",
    ["--ui-shear-shadow" as string]: isMuted
      ? "var(--sh-sm)"
      : `0 6px 18px ${color}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
    borderRadius: "var(--r-sm)",
    padding: "9px 16px",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.08em",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all var(--ease-mid)",
    fontFamily: "inherit",
  };
}

function smallBtn(color: string): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${color}33, ${color}11)`,
    border: `1px solid ${color}88`,
    borderRadius: "var(--r-pill)",
    padding: "4px 12px",
    color: textOnTintedAccent(color),
    fontSize: 11, fontWeight: 800, letterSpacing: "0.04em",
    cursor: "pointer", whiteSpace: "nowrap",
    transition: "all var(--ease-mid)",
    fontFamily: "inherit",
    textShadow: "0 1px 2px rgba(0,0,0,0.72)",
  };
}

function typeChoiceStyle(active: boolean, color: string): React.CSSProperties {
  return {
    flex: 1,
    background: active
      ? `linear-gradient(160deg, ${color}33, rgba(8,4,24,0.85))`
      : "linear-gradient(160deg, rgba(255,255,255,0.04), rgba(8,4,24,0.65))",
    border: `1px solid ${active ? color : "var(--bd-1)"}`,
    borderRadius: "var(--r-md)",
    padding: "12px 10px",
    boxShadow: active
      ? `0 0 18px ${color}88, var(--sh-sm), inset 0 1px 0 rgba(255,255,255,0.06)`
      : "var(--sh-sm)",
    transition: "all var(--ease-mid)",
    cursor: "pointer",
    color: active ? "#ffffff" : "var(--t-1)",
    fontSize: 12.5, fontWeight: 800, letterSpacing: "0.04em",
    textShadow: active ? "0 1px 2px rgba(0,0,0,0.65)" : undefined,
    fontFamily: "inherit",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%", boxSizing: "border-box",
    background: "rgba(0,0,0,0.45)",
    border: "1px solid var(--bd-2)",
    borderRadius: "var(--r-sm)",
    padding: "10px 14px",
    color: "var(--t-1)", fontSize: 13, fontWeight: 600,
    fontFamily: "inherit",
    outline: "none",
    transition: "border-color var(--ease-mid), box-shadow var(--ease-mid)",
  };
}

function Field({ label, children, compact = false }: { label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div style={{ marginTop: compact ? 8 : 10 }}>
      <label style={{
        display: "block", fontSize: 10, color: "rgba(255,255,255,0.55)",
        fontWeight: 700, letterSpacing: 1.5, marginBottom: compact ? 4 : 6,
      }}>{label}</label>
      {children}
    </div>
  );
}

function ClubNotifyBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <span
      className="no-ui-shear"
      style={{
        position: "absolute",
        top: -6,
        right: -6,
        minWidth: 20,
        height: 20,
        padding: "0 6px",
        borderRadius: 10,
        background: "linear-gradient(135deg, #FF1744, #D50000)",
        border: "2px solid #160048",
        color: "white",
        fontSize: 11,
        fontWeight: 900,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 12px rgba(255,23,68,0.85), 0 0 22px rgba(255,23,68,0.35)",
        animation: "pulse 1.4s ease-in-out infinite",
        pointerEvents: "none",
        zIndex: 12,
        lineHeight: 1,
      }}
    >
      {display}
    </span>
  );
}
