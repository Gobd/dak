import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, esmExternalRequirePlugin, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');

// Load manifest once at module load time
let manifest = null;
try {
  manifest = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf-8'));
} catch {
  // Manifest not found - plugin will be inactive
}

/**
 * Get the list of external module IDs from the manifest.
 * Pass this to esmExternalRequirePlugin({ external: getExternalIds() }).
 */
export function getExternalIds() {
  if (!manifest) return [];
  return Object.keys(manifest);
}

/**
 * Vite plugin that injects import map for shared vendor bundles.
 * Use with esmExternalRequirePlugin for externalization.
 * Only activates in production builds - dev mode uses normal bundling.
 * Serves /_shared/ files during preview for local testing.
 */
export function sharedReact() {
  let isBuild = false;

  return {
    name: 'shared-react',

    config(_, { command }) {
      isBuild = command === 'build';
      return {};
    },

    // Serve /_shared/ files during preview
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/_shared/')) {
          const filename = req.url.slice('/_shared/'.length);
          const filepath = join(distDir, filename);

          if (existsSync(filepath)) {
            const content = readFileSync(filepath);
            const ext = filename.split('.').pop();
            const contentType =
              ext === 'js'
                ? 'application/javascript'
                : ext === 'css'
                  ? 'text/css'
                  : ext === 'woff2'
                    ? 'font/woff2'
                    : 'application/octet-stream';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(content);
            return;
          }
        }
        next();
      });
    },

    transformIndexHtml(html) {
      // Only inject import map in production builds
      if (!isBuild || !manifest) {
        return html;
      }

      const importMap = { imports: manifest };
      const importMapScript = `<script type="importmap">\n${JSON.stringify(importMap, null, 2)}\n    </script>`;
      return html.replace('<head>', `<head>\n    ${importMapScript}`);
    },
  };
}

export default sharedReact;

/**
 * Find monorepo root by looking for pnpm-workspace.yaml
 */
function findMonorepoRoot(startDir) {
  let dir = startDir;
  while (dir !== '/') {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

/**
 * Load env vars from monorepo root .env.local if it exists
 */
function loadMonorepoEnv(mode) {
  const root = findMonorepoRoot(process.cwd());
  if (!root) return {};

  const env = loadEnv(mode, root, '');
  // Filter to only VITE_ prefixed vars
  const viteEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_')) {
      viteEnv[`import.meta.env.${key}`] = JSON.stringify(value);
    }
  }
  return viteEnv;
}

/**
 * Create a Vite config with shared plugins and settings.
 * @param {object} options
 * @param {string} options.base - Base path (e.g., '/notes-app/')
 * @param {number} options.port - Dev server port
 * @param {object} [options.pwa] - PWA manifest config, or false to disable
 * @param {object} [options.rollupInput] - Custom rollup input entries
 */
export function createViteConfig({ base, port, pwa, rollupInput }) {
  return defineConfig(({ command, mode }) => {
    // Load env from monorepo root (merged with app-level env, app takes precedence)
    const monorepoEnv = loadMonorepoEnv(mode);
    const plugins = [
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
    ];

    if (pwa) {
      plugins.push(
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: pwa.includeAssets,
          manifest: {
            name: pwa.name,
            short_name: pwa.short_name,
            description: pwa.description,
            theme_color: '#1e293b',
            background_color: '#0f172a',
            display: 'standalone',
            orientation: pwa.orientation,
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
      );
    }

    return {
      base,
      server: {
        port,
        strictPort: true,
      },
      build: {
        sourcemap: true,
        ...(rollupInput && { rollupOptions: { input: rollupInput } }),
      },
      // Inject monorepo-level env vars (app .env takes precedence)
      define: monorepoEnv,
      plugins: plugins.filter(Boolean),
    };
  });
}
