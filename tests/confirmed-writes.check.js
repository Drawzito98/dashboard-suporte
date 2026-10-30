const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { webcrypto: crypto } = require('node:crypto');
const { create } = require('../static/data-runtime.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const memory = new Map(), tables = { feedbacks: new Map(), metas: new Map(), avaliacoes: new Map(), tarefas: new Map(), anotacoes_diarias: new Map(), colaboradores_info: new Map(), colaborador_fotos: new Map(), colab_inativos: new Map(), pontos_extras: new Map(), ferias:new Map(), ausencias:new Map(), regras:new Map() }, calls = [];
  const session = create({ storage: { getItem: k => memory.get(k) || null, setItem: (k,v) => { if(control.cacheFail) throw Error('quota'); memory.set(k,v); }, removeItem: k => memory.delete(k) } });
  session.bind({ id: 'owner', app_metadata: { role: 'admin' } });
  const control = { mode: 'ok', hold: null, release: null, admin: true };
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from(table) {
    let mode = 'read', payload, single = false, range = null; const filters = [];
    const q = { range(a,b) { range=[a,b]; return q; }, select() { return q; }, order() { return q; }, eq(k,v) { filters.push([k,v]); return q; }, single() { single = true; return q; }, maybeSingle() { single=true;return q; }, not(k,op,v){filters.push([k,v,'notLike']);return q;},
      insert(p){mode='insert';payload=p;return q;}, update(p) { mode='update';payload=p;return q; }, upsert(p,options) { mode = 'write'; payload = p; q.conflict=options?.onConflict;return q; }, delete() { mode = 'delete'; return q; },
      then(resolve,reject) { return Promise.resolve().then(async () => {
        calls.push({ table, mode, payload, filters, range });
        const snapshot = [...tables[table].values()].map(r => ({...r}));
        if (control.hold) { const held = control.hold; control.hold = null; await held; }
        if (control.mode === 'network') throw Error('offline');
        if (range && control.failPage === range[0]) return {error:{message:'later page'}};
        if(control.missingSalary&&table==='colaboradores_info'&&Object.prototype.hasOwnProperty.call(payload||{},'salario'))return{error:{code:'PGRST204',message:'Missing salario column'}};
        if (control.mode === 'error') return { error: { message: 'RLS' } };
        let rows;
        if(mode==='insert'){if(Object.prototype.hasOwnProperty.call(payload,'id'))throw Error('IDENTITY ALWAYS');rows=[{...payload,id:String(tables[table].size+1),created_at:'2026-10-29'}];rows.forEach(r=>tables[table].set(r.id,r));}
        else if (mode === 'write') { rows = (Array.isArray(payload) ? payload : [payload]).map(r => ({ ...r, created_at: r.created_at || '2026-10-29' })); rows=rows.map(r=>{const old=q.conflict==='user_id,nome'?[...tables[table].values()].find(row=>row.user_id===r.user_id&&row.nome===r.nome):tables[table].get(r.id);return {...old,...r,id:old?.id||r.id||crypto.randomUUID()};});rows.forEach(r => tables[table].set(r.id,r)); }
        else { rows = snapshot.filter(r => filters.every(([k,v,op]) => op==='notLike'?!String(r[k]||'').startsWith(v.slice(0,-1)):(k==='id'?String(r[k])===String(v):r[k]===v))); if (range) rows=rows.slice(range[0],range[1]+1); if (mode === 'delete') rows.forEach(r => tables[table].delete(r.id)); if (mode === 'update') {rows=rows.map(r=>({...r,...payload}));rows.forEach(r=>tables[table].set(r.id,r));} }
        if (control.mode === 'lost' && ['write','update','insert','delete'].includes(mode)) throw Error('response lost');
        if(control.foreign) rows=rows.map(row=>({...row,user_id:'other'}));
        return { data: control.mode === 'missing' ? null : single ? rows[0] : rows, error: null };
      }).then(resolve,reject); }
    }; return q;
  }};
  const c = { console, crypto, AppState:session.state, AppDataSession: session, appStorage: session.cache, sbClient: client, requireAdmin: () => control.admin, FeatureLoader: { ensure: async () => {} }, AppRepositories: {}, Event:class{constructor(type){this.type=type;}},document:{addEventListener(){}},CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent(){} }; c.window = c;
  vm.createContext(c);
  for (const name of ['db-extra','repositories/development','repositories/performance','repositories/routine','repositories/people','repositories/attendance']) vm.runInContext(fs.readFileSync('static/'+name+'.js','utf8'),c);
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
  // Quadro compartilhado: não filtrar autores nem sobrescrever texto ao mover.
  const rr=setup(),rule={id:crypto.randomUUID(),titulo:'Regra',descricao:'Texto original',status:'vigente',categoria:'Geral',posicao:1};
  for(const mode of ['error','network','missing']){rr.control.mode=mode;await assert.rejects(rr.c.dbRegrasSave(rule));assert.equal(rr.c.AppState.get('regras'),null);}
  rr.control.mode='lost';await assert.rejects(rr.c.dbRegrasSave(rule));rr.control.mode='ok';await rr.c.dbRegrasSave(rule);assert.equal(rr.tables.regras.size,1,'Retry de criação usa o mesmo UUID');
  rr.tables.regras.set(rule.id,{...rr.tables.regras.get(rule.id),user_id:'outro-admin',descricao:'Texto de outro administrador'});
  await rr.c.dbRegrasLoad();assert.equal(rr.c.getRegrasConfirmadas()[0].descricao,'Texto de outro administrador','Quadro continua compartilhado');
  await rr.c.dbRegraMove(rule.id,'revisao',2);
  const moveCall=rr.calls.filter(r=>r.table==='regras'&&r.mode==='update').at(-1);
  assert.deepEqual(Object.keys(moveCall.payload).sort(),['posicao','status','updated_at']);assert.equal(rr.tables.regras.get(rule.id).descricao,'Texto de outro administrador');assert.equal(rr.tables.regras.get(rule.id).user_id,'outro-admin');
  await rr.c.dbRegrasSave({...rule,_editing:true,titulo:'Editada'});assert.equal(rr.tables.regras.get(rule.id).status,'revisao','Editar texto preserva coluna atual');assert.equal(rr.tables.regras.get(rule.id).user_id,'outro-admin','Editar preserva autoria');
  for(const method of ['dbRegrasDelete','dbRegraMove']){rr.control.mode='error';await assert.rejects(rr.c[method](rule.id,'arquivada',3));assert.equal(rr.c.getRegrasConfirmadas().length,1);}
  rr.control.mode='ok';rr.control.admin=false;await assert.rejects(rr.c.dbRegrasSave(rule));await assert.rejects(rr.c.dbRegraMove(rule.id,'vigente',4));await assert.rejects(rr.c.dbRegrasDelete(rule.id));rr.control.admin=true;
  rr.control.hold=new Promise(r=>rr.control.release=r);const oldRules=rr.c.dbRegrasLoad();await tick();await rr.c.dbRegraMove(rule.id,'arquivada',3);rr.control.release();await oldRules;assert.equal(rr.c.getRegrasConfirmadas()[0].status,'arquivada','Leitura antiga não desfaz movimento');
  rr.control.cacheFail=true;rr.c.console={...console,warn(){}};await rr.c.dbRegraMove(rule.id,'vigente',4);assert.equal(rr.c.getRegrasConfirmadas()[0].status,'vigente');rr.control.cacheFail=false;
  await rr.c.dbRegrasDelete(rule.id);await assert.rejects(rr.c.dbRegrasSave({...rule,_editing:true}),'Não recriar regra excluída durante edição');
  rr.session.cache.setItem('sistema_regras_v1',JSON.stringify([rule]));assert.equal((await rr.c.dbRegrasLoad()).length,0);assert.ok(rr.session.cache.getItem('sistema_regras_v1'),'Cache antigo preservado sem adoção automática');
  for(let i=0;i<1001;i++){const id=crypto.randomUUID();rr.tables.regras.set(id,{...rule,id});}
  rr.control.failPage=500;assert.equal((await rr.c.dbRegrasLoad()).length,0);rr.control.failPage=null;assert.equal((await rr.c.dbRegrasLoad()).length,1001);
  const lateRules=setup();lateRules.control.hold=new Promise(r=>lateRules.control.release=r);const pendingRule=lateRules.c.dbRegrasSave(rule);await tick();lateRules.session.invalidate();lateRules.control.release();await assert.rejects(pendingRule,/Sessão alterada/);assert.equal(lateRules.c.AppState.get('regras'),null);
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
  const rt=setup(), task={id:crypto.randomUUID(),titulo:'Conferir',descricao:'Original',data:'2026-10-29',prioridade:'alta',status:'pendente',rotinaAtiva:true,rotinaProximaData:'2026-10-29',rotinaIntervalo:15}, note={id:crypto.randomUUID(),data:'2026-10-29',conteudo:'Nota privada',etiquetas:'reunião'};
  for(const [resource,save,item,remove] of [['tarefas','dbTarefasSave',task,'dbTarefasDelete'],['anotacoes','dbAnotacoesSave',note,'dbAnotacoesDelete']]) {
    for(const mode of ['error','network','missing']){rt.control.mode=mode;await assert.rejects(rt.c[save](item));assert.equal(rt.c.AppState.get(resource),null);}
    rt.control.mode='ok';rt.control.foreign=true;await assert.rejects(rt.c[save](item));rt.control.foreign=false;
    rt.control.mode='lost';await assert.rejects(rt.c[save](item));rt.control.mode='ok';await rt.c[save](item);
    assert.equal(rt.c.AppState.get(resource).length,1,'Retentativa confirma o mesmo UUID');
    rt.control.mode='error';await assert.rejects(rt.c[remove](item.id));assert.equal(rt.c.AppState.get(resource).length,1,'Exclusão não é otimista');rt.control.mode='ok';
  }
  await rt.c.dbTarefaStatus(task.id,{status:'andamento'});let call=rt.calls.at(-1);assert.deepEqual(Object.keys(call.payload).sort(),['status','updated_at']);
  await rt.c.dbTarefasSave({...task,titulo:'Texto editado'});assert.equal(rt.c.AppState.get('tarefas')[0].status,'andamento');
  await rt.c.dbAnotacaoFavorito(note.id,true);call=rt.calls.at(-1);assert.deepEqual(Object.keys(call.payload).sort(),['favorito','updated_at']);
  await rt.c.dbAnotacoesSave({...note,conteudo:'Nova nota',favorito:false});assert.equal(rt.c.AppState.get('anotacoes')[0].favorito,true,'Editar texto preserva favorito atual');
  const activity={id:crypto.randomUUID(),user_id:'owner',conteudo:'atividade-colaborador:v1:{"tipo":"atividade"}'};rt.tables.anotacoes_diarias.set(activity.id,activity);
  await assert.rejects(rt.c.dbAnotacoesSave({...note,id:activity.id}));await assert.rejects(rt.c.dbAnotacoesSave({...note,conteudo:activity.conteudo}));
  await assert.rejects(rt.c.dbAnotacoesDelete(activity.id));await assert.rejects(rt.c.dbAnotacaoFavorito(activity.id,true));assert.equal(rt.tables.anotacoes_diarias.get(activity.id).conteudo,activity.conteudo);
  assert.equal((await rt.c.dbAnotacoesLoad()).length,1,'Atividades não entram na biblioteca');
  rt.control.cacheFail=true;rt.c.console={...console,warn(){}};await rt.c.dbTarefasSave({...task,titulo:'Servidor confirmou sem cache'});assert.equal(rt.c.AppState.get('tarefas')[0].titulo,'Servidor confirmou sem cache');rt.control.cacheFail=false;
  const recurrence={status:'pendente',data:'2026-10-29',rotinaUltimaConclusao:'2026-10-29',rotinaProximaData:'2026-11-13'};
  await rt.c.dbTarefaStatus(task.id,recurrence);await rt.c.dbTarefaStatus(task.id,recurrence);assert.equal(rt.c.AppState.get('tarefas')[0].rotinaProximaData,'2026-11-13','Patch recorrente é idempotente');
  for(const [resource,load,table]of [['tarefas','dbTarefasLoad','tarefas'],['anotacoes','dbAnotacoesLoad','anotacoes_diarias']]){
    const paged=setup();for(let i=0;i<1101;i++){const id=crypto.randomUUID();paged.tables[table].set(id,{...task,...note,id,user_id:'owner'});}
    paged.control.failPage=500;assert.equal((await paged.c[load]()).length,0,'Falha de página não publica parcial');paged.control.failPage=null;assert.equal((await paged.c[load]()).length,1101);
    paged.tables[table].clear();assert.equal((await paged.c[load]()).length,0,'Servidor vazio é oficial');
  }
  for(const [method,args]of [['dbTarefasSave',[task]],['dbTarefaStatus',[task.id,{status:'concluida'}]],['dbTarefasDelete',[task.id]],['dbAnotacoesSave',[note]],['dbAnotacaoFavorito',[note.id,true]],['dbAnotacoesDelete',[note.id]]]){
    const late=setup();late.tables.tarefas.set(task.id,{...task,user_id:'owner'});late.tables.anotacoes_diarias.set(note.id,{...note,user_id:'owner'});late.control.hold=new Promise(r=>late.control.release=r);
    const pending=late.c[method](...args);await tick();const before=[...late.memory.entries()];late.session.invalidate();late.control.release();await assert.rejects(pending,/Sessão alterada/);assert.deepEqual([...late.memory.entries()],before);
  }
  for(const [load,resource,table,item]of [['dbTarefasLoad','tarefas','tarefas',task],['dbAnotacoesLoad','anotacoes','anotacoes_diarias',note]]){
    const late=setup();late.tables[table].set(item.id,{...item,user_id:'owner'});late.control.hold=new Promise(r=>late.control.release=r);const pending=late.c[load]();await tick();late.session.invalidate();late.control.release();assert.equal((await pending).length,0);assert.equal(late.c.AppState.get(resource),null);
  }
  for(const [load,save,resource,item,field,value]of [['dbTarefasLoad','dbTarefasSave','tarefas',task,'titulo','Edição mais recente'],['dbAnotacoesLoad','dbAnotacoesSave','anotacoes',note,'conteudo','Nota mais recente']]){
    const concurrent=setup();await concurrent.c[save](item);concurrent.control.hold=new Promise(r=>concurrent.control.release=r);const reading=concurrent.c[load]();await tick();await concurrent.c[save]({...item,[field]:value});concurrent.control.release();await reading;assert.equal(concurrent.c.AppState.get(resource)[0][field],value,'Leitura antiga não desfaz gravação confirmada');
  }
  rt.control.admin=false;await assert.rejects(rt.c.dbTarefasSave(task));await assert.rejects(rt.c.dbTarefaStatus(task.id,{status:'concluida'}));await assert.rejects(rt.c.dbTarefasDelete(task.id));await rt.c.dbAnotacoesSave(note);rt.control.admin=true;
  const people=setup(),person='Pessoa exata',profile={setor_atual:'Suporte',nivel:'N2',salario:2000,observacoes:'Contexto privado'};
  for(const mode of ['error','network','missing']){people.control.mode=mode;await assert.rejects(people.c.dbColabInfoSave(person,profile));assert.equal(people.c.AppState.get('colaboradores'),null);}
  people.control.mode='ok';people.control.foreign=true;await assert.rejects(people.c.dbColabInfoSave(person,profile));people.control.foreign=false;
  people.control.mode='lost';await assert.rejects(people.c.dbColabInfoSave(person,profile));people.control.mode='ok';await people.c.dbColabInfoSave(person,profile);assert.equal(people.tables.colaboradores_info.size,1,'Chave conta/nome evita duplicação');
  const profileId=people.c.getColabInfoLocal()[person].id;await people.c.dbColabInfoSave(person,{setor_atual:'Financeiro'});assert.equal(people.c.getColabInfoLocal()[person].salario,2000,'Patch parcial não apaga outros campos');assert.equal(people.c.getColabInfoLocal()[person].id,profileId);
  people.control.missingSalary=true;const salaryCalls=people.calls.length;await assert.rejects(people.c.dbColabInfoSave(person,{salario:3000}));assert.equal(people.calls.length,salaryCalls+1,'Não reenvia omitindo salário');assert.equal(people.c.getColabInfoLocal()[person].salario,2000);people.control.missingSalary=false;
  people.control.mode='error';await assert.rejects(people.c.dbColabInfoSave(person,{observacoes:''}));assert.equal(people.c.getColabInfoLocal()[person].observacoes,profile.observacoes);people.control.mode='ok';
  people.control.cacheFail=true;people.c.console={...console,warn(){}};await people.c.dbColabInfoSave(person,{nivel:'N3'});assert.equal(people.c.getColabInfoLocal()[person].nivel,'N3');people.control.cacheFail=false;
  people.control.hold=new Promise(r=>people.control.release=r);const oldProfile=people.c.dbColabInfoLoad();await tick();await people.c.dbColabInfoSave(person,{observacoes:'Última edição'});people.control.release();await oldProfile;assert.equal(people.c.getColabInfoLocal()[person].observacoes,'Última edição');
  const photoId=crypto.randomUUID();people.control.mode='lost';await assert.rejects(people.c.dbFotoSave(person,'data:image/webp;base64,AAA',photoId));assert.equal(people.c.AppState.get('fotos'),null);people.control.mode='ok';await people.c.dbFotoSave(person,'data:image/webp;base64,AAA',photoId);assert.equal(people.tables.colaborador_fotos.size,1);
  people.control.mode='error';await assert.rejects(people.c.dbFotoSave(person,''));assert.ok(people.c.AppState.get('fotos')[person]);people.control.mode='ok';await people.c.dbFotoSave(person,'');assert.equal(people.c.AppState.get('fotos')[person],undefined);
  const inactive={id:crypto.randomUUID(),user_id:'owner',nome:person},otherInactive={id:crypto.randomUUID(),user_id:'owner',nome:'Outra pessoa'},foreignInactive={id:crypto.randomUUID(),user_id:'other',nome:person};for(const r of [inactive,otherInactive,foreignInactive])people.tables.colab_inativos.set(r.id,r);
  people.control.mode='error';await assert.rejects(people.c.dbColabActivate(person));assert.ok(people.tables.colab_inativos.has(inactive.id));people.control.mode='ok';await people.c.dbColabActivate(person);assert.ok(!people.tables.colab_inativos.has(inactive.id));assert.ok(people.tables.colab_inativos.has(otherInactive.id));assert.ok(people.tables.colab_inativos.has(foreignInactive.id));
  for(const [method,args]of [['dbColabInfoSave',[person,profile]],['dbFotoSave',[person,'photo',photoId]],['dbColabActivate',[person]]]){const late=setup();late.control.hold=new Promise(r=>late.control.release=r);const pending=late.c[method](...args);await tick();const before=[...late.memory.entries()];late.session.invalidate();late.control.release();await assert.rejects(pending,/Sessão alterada/);assert.deepEqual([...late.memory.entries()],before);}
  for(const [table,load,resource]of [['colaboradores_info','dbColabInfoLoad','colaboradores'],['colaborador_fotos','dbFotosLoad','fotos']]){const page=setup();for(let i=0;i<1101;i++){const id=crypto.randomUUID();page.tables[table].set(id,{id,user_id:'owner',nome:'Pessoa '+i});}page.control.failPage=500;assert.equal(Object.keys(await page.c[load]()).length,0);page.control.failPage=null;assert.equal(Object.keys(await page.c[load]()).length,1101);page.tables[table].clear();assert.equal(Object.keys(await page.c[load]()).length,0);}
  const preserved=setup();preserved.session.cache.setItem('sistema_colaboradores_info_v1',JSON.stringify({Legado:{observacoes:'Edição local antiga',updatedAt:'2099-01-01'}}));await preserved.c.dbColabInfoLoad();assert.equal(Object.keys(preserved.c.getColabInfoLocal()).length,0,'Servidor vazio prevalece sobre timestamp local');assert.equal(JSON.parse(preserved.session.cache.getItem('sistema_colaboradores_backup_v1')).Legado.observacoes,'Edição local antiga','Cópia privada anterior preservada separadamente');assert.equal(preserved.calls.filter(call=>call.mode!=='read').length,0,'Preservação não escreve no servidor');
  for(const method of ['dbColabInfoLoad','dbFotosLoad']){const late=setup();late.tables.colaboradores_info.set('test',{id:'test',user_id:'owner',nome:person});late.tables.colaborador_fotos.set('test',{id:'test',nome:person,foto_url:'photo'});late.control.hold=new Promise(r=>late.control.release=r);const pending=late.c[method]();await tick();const before=[...late.memory.entries()];late.session.invalidate();late.control.release();assert.equal(Object.keys(await pending).length,0);assert.deepEqual([...late.memory.entries()],before);}
  people.control.admin=false;for(const [method,args]of [['dbColabInfoSave',[person,profile]],['dbFotoSave',[person,'photo']],['dbColabActivate',[person]]])await assert.rejects(people.c[method](...args));
  const bn=setup(),bonus={id:crypto.randomUUID(),colaborador:'Pessoa',mes:'2026-10',pontos:3,descricao:'Projeto',createdAt:'2026-10-01T12:00:00Z'};
  for(const mode of ['error','network','missing']){bn.control.mode=mode;await assert.rejects(bn.c.dbPontosExtrasSave(bonus));assert.equal(bn.c.AppState.get('pontosExtras'),null);}
  bn.control.mode='ok';bn.control.foreign=true;await assert.rejects(bn.c.dbPontosExtrasSave(bonus));bn.control.foreign=false;
  bn.control.mode='lost';await assert.rejects(bn.c.dbPontosExtrasSave(bonus));bn.control.mode='ok';await bn.c.dbPontosExtrasSave(bonus);assert.equal(bn.tables.pontos_extras.size,1);assert.equal(bn.c.getPontosExtrasLocal()[0].mes,bonus.mes);
  await bn.c.dbPontosExtrasSave({...bonus,pontos:4});assert.equal(bn.c.getPontosExtrasLocal()[0].createdAt,bonus.createdAt);
  bn.control.mode='error';await assert.rejects(bn.c.dbPontosExtrasDelete(bonus.id));assert.equal(bn.c.getPontosExtrasLocal().length,1);bn.control.mode='ok';
  bn.control.hold=new Promise(r=>bn.control.release=r);const oldBonus=bn.c.dbPontosExtrasLoad();await tick();await bn.c.dbPontosExtrasSave({...bonus,pontos:3});bn.control.release();await oldBonus;assert.equal(bn.c.getPontosExtrasLocal()[0].pontos,3);
  bn.control.cacheFail=true;bn.c.console={...console,warn(){}};await bn.c.dbPontosExtrasSave({...bonus,descricao:'Confirmado sem cache'});assert.equal(bn.c.getPontosExtrasLocal()[0].descricao,'Confirmado sem cache');bn.control.cacheFail=false;
  for(const item of [{...bonus,id:crypto.randomUUID(),pontos:-1},{...bonus,id:crypto.randomUUID(),mes:'2026-09',pontos:100},{...bonus,id:crypto.randomUUID(),colaborador:'Pessoa parecida',pontos:400},{...bonus,id:crypto.randomUUID(),mes:'',pontos:5}])await bn.c.dbPontosExtrasSave(item);
  vm.runInContext(fs.readFileSync('static/scoring.js','utf8'),bn.c);vm.runInContext("scoringRules=[{id:'pontos_extras',defaultValue:2}]",bn.c);
  assert.equal(bn.c.computeScoreForCollaborator('Pessoa',[{Atendente:'Pessoa','Mês':'2026-10'}]).total,4,'Mês exato, pessoa exata, sinais e multiplicador preservados');
  assert.equal(bn.c.computeScoreForCollaborator('Pessoa',[]).total,214,'Sem meses nas linhas preserva a soma de todo histórico');
  bn.session.cache.setItem('sistema_bonus_editando_v1',JSON.stringify(bonus));await bn.c.dbPontosExtrasDelete(bonus.id);assert.ok(bn.session.cache.getItem('sistema_bonus_editando_v1'),'Excluir não apaga rascunho');
  bn.control.admin=false;await assert.rejects(bn.c.dbPontosExtrasSave(bonus));await assert.rejects(bn.c.dbPontosExtrasDelete(bonus.id));
  const pageBonus=setup();for(let i=0;i<1101;i++){const id=crypto.randomUUID();pageBonus.tables.pontos_extras.set(id,{...bonus,id,user_id:'owner'});}pageBonus.control.failPage=500;assert.equal((await pageBonus.c.dbPontosExtrasLoad()).length,0);pageBonus.control.failPage=null;assert.equal((await pageBonus.c.dbPontosExtrasLoad()).length,1101);assert.equal(pageBonus.c.getPontosExtrasLocal()[0].mes,'2026-10');pageBonus.tables.pontos_extras.clear();assert.equal((await pageBonus.c.dbPontosExtrasLoad()).length,0);
  for(const [method,args]of [['dbPontosExtrasSave',[bonus]],['dbPontosExtrasDelete',[bonus.id]],['dbPontosExtrasLoad',[]]]){const late=setup();late.tables.pontos_extras.set(bonus.id,{...bonus,user_id:'owner'});late.control.hold=new Promise(r=>late.control.release=r);const pending=late.c[method](...args);await tick();const before=[...late.memory.entries()];late.session.invalidate();late.control.release();if(method==='dbPontosExtrasLoad')assert.equal((await pending).length,0);else await assert.rejects(pending,/Sessão alterada/);assert.deepEqual([...late.memory.entries()],before);}
  const oldBonusCache=setup();oldBonusCache.session.cache.setItem('sistema_pontos_extras_v1',JSON.stringify([bonus]));await oldBonusCache.c.dbPontosExtrasLoad();assert.equal(oldBonusCache.c.getPontosExtrasLocal().length,0);assert.equal(JSON.parse(oldBonusCache.session.cache.getItem('sistema_bonus_backup_v1'))[0].id,bonus.id);assert.ok(oldBonusCache.calls.every(call=>call.mode==='read'));
  for(const resource of ['ferias','ausencias']){
    const save=resource==='ferias'?'dbFeriasSave':'dbAusenciasSave',load=resource==='ferias'?'dbFeriasLoad':'dbAusenciasLoad',remove=resource==='ferias'?'dbFeriasDelete':'dbAusenciasDelete';
    const item=resource==='ferias'?{colaborador:'Pessoa',data_inicio:'2026-11-01',data_fim:'2026-11-10',_requestId:crypto.randomUUID()}:{colaborador:'Pessoa',data:'2026-11-01',periodo:'manha',motivo:'Motivo privado',_requestId:crypto.randomUUID()};
    for(const mode of ['error','network','missing','lost']){const ctx=setup();ctx.control.mode=mode;await assert.rejects(ctx.c[save](item));assert.equal(ctx.c.getPresenceList(resource).length,0);assert.ok(ctx.c.getPresencePending(resource),'Envio fica reservado');ctx.control.mode='ok';const before=ctx.calls.length;await assert.rejects(ctx.c[save](item),/sem confirmação/);assert.equal(ctx.calls.length,before,'Não repete inserção sem decisão explícita');await ctx.c[load]();assert.ok(ctx.c.getPresencePending(resource),'Leitura não libera criação incerta');if(mode==='lost'||mode==='missing')assert.equal(ctx.c.getPresenceList(resource).length,1);}
    const ctx=setup();ctx.control.foreign=true;await assert.rejects(ctx.c[save](item));assert.equal(ctx.c.getPresenceList(resource).length,0);ctx.control.foreign=false;
    // O usuário escolheu o registro visível: UPDATE pelo ID confirmado, sem outra criação.
    await ctx.c[load]();const id=ctx.c.getPresenceList(resource)[0].id;ctx.c.clearPresencePending(resource);await ctx.c[save]({...item,id});assert.equal(ctx.tables[resource].size,1);assert.equal(ctx.calls.filter(call=>call.mode==='insert').length,1);assert.equal(ctx.c.getPresenceList(resource)[0].id,id);
    ctx.control.mode='error';await assert.rejects(ctx.c[remove](id));assert.equal(ctx.c.getPresenceList(resource).length,1);await assert.rejects(ctx.c[save]({...item,id}));assert.equal(ctx.c.getPresenceList(resource).length,1);ctx.control.mode='ok';
    ctx.control.hold=new Promise(r=>ctx.control.release=r);const read=ctx.c[load]();await tick();await ctx.c[save]({...item,id,colaborador:'Edição recente'});ctx.control.release();await read;assert.equal(ctx.c.getPresenceList(resource)[0].colaborador,'Edição recente');
    ctx.control.cacheFail=true;ctx.c.console={...console,warn(){}};await ctx.c[save]({...item,id,colaborador:'Confirmado sem cache'});assert.equal(ctx.c.getPresenceList(resource)[0].colaborador,'Confirmado sem cache');ctx.control.cacheFail=false;
    await assert.rejects(ctx.c[save]({...item,id:'legado-temporario'}));await assert.rejects(ctx.c[remove](9007199254740992));
    ctx.session.cache.setItem('rascunho-presenca',JSON.stringify(item));await ctx.c[remove](id);assert.equal(ctx.c.getPresenceList(resource).length,0);assert.ok(ctx.session.cache.getItem('rascunho-presenca'));
    ctx.control.admin=false;await assert.rejects(ctx.c[save](item));await assert.rejects(ctx.c[remove]('1'));assert.throws(()=>ctx.c.clearPresencePending(resource));
    const simultaneous=setup();simultaneous.control.hold=new Promise(r=>simultaneous.control.release=r);const create1=simultaneous.c[save](item);await tick();const create2=simultaneous.c[save](item);simultaneous.control.release();const duplicateResults=await Promise.allSettled([create1,create2]);assert.equal(duplicateResults[0].status,'fulfilled');assert.equal(duplicateResults[1].status,'rejected');assert.equal(simultaneous.calls.filter(call=>call.mode==='insert').length,1,'Mesma criação não é inserida outra vez após confirmação');await assert.rejects(simultaneous.c[save](item),/já foi confirmada/);
    const quota=setup();quota.control.cacheFail=true;await assert.rejects(quota.c[save](item));assert.equal(quota.calls.length,0,'Reserva indisponível impede INSERT');
    const pages=setup();for(let i=1;i<=1101;i++)pages.tables[resource].set(String(i),{...item,id:String(i),user_id:'owner'});pages.control.failPage=500;assert.equal((await pages.c[load]()).length,0);pages.control.failPage=null;assert.equal((await pages.c[load]()).length,1101);assert.ok(pages.c.presenceReadConfirmed(resource));pages.control.mode='network';await pages.c[load]();assert.ok(!pages.c.presenceReadConfirmed(resource),'Cache não é consulta confirmada');pages.control.mode='ok';pages.tables[resource].clear();assert.equal((await pages.c[load]()).length,0);
    for(const [method,args]of [[save,[item]],[save,[{...item,id:'1'}]],[remove,['1']],[load,[]]]){const late=setup();late.tables[resource].set('1',{...item,id:'1',user_id:'owner'});late.control.hold=new Promise(r=>late.control.release=r);const pending=late.c[method](...args);await tick();const before=[...late.memory.entries()];late.session.invalidate();late.control.release();if(method===load)assert.equal((await pending).length,0);else await assert.rejects(pending,/Sessão alterada/);assert.deepEqual([...late.memory.entries()],before);}
    const preserved=setup();preserved.session.cache.setItem(resource==='ferias'?'sistema_ferias_v1':'sistema_ausencias_v1',JSON.stringify([{id:'antigo'}]));await preserved.c[load]();assert.equal(JSON.parse(preserved.session.cache.getItem('sistema_presenca_backup_'+resource+'_v1'))[0].id,'antigo');
  }
  const dates=setup();vm.runInContext(fs.readFileSync('static/ferias.js','utf8'),dates.c);dates.c.AppState.publish('ferias',[{id:'1',colaborador:'Pessoa',data_inicio:'2026-11-01',data_fim:'2026-11-10'}]);assert.ok(dates.c.temFeriasSobrepostas('Pessoa','2026-11-10','2026-11-20'));assert.ok(!dates.c.temFeriasSobrepostas('Pessoa','2026-11-01','2026-11-10','1'));assert.ok(!dates.c.temFeriasSobrepostas('Pessoa parecida','2026-11-01','2026-11-10'));assert.ok(!dates.c.temFeriasSobrepostas('Pessoa','2026-11-11','2026-11-20'));
  console.log('Férias/ausências: IDs identity, confirmação/conta, reserva antes do envio, resposta incerta sem reinserção, vínculo por ID, paginação, datas/sobreposição, cache, exclusão e sessão.');
  console.log('Bônus: confirmação/UUID/conta, mês após recarga, sinais e fórmula, exclusão, cache, cópia anterior, paginação, leitura concorrente e sessão.');
  console.log('Cadastro: confirmação/conta/nome, patch parcial, salário sem fallback otimista, cache indisponível, foto confirmada, paginação, sessão e reativação por pessoa.');
  console.log('Rotina: confirmação/UUID/dono, paginação, exclusão, sessão, cache indisponível, status e favorito isolados, recorrência idempotente, notas privadas e atividades protegidas.');
  console.log('Avaliações: confirmação/ID/dono, erro/rede/retentativa, paginação, status isolado, cache indisponível, rascunho separado, permissões, leituras antigas, fila local e sessão encerrada.');
  console.log('Escritas confirmadas: erros/RLS/rede, retorno sem ID, retentativa idempotente, serialização, metas por item, exclusão, papel, leitura concorrente e sessão encerrada.');
})().catch(e => { console.error(e); process.exitCode = 1; });
