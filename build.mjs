/**
 * Production build script.
 *
 * Bundles and minifies frontend JS into a single file (dist/app.min.js) so the
 * deployed site is faster and harder to copy/read. Also copies static assets.
 *
 * Usage: node build.mjs
 * Requires: npm i -D esbuild (already in devDependencies)
 *
 * After building, deploy the contents of the `dist/` folder.
 */
import { buildSync } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');

// Clean dist
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// 1. Bundle + minify JS (tree-shaking, single file, obfuscated variable names).
buildSync({
  entryPoints: ['js/app.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  outfile: path.join(DIST, 'js/app.min.js'),
  // Keep dynamic import() for Transformers.js CDN (external).
  external: ['https://*'],
  target: ['es2020'],
  legalComments: 'none'  // strip comments
});

// 2. Copy static files that don't need bundling.
const staticFiles = [
  'index.html',
  'privacy.html',
  'terms.html',
  'manifest.webmanifest',
  'sw.js',
  'LICENSE'
];
const staticDirs = [
  'css',
  'data',
  'assets'
];

for (const f of staticFiles) {
  if (fs.existsSync(f)) {
    fs.cpSync(f, path.join(DIST, f));
  }
}

for (const d of staticDirs) {
  if (fs.existsSync(d)) {
    fs.cpSync(d, path.join(DIST, d), { recursive: true });
  }
}

// 3. Patch index.html in dist to use the bundled JS.
const indexPath = path.join(DIST, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(
  '<script type="module" src="js/app.js"></script>',
  '<script type="module" src="js/app.min.js"></script>'
);
fs.writeFileSync(indexPath, html);

// 4. Copy js/config.js separately (so it can be edited per deployment).
fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });
if (fs.existsSync('js/config.js')) {
  fs.cpSync('js/config.js', path.join(DIST, 'js/config.js'));
}

console.log('Build complete → dist/');
console.log('Deploy the dist/ folder to your hosting.');
