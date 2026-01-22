import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { sharedReact } from '@dak/vite-shared-react';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
  const plugins: PluginOption[] = [react(), tailwindcss(), sharedReact()];

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
    base: command === 'build' && mode === 'production' ? '/dashboard/' : '/',
    server: {
      port: 8080,
    },
    plugins,
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          privacy: resolve(__dirname, 'privacy.html'),
        },
      },
    },
  };
});
