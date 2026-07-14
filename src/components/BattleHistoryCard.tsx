import { useI18n, modeName } from "../i18n";
import { getModeIconUrl } from "../utils/modeAssets";
import { TrophyIcon } from "./GameIcons";
import BattleHistoryTeamRoster from "./BattleHistoryTeamRoster";
import type { BattleRecord, BattleHistoryParticipant } from "../utils/localStorageAPI";
import { Tr } from "../i18n/Tr";

const TEAM_MODES = new Set(["gemgrab", "heist", "crystals", "siege", "starstrike", "bounty", "bossraid"]);

function formatTs(ts: number, locale: string) {
  const d = new Date(ts);
  return d.toLocaleDateString(locale) + " " + d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export default function BattleHistoryCard({
  record,
  localeTag,
  onWatch,
  onShare,
  onAvatarClick,
  canShare = false,
  shared = false,
  hideWatch = false,
}: {
  record: BattleRecord;
  localeTag: string;
  onWatch?: () => void;
  onShare?: () => void;
  onAvatarClick?: (e: React.MouseEvent, p: BattleHistoryParticipant) => void;
  canShare?: boolean;
  shared?: boolean;
  hideWatch?: boolean;
}) {
  const { t } = useI18n();
  const teams = record.teams ?? [];
  const showScore = TEAM_MODES.has(record.mode) && record.scoreBlue != null && record.scoreRed != null;
  const modeLabel = modeName(record.mode, record.mode);
  const shareReady = !!record.replayId;
  const showActions = !hideWatch || canShare;

  return (
    <div style={{
      background: record.won ? "rgba(105,240,174,0.07)" : "rgba(255,82,82,0.07)",
      border: `1px solid ${record.won ? "rgba(105,240,174,0.25)" : "rgba(255,82,82,0.25)"}`,
      borderRadius: 14,
      padding: "14px 16px",
      position: "relative",
    }}>
      {showActions && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch",
        }}>
          {!hideWatch && onWatch && (
            <button
              type="button"
              onClick={onWatch}
              disabled={!record.replayId}
              title={record.replayId ? t("battleHistory.watch") : t("battleHistory.noReplay")}
              style={{
                padding: "7px 14px", borderRadius: 8,
                border: record.replayId ? "2px solid rgba(255,255,255,0.55)" : "none",
                cursor: record.replayId ? "pointer" : "not-allowed",
                background: record.replayId ? "linear-gradient(135deg, #FFE082, #FFB300)" : "rgba(255,255,255,0.1)",
                color: record.replayId ? "#FFFFFF" : "rgba(255,255,255,0.35)",
                fontWeight: 900, fontSize: 12,
                opacity: record.replayId ? 1 : 0.6,
                textShadow: record.replayId ? "0 1px 3px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)" : undefined,
                boxShadow: record.replayId ? "0 2px 12px rgba(255,179,0,0.45)" : undefined,
              }}
            >
              {"\u25B6"} <Tr id="battleHistory.watch" />
            </button>
          )}
          {canShare && onShare && (
            <button
              type="button"
              onClick={onShare}
              disabled={!shareReady || shared}
              title={
                shared ? t("result.shareDone")
                  : !shareReady ? t("battleHistory.noReplay")
                  : t("result.shareBattle")
              }
              style={{
                padding: "7px 12px", borderRadius: 8,
                border: "1px solid rgba(64,196,255,0.45)",
                cursor: shareReady && !shared ? "pointer" : "not-allowed",
                background: shared ? "rgba(105,240,174,0.15)" : "rgba(25,118,210,0.35)",
                color: shared ? "#69F0AE" : "white",
                fontWeight: 800, fontSize: 11,
                opacity: shareReady || shared ? 1 : 0.55,
              }}
            >
              {shared ? t("result.shareDone") : t("result.shareBattle")}
            </button>
          )}
        </div>
      )}

      <div style={{
        display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10,
        paddingRight: showActions ? (canShare ? 118 : 100) : 0,
      }}>
        <img
          src={getModeIconUrl(record.mode)}
          alt=""
          style={{ width: 48, height: 48, objectFit: "contain", flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "white" }}>{modeLabel}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
            {formatTs(record.ts, localeTag)}
            {record.durationSec ? ` \u00B7 ${Math.round(record.durationSec)}s` : ""}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{
              fontSize: 12, fontWeight: 900,
              color: record.won ? "#69F0AE" : "#FF5252",
            }}>
              {record.won ? t("drawer.battle.win") : t("drawer.battle.loss")}
            </span>
            {!TEAM_MODES.has(record.mode) && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                #{record.place}/{record.totalPlayers}
              </span>
            )}
            {showScore && (
              <span style={{ fontSize: 12, fontWeight: 800, color: "#FFD54F" }}>
                {record.scoreBlue} : {record.scoreRed}
              </span>
            )}
            <span style={{ fontSize: 11, color: record.trophyDelta >= 0 ? "#69F0AE" : "#FF5252", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}>
              <TrophyIcon size={10} lite /> {record.trophyDelta >= 0 ? "+" : ""}{record.trophyDelta}
            </span>
          </div>
        </div>
      </div>

      {teams.length > 0 && onAvatarClick ? (
        <BattleHistoryTeamRoster
          participants={teams}
          meta={{
            mode: record.mode,
            showdownFormat: record.showdownFormat,
            bossId: record.bossId,
            bossLevel: record.bossLevel,
          }}
          onAvatarClick={onAvatarClick}
        />
      ) : teams.length > 0 ? (
        <BattleHistoryTeamRoster
          participants={teams}
          meta={{
            mode: record.mode,
            showdownFormat: record.showdownFormat,
            bossId: record.bossId,
            bossLevel: record.bossLevel,
          }}
          onAvatarClick={() => {}}
        />
      ) : null}
    </div>
  );
}
