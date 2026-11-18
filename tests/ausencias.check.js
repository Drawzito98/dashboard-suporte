const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const cacheKey = 'sistema_ausencias_v1';
const saved = new Map();
const operations = [];
const old = { id: 10, colaborador: 'Pessoa de teste', data: '2026-11-05', periodo: 'manha', motivo: 'Histórico' };
let response;
const query = {
  select() { return this; },
  eq(key, value) { operations.push([key, value]); return this; },
  order() { return response; },
  insert(row) { operations.push(row); return this; },
  single() { return response; }
};
const context = vm.createContext({
  localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
  sbClient: {
    auth: { getUser: async () => ({ data: { user: { id: 'responsavel-teste' } } }) },
    from: table => { assert.equal(table, 'ausencias'); return query; }
  },
  document: { addEventListener() {} }
});
for (const file of ['db-extra.js', 'ausencias.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../static', file), 'utf8'), context);
}

(async () => {
  response = { data: [old] };
  const [legacy] = await context.dbAusenciasLoad();
  assert.equal(legacy.tipo, null);
  assert.equal(context.formatarOcorrenciaAusencia(legacy), 'Registro anterior · Manhã');
  assert.equal(legacy.motivo, 'Histórico');

  const { id, ...base } = old;
  const late = { ...base, tipo: 'atraso', minutos_atraso: 17, periodo: 'nao_informado' };
  response = { data: { ...late, id: 11 } };
  assert.equal(context.formatarOcorrenciaAusencia(await context.dbAusenciasSave(late)), 'Atraso · 17 min');
  assert.equal(operations.at(-1).minutos_atraso, 17);
  assert.equal(operations.at(-1).user_id, 'responsavel-teste');

  const missed = { ...base, tipo: 'falta', minutos_atraso: null };
  response = { data: { ...missed, id: 12 } };
  assert.equal(context.formatarOcorrenciaAusencia(await context.dbAusenciasSave({ ...missed, minutos_atraso: 17 })), 'Falta · Manhã');
  assert.equal(operations.at(-1).minutos_atraso, null);
  assert.deepEqual(JSON.parse(saved.get(cacheKey)).map(record => record.id), [12, 11, 10]);

  response = { error: 'conexão indisponível' };
  await assert.rejects(context.dbAusenciasSave(late), /Não foi possível/);
  for (const invalid of [0, 1.5, 1441, NaN]) {
    await assert.rejects(context.dbAusenciasSave({ ...late, minutos_atraso: invalid }), /minutos/);
  }
  assert.deepEqual(JSON.parse(saved.get(cacheKey)).map(record => record.id), [12, 11, 10]);
  console.log('Ausências: histórico, falta, atraso, validação dos minutos e confirmação de gravação conferidos.');
})().catch(error => { console.error(error); process.exitCode = 1; });
