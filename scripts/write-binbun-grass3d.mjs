import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "src/game/binbunGrass3D.ts");

const NOISE_GLSL = `
float bbgHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float bbgNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = bbgHash(i);
  float b = bbgHash(i + vec2(1.0, 0.0));
  float c = bbgHash(i + vec2(0.0, 1.0));
  float d = bbgHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float bbgFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * bbgNoise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}
vec3 bbgGrassGradient(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c1 = vec3(0.658824, 0.792157, 0.345098);
  vec3 c2 = vec3(0.458824, 0.654902, 0.262745);
  vec3 c3 = vec3(0.274510, 0.509804, 0.196078);
  if (t < 0.5) return mix(c1, c2, t / 0.5);
  return mix(c2, c3, (t - 0.5) / 0.5);
}`;

const GROUND_VERT = `
#include <common>
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const GROUND_FRAG = `
#include <common>
varying vec3 vWorldPos;
${NOISE_GLSL}
void main() {
  float n = bbgFbm(vWorldPos.xz * 0.1);
  vec3 col = bbgGrassGradient(n);
  gl_FragColor = vec4(col, 1.0);
}`;

const GRASS_VERT = `
#include <common>
#include <uv_pars_vertex>
uniform float uTime;
uniform float uBladeWidth;
uniform float uBladeHeight;
varying vec2 vUv;
varying float vTint;
${NOISE_GLSL}
void main() {
  #include <uv_vertex>
  #ifdef USE_INSTANCING
    mat4 im = instanceMatrix;
  #else
    mat4 im = mat4(1.0);
  #endif
  vec3 origin = vec3(im[3][0], im[3][1], im[3][2]);
  float s = length(vec3(im[0][0], im[0][1], im[0][2]));
  float wind = bbgFbm(origin.xz * 0.03 - vec2(uTime * 0.35));
  float windAffect = pow(1.0 - vUv.y, 2.0);
  vec3 windOff = vec3(wind * windAffect * 16.0, 0.0, wind * windAffect * 7.0);
  vec3 camRight = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
  vec3 pos = origin;
  pos += camRight * (vUv.x - 0.5) * uBladeWidth * s;
  pos.y += vUv.y * uBladeHeight * s;
  pos += windOff;
  vTint = bbgFbm(origin.xz * 0.1);
  gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
}`;

const GRASS_FRAG = `
#include <common>
uniform sampler2D uAtlas;
varying vec2 vUv;
varying float vTint;
${NOISE_GLSL}
void main() {
  int idx = gl_InstanceID % 4;
  float tx = float(idx % 2);
  float ty = float(idx / 2);
  vec2 tile = vec2(0.5);
  vec2 auv = vUv * tile + vec2(tx, ty) * tile;
  float shape = texture2D(uAtlas, auv).r;
  if (shape < 0.42) discard;
  vec3 col = bbgGrassGradient(clamp(vTint + 0.06, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

const content = `/**
 * BinbunGrass (SourceCode.zip) — 3D ground + instanced billboard blades.
 */
import * as THREE from "three";

const GROUND_VERT = \`${GROUND_VERT}\`;

const GROUND_FRAG = \`${GROUND_FRAG}\`;

const GRASS_VERT = \`${GRASS_VERT}\`;

const GRASS_FRAG = \`${GRASS_FRAG}\`;

export const BINBUN_GRASS_FALLBACK_COLOR = 0x75a743;

export interface BinbunGrassField {
  root: THREE.Group;
  ground: THREE.Mesh;
  grass: THREE.InstancedMesh;
  uniforms: { uTime: THREE.IUniform<number> };
}

let atlasTexture: THREE.Texture | null = null;
let atlasLoadPromise: Promise<THREE.Texture> | null = null;

function atlasUrl(baseUrl: string): string {
  return \`\${baseUrl.replace(/\\/$/, "")}/textures/binbun-grass/grass_basic_atlas.png\`;
}

export function loadBinbunGrassAssets(baseUrl = "/"): Promise<void> {
  return loadAtlasTexture(baseUrl).then(() => {});
}

function loadAtlasTexture(baseUrl: string): Promise<THREE.Texture> {
  if (atlasTexture) return Promise.resolve(atlasTexture);
  if (atlasLoadPromise) return atlasLoadPromise;
  atlasLoadPromise = new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      atlasUrl(baseUrl),
      (tex) => {
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.colorSpace = THREE.NoColorSpace;
        atlasTexture = tex;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
  return atlasLoadPromise;
}

function hash2(col: number, row: number, seed: number): number {
  const n = Math.sin(col * 127.1 + row * 311.7 + seed * 41.9) * 43758.5453;
  return n - Math.floor(n);
}

const BLADE_WIDTH = 36;
const BLADE_HEIGHT = 52;
const SPACING = 40;
const MAX_BLADES = 14000;

export async function createBinbunGrassField(
  mapW: number,
  mapH: number,
  pad: number,
  baseUrl = "/",
): Promise<BinbunGrassField> {
  const atlas = await loadAtlasTexture(baseUrl);
  const root = new THREE.Group();
  const groundW = mapW + pad * 2;
  const groundH = mapH + pad * 2;
  const groundGeom = new THREE.PlaneGeometry(groundW, groundH);
  groundGeom.rotateX(-Math.PI / 2);
  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
  });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.position.set(mapW / 2, 0, mapH / 2);
  ground.receiveShadow = true;
  root.add(ground);

  const bladeGeom = new THREE.PlaneGeometry(1, 1, 1, 1);
  bladeGeom.setAttribute("uv", new THREE.BufferAttribute(new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
  ]), 2));

  const uniforms = {
    uTime: { value: 0 },
    uAtlas: { value: atlas },
    uBladeWidth: { value: BLADE_WIDTH },
    uBladeHeight: { value: BLADE_HEIGHT },
  };

  const grassMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: GRASS_VERT,
    fragmentShader: GRASS_FRAG,
    side: THREE.DoubleSide,
  });

  const cols = Math.max(1, Math.floor(groundW / SPACING));
  const rows = Math.max(1, Math.floor(groundH / SPACING));
  const bladeCount = Math.min(cols * rows, MAX_BLADES);
  const grass = new THREE.InstancedMesh(bladeGeom, grassMat, bladeCount);
  grass.frustumCulled = false;

  const dummy = new THREE.Object3D();
  let i = 0;
  for (let row = 0; row < rows && i < bladeCount; row++) {
    for (let col = 0; col < cols && i < bladeCount; col++) {
      const hx = hash2(col, row, 1);
      const hy = hash2(col, row, 2);
      const hs = hash2(col, row, 3);
      dummy.position.set(
        hx * SPACING * 0.9 + col * SPACING + pad * 0.5,
        0,
        hy * SPACING * 0.9 + row * SPACING + pad * 0.5,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.72 + hs * 0.55);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      i++;
    }
  }
  grass.instanceMatrix.needsUpdate = true;
  grass.count = i;
  grass.renderOrder = 1;
  root.add(grass);

  return { root, ground, grass, uniforms };
}

export function updateBinbunGrassField(field: BinbunGrassField, dt: number): void {
  field.uniforms.uTime.value += dt;
}

export function disposeBinbunGrassField(field: BinbunGrassField | null): void {
  if (!field) return;
  field.root.removeFromParent();
  field.ground.geometry.dispose();
  field.grass.geometry.dispose();
  (field.ground.material as THREE.Material).dispose();
  (field.grass.material as THREE.Material).dispose();
}
`;

fs.writeFileSync(out, content, "utf8");
console.log("wrote", out, fs.statSync(out).size);
