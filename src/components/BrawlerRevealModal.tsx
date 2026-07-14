/**
 * BrawlerRevealModal — Brawl Stars-style full-screen brawler unlock animation.
 * The character runs toward the camera from far away, stops in the center,
 * auto-rotates/floats, then on dismiss runs back away into the screen.
 * Rendered into document.body via React portal (z-index: 999999).
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import { BRAWLERS, BRAWLER_RARITY_LABEL } from "../entities/BrawlerData";
import { brawlerName, brawlerRarityLabel } from "../i18n";
import { fixCharacterSkinnedMeshes } from "../utils/gltfSkinnedMeshFix";
import { useI18n } from "../i18n";
import { noteUserGesture } from "../audio/audioUnlock";
import { playBrawlerObtainVoice } from "../audio/voiceLineService";
import { applyBrawlerNormTransform, brawlerGlbPath, computeBrawlerNormTransform } from "../game/brawler3DScale";
import { resolveHeavyAssetUrl } from "../lib/assetBase";
import { loadGLTFFromUrl } from "../utils/glbFetchCache";
import { Tr } from "../i18n/Tr";

// ── Model registry ────────────────────────────────────────────────────────────
export const MODEL_URLS: Record<string, { url: string; anim: string; animIdx?: number }> = {
  miya:    { url: "models/miya.glb",    anim: "Walking", animIdx: 3 },
  ronin:   { url: "models/ronin.glb",   anim: "Walking", animIdx: 2 },
  yuki:    { url: "models/yuki.glb",    anim: "Walking", animIdx: 2 },
  kenji:   { url: "models/kenji.glb",   anim: "Walking", animIdx: 2 },
  hana:    { url: "models/hana.glb",    anim: "Walking", animIdx: 2 },
  goro:    { url: "models/goro.glb",    anim: "Running" },
  sora:    { url: "models/sora.glb",    anim: "Running", animIdx: 0 },
  rin:     { url: "models/rin.glb",     anim: "Running" },
  taro:    { url: "models/taro.glb",    anim: "Walking", animIdx: 2 },
  zafkiel: { url: "models/zafkiel.glb", anim: "Walking", animIdx: 2 },
  verdeletta: { url: "models/verdeletta.glb", anim: "Walking", animIdx: 2 },
  lumina: { url: brawlerGlbPath("lumina"), anim: "Walking", animIdx: 1 },
  oliver: { url: brawlerGlbPath("oliver"), anim: "Walking", animIdx: 1 },
  callista: { url: brawlerGlbPath("callista"), anim: "Walking", animIdx: 1 },
  airin: { url: brawlerGlbPath("airin"), anim: "Walking", animIdx: 1 },
  elian: { url: brawlerGlbPath("elian"), anim: "Walking", animIdx: 1 },
  silven: { url: brawlerGlbPath("silven"), anim: "Walking", animIdx: 1 },
  vittoria: { url: brawlerGlbPath("vittoria"), anim: "Walking", animIdx: 2 },
  octavia: { url: brawlerGlbPath("octavia"), anim: "Walking", animIdx: 1 },
  zephyrin: { url: brawlerGlbPath("zephyrin"), anim: "Walking", animIdx: 1 },
  mirabel: { url: brawlerGlbPath("mirabel"), anim: "Walking", animIdx: 1 },
};

// ── GLTF cache (module-level, persists across remounts) ───────────────────────
interface CachedGLTF {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  normScale: number;
  normScaleY: number;
  normOffX: number;
  normOffY: number;
  normOffZ: number;
}
const gltfCache = new Map<string, Promise<CachedGLTF>>();

export function loadGLTFCached(url: string): Promise<CachedGLTF> {
  const hit = gltfCache.get(url);
  if (hit) return hit;
  const p = loadGLTFFromUrl(url).then((gltf) => {
    const scene = gltf.scene;
    fixMaterials(scene);
    fixCharacterSkinnedMeshes(scene);
    const TARGET_H = 2.7;
    const t = computeBrawlerNormTransform(scene, TARGET_H, url);
    return {
      scene, animations: gltf.animations ?? [],
      ...t,
    };
  }).catch((err) => {
    gltfCache.delete(url);
    throw err;
  });
  gltfCache.set(url, p);
  return p;
}

function fixMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m: THREE.Material) => {
      m.side = THREE.DoubleSide;
      m.depthWrite = true;
      const sm = m as THREE.MeshStandardMaterial;
      if (sm.opacity !== undefined && sm.opacity >= 0.98) m.transparent = false;
      m.needsUpdate = true;
    });
  });
}

function resolveClip(clips: THREE.AnimationClip[], name: string, idx?: number) {
  if (!clips.length) return null;
  if (idx !== undefined && clips[idx]) return clips[idx];
  const exact = clips.find(c => c.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  const partial = clips.find(c => c.name.toLowerCase().includes(lower));
  if (partial) return partial;
  return clips[0];
}

// ── Rarity particle colors ────────────────────────────────────────────────────
const RARITY_PARTICLES: Record<string, string[]> = {
  common:         ["#BDBDBD", "#E0E0E0", "#FFFFFF"],
  rare:           ["#40C4FF", "#0288D1", "#80D8FF"],
  epic:           ["#CE93D8", "#AB47BC", "#E040FB"],
  mega:           ["#FF80AB", "#FFD700", "#FF4081"],
  legendary:      ["#FFD700", "#FF8F00", "#FF3D00"],
  mythic:         ["#E040FB", "#FFD700", "#FF4081"],
  ultralegendary: ["#B388FF", "#7C4DFF", "#FFD700"],
};

// ── Keyframe CSS ──────────────────────────────────────────────────────────────
const REVEAL_STYLES = `
  @keyframes headlineIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-32px) scale(0.6); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0)      scale(1); }
  }
  @keyframes badgeIn {
    from { opacity: 0; transform: translateY(32px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes beamSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes glowPulse {
    0%,100% { transform: scale(1);    opacity: 0.7; }
    50%     { transform: scale(1.18); opacity: 1; }
  }
  @keyframes shadowPulse {
    0%,100% { transform: scale(1);   opacity: 0.6; }
    50%     { transform: scale(1.25);opacity: 1; }
  }
  @keyframes tapHint {
    0%,70%,100% { opacity: 0.25; }
    35%         { opacity: 0.65; }
  }
  @keyframes particleOrbit {
    0%   { transform: rotate(calc(var(--a))) translateX(0px)          scale(0);   opacity: 0; }
    15%  { transform: rotate(calc(var(--a))) translateX(var(--d))     scale(1);   opacity: 1; }
    75%  { transform: rotate(calc(var(--a) + 270deg)) translateX(var(--d)) scale(1); opacity: 0.8; }
    100% { transform: rotate(calc(var(--a) + 360deg)) translateX(0px) scale(0);   opacity: 0; }
  }
  @keyframes starSpin {
    from { transform: rotate(0deg) scale(var(--s)); }
    to   { transform: rotate(360deg) scale(var(--s)); }
  }
  @keyframes flashBurst {
    0%   { opacity: 1; transform: scale(0.3); }
    40%  { opacity: 0.9; transform: scale(1.4); }
    100% { opacity: 0; transform: scale(2.5); }
  }
  @keyframes namePop {
    0%   { opacity: 0; transform: translateY(20px) scale(0.8); }
    60%  { transform: translateY(-5px) scale(1.05); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

// ── Types ─────────────────────────────────────────────────────────────────────
type RevealPhase = "running_in" | "spinning" | "running_out";

export interface BrawlerRevealModalProps {
  brawlerId: string;
  onDone: () => void;
  index?: number;
  total?: number;
  /** Duplicate from chest → same 3D reveal, different headline. */
  duplicate?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BrawlerRevealModal({
  brawlerId,
  onDone,
  index = 0,
  total = 1,
  duplicate = false,
}: BrawlerRevealModalProps) {
  const { t } = useI18n();
  const mountRef   = useRef<HTMLDivElement>(null);
  const phaseRef   = useRef<RevealPhase>("running_in");
  const onDoneRef  = useRef(onDone);
  onDoneRef.current = onDone;

  const [phase, setPhase] = useState<RevealPhase>("running_in");
  const [showFlash, setShowFlash] = useState(false);
  const voicePlayedRef = useRef(false);

  const brawler   = BRAWLERS.find(b => b.id === brawlerId);
  const pColors   = RARITY_PARTICLES[brawler?.rarity ?? "common"] ?? RARITY_PARTICLES.common;

  const tryPlayVoice = useCallback(() => {
    noteUserGesture();
    if (voicePlayedRef.current) return;
    voicePlayedRef.current = true;
    playBrawlerObtainVoice(brawlerId);
  }, [brawlerId]);

  const startRunOut = useCallback(() => {
    if (phaseRef.current === "running_out") return;
    phaseRef.current = "running_out";
    setPhase("running_out");
  }, []);

  useEffect(() => {
    tryPlayVoice();
  }, [tryPlayVoice]);

  // ── Auto-collect after 4.5 s of spinning ───────────────────────────────────
  useEffect(() => {
    if (phase !== "spinning") return;
    tryPlayVoice();
    const t = setTimeout(() => startRunOut(), 4500);
    return () => clearTimeout(t);
  }, [phase, tryPlayVoice, startRunOut]);

  const handleTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (phaseRef.current === "running_in") {
      phaseRef.current = "spinning";
      setPhase("spinning");
      tryPlayVoice();
    } else if (phaseRef.current === "spinning") {
      startRunOut();
    }
  }, [startRunOut, tryPlayVoice]);

  // ── Three.js scene ──────────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !brawler) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch { return; }

    // Always use window dimensions so the aspect ratio is correct regardless
    // of when the portal div receives its layout (avoids mount.clientWidth=0).
    const W = window.innerWidth;
    const H = window.innerHeight;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset    = "0";
    renderer.domElement.style.width    = "100%";
    renderer.domElement.style.height   = "100%";
    renderer.domElement.style.pointerEvents = "none";
    mount.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    // FOV=55 gives a natural view; camera at z=7 keeps the character a good size;
    // camera Y=1.0 matches the model's visual centre so it projects to screen centre.
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
    camera.position.set(0, 1.35, 7);
    camera.lookAt(0, 1.35, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(2, 5, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(brawler.color), 0.8);
    rim.position.set(-2, 2, -3);
    scene.add(rim);
    const glowLight = new THREE.PointLight(new THREE.Color(brawler.color), 2.5, 6);
    glowLight.position.set(0, 1.5, 2);
    scene.add(glowLight);

    const rootGroup = new THREE.Group();
    // Start far away; yaw=0 matches main-menu preview (face toward camera).
    rootGroup.position.z = -22;
    rootGroup.rotation.y = 0;
    scene.add(rootGroup);

    // ── Run-toward-camera state ───────────────────────────────────────────────
    const RUN_IN_DURATION  = 1.5; // seconds to run toward camera
    const RUN_OUT_DURATION = 0.8; // seconds to run away

    const run = {
      phaseTime: 0,
      floatT:    0,
      runOutStarted: false,
      doneTriggered: false,
    };

    let mixer: THREE.AnimationMixer | null = null;
    let rafId  = 0;
    let lastTs = 0;
    let cancelled = false;

    // ── Render loop ──────────────────────────────────────────────────────────
    const tick = (ts: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
      lastTs = ts;
      const cur = phaseRef.current;

      if (cur === "running_in") {
        run.phaseTime += dt;
        const t = Math.min(run.phaseTime / RUN_IN_DURATION, 1);
        // Ease-in-out (smoothstep)
        const p = t * t * (3 - 2 * t);
        rootGroup.position.z = -22 * (1 - p);
        rootGroup.position.y = 0;

        if (t >= 1) {
          // Arrived — transition to spinning
          rootGroup.position.z = 0;
          phaseRef.current = "spinning";
          setPhase("spinning");
          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 600);
          run.phaseTime = 0;
        }
      } else if (cur === "spinning") {
        // Face the player — idle animation only, no Y-axis spin.
        rootGroup.position.z = 0;
        rootGroup.rotation.y = 0;
        run.floatT += dt;
        rootGroup.position.y = Math.sin(run.floatT * 1.5) * 0.14;
      } else if (cur === "running_out") {
        if (!run.runOutStarted) {
          run.runOutStarted = true;
          run.phaseTime = 0;
          rootGroup.position.y = 0;
        }
        run.phaseTime += dt;
        const t = Math.min(run.phaseTime / RUN_OUT_DURATION, 1);
        // Ease-in (accelerate away)
        const p = t * t;
        rootGroup.position.z = -22 * p;

        if (t >= 1 && !run.doneTriggered) {
          run.doneTriggered = true;
          setTimeout(() => onDoneRef.current(), 100);
        }
      }

      // Glow pulse
      glowLight.intensity = 2 + Math.sin(ts / 350) * 0.6;

      if (mixer) mixer.update(dt);
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(tick);

    // ── Load model ───────────────────────────────────────────────────────────
    const modelCfg = MODEL_URLS[brawlerId];
    if (modelCfg) {
      loadGLTFCached(resolveHeavyAssetUrl(modelCfg.url)).then((cached) => {
        if (cancelled) return;
        const model = cloneSkinned(cached.scene) as THREE.Group;
        fixMaterials(model);
        applyBrawlerNormTransform(model, cached);
        // rootGroup has rotation.y = π so local-X maps to world-X negated.
        // Force local X = 0 so the model is exactly at world X = 0 (screen center).
        model.position.set(0, cached.normOffY, 0);
        rootGroup.add(model);
        mixer = new THREE.AnimationMixer(model);
        const clip = resolveClip(cached.animations, modelCfg.anim, modelCfg.animIdx);
        if (clip) {
          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
        }
      }).catch(() => {});
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      renderer.dispose();
      const gl = renderer.getContext();
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    };
  }, [brawlerId, brawler]);

  if (!brawler) return null;

  const rarityLabel  = brawlerRarityLabel(brawler.rarity, BRAWLER_RARITY_LABEL[brawler.rarity]);
  const isSpinning   = phase === "spinning";
  const isRunningOut = phase === "running_out";

  // Generate particle descriptors
  const PARTICLE_COUNT = 28;
  const particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    color: pColors[i % pColors.length],
    angle: (i / PARTICLE_COUNT) * 360,
    dist: 90 + (i % 3) * 60,
    size: 5 + (i % 4) * 3,
    dur:  1.8 + (i % 5) * 0.4,
    delay: (i % 7) * 0.25,
  }));

  const modal = (
    <div
      onClick={handleTap}
      style={{
        position: "fixed", inset: 0, zIndex: 999999,
        background: `radial-gradient(ellipse at 50% 52%, ${brawler.color}28 0%, rgba(0,0,10,0.97) 68%)`,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden", cursor: "pointer", userSelect: "none",
      }}
    >
      <style>{REVEAL_STYLES}</style>

      {/* ── Counter (if multiple brawlers) ── */}
      {total > 1 && (
        <div style={{
          position: "absolute", top: 16, left: "50%",
          transform: "translateX(-50%)",
          fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.55)",
          letterSpacing: 3, zIndex: 8,
        }}>
          {index + 1} / {total}
        </div>
      )}

      {/* ── "НОВЫЙ БОЕЦ!" ── */}
      <div style={{
        position: "absolute",
        top: total > 1 ? 46 : 26,
        left: "50%",
        fontSize: 30, fontWeight: 900, letterSpacing: 7,
        color: "#FFD700",
        textShadow: "0 0 30px #FFD700, 0 0 60px #FFD70088, 0 4px 0 #7B5800",
        textTransform: "uppercase", zIndex: 8, whiteSpace: "nowrap",
        animation: "headlineIn 0.7s cubic-bezier(0.22,1,0.36,1) 0.15s both",
      }}>
        {duplicate ? t("reveal.duplicate") : t("reveal.newBrawler")}
      </div>

      {/* ── Rotating beam background ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: `conic-gradient(from 0deg at 50% 54%,
          transparent 0deg, ${brawler.color}10 8deg, transparent 18deg,
          transparent 48deg, ${brawler.color}08 56deg, transparent 66deg)`,
        animation: "beamSpin 10s linear infinite",
      }} />

      {/* ── Radial glow behind model (active while spinning) ── */}
      {(isSpinning || isRunningOut) && (
        <div style={{
          position: "absolute",
          width: 440, height: 440, borderRadius: "50%",
          background: `radial-gradient(circle, ${brawler.color}44 0%, ${brawler.color}0a 55%, transparent 70%)`,
          animation: "glowPulse 2s ease-in-out infinite",
          zIndex: 2, pointerEvents: "none",
        }} />
      )}

      {/* ── Burst flash on arrival ── */}
      {showFlash && (
        <div style={{
          position: "absolute",
          width: 500, height: 500, borderRadius: "50%",
          background: `radial-gradient(circle, ${brawler.color}cc 0%, ${brawler.color}44 40%, transparent 70%)`,
          animation: "flashBurst 0.6s ease-out forwards",
          zIndex: 7, pointerEvents: "none",
        }} />
      )}

      {/* ── Orbiting particles ── */}
      {(isSpinning || isRunningOut) && particles.map(p => (
        <div key={p.id} style={{
          position: "absolute", left: "50%", top: "46%",
          width: p.size, height: p.size,
          marginLeft: -p.size / 2, marginTop: -p.size / 2,
          borderRadius: "50%",
          background: p.color,
          boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          "--a": `${p.angle}deg`,
          "--d": `${p.dist}px`,
          animation: `particleOrbit ${p.dur}s ease-in-out ${p.delay}s infinite`,
          zIndex: 3, pointerEvents: "none",
        } as React.CSSProperties} />
      ))}

      {/* ── Three.js mount ── */}
      <div
        ref={mountRef}
        style={{
          position: "absolute", inset: 0, zIndex: 4,
          pointerEvents: "none",
          opacity: isRunningOut ? 0.6 : 1,
          transition: "opacity 0.3s",
        }}
      />

      {/* ── Floor shadow ── */}
      <div style={{
        position: "absolute", bottom: "18%",
        width: 180, height: 28, borderRadius: "50%",
        background: `radial-gradient(ellipse, ${brawler.color}88 0%, transparent 70%)`,
        filter: "blur(8px)", zIndex: 3, pointerEvents: "none",
        animation: isSpinning ? "shadowPulse 2s ease-in-out infinite" : "none",
        opacity: isSpinning || isRunningOut ? 1 : 0,
        transition: "opacity 0.4s",
      }} />

      {/* ── Brawler name + rarity badge ── */}
      <div style={{
        position: "absolute", bottom: 88,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        zIndex: 6, pointerEvents: "none",
        opacity: isSpinning || isRunningOut ? 1 : 0,
        transition: "opacity 0.4s",
        animation: isSpinning ? "namePop 0.55s cubic-bezier(0.22,1,0.36,1)" : "none",
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${brawler.color}, ${brawler.secondaryColor})`,
          borderRadius: 8, padding: "4px 18px",
          fontSize: 11, fontWeight: 900, letterSpacing: 3,
          color: "white", textTransform: "uppercase",
          boxShadow: `0 0 24px ${brawler.color}99`,
        }}>
          {rarityLabel}
        </div>
        <div style={{
          fontSize: 44, fontWeight: 900, lineHeight: 1, letterSpacing: 4,
          color: "white",
          textShadow: `0 0 40px ${brawler.color}, 0 0 80px ${brawler.color}66, 0 5px 0 rgba(0,0,0,0.9)`,
        }}>
          {brawlerName(brawler.id, brawler.name).toUpperCase()}
        </div>
        <div style={{
          fontSize: 13, color: "rgba(255,255,255,0.5)",
          letterSpacing: 3, textTransform: "uppercase",
        }}>
          {duplicate ? t("reveal.freeStar") : brawler.role}
        </div>
      </div>

      {/* ── "Нажмите для продолжения" ── */}
      {isSpinning && (
        <div style={{
          position: "absolute", bottom: 48,
          fontSize: 11, color: "rgba(255,255,255,0.3)",
          letterSpacing: 2, textTransform: "uppercase",
          animation: "tapHint 2.5s ease-in-out infinite",
          zIndex: 7, pointerEvents: "none",
        }}>
          <Tr id="chest.tapContinue" />
        </div>
      )}

      {/* ── Skip hint (during run-in) ── */}
      {phase === "running_in" && (
        <div style={{
          position: "absolute", bottom: 36, right: 24,
          fontSize: 11, color: "rgba(255,255,255,0.28)",
          letterSpacing: 2, textTransform: "uppercase",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, padding: "6px 14px",
          zIndex: 7, pointerEvents: "none",
        }}>
          <Tr id="common.skip" />
        </div>
      )}
    </div>
  );

  return createPortal(modal, getAppPortalRoot());
}
