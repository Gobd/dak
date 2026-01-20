import { build } from 'esbuild';
import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'dist');

// Clean and recreate output dir
try { rmSync(outDir, { recursive: true }); } catch {}
mkdirSync(outDir, { recursive: true });

// Build React standalone
const reactResult = await build({
  stdin: {
    contents: `
      export * from 'react';
      export { default } from 'react';
    `,
    resolveDir: __dirname,
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
});

const reactCode = reactResult.outputFiles[0].text;
const reactHash = createHash('md5').update(reactCode).digest('hex').slice(0, 8);
const reactFileName = `react-${reactHash}.js`;
writeFileSync(join(outDir, reactFileName), reactCode);

// Build ReactDOM/client (includes all of react-dom)
// This is what apps actually import
const clientResult = await build({
  stdin: {
    contents: `
      import * as ReactDOMClient from 'react-dom/client';
      export * from 'react-dom/client';
      export { ReactDOMClient as default };
    `,
    resolveDir: __dirname,
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  minify: true,
  external: ['react'],
  write: false,
});

const clientCode = clientResult.outputFiles[0].text;
const clientHash = createHash('md5').update(clientCode).digest('hex').slice(0, 8);
const clientFileName = `react-dom-client-${clientHash}.js`;
writeFileSync(join(outDir, clientFileName), clientCode);

// Write manifest - map both react-dom and react-dom/client to the same bundle
const manifest = {
  react: `/_shared/${reactFileName}`,
  'react-dom/client': `/_shared/${clientFileName}`,
};
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log('Built shared React vendor:');
console.log(`  react: ${reactFileName} (${(reactCode.length / 1024).toFixed(1)} KB)`);
console.log(`  react-dom/client: ${clientFileName} (${(clientCode.length / 1024).toFixed(1)} KB)`);
