const assert=require('node:assert/strict');
const {create:runtime}=require('../static/data-runtime.js');
const {create}=require('../static/records-repository.js');
function setup(memory=new Map()) {
 let owner='a',rows=[{id:1,Atendente:'Pessoa',Score:4.9,Finalizados:10}],fail=false,authFail=false,denyDelete=false,held=null;
 const writes=[];const session=runtime({storage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}});
 const client={auth:{getUser:async()=>authFail?{error:Error('auth offline')}:{data:{user:{id:owner,app_metadata:{role:'admin'}}}}},from(){let operation='read',payload,id;const q={
 select(){return q},order(){return q},range:async()=>fail?{error:Error('offline')}:{data:rows.map(r=>({...r}))},
 update(value){operation='update';payload=value;return q},insert(value){operation='insert';payload=value;return q},delete(){operation='delete';return q},eq(k,v){if(k==='id')id=v;return q},neq(){return q},
 async then(resolve,reject){try{writes.push({operation,payload,id});if(held){const wait=held;held=null;await wait}
 if(fail||operation==='delete'&&denyDelete)return resolve({error:Error('offline')});
 if(operation==='update'){rows=rows.map(r=>r.id===id?{...r,...payload}:r);return resolve({data:rows.filter(r=>r.id===id).map(r=>({id:r.id}))})}
 if(operation==='insert'){const saved=payload.map((r,i)=>({...r,id:100+i}));rows.push(...saved);return resolve({data:saved})}
 if(operation==='delete'){const deleted=id==null?rows:rows.filter(r=>r.id===id);rows=id==null?[]:rows.filter(r=>r.id!==id);return resolve({data:deleted.map(r=>({id:r.id}))})}
 resolve({data:[]});}catch(e){reject(e)}}};return q;}};
 return {repo:create({client,session}),session,memory,writes,setRows:v=>rows=v,setFail:v=>fail=v,setAuthFail:v=>authFail=v,setOwner:v=>owner=v,setDeleteFailure:v=>denyDelete=v,hold:p=>held=p};
}
(async()=>{
 let x=setup();await x.repo.load();assert.equal(x.repo.snapshot().source,'server');assert.equal(x.repo.view()[0].SCORE,4.9);
 x.setRows([]);await x.repo.load();assert.equal(x.repo.view().length,0);x.setFail(true);await x.repo.load();assert.equal(x.repo.view().length,0);assert.equal(x.repo.snapshot().status,'offline');
 x=setup();await x.repo.load();x.setFail(true);assert.equal(await x.repo.update(1,{Finalizados:20}),false);assert.equal(await x.repo.update(1,{SCORE:4.7}),false);
 assert.equal(x.repo.pending().length,1);assert.equal(x.repo.pending()[0].Finalizados,20);assert.equal(x.repo.view()[0].SCORE,4.7);
 x.setAuthFail(true);assert.equal(await x.repo.update(1,{Observações:'Edição sem autenticação de rede'}),false);assert.equal(x.repo.pending()[0]['Observações'],'Edição sem autenticação de rede');x.setAuthFail(false);
 const second=setup(x.memory);second.setOwner('b');second.setFail(true);await second.repo.load();assert.equal(second.repo.pending().length,0);assert.equal(second.repo.view().length,0);
 x.setFail(false);await x.repo.retry();assert.equal(x.repo.pending().length,0);assert.equal(x.repo.view()[0].Finalizados,20);
 let release;const gate=new Promise(r=>release=r);x.hold(gate);const first=x.repo.update(1,{Finalizados:30});await new Promise(r=>setTimeout(r,0));const newer=x.repo.update(1,{Finalizados:40});await new Promise(r=>setTimeout(r,0));release();await Promise.all([first,newer]);assert.equal(x.repo.view()[0].Finalizados,40);assert.equal(x.repo.pending().length,0);
 const staged=x.repo.enqueue({id:1,Finalizados:50});x.repo.enqueue({id:1,SCORE:4.8});assert.equal(x.repo.pending().length,1);
 x.setDeleteFailure(true);assert.equal(await x.repo.remove(1),false);assert.ok(x.repo.view().length);x.setDeleteFailure(false);
 const pendingBefore=x.repo.pending().length;x.setOwner('other');assert.equal(await x.repo.update(1,{Finalizados:999}).catch(()=>false),false);assert.equal(x.repo.pending().length,pendingBefore);
 x.session.invalidate();assert.equal(x.repo.view().length,0);
 assert.equal(x.session.state.get('records'),null);
 x=setup();await x.repo.load();let done;const pause=new Promise(r=>done=r);x.hold(pause);const saving=x.repo.update(1,{Finalizados:90});await new Promise(r=>setTimeout(r,0));x.session.invalidate();done();assert.equal(await saving,false);assert.equal(x.session.state.get('records'),null);
 console.log('Repository: vazio autoritativo, cache offline, isolamento, edição durável, retry, concorrência por revisão, falha de exclusão e sessão encerrada verificados.');
})().catch(e=>{console.error(e);process.exitCode=1});
