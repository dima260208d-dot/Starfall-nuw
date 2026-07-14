/**
 * Planck.js battle physics — server authority mirror on client.
 */
import planck from "planck-js";
import type { TileGrid } from "../game/TileMap";
import { TileType } from "../game/TileMap";

export type PlanckEntity = {
  body: planck.Body;
  unitId: string;
  radius: number;
};

export class PlanckBattleWorld {
  world: planck.World;
  walls: planck.Body[] = [];
  entities = new Map<string, PlanckEntity>();

  constructor() {
    this.world = planck.World({ gravity: planck.Vec2(0, 0) });
  }

  loadTileGrid(grid: TileGrid): void {
    for (const w of this.walls) this.world.destroyBody(w);
    this.walls = [];
    const C = grid.cellSize;
    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        const t = grid.cells[ty * grid.width + tx];
        if (t !== TileType.WALL && t !== TileType.MOUNTAIN) continue;
        const body = this.world.createBody({ type: "static", position: planck.Vec2(tx * C + C / 2, ty * C + C / 2) });
        body.createFixture(planck.Box(C / 2, C / 2), { friction: 0 });
        this.walls.push(body);
      }
    }
  }

  ensureUnit(id: string, x: number, y: number, radius: number): PlanckEntity {
    let e = this.entities.get(id);
    if (!e) {
      const body = this.world.createBody({
        type: "dynamic",
        position: planck.Vec2(x, y),
        bullet: true,
      });
      body.createFixture(planck.Circle(radius), { density: 1, friction: 0, restitution: 0 });
      body.setLinearDamping(8);
      e = { body, unitId: id, radius };
      this.entities.set(id, e);
    }
    return e;
  }

  applyInput(id: string, mx: number, my: number, speed: number, dt: number): void {
    const e = this.entities.get(id);
    if (!e) return;
    const len = Math.hypot(mx, my);
    if (len < 0.01) {
      e.body.setLinearVelocity(planck.Vec2(0, 0));
      return;
    }
    const vx = (mx / len) * speed;
    const vy = (my / len) * speed;
    e.body.setLinearVelocity(planck.Vec2(vx, vy));
  }

  step(dt: number): void {
    this.world.step(dt, 8, 3);
  }

  syncFromServer(id: string, x: number, y: number, vx = 0, vy = 0): void {
    const e = this.entities.get(id);
    if (!e) return;
    e.body.setTransform(planck.Vec2(x, y), e.body.getAngle());
    e.body.setLinearVelocity(planck.Vec2(vx, vy));
  }

  getPosition(id: string): { x: number; y: number } | null {
    const e = this.entities.get(id);
    if (!e) return null;
    const p = e.body.getPosition();
    return { x: p.x, y: p.y };
  }

  destroy(): void {
    for (const e of this.entities.values()) this.world.destroyBody(e.body);
    for (const w of this.walls) this.world.destroyBody(w);
    this.entities.clear();
    this.walls = [];
  }
}
