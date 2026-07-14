import fs from "fs";
const path = process.argv[2];
const b = fs.readFileSync(path);
const s = b.toString("latin1");
const names = [...new Set([...s.matchAll(/"name":"([^"\\]{2,80})"/g)].map(m => m[1]))];
for (const n of names.filter(x => /walk|run|cast|attack|idle|spell|throw|jump|super|skill|anim/i.test(x))) {
  console.log(n);
}
