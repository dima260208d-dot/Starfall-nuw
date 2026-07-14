import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const objDir = path.join(__dirname, "../public/dev-models/furniture/obj");
const out = path.join(__dirname, "../src/data/devImportedModels.ts");

const furniture = fs.readdirSync(objDir)
  .filter(f => f.endsWith(".obj"))
  .map(f => f.replace(/\.obj$/i, ""))
  .sort();

const content = `export type DevModelPack = "big" | "blob" | "furniture";

export type DevImportedModelKind = "gltf" | "obj";

export interface DevImportedModelEntry {
  id: string;
  pack: DevModelPack;
  packLabel: string;
  name: string;
  fileName: string;
  kind: DevImportedModelKind;
  /** Path under public/ (without leading slash). */
  assetPath: string;
  /** Optional companion material for OBJ models. */
  mtlPath?: string;
  color: string;
}

const PACK_META: Record<DevModelPack, { label: string; color: string }> = {
  big: { label: "Big Monsters", color: "#AB47BC" },
  blob: { label: "Blob Monsters", color: "#66BB6A" },
  furniture: { label: "Furniture (OBJ)", color: "#FFA726" },
};

const BIG_MODELS = [
  "Alien", "Birb", "BlueDemon", "Bunny", "Cactoro", "Demon", "Dino", "Fish",
  "Frog", "Monkroose", "MushroomKing", "Ninja", "Orc", "Orc_Skull", "Tribal", "Yeti",
] as const;

const BLOB_MODELS = [
  "Alien", "Birb", "Cactoro", "Cat", "Chicken", "Dog", "Fish", "GreenBlob",
  "GreenSpikyBlob", "Mushnub", "Mushnub_Evolved", "Ninja", "Orc", "Pigeon",
  "PinkBlob", "Wizard", "Yeti",
] as const;

const FURNITURE_MODELS = [
${furniture.map(n => `  "${n}",`).join("\n")}
] as const;

function gltfEntry(pack: "big" | "blob", name: string): DevImportedModelEntry {
  const meta = PACK_META[pack];
  return {
    id: \`\${pack}_\${name}\`,
    pack,
    packLabel: meta.label,
    name,
    fileName: \`\${name}.gltf\`,
    kind: "gltf",
    assetPath: \`dev-models/\${pack}/gltf/\${name}.gltf\`,
    color: meta.color,
  };
}

function objEntry(name: string): DevImportedModelEntry {
  const meta = PACK_META.furniture;
  return {
    id: \`furniture_\${name}\`,
    pack: "furniture",
    packLabel: meta.label,
    name,
    fileName: \`\${name}.obj\`,
    kind: "obj",
    assetPath: \`dev-models/furniture/obj/\${name}.obj\`,
    mtlPath: \`dev-models/furniture/obj/\${name}.mtl\`,
    color: meta.color,
  };
}

export const DEV_IMPORTED_MODELS: DevImportedModelEntry[] = [
  ...BIG_MODELS.map(n => gltfEntry("big", n)),
  ...BLOB_MODELS.map(n => gltfEntry("blob", n)),
  ...FURNITURE_MODELS.map(n => objEntry(n)),
];

export const DEV_MODEL_PACKS: { id: DevModelPack | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "big", label: PACK_META.big.label },
  { id: "blob", label: PACK_META.blob.label },
  { id: "furniture", label: PACK_META.furniture.label },
];

export function devImportedModelUrl(base: string, entry: DevImportedModelEntry): string {
  const b = base.endsWith("/") ? base : \`\${base}/\`;
  return \`\${b}\${entry.assetPath}\`;
}

export function devImportedModelAssetBase(base: string, entry: DevImportedModelEntry): string {
  const url = devImportedModelUrl(base, entry);
  return url.slice(0, url.lastIndexOf("/") + 1);
}
`;

fs.writeFileSync(out, content, "utf8");
console.log("Wrote", out, "with", furniture.length, "furniture models");
