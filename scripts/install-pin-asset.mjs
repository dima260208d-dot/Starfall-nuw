import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = process.env.PIN_ASSETS_DIR || path.join(process.env.USERPROFILE, ".cursor", "projects", "c-Users-Downloads-zip-repl", "assets");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts", "game-pin-manifest.json"), "utf8"));
const pinId = process.argv[2];
const pin = manifest.find((p) => p.id === pinId);
if (!pin) { console.error("Unknown pin", pinId); process.exit(1); }
const src = path.join(assetsRoot, pinId + ".png");
if (!fs.existsSync(src)) { console.error("Missing asset", src); process.exit(1); }
const outDir = path.join(root, "public", "pins", pin.dir);
fs.mkdirSync(outDir, { recursive: true });
const tmp = path.join(outDir, pinId + ".__tmp.png");
const out = path.join(outDir, pinId + ".png");
fs.copyFileSync(src, tmp);
const { data, info } = await sharp(tmp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const copy = Buffer.from(data);
const w = info.width, h = info.height;
const TOL = 40, FEA = 16;
function dist(r,g,b,br,bg,bb){const dr=r-br,dg=g-bg,db=b-bb;return Math.sqrt(dr*dr+dg*dg+db*db);}
const rs=[],gs=[],bs=[];
for(let x=0;x<w;x++){for(const y of [0,h-1]){const i=(y*w+x)*4;if(data[i+3]>8){rs.push(data[i]);gs.push(data[i+1]);bs.push(data[i+2]);}}}
for(let y=0;y<h;y++){for(const x of [0,w-1]){const i=(y*w+x)*4;if(data[i+3]>8){rs.push(data[i]);gs.push(data[i+1]);bs.push(data[i+2]);}}}
rs.sort((a,b)=>a-b);const br=rs[Math.floor(rs.length/2)]||120;gs.sort((a,b)=>a-b);const bg=gs[Math.floor(gs.length/2)]||120;bs.sort((a,b)=>a-b);const bb=bs[Math.floor(bs.length/2)]||120;
const mask=new Uint8Array(w*h);const q=new Int32Array(w*h);let head=0,tail=0;
const tryPush=(x,y)=>{const idx=y*w+x;if(mask[idx])return;const i=idx*4;const d=dist(copy[i],copy[i+1],copy[i+2],br,bg,bb);if(copy[i+3]<12||d<=TOL){mask[idx]=1;q[tail++]=idx;}};
for(let x=0;x<w;x++){tryPush(x,0);tryPush(x,h-1);}for(let y=0;y<h;y++){tryPush(0,y);tryPush(w-1,y);}
while(head<tail){const idx=q[head++];const x=idx%w,y=(idx/w)|0;if(x>0)tryPush(x-1,y);if(x<w-1)tryPush(x+1,y);if(y>0)tryPush(x,y-1);if(y<h-1)tryPush(x,y+1);}
for(let idx=0;idx<w*h;idx++){if(!mask[idx])continue;const i=idx*4;copy[i+3]=0;}
for(let idx=0;idx<w*h;idx++){const i=idx*4;const a=copy[i+3];if(a===0)continue;const sum=copy[i]+copy[i+1]+copy[i+2];if(sum<36)copy[i+3]=0;}
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const idx=y*w+x;if(mask[idx])continue;const i=idx*4;if(copy[i+3]===0)continue;const d=dist(copy[i],copy[i+1],copy[i+2],br,bg,bb);if(d<=TOL+FEA){const t=(d-TOL)/FEA;copy[i+3]=Math.round(copy[i+3]*Math.min(1,Math.max(0,t)));}}
await sharp(copy,{raw:{width:w,height:h,channels:4}}).resize(128,128,{fit:"contain",background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:9,palette:true,colors:64,quality:80,effort:10}).toFile(out);
fs.unlinkSync(tmp);
console.log("installed", path.relative(root, out));