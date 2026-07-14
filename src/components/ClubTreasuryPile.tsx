/**
 * 3D treasury pile — cannon-es, one falling coin per vault deposit.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { applyGLTFTexturePolicy } from "../utils/texturePolicy";
import {
  PILE_MAX_VISUAL,
  subscribeTreasuryDeposits,
  type TreasuryResource,
} from "../utils/clubTreasury";

const MODEL_URLS: Record<TreasuryResource, string> = {
  coins: "models/coin.glb",
  gems: "models/gem.glb",
  powerPoints: "models/powerpoint.glb",
};

const RIM_COLOR: Record<TreasuryResource, number> = {
  coins: 0xFFD700,
  gems: 0x40C4FF,
  powerPoints: 0xCE93D8,
};

const BODY_RADIUS: Record<TreasuryResource, number> = {
  coins: 0.31,
  gems: 0.27,
  powerPoints: 0.27,
};

const FLOOR_Y = -0.55;
const MOUND_RX = 4.7;
const MOUND_RZ = 3.1;
const SPAWN_Y = 4.6;
const CAMERA_LOOK_Y = 1.55;
const PHYSICS_GRAVITY = -11.5;
const SOLVER_ITERATIONS = 8;
const FLAT_FACE_MIN_Y = 0.78;
const SETTLE_SPEED = 0.32;
const SETTLE_ANG = 0.52;

const _faceLocal = new THREE.Vector3(0, 1, 0);
const _faceWorld = new THREE.Vector3();
const _flatQuat = new THREE.Quaternion();
const _flatEuler = new THREE.Euler();

interface PileEntry {
  mesh: THREE.Object3D;
  body: CANNON.Body;
  activated: boolean;
  inWorld: boolean;
  flatLocked: boolean;
}

interface Props {
  resource: TreasuryResource;
  visualCount: number;
  /** Не заполнять кучу при открытии (только падения по событиям). */
  skipSeed?: boolean;
}

function getPileFloorY(resource: TreasuryResource): number {
  return FLOOR_Y + BODY_RADIUS[resource] * 0.08;
}

function pileCap(visualCount: number): number {
  return Math.min(PILE_MAX_VISUAL, Math.max(0, visualCount));
}

function createFallbackTemplate(type: TreasuryResource): THREE.Group {
  const color = RIM_COLOR[type];
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.32 });
  const group = new THREE.Group();
  if (type === "coins") {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.11, 28), mat);
    mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
  } else if (type === "gems") {
    group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), mat));
  } else {
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), mat));
  }
  return group;
}

function normalizeTemplate(template: THREE.Object3D, renderer: THREE.WebGLRenderer | null): void {
  const box = new THREE.Box3().setFromObject(template);
  const sz = new THREE.Vector3();
  box.getSize(sz);
  const maxDim = Math.max(sz.x, sz.y, sz.z) || 1;
  template.scale.setScalar(0.62 / maxDim);
  template.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    mats.forEach((mat: THREE.Material) => {
      mat.side = THREE.DoubleSide;
      mat.needsUpdate = true;
    });
  });
  if (renderer) applyGLTFTexturePolicy(template, renderer);
}

function spawnXZ(): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const ring = Math.random() < 0.55
    ? Math.sqrt(Math.random()) * 0.42
    : Math.sqrt(Math.random());
  return {
    x: Math.cos(angle) * MOUND_RX * ring,
    z: Math.sin(angle) * MOUND_RZ * ring,
  };
}

function createPhysicsWorld(resource: TreasuryResource): { world: CANNON.World; coinMaterial: CANNON.Material } {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, PHYSICS_GRAVITY, 0),
    allowSleep: true,
  });
  world.broadphase = new CANNON.SAPBroadphase(world);
  (world.broadphase as CANNON.SAPBroadphase).axisIndex = 1;

  const solver = world.solver as CANNON.GSSolver;
  solver.iterations = SOLVER_ITERATIONS;
  solver.tolerance = 0.001;

  const coinMaterial = new CANNON.Material("coin");
  world.addContactMaterial(new CANNON.ContactMaterial(coinMaterial, coinMaterial, {
    friction: 0.82,
    restitution: 0.34,
    contactEquationStiffness: 1e7,
    contactEquationRelaxation: 3,
    frictionEquationStiffness: 1e7,
    frictionEquationRelaxation: 3,
  }));

  const radius = BODY_RADIUS[resource];
  const floorCenterY = getPileFloorY(resource) - radius;

  const ground = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
  });
  ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  ground.position.y = floorCenterY;
  world.addBody(ground);

  const wallH = 14;
  const wallT = 0.4;
  const addWall = (x: number, z: number, halfX: number, halfZ: number) => {
    const wall = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(halfX, wallH, halfZ)),
    });
    wall.position.set(x, floorCenterY + wallH, z);
    world.addBody(wall);
  };
  addWall(MOUND_RX + wallT, 0, wallT, MOUND_RZ + wallT);
  addWall(-MOUND_RX - wallT, 0, wallT, MOUND_RZ + wallT);
  addWall(0, MOUND_RZ + wallT, MOUND_RX + wallT, wallT);
  addWall(0, -MOUND_RZ - wallT, MOUND_RX + wallT, wallT);

  return { world, coinMaterial };
}

function createCoinBody(resource: TreasuryResource, material: CANNON.Material): CANNON.Body {
  return new CANNON.Body({
    mass: 1,
    material,
    shape: new CANNON.Sphere(BODY_RADIUS[resource]),
    linearDamping: 0.12,
    angularDamping: 0.34,
    allowSleep: true,
    sleepSpeedLimit: 0.18,
    sleepTimeLimit: 0.22,
  });
}

function syncMesh(entry: PileEntry): void {
  const { x, y, z } = entry.body.position;
  entry.mesh.position.set(x, y, z);
  const q = entry.body.quaternion;
  entry.mesh.quaternion.set(q.x, q.y, q.z, q.w);
}

function coinFaceWorldY(body: CANNON.Body): number {
  const q = body.quaternion;
  _faceWorld.copy(_faceLocal).applyQuaternion(
    new THREE.Quaternion(q.x, q.y, q.z, q.w),
  );
  return Math.abs(_faceWorld.y);
}

function isCoinFlat(body: CANNON.Body): boolean {
  return coinFaceWorldY(body) >= FLAT_FACE_MIN_Y;
}

function snapCoinFlat(body: CANNON.Body): void {
  _flatEuler.set(Math.PI / 2, Math.random() * Math.PI * 2, 0);
  _flatQuat.setFromEuler(_flatEuler);
  body.quaternion.set(_flatQuat.x, _flatQuat.y, _flatQuat.z, _flatQuat.w);
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
}

function hasNeighborSupport(
  entry: PileEntry,
  entries: PileEntry[],
  resource: TreasuryResource,
): boolean {
  const r = BODY_RADIUS[resource] * 1.75;
  const r2 = r * r;
  const py = entry.body.position.y;
  for (const other of entries) {
    if (other === entry || !other.inWorld) continue;
    const dy = other.body.position.y - py;
    if (dy < -0.04 || dy > r * 1.6) continue;
    const dx = other.body.position.x - entry.body.position.x;
    const dz = other.body.position.z - entry.body.position.z;
    if (dx * dx + dz * dz <= r2) return true;
  }
  return false;
}

function isSettling(entry: PileEntry): boolean {
  const speed = entry.body.velocity.length();
  const ang = entry.body.angularVelocity.length();
  return entry.body.sleepState === CANNON.Body.SLEEPING
    || (speed < SETTLE_SPEED && ang < SETTLE_ANG);
}

function unlockIfAwake(entry: PileEntry): void {
  if (!entry.flatLocked) return;
  const speed = entry.body.velocity.length();
  const ang = entry.body.angularVelocity.length();
  if (
    entry.body.sleepState !== CANNON.Body.SLEEPING
    && (speed > SETTLE_SPEED * 1.4 || ang > SETTLE_ANG * 1.3)
  ) {
    entry.flatLocked = false;
    entry.body.fixedRotation = false;
  }
}

function stabilizeCoinOrientation(
  entries: PileEntry[],
  resource: TreasuryResource,
): void {
  if (resource !== "coins") return;

  for (const entry of entries) {
    if (!entry.activated || !entry.inWorld) continue;

    unlockIfAwake(entry);
    if (entry.flatLocked) continue;
    if (!isSettling(entry)) continue;

    if (isCoinFlat(entry.body)) {
      entry.body.angularVelocity.set(0, 0, 0);
      entry.body.fixedRotation = true;
      entry.flatLocked = true;
      if (entry.body.sleepState !== CANNON.Body.SLEEPING) entry.body.sleep();
      continue;
    }

    if (hasNeighborSupport(entry, entries, resource)) {
      entry.body.angularVelocity.set(0, 0, 0);
      entry.body.fixedRotation = true;
      entry.flatLocked = true;
      if (entry.body.sleepState !== CANNON.Body.SLEEPING) entry.body.sleep();
      continue;
    }

    snapCoinFlat(entry.body);
    entry.body.fixedRotation = true;
    entry.flatLocked = true;
    entry.body.sleep();
  }
}

function createEntry(
  template: THREE.Object3D,
  pileGroup: THREE.Group,
  resource: TreasuryResource,
  coinMaterial: CANNON.Material,
): PileEntry {
  const mesh = template.clone(true);
  mesh.visible = false;
  pileGroup.add(mesh);
  return {
    mesh,
    body: createCoinBody(resource, coinMaterial),
    activated: false,
    inWorld: false,
    flatLocked: false,
  };
}

function placeSettled(
  entry: PileEntry,
  world: CANNON.World,
  resource: TreasuryResource,
  index: number,
  total: number,
): void {
  const { x, z } = spawnXZ();
  const pileH = Math.min(3.2, total * 0.004);
  const y = getPileFloorY(resource)
    + (index / Math.max(1, total)) * 0.35
    + Math.random() * pileH;

  entry.body.position.set(x, y, z);
  entry.body.velocity.set(0, 0, 0);
  entry.body.angularVelocity.set(0, 0, 0);
  entry.body.quaternion.setFromEuler(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
  );
  entry.body.sleep();

  if (!entry.inWorld) {
    world.addBody(entry.body);
    entry.inWorld = true;
  }

  entry.activated = true;
  entry.mesh.visible = true;
  if (resource === "coins") {
    snapCoinFlat(entry.body);
    entry.body.fixedRotation = true;
    entry.flatLocked = true;
  }
  syncMesh(entry);
}

function activateFalling(entry: PileEntry, world: CANNON.World): void {
  entry.flatLocked = false;
  entry.body.fixedRotation = false;
  const { x, z } = spawnXZ();
  entry.body.position.set(
    x + (Math.random() - 0.5) * 0.4,
    SPAWN_Y + Math.random() * 1.4,
    z + (Math.random() - 0.5) * 0.4,
  );
  entry.body.velocity.set(
    (Math.random() - 0.5) * 9.5,
    -(17.5 + Math.random() * 11),
    (Math.random() - 0.5) * 8,
  );
  entry.body.angularVelocity.set(
    (Math.random() - 0.5) * 7,
    (Math.random() - 0.5) * 7,
    (Math.random() - 0.5) * 7,
  );
  entry.body.quaternion.setFromEuler(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
  );
  entry.body.wakeUp();

  if (!entry.inWorld) {
    world.addBody(entry.body);
    entry.inWorld = true;
  }

  entry.activated = true;
  entry.mesh.visible = true;
  syncMesh(entry);
}

function disposeMesh(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => m?.dispose());
  });
}

function removeEntry(
  entry: PileEntry,
  pileGroup: THREE.Group,
  world: CANNON.World,
): void {
  if (entry.inWorld) world.removeBody(entry.body);
  pileGroup.remove(entry.mesh);
  disposeMesh(entry.mesh);
}

function clearEntries(entries: PileEntry[], pileGroup: THREE.Group, world: CANNON.World): void {
  while (entries.length > 0) {
    const entry = entries.pop()!;
    removeEntry(entry, pileGroup, world);
  }
}

function trimEntries(
  entries: PileEntry[],
  target: number,
  pileGroup: THREE.Group,
  world: CANNON.World,
): void {
  while (entries.length > target) {
    const entry = entries.pop()!;
    removeEntry(entry, pileGroup, world);
  }
}

function isSleeping(entry: PileEntry): boolean {
  return entry.body.sleepState === CANNON.Body.SLEEPING;
}

function needsPhysicsStep(entries: PileEntry[]): boolean {
  return entries.some((e) => e.activated && e.inWorld && !isSleeping(e));
}

export default function ClubTreasuryPile({ resource, visualCount, skipSeed = false }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const capRef = useRef(pileCap(visualCount));
  capRef.current = pileCap(visualCount);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let animId = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    const entries: PileEntry[] = [];
    let proto: THREE.Object3D | null = null;
    let pileGroup: THREE.Group | null = null;
    let seeded = false;
    let pendingDrops = 0;
    let lastCap = pileCap(visualCount);

    const { world, coinMaterial } = createPhysicsWorld(resource);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 120);
    camera.position.set(0, 2.35, 11.2);
    camera.lookAt(0, CAMERA_LOOK_Y, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 4.2);
    key.position.set(4, 12, 7);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xfff0cc, 1.5);
    fill.position.set(-5, 6, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(RIM_COLOR[resource], 1.2);
    rim.position.set(-3, 2, -5);
    scene.add(rim);

    pileGroup = new THREE.Group();
    scene.add(pileGroup);

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    mount.appendChild(canvas);

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
    } catch {
      canvas.remove();
      return;
    }

    const resize = () => {
      if (!renderer || disposed) return;
      const w = mount.clientWidth || 320;
      const h = mount.clientHeight || 320;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.setSize(w, h, false);
    };

    const ro = new ResizeObserver(() => {
      resize();
      renderer?.render(scene, camera);
    });
    ro.observe(mount);
    resize();

    const seedPile = () => {
      if (!proto || !pileGroup || seeded) return;
      if (skipSeed) {
        seeded = true;
        flushPendingDrops();
        return;
      }
      const target = capRef.current;
      if (target <= 0) {
        seeded = true;
        flushPendingDrops();
        return;
      }
      for (let i = 0; i < target; i++) {
        const entry = createEntry(proto, pileGroup, resource, coinMaterial);
        placeSettled(entry, world, resource, i, target);
        entries.push(entry);
      }
      seeded = true;
      flushPendingDrops();
    };

    const spawnFallingCoin = (): boolean => {
      if (!proto || !pileGroup || entries.length >= PILE_MAX_VISUAL) return false;

      const entry = createEntry(proto, pileGroup, resource, coinMaterial);
      entries.push(entry);
      activateFalling(entry, world);
      return true;
    };

    const dropOneCoin = () => {
      if (!proto || !pileGroup || !seeded) {
        pendingDrops += 1;
        return;
      }
      spawnFallingCoin();
    };

    const flushPendingDrops = () => {
      while (pendingDrops > 0) {
        pendingDrops -= 1;
        if (!spawnFallingCoin()) break;
      }
    };

    const unsubDeposit = subscribeTreasuryDeposits((event) => {
      if (disposed || event.resource !== resource) return;
      dropOneCoin();
    });

    const base = (import.meta as any).env?.BASE_URL ?? "/";
    const loader = new GLTFLoader();

    loader.load(
      `${base}${MODEL_URLS[resource]}`,
      (gltf) => {
        proto = gltf.scene.clone(true);
        normalizeTemplate(proto, renderer);
        seedPile();
      },
      undefined,
      () => {
        proto = createFallbackTemplate(resource);
        normalizeTemplate(proto, renderer);
        seedPile();
      },
    );

    const tick = () => {
      if (disposed) return;
      animId = requestAnimationFrame(tick);

      if (!proto || !pileGroup) {
        renderer?.render(scene, camera);
        return;
      }

      if (!seeded) seedPile();

      const cap = capRef.current;
      if (cap < lastCap) {
        trimEntries(entries, cap, pileGroup, world);
        lastCap = cap;
      } else if (cap > lastCap) {
        lastCap = cap;
      }
      if (entries.length > PILE_MAX_VISUAL) {
        trimEntries(entries, PILE_MAX_VISUAL, pileGroup, world);
      }

      if (needsPhysicsStep(entries)) {
        world.fixedStep();
        stabilizeCoinOrientation(entries, resource);
        for (const entry of entries) {
          if (entry.activated) syncMesh(entry);
        }
      } else {
        stabilizeCoinOrientation(entries, resource);
        for (const entry of entries) {
          if (entry.activated && entry.flatLocked) syncMesh(entry);
        }
      }

      renderer?.render(scene, camera);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      unsubDeposit();
      cancelAnimationFrame(animId);
      ro.disconnect();
      if (pileGroup) clearEntries(entries, pileGroup, world);
      renderer?.dispose();
      try { canvas.remove(); } catch { /* ignore */ }
    };
  }, [resource, skipSeed]);

  useEffect(() => {
    capRef.current = pileCap(visualCount);
  }, [visualCount, resource]);

  return (
    <div style={{ flex: 1, minHeight: 320, position: "relative", overflow: "hidden" }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
