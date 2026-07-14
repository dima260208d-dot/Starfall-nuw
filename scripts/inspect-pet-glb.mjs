import fs from "fs";
import path from "path";
const srcDir = "c:/Users/\u0414\u043c\u0438\u0442\u0440\u0438\u0439/Downloads/\u043f\u0438\u0442\u043e\u043c\u0446\u044b 3\u0434";
for (const f of fs.readdirSync(srcDir)) {
  if (!f.endsWith(".glb")) continue;
  const buf = fs.readFileSync(path.join(srcDir, f));
  const text = buf.toString("utf8");
  const names = new Set();
  for (const m of text.matchAll(/"name":"([^"]{2,80})"/g)) {
    const n = m[1];
    if (/anim|walk|run|idle|attack|move|stand|heal|skill|action|mixamo|Armature|Scene|Left|Right|Slash|Running|Walking/i.test(n)) names.add(n);
  }
  console.log("\n===", f, "===");
  console.log([...names].join("\n"));
}
