import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeWeekly } from '../static/features/panorama/weekly.mjs';
import { readZip } from '../static/features/panorama/zip.mjs';
import { schemas } from '../static/features/panorama/registry.mjs';

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

  assert.equal(result.analysis.tables.team.rows.length, 13);
  assert.deepEqual(result.analysis.score, { target: 4.7, reported: 4.71, distributionMean: 4.49, ratingCount: 129, divergent: true });
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
  assert.deepEqual(result.files, { expected: 35, validated: 35 });
  assert.equal(result.kpis.assumidos, 888);
  assert.equal(result.kpis.finalizados, 897);
  assert.deepEqual(result.analysis.score, {
    target: 4.7, reported: 4.75, distributionMean: 4.57, ratingCount: 253, divergent: true
  });
  const team = result.analysis.tables.team;
  assert.equal(team.headers[5], 'Média aval.');
  assert.deepEqual(team.rows.slice(0, 3).map(row => [row[1], row[2], row[5]]), [
    ['145', '146', '4,40'], ['143', '145', '4,71'], ['101', '100', '4,42']
  ]);
  console.log('ZIP de 14 dias: período, notas, volumes e divergência de fontes conferidos.');
}

if (globalThis.process?.argv[2]) await checkWeekly(process.argv[2]);
if (globalThis.process?.argv[3]) await checkExtendedPeriod(process.argv[3]);
