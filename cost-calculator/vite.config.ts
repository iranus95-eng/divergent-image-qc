import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/system-cost/",
  build: {
    outDir: "../system-cost",
    emptyOutDir: true,
    sourcemap:
      process.env.APPDEPLOY_VITE_SOURCEMAP === "hidden" ? "hidden" : false,
    rollupOptions: {
      maxParallelFileOps: 128,
    },
  },
});
