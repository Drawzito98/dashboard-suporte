import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeWeekly } from '../static/features/panorama/weekly.mjs';
import { readZip } from '../static/features/panorama/zip.mjs';
import { schemas } from '../static/features/panorama/registry.mjs';
import { filterDepartmentRows, joinTeamNames, joinTeamLevels, n1PeriodTarget, n1FinalizedGap, sortTeamRows } from '../static/features/panorama/analysis.mjs';

import { decodeTeamNote, validateTeamNote } from '../static/features/panorama/team-context.mjs';
import { buildHistorySnapshot, historyMonths, summarizeHistoryMonth } from '../static/features/panorama/history.mjs';

const goalRows = [['Bia', 'N1', '59'], ['Ana', 'N1', '41'], ['Caio', 'N1', '63'], ['Davi', 'N2', '20'], ['Eva', 'N1', '10']];
assert.deepEqual(sortTeamRows(goalRows, 'n1-deficit', 59).map(row => row[0]), ['Eva', 'Ana', 'Bia', 'Caio', 'Davi']);
assert.deepEqual(joinTeamNames([['Ana Lima'], ['João Ribeiro'], ['João Ribeiro Souza'], ['Ana Lima Multi-setor']], {
  'Ana Ferreira Lima': { nivel: 'N1' }, 'João Ribeiro Souza': { nivel: 'N1' }, 'João Ribeiro Santos': { nivel: 'N2' }
}), ['Ana Ferreira Lima', '', 'João Ribeiro Souza', 'Ana Ferreira Lima']);
assert.deepEqual(joinTeamNames([['Ana Lima']], {'Ana Lima': {}, 'Ana Lima Multi-setor': {}}), ['']);

const contextPeriod = { start: '2026-11-03', end: '2026-11-08' };
const contextNote = { person: 'Ana Ferreira Lima', date: '2026-11-03', type: 'operacional', text: 'Sistema indisponível.' };
assert.deepEqual(validateTeamNote({ ...contextNote, text: '  Sistema indisponível.  ' }, contextPeriod), contextNote);
assert.throws(() => validateTeamNote({ ...contextNote, date: '2026-11-02' }, contextPeriod), /período/);
assert.throws(() => validateTeamNote({ ...contextNote, date: '2026-11-31' }, { ...contextPeriod, end: '2026-12-01' }), /período/);
assert.throws(() => validateTeamNote({ ...contextNote, type: 'invalido' }, contextPeriod), /tipo/);
assert.throws(() => validateTeamNote({ ...contextNote, text: ' ' }, contextPeriod), /observação/);
assert.deepEqual(decodeTeamNote({ data: contextNote.date, conteudo: 'panorama-observacao:v1:' +
  JSON.stringify({ ...contextNote, date: '2026-11-04' }) }, contextPeriod), contextNote);
assert.equal(decodeTeamNote({ data: contextNote.date, conteudo: 'anotação geral' }, contextPeriod), null);
assert.equal(decodeTeamNote({ data: contextNote.date, conteudo: 'panorama-observacao:v1:{' }, contextPeriod), null);
console.log('Ordenação, identificação do N1 e observações privadas do Panorama conferidas.');

assert.deepEqual(n1PeriodTarget({ start: '2026-11-03', end: '2026-11-08' }), { days: 5, target: 59 });
assert.deepEqual(n1PeriodTarget({ start: '2026-11-01', end: '2026-11-14' }), { days: 12, target: 140 });
assert.deepEqual(n1PeriodTarget({ start: '2026-07-01', end: '2026-07-31' }), { days: 24, target: 280 });
assert.deepEqual(n1PeriodTarget({ start: '2026-10-30', end: '2026-11-02' }), { days: 3, target: 35 });
assert.deepEqual(n1PeriodTarget({ start: '2026-11-08', end: '2026-11-08' }), { days: 0, target: 0 });
assert.equal(n1FinalizedGap('N1', '50', 59), -9);
assert.equal(n1FinalizedGap('N1', '59', 59), 0);
assert.equal(n1FinalizedGap('N1', '1.000', 59), 941);
assert.equal(n1FinalizedGap('N1', '20', 0), null);
assert.equal(n1FinalizedGap('N2', '100', 59), null);
assert.equal(n1FinalizedGap('—', '100', 59), null);
console.log('Meta de finalizados N1: projeção, teto mensal, mudança de mês e saldo conferidos.');

export async function checkWeekly(zipPath) {
  const archive = new Blob([await readFile(zipPath)]);
  const entries = [];
  for await (const entry of readZip(archive)) entries.push(entry);

  const result = await analyzeWeekly(entries);
  assert.equal(Object.keys(schemas).length, 35);
  assert.deepEqual(result.files, { expected: 35, validated: 35 });
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.deepEqual(result.period, { start: '2026-11-03', end: '2026-11-08' });
  assert.deepEqual(result.kpis, {
    assumidos: 460, finalizados: 460, clientes: 370, inatividade: 354, nota: 4.71,
    tme: 841, tmi: 755, tmr: 84280, recorrencia: 12.03, sla: 65.2, total: 460,
    avaliados: 129, fila: 43
  });
  assert.deepEqual(result.issues.map(issue => issue.code), [
    'comparison-scope', 'partial-month-history', 'detail-limit'
  ]);

  const snapshot = buildHistorySnapshot(result);
  assert.deepEqual(snapshot, result);
  assert.equal(snapshot.days.reduce((total, date) => total + date.finalizados, 0), 460);
  const unknown = buildHistorySnapshot({ ...result, csv: 'dados brutos', issues: [{ severity: 'warning', code: 'unknown-file', file: 'arquivo particular.csv', message: 'CSV fora do catálogo.' }] });
  assert.equal(Object.hasOwn(unknown, 'csv'), false);
  assert.equal(unknown.issues[0].file, 'Arquivo fora do catálogo');
  assert.throws(() => buildHistorySnapshot({ ...result, valid: false }), /Valide o ZIP/);
  assert.equal(result.analysis.tables.team.rows.length, 13);
  assert.deepEqual(result.analysis.score, { target: 4.7, reported: 4.71, distributionMean: 4.49, ratingCount: 129, departmentMean: 4.49, confirmedMean: 4.49, divergent: true });
  assert.ok(result.analysis.findings.some(line => line.includes('43 de 460 atendimentos (9,3%)')));
  assert.ok(result.analysis.tables.heatmap.rows.some(row => row.includes(null)));
  assert.equal(result.analysis.tables.team.headers.at(-1), '% dos finalizados do período');
  assert.ok(result.analysis.findings.some(line => line.includes('10 de 129 avaliações')));
  assert.ok(result.analysis.findings.some(line => line.includes('354 de 460 atendimentos')));
  assert.equal(result.analysis.tables.reasons.rows.length, 12);
  assert.ok(result.analysis.tables.heatmap.rows.length > 0);
  assert.ok(result.analysis.findings.some(line => line.includes('14 finalizados e nenhum assumido')));

  const daily = entries.find(entry => entry.name.endsWith('/atendimentos_por_dia.csv'));
  const renamed = await analyzeWeekly([...entries, { ...daily, name: 'OUTRA/ATENDIMENTOS_POR_DIA.CSV' }]);
  assert.equal(renamed.valid, false);
  assert.ok(renamed.issues.some(issue => issue.code === 'duplicate-file'));

  const broken = await analyzeWeekly(entries.map(entry => entry === daily
    ? { ...entry, text: entry.text.replace('Evento,', 'Data,') } : entry));
  assert.equal(broken.valid, false);
  assert.ok(broken.issues.some(issue => issue.code === 'schema'));

  const mismatch = await analyzeWeekly(entries.map(entry => entry === daily
    ? { ...entry, text: entry.text.replace('146,75', '146,76') } : entry));
  assert.equal(mismatch.valid, false);
  assert.equal(mismatch.analysis, null);
  assert.ok(mismatch.issues.some(issue => issue.code === 'total-mismatch'));

  const missing = await analyzeWeekly(entries.filter(entry => entry !== daily));
  assert.equal(missing.valid, false);
  assert.ok(missing.issues.some(issue => issue.code === 'missing-file' && issue.severity === 'error'));
  console.log('Panorama semanal: ZIP real, KPIs, avisos, duplicidade, schema, totais e arquivo ausente conferidos.');
}

export async function checkExtendedPeriod(zipPath) {
  const result = await analyzeWeekly(readZip(new Blob([await readFile(zipPath)])));
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.deepEqual(result.period, { start: '2026-11-01', end: '2026-11-14' });
  assert.equal(n1PeriodTarget(result.period).target, 140);
  assert.deepEqual(result.files, { expected: 35, validated: 35 });
  assert.equal(result.kpis.assumidos, 888);
  assert.equal(result.kpis.finalizados, 897);
  const departmentRows = result.analysis.tables.departments.rows;
  const largest = filterDepartmentRows(departmentRows, departmentRows[0][0]);
  assert.equal(largest.length, 1);
  assert.equal(largest[0][2], '408');
  assert.ok(result.analysis.tables.departments.headers.includes('TMA'));
  assert.ok(result.analysis.checks.some(line => line.startsWith('897 finalizados:')));
  assert.deepEqual(result.analysis.score, {
    target: 4.7, reported: 4.75, distributionMean: 4.57, ratingCount: 253, departmentMean: 4.57, confirmedMean: 4.57, divergent: true
  });
  assert.deepEqual(joinTeamLevels([['Ana Lima'], ['João Ribeiro'], ['João Ribeiro Souza'], ['Bruna']], {
    'Ana Ferreira Lima': { nivel: 'N2' }, 'João Ribeiro Souza': { nivel: 'N1' },
    'João Ribeiro Santos': { nivel: 'N2' }, 'Bruna Alves': { nivel: 'N2' }
  }), ['N2', '—', 'N1', '—']);
  const team = result.analysis.tables.team;
  assert.equal(team.headers[5], 'Média aval.');
  assert.deepEqual(team.rows.slice(0, 3).map(row => [row[1], row[2], row[5]]), [
    ['145', '146', '4,40'], ['143', '145', '4,71'], ['101', '100', '4,42']
  ]);
  console.log('ZIP de 14 dias: período, notas, volumes e divergência de fontes conferidos.');
}

const historyEntries = [
  { id: '1', updated_at: '2026-11-09T00:00:00Z', dias: [{ date: '2026-10-31', finalizados: 15 }, { date: '2026-11-01', finalizados: 2 }, { date: '2026-11-02', finalizados: 9 }] },
  { id: '2', updated_at: '2026-11-10T00:00:00Z', dias: [{ date: '2026-11-02', finalizados: 12 }, { date: '2026-11-03', finalizados: 0 }, { date: '2026-11-09', finalizados: 6 }] }
];
assert.deepEqual(historyMonths(historyEntries), ['2026-11', '2026-10']);
const monthly = summarizeHistoryMonth(historyEntries, '2026-11');
assert.equal(monthly.total, 20);
assert.equal(monthly.days, 4);
assert.equal(monthly.overlapping, 1);
assert.deepEqual(monthly.weeks.slice(0, 3), [
  { start: '2026-11-01', end: '2026-11-01', days: 1, volume: 2, cumulative: 2 },
  { start: '2026-11-02', end: '2026-11-08', days: 2, volume: 12, cumulative: 14 },
  { start: '2026-11-09', end: '2026-11-15', days: 1, volume: 6, cumulative: 20 }
]);
assert.equal(summarizeHistoryMonth(historyEntries.slice(0, 1), '2026-11').total, 11);
assert.equal(summarizeHistoryMonth(historyEntries, '2026-10').total, 15);
assert.equal(monthly.weeks.at(-1).days, 0);
console.log('Histórico mensal: sobreposição, virada do mês, lacunas e acumulado conferidos.');

if (globalThis.process?.argv[2]) await checkWeekly(process.argv[2]);
if (globalThis.process?.argv[3]) await checkExtendedPeriod(process.argv[3]);
