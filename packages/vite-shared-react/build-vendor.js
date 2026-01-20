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

// Dynamically get all exports from React so we don't hardcode them
const React = await import('react');
const reactExports = Object.keys(React).filter(k =>
  k !== 'default' &&
  k !== 'module.exports' &&
  !k.includes('DO_NOT_USE') &&
  !k.startsWith('__') &&
  !k.startsWith('unstable_') &&
  k !== 'version' &&
  k !== 'captureOwnerStack' &&
  k !== 'act' &&
  k !== 'Profiler' &&
  k !== 'useDebugValue' &&
  k !== 'Activity' &&
  k !== 'cache' &&
  k !== 'cacheSignal' &&
  k !== 'useEffectEvent' &&
  k !== 'useOptimistic' &&
  k !== 'useActionState'
);
console.log('React exports:', reactExports);

// Build React standalone
// Explicitly list exports since esbuild doesn't properly handle `export *` with React's module format
const reactResult = await build({
  stdin: {
    contents: `
      import React, { ${reactExports.join(', ')} } from 'react';
      export { ${reactExports.join(', ')} };
      export default React;
    `,
    resolveDir: __dirname,
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  minify: true,
  treeShaking: false,
  write: false,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

const reactCode = reactResult.outputFiles[0].text;
const reactHash = createHash('md5').update(reactCode).digest('hex').slice(0, 8);
const reactFileName = `react-${reactHash}.js`;
writeFileSync(join(outDir, reactFileName), reactCode);

// Dynamically get all exports from react-dom/client
const ReactDOMClient = await import('react-dom/client');
const clientExports = Object.keys(ReactDOMClient).filter(k => k !== 'default' && k !== 'module.exports' && k !== 'version' && k !== 'hydrateRoot');
console.log('ReactDOM/client exports:', clientExports);

// Build ReactDOM/client (includes all of react-dom)
// This is what apps actually import
const clientResult = await build({
  stdin: {
    contents: `
      import ReactDOMClient, { ${clientExports.join(', ')} } from 'react-dom/client';
      export { ${clientExports.join(', ')} };
      export default ReactDOMClient;
    `,
    resolveDir: __dirname,
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  minify: true,
  treeShaking: false,
  external: ['react'],
  write: false,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
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
