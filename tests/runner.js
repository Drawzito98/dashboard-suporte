/**
 * Lightweight test runner — no dependencies, runs in Node.js.
 * Usage: node tests/runner.js
 */
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
const failures = [];

function describe(name, fn) {
  console.log(`\n  ${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    passed++;
    console.log(`    ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e });
    console.log(`    ✗ ${name}`);
    console.log(`      ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

assert.equal = (a, b, msg) => {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

assert.deepEqual = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};

assert.throws = (fn, msg) => {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  if (!threw) throw new Error(msg || 'Expected function to throw');
};

assert.ok = (val, msg) => {
  if (!val) throw new Error(msg || `Expected truthy, got ${JSON.stringify(val)}`);
};

// Load test files
const testDir = path.join(__dirname);
const files = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));

for (const file of files) {
  const mod = { exports: {} };
  const fn = require(path.join(testDir, file));
  if (typeof fn === 'function') fn({ describe, it, assert });
}

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
