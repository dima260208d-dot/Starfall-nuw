import * as THREE from "three";
import { getSafeGLBTemplate, loadSafeGLBTemplate } from "../utils/powerModelCache";

export interface Battle3DSafe {
  id: string;
  x: number;
  y: number;
  team: "blue" | "red";
  hp: number;
  maxHp: number;
  size?: number;
}

interface SafeMeshEntry {
  safeId: string;
  pivot: THREE.Group;
  teamRing: THREE.Mesh;
  teamRingMat: THREE.MeshBasicMaterial;
  lastHpRatio: number;
}

const entries = new Map<string, SafeMeshEntry>();
let templateRequested = false;

function buildNormalizedSafeInstance(
  template: THREE.Object3D,
  targetXZ: number,
  parent: THREE.Group,
): void {
  const inst = template.clone(true);
  const box0 = new THREE.Box3().setFromObject(inst);
  const size0 = box0.getSize(new THREE.Vector3());
  const center0 = box0.getCenter(new THREE.Vector3());
  const maxXZ = Math.max(size0.x, size0.z) || 1;
  const s = targetXZ / maxXZ;
  inst.position.set(-center0.x * s, -box0.min.y * s, -center0.z * s);
  inst.scale.setScalar(s);
  inst.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
  });
  parent.add(inst);
}

function makeTeamRing(radius: number, team: "blue" | "red"): { ring: THREE.Mesh; mat: THREE.MeshBasicMaterial } {
  const ringGeom = new THREE.RingGeometry(radius * 1.05, radius * 1.14, 40);
  ringGeom.rotateX(-Math.PI / 2);
  const color = team === "blue" ? 0x2196f3 : 0xf44336;
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeom, mat);
  ring.position.y = 0.55;
  ring.renderOrder = 5;
  return { ring, mat };
}

function applyHpOpacity(pivot: THREE.Group, hpRatio: number): void {
  const alpha = hpRatio < 0.25 ? 0.55 : 1;
  pivot.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const lm = mat as THREE.MeshLambertMaterial;
      if (!lm) continue;
      lm.transparent = alpha < 1;
      lm.opacity = alpha;
    }
  });
}

function removeEntry(id: string, entry: SafeMeshEntry, scene: THREE.Scene): void {
  scene.remove(entry.pivot);
  scene.remove(entry.teamRing);
  entry.pivot.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
  (entry.teamRing.material as THREE.Material).dispose();
  entry.teamRing.geometry.dispose();
  entries.delete(id);
}

export function syncBattle3DSafes(
  scene: THREE.Scene | null,
  safes: readonly Battle3DSafe[] | undefined,
  viewerTeam?: string,
): void {
  if (!scene) return;

  if (!templateRequested) {
    templateRequested = true;
    void loadSafeGLBTemplate();
  }

  const template = getSafeGLBTemplate();
  const alive = new Set<string>();

  if (safes?.length) {
    if (!template) {
      void loadSafeGLBTemplate();
    } else {
      for (const s of safes) {
        if (s.hp <= 0) continue;
        alive.add(s.id);

        let entry = entries.get(s.id);
        if (!entry) {
          const pivot = new THREE.Group();
          const baseSize = s.size ?? 100;
          const scaleMul = baseSize >= 115 ? 2.2 : 2.1;
          buildNormalizedSafeInstance(template, baseSize * scaleMul, pivot);

          const ringR = baseSize * 0.52;
          const { ring, mat } = makeTeamRing(ringR, s.team);
          scene.add(pivot);
          scene.add(ring);

          entry = {
            safeId: s.id,
            pivot,
            teamRing: ring,
            teamRingMat: mat,
            lastHpRatio: -1,
          };
          entries.set(s.id, entry);
        }

        const hpRatio = Math.max(0, Math.min(1, s.hp / s.maxHp));
        entry.pivot.position.set(s.x, 0, s.y);
        entry.teamRing.position.set(s.x, 0.55, s.y);

        const ringColor = viewerTeam !== undefined
          ? (s.team === viewerTeam ? 0x2196f3 : 0xf44336)
          : (s.team === "blue" ? 0x2196f3 : 0xf44336);
        if (entry.teamRingMat.color.getHex() !== ringColor) {
          entry.teamRingMat.color.setHex(ringColor);
        }

        if (Math.abs(entry.lastHpRatio - hpRatio) > 0.01) {
          applyHpOpacity(entry.pivot, hpRatio);
          entry.lastHpRatio = hpRatio;
        }
      }
    }
  }

  for (const [id, entry] of entries) {
    if (alive.has(id)) continue;
    removeEntry(id, entry, scene);
  }
}

export function disposeBattle3DSafes(scene: THREE.Scene | null): void {
  templateRequested = false;
  if (!scene) {
    entries.clear();
    return;
  }
  for (const [id, entry] of [...entries]) removeEntry(id, entry, scene);
}