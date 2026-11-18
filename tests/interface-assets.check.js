// Fixtures must exercise the same available styles, never silently pass with a 404 CSS.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
let count = 0;
for (const name of fs.readdirSync(__dirname).filter(name => name.endsWith('.browser.html'))) {
  const source = fs.readFileSync(path.join(__dirname, name), 'utf8');
  for (const match of source.matchAll(/(?:src|href)=["'](\.\.\/static\/[^"']+)["']/g)) {
    const target = path.resolve(__dirname, match[1].split('?')[0]);
    assert.ok(fs.existsSync(target), name + ': asset ausente ' + match[1]);
    count++;
  }
}
console.log('Interface: ' + count + ' referências locais das fixtures existem.');
