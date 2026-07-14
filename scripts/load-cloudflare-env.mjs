import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function loadCloudflareTokenFromEnvFile(rootDir) {
  const envPath = resolve(rootDir, ".env.local");
  if (!process.env.CLOUDFLARE_API_TOKEN && existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/^CLOUDFLARE_API_TOKEN=(.+)$/m);
    if (m) {
      process.env.CLOUDFLARE_API_TOKEN = m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return process.env.CLOUDFLARE_API_TOKEN;
}
