/**
 * Undo broken template-literal patches from patch-tsx-emojis-v2.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");

function fix(content) {
  let out = content;

  // title={" + /*emoji*/ "<EmojiIcon emoji=\"🏆\" size={20} /> " + t("records.title")}`}
  out = out.replace(
    /(\w+)=\{" \+ \/\*emoji\*\/ "<EmojiIcon emoji=\\"([^"\\]+)\\" size=\{(\d+)\} \/> " \+ t\("([^"]+)"\)`\}/g,
    (_, prop, em, size, key) =>
      `${prop}={<> <EmojiIcon emoji="${em}" size={${size}} /> <Tr id="${key}" /></>}`,
  );

  // Same with t("key") already Tr - use t() variant
  out = out.replace(
    /(\w+)=\{" \+ \/\*emoji\*\/ "<EmojiIcon emoji=\\"([^"\\]+)\\" size=\{(\d+)\} \/> " \+ ([^`]+)`\}/g,
    (_, prop, em, size, expr) =>
      `${prop}={<> <EmojiIcon emoji="${em}" size={${size}} /> {${expr.trim()}} </>}`,
  );

  // setStatus(" + /*emoji*/ "<EmojiIcon ... /> " + res.error}`);
  out = out.replace(
    /set(\w+)\(" \+ \/\*emoji\*\/ "<EmojiIcon emoji=\\"([^"\\]+)\\" size=\{(\d+)\} \/> " \+ ([^)]+)\)/g,
    (_, name, em, _size, expr) => {
      const sym = em === "❌" || em === "✗" ? "✗ " : em + " ";
      return `set${name}(\`${sym}\${${expr.trim()}}\`)`;
    },
  );

  // setMessages with astral text broken
  out = out.replace(
    /text: " \+ \/\*emoji\*\/ "<EmojiIcon emoji=\\"([^"\\]+)\\" size=\{(\d+)\} \/> " \+ ([^,]+),/g,
    (_, em, _size, expr) => `text: \`${em} \${${expr.trim()}}\`,`,
  );

  // multiline astral error
  out = out.replace(
    /: " \+ \/\*emoji\*\/ "<EmojiIcon emoji=\\"❌\\" size=\{20\} \/> " \+ res\.error\}\$\{hints\.length \? `\\n\\n💡 \$\{hints\.join\("\\n💡 "\)\}` : ""\}`/g,
    `: \`❌ \${res.error}\${hints.length ? \`\\n\\n💡 \${hints.join("\\n💡 ")}\` : ""}\``,
  );

  // icon=<EmojiIcon emoji={x} size={18} /> → icon={<EmojiIcon ... />}
  out = out.replace(/(\bicon=)<EmojiIcon emoji=\{([^}]+)\} size=\{(\d+)\} \/>/g, (_, p, em, sz) => `${p}{<EmojiIcon emoji={${em}} size={${sz}} />}`);

  // label with broken emoji prefix in ChestsPage
  out = out.replace(
    /label=\{" \+ \/\*emoji\*\/ "<EmojiIcon emoji=\\"([^"\\]+)\\" size=\{(\d+)\} \/> " \+ ([^`]+)`\}/g,
    (_, em, sz, expr) => `label={<> <EmojiIcon emoji="${em}" size={${sz}} /> {${expr.trim()}} </>}`,
  );

  return out;
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".tsx")) {
      const raw = fs.readFileSync(full, "utf8");
      const next = fix(raw);
      if (next !== raw) {
        fs.writeFileSync(full, next);
        console.log("repaired", path.relative(root, full));
      }
    }
  }
}

walk(srcRoot);
console.log("fix-emoji-patch-damage done");
