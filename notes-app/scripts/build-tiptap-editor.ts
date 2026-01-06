import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, watch } from 'fs';
import { resolve, dirname } from 'path';
import { minify as minifyHtml } from 'html-minifier-terser';

const ROOT = resolve(dirname(import.meta.url.replace('file://', '')), '..');
const isWatch = process.argv.includes('--watch');
const isProduction = process.env.NODE_ENV === 'production';

async function buildTiptapEditor(): Promise<void> {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] Building TipTap editor...`);

  try {
    // 1. Bundle the TypeScript entry point
    const jsResult = await esbuild.build({
      entryPoints: [resolve(ROOT, 'src/tiptap-editor/entry.ts')],
      bundle: true,
      format: 'iife', // Works in any browser without module system
      minify: isProduction,
      write: false, // Get output as string
      target: ['es2020'], // Modern browsers in WebView
      define: {
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
      },
      // Suppress warnings about circular dependencies in tiptap
      logLevel: 'error',
    });

    const bundledJS = jsResult.outputFiles[0].text;

    // 2. Read CSS
    const css = readFileSync(resolve(ROOT, 'src/tiptap-editor/styles.css'), 'utf-8');

    // 3. Generate HTML
    let html = generateHTML(css, bundledJS);

    // 4. Minify HTML in production
    if (isProduction) {
      html = await minifyHtml(html, {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        // JS is already minified by esbuild, don't double-process
        minifyJS: false,
      });
    }

    // 5. Ensure output directories exist
    mkdirSync(resolve(ROOT, 'public'), { recursive: true });
    mkdirSync(resolve(ROOT, 'assets'), { recursive: true });

    // 6. Write to both locations
    writeFileSync(resolve(ROOT, 'public/tiptap-editor.html'), html);
    writeFileSync(resolve(ROOT, 'assets/tiptap-editor.html'), html);

    console.log(`[${timestamp}] Done! (${(html.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`[${timestamp}] Build failed:`, err);
    if (!isWatch) {
      process.exit(1);
    }
  }
}

function generateHTML(css: string, js: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>TipTap Editor</title>
  <style>
${css}
  </style>
</head>
<body>
  <div id="editor"></div>
  <script>
${js}
  </script>
</body>
</html>`;
}

// Main
async function main(): Promise<void> {
  // Initial build
  await buildTiptapEditor();

  // Watch mode
  if (isWatch) {
    console.log('\nWatching for changes in src/tiptap-editor/...\n');

    const srcDir = resolve(ROOT, 'src/tiptap-editor');
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    watch(srcDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      // Debounce rapid changes
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log(`\nFile changed: ${filename}`);
        buildTiptapEditor();
      }, 100);
    });

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\nStopping watch mode...');
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
