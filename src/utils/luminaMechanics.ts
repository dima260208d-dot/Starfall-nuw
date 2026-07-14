import type { Brawler } from "../entities/Brawler";
import type { TileGrid } from "../game/TileMap";
import { distance } from "./helpers";
import { spawnEffect, type Effect } from "./effects";

import { getBrawlerMechanicValue } from "./characterBalance";

/** 5 tiles @ 50px */
export const LUMINA_BEAM_RANGE = 250;
/** 4 tiles search for second chain target */
export const LUMINA_CHAIN_SEARCH = 200;
/** 3 tiles max link distance */
export const LUMINA_LINK_MAX_DIST = 150;

export function luminaBeamRange(): number {
  return getBrawlerMechanicValue("lumina", "LUMINA_BEAM_RANGE", LUMINA_BEAM_RANGE);
}
export function luminaChainSearch(): number {
  return getBrawlerMechanicValue("lumina", "LUMINA_CHAIN_SEARCH", LUMINA_CHAIN_SEARCH);
}
export function luminaLinkMaxDist(): number {
  return getBrawlerMechanicValue("lumina", "LUMINA_LINK_MAX_DIST", LUMINA_LINK_MAX_DIST);
}

interface LuminaLink {
  id: string;
  ownerId: string;
  ownerTeam: string;
  aId: string;
  bId: string;
  remaining: number;
  dps: number;
  maxDist: number;
  breakDamage: number;
  hasStar6: boolean;
  breakCdA: number;
  breakCdB: number;
}

const links: LuminaLink[] = [];

export function clearLuminaMechanics(): void {
  links.length = 0;
}

function findBrawler(all: Brawler[], id: string): Brawler | undefined {
  return all.find(b => b.id === id);
}

function linkKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
}

function hasActiveLink(aId: string, bId: string): boolean {
  const key = linkKey(aId, bId);
  return links.some(l => linkKey(l.aId, l.bId) === key && l.remaining > 0);
}

function enforceLinkDistance(a: Brawler, b: Brawler, maxDist: number): void {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d = Math.hypot(dx, dy);
  if (d < 0.001) {
    dx = 1;
    dy = 0;
    d = 1;
  }
  if (d <= maxDist) return;

  const nx = dx / d;
  const ny = dy / d;
  const midX = (a.x + b.x) * 0.5;
  const midY = (a.y + b.y) * 0.5;
  const half = maxDist * 0.5;
  a.x = midX - nx * half;
  a.y = midY - ny * half;
  b.x = midX + nx * half;
  b.y = midY + ny * half;
}

function brawlersInsideDome(e: Effect, allBrawlers: Brawler[]): Brawler[] {
  const R2 = e.radius * e.radius;
  const inside: Brawler[] = [];
  for (const b of allBrawlers) {
    if (!b.alive) continue;
    const dx = b.x - e.x;
    const dy = b.y - e.y;
    if (dx * dx + dy * dy <= R2) inside.push(b);
  }
  return inside;
}

export function spawnLuminaChestFlash(x: number, y: number, angle: number): void {
  spawnEffect({
    kind: "luminaMuzzle",
    x: x + Math.cos(angle) * 12,
    y: y + Math.sin(angle) * 12 - 4,
    radius: 18,
    color: "#FFD54F",
    secondary: "#FFFFFF",
    timer: 0.35,
    maxTimer: 0.35,
  });
}

export function spawnLuminaBeamVfx(x1: number, y1: number, x2: number, y2: number): void {
  spawnEffect({
    kind: "luminaBeam",
    x: x1,
    y: y1,
    toX: x2,
    toY: y2,
    radius: 4,
    color: "#FFD54F",
    secondary: "#FFFFFF",
    timer: 0.42,
    maxTimer: 0.42,
  });
}

/** «Божественное заточение» — golden rune dome, 4s, radius 120. */
export function spawnLuminaDome(owner: Brawler, x: number, y: number): void {
  const stars = new Set(owner.constellationStars || []);
  const duration = stars.has(5) ? 5.5 : 4;
  const radius = stars.has(5) ? 150 : 120;

  spawnEffect({
    kind: "luminaSuperCast",
    x,
    y,
    radius,
    color: "#FFD54F",
    secondary: "#FFF8E1",
    timer: 0.85,
    maxTimer: 0.85,
    ownerId: owner.id,
  });

  spawnEffect({
    kind: "luminaDome",
    x,
    y,
    radius,
    color: "#FFD54F",
    secondary: "#FFF8E1",
    timer: duration,
    maxTimer: duration,
    ownerId: owner.id,
    ownerTeam: owner.team,
    luminaGraceAllies: stars.has(3),
    cagePrisoners: [],
  });
}

export function createLuminaLink(
  owner: Brawler,
  first: Brawler,
  second: Brawler,
): void {
  if (hasActiveLink(first.id, second.id)) return;

  const stars = new Set(owner.constellationStars || []);
  const linkDur = stars.has(1) ? 4 : 3;
  const dps = stars.has(4) ? 150 : 100;
  const breakDmg = stars.has(2) ? 300 : 0;

  links.push({
    id: `lum_link_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ownerId: owner.id,
    ownerTeam: owner.team,
    aId: first.id,
    bId: second.id,
    remaining: linkDur,
    dps,
    maxDist: LUMINA_LINK_MAX_DIST,
    breakDamage: breakDmg,
    hasStar6: stars.has(6),
    breakCdA: 0,
    breakCdB: 0,
  });

  spawnEffect({
    kind: "luminaChain",
    x: first.x,
    y: first.y,
    toX: second.x,
    toY: second.y,
    radius: 12,
    color: "#FFD54F",
    secondary: "#FFFDE7",
    timer: linkDur,
    maxTimer: linkDur,
    linkAId: first.id,
    linkBId: second.id,
  });

  spawnEffect({
    kind: "burst",
    x: first.x,
    y: first.y,
    radius: 24,
    color: "#FFD54F",
    secondary: "#FFFFFF",
    timer: 0.4,
    maxTimer: 0.4,
  });
  spawnEffect({
    kind: "burst",
    x: second.x,
    y: second.y,
    radius: 24,
    color: "#FFD54F",
    secondary: "#FFFFFF",
    timer: 0.4,
    maxTimer: 0.4,
  });

  const linkGain = owner.maxSuperCharge / 3;
  owner.superCharge = Math.min(owner.maxSuperCharge, owner.superCharge + linkGain);
  if (owner.superCharge >= owner.maxSuperCharge) owner.superReady = true;
}

function triggerLuminaJusticeExplosion(
  ownerId: string,
  allBrawlers: Brawler[],
  activeEffects: Effect[],
): void {
  for (const e of activeEffects) {
    if (e.kind !== "luminaDome" || e.ownerId !== ownerId || e.timer <= 0) continue;
    const R2 = e.radius * e.radius;
    for (const b of allBrawlers) {
      if (!b.alive || b.team === e.ownerTeam) continue;
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      if (dx * dx + dy * dy <= R2) {
        b.takeDamage(500, null);
      }
    }
    spawnEffect({
      kind: "explosion",
      x: e.x,
      y: e.y,
      radius: e.radius * 0.9,
      color: "#FFD54F",
      secondary: "#FF8F00",
      timer: 1.0,
      maxTimer: 1.0,
    });
    e.timer = 0;
    break;
  }
}

function applyLuminaDomeContainment(e: Effect, allBrawlers: Brawler[]): void {
  if (e.kind !== "luminaDome" || e.timer <= 0) return;

  e.cagePrisoners = (e.cagePrisoners ?? []).filter(id => {
    const b = allBrawlers.find(x => x.id === id);
    return b && b.alive && b.team !== e.ownerTeam;
  });

  const inside = brawlersInsideDome(e, allBrawlers);

  for (const b of inside) {
    if (!b.alive) continue;
    const isAlly = b.team === e.ownerTeam;

    if (isAlly) {
      if (e.luminaGraceAllies) {
        b.grantTempShield(200, 0.5, 200);
      }
      continue;
    }

    if (!e.cagePrisoners.includes(b.id)) {
      e.cagePrisoners.push(b.id);
    }

    b.addStatus("slow", 0.55, 0.5);

    const dx = b.x - e.x;
    const dy = b.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const maxR = Math.max(b.radius + 2, e.radius - b.radius * 0.4);
    if (d > maxR) {
      b.x = e.x + (dx / d) * maxR;
      b.y = e.y + (dy / d) * maxR;
    }
  }

  for (const b of allBrawlers) {
    if (!b.alive || b.team === e.ownerTeam || !e.cagePrisoners.includes(b.id)) continue;
    const dx = b.x - e.x;
    const dy = b.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const maxR = Math.max(b.radius + 2, e.radius - b.radius * 0.4);
    if (d > maxR) {
      b.x = e.x + (dx / d) * maxR;
      b.y = e.y + (dy / d) * maxR;
    }
  }
}

export function clampLuminaLinkPositions(allBrawlers: Brawler[]): void {
  for (const link of links) {
    if (link.remaining <= 0) continue;
    const a = findBrawler(allBrawlers, link.aId);
    const b = findBrawler(allBrawlers, link.bId);
    if (!a || !b || !a.alive || !b.alive) continue;
    enforceLinkDistance(a, b, link.maxDist);
  }
}

function syncLuminaChainEffects(allBrawlers: Brawler[], activeEffects: Effect[]): void {
  for (const e of activeEffects) {
    if (e.kind !== "luminaChain" || !e.linkAId || !e.linkBId) continue;
    const a = findBrawler(allBrawlers, e.linkAId);
    const b = findBrawler(allBrawlers, e.linkBId);
    if (!a || !b || !a.alive || !b.alive) {
      e.timer = Math.min(e.timer, 0.05);
      continue;
    }
    e.x = a.x;
    e.y = a.y;
    e.toX = b.x;
    e.toY = b.y;
  }
}

export function updateLuminaMechanics(
  dt: number,
  allBrawlers: Brawler[],
  activeEffects: Effect[],
  _mapW: number,
  _mapH: number,
  _tileGrid?: TileGrid,
): void {
  for (const e of activeEffects) {
    if (e.kind === "luminaDome") {
      applyLuminaDomeContainment(e, allBrawlers);
    }
  }

  syncLuminaChainEffects(allBrawlers, activeEffects);

  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i];
    link.remaining -= dt;
    link.breakCdA -= dt;
    link.breakCdB -= dt;

    const a = findBrawler(allBrawlers, link.aId);
    const b = findBrawler(allBrawlers, link.bId);
    const owner = findBrawler(allBrawlers, link.ownerId) ?? null;

    if (!a || !b || !a.alive || !b.alive || link.remaining <= 0) {
      if (link.hasStar6 && a && b && (!a.alive || !b.alive)) {
        triggerLuminaJusticeExplosion(link.ownerId, allBrawlers, activeEffects);
      }
      links.splice(i, 1);
      continue;
    }

    a.takeDamage(link.dps * dt, owner, { suppressSuperCharge: true, suppressScreenFlash: true });
    b.takeDamage(link.dps * dt, owner, { suppressSuperCharge: true, suppressScreenFlash: true });

    enforceLinkDistance(a, b, link.maxDist);

    if (link.breakDamage > 0) {
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > link.maxDist * 1.02) {
        if (link.breakCdA <= 0) {
          a.takeDamage(link.breakDamage, owner);
          link.breakCdA = 0.85;
        }
        if (link.breakCdB <= 0) {
          b.takeDamage(link.breakDamage, owner);
          link.breakCdB = 0.85;
        }
      }
    }

    enforceLinkDistance(a, b, link.maxDist);
  }

  clampLuminaLinkPositions(allBrawlers);

  for (const e of activeEffects) {
    if (e.kind === "luminaDome") {
      applyLuminaDomeContainment(e, allBrawlers);
    }
  }
}

export function findLuminaChainTarget(
  first: Brawler,
  allBrawlers: Brawler[],
  ownerTeam: string,
): Brawler | null {
  let second: Brawler | null = null;
  let bestD = LUMINA_CHAIN_SEARCH + 1;
  for (const b of allBrawlers) {
    if (!b.alive || b.id === first.id || b.team === ownerTeam) continue;
    const d = distance(first.x, first.y, b.x, b.y);
    if (d <= LUMINA_CHAIN_SEARCH && d < bestD) {
      bestD = d;
      second = b;
    }
  }
  return second;
}
