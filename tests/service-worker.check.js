const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
const current = source.match(/const CACHE = '([^']+)'/)[1];
const handlers = {}, deleted = [], stored = [];
let offline = false, response;
const context = {
  URL, Promise,
  self: { location: { origin: 'https://local.test' }, addEventListener: (name, fn) => handlers[name] = fn,
    clients: { claim() {} }, skipWaiting() {} },
  caches: {
    keys: async () => ['painel-suporte-old', 'other-app-cache', current],
    delete: async key => deleted.push(key),
    open: async () => ({ addAll: async () => {}, put: async (...args) => stored.push(args) }),
    match: async () => 'offline-shell'
  },
  fetch: async () => { if (offline) throw Error('offline'); return { ok: true, clone() { return this; } }; }
};
vm.runInNewContext(source, context);
(async () => {
  let pending;
  handlers.activate({ waitUntil: p => pending = p }); await pending;
  assert.deepEqual(deleted, ['painel-suporte-old']);
  function request(url, options = {}) {
    response = undefined;
    handlers.fetch({ request: { url, method: 'GET', mode: 'cors', headers: { has: () => false }, ...options }, respondWith: p => response = p });
    return response;
  }
  for (const [url, options] of [
    ['https://local.test/api/users', {}],
    ['https://example.supabase.co/rest/v1/registros', {}],
    ['https://local.test/private', { headers: { has: () => true } }],
    ['https://local.test/static/app.js', { method: 'POST' }]
  ]) assert.equal(request(url, options), undefined);
  offline = true;
  assert.equal(await request('https://local.test/', { mode: 'navigate' }), 'offline-shell');
  assert.equal(await request('https://local.test/static/app.js'), 'offline-shell');
  offline = false;
  assert.equal((await request('https://local.test/', { mode: 'navigate' })).ok, true);
  console.log('Worker: cache de outra aplicação preservado; bypass de API/auth/Supabase/POST e fallback offline verificados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
