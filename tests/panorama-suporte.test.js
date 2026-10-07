const assert = require('node:assert/strict');
const { process: processCsv, report, time } = require('../static/panorama-suporte.js');
const fields = ['Atendente', 'Finalizados', 'Clientes atendidos', 'Média avaliação', 'TMA', 'TMR', 'Assumidos', 'Transferidos', 'TMF 80%', 'SCORE'];
const data = [
  { Atendente: 'Alice', Finalizados: '1.000', 'Clientes atendidos': '200', 'Média avaliação': '4,00', TMA: '01:00:00', TMR: '00:02:00', Assumidos: 'inválido', Transferidos: '99999', 'TMF 80%': 'inválido', SCORE: '9' },
  { Atendente: 'Bruno', Finalizados: '500', 'Clientes atendidos': '100', 'Média avaliação': '5,00', TMA: '03:00:00', TMR: '00:04:00', SCORE: '2' },
  { Atendente: 'Total', Finalizados: '1500' }
];
const rows = processCsv(data, fields);
const options = { sector: 'Suporte', start: '2026-10-01', end: '2026-10-07', hide: true, order: 'FINALIZADOS' };
const result = report(rows, options);
assert.equal(rows.length, 2);
assert.deepEqual(result.metrics.map(m => m[1]), ['1.500', '750,00', '300', '4,50 / 5,00', '02:00:00', '00:03:00']);
assert.equal(result.ranking[0].name, 'Atendente 01');
assert.ok(!result.markdown.includes('Alice') && !result.html.includes('Bruno'));
assert.equal(report(rows, { ...options, order: 'CSAT' }).ranking[0].name, 'Atendente 02');
assert.equal(report(rows, { ...options, order: 'SCORE' }).ranking[0].name, 'Atendente 01');
assert.equal(report(rows, { ...options, hide: false }).ranking[0].name, 'Alice');
assert.throws(() => report(rows, { ...options, end: '2026-09-01' }));
assert.throws(() => processCsv(data, fields.filter(f => f !== 'TMA')));
assert.throws(() => processCsv([data[0], data[0]], fields));
assert.throws(() => processCsv([{ ...data[0], TMA: '00:99:00' }], fields));
assert.throws(() => processCsv([{ ...data[0], 'Média avaliação': '' }], fields));
assert.throws(() => report(processCsv(data.slice(0, 2), fields.filter(f => f !== 'SCORE')), { ...options, order: 'SCORE' }));
assert.equal(time(90061), '25:01:01');
const malicious = processCsv([{ ...data[0], Atendente: '<img src=x onerror=alert(1)>|Alice' }], fields);
const safe = report(malicious, { ...options, hide: false });
assert.ok(!safe.html.includes('<img'));
assert.ok(safe.markdown.includes('\\|Alice'));
console.log('Panorama: cálculos, ordenação, privacidade, validação e escape verificados.');
