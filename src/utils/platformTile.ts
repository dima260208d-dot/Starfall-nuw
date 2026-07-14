/** BinbunGrass battle-floor tile (from SourceCode.zip). */

const TILE_PX = 512;
/** One texture tile covers this many world pixels when RepeatWrapping is used. */
const TILE_WORLD_PX = 480;

/** palette_01.tres — ground color gradient. */
const GRASS_STOPS: { t: number; rgb: readonly [number, number, number] }[] = [
  { t: 0.167, rgb: [168, 202, 88] },
  { t: 0.5, rgb: [117, 167, 67] },
  { t: 0.833, rgb: [70, 130, 50] },
];

export const PLATFORM_FALLBACK_COLOR = 0x75a743;

let cachedCanvas: HTMLCanvasElement | null = null;
let cachedAspect = 1;
let loadPromise: Promise<HTMLCanvasElement | null> | null = null;

export function getPlatformTileCanvas(): HTMLCanvasElement | null {
  return cachedCanvas;
}

export function getPlatformTileAspect(): number {
  return cachedAspect;
}

/** World pixels covered by one grass tile (for RepeatWrapping on the ground plane). */
export function getPlatformTileWorldSize(): number {
  return TILE_WORLD_PX;
}

export function invalidatePlatformTileCanvas(): void {
  cachedCanvas = null;
  cachedAspect = 1;
  loadPromise = null;
}

function gradColor(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  for (let i = 0; i < GRASS_STOPS.length - 1; i++) {
    const a = GRASS_STOPS[i];
    const b = GRASS_STOPS[i + 1];
    if (x >= a.t && x <= b.t) {
      const f = (x - a.t) / (b.t - a.t);
      return [
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f),
      ];
    }
  }
  const last = GRASS_STOPS[GRASS_STOPS.length - 1].rgb;
  return [last[0], last[1], last[2]];
}

/** Seamless periodic noise — matches BinbunGrass ground.gdshader feel. */
function seamlessNoise(x: number, y: number, size: number): number {
  const fx = (x / size) * Math.PI * 2;
  const fy = (y / size) * Math.PI * 2;
  let v = 0;
  v += Math.sin(fx * 2.0 + fy * 1.3) * 0.34;
  v += Math.sin(fx * 3.7 - fy * 2.1 + 1.7) * 0.24;
  v += Math.sin(fx * 5.1 + fy * 4.3) * 0.18;
  v += Math.cos(fx * 1.1 - fy * 3.5) * 0.12;
  v += Math.sin(fx * 7.0 + fy * 6.0) * 0.12;
  return (v + 1) * 0.5;
}

function tileHash(gx: number, gy: number, grid: number): number {
  const x = gx / grid;
  const y = gy / grid;
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

function drawTintedGrassBlade(
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  rgb: [number, number, number],
): void {
  const tmp = document.createElement("canvas");
  tmp.width = sw;
  tmp.height = sh;
  const tctx = tmp.getContext("2d", { willReadFrequently: true });
  if (!tctx) return;
  tctx.drawImage(atlas, sx, sy, sw, sh, 0, 0, sw, sh);
  const data = tctx.getImageData(0, 0, sw, sh);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const shape = px[i]; // grayscale blade mask on black
    if (shape < 8) {
      px[i + 3] = 0;
      continue;
    }
    px[i] = rgb[0];
    px[i + 1] = rgb[1];
    px[i + 2] = rgb[2];
    px[i + 3] = shape;
  }
  tctx.putImageData(data, 0, 0);
  ctx.drawImage(tmp, dx, dy, dw, dh);
}

async function bakeBinbunGrassTile(baseUrl: string): Promise<HTMLCanvasElement> {
  const atlasUrl = `${baseUrl.replace(/\/$/, "")}/textures/binbun-grass/grass_basic_atlas.png`;
  const atlas = await loadImage(atlasUrl);

  const canvas = document.createElement("canvas");
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.createImageData(TILE_PX, TILE_PX);

  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const n = seamlessNoise(x, y, TILE_PX);
      const [r, g, b] = gradColor(n);
      const i = (y * TILE_PX + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const atlasCell = atlas.width / 2;
  const grid = 10;
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const h1 = tileHash(gx, gy, grid);
      const h2 = tileHash(gx + 17, gy + 31, grid);
      const h3 = tileHash(gx + 53, gy + 97, grid);
      const px = ((gx + h1 * 0.75) / grid) * TILE_PX;
      const py = ((gy + h2 * 0.75) / grid) * TILE_PX;
      const atlasIdx = Math.floor(h3 * 4) % 4;
      const ax = (atlasIdx % 2) * atlasCell;
      const ay = Math.floor(atlasIdx / 2) * atlasCell;
      const scale = 0.11 + h1 * 0.07;
      const dw = atlasCell * scale;
      const dh = atlasCell * scale;
      const n = seamlessNoise(px, py, TILE_PX);
      const rgb = gradColor(Math.min(1, n + 0.08));
      drawTintedGrassBlade(ctx, atlas, ax, ay, atlasCell, atlasCell, px - dw * 0.5, py - dh * 0.92, dw, dh, rgb);
    }
  }

  return canvas;
}

export function loadPlatformTile(): Promise<HTMLCanvasElement | null> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const baseUrl: string = (import.meta as any).env?.BASE_URL ?? "/";
      cachedCanvas = await bakeBinbunGrassTile(baseUrl);
      cachedAspect = 1;
    } catch (e) {
      console.warn("[platformTile] Failed to bake BinbunGrass tile", e);
      cachedCanvas = null;
      cachedAspect = 1;
    }
    return cachedCanvas;
  })();
  return loadPromise;
}
