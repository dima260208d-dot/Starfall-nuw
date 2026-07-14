import * as THREE from "three";
import { createStarStrikeTerrainRoot } from "./StarStrikeTerrain";
import { scatterDecor } from "./decorScatter";
import { StarStrikeEditControls } from "./StarStrikeEditControls";
import { TILE_CELL_SIZE } from "../../game/TileMap";

/** Совпадает с ClashStarStrike — размер логического вида камеры. */
const GAME_ZOOM = 1.4;
const VIEW_W = Math.round(1200 / GAME_ZOOM);
const VIEW_H = Math.round(800 / GAME_ZOOM);

/**
 * Отдельный WebGL-слой под/над 2D-канвасом StarStrike: ландшафт + декор.
 * Не участвует в collidesWithWalls / движении мяча — только картинка.
 */
export class StarStrikeVisualLayer {
  private readonly gameCanvas: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly world = new THREE.Group();
  private decorGroup = new THREE.Group();
  private editControls: StarStrikeEditControls | null = null;
  private editPivot: THREE.Mesh | null = null;
  private editMode = false;
  private ready = false;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(gameCanvas: HTMLCanvasElement, private readonly mapW: number, private readonly mapH: number) {
    this.gameCanvas = gameCanvas;
    const parent = gameCanvas.parentElement;
    if (!parent) throw new Error("StarStrikeVisualLayer: canvas needs a parent element");

    this.overlay = document.createElement("canvas");
    this.overlay.width = 1200;
    this.overlay.height = 800;
    // Поверх 2D-канваса: прозрачный clear + низкая opacity материала — проступает арена под слоем.
    this.overlay.style.cssText = [
      "position:absolute",
      "inset:0",
      "width:100%",
      "height:100%",
      "pointer-events:none",
      "z-index:6",
      "opacity:1",
    ].join(";");
    parent.appendChild(this.overlay);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.overlay,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(1200, 800, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const halfW = VIEW_W / 2;
    const halfH = VIEW_H / 2;
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 10, 8000);
    this.camera.position.set(this.mapW / 2, 900, this.mapH / 2);
    this.camera.lookAt(this.mapW / 2, 0, this.mapH / 2);
    this.camera.up.set(0, 1, 0);

    this.scene.add(this.world);
    this.scene.fog = new THREE.Fog(0x1a2e1c, 1200, 5200);

    const amb = new THREE.AmbientLight(0xcfe8ff, 0.55);
    const sun = new THREE.DirectionalLight(0xfff2d6, 0.85);
    sun.position.set(400, 1200, 200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 200;
    sun.shadow.camera.far = 2600;
    sun.shadow.camera.left = -2200;
    sun.shadow.camera.right = 2200;
    sun.shadow.camera.top = 2200;
    sun.shadow.camera.bottom = -2200;
    this.scene.add(amb, sun);

    void this.bootstrap();

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === "F3") {
        e.preventDefault();
        this.toggleEditMode();
      }
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  private async bootstrap(): Promise<void> {
    try {
      const terrain = await createStarStrikeTerrainRoot(this.mapW, this.mapH);
      terrain.position.set(this.mapW / 2, 0, this.mapH / 2);
      this.world.add(terrain);

      this.decorGroup = new THREE.Group();
      scatterDecor(this.decorGroup, this.mapW, this.mapH, TILE_CELL_SIZE, 42);
      this.world.add(this.decorGroup);

      const pivotGeo = new THREE.BoxGeometry(TILE_CELL_SIZE * 0.5, TILE_CELL_SIZE * 0.5, TILE_CELL_SIZE * 0.5);
      const pivotMat = new THREE.MeshStandardMaterial({
        color: 0xffc857,
        emissive: 0x332200,
        transparent: true,
        opacity: 0.35,
      });
      this.editPivot = new THREE.Mesh(pivotGeo, pivotMat);
      this.editPivot.position.set(this.mapW * 0.5, TILE_CELL_SIZE * 0.4, this.mapH * 0.45);
      this.editPivot.visible = false;
      this.world.add(this.editPivot);

      this.editControls = new StarStrikeEditControls(this.camera, this.overlay, (dragging) => {
        this.overlay.style.pointerEvents = dragging ? "auto" : this.editMode ? "auto" : "none";
      });
      this.scene.add(this.editControls.getHelper());
      this.editControls.setEnabled(false);

      this.ready = true;
    } catch (e) {
      console.warn("[StarStrikeVisualLayer] terrain init failed", e);
    }
  }

  /** F3 — переключить gizmo (декор не влияет на физику). */
  toggleEditMode(): void {
    if (!this.editControls || !this.editPivot) return;
    this.editMode = !this.editMode;
    this.editPivot.visible = this.editMode;
    if (this.editMode) {
      this.overlay.style.pointerEvents = "auto";
      this.editControls.setEnabled(true);
      this.editControls.attach(this.editPivot);
    } else {
      this.overlay.style.pointerEvents = "none";
      this.editControls.detach();
      this.editControls.setEnabled(false);
    }
  }

  /** Вызывать каждый кадр после 2D-рендера с теми же camX/camY, что и у 2D-камеры. */
  render(camX: number, camY: number): void {
    if (!this.ready) return;
    const halfW = VIEW_W / 2;
    const halfH = VIEW_H / 2;
    const cx = camX + halfW;
    const cz = camY + halfH;
    this.camera.position.set(cx, 900, cz);
    this.camera.lookAt(cx, 0, cz);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.keyHandler) window.removeEventListener("keydown", this.keyHandler);
    this.keyHandler = null;
    this.editControls?.dispose();
    this.editControls = null;
    this.renderer.dispose();
    this.overlay.remove();
  }
}
