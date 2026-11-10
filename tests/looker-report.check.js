const assert = require('node:assert/strict');
const { readRows, summarize, registryLookup } = require('../static/looker-report');

const csv = {
  meta: { fields: ['Atendente', 'Finalizados', 'Média aval.', 'Assumidos', 'TMA', 'TMI', 'TMR'] },
  errors: [],
  data: [
    { Atendente: 'Ana', Finalizados: '20', 'Média aval.': '4,50', Assumidos: '999', TMA: '25:00:00', TMI: '7m8s', TMR: '0:00:00' },
    { Atendente: 'Bruno Silva', Finalizados: '10', 'Média aval.': '', Assumidos: '888', TMA: '01:00:00', TMI: 'inválido' },
    { Atendente: 'Caio', Finalizados: '8', 'Média aval.': '5' },
    { Atendente: 'Bruno', Finalizados: '2', 'Média aval.': '0', Setor: 'Ignorar' },
    { Atendente: 'Pessoa desconhecida', Finalizados: '0', 'Média aval.': '5' },
    { Atendente: 'TOTAL', Finalizados: '40', 'Média aval.': '4,75' }
  ]
};
const lookup = registryLookup([
  ['Ána Lima', { setor_atual: 'Financeiro', nivel: 'N1' }],
  ['Bruno Silva', { setor_atual: 'Financeiro', nivel: 'N1' }],
  ['Bruno Melo', { setor_atual: 'Fiscal' }],
  ['Caio Nunes', { setor_atual: 'Integrações', nivel: 'N2' }]
]);
const parsedTimes = { '25:00:00': 90000, '01:00:00': 3600, '7m8s': 428, '0:00:00': 0 };
const parse = input => readRows(input, lookup, name => name === 'TOTAL', value => parsedTimes[value]);
const rows = parse(csv);
const report = summarize(rows, 10);
assert.equal(report.sourceTotal, 40);
assert.equal(report.overall.finished, 30);
assert.equal(report.belowMinimum, 3);
assert.equal(rows[0].level, 'N1');
assert.equal(rows[3].sector, '');
assert.equal(rows[4].sector, '');
assert.deepEqual(report.sectors, [{
  sector: 'Financeiro', people: 2, finished: 30, average: 15, score: 4.5, rated: 1, durations: [46800, 428, 0]
}]);
assert.equal(summarize(rows, 0, 'Integrações').overall.finished, 8);
assert.equal(summarize(rows, 10, 'Integrações').belowMinimum, 1);
assert.equal(summarize(rows, 21).overall.score, null);
assert.throws(() => parse({ ...csv, data: [csv.data[0], csv.data[0]] }), /repetidos/);
assert.throws(() => parse({ ...csv, errors: [{}] }), /inválido/);
assert.throws(() => parse({ ...csv, meta: {} }), /colunas/);
console.log('Looker: cadastro, homônimos, total, filtros, notas, durações e CSV inválido verificados.');
