import * as THREE from "three";

/**
 * Базовый наклон «земли» для боя (значения по умолчанию для релиза).
 * В рантайме позиция камеры и lookAt берутся из плавно интерполируемого состояния
 * (`setBattleGroundViewSliderTarget01` / `tickBattleGroundViewSmooth`).
 */
export const BATTLE_GROUND_CAM_Y = 6;
export const BATTLE_GROUND_CAM_Z = 6;
export const BATTLE_GROUND_LOOK_Y = 1.5;

/** Дистанция камеры в плоскости Y–Z от начала координат (как у дефолта 6,6). */
const CAM_DISTANCE = Math.hypot(BATTLE_GROUND_CAM_Y, BATTLE_GROUND_CAM_Z);

let curCamY = BATTLE_GROUND_CAM_Y;
let curCamZ = BATTLE_GROUND_CAM_Z;
let curLookY = BATTLE_GROUND_LOOK_Y;

let tgtCamY = BATTLE_GROUND_CAM_Y;
let tgtCamZ = BATTLE_GROUND_CAM_Z;
let tgtLookY = BATTLE_GROUND_LOOK_Y;

/** Целевое значение ползунка 0…1 (центр = текущий «продакшен»-угол). */
let targetSlider01 = 0.5;

/** Последний ключ для пересборки GLB-тайлов / платформы (округление уменьшает дрожь). */
let lastBakeKey = "";

function slider01ToTargets(t: number): { camY: number; camZ: number; lookY: number } {
  const u = Math.max(0, Math.min(1, t));
  const k = (u - 0.5) * 2;
  const camY = BATTLE_GROUND_CAM_Y + k * 2.5;
  const camZ = BATTLE_GROUND_CAM_Z - k * 2.5;
  const lookY = BATTLE_GROUND_LOOK_Y + k * 0.35;
  return { camY, camZ, lookY };
}

/** Установить цель ползунка 0…1 (0 = более «сверху», 1 = более крутой к горизонту). */
export function setBattleGroundViewSliderTarget01(t: number): void {
  targetSlider01 = Math.max(0, Math.min(1, t));
  const p = slider01ToTargets(targetSlider01);
  tgtCamY = p.camY;
  tgtCamZ = p.camZ;
  tgtLookY = p.lookY;
}

export function getBattleGroundViewSliderTarget01(): number {
  return targetSlider01;
}

/** Текущие сглаженные параметры (для копирования в константы / отладки). */
export function getBattleGroundViewSnapshot(): { camY: number; camZ: number; lookY: number; slider01: number } {
  return { camY: curCamY, camZ: curCamZ, lookY: curLookY, slider01: targetSlider01 };
}

export type BattleGroundRebakeFn = () => void;

/**
 * Сглаживание к цели. При заметном изменении округлённых параметров вызывает `onRebake`
 * (инвалидация кэшей тайлов / платформы и повторная загрузка).
 */
export function tickBattleGroundViewSmooth(dt: number, onRebake?: BattleGroundRebakeFn): void {
  const k = 1 - Math.exp(-Math.min(dt, 0.08) * 14);
  curCamY += (tgtCamY - curCamY) * k;
  curCamZ += (tgtCamZ - curCamZ) * k;
  curLookY += (tgtLookY - curLookY) * k;

  const key = [curCamY, curCamZ, curLookY].map((v) => v.toFixed(2)).join(",");
  if (key !== lastBakeKey) {
    lastBakeKey = key;
    onRebake?.();
  }
}

/** Вернуть продакшен-дефолт и сбросить ключ пересборки (выход из тренировки / старт любого боя). */
export function resetBattleGroundViewToProductionDefaults(): void {
  targetSlider01 = 0.5;
  curCamY = tgtCamY = BATTLE_GROUND_CAM_Y;
  curCamZ = tgtCamZ = BATTLE_GROUND_CAM_Z;
  curLookY = tgtLookY = BATTLE_GROUND_LOOK_Y;
  lastBakeKey = "";
}

export function applyBattleGroundCameraOrientation(cam: THREE.Camera): void {
  cam.position.set(0, curCamY, curCamZ);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, curLookY, 0);
}

/** Камера персонажа в CharacterTopDownRenderer (512×512, один боец). */
export function configureCharacterBattleOrtho(cam: THREE.OrthographicCamera): void {
  cam.left = -1.8;
  cam.right = 1.8;
  cam.top = 2.1;
  cam.bottom = -1.5;
  cam.near = 0.1;
  cam.far = 30;
  applyBattleGroundCameraOrientation(cam);
  cam.updateProjectionMatrix();
}

/**
 * Камера атласа тайла: широкий frustum, тот же луч взгляда, что у бойцов.
 * @param halfX / halfY — как в tileModelCache (несимметричный frustum под высоту тайла).
 */
export function configureTileAtlasBattleOrtho(
  cam: THREE.OrthographicCamera,
  halfX: number,
  halfY: number,
): void {
  cam.left = -halfX;
  cam.right = halfX;
  cam.top = halfY;
  cam.bottom = -halfY;
  cam.near = 0.1;
  cam.far = 200;
  applyBattleGroundCameraOrientation(cam);
  cam.updateProjectionMatrix();
}

/** Квадратный ortho (power box, мяч и т.п.) с тем же направлением взгляда. */
export function configureSquareBattleOrtho(cam: THREE.OrthographicCamera, half: number): void {
  cam.left = -half;
  cam.right = half;
  cam.top = half;
  cam.bottom = -half;
  cam.near = 0.1;
  cam.far = 200;
  applyBattleGroundCameraOrientation(cam);
  cam.updateProjectionMatrix();
}
