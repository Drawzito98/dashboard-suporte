/* Equipe 360º: one read-only profile, original editors remain authoritative. */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tabs = [['resumo', 'Visão geral'], ['desempenho', 'Desempenho'], ['desenvolvimento', 'Desenvolvimento'], ['presenca', 'Presença e ponto'], ['historico', 'Histórico e fontes']];
  let dialog, model = null, version = 0, selected = 'resumo', focusBefore, editing = null, pendingNotice = '', pendingPerson = '', sessionOwner = '';
  const rows = key => model?.sources[key]?.status === 'ok' ? model.sources[key].data : [];
  const date = value => {
    if (!value) return 'Sem data';
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.split('-').reverse().join('/');
    return Number.isFinite(Date.parse(text)) ? new Date(text).toLocaleString('pt-BR') : text;
  };
  const allowed = () => {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    return !document.body.classList.contains('privacy-screen-on') && document.body.dataset.role === 'admin' && user?.app_metadata?.role === 'admin' ? user : null;
  };
  function destroyChart() { if (window.__colabDetailChart) { window.__colabDetailChart.destroy(); window.__colabDetailChart = null; } }
  function resetDialog() {
    if (!dialog) return;
    dialog.querySelector('#e360Body').replaceChildren();dialog.querySelector('#e360Tabs').replaceChildren();
    dialog.querySelector('#e360Title').textContent='';dialog.querySelector('#e360Subtitle').textContent='Perfil 360º';dialog.removeAttribute('aria-busy');
  }
  function clear() { version++; model = null; destroyChart(); if (dialog) { dialog.close(); resetDialog(); } }
  function sourceNote(key, empty = 'Nenhum registro nesta fonte.') {
    const source = model.sources[key];
    if (source?.status === 'unlinked') return '<p class="e360-empty">Sem vínculo exato com um cadastro de ponto. Nenhuma análise foi associada automaticamente.</p>';
    if (source?.status === 'ambiguous') return '<p class="e360-warning">Vínculo ambíguo. Os registros não foram reunidos. Revise o cadastro na origem.</p>';
    if (source?.status !== 'ok') return '<p class="e360-warning">Fonte indisponível. Não é possível afirmar que não existem registros. Atualize para tentar novamente.</p>';
    return source.data.length ? '' : `<p class="e360-empty">${esc(empty)}</p>`;
  }
  function panel(title, content, note = '') { return `<section class="e360-section"><h3>${esc(title)}</h3>${note ? `<p class="e360-source">${esc(note)}</p>` : ''}${content}</section>`; }
  function details(title, content) { return `<details class="e360-entry"><summary>${esc(title)}</summary><div>${content}</div></details>`; }
  function text(value, fallback = 'Não informado') { return `<p class="e360-text">${esc(value || fallback)}</p>`; }
  function action(id, label) { return `<button type="button" class="btn-small" data-e360-action="${id}">${esc(label)}</button>`; }
  function profileURL(name) {
    const map = window.PERFIS_DOCS_MAP || {};
    if (!Object.prototype.hasOwnProperty.call(map, name)) return '';
    try { const url = new URL(map[name]); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; }
  }
  function overview() {
    const info = rows('cadastro')[0];
    const facts = info ? [['Setor atual', info.setor_atual], ['Nível', info.nivel], ['Admissão', date(info.data_admissao)], ['Aniversário',date(info.data_aniversario)], ['Salário',info.salario == null || info.salario === '' ? 'Não informado' : Number(info.salario).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})], ['Tempo de empresa', typeof getTempoEmpresa === 'function' ? getTempoEmpresa(info.data_admissao) : '—'], ['Email', info.email], ['Objetivos', info.objetivos_futuros], ['Atividades desempenhadas', info.tarefas_desempenhadas], ['Observações', info.observacoes], ['Feito relevante', info.feito_relevante === true || info.feito_relevante === 'true' ? info.feito_descricao || 'Registrado sem descrição' : 'Não registrado'], ['Ponto detrator', info.conduta_negativa === true || info.conduta_negativa === 'true' ? info.conduta_motivo || 'Registrado sem descrição' : 'Não registrado']] : [];
    const cards = [['registros','Indicadores mensais'],['avaliacoes','Avaliações'],['feedbacks','Feedbacks'],['ferias','Férias'],['ausencias','Ausências'],['ponto','Análises de ponto']];
    return `<p>Todo o histórico desta pessoa, independentemente dos filtros globais. Dados privados consultados para sua conta.</p>${pendingNotice && model.name === pendingPerson ? `<p class="e360-warning">${esc(pendingNotice)}</p>` : ''}
      <div class="e360-counters">${cards.map(([key,label]) => `<article><span>${label}</span><strong>${model.sources[key]?.status === 'ok' ? rows(key).length : '—'}</strong><small>${model.sources[key]?.status === 'ok' ? 'registros consultados' : model.sources[key]?.status === 'unlinked' ? 'sem vínculo exato de ponto' : 'fonte indisponível ou ambígua'}</small></article>`).join('')}</div>
      ${panel('Cadastro', sourceNote('cadastro', 'Cadastro ainda não encontrado no servidor. Você pode completar o cadastro pelo editor existente.') + (info ? `<dl class="e360-facts">${facts.map(([label,value]) => `<div><dt>${label}</dt><dd>${esc(value || 'Não informado')}</dd></div>`).join('')}</dl>` : '') + action('cadastro','Editar cadastro'), 'Fonte: cadastro no servidor. Alterações locais ainda não sincronizadas podem não aparecer aqui.')}
      ${panel('Acessos da pessoa', `<div class="e360-actions">${action('pdi','Abrir análise e PDI')}${profileURL(model.name) ? action('documento','Abrir documento de perfil') : ''}${action('diagnostico','Abrir diagnósticos')}${action('avaliacao','Abrir avaliações')}${action('atividades','Registrar atividade do mês')}${action('ferias','Abrir gestão de férias')}${action('ausencias','Abrir gestão de ausências')}</div><p>Os editores de cada área preservam suas regras e históricos.</p>`)}
      ${panel('Vínculos entre fontes', `<p>Cadastro e registros usam o nome completo exato: <strong>${esc(model.name)}</strong>. Variações de nome e apelidos não são unidos automaticamente.</p><p>${rows('jornadas')[0] ? `Jornada vinculada ao cadastro de ponto ${esc(rows('jornadas')[0].id)}. As análises são ligadas por esse identificador.` : 'Nenhum vínculo exato de ponto disponível. Confira Presença e ponto para distinguir ausência de cadastro e erro de leitura.'}</p><p>O Mapeamento de Time continua dependendo da confirmação explícita na análise de Perfil/PDI.</p>`)}
    `;
  }
  function development() {
    const evaluations = sourceNote('avaliacoes') + rows('avaliacoes').map(r => details(`${r.ciclo || 'Ciclo não informado'} · ${r.status || 'Status não informado'}`, `<small>${esc(date(r.updated_at || r.created_at))}</small>${text(r.observacoes_gerais)}${text(r.avaliacao_qualitativa, 'Sem avaliação qualitativa registrada')}<dl class="e360-facts">${Object.entries(r.scores || {}).map(([key,score]) => { const c = typeof COMPETENCIAS !== 'undefined' ? COMPETENCIAS.find(c => String(c.id) === key) : null; return `<div><dt>${esc(c?.nome || 'Competência ' + key)}</dt><dd>${esc(score ?? '—')}/4${text(r.observacoes_competencias?.[key], 'Sem evidência registrada')}</dd></div>`; }).join('')}</dl>`)).join('');
    const feedbacks = sourceNote('feedbacks') + rows('feedbacks').map(r => details(`${r.mes || 'Sem período'} · ${date(r.created_at)}`, `<h4>Feedback final registrado</h4>${text(r.feedback_final,'Sem feedback final registrado')}<h4>Anotações do gestor</h4>${text(r.anotacoes)}<h4>Sugestão original</h4>${text(r.sugestao_automatica,'Sem sugestão registrada')}`)).join('');
    const pdi = model.pdi;
    const plans = Array.isArray(pdi.data?.planos) ? pdi.data.planos : [];
    const mapping = pdi.data?.complemento?.mapeamento;
    const confirmed = mapping?.cadastro === model.name && mapping.confirmadoEm;
    const plansHtml = pdi.status !== 'ok' ? '<p class="e360-warning">Não foi possível ler os planos locais desta conta.</p>' : `${text(pdi.data?.complemento?.objetivo,'Objetivo complementar não informado')}<p>${confirmed ? 'Vínculo declarado no PDI: ' + esc(mapping.nome) + ' · confirmado em ' + esc(date(mapping.confirmadoEm)) + '. Revise sua atualidade na origem.' : 'Sem vínculo confirmado com o Mapeamento nesta fonte.'}</p>${plans.length ? plans.slice().reverse().map(plan => details(`Versão ${plan.versao ?? '—'} · ${plan.status || 'rascunho'} · ${date(plan.salvoEm || plan.geradoEm)}`, (Array.isArray(plan.objetivos) ? plan.objetivos : []).map(o => `<h4>${esc(o.objetivo)}</h4>${text(o.acao)}<p>Prazo: ${esc(date(o.prazo))}</p>${text(o.progresso,'Sem progresso registrado')}`).join('') + text(plan.revisoes,'Sem revisão registrada') + details('Fontes preservadas desta versão', `<pre>${esc(JSON.stringify(plan.snapshot || {}, null, 2))}</pre>`))).join('') : '<p class="e360-empty">Nenhuma versão de PDI salva para esta pessoa nesta conta e navegador.</p>'}${action('pdi','Abrir análise e PDI')}`;
    const activities = sourceNote('atividades') + rows('atividades').map(r => details(`${date(r.data)} · ${r.tipo === 'positivo' ? 'Positivo' : 'Ponto de atenção'}`,text(r.descricao))).join('');
    return panel('Avaliações', evaluations + action('avaliacao','Abrir avaliações'), 'Fonte: avaliações privadas no servidor; notas e textos originais, sem novo cálculo.') + panel('Feedbacks', feedbacks, 'Fonte: feedbacks privados no servidor.') + panel('Perfil e PDI', plansHtml, 'Fonte: versões locais da sua conta neste navegador; não sincronizadas pelo perfil 360º.') + panel('Atividades registradas',activities + action('atividades','Registrar atividade do mês'),'Fonte: atividades estruturadas privadas do gestor. Anotações comuns não são associadas por semelhança de texto.');
  }
  function attendance() {
    const employee = rows('jornadas')[0];
    const days = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    const schedule = sourceNote('jornadas','Sem cadastro de ponto com este nome completo exato.') + (employee ? `<p>Cadastro: ${esc(employee.nome)} · ${employee.ativo ? 'Ativo' : 'Inativo'}</p>${(employee.ponto_jornadas || []).map(j => `<p>${esc(days[j.dia_semana])}: ${j.trabalha ? ['entrada_1','saida_1','entrada_2','saida_2'].map(key => esc(j[key]?.slice(0,5) || '—')).join(' · ') : 'Folga'}</p>`).join('')}` : '');
    const imports = sourceNote('ponto','Nenhuma análise vinculada a este cadastro de ponto.') + rows('ponto').map((r,i) => details(`${date(r.periodo_inicio)} a ${date(r.periodo_fim)}`, `<p>Importada em ${esc(date(r.data_importacao))}. A análise e as regras originais continuam preservadas.</p>${action('ponto-'+i,'Abrir análise original')}`)).join('');
    return panel('Férias',sourceNote('ferias') + rows('ferias').map(r => `<article class="e360-entry">${esc(date(r.data_inicio))} a ${esc(date(r.data_fim))}</article>`).join('') + action('ferias','Abrir gestão de férias'),'Fonte: períodos registrados no servidor; nenhuma ausência é inferida do ponto.') + panel('Ausências',sourceNote('ausencias') + rows('ausencias').map(r => details(`${date(r.data)} · ${r.periodo || 'Período não informado'}`,text(r.motivo))).join('') + action('ausencias','Abrir gestão de ausências'),'Fonte: ausências registradas no servidor.') + panel('Jornada',schedule + (model.sources.jornadas.status === 'ok' ? action('jornada','Abrir cadastro de jornada') : ''),'Fonte: cadastro exato de ponto. Horários e status originais.') + panel('Análises de ponto',imports,'Fonte: análises ligadas pelo identificador do cadastro, sem recalcular resultados.');
  }
  function history() {
    const labels = {cadastro:'Cadastro',registros:'Indicadores',avaliacoes:'Avaliações',feedbacks:'Feedbacks',ferias:'Férias',ausencias:'Ausências',bonus:'Bônus / penalidades',historico:'Histórico compartilhado de dados',atividades:'Atividades',jornadas:'Cadastro de ponto',ponto:'Análises de ponto'};
    return panel('Situação das fontes',`<ul>${Object.entries(labels).map(([key,label]) => `<li>${label}: <strong>${model.sources[key].status === 'ok' ? rows(key).length + ' registro(s) consultado(s)' : model.sources[key].status === 'ambiguous' ? 'vínculo ambíguo; dados não reunidos' : model.sources[key].status === 'unlinked' ? 'sem vínculo exato' : 'indisponível'}</strong></li>`).join('')}<li>PDI: ${model.pdi.status === 'ok' ? 'armazenamento local da conta' : 'indisponível'}</li></ul><p>Consulta: ${esc(date(model.loadedAt))}. Dados indisponíveis não são tratados como zero. O histórico compartilhado respeita as permissões já existentes no servidor.</p>`) + panel('Linha do tempo', model.events.length ? `<ol class="e360-timeline">${model.events.map(e => `<li><span>${esc(e.source)} · ${esc(date(e.date))}</span><strong>${esc(e.title)}</strong>${text(e.text,'Sem descrição')}</li>`).join('')}</ol>` : '<p class="e360-empty">Nenhum evento nas fontes consultadas. Confira a situação das fontes acima.</p>', 'Ordem pela data registrada em cada fonte; datas de férias/ausências são datas do período, não necessariamente da criação.');
  }
  function bindActions() {
    dialog.querySelectorAll('[data-e360-action]').forEach(button => button.addEventListener('click', () => {
      if (!allowed() || allowed().id !== model?.owner) { clear(); return; }
      const name = model.name, owner = model.owner, id = button.dataset.e360Action;
      if (id === 'cadastro') {
        editing = { name, owner }; dialog.close();
        openColabDetailOverlay(name);
        const form = document.getElementById('colabInfoForm'); let dirty = false;
        form?.addEventListener('input', () => dirty = true);
        const back = document.createElement('button');back.type='button';back.className='btn-small';back.textContent='Voltar ao perfil 360º';
        back.onclick=()=>{if(dirty && !confirm('Descartar alterações não salvas e voltar ao perfil?'))return;editing=null;closeColabDetail();open(name);};
        document.getElementById('colabDetailContent')?.prepend(back);
        return;
      }
      const actions = {documento:()=>{const url=profileURL(name);if(url)window.open(url,'_blank','noopener,noreferrer');},diagnostico:()=>document.querySelector('[data-tab="insights"]')?.click(),pdi:()=>window.openPerfilPdi?.(name),avaliacao:()=>document.querySelector('[data-tab="avaliacao"]')?.click(),atividades:()=>{if(typeof AtividadesMes!=='undefined')AtividadesMes.openPerson(name);},ferias:()=>window.openFeriasOverlay?.(),ausencias:()=>window.openAusenciasOverlay?.(),jornada:()=>window.openPontoEmployee?.(name,true)};
      if (id.startsWith('ponto-')) { const row=rows('ponto')[Number(id.slice(6))];dialog.close();window.openPontoAnalysis?.(row.id);return; }
      dialog.close();actions[id]?.();
    }));
  }
  function render() {
    if (!model || !allowed() || model.owner !== allowed().id) { clear(); return; }
    destroyChart();
    const info = rows('cadastro')[0];
    dialog.querySelector('#e360Title').textContent = model.name;
    dialog.querySelector('#e360Subtitle').textContent = [info?.setor_atual, info?.nivel, 'Perfil 360º'].filter(Boolean).join(' · ');
    dialog.querySelector('#e360Tabs').innerHTML = tabs.map(([key,label]) => `<button type="button" role="tab" id="e360Tab-${key}" data-e360-tab="${key}" aria-controls="e360Body" aria-selected="${key===selected}" tabindex="${key===selected?0:-1}">${label}</button>`).join('');
    const body=dialog.querySelector('#e360Body');body.setAttribute('aria-labelledby','e360Tab-'+selected);
    if(selected==='desempenho') {
      body.innerHTML=sourceNote('registros','Não há indicadores sincronizados para esta pessoa. O cadastro continua disponível nas outras seções.');
      if(rows('registros').length && typeof window.renderColabPerformance==='function') window.renderColabPerformance(model.name,body,rows('registros'),info||{});
    } else body.innerHTML=selected==='resumo'?overview():selected==='desenvolvimento'?development():selected==='presenca'?attendance():history();
    bindActions();
    dialog.scrollTop=0;
    dialog.querySelectorAll('[data-e360-tab]').forEach(button=>button.onclick=()=>{selected=button.dataset.e360Tab;render();dialog.querySelector('#e360Tab-'+selected).focus();});
  }
  function ensureDialog() {
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='equipe360Dialog';dialog.setAttribute('aria-labelledby','e360Title');
    dialog.innerHTML='<header class="e360-heading"><div><span id="e360Subtitle">Perfil 360º</span><h2 id="e360Title"></h2></div><div class="e360-actions"><button type="button" class="btn-small" id="e360Refresh">Atualizar fontes</button><button type="button" class="btn-small" id="e360Hide">Ocultar dados</button><button type="button" class="btn-small" id="e360Close">Fechar</button></div></header><nav id="e360Tabs" role="tablist" aria-label="Seções da pessoa"></nav><div id="e360Body" role="tabpanel" tabindex="0"></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('#e360Close').onclick=()=>dialog.close();
    dialog.querySelector('#e360Hide').onclick=()=>{clear();document.getElementById('privacyScreenToggle')?.click();};
    dialog.querySelector('#e360Refresh').onclick=()=>{if(model)open(model.name,selected);};
    dialog.addEventListener('close',()=>{if(dialog.open)return;version++;model=null;destroyChart();resetDialog();focusBefore?.focus();});
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
    dialog.addEventListener('keydown',event=>{
      if(!event.target.closest('[data-e360-tab]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const index=tabs.findIndex(([key])=>key===selected);selected=tabs[event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length][0];render();dialog.querySelector('#e360Tab-'+selected).focus();
    });
  }
  async function open(name, section='resumo') {
    const user=allowed();if(!user)return false;
    ensureDialog();sessionOwner=user.id;const request=++version;model=null;selected=tabs.some(([key])=>key===section)?section:'resumo';
    if(!dialog.open){focusBefore=document.activeElement;dialog.showModal();}
    dialog.querySelector('#e360Title').textContent=name;
    dialog.querySelector('#e360Tabs').replaceChildren();
    dialog.querySelector('#e360Body').textContent='Consultando as fontes desta pessoa…';
    dialog.setAttribute('aria-busy','true');
    try {
      const loaded=await window.Equipe360Data.create({client:sbClient,storage:localStorage}).load(name,user.id);
      if(request!==version||!dialog.open||allowed()?.id!==loaded.owner)return false;
      model=loaded;render();return true;
    }catch(_){if(request===version&&dialog.open)dialog.querySelector('#e360Body').innerHTML='<p class="e360-warning">Não foi possível validar a sessão ou consultar o perfil. Nenhum dado privado de cache compartilhado foi usado. Feche e tente novamente.</p>';return false;}
    finally{if(request===version)dialog.removeAttribute('aria-busy');}
  }
  const oldOpen=window.openColabDetail;
  window.openColabDetail=function(name){return document.body.dataset.role==='admin'?open(name):oldOpen?.(name);};
  window.openEquipe360=open;
  new MutationObserver(()=>{if(!allowed()){editing=null;pendingNotice='';clear();}}).observe(document.body,{attributes:true,attributeFilter:['data-role','class']});
  document.addEventListener('app-role-ready',()=>{editing=null;pendingNotice='';clear();});
  window.addEventListener('colab-profile-saved',event=>{
    if(!editing||editing.name!==event.detail.name||allowed()?.id!==editing.owner)return;
    const name=editing.name;editing=null;pendingPerson=name;pendingNotice=event.detail.synced?'':'Há alterações de cadastro preservadas neste navegador com sincronização pendente. Este perfil mostra os dados confirmados no servidor.';open(name);
  });
  document.addEventListener('DOMContentLoaded',()=>{
    if(typeof sbClient!=='undefined'&&sbClient)sbClient.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'||session?.user?.id!==sessionOwner||session?.user?.app_metadata?.role!=='admin'){editing=null;pendingNotice='';clear();}
    });
  });
})();
