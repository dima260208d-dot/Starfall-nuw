import {
  RANKED_LEAGUES,
  rankedStandingFromTotalCups,
  tierRoman,
  type RankedLeagueDef,
  type RankedLeagueId,
  type RankedStanding,
} from "./rankedProgress";

export interface RankedLeagueBarState {
  standing: RankedStanding;
  league: RankedLeagueDef;
  displayCups: number;
  barVisible: boolean;
  fill: number;
  peakFill: number;
  showEndLeagueBadge: boolean;
  endLeagueId?: RankedLeagueId;
  segmentLabelKey: string;
  segmentLabelLeagueId?: RankedLeagueId;
}

export function computeRankedLeagueBarState(
  totalCups: number,
  peakCups?: number,
): RankedLeagueBarState {
  const standing = rankedStandingFromTotalCups(totalCups);
  const peak = Math.max(totalCups, peakCups ?? totalCups);
  const peakStanding = rankedStandingFromTotalCups(peak);
  const league = RANKED_LEAGUES[standing.leagueIndex]!;

  const fill = standing.cupsNeeded > 0
    ? Math.min(1, standing.cupsInTier / standing.cupsNeeded)
    : 0;

  let peakFill = fill;
  if (peakStanding.globalTier > standing.globalTier) {
    peakFill = 1;
  } else if (peakStanding.globalTier === standing.globalTier && peakStanding.cupsNeeded > 0) {
    peakFill = Math.min(1, peakStanding.cupsInTier / peakStanding.cupsNeeded);
  }

  const showEndLeagueBadge = standing.tier === 3 && standing.leagueIndex < RANKED_LEAGUES.length - 1;
  const endLeagueId = showEndLeagueBadge
    ? RANKED_LEAGUES[standing.leagueIndex + 1]!.id
    : undefined;

  let segmentLabelKey: string;
  let segmentLabelLeagueId: RankedLeagueId | undefined;
  if (standing.tier === 1) {
    segmentLabelKey = "ranked.segment.0to1";
  } else if (standing.tier === 2) {
    segmentLabelKey = "ranked.segment.1to2";
  } else if (showEndLeagueBadge && endLeagueId) {
    segmentLabelKey = "ranked.segment.3toLeague";
    segmentLabelLeagueId = endLeagueId;
  } else {
    segmentLabelKey = "ranked.segment.2to3";
  }

  return {
    standing,
    league,
    displayCups: standing.cupsInTier,
    barVisible: true,
    fill,
    peakFill,
    showEndLeagueBadge,
    endLeagueId,
    segmentLabelKey,
    segmentLabelLeagueId,
  };
}

export function rankedLeagueBarColors(leagueIndex: number): { top: string; bottom: string; glow?: string } {
  const lg = RANKED_LEAGUES[leagueIndex]!;
  return {
    top: lg.accent,
    bottom: lg.color,
    glow: `${lg.accent}88`,
  };
}

export function rankedLeagueSegmentCaption(
  state: RankedLeagueBarState,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (state.segmentLabelKey === "ranked.segment.3toLeague" && state.segmentLabelLeagueId) {
    return t(state.segmentLabelKey, {
      from: tierRoman(3),
      league: t(`ranked.league.${state.segmentLabelLeagueId}`),
    });
  }
  if (state.segmentLabelKey === "ranked.segment.0to1") {
    return t(state.segmentLabelKey, { roman: tierRoman(1) });
  }
  if (state.segmentLabelKey === "ranked.segment.1to2") {
    return t(state.segmentLabelKey, { from: tierRoman(1), to: tierRoman(2) });
  }
  return t(state.segmentLabelKey, { from: tierRoman(2), to: tierRoman(3) });
}
