import assert from 'node:assert/strict';
import { buildHistoryPeople, summarizeHistoryPerson } from '../static/features/panorama/history-person.mjs';

const registry = {
  'Ana Ferreira Lima': { nivel: 'N1' },
  'Daniel Souza': { nivel: 'N2' }
};
function period(id, start, end, updated, rows) {
  return {
    id, periodo_inicio: start, periodo_fim: end, updated_at: updated + 'T00:00:00Z',
    equipe: { headers: ['Atendente', 'Assumidos', 'Média aval.', 'Finalizados'], rows }
  };
}
const records = [
  period('mais-antigo', '2026-11-03', '2026-11-08', '2026-11-09', [
    ['Ana Lima', '0', '4,60', '53'], ['Daniel Souza', '0', '4,73', '42']
  ]),
  period('consolidado', '2026-11-01', '2026-11-14', '2026-11-15', [
    ['Ana Ferreira Lima', '0', '4,71', '145'], ['Daniel Souza', '0', '—', '60']
  ]),
  period('outra-semana', '2026-11-15', '2026-11-21', '2026-11-22', [
    ['Ana Lima', '0', '4,82', '70']
  ]),
  period('fronteira', '2026-11-14', '2026-11-17', '2026-11-18', [
    ['Ana Lima', '0', '4,50', '42']
  ]),
  period('duplicados', '2026-11-22', '2026-11-27', '2026-11-28', [
    ['Ana Ferreira Lima', '0', '5,00', '20'], ['Ana Lima', '0', '4,90', '15']
  ]),
  period('vira-mes', '2026-11-29', '2026-12-04', '2026-12-06', [
    ['Ana Lima', '0', '4,40', '60']
  ])
];
const { people, periods } = buildHistoryPeople(records, '2026-11', registry);
assert.deepEqual(people.map(person => [person.name, person.level]), [['Ana Ferreira Lima', 'N1'], ['Daniel Souza', 'N2']]);
const ana = summarizeHistoryPerson(periods, people[0].id);
assert.equal(ana.total, 215);
assert.equal(ana.included, 2);
assert.deepEqual(ana.rows.map(row => [row.id, row.finalized, row.score, row.balance, row.status]), [
  ['consolidado', 145, 4.71, 5, 'included'],
  ['mais-antigo', 53, 4.6, -6, 'overlap'],
  ['fronteira', 42, 4.5, 7, 'overlap'],
  ['outra-semana', 70, 4.82, 0, 'included'],
  ['duplicados', undefined, undefined, undefined, 'ambiguous'],
  ['vira-mes', 60, 4.4, 1, 'cross-month']
]);
const daniel = summarizeHistoryPerson(periods, people[1].id);
assert.equal(daniel.total, 60);
assert.equal(daniel.rows[0].score, null);
assert.equal(daniel.rows[0].balance, null);
assert.equal(daniel.rows.at(-1).status, 'missing');

const december = buildHistoryPeople(records, '2026-12', registry);
assert.equal(summarizeHistoryPerson(december.periods, december.people[0].id).total, null);

const reported = buildHistoryPeople([period('zero', '2026-11-02', '2026-11-02', '2026-11-03', [
  ['Daniel Souza', '0', '—', '0'], ['Outra Pessoa', '1', '4,60', '1.000']
])], '2026-11', registry);
assert.equal(summarizeHistoryPerson(reported.periods, reported.people[0].id).total, 0);
assert.equal(summarizeHistoryPerson(reported.periods, reported.people[1].id).total, 1000);
assert.equal(summarizeHistoryPerson(reported.periods, reported.people[1].id).rows[0].balance, null);
console.log('Histórico individual: identificação, finalizados, nota, meta N1, sobreposição e virada de mês conferidos.');

if (process.argv[2] && process.argv[3]) {
  const { readFile } = await import('node:fs/promises');
  const { analyzeWeekly } = await import('../static/features/panorama/weekly.mjs');
  const { readZip } = await import('../static/features/panorama/zip.mjs');
  const [weekly, extended] = await Promise.all(process.argv.slice(2, 4).map(async path =>
    analyzeWeekly(readZip(new Blob([await readFile(path)])))
  ));
  assert.ok(weekly.valid && extended.valid);
  const toRecord = (report, id, updated_at) => ({
    id, updated_at, periodo_inicio: report.period.start, periodo_fim: report.period.end,
    equipe: report.analysis.tables.team
  });
  const { people, periods } = buildHistoryPeople([
    toRecord(weekly, 'semanal', '2026-11-09T00:00:00Z'),
    toRecord(extended, 'quinzenal', '2026-11-15T00:00:00Z')
  ], '2026-11', {});
  const common = people.find(person => periods.every(period => period.members.has(person.id)));
  assert.ok(common);
  const result = summarizeHistoryPerson(periods, common.id);
  assert.equal(result.included, 1);
  const included = result.rows.find(row => row.status === 'included');
  assert.equal(included.id, 'quinzenal');
  assert.equal(result.total, included.finalized);
  assert.equal(result.rows.find(row => row.id === 'semanal').status, 'overlap');
  console.log('ZIPs originais com recortes sobrepostos: finalizados individuais incluídos uma única vez.');
}
