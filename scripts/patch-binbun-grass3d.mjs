import fs from "fs";

const path = "src/game/binbunGrass3D.ts";
let s = fs.readFileSync(path, "utf8");

s = s.replace(
  "varying vec2 vUv;\nvarying float vTint;",
  "varying vec2 vUv;\nvarying float vTint;\nvarying float vAtlasIdx;",
);
s = s.replace(
  "  vTint = bbgFbm(origin.xz * 0.1);",
  "  vAtlasIdx = float(gl_InstanceID % 4);\n  vTint = bbgFbm(origin.xz * 0.1);",
);
s = s.replace(
  "varying vec2 vUv;\nvarying float vTint;\n${NOISE_GLSL}\nvoid main() {\n  int idx = gl_InstanceID % 4;",
  "varying vec2 vUv;\nvarying float vTint;\nvarying float vAtlasIdx;\n${NOISE_GLSL}\nvoid main() {\n  int idx = int(vAtlasIdx);",
);
s = s.replace(
  "    side: THREE.DoubleSide,\n  });",
  "    side: THREE.DoubleSide,\n    defines: { USE_INSTANCING: \"\" },\n  });",
);
s = s.replace(
  "        hx * SPACING * 0.9 + col * SPACING + pad * 0.5,\n        0,\n        hy * SPACING * 0.9 + row * SPACING + pad * 0.5,",
  "        pad + col * SPACING + hx * SPACING * 0.9,\n        0,\n        pad + row * SPACING + hy * SPACING * 0.9,",
);

fs.writeFileSync(path, s, "utf8");
console.log("patched", path);
