import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import { mockTutorApi } from "./dev/mock-tutor-plugin";

export default defineConfig({
  plugins: [
    react(),
    dts({ include: ["src"], insertTypesEntry: true }),
    // Dev-only: serves a canned /api/tutor so the widget works without a key.
    mockTutorApi(),
  ],
  build: {
    lib: {
      // Multiple entries → main widget + importable curricula subpaths.
      entry: {
        thepplbot: resolve(__dirname, "src/index.ts"),
        "curriculum-french-quarter": resolve(__dirname, "src/curriculum-french-quarter.ts"),
      },
      // ESM + CJS (UMD/iife don't support multiple entries).
      formats: ["es", "cjs"],
      fileName: (format, entryName) => `${entryName}.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      // React is a peer dep — don't bundle it. kokoro-js is an optional runtime
      // dependency (the neural voice); keep it external so it's lazy-loaded on
      // demand and never bloats the base bundle.
      external: ["react", "react-dom", "react/jsx-runtime", "kokoro-js"],
    },
    // Keep CSS in the JS bundle so consumers don't need a separate import
    cssCodeSplit: false,
  },
});
