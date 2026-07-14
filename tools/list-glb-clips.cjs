const fs = require("fs");
const b = fs.readFileSync(process.argv[2]);
const len = b.readUInt32LE(12);
const json = b.toString("utf8", 20, 20 + len);
const gltf = JSON.parse(json);
console.log((gltf.animations || []).map((a,i)=>i+": "+a.name).join("\n"));