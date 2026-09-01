// Indicadores e Análises Avançadas v2 — somente leitura, sem alterar dados persistidos.
(function () {
  'use strict';
  const esc = v => typeof escapeHtmlShared === 'function' ? escapeHtmlShared(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = v => Number.isFinite(Number(v)) ? Number(v) : 0;
  const pct = v => `${n(v).toFixed(1).replace('.', ',')}%`;
  const month = v => typeof formatMesLabel === 'function' ? formatMesLabel(v) : v;
  const valid = r => r && r.Atendente && !(typeof isAggregateName === 'function' && isAggregateName(r.Atendente));
  function filtered() { return ((typeof getDataFiltered === 'function' ? getDataFiltered() : _gfData()) || []).filter(valid); }
  function context() {
    const gf = window.globalFilters || {}, q = String(gf.pesquisa || '').toLowerCase();
    return (Array.isArray(window.rawRecords) ? rawRecords : []).filter(valid).filter(r =>
      (!gf.setor || String(r.Setor) === String(gf.setor)) && (!gf.colaborador || String(r.Atendente) === String(gf.colaborador)) &&
      (!q || Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q))) &&
      (typeof isSetorActive !== 'function' || isSetorActive(r.Setor)) && (typeof isColabActive !== 'function' || isColabActive(r.Atendente)));
  }
  function avgTime(rows, key) {
    if (typeof parseDurationToSeconds !== 'function') return null;
    const a = rows.map(r => parseDurationToSeconds(r[key])).filter(v => Number.isFinite(v) && v >= 0);
    return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  }
  function fmtTime(v) {
    if (!Number.isFinite(v)) return '—';
    const d = Math.floor(v / 86400), h = Math.floor(v % 86400 / 3600), m = Math.floor(v % 3600 / 60);
    return [d ? `${d}d` : '', h ? `${h}h` : '', `${m}min`].filter(Boolean).join(' ');
  }
  function metrics(rows) {
    const ass = rows.reduce((s,r)=>s+n(r.Assumidos),0), fin = rows.reduce((s,r)=>s+n(r.Finalizados),0), tra = rows.reduce((s,r)=>s+n(r.Transferidos),0);
    const scores = rows.map(r=>Number(r.SCORE)).filter(Number.isFinite), people = new Set(rows.map(r=>r.Atendente)).size, periods = new Set(rows.map(r=>r['Mês'])).size || 1;
    return { ass,fin,tra,people,periods,score:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0,prod:ass?fin/ass*100:0,tx:ass?tra/ass*100:0,per:people?fin/people:0,perMonth:people?fin/people/periods:0,tma:avgTime(rows,'TMA'),tmr:avgTime(rows,'TMR') };
  }
  const rel = (a,b) => b ? (a-b)/Math.abs(b)*100 : null;
  function scope() { const g=window.globalFilters||{},p=[]; if(g.setor&&g.setor!=='all')p.push(`setor ${g.setor}`); if(g.nivel&&g.nivel!=='all')p.push(`nível ${g.nivel}`); if(g.colaborador&&g.colaborador!=='all')p.push(`colaborador ${g.colaborador}`); if(g.pesquisa)p.push(`busca “${g.pesquisa}”`); return p.length?p.join(' • '):'toda a operação'; }
  function kpi(label,value,change,inverse,note,unit=' p.p.') {
    const known=change!==null&&Number.isFinite(change), good=known&&(inverse?change<=0:change>=0), cls=!known?'aa-neutral':good?'aa-good':'aa-bad';
    return `<article class="aa-kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong><b class="${cls}">${known?`${change>0?'↑':change<0?'↓':'→'} ${Math.abs(change).toFixed(1).replace('.',',')}${unit}`:'Sem base anterior'}</b><small>${esc(note)}</small></article>`;
  }
  function renderV2() {
    const el=document.getElementById('insightsContent'); if(!el)return; const selected=filtered();
    if(!selected.length){el.innerHTML='<div class="empty-state"><div class="empty-title">Nenhum dado no recorte atual</div><div class="empty-sub">Ajuste os filtros para gerar a análise.</div></div>';return;}
    const all=context(), sm=[...new Set(selected.map(r=>String(r['Mês'])).filter(Boolean))].sort(), cm=[...new Set(all.map(r=>String(r['Mês'])).filter(Boolean))].sort();
    const current=sm.at(-1), ix=cm.indexOf(current), previous=ix>0?cm[ix-1]:null, cur=metrics(selected.filter(r=>String(r['Mês'])===current));
    const oldRows=previous?all.filter(r=>String(r['Mês'])===previous):[], old=oldRows.length?metrics(oldRows):null;
    const df=old?rel(cur.per,old.per):null, dp=old?cur.prod-old.prod:null, ds=old?cur.score-old.score:null, dt=old?cur.tx-old.tx:null;
    const dTma=old&&cur.tma!==null&&old.tma!==null?rel(cur.tma,old.tma):null, dTmr=old&&cur.tmr!==null&&old.tmr!==null?rel(cur.tmr,old.tmr):null;
    const issues=[], add=(level,title,evidence,action,target,days)=>issues.push({level,title,evidence,action,target,days});
    if(cur.score&&cur.score<4.25)add('critical','Qualidade abaixo da faixa de segurança',`Score médio em ${cur.score.toFixed(2)}.`,'Revisar as menores notas e realizar calibragem com a equipe.','Score ≥ 4,25',7);
    if(ds!==null&&ds<=-.2)add('high','Queda relevante de qualidade',`Score caiu ${Math.abs(ds).toFixed(2)} ponto frente a ${month(previous)}.`,'Identificar motivos recorrentes e atribuir ações corretivas.',`Recuperar ${Math.abs(ds).toFixed(2)} ponto`,14);
    if(dp!==null&&dp<=-5)add('high','Eficiência operacional em queda',`Produtividade caiu ${Math.abs(dp).toFixed(1)} p.p.`,'Analisar fila, capacidade e causas de não finalização.',`Produtividade ≥ ${old.prod.toFixed(1)}%`,14);
    if(cur.tx>30||(dt!==null&&dt>=5))add('attention','Transferências exigem investigação',`Taxa atual ${cur.tx.toFixed(1)}%${dt!==null?`, variação ${dt>=0?'+':''}${dt.toFixed(1)} p.p.`:''}`,'Mapear destinos e temas para corrigir roteamento ou capacitação.','Taxa abaixo de 30%',14);
    if(dTma!==null&&dTma>=15)add('attention','TMA aumentou',`Alta de ${dTma.toFixed(1)}%; atual ${fmtTime(cur.tma)}.`,'Revisar etapas e casos fora da curva.',`TMA ≤ ${fmtTime(old.tma)}`,14);
    if(dTmr!==null&&dTmr>=15)add('attention','TMR aumentou',`Alta de ${dTmr.toFixed(1)}%; atual ${fmtTime(cur.tmr)}.`,'Revisar cobertura da fila e horários de pico.',`TMR ≤ ${fmtTime(old.tmr)}`,7);
    if(df!==null&&df>10&&ds!==null&&ds<-.1)add('attention','Volume cresceu, mas a qualidade recuou',`Finalizações por pessoa +${df.toFixed(1)}%; score ${ds.toFixed(2)}.`,'Calibrar ritmo e qualidade antes de ampliar metas.','Manter ganho com score estável',14);
    if(dp!==null&&dp>=5&&ds!==null&&ds>=0)add('opportunity','Eficiência e qualidade evoluíram juntas',`Produtividade +${dp.toFixed(1)} p.p.; score +${ds.toFixed(2)}.`,'Registrar e replicar as práticas do período.','Sustentar por 2 períodos',30);
    if(!issues.length)add('stable','Operação estável no recorte','Nenhum desvio relevante foi identificado.','Manter acompanhamento e investigar variações locais.','Sustentar os indicadores',30);
    const order={critical:0,high:1,attention:2,opportunity:3,stable:4}; issues.sort((a,b)=>order[a.level]-order[b.level]); const risks=issues.filter(i=>order[i.level]<=2).length;
    const status=issues.some(i=>i.level==='critical')?['Crítico','critical']:risks?['Atenção','warning']:['Saudável','good'];
    const history=cm.slice(-6).map(m=>({m,...metrics(all.filter(r=>String(r['Mês'])===m))}));
    el.innerHTML=`<div class="aa-summary"><div><span>LEITURA EXECUTIVA AUTOMÁTICA</span><h3>${esc(scope())}</h3><p>${esc(previous?`${month(current)} × ${month(previous)}`:`${month(current)} • sem período anterior`)}. Os filtros ativos definem o diagnóstico.</p></div><aside class="aa-status aa-${status[1]}"><small>Status</small><strong>${status[0]}</strong><span>${risks} ponto${risks===1?'':'s'} de atenção</span></aside></div>
    <div class="aa-kpis">${kpi('Finalizados por pessoa',cur.per.toFixed(1).replace('.',','),df,false,`${cur.fin.toLocaleString('pt-BR')} no total`,'%')}${kpi('Produtividade real',pct(cur.prod),dp,false,'finalizados ÷ assumidos')}${kpi('Score médio',cur.score?cur.score.toFixed(2):'—',ds,false,'qualidade média',' ponto')}${kpi('Taxa de transferência',pct(cur.tx),dt,true,'transferidos ÷ assumidos')}${cur.tma!==null?kpi('TMA',fmtTime(cur.tma),dTma,true,'menor é melhor','%'):''}${cur.tmr!==null?kpi('TMR',fmtTime(cur.tmr),dTmr,true,'menor é melhor','%'):''}</div>
    <div class="aa-heading"><strong>Diagnóstico priorizado</strong><span>Evidência, próxima ação e alvo mensurável</span></div><div class="aa-findings">${issues.map((i,x)=>`<article class="aa-finding aa-${i.level}"><b class="aa-number">${x+1}</b><div><header><strong>${esc(i.title)}</strong><span>${i.level==='critical'?'Crítico':i.level==='high'?'Alta prioridade':i.level==='attention'?'Atenção':i.level==='opportunity'?'Oportunidade':'Estável'}</span></header><p>${esc(i.evidence)}</p><div><b>Próxima ação:</b> ${esc(i.action)}</div><footer><span>Alvo: ${esc(i.target)}</span><span>Revisar em ${i.days} dias</span></footer></div></article>`).join('')}</div>
    <details class="aa-history"><summary>Evolução dos últimos ${history.length} períodos</summary><div><table class="ranking-table"><thead><tr><th>Período</th><th>Finalizados/pessoa</th><th>Prod.</th><th>Score</th><th>Tx. transf.</th><th>TMA</th><th>TMR</th></tr></thead><tbody>${history.map(x=>`<tr><td><strong>${esc(month(x.m))}</strong></td><td>${x.per.toFixed(1).replace('.',',')}</td><td>${pct(x.prod)}</td><td>${x.score?x.score.toFixed(2):'—'}</td><td>${pct(x.tx)}</td><td>${fmtTime(x.tma)}</td><td>${fmtTime(x.tmr)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
  function compCard(title,m,o) { const win=(a,b,inv)=>a===b?'':((inv?a<b:a>b)?'comp-winner':'comp-loser'), row=(l,v,c='')=>`<div class="comp-row"><span class="comp-label">${l}</span><span class="comp-value ${c}">${v}</span></div>`; return `<div class="comp-card"><div class="comp-card-header"><h3>${esc(title)}</h3><p>Métricas normalizadas</p></div>${row('Finalizados por pessoa/mês',m.perMonth.toFixed(1).replace('.',','),win(m.perMonth,o.perMonth,false))}${row('Produtividade',pct(m.prod),win(m.prod,o.prod,false))}${row('Taxa de transferência',pct(m.tx),win(m.tx,o.tx,true))}${row('Score médio',m.score?m.score.toFixed(2):'—',win(m.score,o.score,false))}${m.tma!==null||o.tma!==null?row('TMA',fmtTime(m.tma),win(m.tma??Infinity,o.tma??Infinity,true)):''}${m.tmr!==null||o.tmr!==null?row('TMR',fmtTime(m.tmr),win(m.tmr??Infinity,o.tmr??Infinity,true)):''}${row('Volume total',`${m.fin.toLocaleString('pt-BR')} finalizados`)}${row('Base',`${m.people} pessoa(s) • ${m.periods} período(s)`)}</div>`; }
  function comparison(a,ra,b,rb){const ma=metrics(ra),mb=metrics(rb);return `<div class="aa-comp-note">Eficiência, qualidade e taxas são normalizadas; o volume aparece como contexto.</div><div class="comp-grid">${compCard(a,ma,mb)}${compCard(b,mb,ma)}</div>`;}
  window.renderInsights=renderV2; window.onInsightsTabActivated=()=>{renderV2();if(typeof window.renderAlertas==='function')window.renderAlertas();};
  window.renderColabComparison=(a,b)=>{const r=filtered();return comparison(a,r.filter(x=>String(x.Atendente)===a),b,r.filter(x=>String(x.Atendente)===b));};
  window.renderSetorComparison=(a,b)=>{const r=filtered();return comparison(a,r.filter(x=>String(x.Setor)===a),b,r.filter(x=>String(x.Setor)===b));};
  window.renderPeriodComparison=(a,b)=>{const r=context();return comparison(month(a),r.filter(x=>String(x['Mês'])===a),month(b),r.filter(x=>String(x['Mês'])===b));};
})();
