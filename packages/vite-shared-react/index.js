import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load manifest once at module load time
let manifest = null;
try {
  manifest = JSON.parse(readFileSync(join(__dirname, 'dist/manifest.json'), 'utf-8'));
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
 */
export function sharedReact() {
  let isBuild = false;

  return {
    name: 'shared-react',

    config(_, { command }) {
      isBuild = command === 'build';
      return {};
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
