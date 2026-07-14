import { MapBuilder, OV, CX, CY, LEFT, RIGHT, TOP, BOT } from "./mapBuilder";

const SD_SPAWNS: [number, number][] = [
  [LEFT, TOP], [LEFT, CY], [LEFT, BOT],
  [CX, TOP], [CX, BOT],
  [RIGHT, TOP], [RIGHT, CY], [RIGHT, BOT],
  [CX - 8, CY - 8], [CX + 8, CY + 8],
];

export function placeShowdownSpawns(b: MapBuilder): void {
  for (const [x, y] of SD_SPAWNS) b.ov(x, y, OV.SPAWN_SD);
}

export function placeTeamSpawns3(b: MapBuilder): void {
  for (const sy of [CY - 4, CY, CY + 4]) b.pair(LEFT, sy, OV.SPAWN_BLUE, OV.SPAWN_RED);
}

export function placeBountySpawns5(b: MapBuilder): void {
  for (const sy of [CY - 8, CY - 4, CY, CY + 4, CY + 8]) b.pair(LEFT, sy, OV.SPAWN_BLUE, OV.SPAWN_RED);
}

export function placeGemCenter(b: MapBuilder): void {
  b.ov(CX, CY, OV.GEM_CENTER);
}

export function placeHeistSafes(b: MapBuilder): void {
  b.pair(LEFT + 4, CY, OV.SAFE_BLUE, OV.SAFE_RED);
}

export function placeSiegeBase(b: MapBuilder): void {
  b.ov(LEFT, CY, OV.BASE_BLUE);
}

export function placeStarstrikeGoals(b: MapBuilder): void {
  b.ov(CX, TOP, OV.GOAL_BLUE);
  b.ov(CX, BOT, OV.GOAL_RED);
}

export function placeBossRaid(b: MapBuilder): void {
  for (const sy of [CY - 8, CY - 4, CY, CY + 4, CY + 8]) b.ov(LEFT, sy, OV.SPAWN_BLUE);
  b.ov(RIGHT - 2, CY, OV.BOSS_SPAWN);
}

export function placeShowdownPowerBoxes(b: MapBuilder, variant: number): void {
  const spots: [number, number][] = [
    [CX, CY], [CX - 7, CY - 7], [CX + 7, CY + 7], [CX - 7, CY + 7], [CX + 7, CY - 7],
    [LEFT + 8, CY], [RIGHT - 8, CY], [CX, TOP + 6], [CX, BOT - 6],
  ];
  for (let i = 0; i < 4 + (variant % 4) && i < spots.length; i++) b.ov(spots[i][0], spots[i][1], OV.POWER_BOX);
}
