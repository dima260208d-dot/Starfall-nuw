/** Maps emoji → PNG under public/ (nav icons reused where they match). */
export function emojiSlug(emoji: string): string {
  return [...emoji.replace(/\uFE0F/g, "")]
    .map((c) => "u" + c.codePointAt(0)!.toString(16).padStart(4, "0"))
    .join("-");
}

function normalizeEmoji(emoji: string): string {
  return emoji.replace(/\uFE0F/g, "").trim();
}

/** Prefer existing nav/UI art; fallback to public/ui/emojis/{slug}.png */
const OVERRIDES: Record<string, string> = {
  "🎒": "ui/nav-collection.png",
  "🐾": "ui/nav-pets.png",
  "⭐": "ui/nav-feats.png",
  "🏛": "ui/nav-clubs.png",
  "🏛️": "ui/nav-clubs.png",
  "👥": "ui/nav-friends.png",
  "🛒": "ui/nav-shop.png",
  "🦸": "ui/nav-character.png",
  "🗝": "ui/nav-chests.png",
  "🗝️": "ui/nav-chests.png",
  "🎨": "ui/nav-customization.png",
  "🎁": "ui/nav-gifts.png",
  "📖": "ui/nav-comic.png",
  "✨": "ui/shop-tab-stars.png",
  "💎": "ui/shop-tab-donate.png",
  "💬": "ui/drawer-messages.png",
  "📰": "ui/drawer-news.png",
  "⚙": "ui/drawer-settings.png",
  "⚙️": "ui/drawer-settings.png",
  "⚔": "ui/drawer-battles.png",
  "⚔️": "ui/drawer-battles.png",
  "🏆": "ui/drawer-records.png",
  "🗺": "ui/drawer-map-editor.png",
  "🗺️": "ui/drawer-map-editor.png",
  "🛡": "ui/drawer-admin.png",
  "🛡️": "ui/drawer-admin.png",
  "🚪": "ui/drawer-logout.png",
  "📝": "ui/drawer-register.png",
  "👤": "ui/drawer-accounts.png",
  "🎯": "ui/char-btn-try.png",
  "🔥": "ui/nav-bonus.png",
  "📦": "ui/nav-chests.png",
  "🔒": "ui/emojis/u1f512.png",
  "❌": "ui/emojis/u274c.png",
  "✅": "ui/emojis/u2705.png",
  "⚡": "ui/emojis/u26a1.png",
  "💚": "ui/stat-healing-heart.png",
  "☠": "ui/emojis/u2620.png",
  "☠️": "ui/emojis/u2620.png",
  "💀": "ui/emojis/u1f480.png",
  // Text symbols without Twemoji PNG — map to closest raster icon
  "★": "ui/emojis/u2728.png",
  "☆": "ui/emojis/u2728.png",
  "♕": "ui/emojis/u1f451.png",
  "♛": "ui/emojis/u1f451.png",
  "✓": "ui/emojis/u2705.png",
  "✕": "ui/emojis/u274c.png",
  "✗": "ui/emojis/u274c.png",
  "✦": "ui/emojis/u2728.png",
  "✧": "ui/emojis/u2728.png",
  "✪": "ui/emojis/u2728.png",
  "✫": "ui/emojis/u2728.png",
  "✬": "ui/emojis/u2728.png",
  "✭": "ui/emojis/u2728.png",
  "✮": "ui/emojis/u2728.png",
  "✲": "ui/emojis/u2728.png",
  "✵": "ui/emojis/u2728.png",
  "✶": "ui/emojis/u2728.png",
  "✷": "ui/emojis/u2728.png",
  "✸": "ui/emojis/u2728.png",
  "✹": "ui/emojis/u2728.png",
  "✺": "ui/emojis/u2728.png",
  "✼": "ui/emojis/u2728.png",
  "✽": "ui/emojis/u2728.png",
  "✾": "ui/emojis/u2728.png",
  "✿": "ui/emojis/u1f339.png",
  "❀": "ui/emojis/u1f339.png",
  "❂": "ui/emojis/u2728.png",
  "❃": "ui/emojis/u2744.png",
  "❉": "ui/emojis/u2728.png",
  "❋": "ui/emojis/u1f343.png",
  "❖": "ui/emojis/u1f48e.png",
  "☇": "ui/emojis/u26a1.png",
  "☈": "ui/emojis/u26a1.png",
  "☉": "ui/emojis/u2600.png",
  "☊": "ui/emojis/u2640.png",
  "☋": "ui/emojis/u2642.png",
  "☌": "ui/emojis/u2640.png",
  "☍": "ui/emojis/u2642.png",
  "☼": "ui/emojis/u2600.png",
  "⛊": "ui/emojis/u1f6e1.png",
  "⛋": "ui/emojis/u1f6e1.png",
  "⛢": "ui/emojis/u2640.png",
  "⛭": "ui/emojis/u2699.png",
  "⛯": "ui/emojis/u26f0.png",
  "✙": "ui/emojis/u2795.png",
  "✚": "ui/emojis/u2795.png",
  "✛": "ui/emojis/u2795.png",
  "⏱": "ui/emojis/u23f1.png",
  "⏱️": "ui/emojis/u23f1.png",
  "⏳": "ui/emojis/u23f3.png",
  "❄": "ui/emojis/u2744.png",
  "❄️": "ui/emojis/u2744.png",
  "🛡": "ui/drawer-admin.png",
  "⚙️": "ui/drawer-settings.png",
  "⚗": "ui/emojis/u2697.png",
  "⚗️": "ui/emojis/u2697.png",
  "✈": "ui/emojis/u2708.png",
  "✈️": "ui/emojis/u2708.png",
  "🌪": "ui/emojis/u1f32a.png",
  "🌪️": "ui/emojis/u1f32a.png",
  "⛰": "ui/emojis/u26f0.png",
  "⛰️": "ui/emojis/u26f0.png",
  "❤": "ui/emojis/u2764.png",
  "❤️": "ui/emojis/u2764.png",
  "🖼": "ui/emojis/u1f5bc.png",
  "🖼️": "ui/emojis/u1f5bc.png",
  "👁": "ui/emojis/u1f441.png",
  "👁️": "ui/emojis/u1f441.png",
  "✜": "ui/emojis/u2795.png",
  "🪽": "ui/emojis/u1fab7.png",
};

export function getEmojiIconPath(emoji: string): string | null {
  if (typeof emoji !== "string") return null;
  const trimmed = emoji.trim();
  if (!trimmed) return null;
  const bare = normalizeEmoji(trimmed);
  if (OVERRIDES[trimmed]) return OVERRIDES[trimmed];
  if (OVERRIDES[bare]) return OVERRIDES[bare];
  const slug = emojiSlug(bare);
  return `ui/emojis/${slug}.png`;
}

export function listEmojisNeedingGeneration(allEmojis: string[]): string[] {
  return allEmojis.filter((e) => !OVERRIDES[e.trim()]);
}
