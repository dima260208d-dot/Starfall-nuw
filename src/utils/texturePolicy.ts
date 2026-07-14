import * as THREE from "three";

/**
 * Canvas 2D: smooth scaled bitmaps (similar to Java2D default when scaling sprites).
 * Call after ctx.save() if the context may have restored state from a previous path.
 */
export function applyCanvasBitmapDrawPolicy(ctx: CanvasRenderingContext2D): void {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

/** Albedo / emissive — mark as sRGB for correct shading after GLTF load. */
const COLOR_MAP_KEYS: (keyof THREE.MeshStandardMaterial)[] = ["map", "emissiveMap", "sheenColorMap"];

const DATA_MAP_KEYS: (keyof THREE.MeshStandardMaterial)[] = [
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "bumpMap",
  "alphaMap",
  "lightMap",
  "displacementMap",
];

function tuneTexture(tex: THREE.Texture, opts: { colorSRGB: boolean; maxAniso: number }): void {
  if (opts.colorSRGB && "colorSpace" in tex) {
    (tex as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
  }
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.min(opts.maxAniso, 8);
  tex.needsUpdate = true;
}

/**
 * GLTF / Three: predictable color space + mipmapped sampling so albedo stays crisp
 * when the ortho battle camera scales models (avoids shimmer / muddy minification).
 */
export function applyGLTFTexturePolicy(root: THREE.Object3D, renderer?: THREE.WebGLRenderer | null): void {
  const maxAniso = Math.max(1, renderer?.capabilities?.getMaxAnisotropy?.() ?? 4);

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
      const mat = m as THREE.MeshStandardMaterial;
      for (const key of COLOR_MAP_KEYS) {
        const tex = mat[key];
        if (tex && (tex as THREE.Texture).isTexture) {
          tuneTexture(tex as THREE.Texture, { colorSRGB: true, maxAniso });
        }
      }
      for (const key of DATA_MAP_KEYS) {
        const tex = mat[key];
        if (tex && (tex as THREE.Texture).isTexture) {
          tuneTexture(tex as THREE.Texture, { colorSRGB: false, maxAniso });
        }
      }
    }
  });
}
