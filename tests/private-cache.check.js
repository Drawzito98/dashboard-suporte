const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {create}=require('../static/data-runtime.js');
(async()=>{
 const memory=new Map();const raw={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const session=create({storage:raw});session.bind({id:'owner',app_metadata:{role:'admin'}});
 let offline=false,writes=0;
 const client={auth:{getUser:async()=>({data:{user:{id:'owner',app_metadata:{role:'admin'}}}})},from(){const q={select(){return q},eq(){return q},order(){return q},limit(){return q},maybeSingle(){return q},not(){return q},insert(){writes++;throw Error('Read must not insert')},then(resolve){return Promise.resolve(offline?{error:Error('offline')}:{data:[]}).then(resolve)}};return q}};
 const context={console,sbClient:client,AppDataSession:session,appStorage:session.cache,window:{addEventListener(){}},document:{addEventListener(){},getElementById:()=>null,body:{dataset:{role:'admin'}}},requireAdmin:()=>true};
 vm.createContext(context);
 context.AppRepositories={};context.window.AppRepositories=context.AppRepositories;context.FeatureLoader={ensure:async()=>true};
 for(const file of ['db-extra.js',...['performance','people','development','routine','attendance','audit'].map(name=>'repositories/'+name+'.js'),'avaliacao.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../static',file),'utf8'),context);
 const cases=[['dbFeedbacksLoad','sistema_feedbacks_v1',[]],['dbFeriasLoad','sistema_ferias_v1',[]],['dbAusenciasLoad','sistema_ausencias_v1',[]],['dbAvaliacoesLoad','sistema_avaliacoes_v1',[]],['dbColabInfoLoad','sistema_colaboradores_info_v1',{}]];
 for(const [load,key,empty] of cases){session.cache.setItem(key,JSON.stringify(Array.isArray(empty)?[{id:'stale'}]:{old:{id:'stale'}}));raw.setItem(key,'unowned-legacy');const result=await context[load]();assert.equal(JSON.stringify(result),JSON.stringify(empty),load);assert.equal(raw.getItem(key),'unowned-legacy');}
 offline=true;session.cache.setItem('sistema_feedbacks_v1',JSON.stringify([{id:'owned-offline'}]));assert.equal((await context.dbFeedbacksLoad())[0].id,'owned-offline');
 offline=false;await context.initDbExtra();assert.equal(writes,0);
 console.log('Cache privado: vazios confirmados removem projeções antigas, fallback fica na própria conta e inicialização não migra dados sem identificação.');
})().catch(e=>{console.error(e);process.exitCode=1});
