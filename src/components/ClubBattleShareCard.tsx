import { getModeIconUrl } from "../utils/modeAssets";

import { useI18n, modeName } from "../i18n";

import { TrophyIcon } from "./GameIcons";

import type { ClubBattleSharePayload } from "../utils/clubs";

import BattleHistoryTeamRoster from "./BattleHistoryTeamRoster";
import { Tr } from "../i18n/Tr";



const TEAM_MODES = new Set(["gemgrab", "heist", "crystals", "siege", "starstrike", "bounty", "bossraid"]);



interface Props {

  payload: ClubBattleSharePayload;

  sentAt?: number;

  localeTag: string;

  onWatch: () => void;

  compact?: boolean;

}



export default function ClubBattleShareCard({ payload, sentAt, localeTag, onWatch, compact }: Props) {

  const { t } = useI18n();

  const teams = payload.teams ?? [];

  const showScore = TEAM_MODES.has(payload.mode) && payload.scoreBlue != null && payload.scoreRed != null;

  const modeLabel = modeName(payload.mode, payload.mode);



  const formatTs = (ts: number) => {

    const d = new Date(ts);

    return d.toLocaleDateString(localeTag) + " " + d.toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });

  };



  return (

    <div style={{

      background: payload.won ? "rgba(105,240,174,0.07)" : "rgba(255,82,82,0.07)",

      border: `1px solid ${payload.won ? "rgba(105,240,174,0.25)" : "rgba(255,82,82,0.25)"}`,

      borderRadius: 14,

      padding: compact ? "12px 14px" : "14px 16px",

      position: "relative",

      width: "100%",

      maxWidth: compact ? "100%" : 960,

      minWidth: compact ? 280 : undefined,

    }}>

      <button

        type="button"

        onClick={onWatch}

        disabled={!payload.replayId}

        title={payload.replayId ? t("battleHistory.watch") : t("battleHistory.noReplay")}

        style={{

          position: "absolute", top: 10, right: 10,

          padding: compact ? "6px 12px" : "7px 14px", borderRadius: 8,

          border: payload.replayId ? "2px solid rgba(255,255,255,0.55)" : "none",

          cursor: payload.replayId ? "pointer" : "not-allowed",

          background: payload.replayId ? "linear-gradient(135deg, #FFE082, #FFB300)" : "rgba(255,255,255,0.1)",

          color: payload.replayId ? "#FFFFFF" : "rgba(255,255,255,0.35)",

          fontWeight: 900, fontSize: compact ? 11 : 12,

          opacity: payload.replayId ? 1 : 0.6,

          textShadow: payload.replayId ? "0 1px 3px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)" : undefined,

          boxShadow: payload.replayId ? "0 2px 12px rgba(255,179,0,0.45)" : undefined,

        }}

      >

        {"\u25B6"} <Tr id="battleHistory.watch" />

      </button>



      <div style={{

        display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10, paddingRight: compact ? 88 : 100,

      }}>

        <img

          src={getModeIconUrl(payload.mode)}

          alt=""

          style={{ width: compact ? 40 : 48, height: compact ? 40 : 48, objectFit: "contain", flexShrink: 0 }}

        />

        <div style={{ minWidth: 0 }}>

          <div style={{ fontSize: compact ? 14 : 15, fontWeight: 900, color: "white" }}>{modeLabel}</div>

          {sentAt != null && (

            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>

              {formatTs(sentAt)}

              {payload.durationSec ? ` \u00B7 ${Math.round(payload.durationSec)}s` : ""}

            </div>

          )}

          <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>

            <span style={{

              fontSize: 12, fontWeight: 900,

              color: payload.won ? "#69F0AE" : "#FF5252",

            }}>

              {payload.won ? t("drawer.battle.win") : t("drawer.battle.loss")}

            </span>

            {!TEAM_MODES.has(payload.mode) && (

              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>

                #{payload.place}/{payload.totalPlayers}

              </span>

            )}

            {showScore && (

              <span style={{ fontSize: 12, fontWeight: 800, color: "#FFD54F" }}>

                {payload.scoreBlue} : {payload.scoreRed}

              </span>

            )}

            <span style={{

              fontSize: 11,

              color: payload.trophyDelta >= 0 ? "#69F0AE" : "#FF5252",

              fontWeight: 700,

              display: "inline-flex",

              alignItems: "center",

              gap: 2,

            }}>

              <TrophyIcon size={10} lite /> {payload.trophyDelta >= 0 ? "+" : ""}{payload.trophyDelta}

            </span>

          </div>

        </div>

      </div>



      {teams.length > 0 ? (

        <BattleHistoryTeamRoster

          participants={teams}

          meta={{

            mode: payload.mode,

            showdownFormat: payload.showdownFormat,

            bossId: payload.bossId,

            bossLevel: payload.bossLevel,

          }}

          compact={compact}

          dense={compact}

          interactive={false}

        />

      ) : null}

    </div>

  );

}

