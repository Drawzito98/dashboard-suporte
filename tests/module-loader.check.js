const assert=require('node:assert/strict');
const {create}=require('../static/module-loader.js');
(async()=>{
 const events=[];let fail=true;
 const manifest={base:{scripts:['/static/engine.js?v=1']},feature:{depends:['base'],styles:['/static/view.css?v=1'],scripts:['/static/view.js?v=1'],exports:['ready']},other:{depends:['base'],scripts:['/static/other.js?v=1']}};
 const loader=create(manifest,{loadStyle:async url=>events.push(url),loadScript:async url=>{events.push(url);if(url.includes('/view.js')&&fail)throw Error('offline')},resolveExport:()=>true});
 const failures=await Promise.allSettled([loader.ensure('feature'),loader.ensure('feature')]);assert.ok(failures.every(r=>r.status==='rejected'));
 assert.equal(events.filter(e=>e.includes('/engine.js')).length,1);assert.equal(events.filter(e=>e.includes('/view.js')).length,1);
 fail=false;await Promise.all([loader.ensure('feature'),loader.ensure('feature'),loader.ensure('other')]);
 assert.equal(events.filter(e=>e.includes('/engine.js')).length,1);assert.equal(events.filter(e=>e.includes('/view.js')).length,2);assert.equal(events.filter(e=>e.includes('/view.css')).length,1);
 assert.ok(events.indexOf('/static/engine.js?v=1')<events.indexOf('/static/view.js?v=1'));
 await assert.rejects(()=>loader.ensure('unknown'));
 const cycle=create({a:{depends:['b']},b:{depends:['a']}},{loadScript:async()=>{}});await assert.rejects(()=>cycle.ensure('a'),/circular/);
 const external=create({a:{scripts:['https://elsewhere.invalid/static/a.js?v=1']}},{loadScript:async()=>{throw Error('Transport must not run')}});await assert.rejects(()=>external.ensure('a'),/permitido/);
 const incomplete=create({a:{scripts:['/static/a.js?v=1'],exports:['missing']}},{loadScript:async()=>{},resolveExport:()=>false});await assert.rejects(()=>incomplete.ensure('a'),/incompleto/);
 console.log('Módulos: ordem, dependência compartilhada, concorrência, falha/retentativa, ciclos, origem e export ausente verificados.');
})().catch(e=>{console.error(e);process.exitCode=1});
