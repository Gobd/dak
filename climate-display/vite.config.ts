import { defineConfig, esmExternalRequirePlugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import { sharedReact, getExternalIds } from '@dak/vite-shared-react';

export default defineConfig(({ command }) => ({
  base: '/climate-display/',
  server: {
    port: 5178,
  },
  build: {
    sourcemap: true,
  },
  plugins: [
    command === 'build' && esmExternalRequirePlugin({ external: getExternalIds() }),
    react(),
    tailwindcss(),
    sharedReact(),
    process.env.ANALYZE &&
      visualizer({
        open: true,
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Climate Display',
        short_name: 'Climate',
        description: 'Indoor/outdoor climate comparison',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
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
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ].filter(Boolean) as PluginOption[],
}));
