const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

async function load(rows, failAt) {
  const calls = [];
  const client = { from() { return {
    select() { return this; },
    order(column, options) {
      assert.equal(column, 'id');
      assert.equal(options.ascending, true);
      return this;
    },
    async range(start, end) {
      calls.push([start, end]);
      return start === failAt ? { error: new Error('offline') } : { data: rows.slice(start, end + 1) };
    }
  }; } };
  const context = { supabase: { createClient: () => client }, console: { warn() {}, error() {} } };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../static/db.js'), 'utf8'), context);
  return { result: await context.dbLoadRecords(), calls };
}

(async () => {
  const rows = Array.from({ length: 1205 }, (_, id) => ({ id, 'Mês': id >= 1000 ? '2026-09' : '2026-08', Score: 4.8 }));
  const { result, calls } = await load(rows);
  assert.equal(result.length, 1205);
  assert.equal(result[1204]['Mês'], '2026-09');
  assert.equal(result[1204].SCORE, 4.8);
  assert.deepEqual(calls, [[0, 999], [1000, 1999]]);
  assert.equal((await load(rows, 1000)).result, null);
  assert.equal((await load([])).result.length, 0);
  assert.equal((await load(rows.slice(0, 1000))).calls.length, 2);
  console.log('Leitura completa, setembro após 1.000 registros, página vazia e falha sem restauração parcial verificados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
