#!/usr/bin/env node
/** Upload avatars, profile icons, pins, portrait backgrounds to R2 CDN. */
process.env.R2_UPLOAD_DIRS = "brawlers/avatars,profile-icons,portrait-bg,pins";
await import("./r2-upload-models.mjs");
