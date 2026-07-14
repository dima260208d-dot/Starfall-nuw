import type { Brawler } from "../entities/Brawler";
import type { Crate } from "../game/MapRenderer";
import type { PowerJarDrop } from "../game/battle3DWorld";
import { getGemCanvas, getSafeCanvas, getStarBallCanvas } from "./powerModelCache";
import type {
  ReplayBallState,
  ReplayCrystalState,
  ReplayCrateState,
  ReplayDropState,
  ReplayGemState,
  ReplayHudFrame,
  ReplaySafeState,
  ReplaySiegeBaseState,
  ReplayWorldFrame,
  ReplayWorldMeta,
} from "./battleReplayStore";
import { extractBattleScore } from "./battleHistoryEnrich";

type GameLike = {
  ball?: ReplayBallState & { boostTrailTimer?: number; superKickActive?: boolean };
  gems?: { x: number; y: number; carrier?: { id?: string } | null }[];
  crystals?: {
    x: number; y: number;
    carrier?: { id?: string } | null;
    depositedTeam?: string | null;
  }[];
  safes?: { x: number; y: number; hp: number; maxHp: number; team: string }[];
  baseX?: number;
  baseY?: number;
  baseHp?: number;
  baseMaxHp?: number;
  drops?: {
    type: string; x: number; y: number; radius?: number;
    id?: number; jarId?: number; spawnX?: number; spawnY?: number;
  }[];
  map?: { crates?: ReplayCrateState[]; width?: number };
  center?: { x: number; y: number };
  goalHalf?: number;
  gemCenter?: { x: number; y: number };
  blueBase?: { x: number; y: number };
  redBase?: { x: number; y: number };
};

export function collectReplayWorldMeta(game: unknown): ReplayWorldMeta | undefined {
  const g = game as GameLike;
  const meta: ReplayWorldMeta = {};
  let has = false;

  if (g.center) {
    meta.starStrike = {
      centerX: g.center.x,
      centerY: g.center.y,
      goalHalf: g.goalHalf ?? 170,
    };
    has = true;
  }
  if (g.gemCenter) {
    meta.gemCenter = { x: g.gemCenter.x, y: g.gemCenter.y };
    has = true;
  }
  if (g.blueBase && g.redBase) {
    meta.crystalBases = {
      blue: { x: g.blueBase.x, y: g.blueBase.y },
      red: { x: g.redBase.x, y: g.redBase.y },
    };
    has = true;
  }
  if (g.map?.width) {
    meta.mapWidth = g.map.width;
    has = true;
  }
  return has ? meta : undefined;
}

export function collectReplayWorldFrame(game: unknown): ReplayWorldFrame | undefined {
  const g = game as GameLike;
  const world: ReplayWorldFrame = {};
  let has = false;

  if (g.ball) {
    world.ball = {
      x: Math.round(g.ball.x),
      y: Math.round(g.ball.y),
      vx: g.ball.vx,
      vy: g.ball.vy,
      radius: g.ball.radius ?? 11,
      ownerId: g.ball.ownerId ?? null,
    };
    has = true;
  }

  if (g.gems?.length) {
    world.gems = g.gems.map(gem => ({
      x: Math.round(gem.x),
      y: Math.round(gem.y),
      carrierId: gem.carrier?.id ?? null,
    }));
    has = true;
  }

  if (g.crystals?.length) {
    world.crystals = g.crystals.map(c => ({
      x: Math.round(c.x),
      y: Math.round(c.y),
      carrierId: c.carrier?.id ?? null,
      depositedTeam: c.depositedTeam ?? null,
    }));
    has = true;
  }

  if (g.safes?.length) {
    world.safes = g.safes.map(s => ({
      x: Math.round(s.x),
      y: Math.round(s.y),
      hp: Math.max(0, Math.round(s.hp)),
      maxHp: Math.max(1, Math.round(s.maxHp)),
      team: s.team,
    }));
    has = true;
  }

  if (typeof g.baseX === "number" && typeof g.baseY === "number") {
    world.siegeBase = {
      x: Math.round(g.baseX),
      y: Math.round(g.baseY),
      hp: Math.max(0, Math.round(g.baseHp ?? 0)),
      maxHp: Math.max(1, Math.round(g.baseMaxHp ?? 1)),
    };
    has = true;
  }

  if (g.drops?.length) {
    world.drops = g.drops.map(d => ({
      type: d.type as ReplayDropState["type"],
      x: Math.round(d.x),
      y: Math.round(d.y),
      radius: d.radius ?? 14,
      id: d.jarId ?? d.id,
      spawnX: d.spawnX,
      spawnY: d.spawnY,
    }));
    has = true;
  }

  const crates = g.map?.crates;
  if (crates?.length) {
    world.crates = crates.map(c => ({
      x: c.x,
      y: c.y,
      w: c.w,
      h: c.h,
      hp: c.hp,
      maxHp: c.maxHp,
      destroyed: !!c.destroyed,
    }));
    has = true;
  }

  return has ? world : undefined;
}

export function collectReplayHudFrame(game: unknown, elapsed = 0): ReplayHudFrame | undefined {
  const g = game as Record<string, unknown>;
  const hud: ReplayHudFrame = {};
  let has = false;

  const score = extractBattleScore(game);
  if (score) {
    hud.scoreBlue = score.blue;
    hud.scoreRed = score.red;
    has = true;
    if (g.goals) hud.scoreKind = "goals";
    else if (g.blueGems != null) hud.scoreKind = "gems";
    else if (g.blueCrystals != null) hud.scoreKind = "crystals";
    else if (g.blueBounty != null) hud.scoreKind = "bounty";
  }

  const safes = g.safes as { team: string; hp: number }[] | undefined;
  if (safes?.length) {
    const blue = safes.find(s => s.team === "blue");
    const red = safes.find(s => s.team === "red");
    if (blue && red) {
      hud.scoreBlue = Math.max(0, Math.round(blue.hp));
      hud.scoreRed = Math.max(0, Math.round(red.hp));
      hud.scoreKind = "hp";
      has = true;
    }
  }

  if (typeof g.baseHp === "number") {
    hud.scoreRed = Math.max(0, Math.round(g.baseHp as number));
    hud.scoreKind = "siege";
    has = true;
  }

  if (typeof g.matchTimer === "number") {
    hud.secondsLeft = g.overtime
      ? Math.max(0, g.suddenDeathTimer as number)
      : Math.max(0, g.matchTimer as number);
    hud.overtime = !!g.overtime;
    has = true;
  }

  if (typeof g.blueCountdown === "number" && (g.blueCountdown as number) > 0) {
    hud.blueCountdown = g.blueCountdown as number;
    has = true;
  }
  if (typeof g.redCountdown === "number" && (g.redCountdown as number) > 0) {
    hud.redCountdown = g.redCountdown as number;
    has = true;
  }

  const gc = g.goalCelebration as { timer?: number; team?: string } | null | undefined;
  if (gc?.team && typeof gc.timer === "number" && gc.timer > 0.05) {
    hud.goalCelebrationTeam = gc.team;
    hud.goalCelebrationUntilT = elapsed + gc.timer;
    has = true;
  }

  return has ? hud : undefined;
}

export function lerpReplayHud(
  a: ReplayHudFrame | undefined,
  b: ReplayHudFrame | undefined,
  u: number,
): ReplayHudFrame | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  const pickB = u > 0.5;
  return {
    scoreBlue: pickB ? b.scoreBlue : a.scoreBlue,
    scoreRed: pickB ? b.scoreRed : a.scoreRed,
    secondsLeft: a.secondsLeft != null && b.secondsLeft != null
      ? a.secondsLeft + (b.secondsLeft - a.secondsLeft) * u
      : (pickB ? b.secondsLeft : a.secondsLeft),
    overtime: pickB ? b.overtime : a.overtime,
    blueCountdown: pickB ? b.blueCountdown : a.blueCountdown,
    redCountdown: pickB ? b.redCountdown : a.redCountdown,
    scoreKind: pickB ? b.scoreKind : a.scoreKind,
    goalCelebrationTeam: pickB ? b.goalCelebrationTeam : a.goalCelebrationTeam,
    goalCelebrationUntilT: pickB ? b.goalCelebrationUntilT : a.goalCelebrationUntilT,
  };
}

export function renderReplayGoalCelebration(
  ctx: CanvasRenderingContext2D,
  team: string,
  labels: { goal: string; teamBlue: string; teamRed: string },
  canvasW: number,
  canvasH: number,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#FFD740";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#FFD740";
  ctx.font = "bold 96px Segoe UI, Arial, sans-serif";
  ctx.fillText(labels.goal, canvasW / 2, canvasH * 0.44);
  ctx.shadowBlur = 10;
  ctx.fillStyle = team === "blue" ? "#80D8FF" : "#FF8A80";
  ctx.font = "bold 30px Segoe UI, Arial, sans-serif";
  ctx.fillText(team === "blue" ? labels.teamBlue : labels.teamRed, canvasW / 2, canvasH * 0.52);
  ctx.restore();
}

function lerpBall(a: ReplayBallState, b: ReplayBallState, u: number): ReplayBallState {
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    vx: a.vx + (b.vx - a.vx) * u,
    vy: a.vy + (b.vy - a.vy) * u,
    radius: b.radius,
    ownerId: u > 0.5 ? b.ownerId : a.ownerId,
  };
}

function lerpGems(a: ReplayGemState[], b: ReplayGemState[], u: number): ReplayGemState[] {
  const out: ReplayGemState[] = [];
  const used = new Set<number>();
  for (const ga of a) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < b.length; i++) {
      if (used.has(i)) continue;
      const d = Math.hypot(b[i].x - ga.x, b[i].y - ga.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0 && bestD < 120) {
      used.add(best);
      const gb = b[best];
      out.push({
        x: ga.x + (gb.x - ga.x) * u,
        y: ga.y + (gb.y - ga.y) * u,
        carrierId: u > 0.5 ? gb.carrierId : ga.carrierId,
      });
    } else if (u < 0.5) {
      out.push(ga);
    }
  }
  if (u > 0.5) {
    for (let i = 0; i < b.length; i++) {
      if (used.has(i)) continue;
      out.push(b[i]);
    }
  }
  return out;
}

function lerpCrystals(a: ReplayCrystalState[], b: ReplayCrystalState[], u: number): ReplayCrystalState[] {
  const out: ReplayCrystalState[] = [];
  const used = new Set<number>();
  for (const ca of a) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < b.length; i++) {
      if (used.has(i)) continue;
      const d = Math.hypot(b[i].x - ca.x, b[i].y - ca.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0 && bestD < 120) {
      used.add(best);
      const cb = b[best];
      out.push({
        x: ca.x + (cb.x - ca.x) * u,
        y: ca.y + (cb.y - ca.y) * u,
        carrierId: u > 0.5 ? cb.carrierId : ca.carrierId,
        depositedTeam: u > 0.5 ? cb.depositedTeam : ca.depositedTeam,
      });
    } else if (u < 0.5) {
      out.push(ca);
    }
  }
  if (u > 0.5) {
    for (let i = 0; i < b.length; i++) {
      if (!used.has(i)) out.push(b[i]);
    }
  }
  return out;
}

export function lerpReplayWorld(a: ReplayWorldFrame | undefined, b: ReplayWorldFrame | undefined, u: number): ReplayWorldFrame | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  const out: ReplayWorldFrame = {};

  if (a.ball && b.ball) out.ball = lerpBall(a.ball, b.ball, u);
  else out.ball = u > 0.5 ? b.ball : a.ball;

  if (a.gems || b.gems) {
    out.gems = lerpGems(a.gems ?? [], b.gems ?? [], u);
  }
  if (a.crystals || b.crystals) {
    out.crystals = lerpCrystals(a.crystals ?? [], b.crystals ?? [], u);
  }

  out.safes = u > 0.5 ? (b.safes ?? a.safes) : (a.safes ?? b.safes);
  if (a.siegeBase && b.siegeBase) {
    out.siegeBase = {
      x: a.siegeBase.x + (b.siegeBase.x - a.siegeBase.x) * u,
      y: a.siegeBase.y + (b.siegeBase.y - a.siegeBase.y) * u,
      hp: a.siegeBase.hp + (b.siegeBase.hp - a.siegeBase.hp) * u,
      maxHp: b.siegeBase.maxHp,
    };
  } else {
    out.siegeBase = u > 0.5 ? b.siegeBase : a.siegeBase;
  }

  out.drops = u > 0.5 ? (b.drops ?? a.drops) : (a.drops ?? b.drops);
  out.crates = u > 0.5 ? (b.crates ?? a.crates) : (a.crates ?? b.crates);

  return out;
}

export function replayCratesTo3D(crates: ReplayCrateState[] | undefined): Crate[] | undefined {
  if (!crates?.length) return undefined;
  return crates.map(c => ({
    x: c.x,
    y: c.y,
    w: c.w,
    h: c.h,
    hp: c.hp ?? 1,
    maxHp: c.maxHp ?? 1,
    destroyed: c.destroyed,
  }));
}

export function replayDropsToPowerJars(drops: ReplayDropState[] | undefined): PowerJarDrop[] | undefined {
  if (!drops?.length) return undefined;
  const jars = drops
    .filter(d => d.type === "powerup" && typeof d.id === "number")
    .map(d => ({
      id: d.id!,
      x: d.x,
      y: d.y,
      radius: d.radius,
      spawnX: d.spawnX,
      spawnY: d.spawnY,
    }));
  return jars.length ? jars : undefined;
}

export function applyReplayCrystalCounts(brawlers: Brawler[], world: ReplayWorldFrame | undefined): void {
  if (!world?.gems?.length && !world?.crystals?.length) return;
  const items = world.crystals ?? world.gems ?? [];
  for (const b of brawlers) {
    b.crystalCount = items.filter(g => g.carrierId === b.id).length;
  }
}

function renderGoalFrames(
  ctx: CanvasRenderingContext2D,
  meta: ReplayWorldMeta,
  camX: number,
  camY: number,
  mapWidth: number,
): void {
  const ss = meta.starStrike;
  if (!ss) return;
  const leftX = 60 - camX;
  const rightX = (meta.mapWidth ?? mapWidth) - 60 - camX;
  const topY = ss.centerY - ss.goalHalf - camY;
  const bottomY = ss.centerY + ss.goalHalf - camY;
  const depth = 48;
  const postW = 8;

  ctx.save();
  ctx.fillStyle = "#ECEFF1";
  ctx.fillRect(leftX - postW / 2, topY - 4, postW, 22);
  ctx.fillRect(leftX - postW / 2, bottomY - 18, postW, 22);
  ctx.fillRect(leftX, topY - 4, depth, 4);
  ctx.fillRect(leftX, bottomY, depth, 4);
  ctx.fillRect(rightX - postW / 2, topY - 4, postW, 22);
  ctx.fillRect(rightX - postW / 2, bottomY - 18, postW, 22);
  ctx.fillRect(rightX - depth, topY - 4, depth, 4);
  ctx.fillRect(rightX - depth, bottomY, depth, 4);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(leftX - postW / 2, topY - 4, postW, bottomY - topY + 8);
  ctx.strokeRect(rightX - postW / 2, topY - 4, postW, bottomY - topY + 8);
  ctx.restore();
}

function renderBall(ctx: CanvasRenderingContext2D, ball: ReplayBallState, camX: number, camY: number, frame: number): void {
  const sx = ball.x - camX;
  const sy = ball.y - camY;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > 80 && !ball.ownerId) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "#FFD740";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(sx - ball.vx * 0.02, sy - ball.vy * 0.02);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.restore();
  }
  const d = ball.radius * 3;
  const flat = getStarBallCanvas();
  const spin = frame * 0.08 + ball.x * 0.01;
  ctx.save();
  ctx.translate(sx, sy);
  if (flat) {
    ctx.rotate(spin);
    ctx.drawImage(flat, -d / 2, -d / 2, d, d);
  } else {
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#212121";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#212121";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius * 0.85, spin, spin + Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGemSprite(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  frame: number,
  bob = true,
): void {
  const gem = getGemCanvas();
  const syDraw = bob ? sy + Math.sin((frame + sx * 0.03 + sy * 0.02) * 0.12) * 2.2 : sy;
  if (gem) {
    const pulse = 1 + Math.sin((frame + sx * 0.02) * 0.08) * 0.04;
    ctx.save();
    ctx.translate(sx, syDraw);
    ctx.scale(pulse, pulse);
    ctx.shadowColor = "#00BCD4";
    ctx.shadowBlur = 14;
    ctx.drawImage(gem, -size / 2, -size / 2, size, size);
    ctx.restore();
  } else {
    ctx.save();
    ctx.shadowColor = "#CE93D8";
    ctx.shadowBlur = 15;
    ctx.fillStyle = "#E040FB";
    ctx.beginPath();
    ctx.moveTo(sx, syDraw - size * 0.38);
    ctx.lineTo(sx + size * 0.25, syDraw);
    ctx.lineTo(sx, syDraw + size * 0.38);
    ctx.lineTo(sx - size * 0.25, syDraw);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function renderGems(
  ctx: CanvasRenderingContext2D,
  gems: ReplayGemState[],
  camX: number,
  camY: number,
  frame: number,
): void {
  const GEM_SIZE = 32;
  for (const gem of gems) {
    if (gem.carrierId) continue;
    drawGemSprite(ctx, gem.x - camX, gem.y - camY, GEM_SIZE, frame);
  }
  for (const gem of gems) {
    if (!gem.carrierId) continue;
    const sx = gem.x - camX;
    const sy = gem.y - camY - 30;
    drawGemSprite(ctx, sx, sy, GEM_SIZE * 0.55, frame, false);
  }
}

function renderCrystalZones(ctx: CanvasRenderingContext2D, meta: ReplayWorldMeta, camX: number, camY: number): void {
  const bases = meta.crystalBases;
  if (!bases) return;
  for (const zone of [{ ...bases.blue, team: "blue" as const }, { ...bases.red, team: "red" as const }]) {
    const sx = zone.x - camX;
    const sy = zone.y - camY;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = zone.team === "blue" ? "#2196F3" : "#F44336";
    ctx.beginPath();
    ctx.arc(sx, sy, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = zone.team === "blue" ? "#64B5F6" : "#EF9A9A";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
}

function renderSafes(ctx: CanvasRenderingContext2D, safes: ReplaySafeState[], camX: number, camY: number): void {
  const safeSprite = getSafeCanvas();
  for (const safe of safes) {
    if (safe.hp <= 0) continue;
    const sx = safe.x - camX;
    const sy = safe.y - camY;
    const isBlue = safe.team === "blue";
    const teamGlow = isBlue ? "#40C4FF" : "#FF5252";
    const hpRatio = Math.max(0, safe.hp / safe.maxHp);
    const W = 100;
    const H = 100;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(sx + 5, sy + H / 2 + 10, 60, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = teamGlow;
    ctx.shadowBlur = 22;

    if (safeSprite) {
      const D = W * 2.1;
      ctx.globalAlpha = hpRatio < 0.25 ? 0.55 : 1;
      ctx.drawImage(safeSprite, sx - D / 2, sy - D / 2, D, D);
      ctx.globalAlpha = 1;
      ctx.fillStyle = isBlue ? "rgba(25,100,210,0.18)" : "rgba(210,30,30,0.18)";
      ctx.fillRect(sx - D / 2, sy - D / 2, D, D);
    } else {
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#546E7A";
      ctx.fillRect(sx - W / 2, sy - H / 2, W, H);
      ctx.fillStyle = "#FFD700";
      ctx.font = `bold ${Math.round(W * 0.44)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔒", sx, sy);
    }

    ctx.shadowBlur = 0;
    const barW = W * 1.3;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(sx - barW / 2 - 1, sy - H / 2 - 18, barW + 2, 12);
    const barColor = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FFB300" : "#F44336";
    ctx.fillStyle = barColor;
    ctx.fillRect(sx - barW / 2, sy - H / 2 - 17, barW * hpRatio, 10);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.max(0, Math.round(safe.hp))} HP`, sx, sy + H * 0.34);
    ctx.restore();
  }
}

function renderSiegeBase(ctx: CanvasRenderingContext2D, base: ReplaySiegeBaseState, camX: number, camY: number): void {
  if (base.hp <= 0) return;
  const sx = base.x - camX;
  const sy = base.y - camY;
  const safeSprite = getSafeCanvas();
  const hpRatio = Math.max(0, base.hp / base.maxHp);
  const W = 120;
  const H = 120;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(sx + 5, sy + H / 2 + 10, 70, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "#FF5252";
  ctx.shadowBlur = 24;

  if (safeSprite) {
    const D = W * 2.2;
    ctx.globalAlpha = hpRatio < 0.25 ? 0.55 : 1;
    ctx.drawImage(safeSprite, sx - D / 2, sy - D / 2, D, D);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(210,30,30,0.18)";
    ctx.fillRect(sx - D / 2, sy - D / 2, D, D);
  } else {
    ctx.fillStyle = "#546E7A";
    ctx.fillRect(sx - W / 2, sy - H / 2, W, H);
  }

  ctx.shadowBlur = 0;
  const barW = W * 1.4;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(sx - barW / 2 - 1, sy - H / 2 - 20, barW + 2, 14);
  ctx.fillStyle = hpRatio > 0.5 ? "#4CAF50" : hpRatio > 0.25 ? "#FFB300" : "#F44336";
  ctx.fillRect(sx - barW / 2, sy - H / 2 - 19, barW * hpRatio, 12);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.max(0, Math.round(base.hp))} HP`, sx, sy + H * 0.34);
  ctx.restore();
}

function renderFlatDrops(ctx: CanvasRenderingContext2D, drops: ReplayDropState[], camX: number, camY: number): void {
  for (const drop of drops) {
    if (drop.type === "powerup") continue;
    const sx = drop.x - camX;
    const sy = drop.y - camY;
    const color = drop.type === "health" ? "#4CAF50" : "#FFD700";
    const label = drop.type === "health" ? "+" : "$";
    const r0 = drop.radius * 0.72;
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, r0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.round(r0 * 0.9)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, sx, sy);
    ctx.restore();
  }
}

export function renderReplayWorldProps(
  ctx: CanvasRenderingContext2D,
  opts: {
    world?: ReplayWorldFrame;
    meta?: ReplayWorldMeta;
    camX: number;
    camY: number;
    frame: number;
    mapWidth: number;
  },
): void {
  const { world, meta, camX, camY, frame, mapWidth } = opts;
  if (!world && !meta) return;

  if (meta?.starStrike) {
    renderGoalFrames(ctx, meta, camX, camY, mapWidth);
  }

  if (meta?.gemCenter) {
    const csx = meta.gemCenter.x - camX;
    const csy = meta.gemCenter.y - camY;
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = "#CE93D8";
    ctx.beginPath();
    ctx.arc(csx, csy, 250, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (meta?.crystalBases) {
    renderCrystalZones(ctx, meta, camX, camY);
  }

  if (world?.safes?.length) {
    renderSafes(ctx, world.safes, camX, camY);
  }

  if (world?.siegeBase) {
    renderSiegeBase(ctx, world.siegeBase, camX, camY);
  }

  const gems = world?.crystals ?? world?.gems;
  if (gems?.length) {
    renderGems(ctx, gems, camX, camY, frame);
  }

  if (world?.drops?.length) {
    renderFlatDrops(ctx, world.drops, camX, camY);
  }

  if (world?.ball) {
    renderBall(ctx, world.ball, camX, camY, frame);
  }
}
