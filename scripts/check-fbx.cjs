const fs = require("fs");
const s = fs.readFileSync("public/models/verdeletta_shadow_move.fbx").toString("latin1");
const anim = [];
const re = /"([^"]{3,80})"/g;
let m;
while ((m = re.exec(s))) {
  if (/walk|run|attack|slash|punch|kick|move|shoot|hit|mixamo|baselayer|Armature/i.test(m[1])) anim.push(m[1]);
}
console.log([...new Set(anim)].slice(0, 40));