// Leitura gerencial dos indicadores — saúde, limites e distância da meta.
(function(){
  'use strict';
  const esc=v=>typeof escapeHtmlShared==='function'?escapeHtmlShared(String(v??'')):escapeHtml(String(v??''));
  const n=v=>Number.isFinite(Number(v))?Number(v):0;
  const pct=v=>`${n(v).toFixed(1).replace('.',',')}%`;
  const month=v=>typeof formatMesLabel==='function'?formatMesLabel(v):v;
  const valid=r=>r&&r.Atendente&&!(typeof isAggregateName==='function'&&isAggregateName(r.Atendente));
  function sourceRows(){try{return typeof rawRecords!=='undefined'&&Array.isArray(rawRecords)?rawRecords:[];}catch(_){return[];}}
  function activeFilters(){try{return typeof globalFilters!=='undefined'&&globalFilters?globalFilters:{};}catch(_){return{};}}
  function rows(){return((typeof getDataFiltered==='function'?getDataFiltered():_gfData())||[]).filter(valid);}
  function context(){const g=activeFilters(),q=String(g.pesquisa||'').toLowerCase();return sourceRows().filter(valid).filter(r=>(!g.setor||g.setor==='all'||String(r.Setor)===String(g.setor))&&(!g.colaborador||g.colaborador==='all'||String(r.Atendente)===String(g.colaborador))&&(!q||Object.values(r).some(v=>String(v??'').toLowerCase().includes(q))));}
  function avgTime(rs,key){if(typeof parseDurationToSeconds!=='function')return null;const a=rs.map(r=>parseDurationToSeconds(r[key])).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}
  function fmtTime(v){if(!Number.isFinite(v))return'—';const d=Math.floor(v/86400),h=Math.floor(v%86400/3600),m=Math.floor(v%3600/60);return[d?`${d}d`:'',h?`${h}h`:'',`${m}min`].filter(Boolean).join(' ');}
  function calc(rs){const ass=rs.reduce((s,r)=>s+n(r.Assumidos),0),fin=rs.reduce((s,r)=>s+n(r.Finalizados),0),tra=rs.reduce((s,r)=>s+n(r.Transferidos),0),scores=rs.map(r=>Number(r.SCORE)).filter(Number.isFinite),people=new Set(rs.map(r=>r.Atendente)).size;return{ass,fin,tra,people,per:people?fin/people:0,prod:ass?fin/ass*100:0,score:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0,tx:ass?tra/ass*100:0,tma:avgTime(rs,'TMA'),tmr:avgTime(rs,'TMR')};}
  const find=id=>(typeof alertasConfig!=='undefined'?alertasConfig:[]).find(x=>x.id===id);
  function status(value,critical,warning,inverse=false){if(!Number.isFinite(value)||!Number.isFinite(critical))return{key:'neutral',label:'Sem referência'};if(inverse){if(value>critical)return{key:'critical',label:'Ruim'};if(value>warning)return{key:'warning',label:'Razoável'};}else{if(value<critical)return{key:'critical',label:'Ruim'};if(value<warning)return{key:'warning',label:'Razoável'};}return{key:'healthy',label:'Saudável'};}
  function card(def){const gap=def.inverse?def.value-def.healthy:def.healthy-def.value;const distance=def.state.key==='healthy'?'Dentro da faixa saudável':`${Math.abs(gap).toFixed(def.decimals??1).replace('.',',')}${def.gapUnit||''} para a faixa saudável`;const change=def.change===null?'Sem período anterior':`${def.change>=0?'↑':'↓'} ${Math.abs(def.change).toFixed(1).replace('.',',')}${def.changeUnit||'%'}`;return`<article class="ih-card ih-${def.state.key}"><header><span>${esc(def.label)}</span><b>${def.state.label}</b></header><strong>${esc(def.formatted)}</strong><div class="ih-reading"><span class="${def.changeGood?'ih-positive':def.change===null?'':'ih-negative'}">${change}</span><small>vs. período anterior</small></div><div class="ih-target"><b>Faixa saudável</b><span>${esc(def.target)}</span><small>${esc(distance)}</small></div><details><summary>O que representa?</summary><p>${esc(def.description)}</p><small>${esc(def.formula)} • ${def.inverse?'Menor é melhor':'Maior é melhor'}</small></details></article>`;}
  function sectorAssessment(now, before, limits) {
    const rank={critical:3,warning:2,healthy:1,neutral:0};
    const change=before&&before.per?(now.per-before.per)/Math.abs(before.per)*100:null;
    const states=[
      {label:'Qualidade',state:now.score<limits.scoreBad?{key:'critical',label:'Ruim'}:now.score<limits.scoreGood?{key:'warning',label:'Razoável'}:{key:'healthy',label:'Saudável'}},
      {label:'Taxa de conclusão',state:status(now.prod,limits.prodBad,limits.prodGood)},
      {label:'Taxa de transferência',state:status(now.tx,limits.txBad,limits.txGood,true)},
      {label:'Finalizados por pessoa',state:change===null?{key:'neutral',label:'Sem comparação'}:change<=-limits.dropBad?{key:'critical',label:'Ruim'}:change<-limits.dropGood?{key:'warning',label:'Razoável'}:{key:'healthy',label:'Saudável'}}
    ];
    const ordered=states.slice().sort((a,b)=>rank[b.state.key]-rank[a.state.key]);
    const firstUseful=ordered.find(x=>x.state.key!=='neutral');
    const overall=firstUseful?firstUseful.state:{key:'neutral',label:'Sem referência'};
    const issue=states.find(x=>x.state.key==='critical')||states.find(x=>x.state.key==='warning');
    return {overall,issue:issue?issue.label:'Nenhum',change};
  }
  function buildSectorHistory(limits) {
    const records=context(),months=[...new Set(records.map(r=>String(r['Mês'])).filter(Boolean))].sort(),result=[];
    months.forEach((period,index)=>{
      const periodRows=records.filter(r=>String(r['Mês'])===period),previousRows=index?records.filter(r=>String(r['Mês'])===months[index-1]):[];
      const sectors=[...new Set(periodRows.map(r=>String(r.Setor||'').trim()).filter(Boolean))].filter(s=>typeof isSetorActive!=='function'||isSetorActive(s)).sort((a,b)=>a.localeCompare(b,'pt-BR'));
      sectors.forEach(sector=>{const now=calc(periodRows.filter(r=>String(r.Setor||'').trim()===sector)),beforeSource=previousRows.filter(r=>String(r.Setor||'').trim()===sector),before=beforeSource.length?calc(beforeSource):null,assessment=sectorAssessment(now,before,limits);result.push({period,sector,status:assessment.overall.label,finPerPerson:now.per,productivity:now.prod,score:now.score,transferRate:now.tx,tma:now.tma,tmr:now.tmr,change:assessment.change,issue:assessment.issue});});
    });
    return result;
  }
  function exportSectorCsv(history) {
    const quote=v=>`"${String(v??'').replace(/"/g,'""')}"`,header=['Período','Setor','Saúde','Finalizados por pessoa','Taxa de conclusão','Qualidade média','Taxa de transferência','TMA','TMR','Variação vs. anterior','Principal atenção'];
    const lines=[header,...history.map(r=>[month(r.period),r.sector,r.status,r.finPerPerson.toFixed(1).replace('.',','),pct(r.productivity),r.score?r.score.toFixed(2).replace('.',','):'',pct(r.transferRate),fmtTime(r.tma),fmtTime(r.tmr),r.change===null?'':`${r.change.toFixed(1).replace('.',',')}%`,r.issue])].map(row=>row.map(quote).join(';'));
    const blob=new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`historico-saude-setores-${new Date().toISOString().slice(0,10)}.csv`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  }
  function printSectorHistory(history) {
    const popup=window.open('','_blank');if(!popup){if(typeof showToast==='function')showToast('Permita pop-ups para gerar o relatório.','warn','Exportação');return;}
    const rows=history.map(r=>`<tr><td>${esc(month(r.period))}</td><td>${esc(r.sector)}</td><td><b>${esc(r.status)}</b></td><td>${r.finPerPerson.toFixed(1).replace('.',',')}</td><td>${pct(r.productivity)}</td><td>${r.score?r.score.toFixed(2):'—'}</td><td>${pct(r.transferRate)}</td><td>${fmtTime(r.tma)}</td><td>${fmtTime(r.tmr)}</td><td>${esc(r.issue)}</td></tr>`).join('');
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Histórico de saúde por setor</title><style>body{font:12px Arial;color:#18212f;margin:28px}h1{font-size:20px;margin:0 0 4px}p{color:#657084;margin:0 0 20px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border:1px solid #d8dee8;text-align:left}th{background:#eef2f7;font-size:10px}@page{size:landscape;margin:12mm}</style></head><body><h1>Histórico de saúde por setor</h1><p>Gerado em ${new Date().toLocaleString('pt-BR')} com as metas configuradas atualmente.</p><table><thead><tr><th>Período</th><th>Setor</th><th>Saúde</th><th>Finalizados/pessoa</th><th>Conclusão</th><th>Qualidade</th><th>Transferências</th><th>TMA</th><th>TMR</th><th>Principal atenção</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);popup.document.close();
  }
  function sectorOverview(currentRows, previousRows, limits) {
    const filter = activeFilters();
    if (filter.setor && filter.setor !== 'all') return '';
    const sectors = [...new Set(currentRows.map(r => String(r.Setor || '').trim()).filter(Boolean))]
      .filter(name => typeof isSetorActive !== 'function' || isSetorActive(name)).sort((a,b)=>a.localeCompare(b,'pt-BR'));
    if (!sectors.length) return '';
    const rank = { critical: 3, warning: 2, healthy: 1, neutral: 0 };
    const cards = sectors.map(name => {
      const now = calc(currentRows.filter(r => String(r.Setor || '').trim() === name));
      const beforeRows = previousRows.filter(r => String(r.Setor || '').trim() === name);
      const before = beforeRows.length ? calc(beforeRows) : null;
      const change = before && before.per ? (now.per - before.per) / Math.abs(before.per) * 100 : null;
      const states = [
        { label:'Qualidade', state:now.score<limits.scoreBad?{key:'critical',label:'Ruim'}:now.score<limits.scoreGood?{key:'warning',label:'Razoável'}:{key:'healthy',label:'Saudável'} },
        { label:'Conclusão', state:status(now.prod,limits.prodBad,limits.prodGood) },
        { label:'Transferências', state:status(now.tx,limits.txBad,limits.txGood,true) },
        { label:'Finalizados por pessoa', state:change===null?{key:'neutral',label:'Sem comparação'}:change<=-limits.dropBad?{key:'critical',label:'Ruim'}:change<-limits.dropGood?{key:'warning',label:'Razoável'}:{key:'healthy',label:'Saudável'} }
      ];
      const worst = states.slice().sort((a,b)=>rank[b.state.key]-rank[a.state.key])[0];
      const overall = worst.state.key==='neutral' && states.some(x=>x.state.key!=='neutral') ? states.find(x=>x.state.key!=='neutral').state : worst.state;
      const issue = states.find(x=>x.state.key==='critical') || states.find(x=>x.state.key==='warning');
      const changeText = change===null?'Sem período anterior':`${change>=0?'+':''}${change.toFixed(1).replace('.',',')}% vs. anterior`;
      return `<button class="ih-sector-card ih-${overall.key}" type="button" data-sector="${esc(name)}"><header><div><span>SETOR</span><strong>${esc(name)}</strong></div><b>${overall.label}</b></header><div class="ih-sector-metrics"><span><small>Qualidade</small><strong>${now.score?now.score.toFixed(2):'—'}</strong></span><span><small>Conclusão</small><strong>${pct(now.prod)}</strong></span><span><small>Transferências</small><strong>${pct(now.tx)}</strong></span><span><small>Finalizados/pessoa</small><strong>${now.per.toFixed(1).replace('.',',')}</strong></span></div><footer><span class="${change!==null&&change>=-limits.dropGood?'ih-positive':change===null?'':'ih-negative'}">${changeText}</span><small>${issue?`Atenção: ${issue.label}`:'Indicadores dentro das faixas'}</small></footer><em>Ver análise detalhada →</em></button>`;
    }).join('');
    return `<section class="ih-sectors"><div class="ih-section-heading"><div><strong>Saúde por setor</strong><span>${sectors.length} setor${sectors.length===1?'':'es'} no período atual</span></div><div class="ih-sector-actions"><small>Clique em um setor para filtrar</small><button class="btn-small" id="ihExportSectorCsv" type="button">Exportar CSV</button><button class="btn-small" id="ihPrintSectorHistory" type="button">Imprimir / PDF</button></div></div><div class="ih-sector-grid">${cards}</div></section>`;
  }
  function render(){const host=document.getElementById('insightsContent');if(!host)return;const selected=rows();if(!selected.length){host.innerHTML='<div class="empty-state"><div class="empty-title">Nenhum dado no recorte atual</div></div>';return;}const all=context(),months=[...new Set(selected.map(r=>String(r['Mês'])).filter(Boolean))].sort(),allMonths=[...new Set(all.map(r=>String(r['Mês'])).filter(Boolean))].sort(),current=months.at(-1),ix=allMonths.indexOf(current),previous=ix>0?allMonths[ix-1]:null,currentRows=selected.filter(r=>String(r['Mês'])===current),previousRows=previous?all.filter(r=>String(r['Mês'])===previous):[],cur=calc(currentRows),old=previousRows.length?calc(previousRows):null;
    const scoreRule=find('score_baixo'),prodRule=find('produtividade_baixa'),txRule=find('transferencia_alta'),scoreLimit=n(scoreRule?.valor||4.50),scoreTarget=n(scoreRule?.metaSaudavel||4.70),prodLimit=n(prodRule?.valor||.60)*100,prodTarget=n(prodRule?.metaSaudavel||.70)*100,txLimit=n(txRule?.valor||.30)*100,txTarget=n(txRule?.metaSaudavel||.25)*100,dropRule=find('queda_20'),dropLimit=n(dropRule?.valor||20),dropHealthy=n(dropRule?.metaSaudavel??5);
    const rel=(a,b)=>b?(a-b)/Math.abs(b)*100:null,df=old?rel(cur.per,old.per):null,dp=old?cur.prod-old.prod:null,ds=old?cur.score-old.score:null,dt=old?cur.tx-old.tx:null;
    const finState=df===null?{key:'neutral',label:'Sem referência'}:df<=-dropLimit?{key:'critical',label:'Ruim'}:df<-dropHealthy?{key:'warning',label:'Razoável'}:{key:'healthy',label:'Saudável'};
    const defs=[
      {label:'Finalizados por pessoa',value:cur.per,formatted:cur.per.toFixed(1).replace('.',','),state:finState,healthy:old?old.per*(1-dropHealthy/100):cur.per,inverse:false,target:old?`Queda máxima saudável de ${dropHealthy.toFixed(0)}%`:'Será definida após o próximo período',description:'Volume médio finalizado por cada pessoa no período.',formula:'Finalizados ÷ pessoas ativas',change:df,changeGood:df===null?null:df>=-dropHealthy,gapUnit:'',decimals:1},
      {label:'Taxa de conclusão',value:cur.prod,formatted:pct(cur.prod),state:status(cur.prod,prodLimit,prodTarget),healthy:prodTarget,inverse:false,target:`${pct(prodTarget)} ou mais`,description:'Quanto do volume assumido foi efetivamente finalizado.',formula:'Finalizados ÷ assumidos × 100',change:dp,changeGood:dp===null?null:dp>=0,changeUnit:' p.p.',gapUnit:' p.p.'},
      {label:'Qualidade média',value:cur.score,formatted:cur.score?cur.score.toFixed(2):'—',state:cur.score<scoreLimit?{key:'critical',label:'Ruim'}:cur.score<scoreTarget?{key:'warning',label:'Razoável'}:{key:'healthy',label:'Saudável'},healthy:scoreTarget,inverse:false,target:`Meta geral do suporte: ${scoreTarget.toFixed(2)}`,description:'Média das avaliações de qualidade no recorte selecionado.',formula:'Média dos valores de SCORE',change:ds,changeGood:ds===null?null:ds>=0,changeUnit:' ponto',gapUnit:' ponto',decimals:2},
      {label:'Taxa de transferência',value:cur.tx,formatted:pct(cur.tx),state:status(cur.tx,txLimit,txTarget,true),healthy:txTarget,inverse:true,target:`${pct(txTarget)} ou menos`,description:'Percentual dos atendimentos assumidos que precisaram ser transferidos.',formula:'Transferidos ÷ assumidos × 100',change:dt,changeGood:dt===null?null:dt<=0,changeUnit:' p.p.',gapUnit:' p.p.'}
    ];
    const timeRule=(field)=>{const custom=(typeof alertasConfig!=='undefined'?alertasConfig:[]).find(x=>x.custom&&x.campo===field&&x.operador==='>');return custom?n(custom.valor)*60:null;};
    [['tma','Tempo médio de atendimento (TMA)','Tempo médio necessário para concluir ou conduzir um atendimento.'],['tmr','Tempo médio de resposta (TMR)','Tempo médio até a primeira resposta ao atendimento.']].forEach(([key,label,description])=>{if(cur[key]===null)return;const limit=timeRule(key),change=old&&old[key]!==null?rel(cur[key],old[key]):null;defs.push({label,value:cur[key],formatted:fmtTime(cur[key]),state:limit?status(cur[key],limit,limit*.85,true):{key:'neutral',label:'Configure uma meta'},healthy:limit?limit*.85:cur[key],inverse:true,target:limit?`${fmtTime(limit*.85)} ou menos`:'Adicione um indicador personalizado',description,formula:'Média dos tempos registrados',change,changeGood:change===null?null:change<=0,gapUnit:'',decimals:0});});
    const counts={healthy:0,warning:0,critical:0,neutral:0};defs.forEach(d=>counts[d.state.key]++);const overall=counts.critical?'Ruim':counts.warning?'Razoável':counts.healthy?'Saudável':'Sem referências',overallKey=counts.critical?'critical':counts.warning?'warning':counts.healthy?'healthy':'neutral';
    const priority=defs.filter(d=>d.state.key==='critical'||d.state.key==='warning').sort((a,b)=>(a.state.key==='critical'?-1:1)-(b.state.key==='critical'?-1:1));
    const sectorLimits={scoreBad:scoreLimit,scoreGood:scoreTarget,prodBad:prodLimit,prodGood:prodTarget,txBad:txLimit,txGood:txTarget,dropBad:dropLimit,dropGood:dropHealthy},sectorHtml=sectorOverview(currentRows,previousRows,sectorLimits),sectorHistory=sectorHtml?buildSectorHistory(sectorLimits):[];
    host.innerHTML=`<section class="ih-summary ih-${overallKey}"><div><span>SAÚDE DA OPERAÇÃO</span><h3>${overall}</h3><p>${esc(month(current))}${previous?` comparado com ${esc(month(previous))}`:''}. A leitura acompanha os filtros ativos.</p></div><div class="ih-counts"><b><i class="ih-dot healthy"></i>${counts.healthy} saudáveis</b><b><i class="ih-dot warning"></i>${counts.warning} razoáveis</b><b><i class="ih-dot critical"></i>${counts.critical} ruins</b></div></section>${sectorHtml}<div class="ih-grid">${defs.map(card).join('')}</div><section class="ih-next"><header><div><strong>Leitura recomendada</strong><span>O que merece atenção primeiro</span></div></header>${priority.length?priority.map((d,i)=>`<article><b>${i+1}</b><div><strong>${esc(d.label)} — ${d.state.label}</strong><p>${esc(d.description)} Valor atual ${esc(d.formatted)}; referência saudável ${esc(d.target)}.</p></div></article>`).join(''):'<div class="ih-clear">✓ Todos os indicadores com referência estão em faixa saudável.</div>'}</section>`;
    host.querySelectorAll('.ih-sector-card').forEach(button=>button.addEventListener('click',()=>{const select=document.getElementById('gfSetor');if(!select)return;select.value=button.dataset.sector;document.getElementById('gfApplyBtn')?.click();document.getElementById('tab-insights')?.scrollIntoView({behavior:'smooth',block:'start'});}));
    document.getElementById('ihExportSectorCsv')?.addEventListener('click',()=>{if(!sectorHistory.length){if(typeof showToast==='function')showToast('Nenhum histórico setorial disponível.','warn','Exportação');return;}exportSectorCsv(sectorHistory);if(typeof showToast==='function')showToast('Histórico setorial exportado em CSV.','success','Exportação');});
    document.getElementById('ihPrintSectorHistory')?.addEventListener('click',()=>{if(!sectorHistory.length){if(typeof showToast==='function')showToast('Nenhum histórico setorial disponível.','warn','Exportação');return;}printSectorHistory(sectorHistory);});
  }
  window.renderInsights=render;window.onInsightsTabActivated=()=>{render();if(typeof window.renderAlertas==='function')window.renderAlertas();};
})();
