import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Vite plugin that externalizes React and injects import map for shared vendor bundle.
 * Only activates in production builds - dev mode uses normal bundling.
 */
export function sharedReact() {
  let manifest;
  let isBuild = false;

  try {
    manifest = JSON.parse(readFileSync(join(__dirname, 'dist/manifest.json'), 'utf-8'));
  } catch {
    // Manifest not found - plugin will be inactive
    manifest = null;
  }

  return {
    name: 'shared-react',

    config(_, { command }) {
      isBuild = command === 'build';

      // Only externalize in production builds when manifest exists
      if (!isBuild || !manifest) {
        return {};
      }

      return {
        build: {
          rollupOptions: {
            external: Object.keys(manifest),
            output: {
              manualChunks: undefined,
            },
          },
        },
      };
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
