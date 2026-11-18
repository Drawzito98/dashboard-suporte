// Cache identity follows local shell content; does not change APP_VERSION or asset URLs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const workerPath = path.join(root, 'sw.js');
let worker = fs.readFileSync(workerPath, 'utf8');
if (!/const CACHE = '[^']+';/.test(worker)) throw new Error('Missing CACHE declaration');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
  .map(m => m[1]).filter(ref => ref.startsWith('static/'));
const manifestSource = fs.readFileSync(path.join(root, 'static/module-manifest.js'), 'utf8');
const manifest = JSON.parse(manifestSource.match(/window\.APP_MODULES = ([\s\S]*);\s*$/)[1]);
const dynamic = [];
function visit(name, stack = []) {
  if (!Object.prototype.hasOwnProperty.call(manifest, name)) throw new Error('Unknown module: ' + name);
  if (stack.includes(name)) throw new Error('Module cycle: ' + [...stack, name].join(' -> '));
  const item = manifest[name];
  for (const dep of item.depends || []) visit(dep, [...stack, name]);
  for (const ref of [...(item.scripts || []), ...(item.styles || [])]) {
    if (!/^\/static\/[a-zA-Z0-9_./-]+\?v=\d+$/.test(ref) || ref.includes('..')) throw new Error('Invalid module asset: ' + ref);
    if (refs.includes(ref.slice(1))) throw new Error('Module loaded both eagerly and lazily: ' + ref);
    dynamic.push(ref.slice(1).split('?')[0]);
  }
}
for (const name of Object.keys(manifest)) visit(name);
const paths = [...new Set(['index.html', 'reporte.html', 'manifest.json', ...refs.map(ref => ref.split('?')[0]), ...dynamic])].sort();
const hash = crypto.createHash('sha256');
// Include worker strategy, excluding the generated identity itself.
hash.update(worker.replace(/const CACHE = '[^']+';/, "const CACHE = '<generated>';"));
for (const file of paths) { hash.update(file); hash.update('\0'); hash.update(fs.readFileSync(path.join(root, file))); }
const identity = 'painel-suporte-' + hash.digest('hex').slice(0, 16);
const expected = "const CACHE = '" + identity + "';";
const shell = worker.match(/const SHELL = (\[[\s\S]*?\]);/);
if (!shell) throw new Error('Missing SHELL');
const entries = JSON.parse(shell[1].replace(/'/g, '"'));
for (const entry of entries) {
  if (entry.startsWith('/static/') && !refs.includes(entry.slice(1)) && /\.(css|js)(\?|$)/.test(entry)) {
    throw new Error('SHELL URL differs from index.html: ' + entry);
  }
  if (!fs.existsSync(path.join(root, entry === '/' ? 'index.html' : entry.split('?')[0]))) throw new Error('Missing shell asset: ' + entry);
}
if (process.argv.includes('--write')) {
  worker = worker.replace(/const CACHE = '[^']+';/, expected);
  fs.writeFileSync(workerPath, worker);
} else if (!worker.includes(expected)) {
  console.error('Cache identity is stale. Run npm run release:cache and review sw.js.');
  process.exitCode = 1;
}
console.log('Cache: ' + identity + '; ' + paths.length + ' shell files checked.');
