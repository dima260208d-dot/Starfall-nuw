import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

/**
 * Обёртка над TransformControls из Three.js — стрелки переноса/поворота/масштаба для объекта в сцене.
 * Это только визуальный редактор мешей; физику ClashStarStrike он сам не меняет.
 *
 * Как пользоваться (позже, когда подключишь к сцене Starfall):
 * 1) scene.add(controls.getHelper()) — gizmo рисуется отдельным объектом;
 * 2) controls.attach(myMesh) — к какому объекту привязаны стрелки;
 * 3) В цикле рендера вызывай controls.update() если нужно (часто достаточно рендера сцены).
 */

export type EditTransformMode = "translate" | "rotate" | "scale";

export class StarStrikeEditControls {
  readonly transform: TransformControls;
  private onDraggingChanged?: (dragging: boolean) => void;

  constructor(
    camera: THREE.Camera,
    /** Обычно тот же canvas, на который смотрит WebGLRenderer — ловим клики мыши */
    domElement: HTMLElement,
    /** Пока тянем стрелки — можно отключить OrbitControls, чтобы камера не уезжала */
    onDraggingChanged?: (dragging: boolean) => void,
  ) {
    this.onDraggingChanged = onDraggingChanged;
    this.transform = new TransformControls(camera, domElement);
    this.transform.setMode("translate");
    this.transform.addEventListener("dragging-changed", this.handleDraggingChanged as never);
  }

  /** Three передаёт `value: unknown` — приводим к boolean для колбэка. */
  private handleDraggingChanged = (event: object) => {
    const v = (event as { value?: unknown }).value;
    this.onDraggingChanged?.(Boolean(v));
  };

  /** Прикрепить стрелки к объекту сцены (меш, группа и т.д.) */
  attach(object: THREE.Object3D): void {
    this.transform.attach(object);
  }

  /** Убрать привязку */
  detach(): void {
    this.transform.detach();
  }

  setMode(mode: EditTransformMode): void {
    this.transform.setMode(mode);
  }

  setEnabled(on: boolean): void {
    this.transform.enabled = on;
    this.transform.getHelper().visible = on;
  }

  /** Helper нужно добавить в scene: scene.add(controls.getHelper()) */
  getHelper(): THREE.Object3D {
    return this.transform.getHelper();
  }

  dispose(): void {
    this.transform.removeEventListener("dragging-changed", this.handleDraggingChanged as never);
    this.transform.dispose();
  }
}
