const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
(async()=>{
 const root={};vm.createContext(root);vm.runInContext(fs.readFileSync('static/export-tools.js','utf8'),root);
 let calls=[],errors=[],fail=true,valid=true,release;
 const tool=root.ExportDependencies.create({session:{token:()=>({owner:'one'}),current:()=>valid},notify:(text,type)=>{if(type==='error')errors.push(text);},loadScript:async url=>{
  calls.push(url);if(fail)throw Error('offline');await new Promise(r=>{release=r;});
  if(url.includes('html2canvas'))root.html2canvas=()=>{};
  if(url.includes('jspdf'))root.jspdf={jsPDF:()=>{}};
 }});
 assert.equal(calls.length,0,'No eager library request');assert.equal(await tool.ready('image'),false);assert.equal(calls.length,1);assert.equal(errors.length,1);
 fail=false;const a=tool.ready('image'),b=tool.ready('image');await new Promise(r=>setImmediate(r));assert.equal(calls.length,2,'Concurrent requests share retry');release();assert.equal(await a,true);assert.equal(await b,true);assert.equal(await tool.ready('image'),true);assert.equal(calls.length,2,'Already present export does not load again');
 const stale=tool.ready('pdf');await new Promise(r=>setImmediate(r));valid=false;release();assert.equal(await stale,false,'Session change cancels action after download');assert.equal(errors.length,1,'Old account does not receive an error toast');
 valid=true;assert.equal(await tool.ready('__proto__'),false,'Only fixed dependency names allowed');assert.equal(calls.length,3);
 const incomplete=root.ExportDependencies.create({loadScript:async()=>{}});assert.equal(await incomplete.ready('excel'),false,'Successful HTTP without export is failure');
 const html=fs.readFileSync('index.html','utf8'),scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)/g)].map(x=>x[1]);
 assert.equal(scripts.filter(x=>/html2canvas|jspdf|xlsx/.test(x)).length,0,'Heavy export dependencies absent from initial HTML');assert.ok(scripts.length<=86,'Initial script budget');assert.ok(scripts.filter(x=>x.startsWith('http')).length<=4,'Remote startup budget');
 console.log('Exportação: nenhuma carga antecipada, concorrência compartilhada, falha/retry, global ausente, sessão e orçamento de scripts iniciais.');
})().catch(error=>{console.error(error);process.exitCode=1});
