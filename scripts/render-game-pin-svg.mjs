import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts", "game-pin-manifest.json"), "utf8"));
const RIM = { common:["#B0BEC5","#546E7A"], rare:["#4FC3F7","#1565C0"], epic:["#BA68C8","#6A1B9A"], unique:["#FF7043","#BF360C"], golden:["#FFD700","#FF8F00"] };
const BURST = { common:"#90A4AE", rare:"#42A5F5", epic:"#AB47BC", unique:"#FF7043", golden:"#FFC107" };
function burstPath(cx,cy,r,spikes){const pts=[];for(let i=0;i<spikes*2;i++){const a=(Math.PI*i)/spikes-Math.PI/2;const rad=i%2===0?r:r*0.55;pts.push(`${cx+Math.cos(a)*rad},${cy+Math.sin(a)*rad}`);}return `M${pts.join("L")}Z`;}
function svgFor(pin){const isUni=pin.dir==="general";const [c1,c2]=RIM[pin.rarity]||RIM.common;const burst=BURST[pin.rarity]||BURST.common;const gold=pin.goldenFrame||pin.rarity==="golden";const burstFill=gold?"#FFD54F":burst;const emoji=pin.emoji;const cx=64,cy=isUni?58:62;
if(isUni)return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><text x="${cx}" y="${cy+8}" text-anchor="middle" font-size="72">${emoji}</text></svg>`;
return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><path d="${burstPath(cx,cy,46,14)}" fill="${burstFill}" opacity="0.92" stroke="#1a1a1a" stroke-width="3"/><path d="${burstPath(cx,cy,32,10)}" fill="url(#rim)" opacity="0.35"/><text x="${cx}" y="${cy+6}" text-anchor="middle" font-size="58">${emoji}</text></svg>`;}
const pinId=process.argv[2]; if(!pinId){console.error("Usage: node scripts/render-game-pin-svg.mjs <pinId>");process.exit(1);}
const pin=manifest.find(p=>p.id===pinId); if(!pin){console.error("Unknown",pinId);process.exit(1);}
const outDir=path.join(root,"public","pins",pin.dir); fs.mkdirSync(outDir,{recursive:true});
const outPath=path.join(outDir,`${pin.id}.png`);
await sharp(Buffer.from(svgFor(pin))).resize(128,128,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:9,palette:true,colors:64,quality:80,effort:10}).toFile(outPath);
console.log("->",path.relative(root,outPath));