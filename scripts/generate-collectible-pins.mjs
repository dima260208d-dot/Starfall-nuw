/**
 * @deprecated Legacy emoji SVG generator — game pins now use PNG from pin_sheets (npm run pins:slice).
 * Do not run in production; Tailwind may scan this file for .svg paths.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "pins", "game");

const COMMON = [
  ["g_coin_stack", "🪙"], ["g_sword", "⚔️"], ["g_shield", "🛡️"], ["g_star", "⭐"],
  ["g_fire", "🔥"], ["g_ice", "❄️"], ["g_bolt", "⚡"], ["g_skull", "💀"],
  ["g_clover", "🍀"], ["g_target", "🎯"], ["g_flag", "🏁"], ["g_bell", "🔔"],
  ["g_key", "🗝️"], ["g_book", "📖"], ["g_music", "🎵"], ["g_ball", "⚽"],
  ["g_pizza", "🍕"], ["g_coffee", "☕"], ["g_dragon", "🐉"], ["g_wolf", "🐺"],
  ["g_eagle", "🦅"], ["g_gem", "💎"], ["g_crown", "👑"], ["g_rocket", "🚀"],
  ["g_ufo", "🛸"], ["g_ghost", "👻"], ["g_alien", "👽"], ["g_robot", "🤖"],
  ["g_pirate", "🏴‍☠️"], ["g_ninja", "🥷"], ["g_wizard", "🧙"], ["g_viking", "⚓"],
  ["g_phoenix", "🔥"], ["g_kraken", "🐙"], ["g_unicorn", "🦄"], ["g_comet", "☄️"],
  ["g_trophy", "🏆"], ["g_medal", "🎖️"], ["g_champion", "🥇"],
  ["g_boss", "👹"], ["g_demon", "😈"], ["g_angel", "😇"],
  ["g_legend", "🌟"], ["g_mythic", "✨"], ["g_void", "🕳️"], ["g_time", "⏳"],
  ["g_chaos", "🌀"], ["g_order", "⚖️"], ["g_infinity", "♾️"], ["g_glitch", "📺"],
  ["g_nebula", "🌠"], ["g_eclipse", "🌑"], ["g_gold_king", "👑"], ["g_gold_dragon", "🐲"],
  ["g_gold_star", "🌟"], ["g_gold_gem", "💠"], ["g_gold_crown", "🏆"], ["g_gold_legend", "✴️"],
];

const c1 = "#B0BEC5", c2 = "#546E7A";

function svgFor(id, emoji) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
  <rect x="4" y="4" width="120" height="120" rx="28" fill="url(#g)" stroke="#37474F" stroke-width="5"/>
  <rect x="14" y="14" width="100" height="100" rx="22" fill="rgba(0,0,0,0.28)"/>
  <text x="64" y="78" text-anchor="middle" font-size="52">${emoji}</text>
</svg>`;
}

fs.mkdirSync(outDir, { recursive: true });
for (const [id, emoji] of COMMON) {
  fs.writeFileSync(path.join(outDir, `${id}.svg`), svgFor(id, emoji), "utf8");
}
console.log(`Wrote ${COMMON.length} common SVG pins`);
