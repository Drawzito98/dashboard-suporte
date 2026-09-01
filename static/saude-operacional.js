// saude-operacional.js — apresentação executiva automática por setor e indivíduo
(function () {
  'use strict';
  const esc = value => typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const clamp = value => Math.max(0, Math.min(100, value));
  const pct = value => `${num(value).toFixed(1).replace('.', ',')}%`;
  const fmt = value => num(value).toLocaleString('pt-BR');
  const month = value => typeof formatMesLabel === 'function' ? formatMesLabel(value) : value;
  const TARGET_KEY = 'sistema_saude_meta_finalizados_v1';
  const valid = row => row && row.Atendente && !(typeof isAggregateName === 'function' && isAggregateName(row.Atendente)) && (typeof isColabActive !== 'function' || isColabActive(row.Atendente));

  function contextRows() {
    const filters = typeof globalFilters !== 'undefined' ? globalFilters : {};
    const query = String(filters.pesquisa || '').toLowerCase();
    return (typeof rawRecords !== 'undefined' ? rawRecords : []).filter(valid).filter(row =>
      (!filters.setor || filters.setor === 'all' || String(row.Setor) === String(filters.setor)) &&
      (!filters.colaborador || filters.colaborador === 'all' || String(row.Atendente) === String(filters.colaborador)) &&
      (typeof filters.correspondeNivel !== 'function' || filters.correspondeNivel(row)) &&
      (!query || Object.values(row).some(value => String(value ?? '').toLowerCase().includes(query))) &&
      (typeof isSetorActive !== 'function' || isSetorActive(row.Setor)));
  }
  function selectedRows() {
    const records = typeof rawRecords !== 'undefined' ? rawRecords : [];
    const filtered = typeof globalFilters !== 'undefined' && typeof globalFilters.aplicar === 'function' ? globalFilters.aplicar(records) : records;
    return (filtered || []).filter(valid);
  }
  function calculate(rows) {
    const assumed = rows.reduce((sum,row)=>sum+num(row.Assumidos),0), finished=rows.reduce((sum,row)=>sum+num(row.Finalizados),0), transferred=rows.reduce((sum,row)=>sum+num(row.Transferidos),0);
    const scores=rows.map(row=>Number(row.SCORE)).filter(Number.isFinite), people=new Set(rows.map(row=>row.Atendente)).size;
    const personMonths=new Set(rows.map(row=>`${row.Atendente}|${row['Mês']}`).filter(Boolean)).size, months=new Set(rows.map(row=>row['Mês']).filter(Boolean)).size;
    return { assumed,finished,transferred,people,months,score:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0,productivity:assumed?finished/assumed:0,transferRate:assumed?transferred/assumed:0,perPerson:personMonths?finished/personMonths:0 };
  }
  function configuredTarget(fallback) {
    const saved = Number(localStorage.getItem(TARGET_KEY));
    return saved > 0 ? saved : Math.max(fallback, 1);
  }
  function health(current, previous, target) {
    const evolution=previous&&previous.perPerson?((current.perPerson-previous.perPerson)/Math.abs(previous.perPerson))*100:null;
    const quality=clamp(current.score/4.7*100), delivery=clamp(current.perPerson/target*100), transfer=current.transferRate<=.25?100:clamp(100-(current.transferRate-.25)/.20*100), trend=evolution===null?70:clamp(70+evolution*2);
    const value=Math.round(quality*.45+delivery*.35+transfer*.15+trend*.05);
    const status=value>=80?'Saudável':value>=60?'Em atenção':'Crítico', key=value>=80?'healthy':value>=60?'attention':'critical';
    const factors=[{label:'qualidade',value:quality},{label:'volume finalizado',value:delivery},{label:'transferências',value:transfer},{label:'evolução',value:trend}].sort((a,b)=>a.value-b.value);
    return {value,status,key,evolution,strength:factors.at(-1).label,risk:factors[0].label};
  }
  function levelOf(name) { return typeof _nivelColaborador === 'function' ? _nivelColaborador(name) : ''; }
  function statusBadge(result) { return `<span class="so-status so-${result.key}">${result.status}</span>`; }
  function delta(value) { if(value===null)return'<span class="so-neutral">Sem base anterior</span>';const good=value>=0;return`<span class="${good?'so-positive':'so-negative'}">${good?'↑':'↓'} ${Math.abs(value).toFixed(1).replace('.',',')}%</span>`; }

  function buildReport() {
    const selected=selectedRows(), context=contextRows();
    if(!selected.length)return null;
    const selectedMonths=[...new Set(selected.map(row=>String(row['Mês'])).filter(Boolean))].sort(), contextMonths=[...new Set(context.map(row=>String(row['Mês'])).filter(Boolean))].sort();
    const previousMonths=contextMonths.filter(value=>value<selectedMonths[0]).slice(-selectedMonths.length), previousSet=new Set(previousMonths);
    const currentRows=selected, previousRows=previousMonths.length?context.filter(row=>previousSet.has(String(row['Mês']))):[];
    const periodLabel=selectedMonths.length===1?month(selectedMonths[0]):`${month(selectedMonths[0])} a ${month(selectedMonths.at(-1))}`;
    const previousLabel=previousMonths.length===1?month(previousMonths[0]):previousMonths.length?`${month(previousMonths[0])} a ${month(previousMonths.at(-1))}`:'';
    const overall=calculate(currentRows), previousOverall=previousRows.length?calculate(previousRows):null, target=configuredTarget(overall.perPerson), overallHealth=health(overall,previousOverall,target);
    const sectors=[...new Set(currentRows.map(row=>String(row.Setor||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(name=>{
      const current=calculate(currentRows.filter(row=>String(row.Setor||'').trim()===name)), beforeRows=previousRows.filter(row=>String(row.Setor||'').trim()===name), before=beforeRows.length?calculate(beforeRows):null;
      return {name,current,before,health:health(current,before,target)};
    }).sort((a,b)=>b.health.value-a.health.value);
    const people=[...new Set(currentRows.map(row=>String(row.Atendente||'').trim()).filter(Boolean))].map(name=>{
      const rows=currentRows.filter(row=>String(row.Atendente)===name), beforeRows=previousRows.filter(row=>String(row.Atendente)===name), current=calculate(rows), before=beforeRows.length?calculate(beforeRows):null;
      return {name,sector:[...new Set(rows.map(row=>row.Setor).filter(Boolean))].join(', '),level:levelOf(name),current,before,health:health(current,before,target)};
    }).sort((a,b)=>b.health.value-a.health.value);
    return {periodLabel,previousLabel,overall,overallHealth,sectors,people,target,targetIsManual:Number(localStorage.getItem(TARGET_KEY))>0};
  }

  function renderOperationalHealth() {
    const host=document.getElementById('saudeOperacionalContent'); if(!host)return;
    const report=buildReport();
    if(!report){host.innerHTML='<div class="empty-state"><div class="empty-title">Sem dados no recorte atual</div><div class="empty-sub">Ajuste os filtros globais para gerar a saúde operacional.</div></div>';return;}
    const {periodLabel,previousLabel,overall,overallHealth,sectors,people,target,targetIsManual}=report;
    const scope=[]; if(typeof globalFilters!=='undefined'){if(globalFilters.nivel&&globalFilters.nivel!=='all')scope.push(`Nível ${globalFilters.nivel}`);if(globalFilters.setor&&globalFilters.setor!=='all')scope.push(globalFilters.setor);}
    const critical=sectors.filter(item=>item.health.key==='critical').length, attention=sectors.filter(item=>item.health.key==='attention').length;
    host.innerHTML=`<div class="so-report" id="soPrintable"><section class="so-header card"><div><span class="page-eyebrow">Apresentação para gestão</span><h2>Saúde Operacional</h2><p>${esc(periodLabel)}${previousLabel?` comparado com ${esc(previousLabel)}`:''} · ${esc(scope.join(' · ')||'Toda a operação')}</p></div><button class="btn-primary so-no-print" id="soPrintBtn">🖨️ Imprimir / PDF</button></section>
      <section class="so-hero so-${overallHealth.key}"><div><span>NOTA GERAL DE SAÚDE</span><strong>${overallHealth.value}<small>/100</small></strong>${statusBadge(overallHealth)}</div><p>${overallHealth.key==='healthy'?'A operação apresenta equilíbrio entre qualidade, volume finalizado, transferências e evolução.':overallHealth.key==='attention'?`A operação requer acompanhamento, principalmente em ${overallHealth.risk}.`:`A operação exige plano de ação prioritário, com maior impacto em ${overallHealth.risk}.`}</p></section>
      <div class="so-kpis"><article><span>Pessoas no período</span><strong>${overall.people}</strong></article><article><span>Finalizados no período</span><strong>${fmt(overall.finished)}</strong><small>${overall.perPerson.toFixed(1).replace('.',',')} de média mensal por pessoa</small></article><article><span>Produtividade</span><strong>${pct(overall.productivity*100)}</strong></article><article><span>Qualidade</span><strong>${overall.score?overall.score.toFixed(2):'—'}</strong></article><article><span>Transferências</span><strong>${pct(overall.transferRate*100)}</strong><small>menor é melhor</small></article></div>
      <section class="card so-section"><div class="so-section-heading"><div><span>CONSOLIDADO</span><h3>Saúde dos setores</h3><p>${sectors.length} setor(es) · ${critical} crítico(s) · ${attention} em atenção</p></div></div><div class="so-sector-grid">${sectors.map(item=>`<article class="so-sector-card so-${item.health.key}"><header><div><span>SETOR</span><h4>${esc(item.name)}</h4></div><strong>${item.health.value}</strong></header>${statusBadge(item.health)}<div class="so-metrics"><span><small>Média mensal/pessoa</small><b>${item.current.perPerson.toFixed(1).replace('.',',')}</b></span><span><small>Produtividade</small><b>${pct(item.current.productivity*100)}</b></span><span><small>Qualidade</small><b>${item.current.score?item.current.score.toFixed(2):'—'}</b></span><span><small>Transferências</small><b>${pct(item.current.transferRate*100)}</b></span></div><footer>${delta(item.health.evolution)}<small>Força: ${esc(item.health.strength)} · Atenção: ${esc(item.health.risk)}</small></footer></article>`).join('')}</div></section>
      <section class="card so-section"><div class="so-section-heading"><div><span>RESULTADOS INDIVIDUAIS</span><h3>Desempenho das pessoas</h3><p>Totais do período selecionado; nota calculada pela média mensal por pessoa.</p></div></div><div class="table-wrap"><table class="so-table"><thead><tr><th>#</th><th>Colaborador</th><th>Nível</th><th>Setor</th><th>Saúde</th><th>Finalizados no período</th><th>Média mensal</th><th>Produtividade</th><th>Qualidade</th><th>Transferências</th><th>Evolução</th></tr></thead><tbody>${people.map((item,index)=>`<tr><td>${index+1}</td><td><strong>${esc(item.name)}</strong></td><td>${esc(item.level||'—')}</td><td>${esc(item.sector||'—')}</td><td><b class="so-score so-${item.health.key}">${item.health.value}</b></td><td>${fmt(item.current.finished)}</td><td>${item.current.perPerson.toFixed(1).replace('.',',')}</td><td>${pct(item.current.productivity*100)}</td><td>${item.current.score?item.current.score.toFixed(2):'—'}</td><td>${pct(item.current.transferRate*100)}</td><td>${delta(item.health.evolution)}</td></tr>`).join('')}</tbody></table></div></section>
      <details class="card so-method"><summary>Como a nota de saúde é calculada?</summary><p>Qualidade 45% · média mensal de finalizados por pessoa 35% · transferências 15% · evolução contra o período anterior equivalente 5%. Nota 80–100: saudável; 60–79: em atenção; abaixo de 60: crítico.</p><div class="so-target so-no-print"><label for="soTargetInput">Meta mensal de finalizados por pessoa</label><input id="soTargetInput" type="number" min="1" step="1" value="${Math.round(target)}"><button class="btn-primary" id="soSaveTarget">Salvar meta</button><button class="btn-secondary" id="soAutoTarget">Usar média automática</button><small>${targetIsManual?'Meta personalizada ativa.':'Referência automática: média mensal atual da operação.'}</small></div></details></div>`;
    document.getElementById('soPrintBtn')?.addEventListener('click',()=>window.print());
    document.getElementById('soSaveTarget')?.addEventListener('click',()=>{const value=Number(document.getElementById('soTargetInput')?.value);if(value>0){localStorage.setItem(TARGET_KEY,String(value));renderOperationalHealth();}});
    document.getElementById('soAutoTarget')?.addEventListener('click',()=>{localStorage.removeItem(TARGET_KEY);renderOperationalHealth();});
  }
  window.renderOperationalHealth=renderOperationalHealth;
  window.onSaudeOperacionalTabActivated=renderOperationalHealth;
})();
