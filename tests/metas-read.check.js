const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
(async () => {
  let saves=0, loads=0;
  const context={console,appStorage:{getItem:()=>null,setItem(){throw Error('Leitura não exige nova gravação')}},document:{querySelector:()=>null},dbMetasLoad:async()=>{loads++;return []},dbMetasSave:()=>saves++};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../static/metas.js'),'utf8'),context);
  context.loadMetas();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(loads,1);assert.equal(saves,0);assert.equal(vm.runInContext('goals.length',context),0);
  context.dbMetasLoad=async()=>[{id:'real',title:'Meta confirmada',target:100}];context.loadMetas();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(vm.runInContext('goals[0].title',context),'Meta confirmada');assert.equal(saves,0);
  console.log('Metas: leitura vazia e preenchida atualizam a tela sem disparar escrita/DELETE no servidor.');
})().catch(error=>{console.error(error);process.exitCode=1});
