import type { CSSProperties, MouseEvent } from "react";
import BrawlerRankBar, { PowerLevelCircle } from "./BrawlerRankBar";
import { brawlerAvatarUrl } from "../utils/modeAssets";
import { MENU_RANK_BADGE_SCALE } from "../utils/brawlerRankUI";
import { useI18n, brawlerName } from "../i18n";
import { BRAWLERS } from "../entities/BrawlerData";
import type { BattleHistoryParticipant } from "../utils/localStorageAPI";
import { EmojiIcon } from "./EmojiIcon";

const TEAM_MODES = new Set(["gemgrab", "heist", "crystals", "siege", "starstrike", "bounty"]);

/** Trio showdown: scale trophy bar + power; rank shield stays normal badgeScale. */
const TRIO_TRACK_SCALE = 0.72;
const TRIO_POWER_SIZE = 22;
/** Club battle share card — tight chat column, no overlapping stats. */
const CLUB_SHARE_BADGE_SCALE = MENU_RANK_BADGE_SCALE * 0.52;
const CLUB_SHARE_TRACK_SCALE = 0.62;
const CLUB_SHARE_POWER_SIZE = 18;

export interface BattleHistoryRosterMeta {
  mode: string;
  showdownFormat?: "solo" | "duo" | "trio";
  bossId?: string;
  bossLevel?: number;
}

interface PlayerSlotProps {
  p: BattleHistoryParticipant;
  size: number;
  badgeScale: number;
  onAvatarClick?: (e: MouseEvent, p: BattleHistoryParticipant) => void;
  interactive?: boolean;
  dense?: boolean;
  /** Triple showdown: larger avatars, slightly scaled-down rank row */
  trio?: boolean;
}

function starBadgeStyle(compact: boolean, trio = false, dense = false): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: dense ? 2 : 3,
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,215,0,0.45)",
    borderRadius: dense ? 5 : 7,
    padding: dense ? "1px 4px" : trio ? "2px 5px" : compact ? "2px 6px" : "3px 7px",
    color: "#FFE082",
    fontSize: dense ? 8 : trio ? 9 : compact ? 10 : 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  };
}

function BattleHistoryPlayerSlot({
  p,
  size,
  badgeScale,
  onAvatarClick,
  interactive = true,
  dense = false,
  trio = false,
}: PlayerSlotProps) {
  const border = p.team === "blue" ? "#4285F4" : "#E53935";
  const borderW = trio ? 2 : (dense ? 2 : 3);
  const avatar = (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 0,
        border: `${borderW}px solid ${border}`,
        background: "rgba(0,0,0,0.4)",
        overflow: "hidden",
        boxShadow: p.isPlayer ? `0 0 ${(trio || dense) ? 8 : 14}px ${border}` : "0 4px 14px rgba(0,0,0,0.45)",
      }}
    >
      <img
        src={brawlerAvatarUrl(p.brawlerId)}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 0 }}
      />
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: trio ? 3 : (dense ? 2 : 6),
        minWidth: dense ? 0 : trio ? 82 : (size + 8),
        maxWidth: dense ? "100%" : trio ? 94 : (size + 48),
        flex: dense ? "1 1 0" : trio ? "0 0 auto" : undefined,
        width: dense ? "100%" : undefined,
      }}
    >
      {interactive && onAvatarClick ? (
        <button
          type="button"
          onClick={e => onAvatarClick(e, p)}
          style={{ padding: 0, border: "none", background: "none", cursor: "pointer" }}
        >
          {avatar}
        </button>
      ) : avatar}
      <div
        style={{
          fontSize: dense ? 8 : trio ? 9 : (size >= 72 ? 11 : 10),
          fontWeight: 700,
          color: "white",
          textAlign: "center",
          maxWidth: dense ? "100%" : trio ? size + 20 : (size + 40),
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {p.displayName}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: dense ? 3 : trio ? 3 : 4,
          width: dense ? "100%" : undefined,
        }}
      >
        {dense ? (
          <>
            <BrawlerRankBar
              brawlerId={p.brawlerId}
              trophies={p.trophies}
              layout="compact"
              badgeScale={badgeScale}
              trackScale={CLUB_SHARE_TRACK_SCALE}
              clickable={false}
              showUnclaimedBadge={false}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexWrap: "nowrap" }}>
              <PowerLevelCircle level={p.level} size={CLUB_SHARE_POWER_SIZE} />
              <span style={{ ...starBadgeStyle(false, false, true), display: "inline-flex", alignItems: "center", gap: 3 }}><EmojiIcon emoji="★" size={15} /> {p.starCount}/6</span>
            </div>
          </>
        ) : (
          <>
            <BrawlerRankBar
              brawlerId={p.brawlerId}
              trophies={p.trophies}
              layout="compact"
              badgeScale={badgeScale}
              trackScale={trio ? TRIO_TRACK_SCALE : 1}
              powerLevel={p.level}
              powerLevelSize={trio ? TRIO_POWER_SIZE : undefined}
              clickable={false}
              showUnclaimedBadge={false}
            />
            <span style={{ ...starBadgeStyle(size < 64, trio), display: "inline-flex", alignItems: "center", gap: 3 }}><EmojiIcon emoji="★" size={15} /> {p.starCount}/6</span>
          </>
        )}
      </div>
    </div>
  );
}

function BossSlot({ bossId, level, compact }: { bossId: string; level: number; compact?: boolean }) {
  const { t } = useI18n();
  const size = compact ? 96 : 128;
  const name = brawlerName(bossId, BRAWLERS.find(b => b.id === bossId)?.name ?? bossId);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        flex: 1,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 0,
          border: "4px solid #E53935",
          background: "radial-gradient(circle at 50% 35%, rgba(255,82,82,0.35), rgba(0,0,0,0.65))",
          overflow: "hidden",
          boxShadow: "0 0 28px rgba(229,57,53,0.55), 0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        <img
          src={brawlerAvatarUrl(bossId)}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 0 }}
        />
      </div>
      <div style={{ fontSize: compact ? 13 : 15, fontWeight: 900, color: "#FF8A80", textAlign: "center" }}>
        {name}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PowerLevelCircle level={level} size={compact ? 40 : 48} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 700 }}>
          {t("battle.boss")}
        </span>
      </div>
    </div>
  );
}

function groupByRawTeam(participants: BattleHistoryParticipant[]): BattleHistoryParticipant[][] {
  const groups = new Map<string, BattleHistoryParticipant[]>();
  const order: string[] = [];
  for (const p of participants) {
    const key = p.rawTeam ?? `${p.team}-${p.brawlerId}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(p);
  }
  return order.map(k => groups.get(k)!);
}

function inferShowdownTeamSize(participants: BattleHistoryParticipant[]): number {
  const counts = new Map<string, number>();
  for (const p of participants) {
    const k = p.rawTeam ?? `${p.team}-${p.brawlerId}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());
  if (max >= 3) return 3;
  if (max >= 2) return 2;
  return 1;
}

function TeamSideColumn({
  label,
  color,
  players,
  avatarSize,
  badgeScale,
  onAvatarClick,
  interactive,
  playerLayout = "column",
  dense = false,
}: {
  label: string;
  color: string;
  players: BattleHistoryParticipant[];
  avatarSize: number;
  badgeScale: number;
  onAvatarClick?: (e: MouseEvent, p: BattleHistoryParticipant) => void;
  interactive?: boolean;
  playerLayout?: "row" | "column";
  dense?: boolean;
}) {
  const isRow = playerLayout === "row";
  const isBlue = color === "#4285F4";
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: isRow ? (isBlue ? "flex-end" : "flex-start") : "center",
        minWidth: 0,
        padding: "0 6px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          color,
          marginBottom: 10,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          alignSelf: isRow ? "stretch" : undefined,
          textAlign: isRow ? (isBlue ? "right" : "left") : "center",
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: isRow ? "row" : "column",
          flexWrap: isRow ? "nowrap" : "nowrap",
          alignItems: "flex-start",
          justifyContent: isRow ? (isBlue ? "flex-end" : "flex-start") : "center",
          gap: isRow ? (dense ? 4 : 10) : 14,
          width: "100%",
        }}
      >
        {players.map((p, i) => (
          <BattleHistoryPlayerSlot
            key={`${p.brawlerId}-${p.displayName}-${i}`}
            p={p}
            size={avatarSize}
            badgeScale={badgeScale}
            onAvatarClick={onAvatarClick}
            interactive={interactive}
            dense={dense}
          />
        ))}
      </div>
    </div>
  );
}

function ShowdownSoloLayout({
  groups,
  avatarSize,
  badgeScale,
  onAvatarClick,
  interactive,
}: {
  groups: BattleHistoryParticipant[][];
  avatarSize: number;
  badgeScale: number;
  onAvatarClick?: (e: MouseEvent, p: BattleHistoryParticipant) => void;
  interactive?: boolean;
}) {
  const top = groups.slice(0, 5);
  const bottom = groups.slice(5, 10);
  const renderRow = (row: BattleHistoryParticipant[][], key: string) => (
    <div
      key={key}
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: 8,
        width: "100%",
      }}
    >
      {row.map((team, i) => (
        <BattleHistoryPlayerSlot
          key={`${key}-${i}`}
          p={team[0]}
          size={avatarSize}
          badgeScale={badgeScale}
          onAvatarClick={onAvatarClick}
          interactive={interactive}
        />
      ))}
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", minHeight: 160 }}>
      {renderRow(top, "top")}
      {bottom.length > 0 && renderRow(bottom, "bottom")}
    </div>
  );
}

function ShowdownDuoLayout({
  groups,
  avatarSize,
  badgeScale,
  onAvatarClick,
  interactive,
}: {
  groups: BattleHistoryParticipant[][];
  avatarSize: number;
  badgeScale: number;
  onAvatarClick?: (e: MouseEvent, p: BattleHistoryParticipant) => void;
  interactive?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: 10,
        width: "100%",
        minHeight: 180,
      }}
    >
      {groups.map((team, i) => (
        <div
          key={`duo-${i}`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          {team.map((p, j) => (
            <BattleHistoryPlayerSlot
              key={`${p.brawlerId}-${j}`}
              p={p}
              size={avatarSize}
              badgeScale={badgeScale}
              onAvatarClick={onAvatarClick}
              interactive={interactive}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ShowdownTrioLayout({
  groups,
  avatarSize,
  badgeScale,
  onAvatarClick,
  interactive,
  compact,
}: {
  groups: BattleHistoryParticipant[][];
  avatarSize: number;
  badgeScale: number;
  onAvatarClick?: (e: MouseEvent, p: BattleHistoryParticipant) => void;
  interactive?: boolean;
  compact?: boolean;
}) {
  const trioSize = compact ? 58 : 66;
  const rows: BattleHistoryParticipant[][][] = [];
  for (let i = 0; i < groups.length; i += 2) {
    rows.push(groups.slice(i, i + 2));
  }

  const renderTeam = (team: BattleHistoryParticipant[], key: string) => (
    <div
      key={key}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        justifyContent: "center",
        alignItems: "flex-start",
        gap: compact ? 12 : 16,
        minWidth: 0,
        padding: compact ? "0 4px" : "0 6px",
      }}
    >
      {team.map((p, i) => (
        <BattleHistoryPlayerSlot
          key={`${key}-${p.brawlerId}-${i}`}
          p={p}
          size={trioSize}
          badgeScale={badgeScale}
          onAvatarClick={onAvatarClick}
          interactive={interactive}
          trio
        />
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 8, width: "100%" }}>
      {rows.map((pair, ri) => (
        <div
          key={`trio-row-${ri}`}
          style={{
            display: "flex",
            flexDirection: "row",
            gap: compact ? 4 : 6,
            width: "100%",
            alignItems: "flex-start",
          }}
        >
          {pair.map((team, ti) => renderTeam(team, `trio-${ri}-${ti}`))}
          {pair.length === 1 && <div style={{ flex: 1 }} />}
        </div>
      ))}
    </div>
  );
}

interface Props {
  participants: BattleHistoryParticipant[];
  meta: BattleHistoryRosterMeta;
  compact?: boolean;
  /** Extra-tight layout for club chat battle share cards. */
  dense?: boolean;
  onAvatarClick?: (e: MouseEvent, p: BattleHistoryParticipant) => void;
  interactive?: boolean;
}

export default function BattleHistoryTeamRoster({
  participants,
  meta,
  compact,
  dense,
  onAvatarClick,
  interactive = true,
}: Props) {
  const { t } = useI18n();
  if (!participants.length) return null;

  const badgeScale = dense
    ? CLUB_SHARE_BADGE_SCALE
    : compact
      ? MENU_RANK_BADGE_SCALE * 0.82
      : MENU_RANK_BADGE_SCALE * 0.88;
  const blue = participants.filter(p => p.team === "blue");
  const red = participants.filter(p => p.team === "red");
  const teamCount = Math.max(blue.length, red.length, 1);
  const avatarSize = dense
    ? teamCount >= 3 ? 50 : 56
    : compact
      ? teamCount >= 5 ? 56 : teamCount >= 3 ? 64 : 72
      : teamCount >= 5 ? 68 : teamCount >= 3 ? 80 : 92;

  if (meta.mode === "bossraid") {
    const bossId = meta.bossId ?? red[0]?.brawlerId ?? "miya";
    const bossLevel = meta.bossLevel ?? red[0]?.level ?? 8;
    return (
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "stretch",
          minHeight: compact ? 180 : 220,
          width: "100%",
        }}
      >
        <TeamSideColumn
          label={t("battle.teamBlue")}
          color="#4285F4"
          players={blue}
          avatarSize={avatarSize}
          badgeScale={badgeScale}
          onAvatarClick={onAvatarClick}
          interactive={interactive}
          dense={dense}
        />
        <div style={{ width: 1, background: "rgba(255,255,255,0.12)", margin: "8px 0" }} />
        <BossSlot bossId={bossId} level={bossLevel} compact={compact || dense} />
      </div>
    );
  }

  if (TEAM_MODES.has(meta.mode)) {
    return (
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
          minHeight: dense ? 150 : compact ? 170 : 210,
          width: "100%",
        }}
      >
        <TeamSideColumn
          label={t("battle.teamBlue")}
          color="#4285F4"
          players={blue}
          avatarSize={avatarSize}
          badgeScale={badgeScale}
          onAvatarClick={onAvatarClick}
          interactive={interactive}
          playerLayout="row"
          dense={dense}
        />
        <div style={{ width: 1, background: "rgba(255,255,255,0.12)", margin: "8px 0", flexShrink: 0 }} />
        <TeamSideColumn
          label={t("battle.teamRed")}
          color="#E53935"
          players={red}
          avatarSize={avatarSize}
          badgeScale={badgeScale}
          onAvatarClick={onAvatarClick}
          interactive={interactive}
          playerLayout="row"
          dense={dense}
        />
      </div>
    );
  }

  const groups = groupByRawTeam(participants);
  const teamSize = meta.showdownFormat
    ? meta.showdownFormat === "trio" ? 3 : meta.showdownFormat === "duo" ? 2 : 1
    : inferShowdownTeamSize(participants);

  if (teamSize >= 3) {
    return (
      <ShowdownTrioLayout
        groups={groups}
        avatarSize={compact ? 58 : 68}
        badgeScale={badgeScale}
        onAvatarClick={onAvatarClick}
        interactive={interactive}
        compact={compact}
      />
    );
  }
  if (teamSize >= 2) {
    return (
      <ShowdownDuoLayout
        groups={groups}
        avatarSize={compact ? 62 : 72}
        badgeScale={badgeScale}
        onAvatarClick={onAvatarClick}
        interactive={interactive}
      />
    );
  }
  return (
    <ShowdownSoloLayout
      groups={groups}
      avatarSize={compact ? 64 : 76}
      badgeScale={badgeScale}
      onAvatarClick={onAvatarClick}
      interactive={interactive}
    />
  );
}
