const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'../static',file),'utf8');
const rows=[{Atendente:'Ana',Setor:'Suporte','Mês':'2026-09',Assumidos:100,Finalizados:80,Transferidos:20,SCORE:4.8},{Atendente:'Ana',Setor:'Suporte','Mês':'2026-10',Assumidos:50,Finalizados:45,Transferidos:5,SCORE:4.6},{Atendente:'Bia',Setor:'Financeiro','Mês':'2026-10',Assumidos:100,Finalizados:100,Transferidos:0,SCORE:5}];
let captured,empty=false,destroyed=0;
const canvas={style:{},getContext:()=>({})};
const context={console,document:{getElementById:()=>null},ctx:canvas,chart:null,hiddenLabels:new Set(),atendenteSelect:{value:'all'},searchAtendenteInput:{value:''},setorSelect:{value:'all'},arquivoSelect:{value:'all'},presentationMode:false,
 Chart:function(ctx,cfg){captured=cfg;this.data=cfg.data;this.destroy=()=>destroyed++},isChartAvailable:()=>true,isAggregateName:()=>false,setChartEmpty:value=>empty=value,getSelectedAtendentes:()=>[],buildAliasMap:()=>({}),getDisplayName:n=>n,getFirstName:n=>n,uniqueSorted:a=>[...new Set(a)].sort(),formatMesLabel:m=>m,
 getActiveMonths:()=>['2026-09','2026-10'],getMonthScopeLabel:()=> 'Setembro e Outubro 2026',getCurrentFilteredRows:()=>rows};context.window=context;
vm.createContext(context);
const app=read('app.js');vm.runInContext(app.slice(app.indexOf('function avgScoreBySetor('),app.indexOf('function renderSummary(')),context);
vm.runInContext(read('dashboard-charts.js'),context);vm.runInContext(read('dashboard-report.js'),context);
const json=v=>JSON.parse(JSON.stringify(v));
context.DashboardCharts.render(rows);assert.deepEqual(json(captured.data.labels),['Ana','Bia']);assert.deepEqual(json(captured.data.datasets[0].data),[150,100]);assert.deepEqual(json(captured.data.datasets[1].data),[125,100]);assert.deepEqual(json(captured.data.datasets[2].data),[4.7,5]);
context.hiddenLabels.add('Ana');context.DashboardCharts.render(rows);assert.deepEqual(json(captured.data.labels),['Bia']);assert.equal(destroyed,1);context.hiddenLabels.clear();
context.atendenteSelect.value='Ana';context.DashboardCharts.render(rows.filter(r=>r.Atendente==='Ana'));assert.deepEqual(json(captured.data.datasets[1].data),[80,45]);assert.equal(destroyed,2);
context.DashboardCharts.render([]);assert.equal(empty,true);
const report=context.DashboardReport.build();assert.match(report,/225/);assert.match(report,/250/);assert.match(report,/4\.85/);assert.match(report,/90\.0%/);assert.ok(report.includes('Ana')&&report.includes('Bia'));assert.ok(report.indexOf('Ana liderou')>0);
context.getCurrentFilteredRows=()=>[];assert.equal(context.DashboardReport.build(),'Sem dados no escopo atual.');
console.log('Dashboard extraído: totais, Score por setor, ranking, evolução mensal, ocultação, ciclo do gráfico, escopo vazio e relatório preservados.');
