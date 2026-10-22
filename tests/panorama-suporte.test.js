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
for (const missing of ['', '-', '—', 'N/A', 'Sem avaliação']) {
  const incomplete = processCsv([{ ...data[0], 'Média avaliação': missing }, data[1]], fields);
  const partial = report(incomplete, { ...options, order: 'CSAT' });
  assert.equal(partial.metrics[3][1], '5,00 / 5,00');
  assert.equal(partial.ranking[1].csat, null);
  assert.ok(partial.markdown.includes('Sem classificação'));
  assert.ok(partial.markdown.includes('1 dos 2 atendentes'));
}
assert.equal(report(processCsv([{ ...data[0], 'Média avaliação': '' }], fields), options).metrics[3][1], 'Sem avaliação');
assert.equal(report(processCsv([{ ...data[0], 'Média avaliação': '0' }], fields), options).metrics[3][1], '0,00 / 5,00');
assert.throws(() => processCsv([{ ...data[0], 'Média avaliação': 'texto inesperado' }], fields));
assert.throws(() => report(processCsv(data.slice(0, 2), fields.filter(f => f !== 'SCORE')), { ...options, order: 'SCORE' }));
assert.equal(time(90061), '25:01:01');
const newFields = ['Atendente', 'Assumidos', 'Finalizados', 'Transferidos', 'Clientes', 'Média aval.', 'TMA', 'TMI', 'TMR'];
const newRows = processCsv([{ Atendente: 'Renata', Assumidos: '177', Finalizados: '177', Transferidos: '19', Clientes: '164', 'Média aval.': '4,38', TMA: '15:00:60', TMI: '5m60s', TMR: '14:45:09' }], newFields);
assert.equal(newRows[0].clientes, 164);
assert.equal(newRows[0].csat, 4.38);
assert.equal(time(newRows[0].tma), '15:01:00');
assert.equal(time(newRows[0].tmr), '14:45:09');
assert.equal(report(newRows, options).metrics[0][1], '177');
assert.equal(time(processCsv([{ ...data[0], TMA: '161:20:44' }], fields)[0].tma), '161:20:44');
for (const missing of ['', '::', '-', '—', 'N/A', 'N/D', 'Sem informação', null]) {
  const incomplete = processCsv([{ ...data[0], TMR: missing }, data[1]], fields);
  const partial = report(incomplete, options);
  assert.equal(incomplete[0].tmr, null);
  assert.equal(partial.ranking.length, 2);
  assert.equal(partial.metrics[5][1], '00:04:00');
  assert.ok(partial.html.includes('Sem informação'));
  assert.ok(partial.markdown.includes('TMR: média calculada com 1 de 2'));
}
const mixedTimes = report(processCsv([{ ...data[0], TMA: '::' }, { ...data[1], TMR: '::' }], fields), options);
assert.equal(mixedTimes.metrics[4][1], '03:00:00');
assert.equal(mixedTimes.metrics[5][1], '00:02:00');
const noTimes = report(processCsv([{ ...data[0], TMA: '::', TMR: '::' }], fields), options);
assert.equal(noTimes.metrics[4][1], 'Sem informação');
assert.equal(noTimes.metrics[5][1], 'Sem informação');
assert.ok(noTimes.html.includes('Não há TMR informado'));
assert.ok(!noTimes.html.includes('apresentou o maior TMR'));
assert.equal(time(null), 'Sem informação');
const zeroTime = report(processCsv([{ ...data[0], TMR: '00:00:00' }, { ...data[1], TMR: '::' }], fields), options);
assert.equal(zeroTime.metrics[5][1], '00:00:00');
for (const invalid of ['00:99:00', '00:00:99', 'texto inesperado', '-00:01:00', '00::20']) {
  assert.throws(() => processCsv([{ ...data[0], TMR: invalid }], fields));
}
const malicious = processCsv([{ ...data[0], Atendente: '<img src=x onerror=alert(1)>|Alice' }], fields);
const safe = report(malicious, { ...options, hide: false });
assert.ok(!safe.html.includes('<img'));
assert.ok(safe.markdown.includes('\\|Alice'));
console.log('Panorama: cálculos, ordenação, privacidade, validação e escape verificados.');
const withAI = processCsv([...data.slice(0, 2), { ...data[0], Atendente: 'CADU', Finalizados: '10000' }], fields);
const separated = report(withAI, { ...options, separateAI: true });
assert.equal(separated.ranking.length, 2);
assert.equal(separated.metrics[0][1], '1.500');
assert.ok(separated.html.includes('CADU · INTELIGÊNCIA ARTIFICIAL'));
assert.ok(separated.markdown.includes('10.000'));
assert.ok(!separated.html.includes('Alice'));
assert.equal(report(withAI, options).ranking[0].name, 'CADU (IA)');
assert.equal(report(withAI, options).metrics[0][1], '11.500');
assert.throws(() => report([withAI[2]], { ...options, separateAI: true }));

const { automaticReport } = require('../static/panorama-suporte.js');
const autoRows = processCsv([
  { ...data[0], Atendente: '  JOÃO   Silva ' },
  { ...data[1], Atendente: 'Maria' },
  { ...data[1], Atendente: 'Sem cadastro' },
  { ...data[1], Atendente: 'Ambígua' },
  { ...data[1], Atendente: 'CADU' }
], fields);
const registry = { 'João Silva': { setor_atual: 'Financeiro' }, 'AMBÍGUA': { setor_atual: 'ERP' }, 'Ambigua': { setor_atual: 'Fiscal' } };
const history = [
  { Atendente: 'João Silva', Setor: 'Antigo', 'Mês': '2026-09' },
  { Atendente: 'Maria', Setor: 'Antigo', 'Mês': '2026-08' },
  { Atendente: 'Maria', Setor: 'ERP', 'Mês': '2026-09' },
  { Atendente: 'Maria', Setor: 'Futuro', 'Mês': '2026-11' },
  { Atendente: 'Outra pessoa', Setor: 'ERP', 'Mês': '2026-09' }
];
const auto = automaticReport(autoRows, options, registry, history);
assert.deepEqual(auto.sectors, ['Financeiro', 'ERP', 'Setor não identificado', 'Inteligência artificial']);
assert.equal(auto.unidentified, 2);
assert.equal(auto.ranking.length, autoRows.length);
assert.ok(!auto.html.includes('JOÃO') && !auto.markdown.includes('Maria'));
assert.ok(!auto.sectors.includes('Antigo') && !auto.sectors.includes('Futuro'));
assert.equal(automaticReport([autoRows[1]], options, {}, [
  { Atendente: 'Maria', Setor: 'ERP', 'Mês': '2026-09' },
  { Atendente: 'Maria', Setor: 'Fiscal', 'Mês': '2026-09' }
]).unidentified, 1);
assert.equal(automaticReport([autoRows[0]], options, { 'joao silva': { setor_atual: 'ERP' }, 'João Silva': { setor_atual: ' erp ' } }).unidentified, 0);
assert.throws(() => automaticReport(autoRows, { ...options, end: '2026-09-01' }, registry, history));
console.log('Panorama automático: cadastro, histórico, múltiplos setores, nomes, ambiguidades e IA verificados.');
const byFirst = (name, registry, history = []) => automaticReport(processCsv([{ ...data[0], Atendente: name }], fields), options, registry, history);
assert.deepEqual(byFirst('Renata Alves Henriques', { RENATA: { setor_atual: 'Financeiro' } }).sectors, ['Financeiro']);
assert.deepEqual(byFirst('  JOÃO   Santos ', { 'João Silva': { setor_atual: 'ERP' } }).sectors, ['ERP']);
assert.equal(byFirst('Ana Lívia', { 'Ana Maria': { setor_atual: 'ERP' }, 'Ana Paula': { setor_atual: 'Fiscal' } }).unidentified, 1);
assert.equal(byFirst('Ana Lívia', { 'Ana Maria': { setor_atual: 'ERP' }, 'Ana Paula': {} }).unidentified, 1);
assert.deepEqual(byFirst('Ana Maria', { 'Ana Maria': { setor_atual: 'ERP' }, 'Ana Paula': { setor_atual: 'Fiscal' } }).sectors, ['ERP']);
assert.deepEqual(byFirst('Renata Alves', {}, [{ Atendente: 'Renata', Setor: 'Fiscal', 'Mês': '2026-09' }]).sectors, ['Fiscal']);
assert.deepEqual(byFirst('Renata Alves', { Renata: { setor_atual: 'ERP' } }, [{ Atendente: 'Renata Silva', Setor: 'Fiscal', 'Mês': '2026-09' }]).sectors, ['ERP']);
assert.equal(byFirst('Renato Alves', { Renata: { setor_atual: 'ERP' } }).unidentified, 1);
console.log('Primeiro nome: correspondência única, acentos, prioridade do nome completo e ambiguidades verificados.');
