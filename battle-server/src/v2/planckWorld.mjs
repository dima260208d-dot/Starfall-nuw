/**
 * Planck.js wall physics — server-side movement validation (mirrors client planckWorld.ts).
 */
import planck from "planck-js";

const TILE_WALL = 1;

export class PlanckBattleWorld {
  constructor() {
    this.world = planck.World({ gravity: planck.Vec2(0, 0) });
    this.walls = [];
    this.entities = new Map();
  }

  /** @param {{ grid: number[][], cell: number, n: number } | null} map */
  loadFromNetMap(map) {
    for (const w of this.walls) this.world.destroyBody(w);
    this.walls = [];
    if (!map?.grid?.length) return;
    const C = map.cell || 120;
    const n = map.n || map.grid.length;
    for (let ty = 0; ty < n; ty++) {
      for (let tx = 0; tx < n; tx++) {
        const t = map.grid[ty]?.[tx] ?? 0;
        if (t !== TILE_WALL) continue;
        const body = this.world.createBody({
          type: "static",
          position: planck.Vec2(tx * C + C / 2, ty * C + C / 2),
        });
        body.createFixture(planck.Box(C / 2, C / 2), { friction: 0 });
        this.walls.push(body);
      }
    }
  }

  ensureUnit(id, x, y, radius) {
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

  applyInput(id, mx, my, speed, dt) {
    const e = this.entities.get(id);
    if (!e) return;
    const len = Math.hypot(mx, my);
    if (len < 0.01) {
      e.body.setLinearVelocity(planck.Vec2(0, 0));
      return;
    }
    e.body.setLinearVelocity(planck.Vec2((mx / len) * speed, (my / len) * speed));
  }

  step(dt) {
    this.world.step(dt, 8, 3);
  }

  syncFromServer(id, x, y, vx = 0, vy = 0) {
    const e = this.entities.get(id);
    if (!e) return;
    e.body.setTransform(planck.Vec2(x, y), e.body.getAngle());
    e.body.setLinearVelocity(planck.Vec2(vx, vy));
  }

  getPosition(id) {
    const e = this.entities.get(id);
    if (!e) return null;
    const p = e.body.getPosition();
    return { x: p.x, y: p.y };
  }

  destroy() {
    for (const e of this.entities.values()) this.world.destroyBody(e.body);
    for (const w of this.walls) this.world.destroyBody(w);
    this.entities.clear();
    this.walls = [];
  }
}
