export class Camera {
  x: number;
  y: number;
  width: number;
  height: number;
  mapWidth: number;
  mapHeight: number;

  constructor(width: number, height: number, mapWidth: number, mapHeight: number) {
    this.x = 0;
    this.y = 0;
    this.width = width;
    this.height = height;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
  }

  follow(targetX: number, targetY: number): void {
    this.x = targetX - this.width / 2;
    this.y = targetY - this.height / 2;
    this.x = Math.max(0, Math.min(this.mapWidth - this.width, this.x));
    this.y = Math.max(0, Math.min(this.mapHeight - this.height, this.y));
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx - this.x, y: wy - this.y };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx + this.x, y: sy + this.y };
  }
}
