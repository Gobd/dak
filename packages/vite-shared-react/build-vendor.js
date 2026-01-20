import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'dist');

// Get exact React version from pnpm
const reactVersion = execSync('pnpm list react --json', { cwd: __dirname, encoding: 'utf-8' });
const version = JSON.parse(reactVersion)[0].dependencies.react.version;
console.log(`Using React version: ${version}`);

// Clean and recreate output dir
try { rmSync(outDir, { recursive: true }); } catch {}
mkdirSync(outDir, { recursive: true });

// Fetch React ESM bundle from esm.sh
console.log('Fetching React from esm.sh...');
const reactRes = await fetch(`https://esm.sh/react@${version}/es2022/react.mjs`);
if (!reactRes.ok) throw new Error(`Failed to fetch react: ${reactRes.status}`);
const reactCode = await reactRes.text();

const reactHash = createHash('md5').update(reactCode).digest('hex').slice(0, 8);
const reactFileName = `react-${reactHash}.js`;
writeFileSync(join(outDir, reactFileName), reactCode);

// Fetch ReactDOM/client ESM bundle from esm.sh
console.log('Fetching ReactDOM/client from esm.sh...');
const clientRes = await fetch(`https://esm.sh/react-dom@${version}/es2022/client.bundle.mjs`);
if (!clientRes.ok) throw new Error(`Failed to fetch react-dom/client: ${clientRes.status}`);
let clientCode = await clientRes.text();

// Replace esm.sh's absolute React import path with bare 'react' specifier
// esm.sh uses: import*as __0$ from"/react@19.2.3/es2022/react.mjs";
clientCode = clientCode.replace(
  /from\s*"\/react@[^"]+\/es2022\/react\.mjs"/g,
  'from "react"'
);
clientCode = clientCode.replace(
  /import\s*\*\s*as\s*\w+\s*from\s*"\/react@[^"]+\/es2022\/react\.mjs"/g,
  (match) => match.replace(/from\s*"\/react@[^"]+\/es2022\/react\.mjs"/, 'from "react"')
);

const clientHash = createHash('md5').update(clientCode).digest('hex').slice(0, 8);
const clientFileName = `react-dom-client-${clientHash}.js`;
writeFileSync(join(outDir, clientFileName), clientCode);

// Copy fonts to dist
const fontsDir = join(__dirname, 'fonts');
const fontFiles = readdirSync(fontsDir);
for (const file of fontFiles) {
  copyFileSync(join(fontsDir, file), join(outDir, file));
}

// Write manifest
const manifest = {
  react: `/_shared/${reactFileName}`,
  'react-dom/client': `/_shared/${clientFileName}`,
  fonts: '/_shared/fonts.css',
};
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log('Built shared React vendor:');
console.log(`  react: ${reactFileName} (${(reactCode.length / 1024).toFixed(1)} KB)`);
console.log(`  react-dom/client: ${clientFileName} (${(clientCode.length / 1024).toFixed(1)} KB)`);
console.log(`  fonts: ${fontFiles.join(', ')}`);
