/** Standalone build for the desktop admin panel (full React UI, not in game bundle). */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "admin-panel"),
  base: "./",
  envDir: path.resolve(import.meta.dirname),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "admin-panel/dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, "admin-panel/index.html"),
    },
  },
  define: {
    "import.meta.env.VITE_ADMIN_DESKTOP": JSON.stringify("true"),
  },
});
