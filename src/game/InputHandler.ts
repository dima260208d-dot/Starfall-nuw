export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
  super: boolean;
  mouseX: number;
  mouseY: number;
  mouseWorldX: number;
  mouseWorldY: number;
}

import { clientToCanvasBitmapPx } from "../utils/canvasObjectFitCover";
import { isBattlePinInputBlocked, pulseBattlePinUiInteraction } from "./battlePinInputGate";

/** UI that must keep mouse clicks (HUD buttons, pins, etc.). */
const UI_POINTER_BLOCK =
  "button, a, input, textarea, select, [role='button'], [data-ui-interactive], [data-battle-pin-hud], [data-battle-pin-interactive]";

export class InputHandler {
  state: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
    super: false,
    mouseX: 0,
    mouseY: 0,
    mouseWorldX: 0,
    mouseWorldY: 0,
  };

  // Joystick (mobile) overrides. When `active`, the corresponding aim
  // direction supersedes the mouse-derived aim used by all modes.
  attackJoystick: { active: boolean; angle: number; magnitude: number } = { active: false, angle: 0, magnitude: 1 };
  superJoystick:  { active: boolean; angle: number; magnitude: number } = { active: false, angle: 0, magnitude: 1 };
  /** Space — auto-aim attack (PC). */
  autoAttackHeld = false;
  /** LMB — manual aim toward cursor (PC). */
  manualAttackHeld = false;
  /** One-shot LMB click queued until the game loop syncs world mouse coords. */
  manualAttackPending = false;
  /** Headless server: skip updateWorldMouse after network aim inject. */
  _networkAimLock = false;
  // Tracks whether mobile controls are currently driving movement.
  // While true, keyboard movement keys are ignored so a stuck `WASD` value
  // can never linger between modes.
  movementJoystick: { active: boolean; angle: number; magnitude: number } = {
    active: false, angle: 0, magnitude: 0,
  };

  private canvas: HTMLCanvasElement;
  private onAttack?: () => void;
  private onSuper?: () => void;

  constructor(canvas: HTMLCanvasElement, onAttack?: () => void, onSuper?: () => void) {
    this.canvas = canvas;
    this.onAttack = onAttack;
    this.onSuper = onSuper;
    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    // Window-level mouse: battle HUD overlay sits above the canvas and used to
    // swallow LMB before it reached canvas listeners.
    window.addEventListener("mousemove", this.onMouseMoveWindow);
    window.addEventListener("mousedown", this.onMouseDownWindow);
    window.addEventListener("mouseup", this.onMouseUpWindow);
    window.addEventListener("pointerdown", this.onPointerDownCapture, true);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
  }

  private uiPointerDown = false;

  private onPointerDownCapture = (e: PointerEvent): void => {
    const top = document.elementFromPoint(e.clientX, e.clientY);
    if (this.isUiPointerTarget(e.target) || this.isUiPointerTarget(top)) {
      this.uiPointerDown = true;
      pulseBattlePinUiInteraction();
    }
  };

  private isOverCanvas(clientX: number, clientY: number): boolean {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return clientX >= rect.left && clientX <= rect.right
      && clientY >= rect.top && clientY <= rect.bottom;
  }

  private isUiPointerTarget(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(UI_POINTER_BLOCK) !== null;
  }

  /** True when a click/move should drive battle aim (not a HUD button). */
  private pointerTargetsGameStage(clientX: number, clientY: number): boolean {
    if (!this.isOverCanvas(clientX, clientY)) return false;
    const top = document.elementFromPoint(clientX, clientY);
    if (this.isUiPointerTarget(top)) return false;
    return true;
  }

  private syncMouseFromClient(clientX: number, clientY: number): void {
    const p = clientToCanvasBitmapPx(this.canvas, clientX, clientY);
    this.state.mouseX = p.x;
    this.state.mouseY = p.y;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    switch (e.code) {
      case "KeyW": case "ArrowUp": this.state.up = true; break;
      case "KeyS": case "ArrowDown": this.state.down = true; break;
      case "KeyA": case "ArrowLeft": this.state.left = true; break;
      case "KeyD": case "ArrowRight": this.state.right = true; break;
      case "Space":
        if (!e.repeat) this.onAttack?.();
        this.autoAttackHeld = true;
        this.state.attack = true;
        e.preventDefault();
        break;
      case "KeyE":
      case "KeyQ":
        if (!this.state.super) { this.state.super = true; this.onSuper?.(); }
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case "KeyW": case "ArrowUp": this.state.up = false; break;
      case "KeyS": case "ArrowDown": this.state.down = false; break;
      case "KeyA": case "ArrowLeft": this.state.left = false; break;
      case "KeyD": case "ArrowRight": this.state.right = false; break;
      case "Space":
        this.autoAttackHeld = false;
        this.state.attack = this.manualAttackHeld;
        break;
      case "KeyE": case "KeyQ": this.state.super = false; break;
    }
  };

  private onMouseMoveWindow = (e: MouseEvent): void => {
    if (!this.isOverCanvas(e.clientX, e.clientY)) return;
    this.syncMouseFromClient(e.clientX, e.clientY);
  };

  private onMouseDownWindow = (e: MouseEvent): void => {
    if (this.uiPointerDown) {
      this.uiPointerDown = false;
      return;
    }
    if (isBattlePinInputBlocked()) return;
    const top = document.elementFromPoint(e.clientX, e.clientY);
    if (this.isUiPointerTarget(e.target) || this.isUiPointerTarget(top)) return;
    if (!this.pointerTargetsGameStage(e.clientX, e.clientY)) return;
    this.syncMouseFromClient(e.clientX, e.clientY);
    if (e.button === 0) {
      this.manualAttackHeld = true;
      this.manualAttackPending = true;
      this.state.attack = true;
    } else if (e.button === 2) {
      this.state.super = true;
      this.onSuper?.();
    }
  };

  private onMouseUpWindow = (e: MouseEvent): void => {
    if (e.button === 0) {
      this.manualAttackHeld = false;
      this.state.attack = this.autoAttackHeld;
    }
    if (e.button === 2) this.state.super = false;
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  /**
   * Updates the world-space cursor every frame.
   *
   * If a joystick is currently steering aim, the world cursor is anchored
   * relative to the player's world position so that downstream `angleTo`
   * computations produce the joystick's chosen angle. Otherwise the mouse
   * position (in screen coords) is mapped through the camera offset as
   * before. The optional `playerX/Y` arguments allow modes to opt into
   * joystick aiming without restructuring their update loop.
   */
  updateWorldMouse(camX: number, camY: number, playerX?: number, playerY?: number, zoom = 1.0): void {
    if (this._networkAimLock) return;
    if (
      typeof playerX === "number" && typeof playerY === "number" &&
      (this.attackJoystick.active || this.superJoystick.active)
    ) {
      // Active super takes priority for the visible aim while held — release
      // restores the attack joystick's choice (or last mouse pos).
      const angle = this.superJoystick.active ? this.superJoystick.angle : this.attackJoystick.angle;
      this.state.mouseWorldX = playerX + Math.cos(angle) * 1000;
      this.state.mouseWorldY = playerY + Math.sin(angle) * 1000;
      return;
    }
    // Screen pixel → world unit: divide by zoom factor then offset by camera.
    this.state.mouseWorldX = this.state.mouseX / zoom + camX;
    this.state.mouseWorldY = this.state.mouseY / zoom + camY;
  }

  // ------------------ Mobile joystick API ------------------

  /**
   * Sets the analog movement joystick. Magnitude > deadzone activates the
   * 4 movement booleans by quadrant decomposition (sign of dx/dy).
   * Magnitude 0 / inactive clears all four. Keyboard movement keeps working
   * while the movement joystick is idle.
   */
  setMovementJoystick(dx: number, dy: number): void {
    const mag = Math.hypot(dx, dy);
    if (mag < 0.18) {
      this.movementJoystick.active = false;
      this.movementJoystick.magnitude = 0;
      this.state.up = false;
      this.state.down = false;
      this.state.left = false;
      this.state.right = false;
      return;
    }
    const angle = Math.atan2(dy, dx);
    this.movementJoystick.active = true;
    this.movementJoystick.angle = angle;
    this.movementJoystick.magnitude = Math.min(1, mag);
    this.state.right = dx >  0.18;
    this.state.left  = dx < -0.18;
    this.state.down  = dy >  0.18;
    this.state.up    = dy < -0.18;
  }

  /** Updates the attack joystick's aim. When `active` is true the world
   * cursor anchors to the player + cos/sin(angle) on the next update. */
  setAttackJoystick(active: boolean, angle: number, magnitude = 1): void {
    this.attackJoystick.active = active;
    if (active) {
      this.attackJoystick.angle = angle;
      this.attackJoystick.magnitude = magnitude;
    }
  }

  setSuperJoystick(active: boolean, angle: number, magnitude = 1): void {
    this.superJoystick.active = active;
    if (active) {
      this.superJoystick.angle = angle;
      this.superJoystick.magnitude = magnitude;
    }
  }

  /**
   * Fire the attack callback exactly once. When called from the mobile
   * joystick, pass the player's current world position so the world-space
   * cursor is committed synchronously from the joystick angle — eliminating
   * the up-to-one-frame staleness that would otherwise occur between the
   * pointer-up event and the next `updateWorldMouse` tick.
   */
  triggerAttack(playerX?: number, playerY?: number): void {
    if (!this.onAttack) return;
    if (
      typeof playerX === "number" && typeof playerY === "number" &&
      this.attackJoystick.active
    ) {
      const angle = this.attackJoystick.angle;
      const mag = this.attackJoystick.magnitude;
      const dist = mag > 0.01 ? mag * 1000 : 1000;
      this.state.mouseWorldX = playerX + Math.cos(angle) * dist;
      this.state.mouseWorldY = playerY + Math.sin(angle) * dist;
    }
    this.state.attack = true;
    // One-shot flag survives until the next network send so server-authoritative
    // battles register tap / auto-aim attacks (buildInput reads manualAttackPending).
    this.manualAttackPending = true;
    this.onAttack();
    queueMicrotask(() => {
      this.state.attack = false;
    });
  }

  /**
   * @param superAimMag 0…1 from mobile super stick; placed-area supers use
   * `mag * 300` world units instead of a fixed 1000px ray.
   */
  /** Block human input while AFK bot controls the player. */
  suppressForAfk(): void {
    this.state.up = false;
    this.state.down = false;
    this.state.left = false;
    this.state.right = false;
    this.state.attack = false;
    this.state.super = false;
    this.autoAttackHeld = false;
    this.manualAttackHeld = false;
    this.manualAttackPending = false;
    this.movementJoystick.active = false;
    this.movementJoystick.magnitude = 0;
    this.attackJoystick.active = false;
    this.superJoystick.active = false;
  }

  triggerSuper(playerX?: number, playerY?: number, superAimMag = 0): void {
    if (!this.onSuper) return;
    if (typeof playerX === "number" && typeof playerY === "number") {
      if (this.superJoystick.active && superAimMag > 0.01) {
        const angle = this.superJoystick.angle;
        this.superJoystick.magnitude = superAimMag;
        const dist = superAimMag * 300;
        this.state.mouseWorldX = playerX + Math.cos(angle) * dist;
        this.state.mouseWorldY = playerY + Math.sin(angle) * dist;
      } else {
        this.state.mouseWorldX = playerX;
        this.state.mouseWorldY = playerY;
      }
    }
    this.state.super = true;
    this.onSuper();
    queueMicrotask(() => { this.state.super = false; });
  }

  /** Clear stale mobile sticks / attack flags at battle start (keep WASD held keys). */
  resetBattleControls(): void {
    this.state.attack = false;
    this.state.super = false;
    this.autoAttackHeld = false;
    this.manualAttackHeld = false;
    this.manualAttackPending = false;
    this.movementJoystick.active = false;
    this.movementJoystick.magnitude = 0;
    this.attackJoystick.active = false;
    this.superJoystick.active = false;
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMoveWindow);
    window.removeEventListener("mousedown", this.onMouseDownWindow);
    window.removeEventListener("mouseup", this.onMouseUpWindow);
    window.removeEventListener("pointerdown", this.onPointerDownCapture, true);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
  }
}
