import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { resolveHeavyAssetUrl } from "../lib/assetBase";
import { loadGLTFFromUrl } from "../utils/glbFetchCache";
import { applyGLTFTexturePolicy } from "../utils/texturePolicy";
import { playResourceBounceSfx } from "../audio/gameSfxService";

type ResourceType = "coins" | "gems" | "powerPoints";

const MODEL_URLS: Record<ResourceType, string> = {
  coins:       "models/coin.glb",
  gems:        "models/gem.glb",
  powerPoints: "models/powerpoint.glb",
};

const RIM_COLOR: Record<ResourceType, number> = {
  coins:       0xFFD700,
  gems:        0x40C4FF,
  powerPoints: 0xCE93D8,
};

const MAX_COUNT = 30;
const COIN_RADIUS = 0.28;
const FLOOR_Y = -1.6;
const WALL_X = 3.3;   // left/right wall
const WALL_Z = 1.8;   // front/back wall
const GRAVITY = -0.048;
const BOUNCE = 0.44;
const WALL_BOUNCE = 0.38;
const FRICTION = 0.86;

interface Particle {
  obj: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  axis: THREE.Vector3;
  rotSpeed: number;
  delay: number;
  settled: boolean;
  bounceCooldown: number;
  sfxPlayed: boolean;
}

interface Props {
  type: ResourceType;
  amount: number;
  onAllSettled?: () => void;
}

function createFallbackTemplate(type: ResourceType): THREE.Group {
  const color = type === "coins" ? 0xFFD700 : type === "gems" ? 0x40C4FF : 0xCE93D8;
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.35 });
  const group = new THREE.Group();
  if (type === "coins") {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.12, 28), mat);
    mesh.rotation.x = Math.PI / 2;
    group.add(mesh);
  } else if (type === "gems") {
    group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.44, 0), mat));
  } else {
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat));
  }
  return group;
}

export default function ChestItemScene({ type, amount, onAllSettled }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    notifiedRef.current = false;
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth || 600;
    const H = mount.clientHeight || 400;

    let animId = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, W / H, 0.01, 200);
    camera.position.set(0, 2.5, 9);
    camera.lookAt(0, -0.5, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 3.8));
    const sun = new THREE.DirectionalLight(0xffffff, 6);
    sun.position.set(5, 12, 7);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(RIM_COLOR[type], 2.5);
    rim.position.set(-4, 2, -5);
    scene.add(rim);

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
    mount.appendChild(canvas);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(W, H, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor(0x000000, 0);
    } catch {
      canvas.remove();
      return;
    }

    const count = Math.min(amount, MAX_COUNT);
    const particles: Particle[] = [];
    let loaded = false;
    let spawnTemplate: THREE.Object3D | null = null;
    let spawned = 0;
    const SPAWN_EVERY = 5;

    const prepareTemplate = (template: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(template);
      const sz = new THREE.Vector3();
      box.getSize(sz);
      const maxDim = Math.max(sz.x, sz.y, sz.z) || 1;
      template.scale.setScalar(0.65 / maxDim);

      template.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat: THREE.Material) => { mat.side = THREE.DoubleSide; mat.needsUpdate = true; });
      });
      applyGLTFTexturePolicy(template, renderer);
      spawnTemplate = template;
      loaded = true;
    };

    const spawnOne = () => {
      if (!spawnTemplate || spawned >= count) return;
      const obj = spawnTemplate.clone(true);

      const x = (Math.random() - 0.5) * (WALL_X * 1.6 - COIN_RADIUS * 2);
      const z = (Math.random() - 0.5) * (WALL_Z * 1.6 - COIN_RADIUS * 2);
      const y = 2.0 + Math.random() * 0.45;

      obj.position.set(x, y, z);
      scene.add(obj);

      particles.push({
        obj,
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.10,
          -(0.22 + Math.random() * 0.12),
          (Math.random() - 0.5) * 0.05,
        ),
        axis: new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5,
        ).normalize(),
        rotSpeed: 0.06 + Math.random() * 0.14,
        delay: 0,
        settled: false,
        bounceCooldown: 0,
        sfxPlayed: false,
      });
      spawned++;
    };

    void loadGLTFFromUrl(resolveHeavyAssetUrl(MODEL_URLS[type])).then((gltf) => {
      prepareTemplate(gltf.scene);
    }).catch(() => {
      prepareTemplate(createFallbackTemplate(type));
    });

    let frame = 0;
    const _q = new THREE.Quaternion();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!renderer) return;
      frame++;

      while (loaded && spawned < count && frame >= spawned * SPAWN_EVERY) {
        spawnOne();
      }

      let allSettled = loaded && spawned >= count && particles.length > 0;

      // ── Physics step ──────────────────────────────────────────────────
      for (const p of particles) {
        if (p.settled) continue;
        if (frame < p.delay) { allSettled = false; continue; }

        if (!p.sfxPlayed) {
          p.sfxPlayed = true;
          playResourceBounceSfx();
        }

        allSettled = false;

        if (p.bounceCooldown > 0) p.bounceCooldown--;

        p.vel.y += GRAVITY;
        p.pos.addScaledVector(p.vel, 1);

        // Floor collision — play bounce SFX per coin/gem/power drop
        if (p.pos.y <= FLOOR_Y) {
          const impact = Math.abs(p.vel.y);
          p.pos.y = FLOOR_Y;
          p.vel.y = impact * BOUNCE;
          p.vel.x *= FRICTION;
          p.vel.z *= FRICTION;
          if (impact > 0.05 && p.bounceCooldown <= 0) {
            p.bounceCooldown = 8;
          }
          if (p.vel.y < 0.028) {
            p.settled = true;
            p.vel.set(0, 0, 0);
          }
        }

        // Left/right wall collisions
        const effectiveWallX = WALL_X - COIN_RADIUS;
        if (p.pos.x < -effectiveWallX) {
          p.pos.x = -effectiveWallX;
          p.vel.x = Math.abs(p.vel.x) * WALL_BOUNCE;
        } else if (p.pos.x > effectiveWallX) {
          p.pos.x = effectiveWallX;
          p.vel.x = -Math.abs(p.vel.x) * WALL_BOUNCE;
        }

        // Front/back wall collisions
        const effectiveWallZ = WALL_Z - COIN_RADIUS;
        if (p.pos.z < -effectiveWallZ) {
          p.pos.z = -effectiveWallZ;
          p.vel.z = Math.abs(p.vel.z) * WALL_BOUNCE;
        } else if (p.pos.z > effectiveWallZ) {
          p.pos.z = effectiveWallZ;
          p.vel.z = -Math.abs(p.vel.z) * WALL_BOUNCE;
        }

        // Spin
        if (!p.settled) {
          _q.setFromAxisAngle(p.axis, p.rotSpeed);
          p.obj.quaternion.multiply(_q);
        }

        p.obj.position.copy(p.pos);
      }

      // ── Coin–coin collisions (sphere proxy) ───────────────────────────
      for (let i = 0; i < particles.length - 1; i++) {
        const a = particles[i];
        if (a.settled && frame > a.delay + 10) continue;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = b.pos.x - a.pos.x;
          const dy = b.pos.y - a.pos.y;
          const dz = b.pos.z - a.pos.z;
          const dist2 = dx * dx + dy * dy + dz * dz;
          const minDist = COIN_RADIUS * 2;
          if (dist2 >= minDist * minDist || dist2 < 0.0001) continue;

          const dist = Math.sqrt(dist2);
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;
          const overlap = (minDist - dist) * 0.5;

          if (!a.settled) {
            a.pos.x -= nx * overlap;
            a.pos.y -= ny * overlap;
            a.pos.z -= nz * overlap;
          }
          if (!b.settled) {
            b.pos.x += nx * overlap;
            b.pos.y += ny * overlap;
            b.pos.z += nz * overlap;
          }

          const relV = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny + (b.vel.z - a.vel.z) * nz;
          if (relV < 0) {
            const impulse = relV * 0.55;
            if (!a.settled) { a.vel.x += impulse * nx; a.vel.y += impulse * ny; a.vel.z += impulse * nz; }
            if (!b.settled) { b.vel.x -= impulse * nx; b.vel.y -= impulse * ny; b.vel.z -= impulse * nz; }
          }
        }
      }

      renderer.render(scene, camera);

      if (allSettled && !notifiedRef.current) {
        notifiedRef.current = true;
        onAllSettled?.();
      }
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      renderer?.dispose();
      try { canvas.remove(); } catch { /**/ }
    };
  }, [type, amount]);

  return (
    <div
      ref={mountRef}
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    />
  );
}
