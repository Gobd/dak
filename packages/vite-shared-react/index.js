import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

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
 * Excludes non-JS entries like 'fonts'.
 */
export function getExternalIds() {
  if (!manifest) return [];
  return Object.keys(manifest).filter((key) => key !== 'fonts');
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
