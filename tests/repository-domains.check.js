const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {create:runtime}=require('../static/data-runtime.js');const {create:loader}=require('../static/module-loader.js');
(async()=>{
 const memory=new Map(),calls=[],loaded=[];
 const session=runtime({storage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}});session.bind({id:'owner',app_metadata:{role:'admin'}});
 const context={crypto:require('node:crypto').webcrypto,console,Event:class { constructor(type){this.type=type} },dispatchEvent(){},AppDataSession:session,appStorage:session.cache,AppRepositories:{},document:{addEventListener(){},getElementById:()=>null},addEventListener(){},requireAdmin:()=>true};context.window=context;
 context.sbClient={auth:{getUser:async()=>({data:{user:{id:'owner',app_metadata:{role:'admin'}}}})},from(table){let mode='read',single=false,payloadRow;return {
 select(){return this},eq(){return this},order(){return this},limit(){return this},not(){return this},maybeSingle(){single=true;return this},single(){single=true;return this},
 upsert(payload){mode='write';payloadRow=payload;calls.push({table,payload});return this},
 insert(payload){mode='write';calls.push({table,payload});return this},update(payload){mode='write';calls.push({table,payload});return this},
 then(resolve,reject){return Promise.resolve({data:mode==='write'?(payloadRow?{...payloadRow}:{id:'saved'}):single?null:[]}).then(resolve,reject)}
 }}};
 vm.createContext(context);
 const read=file=>fs.readFileSync(path.join(__dirname,'../static',file),'utf8');
 vm.runInContext(read('module-manifest.js'),context);
 context.FeatureLoader=loader(context.APP_MODULES,{loadScript:async url=>{loaded.push(url);vm.runInContext(read(url.slice('/static/'.length).split('?')[0]),context)},resolveExport:s=>s.split('.').reduce((v,k)=>v?.[k],context)});
 vm.runInContext(read('db-extra.js'),context);vm.runInContext(read('avaliacao.js'),context);
 await context.initDbExtra();assert.equal(calls.length,0);assert.equal(loaded.length,6);assert.ok(!loaded.some(x=>x.includes('legacy')));
 await context.dbFeedbacksSave({id:'fb',colaborador:'Pessoa',mes:'2026-10',feedback_final:'Texto original'});
 const fb=calls.find(c=>c.table==='feedbacks');assert.equal(fb.payload.user_id,'owner');assert.equal(fb.payload.colaborador,'Pessoa');assert.equal(fb.payload.feedback_final,'Texto original');
 const saved=await context.dbColabInfoSave('Pessoa',{nivel:'N1',salario:1000});assert.equal(saved,true);const info=calls.find(c=>c.table==='colaboradores_info');assert.equal(info.payload.nome,'Pessoa');assert.equal(info.payload.user_id,'owner');
 await context.dbFeriasSave({id:1,colaborador:'Pessoa',data_inicio:'2026-11-01',data_fim:'2026-11-10'});const leave=calls.find(c=>c.table==='ferias');assert.equal(leave.payload.data_inicio,'2026-11-01');assert.equal(leave.payload.user_id,'owner');
 assert.equal(loaded.length,6);
 let release;context.FeatureLoader={ensure:()=>new Promise(resolve=>{release=resolve})};
 const count=calls.length,pending=context.dbFeedbacksSave({colaborador:'Conta anterior'});session.invalidate();release();
 await assert.rejects(pending,/Sessão alterada/);assert.equal(calls.length,count);
 console.log('Domínios: seis repositories carregados uma vez, init somente leitura e contratos de feedback, cadastro e férias preservados.');
})().catch(e=>{console.error(e);process.exitCode=1});
