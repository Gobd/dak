import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import * as esbuild from 'esbuild';
import { injectManifest } from 'workbox-build';

const ROOT = resolve(dirname(import.meta.url.replace('file://', '')), '..');
const DIST_DIR = resolve(ROOT, 'dist');
const BASE_PATH = '/notes-app';

async function main(): Promise<void> {
  console.log('Post-build PWA processing...\n');

  if (!existsSync(DIST_DIR)) {
    console.error('Error: dist/ directory not found. Run expo export first.');
    process.exit(1);
  }

  // 1. Bundle the service worker template
  console.log('1. Bundling service worker...');
  const swBundlePath = resolve(DIST_DIR, 'sw-temp.js');

  await esbuild.build({
    entryPoints: [resolve(ROOT, 'src/sw-template.ts')],
    bundle: true,
    format: 'iife',
    minify: true,
    outfile: swBundlePath,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  // 2. Use workbox-build to inject precache manifest
  console.log('2. Generating precache manifest...');
  const { count, size } = await injectManifest({
    swSrc: swBundlePath,
    swDest: resolve(DIST_DIR, 'sw.js'),
    globDirectory: DIST_DIR,
    globPatterns: ['**/*.{js,css,html,png,svg,ico,woff,woff2,json}'],
    globIgnores: ['sw-temp.js', 'sw.js', 'workbox-*.js'],
    modifyURLPrefix: {
      '': `${BASE_PATH}/`,
    },
  });

  console.log(`   Precached ${count} files (${(size / 1024).toFixed(0)} KB)`);

  // 3. Inject PWA tags into HTML
  console.log('3. Injecting PWA tags into HTML...');
  const htmlPath = resolve(DIST_DIR, 'index.html');
  let html = readFileSync(htmlPath, 'utf-8');

  // PWA tags to inject
  const pwaTags = `
    <!-- PWA Meta Tags -->
    <link rel="manifest" href="${BASE_PATH}/manifest.json">
    <meta name="theme-color" content="#000000">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Notes">
    <link rel="apple-touch-icon" href="${BASE_PATH}/icons/icon-192.png">
  `;

  // Service worker registration script
  const swScript = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('${BASE_PATH}/sw.js', { scope: '${BASE_PATH}/' })
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.error('SW registration failed:', err));
        });
      }
    </script>
  `;

  // Check if PWA tags already exist
  if (!html.includes('rel="manifest"')) {
    // Inject before </head>
    html = html.replace('</head>', `${pwaTags}\n  </head>`);
  }

  // Check if SW registration already exists
  if (!html.includes('serviceWorker.register')) {
    // Inject before </body>
    html = html.replace('</body>', `${swScript}\n  </body>`);
  }

  writeFileSync(htmlPath, html);

  // 4. Copy manifest.json to dist if not already there
  const manifestSrc = resolve(ROOT, 'public/manifest.json');
  const manifestDest = resolve(DIST_DIR, 'manifest.json');
  if (existsSync(manifestSrc) && !existsSync(manifestDest)) {
    console.log('4. Copying manifest.json to dist...');
    writeFileSync(manifestDest, readFileSync(manifestSrc, 'utf-8'));
  }

  // 5. Clean up temp file
  const tempSw = resolve(DIST_DIR, 'sw-temp.js');
  if (existsSync(tempSw)) {
    const { unlinkSync } = await import('fs');
    unlinkSync(tempSw);
  }

  console.log('\n✓ PWA post-build complete!');
}

main().catch((err) => {
  console.error('Post-build failed:', err);
  process.exit(1);
});
