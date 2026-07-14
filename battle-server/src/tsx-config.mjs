import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Must load before any .ts import (ESM hoists static imports above module body). */
process.env.TSX_TSCONFIG_PATH ??= resolve(dirname(fileURLToPath(import.meta.url)), "../../tsconfig.json");
