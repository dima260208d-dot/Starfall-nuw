import { applyCanvasBitmapDrawPolicy } from "../utils/texturePolicy";
import { brawlerAvatarUrl } from "../utils/modeAssets";

export interface SpriteSheet {
  image: HTMLImageElement;
  loaded: boolean;
}

const sheet: SpriteSheet = {
  image: new Image(),
  loaded: false,
};

export function loadSpriteSheet(src: string): Promise<void> {
  if (sheet.loaded || (sheet.image.complete && sheet.image.naturalWidth > 0)) {
    sheet.loaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      sheet.loaded = ok;
      resolve();
    };
    sheet.image.onload = () => finish(true);
    sheet.image.onerror = () => finish(false);
    sheet.image.src = src;
    if (sheet.image.complete) finish(sheet.image.naturalWidth > 0);
  });
}

// === Per-brawler 3D image renderer ===

interface BrawlerImagePair {
  front: HTMLImageElement;
  back: HTMLImageElement;
  frontReady: boolean;
  backReady: boolean;
}

const brawlerImages: Record<string, BrawlerImagePair> = {};
let brawlerImagesLoaded = false;
let brawlerImagesPromise: Promise<void> | null = null;

function loadAvatarImage(img: HTMLImageElement, src: string, onReady: () => void): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      onReady();
      resolve();
    };
    img.onload = finish;
    img.onerror = finish;
    img.src = src;
    if (img.complete) finish();
  });
}

const AVATAR_LOAD_BATCH = 8;

export function loadBrawlerImages(ids: string[], basePath = "/"): Promise<void> {
  if (brawlerImagesLoaded) return Promise.resolve();
  if (brawlerImagesPromise) return brawlerImagesPromise;

  const base = basePath.endsWith("/") ? basePath : basePath + "/";
  brawlerImagesPromise = (async () => {
    const tasks: Promise<void>[] = [];
    for (const id of ids) {
      let pair = brawlerImages[id];
      if (!pair) {
        const front = new Image();
        const back = new Image();
        pair = { front, back, frontReady: false, backReady: false };
        brawlerImages[id] = pair;
      }
      if (!pair.frontReady) {
        tasks.push(loadAvatarImage(
          pair.front,
          brawlerAvatarUrl(id),
          () => { pair!.frontReady = true; },
        ));
      }
      if (!pair.backReady) {
        tasks.push(loadAvatarImage(
          pair.back,
          brawlerAvatarUrl(id),
          () => { pair!.backReady = true; },
        ));
      }
    }
    for (let i = 0; i < tasks.length; i += AVATAR_LOAD_BATCH) {
      await Promise.all(tasks.slice(i, i + AVATAR_LOAD_BATCH));
    }
    brawlerImagesLoaded = true;
  })().finally(() => {
    if (!brawlerImagesLoaded) brawlerImagesPromise = null;
  });

  return brawlerImagesPromise;
}

export function brawlerImageReady(id: string): boolean {
  const p = brawlerImages[id];
  return !!p && (p.frontReady || p.backReady);
}

export function areBrawlerImagesLoaded(): boolean {
  return brawlerImagesLoaded;
}

/**
 * Draw a brawler using its 3D PNG render, choosing front/back based on facing
 * angle and horizontally flipping when facing left. Top-down convention:
 * +x = right, +y = down. sin(angle) > 0 means facing toward camera (front view).
 */
export function drawBrawlerImage(
  ctx: CanvasRenderingContext2D,
  brawlerId: string,
  x: number,
  y: number,
  size: number,
  angle: number,
  alpha = 1,
  glowColor?: string,
): boolean {
  const pair = brawlerImages[brawlerId];
  if (!pair) return false;

  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);

  // Use back view when clearly facing up/away. Threshold avoids flicker on side angles.
  const useBack = sinA < -0.25 && pair.backReady;
  const img = useBack ? pair.back : pair.front;
  const ready = useBack ? pair.backReady : pair.frontReady;
  if (!ready) {
    // fall back to whichever is ready
    if (pair.frontReady) {
      // reuse front as fallback
    } else if (pair.backReady) {
      // use back if only back is ready
      return drawBrawlerImageInternal(ctx, pair.back, x, y, size, cosA, alpha, glowColor);
    } else {
      return false;
    }
  }

  return drawBrawlerImageInternal(ctx, img, x, y, size, cosA, alpha, glowColor);
}

function drawBrawlerImageInternal(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
  cosA: number,
  alpha: number,
  glowColor: string | undefined,
): boolean {
  if (!img.complete || img.naturalWidth === 0) return false;

  // Image is portrait (3:4). Compute draw size keeping aspect ratio,
  // anchored so the character's feet sit roughly on (x, y).
  const aspect = img.naturalHeight / img.naturalWidth;
  const w = size;
  const h = size * aspect;

  ctx.save();
  applyCanvasBitmapDrawPolicy(ctx);
  ctx.globalAlpha = alpha;
  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 18;
  }
  ctx.translate(x, y);
  if (cosA < 0) ctx.scale(-1, 1);
  // Anchor: horizontal center, vertical at ~75% down so feet rest at y
  ctx.drawImage(img, -w / 2, -h * 0.78, w, h);
  ctx.restore();
  return true;
}

export function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  row: number,
  col: number,
  x: number,
  y: number,
  size: number,
  flipX = false,
  alpha = 1,
  glowColor?: string
): void {
  if (!sheet.loaded) return;

  const imgW = sheet.image.naturalWidth;
  const imgH = sheet.image.naturalHeight;

  const cols = 5;
  const rows = 2;
  const sw = imgW / cols;
  const sh = imgH / rows;

  const sx = col * sw;
  const sy = row * sh;

  ctx.save();
  applyCanvasBitmapDrawPolicy(ctx);
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
  }

  if (flipX) {
    ctx.scale(-1, 1);
    ctx.drawImage(sheet.image, sx, sy, sw, sh, -size / 2, -size / 2, size, size);
  } else {
    ctx.drawImage(sheet.image, sx, sy, sw, sh, -size / 2, -size / 2, size, size);
  }
  ctx.restore();
}

export function drawFallbackCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  secondaryColor: string,
  accentColor: string,
  animFrame: number
): void {
  ctx.save();
  ctx.translate(x, y);

  const bounce = Math.sin(animFrame * 0.1) * 2;

  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(0, bounce, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = secondaryColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = secondaryColor;
  ctx.beginPath();
  ctx.arc(-radius * 0.3, bounce - radius * 0.15, radius * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(radius * 0.3, bounce - radius * 0.15, radius * 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-radius * 0.15, bounce + radius * 0.15, radius * 0.2, 0, Math.PI);
  ctx.stroke();

  ctx.restore();
}
