import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import FriendRowCard from "../FriendRowCard";
import OnlineTeamCard from "./OnlineTeamCard";
import { getModeIconUrl } from "../../utils/modeAssets";
import { EmojiIcon } from "../EmojiIcon";
import { Tr } from "../../i18n/Tr";
import {
  getMyPartyCode,
  cancelMyPartyJoinRequest,
  cancelOutgoingInviteForTarget,
  getMyPartyRoom,
  getOnlinePartyGroupsForPanel,
  getOutgoingInviteTo,
  inviteFriendToParty,
  isInAnyParty,
  isPartyRoomAtCapacity,
  joinPartyByCode,
  isFriendInMyParty,
  PARTY_CHANGED_EVENT,
  PARTY_JOIN_REQUEST_EVENT,
  requestJoinParty,
  type PartySlot,
} from "../../utils/social/party";
import { PRESENCE_CHANGED_EVENT } from "../../utils/social/presence";

/** Ширина доп. меню (HamburgerDrawer, panel «menu»). */
export const AUX_MENU_WIDTH = 280;
/** Панель «В сети» — широкая, карточки команд ~675px. */
export const ONLINE_PANEL_WIDTH = 700;
export const PARTY_CHAT_PANEL_WIDTH = 350;

export type PartyPanelSide = "left" | "right";

/** Панели «В сети» и чат команды всегда справа. */
function panelSideForSlot(_slot: PartySlot): PartyPanelSide {
  return "right";
}

interface Props {
  inviteSlot: PartySlot;
  onClose: () => void;
  onViewProfile: (playerId: string) => void;
  onSpectate?: (playerId: string) => void;
}

const iconBtnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "5px 10px",
  color: "rgba(255,255,255,0.7)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
  fontFamily: "inherit",
};

/** Прозрачность как у всплывашки Астрала, те же фиолетовые оттенки. */
const PANEL_BG =
  "linear-gradient(180deg, rgba(36,18,72,0.72) 0%, rgba(12,6,32,0.78) 52%, rgba(24,12,52,0.70) 100%)";

export default function PartySidePanel({ inviteSlot, onClose, onViewProfile, onSpectate }: Props) {
  const { t } = useI18n();
  const side = panelSideForSlot(inviteSlot);
  const [codeInput, setCodeInput] = useState("");
  const [msg, setMsg] = useState("");
  const [actionPlayer, setActionPlayer] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const { groups, soloFriends } = useMemo(() => getOnlinePartyGroupsForPanel(), [tick]);
  const displayGroups = groups;
  const myPartyCode = getMyPartyCode()?.toUpperCase() ?? null;
  const myRoom = getMyPartyRoom();
  const teamFull = myRoom ? isPartyRoomAtCapacity(myRoom) : false;
  const inAnotherTeam = isInAnyParty();
  const onlineCount = displayGroups.reduce((s, g) => s + g.members.length, 0) + soloFriends.length;

  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener(PARTY_CHANGED_EVENT, bump);
    window.addEventListener(PARTY_JOIN_REQUEST_EVENT, bump);
    window.addEventListener(PRESENCE_CHANGED_EVENT, bump);
    return () => {
      window.removeEventListener(PARTY_CHANGED_EVENT, bump);
      window.removeEventListener(PARTY_JOIN_REQUEST_EVENT, bump);
      window.removeEventListener(PRESENCE_CHANGED_EVENT, bump);
    };
  }, []);

  const handleInvite = (playerId: string) => {
    const r = inviteFriendToParty(playerId, inviteSlot);
    setMsg(r.success ? t("party.inviteSent") : (r.error ?? t("common.error")));
    setTick(t => t + 1);
    setTimeout(() => setMsg(""), 2200);
  };

  const handleJoinCode = () => {
    void requestJoinParty(codeInput).then((r) => {
      setMsg(r.success ? t("party.joinRequestSent") : (r.error ?? t("common.error")));
      setTick(t => t + 1);
      setTimeout(() => setMsg(""), 2400);
    });
  };

  const handleJoinTeam = (code: string) => {
    void requestJoinParty(code).then((r) => {
      setMsg(r.success ? t("party.joinRequestSent") : (r.error ?? t("common.error")));
      setTick(t => t + 1);
      setTimeout(() => setMsg(""), 2400);
    });
  };

  const handleCancelJoinTeam = (code: string) => {
    const r = cancelMyPartyJoinRequest(code);
    setMsg(r.success ? t("party.joinRequestCanceled") : (r.error ?? t("common.error")));
    setTick(t => t + 1);
    setTimeout(() => setMsg(""), 2200);
  };

  const selected = actionPlayer
    ? soloFriends.find(f => f.playerId === actionPlayer)
      ?? displayGroups.flatMap(g => g.members).find(m => m.playerId === actionPlayer)
    : null;

  const slideAnim = side === "right" ? "partySlideInRight 0.22s ease-out" : "partySlideInLeft 0.22s ease-out";

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          background: "rgba(2,0,18,0.12)",
        }}
      />

      <div
        style={{
          position: "fixed",
          top: 0,
          bottom: 0,
          ...(side === "right" ? { right: 0 } : { left: 0 }),
          width: ONLINE_PANEL_WIDTH,
          maxWidth: "96vw",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: slideAnim,
          background: PANEL_BG,
          ...(side === "right"
            ? {
                borderLeft: "1px solid rgba(206,147,216,0.42)",
                boxShadow: "-20px 0 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
              }
            : {
                borderRight: "1px solid rgba(206,147,216,0.42)",
                boxShadow: "20px 0 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
              }),
          backdropFilter: "blur(14px) saturate(1.2)",
          WebkitBackdropFilter: "blur(14px) saturate(1.2)",
        }}
      >
        <style>{`
          @keyframes partySlideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes partySlideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        `}</style>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#CE93D8", letterSpacing: "0.02em" }}>
              <Tr id="party.online" params={{ count: onlineCount }} />
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.42)", marginTop: 4, fontWeight: 600 }}>
              <Tr id="party.inviteHint" />
            </div>
          </div>
          <button type="button" onClick={onClose} style={iconBtnStyle} aria-label={t("common.close")}>
            <EmojiIcon emoji="✕" size={20} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            alignContent: "flex-start",
            gap: 12,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {onlineCount === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                color: "rgba(255,255,255,0.42)",
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 12 }}><EmojiIcon emoji="👥" size={24} /></div>
              <div style={{ fontSize: 15, fontWeight: 700 }}><Tr id="party.noFriendsOnline" /></div>
            </div>
          )}

          {displayGroups.map(group => (
            <div key={group.code} style={{ flexShrink: 0, width: "100%" }}>
              <OnlineTeamCard
                group={group}
                inMyParty={myPartyCode === group.code}
                inAnotherTeam={inAnotherTeam && myPartyCode !== group.code}
                onJoin={code => {
                  if (group.isDemo) {
                    setMsg(t("party.demoTeamHint"));
                    setTimeout(() => setMsg(""), 2400);
                    return;
                  }
                  handleJoinTeam(code);
                }}
                onCancelJoin={code => {
                  if (group.isDemo) {
                    setMsg(t("party.demoTeamHint"));
                    setTimeout(() => setMsg(""), 2400);
                    return;
                  }
                  handleCancelJoinTeam(code);
                }}
                onMemberClick={setActionPlayer}
              />
            </div>
          ))}

          {soloFriends.map(f => (
            <FriendRowCard
              key={f.playerId}
              style={{ flexShrink: 0, minHeight: 90, boxSizing: "border-box" }}
              username={f.username}
              statusText={f.screen === "battle" ? t("presence.screen.battle") : f.statusText}
              trophies={f.trophies}
              online={f.online}
              profileIconId={f.profileIconId}
              brawlerId={f.brawlerId}
              squareAvatar
              modeIconUrl={f.battleMode ? getModeIconUrl(f.battleMode) : null}
              modeIconBesideAvatar={Boolean(f.battleMode && f.screen === "battle")}
              onClick={() => setActionPlayer(f.playerId)}
              trailing={
                f.inMyParty ? (
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#CE93D8",
                      padding: "6px 10px",
                      whiteSpace: "nowrap",
                      background: "rgba(206,147,216,0.12)",
                      borderRadius: 8,
                      border: "1px solid rgba(206,147,216,0.28)",
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <Tr id="party.inTeam" />
                  </span>
                ) : (() => {
                  const pendingInvite = getOutgoingInviteTo(f.playerId);
                  return (
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {f.screen === "battle" && f.online && onSpectate && (
                      <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        title={t("party.spectateBattle")}
                        style={{
                          fontSize: 12,
                          padding: "8px 12px",
                          minHeight: 0,
                          fontWeight: 800,
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          onSpectate(f.playerId);
                          onClose();
                        }}
                      >
                        <EmojiIcon emoji="👁" size={18} /> <Tr id="party.spectateShort" />
                      </button>
                    )}
                    {pendingInvite ? (
                      <button
                        type="button"
                        className="ui-btn ui-btn--secondary"
                        style={{
                          fontSize: 12,
                          padding: "8px 14px",
                          minHeight: 0,
                          fontWeight: 800,
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          cancelOutgoingInviteForTarget(f.playerId);
                          setTick(t => t + 1);
                        }}
                      >
                        <Tr id="party.inviteCancel" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ui-btn ui-btn--primary"
                        disabled={teamFull}
                        style={{
                          fontSize: 12,
                          padding: "8px 14px",
                          minHeight: 0,
                          fontWeight: 800,
                          opacity: teamFull ? 0.38 : 1,
                          cursor: teamFull ? "not-allowed" : "pointer",
                        }}
                        onClick={e => {
                          e.stopPropagation();
                          if (teamFull) return;
                          handleInvite(f.playerId);
                        }}
                      >
                        <Tr id="party.invite" />
                      </button>
                    )}
                  </div>
                  );
                })()
              }
            />
          ))}
        </div>

        <div
          style={{
            padding: "16px 20px 20px",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(0,0,0,0.12)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>
            <Tr id="party.teamCode" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              className="ui-input"
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              style={{
                flex: 1,
                fontSize: 14,
                fontFamily: "monospace",
                minHeight: 0,
                padding: "10px 14px",
                letterSpacing: "0.12em",
              }}
            />
            <button
              type="button"
              className="ui-btn ui-btn--secondary"
              onClick={handleJoinCode}
              style={{ fontSize: 13, padding: "10px 18px", minHeight: 0, fontWeight: 800 }}
            >
              <Tr id="party.join" />
            </button>
          </div>
          {msg && (
            <div style={{ fontSize: 12, marginTop: 10, color: "#69F0AE", fontWeight: 700 }}>
              {msg}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 55,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.45)",
          }}
          onClick={() => setActionPlayer(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "rgba(15,8,42,0.96)",
              border: "1px solid rgba(206,147,216,0.4)",
              borderRadius: 14,
              padding: 16,
              minWidth: 280,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 4, textAlign: "center" }}>
              {selected.username}
            </div>
            <button
              type="button"
              className="ui-btn ui-btn--primary"
              onClick={() => { onViewProfile(selected.playerId); setActionPlayer(null); onClose(); }}
            >
              <Tr id="party.profile" />
            </button>
            {"screen" in selected && selected.screen === "battle" && selected.online && onSpectate && (
              <button
                type="button"
                className="ui-btn ui-btn--secondary"
                onClick={() => { onSpectate(selected.playerId); setActionPlayer(null); }}
              >
                <Tr id="party.spectateBattle" />
              </button>
            )}
            {!isFriendInMyParty(selected.playerId) && myPartyCode !== (selected as { partyCode?: string }).partyCode?.toUpperCase() && (
              <button
                type="button"
                className="ui-btn ui-btn--primary"
                onClick={() => { handleInvite(selected.playerId); setActionPlayer(null); }}
              >
                <Tr id="party.invite" />
              </button>
            )}
            <button type="button" className="ui-btn ui-btn--secondary" onClick={() => setActionPlayer(null)}>
              <Tr id="common.close" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
