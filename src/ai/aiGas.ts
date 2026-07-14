/** Общая логика газа (Showdown / Mega) для ботов и автопилота. */

export interface GasZoneLike {
  centerX: number;
  centerY: number;
  /** Legacy / autoplay alias */
  radius?: number;
  /** Реальный радиус safe-зоны (для режимов с круговой зоной) */
  safeRadius?: number;
  /**
   * Half-extent квадратной safe-зоны (в px). Если задан — газ считается
   * квадратным: всё за пределами квадрата [cx±halfSize, cy±halfSize] = газ.
   */
  safeHalfSize?: number;
}

function isSquare(gas: GasZoneLike): boolean {
  return typeof gas.safeHalfSize === "number" && gas.safeHalfSize > 0;
}

export function gasSafeRadius(gas: GasZoneLike | null | undefined): number {
  if (!gas) return 0;
  if (isSquare(gas)) return gas.safeHalfSize!;
  return gas.safeRadius ?? gas.radius ?? 0;
}

/** >0 — игрок ВНУТРИ safe-зоны, <=0 — снаружи (в газе). */
export function playerGasEdgeMargin(px: number, py: number, gas: GasZoneLike): number {
  if (isSquare(gas)) {
    const half = gas.safeHalfSize!;
    const dx = Math.abs(px - gas.centerX);
    const dy = Math.abs(py - gas.centerY);
    return half - Math.max(dx, dy);
  }
  const safe = gas.safeRadius ?? gas.radius ?? 0;
  if (safe <= 0) return -9999;
  const d = Math.hypot(px - gas.centerX, py - gas.centerY);
  return safe - d;
}

export function isInGasDanger(px: number, py: number, gas: GasZoneLike, buffer = 200): boolean {
  return playerGasEdgeMargin(px, py, gas) < buffer;
}

/** Точка внутри safe-зоны (направление от края газа к центру). */
export function gasFleePoint(px: number, py: number, gas: GasZoneLike, buffer = 200): { x: number; y: number } {
  if (isSquare(gas)) {
    const half = gas.safeHalfSize!;
    const inner = Math.max(60, half - buffer - 100);
    // Тянем точку к ближайшей грани квадрата → внутрь.
    const dx = px - gas.centerX;
    const dy = py - gas.centerY;
    const cx = Math.max(-inner, Math.min(inner, dx));
    const cy = Math.max(-inner, Math.min(inner, dy));
    return { x: gas.centerX + cx, y: gas.centerY + cy };
  }
  const safe = gas.safeRadius ?? gas.radius ?? 0;
  const angle = Math.atan2(py - gas.centerY, px - gas.centerX);
  const targetR = Math.max(80, safe - buffer - 100);
  return {
    x: gas.centerX + Math.cos(angle) * targetR,
    y: gas.centerY + Math.sin(angle) * targetR,
  };
}
