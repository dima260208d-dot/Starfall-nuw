/** Stub canvas for headless Node bundle */
export default class CanvasStub {
  width = 1200;
  height = 800;
  getContext() {
    return {
      canvas: this,
      fillRect() {},
      clearRect() {},
      drawImage() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      fillText() {},
      measureText: () => ({ width: 0 }),
    };
  }
}
