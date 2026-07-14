/**
 * ChestOpenAnimation — full-screen portal that plays the chest spin+glow reveal.
 * After the animation completes it calls onDone() which triggers ChestOpenModal.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAppPortalRoot } from "../utils/appPortalRoot";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { resolveHeavyAssetUrl } from "../lib/assetBase";
import { CHESTS, type ChestRarity } from "../utils/chests";
import { CHEST_MODELS, loadChestCached } from "./Chest3DViewer";
import { useI18n, chestName } from "../i18n";
import { Tr } from "../i18n/Tr";

const OPEN_DURATION = 1.8; // seconds for the full opening flash animation
const SPIN_SPEED_IDLE = 0.6; // rad/s while idle
const SPIN_SPEED_PEAK = 20;  // rad/s at peak spin

type Phase = "ready" | "opening" | "done";

interface Props {
  rarity: ChestRarity;
  onDone: () => void;
}

export default function ChestOpenAnimation({ rarity, onDone }: Props) {
  const { t } = useI18n();
  const mountRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<Phase>("ready");
  const openStartRef = useRef(0);
  const [hint, setHint] = useState(true);
  const [, forceUpdate] = useState(0);

  const triggerOpen = () => {
    if (phaseRef.current !== "ready") return;
    phaseRef.current = "opening";
    openStartRef.current = performance.now();
    setHint(false);
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const def = CHESTS[rarity];

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch { return; }

    const W = mount.clientWidth || window.innerWidth;
    const H = mount.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    camera.position.set(0, 1.5, 5.5);
    camera.lookAt(0, 1.1, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2, 5, 4);
    scene.add(key);

    const glowColor = new THREE.Color(def.color);
    const glowLight = new THREE.PointLight(glowColor, 4, 12);
    glowLight.position.set(0, 1.5, 2.5);
    scene.add(glowLight);

    const rimLight = new THREE.PointLight(0xffffff, 0, 20);
    rimLight.position.set(0, 3, -2);
    scene.add(rimLight);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    let rafId = 0;
    let lastTs = 0;
    let cancelled = false;
    let doneFired = false;

    const tick = (ts: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
      lastTs = ts;

      const phase = phaseRef.current;

      if (phase === "ready") {
        rootGroup.rotation.y += dt * SPIN_SPEED_IDLE;
        glowLight.intensity = 3 + Math.sin(ts / 600) * 1.2;
        rimLight.intensity = 0;
        if (flashRef.current) flashRef.current.style.opacity = "0";
      } else if (phase === "opening") {
        const elapsed = (ts - openStartRef.current) / 1000;
        const t = Math.min(elapsed / OPEN_DURATION, 1);

        // Spin: accelerate then decelerate
        const spinCurve = t < 0.6
          ? SPIN_SPEED_IDLE + (SPIN_SPEED_PEAK - SPIN_SPEED_IDLE) * (t / 0.6)
          : SPIN_SPEED_PEAK * (1 - (t - 0.6) / 0.4);
        rootGroup.rotation.y += dt * Math.max(SPIN_SPEED_IDLE, spinCurve);

        // Glow intensity ramps up sharply
        glowLight.intensity = 3 + t * 60;
        rimLight.intensity = t * 30;

        // Flash overlay: 0→1 at t=0.4, peak at t=0.6, back to 0 at t=1.0
        const flashT = t < 0.6 ? t / 0.6 : 1 - (t - 0.6) / 0.4;
        const flashOpacity = Math.pow(Math.max(0, flashT), 1.5);
        if (flashRef.current) {
          flashRef.current.style.opacity = String(flashOpacity.toFixed(3));
        }

        if (t >= 1 && !doneFired) {
          doneFired = true;
          phaseRef.current = "done";
          if (flashRef.current) flashRef.current.style.opacity = "0";
          onDone();
        }
      }

      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(tick);

    loadChestCached(resolveHeavyAssetUrl(CHEST_MODELS[rarity])).then((cached) => {
      if (cancelled) return;
      const model = cloneSkinned(cached.scene) as THREE.Group;
      model.scale.setScalar(cached.normScale * 0.5);
      model.position.set(cached.normOffX, cached.normOffY, cached.normOffZ);
      rootGroup.add(model);
    }).catch(() => {});

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [rarity]);

  const def = CHESTS[rarity];

  const modal = (
    <div
      onClick={triggerOpen}
      style={{
        position: "fixed", inset: 0, zIndex: 99998,
        background: "radial-gradient(ellipse at center, #05001A 0%, #000008 100%)",
        cursor: "pointer",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* Three.js canvas container */}
      <div
        ref={mountRef}
        style={{
          position: "absolute", inset: 0,
        }}
      />

      {/* Colored glow flash overlay */}
      <div
        ref={flashRef}
        style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse at center, ${def.color} 0%, ${def.secondaryColor}88 50%, transparent 100%)`,
          opacity: 0,
          pointerEvents: "none",
          transition: "opacity 0.05s linear",
        }}
      />

      {/* Chest name label */}
      <div style={{
        position: "absolute",
        top: "12%",
        textAlign: "center",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontWeight: 900,
        fontSize: 28,
        letterSpacing: 4,
        color: def.color,
        textShadow: `0 0 20px ${def.color}, 0 0 40px ${def.color}88`,
        textTransform: "uppercase",
        pointerEvents: "none",
      }}>
        {chestName(rarity).toUpperCase()}
      </div>

      {/* Tap hint */}
      {hint && (
        <div style={{
          position: "absolute",
          bottom: "14%",
          textAlign: "center",
          fontFamily: "'Segoe UI', Arial, sans-serif",
          fontWeight: 900,
          fontSize: 22,
          color: "#FFFFFF",
          letterSpacing: 2,
          textShadow: "0 0 18px rgba(255,255,255,0.95), 0 2px 8px rgba(0,0,0,0.9), 0 0 32px rgba(255,213,79,0.65)",
          animation: "glowHintPulse 1.4s ease-in-out infinite",
          pointerEvents: "none",
        }}>
          <Tr id="common.tapToOpen" />
        </div>
      )}

      <style>{`
        @keyframes glowHintPulse {
          0%, 100% { opacity: 0.88; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.05); }
        }
      `}</style>
    </div>
  );

  return createPortal(modal, getAppPortalRoot());
}
