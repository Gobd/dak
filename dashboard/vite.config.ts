import { defineConfig, esmExternalRequirePlugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { sharedReact, getExternalIds } from '@dak/vite-shared-react';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const isBuild = command === 'build';
  const plugins: PluginOption[] = [
    isBuild && esmExternalRequirePlugin({ external: getExternalIds() }),
    react(),
    tailwindcss(),
    sharedReact(),
  ];

  // Bundle analyzer - run with: pnpm analyze
  if (process.env.ANALYZE) {
    plugins.push(
      visualizer({
        open: true,
        filename: 'stats.html',
        gzipSize: true,
        brotliSize: true,
      })
    );
  }

  return {
    // Use /dashboard/ base only for production build, not preview
    base: isBuild && mode === 'production' ? '/dashboard/' : '/',
    server: {
      port: 8080,
    },
    plugins: plugins.filter(Boolean),
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname!, 'index.html'),
          privacy: resolve(import.meta.dirname!, 'privacy.html'),
        },
      },
    },
  };
});
