/** Shared prompts for single-pin image generation (one icon per request). */

const RARITY_HINT = {
  common: "common tier, silver-gray rim accents, simple cheerful design",
  rare: "rare tier, blue energy burst accents",
  epic: "epic tier, purple magical glow accents",
  unique: "unique tier, orange-red dramatic accents",
  golden: "golden legendary tier, shiny gold highlights and golden aura",
};

export function buildCollectiblePinPrompt(pin) {
  const hint = RARITY_HINT[pin.rarity] ?? RARITY_HINT.common;
  const gold = pin.goldenFrame || pin.rarity === "golden" ? " Premium golden frame accents." : "";
  return [
    "Single Brawl Stars style in-game pin emote sticker icon.",
    `Subject: ${pin.label} (${pin.emoji}).`,
    hint + gold,
    "Thick cartoon black outlines, vibrant saturated colors, cute expressive game UI art.",
    "One icon only, centered, fills about 85% of canvas.",
    "NO background, NO backdrop, NO square, fully transparent alpha PNG.",
    "No sheet layout, no multiple icons, no text labels.",
  ].join(" ");
}

export function buildUniversalPinPrompt(pin) {
  return [
    "Single Brawl Stars style chat emote pin icon.",
    `Emotion: ${pin.label} (${pin.emoji}).`,
    "Yellow round emoji face with bold gesture, thick black outlines, cute mobile game style.",
    "One icon only, centered.",
    "NO background, NO outer speech-bubble plate, fully transparent alpha PNG.",
    "No sheet, no multiple emotes.",
  ].join(" ");
}

export function buildPinPrompt(pin) {
  return pin.dir === "general" ? buildUniversalPinPrompt(pin) : buildCollectiblePinPrompt(pin);
}
