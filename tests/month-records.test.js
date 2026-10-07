const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { isEmptyPerformanceRecord } = require('../static/month-records.js');
assert.equal(isEmptyPerformanceRecord({ Finalizados: 0, SCORE: null, TMA: '00:00:00' }), true);
for (const row of [{ Finalizados: 1 }, { SCORE: 4.9 }, { 'Observações': 'Férias' }, { TMA: '00:00:01' }, { Finalizados: 'inválido' }, { Objetivo: 'Meta' }]) assert.equal(isEmptyPerformanceRecord(row), false);
const dbSource = fs.readFileSync(path.join(__dirname, '../static/db.js'), 'utf8');
const functionSource = dbSource.slice(dbSource.indexOf('async function dbDeleteEmptyMonth('), dbSource.indexOf('async function dbDeleteRecord('));
function fakeDatabase(initial, changeAfterRead = false) {
  const records = initial.map(row => ({ ...row }));
  let reads = 0;
  return { records, from() {
    const filters = []; let deleting = false;
    const query = {
      select() { return query; }, delete() { deleting = true; return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      is(key, value) { filters.push(row => row[key] === value); return query; },
      then(resolve, reject) {
        if (!deleting) {
          const data = records.filter(row => filters.every(match => match(row))).map(row => ({ ...row }));
          if (++reads === 1 && changeAfterRead) records[0].Finalizados = 99;
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        }
        const data = [];
        for (let i = records.length - 1; i >= 0; i--) if (filters.every(match => match(records[i]))) data.push(...records.splice(i, 1));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      }
    }; return query;
  } };
}
async function run() {
  const initial = [{ id: 1, 'Mês': '2026-10', Finalizados: 0, Score: null }, { id: 2, 'Mês': '2026-09', Finalizados: 120 }];
  const database = fakeDatabase(initial);
  const context = { requireAdmin: () => true, sbClient: database, isEmptyPerformanceRecord, reverseMapRecord: row => row };
  vm.runInNewContext(functionSource, context);
  let result = await context.dbDeleteEmptyMonth('2026-10');
  assert.equal(result.deleted, 1); assert.equal(result.remaining.length, 0);
  assert.equal(database.records[0]['Mês'], '2026-09');
  const populated = fakeDatabase([{ ...initial[0], Finalizados: 10 }]);
  context.sbClient = populated;
  await assert.rejects(context.dbDeleteEmptyMonth('2026-10'), /preenchidos/);
  assert.equal(populated.records.length, 1);
  const concurrent = fakeDatabase(initial, true); context.sbClient = concurrent;
  result = await context.dbDeleteEmptyMonth('2026-10');
  assert.equal(result.deleted, 0); assert.equal(result.remaining[0].Finalizados, 99);
  await assert.rejects(context.dbDeleteEmptyMonth('2026-13'), /válido/);
  context.requireAdmin = () => false;
  await assert.rejects(context.dbDeleteEmptyMonth('2026-10'), /administrador/);
  const index = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.ok(!index.includes('static/desafio-diario.js') && !index.includes('static/desafio-diario.css'));
  console.log('Mês vazio: exclusão restrita ao mês, proteção de dados preenchidos e alterações concorrentes verificadas.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
