// Offline checks only. Browser fixtures and SQL checks remain explicit/manual.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const checks = fs.readdirSync(path.join(root, 'tests')).filter(f => f.endsWith('.check.js')).sort();
const files = process.argv.includes('--checks') ? [] : ['tests/runner.js'];
files.push(...checks.map(f => 'tests/' + f), 'scripts/release.js');
let failed = 0;
for (const file of files) {
  console.log('\nChecking ' + file);
  const result = spawnSync(process.execPath, [file], { cwd: root, stdio: 'inherit' });
  if (result.error || result.status !== 0) { failed++; console.error(result.error || 'Failed: ' + file); }
}
process.exitCode = failed ? 1 : 0;
