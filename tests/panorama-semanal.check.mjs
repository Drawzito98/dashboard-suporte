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
  assert.ok(mismatch.issues.some(issue => issue.code === 'total-mismatch'));

  const missing = await analyzeWeekly(entries.filter(entry => entry !== daily));
  assert.equal(missing.valid, false);
  assert.ok(missing.issues.some(issue => issue.code === 'missing-file' && issue.severity === 'error'));
  console.log('Panorama semanal: ZIP real, KPIs, avisos, duplicidade, schema, totais e arquivo ausente conferidos.');
}

if (globalThis.process?.argv[2]) await checkWeekly(process.argv[2]);
