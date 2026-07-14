import type { IntroLayoutKind } from "./battleIntroConfig";
import type { BattleIntroParticipant } from "./battleIntroParticipants";

export type SlideAxis = "left" | "right" | "top" | "bottom";

export interface IntroTeamBlock {
  teamId: string;
  members: BattleIntroParticipant[];
  highlight: boolean;
  slideFrom: SlideAxis;
}

export interface IntroLayoutRow {
  blocks: IntroTeamBlock[];
  align: "center" | "space-between";
}

export interface IntroLayout {
  kind: IntroLayoutKind;
  rows: IntroLayoutRow[];
  showVs: boolean;
  showAllTeamsCaption: boolean;
  playerTeamId: string;
}

function groupByTeam(participants: BattleIntroParticipant[]): Map<string, BattleIntroParticipant[]> {
  const map = new Map<string, BattleIntroParticipant[]>();
  for (const p of participants) {
    const arr = map.get(p.team) ?? [];
    arr.push(p);
    map.set(p.team, arr);
  }
  return map;
}

function sortTeamsPlayerLast(teams: string[], playerTeam: string): string[] {
  const rest = teams.filter(t => t !== playerTeam);
  rest.sort();
  if (playerTeam && teams.includes(playerTeam)) return [...rest.filter(t => t !== playerTeam), playerTeam];
  return rest;
}

function block(teamId: string, members: BattleIntroParticipant[], playerTeam: string, slideFrom: SlideAxis): IntroTeamBlock {
  return {
    teamId,
    members,
    highlight: teamId === playerTeam || members.some(m => m.isPlayer),
    slideFrom,
  };
}

export function buildIntroLayout(
  kind: IntroLayoutKind,
  participants: BattleIntroParticipant[],
  playerTeam: string,
): IntroLayout {
  const teams = groupByTeam(participants);
  const teamIds = sortTeamsPlayerLast([...teams.keys()], playerTeam);

  if (kind === "team_vs") {
    const red = teams.get("red") ?? [];
    const blue = teams.get("blue") ?? [];
    const redBlocks = red.length ? [block("red", red, playerTeam, "top")] : [];
    const blueBlocks = blue.length ? [block("blue", blue, playerTeam, "bottom")] : [];
    return {
      kind,
      rows: [
        { blocks: redBlocks, align: "center" },
        { blocks: blueBlocks, align: "center" },
      ],
      showVs: red.length > 0 && blue.length > 0,
      showAllTeamsCaption: false,
      playerTeamId: playerTeam,
    };
  }

  if (kind === "showdown_trio") {
    const blocks = teamIds.map((id, i) =>
      block(id, teams.get(id) ?? [], playerTeam, i % 2 === 0 ? "left" : "right"),
    );
    const half = Math.ceil(blocks.length / 2);
    return {
      kind,
      rows: [
        { blocks: blocks.slice(0, half), align: "center" },
        { blocks: blocks.slice(half), align: "center" },
      ],
      showVs: blocks.length > 1,
      showAllTeamsCaption: true,
      playerTeamId: playerTeam,
    };
  }

  if (kind === "showdown_duo") {
    const blocks = teamIds.map((id, i) =>
      block(id, teams.get(id) ?? [], playerTeam, i % 2 === 0 ? "bottom" : "top"),
    );
    return {
      kind,
      rows: [{ blocks, align: "center" }],
      showVs: blocks.length > 1,
      showAllTeamsCaption: true,
      playerTeamId: playerTeam,
    };
  }

  if (kind === "showdown_solo") {
    const sorted = [...participants].sort((a, b) => {
      if (a.isPlayer) return 1;
      if (b.isPlayer) return -1;
      return a.displayName.localeCompare(b.displayName);
    });
    const half = Math.ceil(sorted.length / 2);
    const row1 = sorted.slice(0, half).map((p, i) =>
      block(p.team, [p], playerTeam, i % 2 === 0 ? "left" : "right"),
    );
    const row2 = sorted.slice(half).map((p, i) =>
      block(p.team + "_2", [p], playerTeam, i % 2 === 0 ? "left" : "right"),
    );
    return {
      kind,
      rows: [
        { blocks: row1, align: "center" },
        { blocks: row2, align: "center" },
      ],
      showVs: false,
      showAllTeamsCaption: true,
      playerTeamId: playerTeam,
    };
  }

  // ally_row — boss raid, invasion, fallback
  const ally = participants.filter(p => p.team === playerTeam || p.team === "blue");
  const members = ally.length ? ally : participants;
  return {
    kind: "ally_row",
    rows: [{ blocks: [block(playerTeam || "blue", members, playerTeam, "bottom")], align: "center" }],
    showVs: false,
    showAllTeamsCaption: false,
    playerTeamId: playerTeam,
  };
}

export function slideTransform(from: SlideAxis, revealed: boolean, exiting: boolean): string {
  if (revealed && !exiting) return "none";
  const dir = exiting ? from : from;
  switch (dir) {
    case "left": return "translateX(-115%)";
    case "right": return "translateX(115%)";
    case "top": return "translateY(-115%)";
    case "bottom": return "translateY(115%)";
    default: return "translateX(-115%)";
  }
}

export function exitSlideTransform(from: SlideAxis): string {
  switch (from) {
    case "left": return "translateX(-115%)";
    case "right": return "translateX(115%)";
    case "top": return "translateY(-115%)";
    case "bottom": return "translateY(115%)";
    default: return "translateX(-115%)";
  }
}
