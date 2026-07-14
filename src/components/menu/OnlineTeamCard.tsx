import type { CSSProperties } from "react";
import { TrophyIcon } from "../GameIcons";
import { FriendAvatar } from "../FriendRowCard";
import ModeIconImg from "../ModeIconImg";
import { getModeInfo } from "../../data/modes";
import { useI18n } from "../../i18n";
import { Tr } from "../../i18n/Tr";
import { isOnlinePartyGroupJoinable, type OnlinePartyGroup } from "../../utils/social/party";

/** Высота одного ряда (3 игрока + кнопка) — как FriendRowCard. */
export const ONLINE_TEAM_ROW_HEIGHT = 90;
export const ONLINE_TEAM_PLAYERS_PER_ROW = 3;

interface Props {
  group: OnlinePartyGroup;
  inMyParty: boolean;
  inAnotherTeam?: boolean;
  onJoin: (code: string) => void;
  onCancelJoin: (code: string) => void;
  onMemberClick: (playerId: string) => void;
  style?: CSSProperties;
}

export default function OnlineTeamCard({
  group,
  inMyParty,
  inAnotherTeam = false,
  onJoin,
  onCancelJoin,
  onMemberClick,
  style,
}: Props) {
  const { t } = useI18n();
  const mode = getModeInfo(group.modeId);
  const rowCount = Math.max(1, Math.ceil(group.members.length / ONLINE_TEAM_PLAYERS_PER_ROW));
  const cardMinHeight = rowCount * ONLINE_TEAM_ROW_HEIGHT + (rowCount - 1) * 6 + 16;
  const showJoin = isOnlinePartyGroupJoinable(group, inMyParty, inAnotherTeam);
  const showJoinBlocked = inAnotherTeam && !inMyParty && !group.hasMyPendingRequest;
  const showPending = group.hasMyPendingRequest && !inMyParty;
  const showActionCol = showJoin || showPending || showJoinBlocked || inMyParty;

  const cells: (typeof group.members)[number][] = [...group.members];
  while (cells.length % ONLINE_TEAM_PLAYERS_PER_ROW !== 0) {
    cells.push(null as unknown as typeof group.members[number]);
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: cardMinHeight,
        boxSizing: "border-box",
        padding: 8,
        borderRadius: 12,
        border: group.isDemo
          ? "1px dashed rgba(206,147,216,0.55)"
          : "1px solid rgba(206,147,216,0.45)",
        background: "linear-gradient(135deg, rgba(30,15,60,0.55), rgba(10,5,30,0.65))",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        flexShrink: 0,
        position: "relative",
        ...style,
      }}
    >
      {group.isDemo && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(206,147,216,0.75)",
            pointerEvents: "none",
          }}
        >
          <Tr id="party.demoTeamBadge" />
        </div>
      )}
      {Array.from({ length: rowCount }, (_, rowIdx) => {
        const slice = cells.slice(
          rowIdx * ONLINE_TEAM_PLAYERS_PER_ROW,
          rowIdx * ONLINE_TEAM_PLAYERS_PER_ROW + ONLINE_TEAM_PLAYERS_PER_ROW,
        );
        const isLastRow = rowIdx === rowCount - 1;
        return (
          <div
            key={rowIdx}
            style={{
              display: "grid",
              gridTemplateColumns: isLastRow
                ? showActionCol
                  ? "1fr 1fr 1fr auto auto"
                  : "1fr 1fr 1fr auto"
                : "1fr 1fr 1fr",
              gap: 8,
              alignItems: "stretch",
              minHeight: ONLINE_TEAM_ROW_HEIGHT - 16,
              flexShrink: 0,
            }}
          >
            {slice.map((member, colIdx) => {
              if (!member) {
                return <div key={`empty-${rowIdx}-${colIdx}`} />;
              }
              return (
                <OnlineTeamMemberCell
                  key={member.playerId}
                  member={member}
                  onClick={() => onMemberClick(member.playerId)}
                />
              );
            })}
            {isLastRow && (
              <>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    padding: "4px 6px",
                    minWidth: 56,
                  }}
                >
                  <ModeIconImg
                    modeId={mode.id}
                    alt={mode.name}
                    size={48}
                    bare
                  />
                </div>
                {showJoin && (
                  <button
                    type="button"
                    className="ui-btn ui-btn--primary"
                    style={{
                      alignSelf: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "8px 12px",
                      minHeight: 0,
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => onJoin(group.code)}
                  >
                    <Tr id="party.joinTeam" />
                  </button>
                )}
                {showJoinBlocked && (
                  <button
                    type="button"
                    disabled
                    className="ui-btn ui-btn--primary"
                    style={{
                      alignSelf: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "8px 12px",
                      minHeight: 0,
                      whiteSpace: "nowrap",
                      opacity: 0.38,
                      cursor: "not-allowed",
                    }}
                  >
                    <Tr id="party.joinTeam" />
                  </button>
                )}
                {showPending && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      alignSelf: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: "#CE93D8",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Tr id="party.joinRequestPending" />
                    </div>
                    <button
                      type="button"
                      className="ui-btn ui-btn--secondary"
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "8px 12px",
                        minHeight: 0,
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => onCancelJoin(group.code)}
                    >
                      <Tr id="party.joinRequestCancel" />
                    </button>
                  </div>
                )}
                {inMyParty && !showPending && (
                  <div
                    style={{
                      alignSelf: "center",
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#69F0AE",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Tr id="party.inTeam" />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      {group.isFull && !inMyParty && !showPending && (
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>
          <Tr id="party.teamFull" />
        </div>
      )}
    </div>
  );
}

function OnlineTeamMemberCell({
  member,
  onClick,
}: {
  member: OnlinePartyGroup["members"][number];
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        padding: "6px 4px",
        borderRadius: 10,
        border: `1px solid ${member.online ? "rgba(105,240,174,0.45)" : "rgba(255,255,255,0.15)"}`,
        background: "linear-gradient(135deg, rgba(30,15,60,0.75), rgba(10,5,30,0.9))",
        cursor: "pointer",
        minWidth: 0,
        minHeight: 74,
        overflow: "hidden",
      }}
    >
      {member.isLeader && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 2,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 12,
            lineHeight: 1,
            filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))",
          }}
        >
          👑
        </span>
      )}
      <FriendAvatar
        profileIconId={member.profileIconId}
        brawlerId={member.brawlerId}
        username={member.username}
        online={member.online}
        size={40}
        square
      />
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          paddingTop: member.isLeader ? 4 : 0,
        }}
      >
        {member.username}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          color: "#FFD700",
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <TrophyIcon size={10} lite />
        {member.trophies}
      </div>
      {!member.online && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 10,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 900,
            color: "rgba(255,255,255,0.85)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            pointerEvents: "none",
          }}
        >
          {t("presence.screen.offline")}
        </div>
      )}
    </div>
  );
}
