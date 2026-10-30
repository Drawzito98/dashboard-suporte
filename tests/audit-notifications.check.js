const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {create}=require('../static/data-runtime.js');
function setup(){
 const memory=new Map(),events=[],calls=[],tables={historico:new Map(),notificacoes:new Map()};let mode='ok',admin=true,quota=false,hold=null,release=null;
 const storage={getItem:k=>memory.get(k)||null,setItem(k,v){if(quota)throw Error('quota');memory.set(k,v)},removeItem:k=>memory.delete(k)};
 const session=create({storage});session.bind({id:'owner',app_metadata:{role:'admin'}});
 const user={id:'owner',email:'owner@test.invalid'};
 const context={console:{warn(){},error(){}},crypto:require('node:crypto').webcrypto,AppDataSession:session,AppState:session.state,appStorage:session.cache,FeatureLoader:{ensure:async()=>true},isAdmin:()=>admin,getCurrentUser:()=>user,showToast(){},document:{addEventListener(){},getElementById:()=>null},addEventListener:(event,fn)=>events.push([event,fn])};context.window=context;
 context.sbClient={auth:{getUser:async()=>({data:{user}})},from(table){
  let op='read',payload,filters=[],one=false,limit=Infinity;
  const q={select(){calls.push({table,select:true,op});return q},eq(k,v){filters.push(row=>row[k]===v);return q},in(k,ids){filters.push(row=>ids.includes(row[k]));return q},order(){return q},limit(n){limit=n;return q},maybeSingle(){one=true;return q},single(){one=true;return q},insert(row){op='insert';payload=row;return q},update(row){op='update';payload=row;return q},async then(resolve,reject){
   try{
    if(hold){const wait=hold;hold=null;await wait;}
    calls.push({table,op,payload});
    if(mode==='error')return resolve({data:null,error:Error('offline')});
    const rows=tables[table]||new Map();let data=[...rows.values()].filter(row=>filters.every(f=>f(row)));
    if(op==='insert'){if(rows.has(payload.id))return resolve({error:Error('duplicate')});data=[{created_at:'2026-10-30T12:00:00Z',lida:false,...payload}];rows.set(payload.id,data[0]);}
    if(op==='update'){if(mode==='partial')data=data.slice(0,1);data=data.map(row=>({...row,...payload}));data.forEach(row=>rows.set(row.id,row));}
    data=data.slice(0,limit);
    if(mode==='lost'&&op!=='read')return resolve({data:null,error:Error('response lost')});
    resolve({data:one?(data[0]||null):data});
   }catch(error){reject(error);}
  }};return q;
 }};
 vm.createContext(context);for(const name of ['db-extra.js','repositories/audit.js','notificacoes.js'])vm.runInContext(fs.readFileSync('static/'+name,'utf8'),context);
 return{context,session,tables,calls,memory,setMode:v=>mode=v,setAdmin:v=>admin=v,setQuota:v=>quota=v,block(){hold=new Promise(r=>release=r);return()=>release();}};
}
(async()=>{
 let h=setup(),c=h.context;const id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222';
 h.session.cache.setItem('sistema_historico_v1',JSON.stringify([{action:'legacy'}]));
 assert.equal((await c.dbHistoricoLoad()).length,0,'Legacy optimistic cache is not adopted');
 const entry={id,action:'edit',before:0,after:1,colaborador:'Pessoa'};
 h.setMode('lost');await assert.rejects(c.dbHistoricoAdd(entry));assert.equal(h.tables.historico.size,1);assert.equal(c.AppState.get('historico').length,0);assert.equal(JSON.parse(h.session.cache.getItem('sistema_historico_pendente_v1')).length,1);
 h.setMode('ok');await c.dbHistoricoAdd(entry);await c.dbHistoricoAdd(entry);assert.equal(h.calls.filter(x=>x.table==='historico'&&x.op==='insert'&&!x.select).length,1);assert.equal(c.AppState.get('historico').length,1);assert.equal(c.AppState.get('historico')[0].before,'0');assert.equal(JSON.parse(h.session.cache.getItem('sistema_historico_pendente_v1')).length,0);
 h.setMode('lost');await assert.rejects(c.dbHistoricoAdd({...entry,id:id2}));h.setMode('ok');await c.dbHistoricoLoad();assert.equal(JSON.parse(h.session.cache.getItem('sistema_historico_pendente_v1')).length,0,'Read reconciles received pending event');
 h.setQuota(true);const inserts=h.calls.filter(x=>x.op==='insert'&&!x.select).length;await assert.rejects(c.dbHistoricoAdd({...entry,id:'33333333-3333-4333-8333-333333333333'}));assert.equal(h.calls.filter(x=>x.op==='insert'&&!x.select).length,inserts);h.setQuota(false);
 h.setMode('error');await c.dbHistoricoLoad();assert.equal(c.AppState.get('historico').length,2);assert.equal(c.AppState.get('historicoStatus'),'error');h.setMode('ok');h.tables.historico.clear();assert.equal((await c.dbHistoricoLoad()).length,0);
 for(const key of [id,id2])h.tables.notificacoes.set(key,{id:key,lida:false});await c.dbNotificacoesLoad();assert.equal(c.getNotificacoesNaoLidas().length,2);
 h.setMode('error');await assert.rejects(c.marcarNotificacaoLida(id));assert.equal(c.getNotificacoesNaoLidas().length,2);await c.dbNotificacoesLoad();assert.equal(c.getNotificacoesNaoLidas().length,2,'Failed read preserves snapshot');
 h.setMode('lost');await assert.rejects(c.marcarNotificacaoLida(id));assert.equal(c.getNotificacoesNaoLidas().length,2,'Lost update response is not published');h.setMode('ok');await c.dbNotificacoesLoad();assert.equal(c.getNotificacoesNaoLidas().length,1,'Read reconciles server status');h.tables.notificacoes.get(id).lida=false;await c.dbNotificacoesLoad();
 h.setMode('partial');await assert.rejects(c.marcarTodasNotificacoesLidas());assert.equal(c.getNotificacoesNaoLidas().length,1,'Only returned IDs are marked');
 h.setMode('ok');await c.marcarTodasNotificacoesLidas();assert.equal(c.getNotificacoesNaoLidas().length,0);h.tables.notificacoes.clear();assert.equal((await c.dbNotificacoesLoad()).length,0);
 await assert.rejects(c.marcarNotificacaoLida('invalid'));
 h.setAdmin(false);const before=h.calls.length;await c.criarNotificacao('feedback','Texto','avaliacao');assert.equal(h.calls.slice(before).filter(x=>x.select).length,0,'Author INSERT must not require SELECT');assert.equal(h.tables.notificacoes.size,1);await assert.rejects(c.marcarNotificacaoLida(id));
 h=setup();c=h.context;h.tables.notificacoes.set(id,{id,lida:false});await c.dbNotificacoesLoad();const release=h.block();const pending=c.marcarNotificacaoLida(id);await new Promise(r=>setImmediate(r));h.session.invalidate();release();await assert.rejects(pending,/Sessão/);assert.equal(c.getNotificacoesNaoLidas().length,0);assert.equal(c.AppState.get('historico'),null);
 h=setup();c=h.context;const releaseRead=h.block(),read=c.dbHistoricoLoad();await new Promise(r=>setImmediate(r));h.session.invalidate();releaseRead();await read;assert.equal(c.AppState.get('historico'),null);
 console.log('Audit: confirmação, resposta perdida sem duplicação, quota, zero, vazio, falha, leitura parcial por ID, RLS do autor e sessão invalida respostas atrasadas.');
})().catch(error=>{console.error(error);process.exitCode=1});
