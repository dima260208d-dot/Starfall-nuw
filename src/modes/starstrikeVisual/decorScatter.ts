import * as THREE from "three";

/** Случайные декоративные меши по сетке — только визуал, без коллизий. */
export function scatterDecor(
  group: THREE.Group,
  mapW: number,
  mapH: number,
  cell: number,
  count: number,
  rng: () => number = Math.random,
): void {
  const geo = new THREE.DodecahedronGeometry(cell * 0.22, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6d7a88,
    roughness: 0.85,
    metalness: 0.05,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const cols = Math.max(1, Math.floor(mapW / cell));
  const rows = Math.max(1, Math.floor(mapH / cell));
  for (let i = 0; i < count; i++) {
    const cx = Math.floor(rng() * cols);
    const cy = Math.floor(rng() * rows);
    const m = new THREE.Mesh(geo, mat);
    const wx = cx * cell + cell * 0.5;
    const wz = cy * cell + cell * 0.5;
    m.position.set(wx, cell * 0.15, wz);
    m.rotation.set(rng() * 0.4, rng() * Math.PI * 2, rng() * 0.3);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
}
