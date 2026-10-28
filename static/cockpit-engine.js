/* Read-only decision model. Diagnostic methodology stays in DiagnosticoEngine. */
(function(root){
  'use strict';
  const E = typeof module !== 'undefined' && module.exports ? require('./diagnostico-engine.js') : root.DiagnosticoEngine;
  const month = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value || '');
  function date(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const d = new Date(value + 'T12:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === value;
  }
  function selectedMonths(filters, available, today) {
    if (filters.periodo === '__range__') {
      try { return E.range(filters.mesInicio, filters.mesFim); } catch (_) { return []; }
    }
    if (filters.periodo === '__multi__') return [...new Set(filters.mesesSelecionados || [])].filter(month).sort();
    if (filters.periodo && filters.periodo !== 'all') return month(filters.periodo) ? [filters.periodo] : [];
    const completed = available.filter(m => m < today.slice(0,7));
    return completed.length ? [completed.at(-1)] : available.includes(today.slice(0,7)) ? [today.slice(0,7)] : [];
  }
  function build({records=[],tasks=[],registry={},goals=[],filters={},today,taskAvailable=true,state=null}={}) {
    if (!date(today)) throw new Error('Data de referência inválida.');
    // Caller applies the existing non-temporal global filters and active identities.
    records=Array.isArray(records)?records:[];goals=Array.isArray(goals)?goals:[];registry=registry&&typeof registry==='object'&&!Array.isArray(registry)?registry:{};
    const source = E.context(records, {}, registry);
    const available = [...new Set(source.map(r=>r['Mês']))].sort();
    const months = selectedMonths(filters,available,today), previous = months.length ? E.previousFor(months) : [];
    const rows = source.filter(r=>months.includes(r['Mês']));
    const metrics = E.metrics(rows), partial = months.some(m=>m>=today.slice(0,7)) || rows.some(r=>r.periodo_completo===false);
    const missing = months.filter(m=>!rows.some(r=>r['Mês']===m));
    const previousMissing = previous.filter(m=>!source.some(r=>r['Mês']===m));
    const result = months.length ? E.analyze(source,{current:months,previous,registry,goals,today}) : {groups:[]};
    const scored = new Map(), people = new Set(rows.map(r=>r.Atendente));
    for (const row of rows) {
      const score = E.numeric(row.SCORE);
      if (score===null || score>5) continue;
      if(!scored.has(row.Atendente))scored.set(row.Atendente,[]);
      scored.get(row.Atendente).push(score);
    }
    const scoreList=[...scored].map(([name,scores])=>({name,avg:scores.reduce((a,b)=>a+b,0)/scores.length,count:scores.length})).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const alertCodes=new Set(['score-target','recurring-drop','recurring-target','tma','tmr']);
    const diagnostics=result.groups.filter(g=>g.type==='person').map(g=>({group:g,findings:g.findings.filter(f=>f.kind==='attention'&&alertCodes.has(f.code))})).filter(x=>x.findings.length);
    const sectors=result.groups.filter(g=>g.type==='sector').sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.level.localeCompare(b.level));
    const pending=(Array.isArray(tasks)?tasks:[]).filter(t=>t&&typeof t==='object'&&!['concluida','cancelada'].includes(t.status));
    const dated=pending.map(task=>({...task,due:date(task.rotinaAtiva&&task.rotinaProximaData)?task.rotinaProximaData:date(task.data)?task.data:null}));
    const overdue=dated.filter(t=>t.due&&t.due<today), dueToday=dated.filter(t=>t.due===today), unscheduled=dated.filter(t=>!t.due);
    const taskQueue=[...overdue,...dueToday].sort((a,b)=>a.due.localeCompare(b.due)||String(a.titulo||'').localeCompare(String(b.titulo||''),'pt-BR'));
    const notes=[];
    if(!months.length)notes.push('Não há período válido para analisar. Escolha um mês ou importe indicadores.');
    if((!filters.periodo||filters.periodo==='all')&&months.length&&months.at(-1)<E.shift(today.slice(0,7),-1))notes.push('O último mês encerrado com registros é '+months.at(-1)+'; há meses mais recentes sem dados no recorte.');
    if(partial)notes.push('Período em andamento, futuro ou parcial: volume descritivo, sem comparação com meses completos.');
    if(missing.length)notes.push('Sem registros em: '+missing.join(', ')+'. Ausência de dados não é zero.');
    if(previousMissing.length)notes.push('Comparação com lacunas no período anterior: '+previousMissing.join(', ')+'.');
    if(rows.length)notes.push('A cobertura integral da exportação precisa ser confirmada. Volume não mede produtividade isoladamente.');
    if(metrics.scoredPeople<metrics.people)notes.push((metrics.people-metrics.scoredPeople)+' pessoa(s) sem Score válido no recorte.');
    if(!taskAvailable)notes.push('As tarefas da conta ainda não estão disponíveis; não é possível afirmar ausência de pendências.');
    if(state?.source==='cache'||state?.status==='offline')notes.push('Indicadores do cache desta conta; podem estar desatualizados.');
    const pendingCount=Array.isArray(state?.pending)?state.pending.length:0;
    if(pendingCount)notes.push(pendingCount+' alteração(ões) de indicadores aguardam confirmação no servidor.');
    return {months,previous,rows,historyRows:source,metrics,scoreList,sectors,diagnostics,partial,missing,notes,pendingCount,taskAvailable,
      tasks:{pending:dated,overdue,dueToday,unscheduled,queue:taskQueue},
      belowTarget:scoreList.filter(p=>p.avg<E.TARGET).length,
      explicitPeriod:!!filters.periodo&&filters.periodo!=='all',
      source:state?.source||'none',status:state?.status||'idle',target:E.TARGET,
      unscored:[...people].filter(name=>!scored.has(name))};
  }
  const api={build,selectedMonths,date};root.CockpitEngine=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
