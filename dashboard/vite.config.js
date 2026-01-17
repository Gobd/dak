import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig(({ command, mode }) => ({
  // Use /dashboard/ base only for production build, not preview
  base: command === "build" && mode === "production" ? "/dashboard/" : "/",
  server: {
    port: 8080,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        privacy: resolve(__dirname, "privacy.html"),
      },
    },
  },
}));
