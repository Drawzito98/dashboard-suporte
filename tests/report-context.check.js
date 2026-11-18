const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const texts = [], rows = [
  { Atendente: 'Pessoa privada', Setor: 'Financeiro', 'Mês':'2026-01' },
  { Atendente: 'Pessoa privada', Setor: 'Financeiro', 'Mês':'2026-09' },
  ...Array.from({length:7}, (_,i) => ({ Atendente:'Outra', Setor:'Financeiro', 'Mês':`2026-0${i+2}` }))
];
let proxy;
proxy = new Proxy({}, { get: (_, key) => key==='splitTextToSize' ? text=>[text] : key==='text' ? text=>{texts.push(text);return proxy} : ()=>proxy });
const c = { console, rawRecords:rows, isSetorActive:()=>true,
  globalFilters:{setor:'Financeiro',nivel:'N1',colaborador:'Pessoa privada',pesquisa:'privada',aplicar:data=>data.filter(r=>r.Atendente==='Pessoa privada')},
  getCurrentFilteredRows:()=>{throw Error('Filtros legados ocultos não devem ser consultados')},
  getActiveMonths:()=>['2026-02'],document:{documentElement:{getAttribute:()=>null}},
  jspdf:{jsPDF:function(){return proxy}}
}; c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('static/relatorio-setorial.js','utf8'),c);
assert.deepEqual(Array.from(c.getFilteredMeses(c._rsData())),['2026-01','2026-09'],'meses vêm apenas das linhas do recorte');
assert.equal(c.getFilteredMeses(rows).length,9,'Todos não impõe limite silencioso de seis meses');
assert.ok(!c._rsContextLabel({privateNames:false}).includes('Pessoa privada'));
c.exportSetorPdf([{nome:'Financeiro',fin:20,ass:25,tra:2,scAvg:4.8,prod:0.8,taxaT:0.08}],['2026-01','2026-09'],{contextLabel:c._rsContextLabel({privateNames:false})});
const output=JSON.stringify(texts);assert.ok(output.includes('2026-01, 2026-09'),'PDF explicita meses não contíguos');assert.ok(output.includes('Setor: Financeiro'),'PDF declara recorte');assert.ok(!output.includes('Pessoa privada'),'PDF da equipe não identifica colaborador');
console.log('Relatório: fonte global única, filtros antigos ignorados, Todos sem truncar meses, meses não contíguos e contexto do PDF sem nomes individuais.');
