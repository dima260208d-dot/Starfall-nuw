import fs from "node:fs";
const defs = JSON.parse(fs.readFileSync("oliver_defs.json","utf8"));
function fmtPage(p){const dlg=JSON.stringify(p[2],null,6).replace(/\n/g,"\n      ");return `      [${JSON.stringify(p[0])}, ${JSON.stringify(p[1])}, ${dlg}, ${p[3]===null?"null":JSON.stringify(p[3])}]`;}
let out="export const chapterDefs = {\n";
for(const [k,ch] of Object.entries(defs)){out+=`  "${k}": {\n    title: ${JSON.stringify(ch.title)},\n    pages: [\n`;out+=ch.pages.map(fmtPage).join(",\n");out+="\n    ],\n  },\n";}
out+="};\n";fs.writeFileSync("oliver_v2_pages.mjs",out,"utf8");console.log("ok");