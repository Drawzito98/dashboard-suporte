const assert = require('node:assert/strict');
const { readRows, summarize } = require('../static/looker-report');

const csv = {
  meta: { fields: ['Atendente', 'Finalizados', 'Média aval.', 'Assumidos'] },
  errors: [],
  data: [
    { Atendente: 'Pessoa A', Finalizados: '20', 'Média aval.': '4,50', Assumidos: '999' },
    { Atendente: 'Pessoa B', Finalizados: '10', 'Média aval.': '', Assumidos: '888' },
    { Atendente: 'Pessoa C', Finalizados: '8', 'Média aval.': '5', Setor: 'N2' },
    { Atendente: 'Pessoa D', Finalizados: '2', 'Média aval.': '0' },
    { Atendente: 'TOTAL', Finalizados: '40', 'Média aval.': '4,75' }
  ]
};
const registry = new Map([['pessoa a', 'N1'], ['pessoa b', 'N1']]);
const parse = input => readRows(input, registry, name => name === 'TOTAL');
const rows = parse(csv);
const report = summarize(rows, 10);
assert.equal(report.sourceTotal, 40);
assert.equal(report.total, 30);
assert.equal(report.belowMinimum, 2);
assert.deepEqual(report.sectors, [{ sector: 'N1', people: 2, finished: 30, average: 15, score: 4.5, rated: 1 }]);
assert.equal(summarize(rows, 0, 'N2').total, 8);
assert.equal(summarize(rows, 0, 'Sem setor definido').sectors[0].score, 0);
assert.equal(summarize(rows, 21).people.length, 0);
assert.throws(() => parse({ ...csv, data: [csv.data[0], csv.data[0]] }), /repetidos/);
assert.throws(() => parse({ ...csv, errors: [{}] }), /inválido/);
assert.throws(() => parse({ ...csv, meta: {} }), /colunas/);
console.log('Looker: total, corte inclusivo, filtro de setor, notas ausentes e CSV inválido verificados.');
