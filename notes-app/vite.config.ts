import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import { sharedReact } from '@dak/vite-shared-react';
import type { PluginOption } from 'vite';

export default defineConfig({
  base: '/notes-app/',
  server: {
    port: 5179,
    strictPort: true,
  },
  plugins: [
    react(),
    tailwindcss(),
    sharedReact(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Notes',
        short_name: 'Notes',
        description: 'A simple notes app with rich text editing',
        theme_color: '#fbbf24',
        background_color: '#000000',
        display: 'standalone',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
    process.env.ANALYZE &&
      visualizer({
        open: true,
        filename: 'stats.html',
        gzipSize: true,
        template: 'treemap',
      }),
  ].filter(Boolean) as PluginOption[],
});
