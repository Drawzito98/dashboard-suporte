/* Home adapter: scoped reads, evidence and existing navigation/editor entry points. */
(function(root){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,d=0)=>v==null?'Sem informação':Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
  let refreshing=false,timer,rerenderPending=false;
  function read(key,fallback){try{const raw=appStorage.getItem(key);return{value:raw?JSON.parse(raw):fallback,available:raw!==null};}catch(_){return{value:fallback,available:false};}}
  function today(){const d=new Date();return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  function model(){
    if(typeof AppDataSession!=='undefined'&&!AppDataSession.owner())return CockpitEngine.build({today:today(),taskAvailable:false});
    const filters=typeof globalFilters!=='undefined'?globalFilters:{};
    const storedState=typeof AppState!=='undefined'?AppState.get('records'):null;
    const state=navigator.onLine===false?{...storedState,status:'offline'}:storedState;
    let source=Array.isArray(state?.view)?state.view:(typeof rawRecords!=='undefined'?rawRecords:[]);
    source=Array.isArray(source)?source.filter(r=>r&&typeof r.Atendente==='string').map(r=>({...r})):[];
    if(typeof normalizeAtendenteOnRecords==='function')source=normalizeAtendenteOnRecords(source);
    if(typeof deduplicateRecords==='function')source=deduplicateRecords(source);
    const active=source.filter(r=>r&&(typeof isColabActive!=='function'||isColabActive(r.Atendente))&&(typeof isSetorActive!=='function'||isSetorActive(r.Setor)));
    const scope=typeof filters.aplicar==='function'?filters.aplicar.call({...filters,periodo:'all'},active):active;
    const taskState=typeof AppState!=='undefined'?AppState.get('tarefas'):null;
    const taskData=Array.isArray(taskState)?{value:taskState,available:true}:read('sistema_tarefas_v1',[]), info=typeof getColabInfoLocal==='function'?getColabInfoLocal():read('sistema_colaboradores_info_v1',{}).value;
    return CockpitEngine.build({records:scope,tasks:taskData.value,taskAvailable:taskData.available&&Array.isArray(taskData.value),registry:info&&typeof info==='object'?info:{},goals:read('sistema_metas_v1',[]).value,filters,today:today(),state});
  }
  function html(m,part='all'){
    const period=m.months.join(' · ')||'Sem período',source=m.source==='server'?'Servidor':m.source==='cache'?'Cache desta conta':'Fonte ainda não confirmada';
    let output=`<section class="cockpit-context" aria-label="Contexto do cockpit"><div><span class="cockpit-eyebrow">Centro de decisão</span><h3>Indicadores · ${esc(period)}</h3><p>${m.explicitPeriod?'Período escolhido nos filtros.':'Referência automática: último mês encerrado com dados; na ausência dele, o mês atual.'} Tarefas e agenda usam a data de hoje e abrangem sua conta.</p></div><button type="button" class="btn-small" id="cockpitRefresh" ${refreshing?'disabled':''}>${refreshing?'Consultando…':'Atualizar dados'}</button><p class="cockpit-source">Indicadores: ${esc(source)}${m.status==='loading'?' · consulta em andamento':m.status==='offline'?' · sem conexão':''}${m.pendingCount?' · '+m.pendingCount+' pendente(s) de confirmação':''}. Agenda e tarefas: dados desta conta. A sincronização das demais áreas não está confirmada.</p></section>`;
    const count=m.tasks.queue.length+m.diagnostics.length;
    const title=count?`${count} ${count===1?'item':'itens'} para investigar ou resolver`:m.rows.length&&m.metrics.scoredPeople>0&&m.taskAvailable?'Nenhum alerta pelas regras deste recorte':'Confira a cobertura antes de decidir';
    output+=`<section class="cockpit-briefing"><h3>${esc(title)}</h3><p>${m.taskAvailable?m.tasks.overdue.length+' tarefa(s) atrasada(s) e '+m.tasks.dueToday.length+' para hoje.':'Tarefas ainda não confirmadas.'} ${m.belowTarget} pessoa(s) com média abaixo de ${fmt(m.target,2)}. ${m.unscored.length} sem Score válido.</p><p>Alertas sugerem investigação e não constituem avaliação final de desempenho.</p><div class="cockpit-shortcuts"><button type="button" class="btn-small" data-cockpit-reveal="cockpitTasks">Ver tarefas (${m.taskAvailable?m.tasks.queue.length:'—'})</button><button type="button" class="btn-small" data-cockpit-reveal="cockpitDiagnostics">Ver alertas (${m.diagnostics.length})</button></div></section>`;
    const intro=output;output='';
    const taskItems=m.tasks.queue.slice(0,6).map((t,i)=>`<article class="cockpit-item"><div><span class="cockpit-tag">${t.due<today()?'Atrasada':'Vence hoje'}</span><h4>${esc(t.titulo||t.descricao||'Tarefa sem título')}</h4><p>Prazo: ${esc(t.due)}${t.rotinaAtiva?' · próxima verificação recorrente':''}</p></div><button class="btn-small" type="button" data-cockpit-task="${i}">Abrir tarefa</button></article>`).join('');
    output+=`<div class="cockpit-columns"><section class="cockpit-panel" id="cockpitTasks"><h3>Resolver na rotina</h3><p>Tarefas da sua conta · todos os setores e períodos.</p>${taskItems||`<div class="empty-state"><div class="empty-title">${m.taskAvailable?'Nenhum prazo vencido ou para hoje':'Tarefas indisponíveis'}</div><div class="empty-sub">${m.taskAvailable?m.tasks.unscheduled.length+' tarefa(s) sem prazo. Consulte a rotina para ver as demais.':'Atualize os dados antes de concluir que não há pendências.'}</div></div>`}<button type="button" class="btn-small" data-cockpit-tab="tarefas">Ver todas as tarefas (${m.taskAvailable?m.tasks.pending.length:'—'})</button></section>`;
    const diagnosticItems=m.diagnostics.slice(0,6).map(({group:g,findings},i)=>`<article class="cockpit-item"><div><span class="cockpit-tag">Investigar qualidade</span><h4>${esc(g.name)}</h4><p>${esc(g.sector)} · ${esc(g.level)} · ${esc(period)}</p>${findings.slice(0,2).map(f=>`<p><strong>${esc(f.indicator)}:</strong> ${esc(f.evidence)}</p>`).join('')}<details><summary>Entender o alerta</summary>${findings.map(f=>`<p>${esc(f.interpretation)}</p><p><strong>Próximo passo:</strong> ${esc(f.action)}</p>`).join('')}<p>${esc(g.notices.join(' '))}</p></details></div><button type="button" class="btn-small" data-cockpit-person="${i}">Analisar pessoa</button></article>`).join('');
    output+=`<section class="cockpit-panel" id="cockpitDiagnostics"><h3>Investigar com evidências</h3><p>${m.diagnostics.length} vínculo(s) pessoa/setor/nível sinalizados. Exibindo até 6; a mesma pessoa pode ter mais de um vínculo.</p>${diagnosticItems||'<div class="empty-state"><div class="empty-title">Nenhum alerta identificado</div><div class="empty-sub">Confira notas ausentes e a cobertura dos dados antes de interpretar o recorte.</div></div>'}<button class="btn-small" type="button" data-cockpit-diagnostic>Abrir diagnóstico deste período</button></section></div>`;
    output+=`<section class="cockpit-panel"><h3>Equipes no recorte</h3><p>Média simples de Score por pessoa; volumes descritivos, sem ranking entre níveis. Meta oficial: ${fmt(m.target,2)}.</p><div class="table-wrap" data-scroll-label="Indicadores das equipes por nível"><table class="cockpit-table"><caption>${esc(period)} · setores e níveis</caption><thead><tr><th>Equipe</th><th>Nível</th><th>Pessoas com nota</th><th>Score médio</th><th>Finalizados</th></tr></thead><tbody>${m.sectors.map(g=>`<tr><th scope="row">${esc(g.name)}</th><td>${esc(g.level)}</td><td>${g.current.scoredPeople}/${g.current.people}</td><td>${fmt(g.current.score,2)}</td><td>${fmt(g.current.finished)}</td></tr>`).join('')||'<tr><td colspan="5">Sem dados no período e filtros selecionados.</td></tr>'}</tbody></table></div></section>`;
    output+=`<details class="cockpit-coverage" ${m.notes.length?'open':''}><summary>Fontes e limites da leitura</summary><ul>${m.notes.map(n=>`<li>${esc(n)}</li>`).join('')||'<li>Consulte a origem antes de decidir.</li>'}</ul><p>Não há quantidade de avaliações suficiente para presumir uma média ponderada. CADU e agregados ficam fora da análise de pessoas.</p></details>`;
    return part==='intro'?intro:part==='details'?output:intro+output;
  }
  function go(tab){
    const button=document.querySelector(`.tab-btn[data-tab="${tab}"]`);if(!button||button.disabled)return false;
    // Domain hiding is navigation state, not permission. Inspect the original role CSS.
    const hidden=button.hidden;button.hidden=false;const allowed=getComputedStyle(button).display!=='none';button.hidden=hidden;
    if(!allowed)return false;button.click();return true;
  }
  function bind(container,m){
    container.setAttribute('aria-busy',String(refreshing));
    container.querySelectorAll('[data-cockpit-reveal]').forEach(b=>b.addEventListener('click',()=>{const target=document.getElementById(b.dataset.cockpitReveal);if(target){target.tabIndex=-1;target.scrollIntoView({block:'start'});target.focus({preventScroll:true});}}));
    container.querySelectorAll('[data-cockpit-tab]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.cockpitTab)));
    container.querySelector('[data-cockpit-diagnostic]')?.addEventListener('click',()=>{
      if(!m.months.length)return;
      if(typeof globalFilters!=='undefined'){
        globalFilters.periodo=m.months.length===1?m.months[0]:'__multi__';
        globalFilters.mesesSelecionados=[...m.months];globalFilters._syncUI();globalFilters._notify();
      }
      go('lider');
    });
    container.querySelectorAll('[data-cockpit-person]').forEach(b=>b.addEventListener('click',()=>{const item=m.diagnostics[Number(b.dataset.cockpitPerson)];if(item&&typeof openEquipe360==='function')openEquipe360(item.group.name,'desempenho');}));
    container.querySelectorAll('[data-cockpit-task]').forEach(b=>b.addEventListener('click',()=>{
      const item=m.tasks.queue[Number(b.dataset.cockpitTask)],token=typeof AppDataSession!=='undefined'?AppDataSession.token():null;
      if(!item||!go('tarefas')||item.id==null)return;
      let attempts=0;
      const focus=()=>{if((token&&!AppDataSession.current(token))||document.body.dataset.activeTab!=='tarefas')return;
        const row=[...document.querySelectorAll('[data-tarefa-id]')].find(el=>el.dataset.tarefaId===String(item.id));
        if(row){row.scrollIntoView({block:'center'});row.tabIndex=-1;row.classList.add('cockpit-destination');row.addEventListener('blur',()=>row.classList.remove('cockpit-destination'),{once:true});row.focus({preventScroll:true});return;}
        if(++attempts<10)setTimeout(focus,80);else if(typeof showToast==='function')showToast('A tarefa não está visível na rotina. Confira a lista atual e seus filtros.','warning');
      };setTimeout(focus,80);
    }));
    container.querySelector('#cockpitRefresh')?.addEventListener('click',refresh);
  }
  async function refresh(){
    const token=typeof AppDataSession!=='undefined'?AppDataSession.token():null;
    if(refreshing||(token&&!token.owner))return;refreshing=true;
    const button=document.getElementById('cockpitRefresh');if(button){button.disabled=true;button.textContent='Consultando…';}
    try{
      const result=await Promise.allSettled([dbLoadRecords(),dbTarefasLoad(),dbFeriasLoad(),dbColabInfoLoad()]);
      if(token&&!AppDataSession.current(token))return;
      if(result[0].status==='fulfilled'&&Array.isArray(result[0].value)){
        const rows=typeof normalizeAtendenteOnRecords==='function'?normalizeAtendenteOnRecords(result[0].value):result[0].value;
        rawRecords=typeof deduplicateRecords==='function'?deduplicateRecords(rows):rows;
        if(typeof populateFilters==='function')populateFilters(rawRecords);
        if(typeof globalFilters!=='undefined')globalFilters.popularOptions();
      }
    }catch(_){if(typeof showToast==='function')showToast('Não foi possível atualizar todas as fontes. Confira a origem dos dados no cockpit.','warning');}
    finally{refreshing=false;schedule();}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>{
    if(document.body.dataset.activeTab!=='home'||typeof renderHome!=='function'||(typeof AppDataSession!=='undefined'&&!AppDataSession.owner())){rerenderPending=false;return;}
    if([...document.querySelectorAll('dialog[open], .modal-overlay, .colab-detail-overlay, .mt-modal-overlay')].some(el=>el.getClientRects().length)){rerenderPending=true;return;}
    rerenderPending=false;renderHome();
  },60);}
  for(const event of ['app-data-changed','app-extra-data-loaded','ferias-updated','storage','online','offline'])window.addEventListener(event,schedule);
  new MutationObserver(()=>{if(rerenderPending)schedule();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','open','hidden']});
  root.HomeCockpit={model,html,bind};
})(window);
