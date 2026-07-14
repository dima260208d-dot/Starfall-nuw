/**
 * Brawler battle VFX sprites — chroma-processed PNGs from public/vfx/brawlers/.
 */
import { resolvePublicAssetUrl } from "../lib/assetBase";
import {
  type BrawlerVfxSlot,
  brawlerVfxPath,
  isBrawlerVfxId,
  BRAWLER_VFX_IDS,
} from "../data/brawlerVfxManifest";

const cache = new Map<string, HTMLImageElement>();
const loading = new Map<string, Promise<HTMLImageElement | null>>();

function key(id: string, slot: BrawlerVfxSlot): string {
  return `${id}:${slot}`;
}

function loadSprite(id: string, slot: BrawlerVfxSlot): Promise<HTMLImageElement | null> {
  if (!isBrawlerVfxId(id)) return Promise.resolve(null);
  const k = key(id, slot);
  const hit = cache.get(k);
  if (hit?.complete && hit.naturalWidth > 0) return Promise.resolve(hit);
  const pending = loading.get(k);
  if (pending) return pending;

  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      cache.set(k, img);
      loading.delete(k);
      resolve(img);
    };
    img.onerror = () => {
      loading.delete(k);
      resolve(null);
    };
    img.src = resolvePublicAssetUrl(brawlerVfxPath(id, slot).replace(/^\//, ""));
  });
  loading.set(k, p);
  return p;
}

/** Preload all brawler VFX before battle (optional — also lazy-loads on first draw). */
export function preloadBrawlerVfxSprites(): void {
  for (const id of BRAWLER_VFX_IDS) {
    for (const slot of ["attack", "ult", "impact"] as BrawlerVfxSlot[]) {
      void loadSprite(id, slot);
    }
  }
}

export function getBrawlerVfxImage(id: string | undefined, slot: BrawlerVfxSlot): HTMLImageElement | null {
  if (!id || !isBrawlerVfxId(id)) return null;
  const k = key(id, slot);
  const img = cache.get(k);
  if (img?.complete && img.naturalWidth > 0) return img;
  void loadSprite(id, slot);
  return null;
}

export function drawBrawlerVfxSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number,
  sy: number,
  angle: number,
  size: number,
  alpha = 1,
): void {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return;
  const scale = size / Math.max(w, h);
  const dw = w * scale;
  const dh = h * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

export { loadSprite as loadBrawlerVfxSprite };
