const assert = require('node:assert/strict');
const { create } = require('../static/diagnostico-store.js');
const engine = require('../static/diagnostico-engine.js');
const memory = new Map();
const storage = { getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v) };
let user = { id: 'admin-a', app_metadata: { role: 'admin' } }, offline = false, calls = 0;
const rows = [];
const client = {
  auth: { async getUser() { return { data: { user } }; } },
  from(table) {
    assert.equal(table, 'diagnostico_revisoes');
    return {
      async insert(row) { calls++; if (offline) return { error: { code: '42P01' } }; if (rows.some(r => r.id === row.id)) return { error: { code: '23505' } }; rows.push({ ...row }); return {}; },
      select() { return this; }, eq(field, owner) { assert.equal(field, 'user_id'); this.owner = owner; return this; }, order() { return this; },
      async limit() { return offline ? { error: new Error('offline') } : { data: rows.filter(r => r.user_id === this.owner).reverse() }; }
    };
  }
};
(async () => {
  const store = create({ client, storage, engine });
  const review = { status: 'validado', fingerprint: 'a'.repeat(64), note: 'Conferido', snapshot: { evidence: '4,70' } };
  for (const role of ['viewer', 'colaborador']) {
    user = { id: 'denied', app_metadata: { role } };
    await assert.rejects(() => store.save(review)); await assert.rejects(() => store.load());
  }
  user = { id: 'forged', user_metadata: { role: 'admin' } }; await assert.rejects(() => store.save(review)); assert.equal(calls, 0); assert.equal(memory.size, 0);
  user = { id: 'admin-a', app_metadata: { role: 'admin' } };
  await assert.rejects(() => store.save({ ...review, status: 'ajustado', note: '' }));
  const first = await store.save(review); assert.equal(first.user_id, 'admin-a'); assert.equal(first.pending, undefined);
  const discard = await store.save({ ...review, status: 'descartado', note: 'Contexto revisado' }); assert.notEqual(first.id, discard.id); assert.equal(rows.length, 2);
  offline = true;
  const pending = await store.save({ ...review, status: 'ajustado', note: 'Revisão local' }); assert.equal(pending.pending, true); assert.equal((await store.load()).length, 3);
  user = { id: 'admin-b', app_metadata: { role: 'admin' } }; assert.equal((await store.load()).length, 0);
  user = { id: 'admin-a', app_metadata: { role: 'admin' } }; offline = false;
  const synced = await store.load(); assert.equal(synced.length, 3); assert.ok(synced.every(r => !r.pending)); assert.equal(rows.length, 3);
  await store.load(); assert.equal(rows.length, 3);
  const sql = require('fs').readFileSync(require('path').join(__dirname, '../migration_v49.sql'), 'utf8');
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY')); assert.ok(sql.includes('user_id = auth.uid()')); assert.ok(sql.includes("auth.jwt()->'app_metadata'->>'role'"));
  assert.ok(!/CREATE POLICY[\s\S]*FOR (UPDATE|DELETE)/.test(sql));
  assert.ok(!/ALTER TABLE (?:public\.)?(registros|colaboradores_info)/i.test(sql));
  console.log('Revisões: autorização, isolamento entre usuários, histórico de decisões, falha remota, sincronização e contrato de RLS verificados.');
})().catch(error => { console.error(error); process.exitCode = 1; });
