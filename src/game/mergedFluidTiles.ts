/**
 * Per-cell merged tiles (water): neighbours blend into one shape,
 * outer edges get a rim and rounded corners.
 */
import * as THREE from "three";

export interface MergedFluidStyle {
  rimColor: number;
  bodyColor: number;
  bodyEmissive: number;
  bodyEmissiveIntensity: number;
}

export const WATER_FLUID_STYLE: MergedFluidStyle = {
  rimColor: 0xbfe3ff,
  bodyColor: 0x1976d2,
  bodyEmissive: 0x0a3550,
  bodyEmissiveIntensity: 0.25,
};

export function buildMergedFluidMeshes(
  scene: THREE.Scene,
  cells: { tx: number; ty: number }[],
  cellSize: number,
  style: MergedFluidStyle,
  bodyStore: THREE.Mesh[],
  instancedStore: THREE.InstancedMesh[],
): void {
  if (cells.length === 0) return;

  const key = (tx: number, ty: number) => ty * 100000 + tx;
  const cellSet = new Set<number>();
  for (const c of cells) cellSet.add(key(c.tx, c.ty));
  const isSame = (tx: number, ty: number) => cellSet.has(key(tx, ty));

  const RIM_THICK = cellSize * 0.14;
  const RIM_Y = 0.06;
  const BODY_Y = 0.12;

  const rimGeom = new THREE.PlaneGeometry(cellSize, cellSize);
  rimGeom.rotateX(-Math.PI / 2);
  const rimMat = new THREE.MeshBasicMaterial({ color: style.rimColor });
  const rimInst = new THREE.InstancedMesh(rimGeom, rimMat, cells.length);
  const dummy = new THREE.Object3D();
  cells.forEach((c, i) => {
    dummy.position.set((c.tx + 0.5) * cellSize, RIM_Y, (c.ty + 0.5) * cellSize);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    rimInst.setMatrixAt(i, dummy.matrix);
  });
  rimInst.instanceMatrix.needsUpdate = true;
  rimInst.receiveShadow = true;
  rimInst.castShadow = true;
  scene.add(rimInst);
  instancedStore.push(rimInst);

  const bodyMat = new THREE.MeshLambertMaterial({
    color: style.bodyColor,
    emissive: style.bodyEmissive,
    emissiveIntensity: style.bodyEmissiveIntensity,
  });

  for (const c of cells) {
    const N = isSame(c.tx, c.ty - 1);
    const E = isSame(c.tx + 1, c.ty);
    const S = isSame(c.tx, c.ty + 1);
    const W = isSame(c.tx - 1, c.ty);

    const insetN = N ? 0 : RIM_THICK;
    const insetE = E ? 0 : RIM_THICK;
    const insetS = S ? 0 : RIM_THICK;
    const insetW = W ? 0 : RIM_THICK;

    const xL = -cellSize / 2 + insetW;
    const xR = cellSize / 2 - insetE;
    const yT = cellSize / 2 - insetN;
    const yB = -cellSize / 2 + insetS;

    const NWconvex = !N && !W;
    const NEconvex = !N && !E;
    const SEconvex = !S && !E;
    const SWconvex = !S && !W;

    const shape = new THREE.Shape();
    if (NWconvex) shape.moveTo(xL + RIM_THICK, yT);
    else shape.moveTo(xL, yT);

    if (NEconvex) {
      shape.lineTo(xR - RIM_THICK, yT);
      shape.quadraticCurveTo(xR, yT, xR, yT - RIM_THICK);
    } else {
      shape.lineTo(xR, yT);
    }

    if (SEconvex) {
      shape.lineTo(xR, yB + RIM_THICK);
      shape.quadraticCurveTo(xR, yB, xR - RIM_THICK, yB);
    } else {
      shape.lineTo(xR, yB);
    }

    if (SWconvex) {
      shape.lineTo(xL + RIM_THICK, yB);
      shape.quadraticCurveTo(xL, yB, xL, yB + RIM_THICK);
    } else {
      shape.lineTo(xL, yB);
    }

    if (NWconvex) {
      shape.lineTo(xL, yT - RIM_THICK);
      shape.quadraticCurveTo(xL, yT, xL + RIM_THICK, yT);
    } else {
      shape.lineTo(xL, yT);
    }

    const bodyGeom = new THREE.ShapeGeometry(shape, 8);
    bodyGeom.rotateX(-Math.PI / 2);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.set((c.tx + 0.5) * cellSize, BODY_Y, (c.ty + 0.5) * cellSize);
    body.receiveShadow = true;
    body.castShadow = true;
    scene.add(body);
    bodyStore.push(body);
  }
}
