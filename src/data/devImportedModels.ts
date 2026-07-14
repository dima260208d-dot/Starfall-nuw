export type DevModelPack = "big" | "blob" | "furniture";

import { getHeavyAssetBaseUrl, getUiAssetBaseUrl } from "../lib/assetBase";
import { getAdminSetting } from "./adminSettingsManifest";
import { isDevMonsterModelDisabled } from "../utils/devMonsterModelPrefs";

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
  "Bathroom_Bathtub",
  "Bathroom_Mirror1",
  "Bathroom_Mirror2",
  "Bathroom_Shower1",
  "Bathroom_Sink",
  "Bathroom_Toilet",
  "Bathroom_Toilet2",
  "Bathroom_ToiletPaper",
  "Bathroom_ToiletPaperPile",
  "Bathroom_Towel",
  "Bathroom_WashingMachine",
  "Bed_Bunk",
  "Bed_King",
  "Bed_Single",
  "Bookshelf",
  "Carpet_1",
  "Carpet_2",
  "Carpet_Round",
  "Chair_1",
  "Chair_2",
  "Chair_3",
  "Chair_4",
  "Column_Round1",
  "Column_Round2",
  "Column_Round3",
  "Column_SquareBig",
  "Column_SquareSmall",
  "Couch_L",
  "Couch_Large1",
  "Couch_Large2",
  "Couch_Large3",
  "Couch_Medium1",
  "Couch_Medium2",
  "Couch_Small1",
  "Couch_Small2",
  "Curtains_Double",
  "Curtains_Single",
  "Door_1",
  "Door_2",
  "Door_3",
  "Door_4",
  "Door_5",
  "Door_6",
  "Door_7",
  "Door_8",
  "Door_9",
  "Door_Double",
  "Drawer_1",
  "Drawer_2",
  "Drawer_3",
  "Drawer_4",
  "Drawer_5",
  "Fireplace",
  "Fork",
  "Houseplant_1",
  "Houseplant_2",
  "Houseplant_3",
  "Houseplant_4",
  "Houseplant_5",
  "Houseplant_6",
  "Houseplant_7",
  "Houseplant_8",
  "Kitchen_1Drawers",
  "Kitchen_2Drawers",
  "Kitchen_3Drawers",
  "Kitchen_Cabinet1",
  "Kitchen_Cabinet2",
  "Kitchen_CabinetSmall",
  "Kitchen_Fridge",
  "Kitchen_Oven",
  "Kitchen_Oven_Large",
  "Kitchen_Sink",
  "Knife",
  "Light_Ceiling1",
  "Light_Ceiling2",
  "Light_Ceiling3",
  "Light_Ceiling4",
  "Light_Ceiling5",
  "Light_Ceiling6",
  "Light_CeilingSingle",
  "Light_Chandelier",
  "Light_Cube",
  "Light_Cube2",
  "Light_Desk",
  "Light_Floor1",
  "Light_Floor2",
  "Light_Floor3",
  "Light_Floor4",
  "Light_Icosahedron",
  "Light_Icosahedron2",
  "Light_Small",
  "Light_Stand1",
  "Light_Stand2",
  "NightStand_1",
  "NightStand_2",
  "NightStand_3",
  "Plate_1",
  "Plate_2",
  "Plate_3",
  "Shelf_1",
  "Shelf_2",
  "Shelf_Large",
  "Shelf_Small1",
  "Shelf_Small2",
  "Shelf_Small3",
  "Spoon",
  "Stool",
  "Table_RoundLarge",
  "Table_RoundSmall",
  "Table_RoundSmall2",
  "Trashcan_Cylindric",
  "Trashcan_Green",
  "Trashcan_Large",
  "Trashcan_Small1",
  "Trashcan_Small2",
  "Window_Large1",
  "Window_Large2",
  "Window_Round1",
  "Window_Round2",
  "Window_Round3",
  "Window_Small1",
  "Window_Small2",
  "Window_Small3",
] as const;

function gltfEntry(pack: "big" | "blob", name: string): DevImportedModelEntry {
  const meta = PACK_META[pack];
  return {
    id: `${pack}_${name}`,
    pack,
    packLabel: meta.label,
    name,
    fileName: `${name}.gltf`,
    kind: "gltf",
    assetPath: `dev-models/${pack}/gltf/${name}.gltf`,
    color: meta.color,
  };
}

function objEntry(name: string): DevImportedModelEntry {
  const meta = PACK_META.furniture;
  return {
    id: `furniture_${name}`,
    pack: "furniture",
    packLabel: meta.label,
    name,
    fileName: `${name}.obj`,
    kind: "obj",
    assetPath: `dev-models/furniture/obj/${name}.obj`,
    mtlPath: `dev-models/furniture/obj/${name}.mtl`,
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

/** Base URL for dev-models: CDN when maps.cdn_tiles, else bundled public/. */
export function getDevImportedModelBaseUrl(): string {
  if (getAdminSetting<boolean>("maps.cdn_tiles", true)) {
    return getHeavyAssetBaseUrl();
  }
  return getUiAssetBaseUrl();
}

export function devImportedModelUrl(base: string, entry: DevImportedModelEntry): string {
  const b = base.endsWith("/") ? base : `${base}/`;
  return `${b}${entry.assetPath}`;
}

export function devImportedModelAssetBase(base: string, entry: DevImportedModelEntry): string {
  const url = devImportedModelUrl(base, entry);
  return url.slice(0, url.lastIndexOf("/") + 1);
}

/** Боевые 3D-монстры (big + blob), без мебели. */
export const DEV_MONSTER_MODELS: DevImportedModelEntry[] = DEV_IMPORTED_MODELS.filter(
  m => m.pack === "big" || m.pack === "blob",
);

/** Монстры, не отключённые в админке — используются в бою. */
export function getActiveDevMonsterModels(): DevImportedModelEntry[] {
  return DEV_MONSTER_MODELS.filter(m => !isDevMonsterModelDisabled(m.id));
}

const DEV_MONSTER_BY_ID = new Map(DEV_MONSTER_MODELS.map(m => [m.id, m]));

export function getDevMonsterModelById(id: string): DevImportedModelEntry | undefined {
  if (isDevMonsterModelDisabled(id)) return undefined;
  return DEV_MONSTER_BY_ID.get(id);
}

export function pickRandomDevMonsterModel(): DevImportedModelEntry | null {
  const pool = getActiveDevMonsterModels();
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
