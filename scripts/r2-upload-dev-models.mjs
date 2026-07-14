#!/usr/bin/env node
/** Upload public/dev-models only to R2 (admin 3D preview tab). */
process.env.R2_UPLOAD_DIRS = "dev-models";
await import("./r2-upload-models.mjs");
