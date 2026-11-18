const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {create}=require('../static/data-runtime.js');
(async()=>{
 let user={id:'a',app_metadata:{role:'admin'}},reloaded=0,invalidated=0;const listeners=[];const memory=new Map();
 const session=create({storage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}});
 const context={console,setTimeout,CustomEvent:class{constructor(type){this.type=type}},AppDataSession:session,
 sbClient:{auth:{getSession:async()=>({data:{session:{user}}}),refreshSession:async()=>({data:{session:{user}}}),onAuthStateChange:cb=>listeners.push(cb)}},
 document:{getElementById:()=>null,addEventListener(){}},window:{dispatchEvent:e=>{if(e.type==='app-session-invalidated')invalidated++},location:{reload:()=>reloaded++}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../static/auth.js'),'utf8'),context);
 await context.initAuth();assert.equal(session.owner(),'a');assert.equal(listeners.length,1);
 listeners[0]('TOKEN_REFRESHED',{user});await new Promise(r=>setTimeout(r,5));assert.equal(reloaded,0);assert.equal(context.getCurrentUser().id,'a');
 user={id:'b',app_metadata:{role:'admin'}};listeners[0]('SIGNED_IN',{user});await new Promise(r=>setTimeout(r,5));assert.equal(session.owner(),null);assert.equal(invalidated,1);assert.equal(reloaded,1);assert.equal(context.getCurrentUser().id,'b');
 listeners[0]('SIGNED_IN',{user});await new Promise(r=>setTimeout(r,5));assert.equal(reloaded,1);
 assert.throws(()=>session.cache.setItem('private','late-write'));
 console.log('Auth: sessão existente observada, renovação sem reset, troca de conta invalida dados antes de recarregar e bloqueia escrita atrasada.');
})().catch(e=>{console.error(e);process.exitCode=1});
