import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import { VitePWA } from "vite-plugin-pwa";
import type { PluginOption } from "vite";

export default defineConfig({
  base: "/health-tracker/",
  server: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Health Tracker",
        short_name: "Health",
        description: "Family health tracking app",
        theme_color: "#2563eb",
        background_color: "#000000",
        display: "standalone",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
    process.env.ANALYZE &&
      visualizer({
        open: true,
        filename: "stats.html",
        gzipSize: true,
        template: "treemap",
      }),
  ].filter(Boolean) as PluginOption[],
});
