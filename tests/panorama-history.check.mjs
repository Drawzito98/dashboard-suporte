import assert from 'node:assert/strict';
import { createPanoramaHistoryStore } from '../static/features/panorama/history.mjs';

const calls = [];
const queued = [];
const client = {
  from(table) {
    assert.equal(table, 'panorama_importacoes');
    const record = [];
    calls.push(record);
    return {
      select(...args) { record.push(['select', ...args]); return this; },
      eq(...args) { record.push(['eq', ...args]); return this; },
      order(...args) { record.push(['order', ...args]); return this; },
      insert(...args) { record.push(['insert', ...args]); return this; },
      update(...args) { record.push(['update', ...args]); return this; },
      delete(...args) { record.push(['delete', ...args]); return this; },
      async range(...args) { record.push(['range', ...args]); return queued.shift(); },
      async maybeSingle() { return queued.shift(); }
    };
  }
};
let user = 'gestor-teste';
const store = createPanoramaHistoryStore({ client, getUserId: async () => user, currentUserId: () => user, isAdmin: () => true });
const report = {
  schemaVersion: 1, valid: true,
  period: { start: '2026-11-03', end: '2026-11-03' },
  kpis: { finalizados: 12 }, days: [{ date: '2026-11-03', finalizados: 12, assumidos: 11 }],
  analysis: { tables: {}, score: { confirmedMean: 4.7 }, findings: [], checks: [] },
  files: { expected: 35, validated: 35 }, issues: []
};
const previous = { id: 'registro-teste', updated_at: '2026-11-08T03:00:00.123456Z' };

queued.push({ data: null }, { data: previous });
assert.equal(await store.find(report.period), null);
assert.equal(await store.save(report, null), previous.id);
assert.deepEqual(calls.at(-1)[0], ['insert', {
  user_id: user, periodo_inicio: report.period.start, periodo_fim: report.period.end, relatorio: report
}]);

queued.push({ data: previous }, { data: previous }, { data: { relatorio: report } });
assert.deepEqual(await store.find(report.period), previous);
assert.equal(await store.save(report, previous), previous.id);
assert.ok(calls.at(-1).some(call => call[1] === 'updated_at' && call[2] === previous.updated_at));
assert.deepEqual(await store.open(previous.id), report);

queued.push({ data: null, error: { code: '23505' } }, { data: null });
await assert.rejects(store.save(report, null), /já foi salvo/);
await assert.rejects(store.save(report, previous), /foi alterado/);

queued.push({ data: [previous] }, { data: previous }, { data: [] }, { data: null });
assert.deepEqual(await store.list(), [previous]);
await store.delete(previous);
assert.deepEqual(calls.at(-1).slice(0, 4), [
  ['delete'], ['eq', 'user_id', user], ['eq', 'id', previous.id], ['eq', 'updated_at', previous.updated_at]
]);
assert.deepEqual(await store.list(), []);
await assert.rejects(store.open(previous.id), /não está mais/);

user = 'outro-gestor';
assert.equal(store.isCurrent(), false);
const requestCount = calls.length;
await assert.rejects(store.list(), /novamente/);
assert.equal(calls.length, requestCount);
console.log('Histórico: salva, substitui, reabre, exclui e recusa edição concorrente ou troca de conta.');
