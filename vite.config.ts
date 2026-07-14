import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

/** Local dev defaults; Replit/production should still set PORT / BASE_PATH explicitly. */
const rawPort = process.env.PORT ?? "5173";
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const isCapacitorBuild = process.env.CAPACITOR_BUILD === "1";
const basePath = isCapacitorBuild ? "./" : (process.env.BASE_PATH ?? "/");

export default defineConfig({
  base: basePath,
  define: isCapacitorBuild
    ? { "import.meta.env.VITE_CAPACITOR_BUILD": JSON.stringify("1") }
    : undefined,
  envDir: path.resolve(import.meta.dirname),
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom", "three"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/llm-proxy/openrouter": {
        target: "https://openrouter.ai",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/llm-proxy\/openrouter/, ""),
      },
      "/llm-proxy/openai": {
        target: "https://api.openai.com",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/llm-proxy\/openai/, ""),
      },
    },
    fs: {
      strict: true,
    },
    watch: {
      ignored: [
        "**/.local/**",
        "**/.git/**",
        "**/.cache/**",
        "**/.config/**",
        "**/.upm/**",
        "**/.replit-artifact/**",
        "**/.agents/**",
        "**/attached_assets/**",
        "**/dist/**",
        "**/node_modules/**",
        "**/Setup Guide In-Editor Tutorial/**",
        "**/zipFile.zip",
        "**/tsconfig.tsbuildinfo",
      ],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/llm-proxy/openrouter": {
        target: "https://openrouter.ai",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/llm-proxy\/openrouter/, ""),
      },
      "/llm-proxy/openai": {
        target: "https://api.openai.com",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/llm-proxy\/openai/, ""),
      },
    },
  },
});
