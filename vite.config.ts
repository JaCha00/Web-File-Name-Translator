import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tauri 환경 감지
const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined;

// https://vite.dev/config/
export default defineConfig({
  plugins: isTauri
    ? [react(), tailwindcss()]
    : [react(), tailwindcss(), viteSingleFile()],
  base: "./",
  build: isTauri
    ? {
        target: "esnext",
        minify: "esbuild",
      }
    : {
        target: "es2015",
        modulePreload: false,
        cssCodeSplit: false,
        rollupOptions: {
          output: {
            format: "iife",
            inlineDynamicImports: true,
          },
        },
      },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Tauri 개발 서버 설정
  server: {
    strictPort: true,
  },
  clearScreen: false,
});
