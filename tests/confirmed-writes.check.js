const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { webcrypto: crypto } = require('node:crypto');
const { create } = require('../static/data-runtime.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const memory = new Map(), tables = { feedbacks: new Map(), metas: new Map(), avaliacoes: new Map() }, calls = [];
  const session = create({ storage: { getItem: k => memory.get(k) || null, setItem: (k,v) => { if(control.cacheFail) throw Error('quota'); memory.set(k,v); }, removeItem: k => memory.delete(k) } });
  session.bind({ id: 'owner', app_metadata: { role: 'admin' } });
  const control = { mode: 'ok', hold: null, release: null, admin: true };
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from(table) {
    let mode = 'read', payload, single = false, range = null; const filters = [];
    const q = { range(a,b) { range=[a,b]; return q; }, select() { return q; }, order() { return q; }, eq(k,v) { filters.push([k,v]); return q; }, single() { single = true; return q; },
      update(p) { mode='update';payload=p;return q; }, upsert(p) { mode = 'write'; payload = p; return q; }, delete() { mode = 'delete'; return q; },
      then(resolve,reject) { return Promise.resolve().then(async () => {
        calls.push({ table, mode, payload, filters, range });
        const snapshot = [...tables[table].values()].map(r => ({...r}));
        if (control.hold) { const held = control.hold; control.hold = null; await held; }
        if (control.mode === 'network') throw Error('offline');
        if (range && control.failPage === range[0]) return {error:{message:'later page'}};
        if (control.mode === 'error') return { error: { message: 'RLS' } };
        let rows;
        if (mode === 'write') { rows = (Array.isArray(payload) ? payload : [payload]).map(r => ({ ...r, created_at: r.created_at || '2026-10-29' })); rows.forEach(r => tables[table].set(r.id,r)); }
        else { rows = snapshot.filter(r => filters.every(([k,v]) => r[k] === v)); if (range) rows=rows.slice(range[0],range[1]+1); if (mode === 'delete') rows.forEach(r => tables[table].delete(r.id)); if (mode === 'update') {rows=rows.map(r=>({...r,...payload}));rows.forEach(r=>tables[table].set(r.id,r));} }
        if (control.mode === 'lost' && mode === 'write') throw Error('response lost');
        if(control.foreign) rows=rows.map(row=>({...row,user_id:'other'}));
        return { data: control.mode === 'missing' ? null : single ? rows[0] : rows, error: null };
      }).then(resolve,reject); }
    }; return q;
  }};
  const c = { console, crypto, AppState:session.state, AppDataSession: session, appStorage: session.cache, sbClient: client, requireAdmin: () => control.admin, FeatureLoader: { ensure: async () => {} }, AppRepositories: {} }; c.window = c;
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
  const ev = setup(), evaluation = {id:crypto.randomUUID(),colaborador:'Pessoa exata',ciclo:'Set-Dez 2026',scores:{1:3},comentarios_finais:['Evidência original'],observacoes_gerais:'Texto',status:'pendente',createdAt:'2026-01-01T12:00:00.000Z'};
  for(const mode of ['error','network','missing']){ev.control.mode=mode;await assert.rejects(ev.c.dbAvaliacaoSave(evaluation));assert.equal(ev.session.cache.getItem('sistema_avaliacoes_v1'),null,'Falha não publica avaliação');assert.equal(ev.c.AppState.get('avaliacoes'),null);}
  ev.control.mode='ok';ev.control.foreign=true;await assert.rejects(ev.c.dbAvaliacaoSave(evaluation));assert.equal(ev.c.AppState.get('avaliacoes'),null,'Dono incorreto não confirma');ev.control.foreign=false;
  ev.control.mode='lost';await assert.rejects(ev.c.dbAvaliacaoSave(evaluation));ev.control.mode='ok';
  assert.equal((await ev.c.dbAvaliacaoSave(evaluation)).status,'confirmed');assert.equal(ev.tables.avaliacoes.size,1,'Retentativa não duplica');
  await ev.c.dbAvaliacaoStatus(evaluation.id,'revisado');const statusCall=ev.calls.filter(call=>call.table==='avaliacoes'&&call.mode==='update').at(-1);
  assert.deepEqual(Object.keys(statusCall.payload).sort(),['status','updated_at'],'Status não reenvia campos da avaliação');
  await ev.c.dbAvaliacaoSave({...evaluation,observacoes_gerais:'Editado'});let confirmed=ev.c.AppState.get('avaliacoes')[0];assert.equal(confirmed.status,'revisado','Salvar texto não desfaz status confirmado');assert.equal(confirmed.createdAt,evaluation.createdAt);assert.equal(confirmed.observacoes_gerais,'Editado');
  ev.control.mode='error';await assert.rejects(ev.c.dbAvaliacaoStatus(evaluation.id,'pendente'));assert.equal(ev.c.AppState.get('avaliacoes')[0].status,'revisado');await assert.rejects(ev.c.dbAvaliacaoDelete(evaluation.id));assert.equal(ev.c.AppState.get('avaliacoes').length,1);
  ev.control.mode='ok';ev.control.cacheFail=true;ev.c.console={...console,warn(){}};assert.equal((await ev.c.dbAvaliacaoSave({...evaluation,observacoes_gerais:'Confirmado sem cache'})).status,'confirmed');assert.equal(ev.c.AppState.get('avaliacoes')[0].observacoes_gerais,'Confirmado sem cache');ev.control.cacheFail=false;
  ev.session.cache.setItem('sistema_avaliacao_rascunho_v1',JSON.stringify(evaluation));await ev.c.dbAvaliacaoDelete(evaluation.id);assert.equal(ev.c.AppState.get('avaliacoes').length,0);assert.ok(ev.session.cache.getItem('sistema_avaliacao_rascunho_v1'),'Excluir registro não apaga rascunho');
  ev.control.admin=false;for(const [method,args]of [['dbAvaliacaoSave',[evaluation]],['dbAvaliacaoStatus',[evaluation.id,'revisado']],['dbAvaliacaoDelete',[evaluation.id]]])await assert.rejects(ev.c[method](...args));ev.control.admin=true;
  // Leitura paginada completa ou fallback confirmado, nunca um parcial de 500 linhas.
  for(let i=0;i<1101;i++){const id=crypto.randomUUID();ev.tables.avaliacoes.set(id,{id,user_id:'owner',colaborador:'Pessoa '+i,status:'pendente'});}
  ev.control.failPage=500;assert.equal((await ev.c.dbAvaliacoesLoad()).length,0,'Erro posterior não publica parcial');ev.control.failPage=null;
  let readStart=ev.calls.length;assert.equal((await ev.c.dbAvaliacoesLoad()).length,1101);assert.deepEqual(ev.calls.slice(readStart).map(call=>call.range[0]),[0,500,1000]);
  ev.tables.avaliacoes.clear();assert.equal((await ev.c.dbAvaliacoesLoad()).length,0,'Vazio do servidor é oficial');assert.ok(ev.session.cache.getItem('sistema_avaliacao_rascunho_v1'),'Leitura vazia preserva rascunho');
  // Serialização e leitura iniciada antes da edição.
  await ev.c.dbAvaliacaoSave(evaluation);ev.control.hold=new Promise(r=>ev.control.release=r);const oldRead=ev.c.dbAvaliacoesLoad();await tick();await ev.c.dbAvaliacaoSave({...evaluation,observacoes_gerais:'Última edição'});ev.control.release();await oldRead;assert.equal(ev.c.AppState.get('avaliacoes')[0].observacoes_gerais,'Última edição');
  ev.control.hold=new Promise(r=>ev.control.release=r);const edit1=ev.c.dbAvaliacaoSave({...evaluation,observacoes_gerais:'Primeira'});await tick();const edit2=ev.c.dbAvaliacaoSave({...evaluation,observacoes_gerais:'Segunda'});ev.control.release();await Promise.all([edit1,edit2]);assert.equal(ev.c.AppState.get('avaliacoes')[0].observacoes_gerais,'Segunda');
  for(const [method,args]of [['dbAvaliacaoSave',[evaluation]],['dbAvaliacaoStatus',[evaluation.id,'revisado']],['dbAvaliacaoDelete',[evaluation.id]]]){
    const late=setup();late.tables.avaliacoes.set(evaluation.id,{...evaluation,user_id:'owner'});late.control.hold=new Promise(r=>late.control.release=r);
    const pending=late.c[method](...args);await tick();const cache=[...late.memory.entries()];late.session.invalidate();late.control.release();await assert.rejects(pending,/Sessão alterada/);assert.deepEqual([...late.memory.entries()],cache);assert.equal(late.c.AppState.get('avaliacoes'),null);
  }
  const wrongAuth=setup();wrongAuth.c.sbClient.auth.getUser=async()=>({data:{user:{id:'another-owner'}}});await assert.rejects(wrongAuth.c.dbAvaliacaoSave(evaluation));assert.equal(wrongAuth.calls.length,0,'Sessão de rede diferente não envia');
  const lateRead=setup();lateRead.tables.avaliacoes.set(evaluation.id,{...evaluation,user_id:'owner'});lateRead.control.hold=new Promise(r=>lateRead.control.release=r);const response=lateRead.c.dbAvaliacoesLoad();await tick();lateRead.session.invalidate();lateRead.control.release();assert.equal((await response).length,0,'Leitura tardia não devolve dados da conta anterior');
  console.log('Avaliações: confirmação/ID/dono, erro/rede/retentativa, paginação, status isolado, cache indisponível, rascunho separado, permissões, leituras antigas, fila local e sessão encerrada.');
  console.log('Escritas confirmadas: erros/RLS/rede, retorno sem ID, retentativa idempotente, serialização, metas por item, exclusão, papel, leitura concorrente e sessão encerrada.');
})().catch(e => { console.error(e); process.exitCode = 1; });
