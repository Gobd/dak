import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'dist');

// Get exact versions from pnpm
const depsJson = execSync('pnpm list react zustand --json', { cwd: __dirname, encoding: 'utf-8' });
const deps = JSON.parse(depsJson)[0].dependencies;
const version = deps.react.version;
const zustandVersion = deps.zustand.version;
console.log(`Using React version: ${version}`);
console.log(`Using Zustand version: ${zustandVersion}`);

// Clean and recreate output dir
try {
  rmSync(outDir, { recursive: true });
} catch {}
mkdirSync(outDir, { recursive: true });

/**
 * Fetch a bundle and its sourcemap from esm.sh
 * Returns { code, map } with updated sourceMappingURL
 */
async function fetchBundle(url, transforms = []) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  let code = await res.text();

  // Apply transforms (e.g., rewriting import paths)
  for (const transform of transforms) {
    code = transform(code);
  }

  // Try to fetch sourcemap
  let map = null;
  const mapMatch = code.match(/\/\/# sourceMappingURL=(\S+)/);
  if (mapMatch) {
    const mapUrl = new URL(mapMatch[1], url).href;
    try {
      const mapRes = await fetch(mapUrl);
      if (mapRes.ok) {
        map = await mapRes.text();
      }
    } catch {}
  }

  return { code, map };
}

function writeBundle(name, code, map, hash) {
  const fileName = `${name}-${hash}.js`;
  const mapFileName = `${name}-${hash}.js.map`;

  // Update sourceMappingURL to point to local file
  if (map) {
    code = code.replace(/\/\/# sourceMappingURL=\S+/, `//# sourceMappingURL=${mapFileName}`);
    writeFileSync(join(outDir, mapFileName), map);
  }

  writeFileSync(join(outDir, fileName), code);
  return fileName;
}

// Common transforms
const rewriteReact = (code) => code.replace(/from\s*"\/react@[^"]+"/g, 'from "react"');
const rewriteReactDom = (code) => code.replace(/from\s*"\/react-dom@[^"]+"/g, 'from "react-dom"');
const rewriteZustand = (code) => code.replace(/from\s*"\/zustand@[^"]+"/g, 'from "zustand"');

// Fetch React
console.log('Fetching React from esm.sh...');
const react = await fetchBundle(`https://esm.sh/react@${version}/es2024/react.mjs`);
const reactHash = createHash('md5').update(react.code).digest('hex').slice(0, 8);
const reactFileName = writeBundle('react', react.code, react.map, reactHash);

// Fetch ReactDOM
console.log('Fetching ReactDOM from esm.sh...');
const dom = await fetchBundle(`https://esm.sh/react-dom@${version}/es2024/react-dom.mjs`, [
  rewriteReact,
]);
const domHash = createHash('md5').update(dom.code).digest('hex').slice(0, 8);
const domFileName = writeBundle('react-dom', dom.code, dom.map, domHash);

// Fetch ReactDOM/client
console.log('Fetching ReactDOM/client from esm.sh...');
const client = await fetchBundle(`https://esm.sh/react-dom@${version}/es2024/client.bundle.mjs`, [
  rewriteReact,
  rewriteReactDom,
]);
const clientHash = createHash('md5').update(client.code).digest('hex').slice(0, 8);
const clientFileName = writeBundle('react-dom-client', client.code, client.map, clientHash);

// Fetch Zustand
console.log('Fetching Zustand from esm.sh...');
const zustand = await fetchBundle(
  `https://esm.sh/zustand@${zustandVersion}/es2024/zustand.bundle.mjs`,
  [rewriteReact]
);
const zustandHash = createHash('md5').update(zustand.code).digest('hex').slice(0, 8);
const zustandFileName = writeBundle('zustand', zustand.code, zustand.map, zustandHash);

// Fetch Zustand/middleware
console.log('Fetching Zustand/middleware from esm.sh...');
const zustandMw = await fetchBundle(
  `https://esm.sh/zustand@${zustandVersion}/es2024/middleware.bundle.mjs`,
  [rewriteReact, rewriteZustand]
);
const zustandMwHash = createHash('md5').update(zustandMw.code).digest('hex').slice(0, 8);
const zustandMwFileName = writeBundle(
  'zustand-middleware',
  zustandMw.code,
  zustandMw.map,
  zustandMwHash
);

// Copy fonts to dist
const fontsDir = join(__dirname, 'fonts');
const fontFiles = readdirSync(fontsDir);
for (const file of fontFiles) {
  copyFileSync(join(fontsDir, file), join(outDir, file));
}

// Write manifest
const manifest = {
  react: `/_shared/${reactFileName}`,
  'react-dom': `/_shared/${domFileName}`,
  'react-dom/client': `/_shared/${clientFileName}`,
  zustand: `/_shared/${zustandFileName}`,
  'zustand/middleware': `/_shared/${zustandMwFileName}`,
  fonts: '/_shared/fonts.css',
};
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log('Built shared vendor bundles:');
console.log(
  `  react: ${reactFileName} (${(react.code.length / 1024).toFixed(1)} KB)${react.map ? ' +map' : ''}`
);
console.log(
  `  react-dom: ${domFileName} (${(dom.code.length / 1024).toFixed(1)} KB)${dom.map ? ' +map' : ''}`
);
console.log(
  `  react-dom/client: ${clientFileName} (${(client.code.length / 1024).toFixed(1)} KB)${client.map ? ' +map' : ''}`
);
console.log(
  `  zustand: ${zustandFileName} (${(zustand.code.length / 1024).toFixed(1)} KB)${zustand.map ? ' +map' : ''}`
);
console.log(
  `  zustand/middleware: ${zustandMwFileName} (${(zustandMw.code.length / 1024).toFixed(1)} KB)${zustandMw.map ? ' +map' : ''}`
);
console.log(`  fonts: ${fontFiles.join(', ')}`);
