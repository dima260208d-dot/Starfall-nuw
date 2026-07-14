import { TROPHY_ROAD, type TrophyRoadReward } from "./localStorageAPI";

export interface TrophyRoadSegment {
  trophies: number;
  prevThreshold: number;
  next: TrophyRoadReward | null;
  fill: number;
}

export function getTrophyRoadSegment(trophies: number): TrophyRoadSegment {
  let prevThreshold = 0;
  let next: TrophyRoadReward | null = TROPHY_ROAD[0] ?? null;

  for (const row of TROPHY_ROAD) {
    if (trophies < row.trophies) {
      next = row;
      break;
    }
    prevThreshold = row.trophies;
    next = null;
  }

  if (!next) {
    return { trophies, prevThreshold, next: null, fill: 1 };
  }

  const span = next.trophies - prevThreshold;
  const fill = span > 0 ? Math.max(0, Math.min(1, (trophies - prevThreshold) / span)) : 0;
  return { trophies, prevThreshold, next, fill };
}
