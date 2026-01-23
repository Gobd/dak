import { build } from 'vite';
import { createHash } from 'crypto';
import { writeFileSync, readFileSync, copyFileSync, readdirSync, rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseSync } from 'oxc-parser';
import { walk } from 'oxc-walker';
import MagicString from 'magic-string';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'dist');

// Clean and recreate output dir
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Get exports from a module dynamically
async function getModuleExports(specifier) {
  const mod = await import(specifier);
  // Filter out default, internals, and invalid JS identifiers
  return Object.keys(mod).filter(
    (k) => k !== 'default' && !k.startsWith('__') && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)
  );
}

// Packages that need CJS-style handling (import default, destructure exports)
// These don't have proper ESM exports field in package.json
const cjsPackages = new Set(['react', 'react-dom', 'react-dom/client']);

const entries = [
  { name: 'react', entry: 'react', external: [] },
  { name: 'react-dom', entry: 'react-dom', external: ['react'] },
  { name: 'react-dom-client', entry: 'react-dom/client', external: ['react', 'react-dom'] },
  { name: 'zustand', entry: 'zustand', external: ['react'] },
  { name: 'zustand-middleware', entry: 'zustand/middleware', external: ['react', 'zustand'] },
];

const manifest = {};

for (const { name, entry, external } of entries) {
  console.log(`Building ${name}...`);

  // Create a virtual entry that re-exports everything from the package
  const virtualEntry = `\0virtual:${name}`;
  let entryCode;

  if (cjsPackages.has(entry)) {
    // CJS package - dynamically get exports and re-export them
    const exports = await getModuleExports(entry);
    entryCode =
      `import mod from '${entry}';\n` +
      `export const { ${exports.join(', ')} } = mod;\n` +
      `export default mod;`;
  } else {
    // ESM package - use export *
    entryCode = `export * from '${entry}';`;
  }

  await build({
    configFile: false,
    root: __dirname,
    mode: 'production',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    plugins: [
      {
        name: 'virtual-entry',
        resolveId(id) {
          if (id === virtualEntry) return id;
        },
        load(id) {
          if (id === virtualEntry) return entryCode;
        },
      },
      {
        name: 'esm-externals',
        // Inject ESM imports for externals and rewrite __require calls to use them
        banner() {
          if (external.length === 0) return '';
          return external
            .map((dep) => {
              const varName = `__ext_${dep.replace(/[^a-zA-Z]/g, '_')}`;
              // CJS packages need default import, ESM packages need namespace import
              return cjsPackages.has(dep)
                ? `import ${varName} from '${dep}';`
                : `import * as ${varName} from '${dep}';`;
            })
            .join('\n');
        },
        renderChunk(code) {
          if (external.length === 0) return code;

          const { program: ast } = parseSync('chunk.js', code);
          const s = new MagicString(code);
          const replacements = [];

          // Walk AST to find __require CallExpressions
          walk(ast, {
            enter(node) {
              if (
                node.type === 'CallExpression' &&
                node.callee.type === 'Identifier' &&
                node.callee.name === '__require' &&
                node.arguments.length === 1
              ) {
                const arg = node.arguments[0];
                let dep;
                // Handle Literal (string) and TemplateLiteral (no expressions)
                if (arg.type === 'Literal' && typeof arg.value === 'string') {
                  dep = arg.value;
                } else if (
                  arg.type === 'TemplateLiteral' &&
                  arg.expressions.length === 0 &&
                  arg.quasis.length === 1
                ) {
                  dep = arg.quasis[0].value.cooked;
                }
                if (dep && external.includes(dep)) {
                  replacements.push({ start: node.start, end: node.end, dep });
                }
              }
            },
          });

          // Apply replacements in reverse order (preserve offsets)
          for (const { start, end, dep } of replacements.reverse()) {
            const varName = `__ext_${dep.replace(/[^a-zA-Z]/g, '_')}`;
            s.overwrite(start, end, varName);
          }

          return s.hasChanged()
            ? { code: s.toString(), map: s.generateMap({ hires: true }) }
            : code;
        },
      },
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: true,
      minify: 'oxc',
      rollupOptions: {
        input: virtualEntry,
        external,
        output: {
          format: 'es',
          entryFileNames: `${name}.js`,
          minify: {
            mangle: true,
            compress: true,
          },
        },
        preserveEntrySignatures: 'exports-only',
      },
    },
    logLevel: 'warn',
  });

  // Read the built file and add content hash
  const filePath = join(outDir, `${name}.js`);
  const content = readFileSync(filePath);
  const hash = createHash('md5').update(content).digest('hex').slice(0, 8);
  const hashedName = `${name}-${hash}.js`;

  // Rename files with hash
  const mapPath = join(outDir, `${name}.js.map`);
  const hashedFilePath = join(outDir, hashedName);
  const hashedMapPath = join(outDir, `${hashedName}.map`);

  // Update sourceMappingURL and write
  const updatedContent = content
    .toString()
    .replace(`//# sourceMappingURL=${name}.js.map`, `//# sourceMappingURL=${hashedName}.map`);
  writeFileSync(hashedFilePath, updatedContent);
  copyFileSync(mapPath, hashedMapPath);

  // Remove unhashed files
  rmSync(filePath);
  rmSync(mapPath);

  // Add to manifest with the original import specifier
  const specifier = entry;
  manifest[specifier] = `/_shared/${hashedName}`;

  console.log(`  ${hashedName} (${(content.length / 1024).toFixed(1)} KB)`);
}

// Copy fonts
const fontsDir = join(__dirname, 'fonts');
for (const file of readdirSync(fontsDir)) {
  copyFileSync(join(fontsDir, file), join(outDir, file));
}
manifest['fonts'] = '/_shared/fonts.css';

// Write manifest
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('\nManifest:', manifest);
