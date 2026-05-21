import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { alphaTab } from "@coderline/alphatab-vite";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Official alphaTab plugin: wires up the render web-worker and audio worklet,
    // and copies the Bravura music font + sonivox soundfont into the build output
    // (served at /font/ and /soundfont/).
    ...alphaTab(),
  ],

  // The cloned alphaTab monorepo lives under this folder for reference only.
  // Restrict the dep scanner to our own entry so it doesn't try to crawl the
  // playground's index.html files (which import internal alphaTab specifiers).
  optimizeDeps: {
    entries: ["index.html"],
  },

  // Prevent Vite from obscuring Rust errors.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Ignore the Tauri backend and the reference clone.
      ignored: ["**/src-tauri/**", "**/alphaTab/**"],
    },
  },

  build: {
    outDir: "dist",
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
