const fs = require("fs");
const b = fs.readFileSync(process.argv[2]);
const len = b.readUInt32LE(12);
const gltf = JSON.parse(b.toString("utf8", 20, 20 + len));
console.log("nodes:", gltf.nodes.map((n,i)=>i+": "+(n.name||"")).join("\n"));