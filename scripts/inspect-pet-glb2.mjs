import fs from "fs"; import path from "path";
const srcDir = "c:/Users/\u0414\u043c\u0438\u0442\u0440\u0438\u0439/Downloads/\u043f\u0438\u0442\u043e\u043c\u0446\u044b 3\u0434";
for (const f of fs.readdirSync(srcDir)) {
  if (!f.endsWith(".glb")) continue;
  const text = fs.readFileSync(path.join(srcDir, f)).toString("utf8");
  const clips = [...text.matchAll(/"name":"([^"]+)","samplers"/g)].map(m=>m[1]);
  console.log("\n===", f, "clips:", clips.length, "===");
  console.log(clips.join("\n"));
}
