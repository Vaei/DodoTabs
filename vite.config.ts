import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { alphaTab } from "@coderline/alphatab-vite";

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Official alphaTab plugin: wires up the render web-worker and audio worklet.
    // assetOutputDir:false disables its asset copy - we ship the Bravura font and the
    // playback soundfont ourselves from public/font/ and public/soundfont/ (served at
    // /font/ and /soundfont/), so the plugin doesn't also dump its bundled Sonivox
    // soundfont and mismatched license into the build.
    ...alphaTab({ assetOutputDir: false }),
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
    // Bind all interfaces so the dev server is reachable both at localhost (the
    // desktop webview, which needs a secure context for mediaDevices/getUserMedia)
    // and at the machine's LAN IP (the Android device on the same Wi-Fi).
    host: true,
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
