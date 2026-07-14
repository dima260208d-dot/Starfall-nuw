import { useEffect, useState } from "react";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import FriendRowCard from "../components/FriendRowCard";
import FriendshipBondBar from "../components/social/FriendshipBondBar";
import FriendshipLevelUpModal from "../components/social/FriendshipLevelUpModal";
import FriendshipTitleModal from "../components/social/FriendshipTitleModal";
import FriendshipRewardsPage from "./FriendshipRewardsPage";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getFriendRows,
  getFriendRequestRows,
  getFriendsList,
  removeFriend,
  sendFriendRequestAsync,
  FRIENDS_CHANGED_EVENT,
} from "../utils/social/friends";
import { getPossibleFriendRows } from "../utils/social/possibleFriends";
import { syncFriendsFromServer } from "../utils/cloud/friendServerSync";
import {
  canCreateFriendshipTitle,
  FRIENDSHIP_CHANGED_EVENT,
  getFriendshipBond,
  getPendingFriendshipLevelUps,
  initFriendshipBondOnAdd,
  reconcileAllFriendships,
  prefillGiftRecipient,
  shiftPendingFriendshipLevelUp,
} from "../utils/social/friendship";
import { friendshipLevelFromXp } from "../data/friendshipLevels";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";
import { EmojiIcon } from "../components/EmojiIcon";

type FriendsTab = "possible" | "requests" | "friends";

interface Props {
  onBack: () => void;
  onViewProfile: (playerId: string) => void;
  onGiftShop?: () => void;
}

export default function FriendsPage({ onBack, onViewProfile, onGiftShop }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<FriendsTab>("friends");
  const [idInput, setIdInput] = useState("");
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const [actionId, setActionId] = useState<string | null>(null);
  const [levelUpNotice, setLevelUpNotice] = useState(
    () => getPendingFriendshipLevelUps()[0] ?? null,
  );
  const [titleFriendId, setTitleFriendId] = useState<string | null>(null);
  const [rewardsFriendId, setRewardsFriendId] = useState<string | null>(null);

  const refresh = () => setTick((n) => n + 1);
  const rows = getFriendRows();
  const requestRows = getFriendRequestRows();
  const possibleRows = getPossibleFriendRows();

  useEffect(() => {
    for (const f of getFriendsList()) initFriendshipBondOnAdd(f.playerId);
    reconcileAllFriendships();
    void syncFriendsFromServer();
    refresh();
  }, []);

  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(FRIENDS_CHANGED_EVENT, onChange);
    window.addEventListener(FRIENDSHIP_CHANGED_EVENT, onChange);
    const iv = setInterval(() => {
      void syncFriendsFromServer();
      refresh();
    }, 10_000);
    return () => {
      window.removeEventListener(FRIENDS_CHANGED_EVENT, onChange);
      window.removeEventListener(FRIENDSHIP_CHANGED_EVENT, onChange);
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    if (!levelUpNotice) {
      const next = shiftPendingFriendshipLevelUp();
      if (next) setLevelUpNotice(next);
    }
  }, [levelUpNotice, tick]);

  const handleSendRequest = (playerId: string) => {
    void sendFriendRequestAsync(playerId).then((r) => {
      setMsg(r.success ? t("friends.requestSent") : (r.error ?? t("common.error")));
      refresh();
      setTimeout(() => setMsg(""), 2400);
    });
  };

  const handleAddById = () => {
    void sendFriendRequestAsync(idInput).then((r) => {
      if (r.success) {
        setMsg(t("friends.requestSent"));
        setIdInput("");
        setTab("requests");
        refresh();
      } else {
        setMsg(r.error ?? t("common.error"));
      }
      setTimeout(() => setMsg(""), 2400);
    });
  };

  const closeLevelUp = () => {
    setLevelUpNotice(null);
    const next = shiftPendingFriendshipLevelUp();
    if (next) setTimeout(() => setLevelUpNotice(next), 300);
  };

  const incomingCount = requestRows.filter((r) => r.kind === "incoming").length;

  if (rewardsFriendId) {
    return (
      <FriendshipRewardsPage
        friendPlayerId={rewardsFriendId}
        onBack={() => {
          setRewardsFriendId(null);
          refresh();
        }}
      />
    );
  }

  const tabBtn = (id: FriendsTab, labelId: string, badge?: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      style={{
        flex: 1,
        padding: "10px 6px",
        borderRadius: 10,
        border: tab === id ? "1px solid rgba(206,147,216,0.7)" : "1px solid rgba(255,255,255,0.12)",
        background: tab === id ? "rgba(123,47,190,0.45)" : "rgba(0,0,0,0.35)",
        color: tab === id ? "#fff" : "rgba(255,255,255,0.65)",
        fontWeight: 900,
        fontSize: 11,
        letterSpacing: 0.5,
        position: "relative",
      }}
    >
      <Tr id={labelId} />
      {badge != null && badge > 0 && (
        <span style={{
          position: "absolute", top: 4, right: 6,
          minWidth: 16, height: 16, borderRadius: 999,
          background: "#FF5252", color: "#fff", fontSize: 9, fontWeight: 900,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 4px",
        }}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <PageBg variant="friends" style={{ fontFamily: "var(--app-font-sans)" }}>
      <PageHeader onBack={onBack} title={<> <EmojiIcon emoji="👥" size={20} /> <Tr id="friends.title" /></>} />
      <PageBody style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {tabBtn("possible", "friends.tab.possible")}
          {tabBtn("requests", "friends.tab.requests", incomingCount)}
          {tabBtn("friends", "friends.tab.friends")}
        </div>

        <div style={{
          background: "rgba(0,0,0,0.45)",
          border: "1px solid rgba(206,147,216,0.35)",
          borderRadius: 12,
          padding: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>
            <Tr id="friends.addById" />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="ui-input"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              placeholder={t("friends.idPlaceholder12")}
              style={{ flex: 1, fontSize: 13, fontFamily: "monospace" }}
            />
            <button type="button" className="ui-btn ui-btn--primary" onClick={handleAddById} style={{ minWidth: 88 }}>
              <Tr id="friends.sendRequestBtn" />
            </button>
          </div>
          {msg && (
            <div style={{ marginTop: 6, fontSize: 11, color: msg.includes(t("common.error")) ? "#FF7043" : "#69F0AE" }}>
              {msg}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {tab === "friends" && (
            <>
              <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.75)" }}>
                <Tr id="friends.listCount" params={{ count: String(rows.length) }} />
              </div>
              {rows.length === 0 && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, padding: 24 }}>
                  <Tr id="friends.empty" />
                </div>
              )}
              {rows.map((row) => (
                <FriendRowCard
                  key={row.entry.playerId}
                  username={row.entry.username}
                  statusText={row.statusText}
                  trophies={row.trophies}
                  online={row.online}
                  profileIconId={row.profileIconId}
                  brawlerId={row.brawlerId}
                  belowName={<FriendshipBondBar friendPlayerId={row.entry.playerId} />}
                  onClick={() => setActionId(row.entry.playerId)}
                />
              ))}
            </>
          )}

          {tab === "requests" && (
            <>
              {requestRows.length === 0 && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, padding: 24 }}>
                  <Tr id="friends.requestsEmpty" />
                </div>
              )}
              {requestRows.map((row) => (
                <div
                  key={`${row.kind}-${row.playerId}`}
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(206,147,216,0.3)",
                    borderRadius: 12,
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: "#fff" }}>{row.username}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>{row.playerId}</div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: row.kind === "incoming" ? "#FFD740" : "rgba(255,255,255,0.45)" }}>
                      {row.kind === "incoming" ? t("friends.incomingRequest") : t("friends.outgoingPending")}
                    </div>
                  </div>
                  {row.kind === "incoming" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        style={{ flex: 1, fontSize: 12 }}
                        onClick={() => void acceptFriendRequest(row.playerId).then((r) => {
                          setMsg(r.success ? t("friends.accepted") : (r.error ?? t("common.error")));
                          refresh();
                          setTimeout(() => setMsg(""), 2400);
                        })}
                      >
                        <Tr id="friends.acceptBtn" />
                      </button>
                      <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        style={{ flex: 1, fontSize: 12 }}
                        onClick={() => void declineFriendRequest(row.playerId).then(() => refresh())}
                      >
                        <Tr id="friends.declineBtn" />
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                      <Tr id="friends.waitingResponse" />
                    </div>
                  )}
                </div>
              ))}
            </>
          )}

          {tab === "possible" && (
            <>
              {possibleRows.length === 0 && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 13, padding: 24 }}>
                  <Tr id="friends.possibleEmpty" />
                </div>
              )}
              {possibleRows.map((row) => (
                <div
                  key={row.playerId}
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(120,160,255,0.35)",
                    borderRadius: 12,
                    padding: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 14, color: "#fff" }}>{row.username}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                      <Tr id="friends.consecutiveGames" params={{ count: String(row.consecutiveGames) }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ui-btn ui-btn--primary"
                    style={{ fontSize: 11, minWidth: 100 }}
                    onClick={() => handleSendRequest(row.playerId)}
                  >
                    <Tr id="friends.sendRequestBtn" />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </PageBody>

      {actionId && (
        <FriendActionModal
          playerId={actionId}
          onClose={() => setActionId(null)}
          onRemove={() => {
            removeFriend(actionId);
            setActionId(null);
            refresh();
          }}
          onProfile={() => {
            setActionId(null);
            onViewProfile(actionId);
          }}
          onGift={() => {
            prefillGiftRecipient(actionId);
            setActionId(null);
            onGiftShop?.();
          }}
          onCreateTitle={() => {
            setActionId(null);
            setTitleFriendId(actionId);
          }}
          onLevelRewards={() => {
            setActionId(null);
            setRewardsFriendId(actionId);
          }}
        />
      )}

      {levelUpNotice && (
        <FriendshipLevelUpModal notice={levelUpNotice} onClose={closeLevelUp} />
      )}

      {titleFriendId && (
        <FriendshipTitleModal
          friendPlayerId={titleFriendId}
          friendUsername={rows.find((r) => r.entry.playerId === titleFriendId)?.entry.username ?? ""}
          onClose={() => setTitleFriendId(null)}
          onDone={() => { setTitleFriendId(null); refresh(); }}
        />
      )}
    </PageBg>
  );
}

function FriendActionModal({
  playerId,
  onClose,
  onRemove,
  onProfile,
  onGift,
  onCreateTitle,
  onLevelRewards,
}: {
  playerId: string;
  onClose: () => void;
  onRemove: () => void;
  onProfile: () => void;
  onGift: () => void;
  onCreateTitle: () => void;
  onLevelRewards: () => void;
}) {
  const { t } = useI18n();
  const bond = getFriendshipBond(playerId);
  const level = friendshipLevelFromXp(bond.xp);
  const showTitleBtn = canCreateFriendshipTitle(playerId);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, rgba(25,12,55,0.96), rgba(8,4,24,0.98))",
          border: "1px solid rgba(206,147,216,0.5)",
          borderRadius: 14,
          padding: 16,
          minWidth: 260,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 900, color: "#FFD740", textAlign: "center", marginBottom: 4 }}>
          <Tr id="friendship.levelShort" params={{ level: String(level) }} />
        </div>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onProfile}>
          <Tr id="friends.viewProfile" />
        </button>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onGift}>
          <EmojiIcon emoji="🎁" size={18} /> <Tr id="friendship.giftBtn" />
        </button>
        <button type="button" className="ui-btn ui-btn--primary" onClick={onLevelRewards}>
          <EmojiIcon emoji="🏆" size={18} /> <Tr id="friendship.rewardsBtn" />
        </button>
        {showTitleBtn && (
          <button type="button" className="ui-btn ui-btn--primary" onClick={onCreateTitle} style={{ borderColor: "#FFD740" }}>
            <EmojiIcon emoji="✨" size={18} /> <Tr id="friendship.createTitleBtn" />
          </button>
        )}
        <button type="button" className="ui-btn ui-btn--danger" onClick={onRemove}>
          <Tr id="friends.remove" />
        </button>
        <button type="button" className="ui-btn ui-btn--secondary" onClick={onClose}>
          <Tr id="common.cancel" />
        </button>
      </div>
    </div>
  );
}
