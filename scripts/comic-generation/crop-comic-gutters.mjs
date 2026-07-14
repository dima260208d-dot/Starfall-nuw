/**
 * Trims empty black/white letterbox gutters on all four sides without touching panel art.
 * Only removes outer rows/columns where ≥98% of pixels are empty gutter.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const comicsRoot = path.join(repoRoot, "public", "assets", "comics");

const BLACK_MAX = 42;
const WHITE_MIN = 228;
const GUTTER_RATIO_MIN = 0.98;
const MIN_TRIM_PX = 6;
const MAX_TRIM_RATIO = 0.45;

function collectPngs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) collectPngs(full, out);
    else if (name.endsWith(".png")) out.push(full);
  }
  return out;
}

/** Empty margin: near-black, near-white, or UI letterbox (#05020d). */
function isGutterPixel(r, g, b) {
  if (r <= BLACK_MAX && g <= BLACK_MAX && b <= BLACK_MAX) return true;
  if (r >= WHITE_MIN && g >= WHITE_MIN && b >= WHITE_MIN) return true;
  if (r <= 14 && g <= 10 && b <= 22) return true;
  return false;
}

function columnGutterRatio(data, width, height, channels, col) {
  let gutter = 0;
  for (let y = 0; y < height; y++) {
    const i = (y * width + col) * channels;
    if (isGutterPixel(data[i], data[i + 1], data[i + 2])) gutter++;
  }
  return gutter / height;
}

function rowGutterRatio(data, width, height, channels, row) {
  let gutter = 0;
  for (let x = 0; x < width; x++) {
    const i = (row * width + x) * channels;
    if (isGutterPixel(data[i], data[i + 1], data[i + 2])) gutter++;
  }
  return gutter / width;
}

function findGutterTrim(data, width, height, channels) {
  const maxTrimX = Math.floor(width * MAX_TRIM_RATIO);
  const maxTrimY = Math.floor(height * MAX_TRIM_RATIO);

  let left = 0;
  while (
    left < width - 1 &&
    left < maxTrimX &&
    columnGutterRatio(data, width, height, channels, left) >= GUTTER_RATIO_MIN
  ) {
    left++;
  }

  let right = width - 1;
  while (
    right > left &&
    width - 1 - right < maxTrimX &&
    columnGutterRatio(data, width, height, channels, right) >= GUTTER_RATIO_MIN
  ) {
    right--;
  }

  let top = 0;
  while (
    top < height - 1 &&
    top < maxTrimY &&
    rowGutterRatio(data, width, height, channels, top) >= GUTTER_RATIO_MIN
  ) {
    top++;
  }

  let bottom = height - 1;
  while (
    bottom > top &&
    height - 1 - bottom < maxTrimY &&
    rowGutterRatio(data, width, height, channels, bottom) >= GUTTER_RATIO_MIN
  ) {
    bottom--;
  }

  const trimLeft = left;
  const trimRight = width - 1 - right;
  const trimTop = top;
  const trimBottom = height - 1 - bottom;
  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;

  const hasTrim =
    trimLeft >= MIN_TRIM_PX ||
    trimRight >= MIN_TRIM_PX ||
    trimTop >= MIN_TRIM_PX ||
    trimBottom >= MIN_TRIM_PX;

  if (!hasTrim || cropWidth <= 0 || cropHeight <= 0) return null;
  if (cropWidth >= width && cropHeight >= height) return null;

  return {
    left,
    top,
    width: cropWidth,
    height: cropHeight,
    trimLeft,
    trimRight,
    trimTop,
    trimBottom,
  };
}

async function trimGutters(file, dryRun = false) {
  const img = sharp(file);
  const meta = await img.metadata();
  if (!meta.width || !meta.height) return { changed: false };

  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const trim = findGutterTrim(data, width, height, channels);
  if (!trim) return { changed: false };

  if (!dryRun) {
    const buf = await sharp(file)
      .extract({
        left: trim.left,
        top: trim.top,
        width: trim.width,
        height: trim.height,
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
    fs.writeFileSync(file, buf);
  }

  return {
    changed: true,
    from: `${meta.width}x${meta.height}`,
    to: `${trim.width}x${trim.height}`,
    trimLeft: trim.trimLeft,
    trimRight: trim.trimRight,
    trimTop: trim.trimTop,
    trimBottom: trim.trimBottom,
  };
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyId = args.find((a) => !a.startsWith("-"));

const roots = onlyId
  ? [path.join(comicsRoot, onlyId)]
  : fs.readdirSync(comicsRoot).map((id) => path.join(comicsRoot, id));

const files = roots.flatMap((r) => collectPngs(r));
let changed = 0;

for (const file of files) {
  try {
    const result = await trimGutters(file, dryRun);
    if (result.changed) {
      changed++;
      const msg = [
        `OK ${path.relative(comicsRoot, file)}`,
        `(${result.from} -> ${result.to}`,
        `L-${result.trimLeft} R-${result.trimRight}`,
        `T-${result.trimTop} B-${result.trimBottom})`,
      ].join(" ");
      console.log(dryRun ? `[dry] ${msg}` : msg);
    }
  } catch (err) {
    console.error(`FAIL ${file}:`, err.message);
  }
}

if (dryRun) {
  console.log(`Dry-run complete: ${changed}/${files.length} would be trimmed`);
} else {
  console.log(`Done: ${changed}/${files.length} trimmed`);
}
