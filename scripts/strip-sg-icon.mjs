import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const input = process.argv[2] ?? path.join(root, "public/ui/star-guardian-icon.png");
const output = process.argv[3] ?? path.join(root, "public/ui/star-guardian-icon.png");

const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = data;

for (let i = 0; i < px.length; i += 4) {
  const r = px[i];
  const g = px[i + 1];
  const b = px[i + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = (r + g + b) / 3;

  let hue = 0;
  if (max !== min) {
    const d = max - min;
    if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) hue = ((b - r) / d + 2) * 60;
    else hue = ((r - g) / d + 4) * 60;
  }

  const warm = r >= g && g >= b * 0.85;
  const golden = warm && hue >= 8 && hue <= 62 && sat >= 0.14 && lum >= 30;
  const deepGold = warm && hue >= 8 && hue <= 55 && lum >= 25 && lum <= 140 && sat >= 0.08;
  const brightGlint = warm && lum >= 150 && sat >= 0.08 && r > 120;

  if (golden || deepGold || brightGlint) continue;
  px[i + 3] = 0;
}

await sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
  .trim({ threshold: 8 })
  .png({ compressionLevel: 9 })
  .toFile(output);

const meta = await sharp(output).metadata();
console.log(`Saved ${output} (${meta.width}x${meta.height})`);
