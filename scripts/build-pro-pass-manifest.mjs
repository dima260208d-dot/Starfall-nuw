import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const FREE_PIN_SUBJECTS = [
  "silver ranked league trophy cup with laurel wreath",
  "crossed bronze arena duel swords with orange sparks",
  "glowing cyan ranked power crystal shard",
  "fiery victory fist engulfed in orange flames",
  "golden five-point ranked champion star badge",
  "bullseye archery target with two arrows stuck",
  "small royal crown on purple ranked cape",
  "electric lightning bolt cracking a blue shield",
  "guardian knight shield with roman numeral I",
  "shining comet with green star trail",
  "cute skull winking with purple ranked headband",
  "military valor medal with red ribbon",
  "bronze second-place podium medal disc",
  "golden trident of ranked sea champion",
  "fierce eagle head with ranked league goggles",
  "small dragon hatchling breathing purple fire",
  "sleek rocket ship with ranked league decals",
  "purple magic comet streak with sparkles",
  "theater drama masks happy and fierce",
  "samurai katana blade with cherry blossom petal",
  "hunter bow with glowing green arrow",
  "mystic fortune orb with galaxy swirl inside",
  "crescent moon with silver ranked halo",
  "meteor rock with molten orange cracks",
  "circus tent top with ranked banner flag",
  "joker playing card with golden skull motif",
  "lucky dice pair showing double six stars",
  "evil eye amulet with ranked league symbol",
  "ember coal heart burning bright orange",
  "snowflake crystal with icy blue glow",
  "ocean wave curl with ranked surf trophy",
  "four-leaf clover with golden ranked stem",
  "musical note with electric green sound waves",
  "war horn trumpet with purple ranked banner",
  "golden trumpet fanfare with confetti burst",
];

const PAID_PIN_SUBJECTS = [
  "royal golden emperor crown with ruby gems",
  "legendary ranked mega diamond gem explosion",
  "inferno phoenix flame wings emblem",
  "supreme lightning god bolt on gold plate",
  "cosmic golden supernova ranked star",
  "ultimate champion golden trophy with wings",
  "majestic golden eagle with ranked laurel",
  "ancient golden dragon coiled around cup",
  "divine golden trident with pearl tips",
  "blazing golden comet with twin tails",
  "elite golden valor medal with diamonds",
  "mythic golden dual laser swords crossed",
  "arcane golden crystal ball with runes",
  "legendary golden meteor with rainbow aura",
  "mysterious golden phantom mask with stars",
];

const FREE_RAR = [
  "common", "common", "rare", "common", "rare", "epic", "common", "rare", "common", "epic",
  "rare", "common", "rare", "epic", "unique", "rare", "epic", "common", "rare", "epic",
  "common", "rare", "epic", "rare", "unique", "epic", "rare", "common", "epic", "rare",
  "epic", "unique", "rare", "epic", "common",
];

const PAID_RAR = [
  "epic", "epic", "unique", "epic", "golden", "unique", "epic", "golden", "unique", "epic",
  "golden", "unique", "epic", "golden", "unique",
];

const FREE_ICON_SUBJECTS = [
  "silver ranked trophy cup emblem",
  "purple champion star crest",
  "golden crown with three points",
  "electric lightning bolt crest",
  "knight shield with ranked V notch",
  "faceted ranked battle gem",
  "crossed swords heraldic crest",
  "laurel wreath victory circle",
  "valor medal disc emblem",
  "flame torch ranked icon",
  "target reticle ranked scope",
  "comet streak emblem",
  "dragon head silhouette crest",
  "eagle wings spread emblem",
  "mystic orb with ring",
  "crescent moon ranked badge",
  "ocean wave shield crest",
  "skull with crown humor emblem",
  "theater mask half fierce",
  "rocket launch ranked badge",
  "trident fork sea crest",
  "hunter bow arc emblem",
  "dice lucky star cube",
  "war horn curved emblem",
  "musical note pulse crest",
  "clover luck ranked leaf",
  "all-seeing eye ranked triangle",
  "ember spark heart crest",
  "meteor impact crater emblem",
  "star burst explosion crest",
  "katana blade diagonal emblem",
  "joker card spade crest",
  "circus star tent emblem",
  "snowflake frost crystal crest",
  "trumpet fanfare emblem",
];

const PAID_ICON_SUBJECTS = [
  "golden emperor crown crest",
  "legendary diamond explosion emblem",
  "golden phoenix wing crest",
  "supreme lightning gold bolt",
  "cosmic supernova star crest",
  "ultimate golden trophy wings",
  "golden eagle laurel emblem",
  "golden dragon circle crest",
  "divine golden trident emblem",
  "golden comet twin tail crest",
  "elite diamond medal emblem",
  "mythic golden crossed blades",
  "arcane golden rune orb",
  "legendary rainbow meteor crest",
  "golden phantom star mask",
];

const RARITY_HINT = {
  common: "common tier, silver-gray burst frame accents",
  rare: "rare tier, blue energy burst accents",
  epic: "epic tier, purple magical glow accents",
  unique: "unique tier, orange-red dramatic accents",
  golden: "golden legendary tier, shiny gold aura accents",
};

const pins = [
  ...FREE_PIN_SUBJECTS.map((subject, i) => ({
    id: `g_pro_${String(i + 1).padStart(2, "0")}`,
    rarity: FREE_RAR[i],
    goldenFrame: false,
    subject,
    prompt: [
      "Single Brawl Stars style in-game collectible pin emote sticker.",
      `Unique ranked Pro Star Pass reward: ${subject}.`,
      RARITY_HINT[FREE_RAR[i]],
      "Thick cartoon black outlines, vibrant saturated mobile game colors.",
      "One icon only, centered, fills 85% of canvas.",
      "NO background, NO backdrop, fully transparent alpha PNG.",
      "No text, no sheet, no multiple icons.",
    ].join(" "),
  })),
  ...PAID_PIN_SUBJECTS.map((subject, i) => ({
    id: `g2_pro_${String(i + 1).padStart(2, "0")}`,
    rarity: PAID_RAR[i],
    goldenFrame: true,
    subject,
    prompt: [
      "Single Brawl Stars style premium in-game collectible pin emote sticker.",
      `Unique ranked Pro Star Pass PAID reward: ${subject}.`,
      RARITY_HINT[PAID_RAR[i]] + " Premium golden frame accents.",
      "Thick cartoon black outlines, vibrant saturated mobile game colors.",
      "One icon only, centered, fills 85% of canvas.",
      "NO background, NO backdrop, fully transparent alpha PNG.",
      "No text, no sheet, no multiple icons.",
    ].join(" "),
  })),
];

const icons = [
  ...FREE_ICON_SUBJECTS.map((subject, i) => ({
    id: `pro_${String(i + 1).padStart(3, "0")}`,
    proId: `pro:${String(i + 1).padStart(3, "0")}`,
    paid: false,
    subject,
    prompt: [
      "Single unique player profile icon emblem for ranked Pro Star Pass.",
      `Subject: ${subject}.`,
      "Brawl Stars cartoon style, thick black outlines, bold colorful emblem only.",
      "Centered icon, NO square background, NO circle plate, fully transparent alpha PNG.",
      "No text labels, one emblem only.",
    ].join(" "),
  })),
  ...PAID_ICON_SUBJECTS.map((subject, i) => ({
    id: `pro_${String(100 + i + 1).padStart(3, "0")}`,
    proId: `pro:${String(100 + i + 1).padStart(3, "0")}`,
    paid: true,
    subject,
    prompt: [
      "Single unique premium gold player profile icon emblem for ranked Pro Star Pass paid track.",
      `Subject: ${subject}.`,
      "Brawl Stars cartoon style, thick black outlines, golden and jewel-tone emblem only.",
      "Centered icon, NO square background, NO circle plate, fully transparent alpha PNG.",
      "No text labels, one emblem only.",
    ].join(" "),
  })),
];

const out = path.join(root, "scripts", "pro-pass-manifest.json");
fs.writeFileSync(out, JSON.stringify({ pins, icons }, null, 2), "utf8");
console.log("Wrote", out, "pins:", pins.length, "icons:", icons.length);
