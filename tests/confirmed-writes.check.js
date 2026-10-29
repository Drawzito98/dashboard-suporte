const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { webcrypto: crypto } = require('node:crypto');
const { create } = require('../static/data-runtime.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const memory = new Map(), tables = { feedbacks: new Map(), metas: new Map() }, calls = [];
  const session = create({ storage: { getItem: k => memory.get(k) || null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) } });
  session.bind({ id: 'owner', app_metadata: { role: 'admin' } });
  const control = { mode: 'ok', hold: null, release: null, admin: true };
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from(table) {
    let mode = 'read', payload, single = false; const filters = [];
    const q = { select() { return q; }, order() { return q; }, eq(k,v) { filters.push([k,v]); return q; }, single() { single = true; return q; },
      upsert(p) { mode = 'write'; payload = p; return q; }, delete() { mode = 'delete'; return q; },
      then(resolve,reject) { return Promise.resolve().then(async () => {
        calls.push({ table, mode, payload, filters });
        const snapshot = [...tables[table].values()].map(r => ({...r}));
        if (control.hold) { const held = control.hold; control.hold = null; await held; }
        if (control.mode === 'network') throw Error('offline');
        if (control.mode === 'error') return { error: { message: 'RLS' } };
        let rows;
        if (mode === 'write') { rows = (Array.isArray(payload) ? payload : [payload]).map(r => ({ ...r, created_at: '2026-10-29' })); rows.forEach(r => tables[table].set(r.id,r)); }
        else { rows = snapshot.filter(r => filters.every(([k,v]) => r[k] === v)); if (mode === 'delete') rows.forEach(r => tables[table].delete(r.id)); }
        if (control.mode === 'lost' && mode === 'write') throw Error('response lost');
        return { data: control.mode === 'missing' ? null : single ? rows[0] : rows, error: null };
      }).then(resolve,reject); }
    }; return q;
  }};
  const c = { console, crypto, AppDataSession: session, appStorage: session.cache, sbClient: client, requireAdmin: () => control.admin, FeatureLoader: { ensure: async () => {} }, AppRepositories: {} }; c.window = c;
  vm.createContext(c);
  for (const name of ['db-extra','repositories/development','repositories/performance']) vm.runInContext(fs.readFileSync('static/'+name+'.js','utf8'),c);
  return { c, session, calls, control, tables, memory };
}
(async () => {
  const x = setup(), { c, control, tables, session, calls } = x;
  const feedback = { id: crypto.randomUUID(), colaborador: 'Pessoa', mes: '2026-10', feedback_final: 'Texto' };
  for (const mode of ['error','network','missing']) {
    control.mode = mode; await assert.rejects(c.dbFeedbacksSave(feedback)); assert.equal(session.cache.getItem('sistema_feedbacks_v1'),null);
  }
  control.mode = 'lost'; await assert.rejects(c.dbFeedbacksSave(feedback));
  control.mode = 'ok'; assert.equal((await c.dbFeedbacksSave(feedback)).status,'confirmed'); assert.equal(tables.feedbacks.size,1,'retry usa mesmo UUID');
  assert.equal(JSON.parse(session.cache.getItem('sistema_feedbacks_v1'))[0].id,feedback.id);
  const goal = { id: crypto.randomUUID(), title: 'Meta nova', target: 100 }, other = { id: crypto.randomUUID(), user_id: 'owner', title: 'Criada em outro dispositivo' };
  tables.metas.set(other.id,other);
  for (const mode of ['error','network','missing']) { control.mode = mode; await assert.rejects(c.dbMetasSave([goal])); assert.ok(tables.metas.has(other.id),'não apaga metas existentes'); }
  control.mode = 'ok'; await c.dbMetasSave([goal]); assert.equal(tables.metas.size,2);
  assert.ok(!calls.some(r => r.table==='metas' && r.mode==='delete'),'salvar não emite DELETE');
  control.mode = 'error'; await assert.rejects(c.dbMetasDelete(goal.id)); assert.ok(tables.metas.has(goal.id));
  control.mode = 'ok'; await c.dbMetasDelete(goal.id); assert.ok(!tables.metas.has(goal.id)); assert.ok(tables.metas.has(other.id));
  control.admin = false; await assert.rejects(c.dbMetasSave([goal])); await assert.rejects(c.dbMetasDelete(other.id)); control.admin = true;
  control.hold = new Promise(r => control.release = r);
  const first = c.dbFeedbacksSave({ ...feedback, feedback_final: 'Primeiro' }); await tick();
  const count = calls.length, second = c.dbFeedbacksSave({ ...feedback, feedback_final: 'Segundo' }); await tick(); assert.equal(calls.length,count,'mutações serializadas');
  control.release(); await Promise.all([first,second]); assert.equal(tables.feedbacks.get(feedback.id).feedback_final,'Segundo');
  // Uma leitura iniciada antes da escrita não pode restaurar um snapshot antigo.
  control.hold = new Promise(r => control.release = r); const staleRead = c.dbFeedbacksLoad(); await tick();
  await c.dbFeedbacksSave({ ...feedback, feedback_final: 'Atual' }); control.release(); await staleRead;
  assert.equal(JSON.parse(session.cache.getItem('sistema_feedbacks_v1'))[0].feedback_final,'Atual');
  control.mode = 'error'; await assert.rejects(c.dbFeedbacksDelete(feedback.id)); assert.ok(JSON.parse(session.cache.getItem('sistema_feedbacks_v1')).length);
  control.mode = 'ok'; await c.dbFeedbacksDelete(feedback.id); assert.equal(JSON.parse(session.cache.getItem('sistema_feedbacks_v1')).length,0);
  for (const method of ['dbFeedbacksSave','dbMetasSave']) {
    const y = setup(); y.control.hold = new Promise(r => y.control.release = r);
    const pending = y.c[method](method==='dbFeedbacksSave' ? feedback : [goal]); await tick();
    const before = [...y.memory.entries()]; y.session.invalidate(); y.control.release();
    await assert.rejects(pending,/Sessão alterada/); assert.deepEqual([...y.memory.entries()],before,'resposta tardia não grava cache');
  }
  console.log('Escritas confirmadas: erros/RLS/rede, retorno sem ID, retentativa idempotente, serialização, metas por item, exclusão, papel, leitura concorrente e sessão encerrada.');
})().catch(e => { console.error(e); process.exitCode = 1; });
