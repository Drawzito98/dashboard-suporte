const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../static/db.js'), 'utf8');

function setup(responses) {
  const storage = new Map();
  const writes = [];
  const client = {
    auth: { async getUser() { return { data: { user: { id: 'admin-user', app_metadata: { role: 'admin' } } } }; } },
    from() { return {
      update(payload) { writes.push(payload); return this; },
      insert() { throw new Error('Uma edição pendente não deve ser inserida novamente'); },
      eq() { return this; },
      async select() { return responses.shift(); }
    }; }
  };
  const context = {
    supabase: { createClient: () => client }, document: { body: { dataset: { role: 'admin' } } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    console: { warn() {}, error() {} }
  };
  context.AppDataSession = require('../static/data-runtime.js').create({ storage: context.localStorage });
  context.RecordsRepository = require('../static/records-repository.js');
  context.AppDataSession.bind({ id: 'admin-user' });
  vm.createContext(context);
  vm.runInContext(source, context);
  return { context, writes };
}

(async () => {
  let { context, writes } = setup([{ error: { code: '42501' } }, { data: [{ id: 7 }] }]);
  assert.equal(await context.dbUpdateRecord(7, { Finalizados: 42 }), true);
  assert.equal(writes[1].user_id, 'admin-user');
  assert.equal(context.getPendingSync().length, 0);

  ({ context, writes } = setup([{ error: { message: 'offline' } }, { error: { message: 'offline' } }, { data: [{ id: 7 }] }]));
  assert.equal(await context.dbUpdateRecord(7, { Finalizados: 42 }), false);
  assert.equal(await context.dbUpdateRecord(7, { Finalizados: 55 }), false);
  assert.equal(context.getPendingSync().length, 1);
  assert.equal(context.getPendingSync()[0].Finalizados, 55);
  assert.equal((await context.syncPendingRecords()).length, 1);
  assert.equal(writes[2].Finalizados, 55);
  assert.equal(context.getPendingSync().length, 0);

  ({ context } = setup([{ data: [] }]));
  assert.equal(await context.dbUpdateRecord(7, { Finalizados: 42 }), false);
  assert.equal(context.getPendingSync().length, 1);
  console.log('Permissão de registro legado, edição offline durável, nova tentativa sem duplicação e confirmação da escrita verificados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
