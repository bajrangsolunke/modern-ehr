import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // Hoist the heaviest libraries into their own chunks so the
    // shared "react-core" / "charts" / "icons" / "radix" chunks can
    // be cached separately from app code.
    rollupOptions: {
      output: {
        manualChunks: {
          "react-core": ["react", "react-dom", "react-router-dom"],
          "react-query": ["@tanstack/react-query"],
          "charts": ["recharts"],
          "forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          "framer": ["framer-motion"],
          "radix": [
            "@radix-ui/react-avatar",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-slot",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },
    // 600 KB headroom — vendor chunks are naturally larger but they
    // hash-cache well so they're a one-time download per release.
    chunkSizeWarningLimit: 600,
  },
});
