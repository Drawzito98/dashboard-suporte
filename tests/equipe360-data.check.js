const assert = require('node:assert/strict');
const { create, readPdi } = require('../static/equipe360-data.js');
const person = 'Ana Maria';
function setup({ role = 'admin', tables = {}, fail = {}, changeOwner = false, pdi = {} } = {}) {
  const calls = [], storageReads = [];
  let authCalls = 0;
  const client = {
    auth: { async getUser() { return { data: { user: { id: changeOwner && ++authCalls > 1 ? 'other' : 'owner', app_metadata: { role }, user_metadata: { role: 'admin' } } } }; } },
    from(table) {
      const filters = [];
      return {
        select(columns) { calls.push({ table, columns, filters }); return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        like(key, value) { filters.push([key, value]); return this; },
        order() { return this; },
        async range(start, end) {
          if (fail[table] === true || fail[table] === start) return { error: new Error('offline') };
          // Deliberately do not apply query filters: client-side defense must still reject mismatched rows.
          return { data: (tables[table] || []).slice(start, end + 1) };
        }
      };
    }
  };
  const storage = { getItem(key) { storageReads.push(key); assert.equal(key, 'sistema_perfil_pdi_v1_owner'); return JSON.stringify(pdi); }, setItem() { throw Error('Read-only projection must not write'); } };
  return { reader: create({ client, storage }), calls, storageReads };
}
(async () => {
  const base = { user_id: 'owner', colaborador: person };
  const evaluations = Array.from({length:1005}, (_,id) => ({ ...base, id, ciclo:'Set-Dez 2026', status:'revisado', created_at:'2026-10-01T12:00:00Z' }));
  let context = setup({ tables: {
    registros: [{id:1,Atendente:person,Score:4.9},{id:2,Atendente:'Ana',Score:2}],
    colaboradores_info: [{id:'cadastro',user_id:'owner',nome:person},{id:'foreign',user_id:'other',nome:person}],
    avaliacoes:evaluations,
    feedbacks:[{...base,id:1,feedback_final:'Original'},{...base,id:2,user_id:'other'},{...base,id:3,colaborador:'ANA MARIA'}],
    ponto_colaboradores:[{id:'employee',user_id:'owner',nome:person,ponto_jornadas:[]}],
    ponto_importacoes:[{...base,id:'analysis',colaborador_id:'employee'},{...base,id:'wrong',colaborador_id:'another'}],
    anotacoes_diarias:[{id:'activity',user_id:'owner',data:'2026-10-01',conteudo:'atividade-colaborador:v1:'+JSON.stringify({colaborador:person,tipo:'positivo',descricao:'Evidência'})},{id:'note',user_id:'owner',conteudo:'Nota comum sobre Ana'},{id:'foreign',user_id:'other',conteudo:'atividade-colaborador:v1:'+JSON.stringify({colaborador:person,tipo:'positivo',descricao:'Privado'})}]
  }, pdi: { [person]: { planos:[{versao:1,status:'aprovado',salvoEm:'2026-10-02'}] }, Ana:{planos:[{versao:99}]} } });
  let result = await context.reader.load(person, 'owner');
  assert.equal(result.sources.avaliacoes.data.length,1005);
  assert.equal(result.sources.feedbacks.data.length,1);
  assert.equal(result.sources.cadastro.data.length,1);
  assert.equal(result.sources.registros.data.length,1);assert.equal(result.sources.registros.data[0].SCORE,4.9);
  assert.equal(result.sources.ponto.data.length,1);assert.equal(result.sources.ponto.data[0].id,'analysis');
  assert.equal(result.sources.atividades.data.length,1);
  assert.equal(result.pdi.data.planos[0].versao,1);
  assert.equal(result.events.filter(e=>e.source==='Avaliação').length,1005);
  assert.equal(context.storageReads.length,1);
  for(const call of context.calls) {
    if(!['registros','historico'].includes(call.table)) assert.ok(call.filters.some(([key,value])=>key==='user_id'&&value==='owner'),call.table);
    if(call.table==='ponto_importacoes') assert.ok(call.filters.some(([key,value])=>key==='colaborador_id'&&value==='employee'));
  }
  context=setup({tables:{feedbacks:evaluations},fail:{feedbacks:500,ferias:true}});
  result=await context.reader.load(person,'owner');
  assert.equal(result.sources.feedbacks.status,'error');assert.equal(result.sources.feedbacks.data.length,0);
  assert.equal(result.sources.ferias.status,'error');assert.equal(result.sources.ausencias.status,'ok');
  context=setup({tables:{ponto_colaboradores:[{id:'a',user_id:'owner',nome:person},{id:'b',user_id:'owner',nome:person}]}});
  result=await context.reader.load(person,'owner');
  assert.equal(result.sources.jornadas.status,'ambiguous');assert.equal(result.sources.ponto.status,'ambiguous');
  assert.ok(!context.calls.some(c=>c.table==='ponto_importacoes'));
  context=setup({tables:{ponto_colaboradores:[{id:'variant',user_id:'owner',nome:'ANA MARIA'}]}});
  result=await context.reader.load(person,'owner');assert.equal(result.sources.jornadas.data.length,0);assert.equal(result.sources.ponto.status,'unlinked');
  for(const role of ['viewer','colaborador',undefined]) {
    const restricted=setup({role:role||''});await assert.rejects(()=>restricted.reader.load(person));assert.equal(restricted.calls.length,0);assert.equal(restricted.storageReads.length,0);
  }
  context=setup({changeOwner:true});await assert.rejects(()=>context.reader.load(person,'owner'));assert.equal(context.storageReads.length,0);
  context=setup();await assert.rejects(()=>context.reader.load(person,'other'));assert.equal(context.calls.length,0);
  assert.equal(readPdi({getItem:()=>'{broken'},'owner',person).status,'error');
  assert.equal(readPdi({getItem:()=>JSON.stringify({[person]:{planos:[null]}})},'owner',person).status,'error');
  console.log('Equipe 360º: paginação, leitura sem escrita, isolamento, identidade exata, ambiguidade, falha parcial, troca de conta e PDI por usuário verificados.');
})().catch(error=>{console.error(error);process.exitCode=1;});
