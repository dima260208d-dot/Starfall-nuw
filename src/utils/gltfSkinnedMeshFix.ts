import * as THREE from "three";

/**
 * GLTF exports often place SkinnedMesh as a root sibling of the bone hierarchy.
 * Updating world matrices then deforms vertices incorrectly (face / hair "detached").
 * Parenting the mesh under the armature restores correct skinning.
 */
export function attachSkinnedMeshesUnderArmature(root: THREE.Object3D): void {
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes.push(o as THREE.SkinnedMesh);
  });
  for (const mesh of skinnedMeshes) {
    const sk = mesh.skeleton;
    if (!sk?.bones?.length) continue;
    const armature = root.getObjectByName("Armature") ?? sk.bones[0].parent;
    if (!armature || mesh.parent === armature) continue;
    armature.attach(mesh);
  }
}

export function normalizeSkinnedMeshWeights(root: THREE.Object3D): void {
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && typeof m.normalizeSkinWeights === "function") {
      m.normalizeSkinWeights();
    }
  });
}

/** Call after loading a character GLB, before bounding-box / scale setup. */
export function fixCharacterSkinnedMeshes(root: THREE.Object3D): void {
  attachSkinnedMeshesUnderArmature(root);
  normalizeSkinnedMeshWeights(root);
}
