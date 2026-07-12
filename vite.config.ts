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
      entry: resolve(__dirname, "src/index.ts"),
      name: "ThePplBot",
      fileName: "thepplbot",
    },
    rollupOptions: {
      // React is a peer dep — don't bundle it
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "ReactJSXRuntime",
        },
      },
    },
    // Keep CSS in the JS bundle so consumers don't need a separate import
    cssCodeSplit: false,
  },
});
