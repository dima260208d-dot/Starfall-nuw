import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { subscribeWebGLRemount } from "../../utils/devWebGLRecovery";

interface Props {
  objUrl: string;
  mtlUrl: string;
  assetBase: string;
  color: string;
  size?: number;
  pixelRatioCap?: number;
}

function frameCameraOnModel(camera: THREE.PerspectiveCamera, model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  const sz = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(sz);
  const maxDim = Math.max(sz.x, sz.y, sz.z, 0.01);
  camera.lookAt(center.x, center.y, center.z);
  camera.position.set(center.x, center.y + sz.y * 0.06, center.z + maxDim * 2.55);
}

function normalizeModel(model: THREE.Object3D, targetSize = 2.2) {
  const box = new THREE.Box3().setFromObject(model);
  const sz = new THREE.Vector3();
  box.getSize(sz);
  const maxDim = Math.max(sz.x, sz.y, sz.z, 0.001);
  const scale = targetSize / maxDim;
  model.scale.setScalar(scale);

  const box2 = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  model.position.sub(center);
  model.position.y += (box2.getSize(new THREE.Vector3()).y * scale) * 0.5;
}

function fixObjMaterials(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (!m) return;
      m.side = THREE.DoubleSide;
      m.depthWrite = true;
      m.needsUpdate = true;
    });
  });
}

export default function DevObjModelPreview({
  objUrl,
  mtlUrl,
  assetBase,
  color,
  size = 220,
  pixelRatioCap = 1,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [remountEpoch, setRemountEpoch] = useState(0);

  useEffect(() => subscribeWebGLRemount(() => setRemountEpoch((e) => e + 1)), []);

  const stateRef = useRef({
    yaw: 0,
    dragging: false,
    dragStartX: 0,
    dragStartYaw: 0,
    raf: 0,
    lastTs: 0,
    frameSkip: 0,
    renderer: undefined as THREE.WebGLRenderer | undefined,
    scene: undefined as THREE.Scene | undefined,
    camera: undefined as THREE.PerspectiveCamera | undefined,
    rootGroup: undefined as THREE.Group | undefined,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(pixelRatioCap, window.devicePixelRatio || 1));
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 200);
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(2, 4, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(color), 0.45);
    rim.position.set(-2, 2, -3);
    scene.add(rim);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const s = stateRef.current;
    s.renderer = renderer;
    s.scene = scene;
    s.camera = camera;
    s.rootGroup = rootGroup;
    s.yaw = 0;

    let cancelled = false;
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath(assetBase);
    const objName = objUrl.split("/").pop() ?? "";
    const mtlName = mtlUrl.split("/").pop() ?? "";

    mtlLoader.load(mtlName, (materials) => {
      if (cancelled) return;
      materials.preload();
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.setPath(assetBase);
      objLoader.load(objName, (model) => {
        if (cancelled) return;
        fixObjMaterials(model);
        normalizeModel(model);
        rootGroup.add(model);
        frameCameraOnModel(camera, model);
        renderer.render(scene, camera);
      }, undefined, () => {
        console.warn("[DevObjModelPreview] failed to load", objUrl);
      });
    }, undefined, () => {
      if (cancelled) return;
      const objLoader = new OBJLoader();
      objLoader.setPath(assetBase);
      objLoader.load(objName, (model) => {
        if (cancelled) return;
        fixObjMaterials(model);
        normalizeModel(model);
        rootGroup.add(model);
        frameCameraOnModel(camera, model);
        renderer.render(scene, camera);
      });
    });

    const tick = (ts: number) => {
      const st = stateRef.current;
      const dt = st.lastTs ? Math.min(0.05, (ts - st.lastTs) / 1000) : 0;
      st.lastTs = ts;
      if (st.rootGroup) st.rootGroup.rotation.y = st.yaw;
      st.frameSkip = (st.frameSkip + 1) % 2;
      if (st.frameSkip === 0 && st.renderer && st.scene && st.camera) {
        st.renderer.render(st.scene, st.camera);
      }
      st.raf = requestAnimationFrame(tick);
    };
    s.raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(s.raf);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [objUrl, mtlUrl, assetBase, color, size, pixelRatioCap, remountEpoch]);

  const onPointerDown = (e: React.PointerEvent) => {
    const st = stateRef.current;
    st.dragging = true;
    st.dragStartX = e.clientX;
    st.dragStartYaw = st.yaw;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = stateRef.current;
    if (!st.dragging) return;
    st.yaw = st.dragStartYaw + (e.clientX - st.dragStartX) * 0.012;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    stateRef.current.dragging = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ width: size, height: size, touchAction: "none", cursor: "grab" }}
    />
  );
}
