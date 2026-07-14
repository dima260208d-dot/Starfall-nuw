/**
 * BinbunGrass — 1:1 port of the Godot scene from SourceCode.zip:
 *   - Ground (`ground.gdshader`): plane painted by noise → 3-stop gradient
 *     (palette_01.tres greens). Sampled at world.xz * 0.0125, matches the
 *     `FastNoiseLite seed=6 frequency=0.008` look of the demo.
 *   - Grass blades (`grass.gdshader` + `grass_01.tres`):
 *       • QuadMesh 0.4×0.4 unit, CENTERED, billboarded fully to camera
 *         (camera right × camera up basis — same as MAIN_CAM_INV_VIEW_MATRIX).
 *       • Shape from `grass_basic_atlas.png` (2×2 atlas, tile picked by
 *         INSTANCE_ID % 4).
 *       • Alpha cut 0.4..0.6 + bayer4 dither (alpha_mode = 1).
 *       • Wind velocity = (0, 0) in the demo material → NO wind animation.
 *       • Per-blade tint = same noise sampled at world.xz * 0.0125 → matches
 *         the ground colour at that point.
 *
 *   Demo density = 10000 blades on a 20×20 unit plane = 25 blades / unit².
 *   We treat 1 Godot unit = 1 game cell (CELL = 50 px) so the same density
 *   carries over to the battle map. Blade size = 0.4 cell = 20 world px,
 *   which is visually close to Brawl-Stars grass tufts.
 */
import * as THREE from "three";

const GRADIENT_GLSL = `
vec3 bbgGradient(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c1 = vec3(0.658824, 0.792157, 0.345098);
  vec3 c2 = vec3(0.458824, 0.654902, 0.262745);
  vec3 c3 = vec3(0.274510, 0.509804, 0.196078);
  if (t <= 0.166667) return c1;
  if (t >= 0.833333) return c3;
  if (t < 0.5) return mix(c1, c2, clamp((t - 0.166667) / (0.5 - 0.166667), 0.0, 1.0));
  return mix(c2, c3, clamp((t - 0.5) / (0.833333 - 0.5), 0.0, 1.0));
}`;

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
  for (int i = 0; i < 3; i++) {
    v += a * bbgNoise(p);
    p *= 2.05;
    a *= 0.5;
  }
  return v;
}`;

/** Slightly below tile bases so cast shadows land on visible ground, not z-fight. */
const GROUND_Y = -0.14;

/**
 * Lambert ground keeps Three.js shadow-map chunks; custom noise tint injected via onBeforeCompile.
 */
function createGroundMaterial(mapClipW: number, mapClipH: number): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uMapW = { value: mapClipW };
    shader.uniforms.uMapH = { value: mapClipH };

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
varying vec3 vBbgWorldPos;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      `#include <worldpos_vertex>
vBbgWorldPos = worldPosition.xyz;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
uniform float uMapW;
uniform float uMapH;
varying vec3 vBbgWorldPos;
${NOISE_GLSL}
${GRADIENT_GLSL}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
if (vBbgWorldPos.x < 0.0 || vBbgWorldPos.z < 0.0 || vBbgWorldPos.x > uMapW || vBbgWorldPos.z > uMapH) discard;
{
  float bbgN = bbgFbm(vBbgWorldPos.xz * 0.0125);
  diffuseColor.rgb *= bbgGradient(bbgN);
}`,
    );
  };
  mat.customProgramCacheKey = () => "bbg-lambert-ground-v2";
  return mat;
}

/**
 * Vertex shader — port of grass.gdshader adapted to a TOP-DOWN tilted camera.
 *
 * Godot's `billboard = true` uses MAIN_CAM_INV_VIEW_MATRIX which rotates the
 * quad fully into the camera plane. For our orthographic top-down camera that
 * makes blades lie FLAT on the ground (invisible). We instead use a Y-axis
 * billboard: the blade always stands vertically along world +Y and only
 * rotates around Y to face the camera horizontally — exactly how grass tufts
 * read in top-down stylized games.
 *
 * Quad pivot is at the BOTTOM (uv.y = 0 → ground, uv.y = 1 → blade tip).
 */
const GRASS_VERT = `
uniform float uBladeW;
uniform float uBladeH;
uniform float uTime;
uniform vec2  uWindDir;     // unit vector — wind direction in XZ
uniform float uWindStrength; // world px the tip moves
uniform vec4  uStompers[8];  // xyz = world position, w = radius (0 = unused)

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vAtlasIdx;

void main() {
  vUv = uv;

  vec3 origin = instanceMatrix[3].xyz;

  // Y-axis billboard: face camera horizontally, stand vertically along world +Y.
  vec3 toCam = cameraPosition - origin;
  toCam.y = 0.0;
  float toCamLen = length(toCam);
  vec3 viewDir = toCamLen > 0.0001 ? toCam / toCamLen : vec3(0.0, 0.0, 1.0);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), viewDir));

  // Tip sway from wind — only the top of the blade moves (uv.y as ramp).
  float windPhase = uTime * 2.2 + origin.x * 0.012 - origin.z * 0.009;
  float windWave  = sin(windPhase) * 0.6 + sin(windPhase * 1.7 + 1.3) * 0.4;
  float tipFactor = uv.y * uv.y;
  vec3 windOffset = vec3(uWindDir.x, 0.0, uWindDir.y) * (windWave * uWindStrength * tipFactor);

  // Stomp: each nearby brawler pushes blade tip OUTWARD from their position
  // (away from feet) and bends it down. Force falls off with distance / radius.
  vec3 stompOffset = vec3(0.0);
  float stompFlatten = 0.0;
  for (int i = 0; i < 8; i++) {
    float r = uStompers[i].w;
    if (r <= 0.0) continue;
    vec2 toBlade = origin.xz - uStompers[i].xz;
    float d = length(toBlade);
    if (d >= r) continue;
    float falloff = 1.0 - d / r;
    falloff = falloff * falloff;
    vec2 dir = d > 0.0001 ? toBlade / d : vec2(1.0, 0.0);
    stompOffset.x += dir.x * falloff * r * 0.45 * tipFactor;
    stompOffset.z += dir.y * falloff * r * 0.45 * tipFactor;
    stompFlatten = max(stompFlatten, falloff);
  }
  float heightMul = 1.0 - 0.85 * stompFlatten;

  vec3 worldPos = origin
    + right * (uv.x - 0.5) * uBladeW
    + vec3(0.0, uv.y * uBladeH * heightMul, 0.0)
    + windOffset
    + stompOffset;

  vWorldPos = worldPos;
  vAtlasIdx = float(gl_InstanceID - (gl_InstanceID / 4) * 4);

  gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
}`;

const GRASS_FRAG = `
uniform sampler2D uAtlas;
uniform float uAlphaCutStart;
uniform float uAlphaCutEnd;

varying vec2 vUv;
varying vec3 vWorldPos;
varying float vAtlasIdx;

${NOISE_GLSL}
${GRADIENT_GLSL}

  // dither.gdshaderinc - bayer4 matrix from the original include.
float bbgBayer4(vec2 frag) {
  int x = int(mod(frag.x, 4.0));
  int y = int(mod(frag.y, 4.0));
  int index = x + y * 4;
  float m[16];
  m[0]=0.0;   m[1]=8.0;   m[2]=2.0;   m[3]=10.0;
  m[4]=12.0;  m[5]=4.0;   m[6]=14.0;  m[7]=6.0;
  m[8]=3.0;   m[9]=11.0;  m[10]=1.0;  m[11]=9.0;
  m[12]=15.0; m[13]=7.0;  m[14]=13.0; m[15]=5.0;
  return m[index] / 16.0;
}

void main() {
  // 2x2 atlas tile picked by INSTANCE_ID (Godot's atlas_uv(UV, id, 2)).
  int idx = int(vAtlasIdx);
  float tx = float(idx - (idx / 2) * 2);
  float ty = float(idx / 2);
  vec2 atlasUv = vec2(vUv.x, 1.0 - vUv.y) * 0.5 + vec2(tx, ty) * 0.5;
  float shape = texture2D(uAtlas, atlasUv).r;

  // alpha_mode = 1 (dithered) in grass_01.tres
  float a = clamp((shape - uAlphaCutStart) / max(0.0001, uAlphaCutEnd - uAlphaCutStart), 0.0, 1.0);
  if (step(bbgBayer4(gl_FragCoord.xy) + 0.01, a) < 0.5) discard;

  // Per-blade tint = same noise/gradient as ground at the blade's position
  // (grass.gdshader: noise_texture sampled at world_pos.xz times 0.1).
  float tint = bbgFbm(vWorldPos.xz * 0.0125);
  gl_FragColor = vec4(bbgGradient(tint), 1.0);
}`;

export const BINBUN_GRASS_FALLBACK_COLOR = 0x75a743;
/** World Y of grass ground plane (below tile bases for visible contact shadows). */
export const BINBUN_GROUND_Y = GROUND_Y;

/** Optional tile-grid mask: blades on non-grass cells are culled. */
export interface BinbunGrassMask {
  cells: Uint8Array | ArrayLike<number>;
  destroyed?: Uint8Array | ArrayLike<number>;
  width: number;
  height: number;
  cellSize: number;
  grassTileType?: number;
  originX?: number;
  originZ?: number;
}

export interface BinbunGrassField {
  root: THREE.Group;
  groundMeshes: THREE.Mesh[];
  grass: THREE.InstancedMesh;
  uniforms: {
    uBladeW: THREE.IUniform<number>;
    uBladeH: THREE.IUniform<number>;
    uAtlas?: THREE.IUniform<THREE.Texture>;
    uAlphaCutStart: THREE.IUniform<number>;
    uAlphaCutEnd: THREE.IUniform<number>;
    uTime: THREE.IUniform<number>;
    uWindDir: THREE.IUniform<THREE.Vector2>;
    uWindStrength: THREE.IUniform<number>;
    uStompers: THREE.IUniform<THREE.Vector4[]>;
  };
}

let atlasTexture: THREE.Texture | null = null;
let atlasLoadPromise: Promise<THREE.Texture> | null = null;

function atlasUrl(baseUrl: string): string {
  const b = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${b}textures/binbun-grass/grass_basic_atlas.png`;
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
        tex.anisotropy = 2;
        atlasTexture = tex;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
  return atlasLoadPromise;
}

function rand(col: number, row: number, seed: number): number {
  const n = Math.sin(col * 127.1 + row * 311.7 + seed * 41.9) * 43758.5453;
  return n - Math.floor(n);
}

// 1 Godot unit = 1 game cell (CELL = 50 px in the game).
// Demo blade is 0.4 × 0.4 unit → 20 world px square. Density is 25 / unit².
const CELL_PX = 50;
// Vertical grass blade, half the previously visible size, slightly taller than wide.
const BLADE_W = 14;                     // world px wide  (was 28)
const BLADE_H = 21;                     // world px tall  (was 42)
const DENSITY_PER_UNIT2 = 36;
const MAX_BLADES = 75000;
const DEFAULT_GROUND_CHUNKS = 10;

function isBladeBlockedAt(
  wx: number,
  wz: number,
  mask: BinbunGrassMask | null,
): boolean {
  if (!mask || mask.cellSize <= 0) return false;
  const grassType = mask.grassTileType ?? 0;
  const maskOriginX = mask.originX ?? 0;
  const maskOriginZ = mask.originZ ?? 0;
  const maskCell = mask.cellSize;
  const maskW = mask.width;
  const maskH = mask.height;
  if (wx < maskOriginX || wz < maskOriginZ
    || wx >= maskOriginX + maskW * maskCell
    || wz >= maskOriginZ + maskH * maskCell) {
    return true;
  }
  const tx = Math.floor((wx - maskOriginX) / maskCell);
  const tz = Math.floor((wz - maskOriginZ) / maskCell);
  if (tx < 0 || tz < 0 || tx >= maskW || tz >= maskH) return false;
  const i = tz * maskW + tx;
  if (mask.destroyed && mask.destroyed[i]) return false;
  return (mask.cells as ArrayLike<number>)[i] !== grassType;
}

function buildGrassInstancedMesh(
  mapW: number,
  mapH: number,
  pad: number,
  mask: BinbunGrassMask | null,
  uniforms: BinbunGrassField["uniforms"],
): THREE.InstancedMesh {
  const totalW = mapW + pad * 2;
  const totalH = mapH + pad * 2;
  const bladeGeom = new THREE.PlaneGeometry(1, 1, 1, 1);
  const grassMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: GRASS_VERT,
    fragmentShader: GRASS_FRAG,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: false,
    depthTest: true,
  });

  const areaUnits2 = (totalW * totalH) / (CELL_PX * CELL_PX);
  const wanted = Math.floor(areaUnits2 * DENSITY_PER_UNIT2);
  const bladeBudget = Math.min(wanted, MAX_BLADES);
  const grid = Math.max(8, Math.floor(Math.sqrt(bladeBudget)));
  const stepX = totalW / grid;
  const stepZ = totalH / grid;

  const grass = new THREE.InstancedMesh(bladeGeom, grassMat, bladeBudget);
  grass.frustumCulled = false;
  grass.castShadow = false;
  grass.receiveShadow = false;

  const dummy = new THREE.Object3D();
  let placed = 0;
  for (let r = 0; r < grid && placed < bladeBudget; r++) {
    for (let c = 0; c < grid && placed < bladeBudget; c++) {
      const jx = (rand(c, r, 1) - 0.5) * stepX * 0.95;
      const jz = (rand(c, r, 2) - 0.5) * stepZ * 0.95;
      const wx = -pad + c * stepX + stepX * 0.5 + jx;
      const wz = -pad + r * stepZ + stepZ * 0.5 + jz;
      if (isBladeBlockedAt(wx, wz, mask)) continue;
      dummy.position.set(wx, 0, wz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      grass.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
  }
  grass.count = placed;
  grass.instanceMatrix.needsUpdate = true;
  grass.renderOrder = 1;
  return grass;
}

/** Пересобирает только травинки под новую маску; земля остаётся на месте. */
export function refreshBinbunGrassMask(
  field: BinbunGrassField,
  mapW: number,
  mapH: number,
  pad: number,
  mask: BinbunGrassMask | null,
): void {
  field.root.remove(field.grass);
  field.grass.geometry.dispose();
  (field.grass.material as THREE.Material).dispose();
  const grass = buildGrassInstancedMesh(mapW, mapH, pad, mask, field.uniforms);
  field.root.add(grass);
  field.grass = grass;
}

export interface BinbunGrassOptions {
  mask?: BinbunGrassMask | null;
  groundChunks?: number;
  baseUrl?: string;
  /** Hard clip ground shader to playable map bounds (world px). */
  mapW?: number;
  mapH?: number;
}

export async function createBinbunGrassField(
  mapW: number,
  mapH: number,
  pad: number,
  optsOrBaseUrl: BinbunGrassOptions | string = {},
): Promise<BinbunGrassField> {
  const opts: BinbunGrassOptions =
    typeof optsOrBaseUrl === "string" ? { baseUrl: optsOrBaseUrl } : optsOrBaseUrl;
  const baseUrl = opts.baseUrl ?? "/";
  const chunks = Math.max(1, Math.floor(opts.groundChunks ?? DEFAULT_GROUND_CHUNKS));
  const mask = opts.mask ?? null;
  const mapClipW = opts.mapW ?? mapW;
  const mapClipH = opts.mapH ?? mapH;

  const atlas = await loadAtlasTexture(baseUrl);
  const root = new THREE.Group();

  const totalW = mapW + pad * 2;
  const totalH = mapH + pad * 2;
  const chunkW = totalW / chunks;
  const chunkH = totalH / chunks;

  // Ground — Lambert + injected noise; receives real-time shadows from tiles/brawlers.
  const groundMat = createGroundMaterial(mapClipW, mapClipH);
  const chunkGeom = new THREE.PlaneGeometry(chunkW, chunkH, 1, 1);
  chunkGeom.rotateX(-Math.PI / 2);

  const groundMeshes: THREE.Mesh[] = [];
  for (let cy = 0; cy < chunks; cy++) {
    for (let cx = 0; cx < chunks; cx++) {
      const m = new THREE.Mesh(chunkGeom, groundMat);
      m.position.set(
        -pad + chunkW * (cx + 0.5),
        GROUND_Y,
        -pad + chunkH * (cy + 0.5),
      );
      m.receiveShadow = true;
      m.renderOrder = 0;
      root.add(m);
      groundMeshes.push(m);
    }
  }

  const initialStompers: THREE.Vector4[] = [];
  for (let i = 0; i < 8; i++) initialStompers.push(new THREE.Vector4(0, 0, 0, 0));

  const uniforms = {
    uBladeW: { value: BLADE_W },
    uBladeH: { value: BLADE_H },
    uAtlas: { value: atlas },
    uAlphaCutStart: { value: 0.4 },
    uAlphaCutEnd: { value: 0.6 },
    uTime: { value: 0 },
    uWindDir: { value: new THREE.Vector2(0.85, 0.53) },
    uWindStrength: { value: 4.5 },
    uStompers: { value: initialStompers },
  };

  const grass = buildGrassInstancedMesh(mapW, mapH, pad, mask, uniforms);
  root.add(grass);
  return { root, groundMeshes, grass, uniforms };
}

export function updateBinbunGrassField(field: BinbunGrassField, dt: number): void {
  field.uniforms.uTime.value += dt;
}

/**
 * Set brawler/character positions that flatten nearby blades.
 *   - `points` are world XZ coordinates (game pixel space).
 *   - `radius` is the stomp radius in world px (only blades within bend).
 *   - Up to 8 points used; extras ignored.
 */
export function setBinbunGrassStompers(
  field: BinbunGrassField,
  points: { x: number; z: number; radius: number }[],
): void {
  const arr = field.uniforms.uStompers.value;
  for (let i = 0; i < 8; i++) {
    const p = points[i];
    if (p) arr[i].set(p.x, 0, p.z, p.radius);
    else arr[i].set(0, 0, 0, 0);
  }
}

export function disposeBinbunGrassField(field: BinbunGrassField | null): void {
  if (!field) return;
  field.root.removeFromParent();
  const first = field.groundMeshes[0];
  if (first) {
    first.geometry.dispose();
    (first.material as THREE.Material).dispose();
  }
  field.grass.geometry.dispose();
  (field.grass.material as THREE.Material).dispose();
}