// Editor de metas e indicadores personalizados. Persiste na configuração existente por usuário.
(function () {
  'use strict';
  const esc = v => typeof escapeHtmlShared === 'function' ? escapeHtmlShared(String(v ?? '')) : escapeHtml(String(v ?? ''));
  const defaults = new Set(['score_baixo','queda_20','meta_nao_atingida','consecutivo_abaixo','transferencia_alta','produtividade_baixa']);
  const definitions = {
    score_baixo:{label:'Score mínimo',formula:'Média dos valores de SCORE no recorte.',help:'Dispara quando o score médio ficar abaixo deste valor.',min:0,max:5,step:.05,unit:'pontos',read:c=>c.valor,write:(c,v)=>c.valor=v},
    queda_20:{label:'Queda máxima de finalizações',formula:'(Período anterior − atual) ÷ anterior.',help:'Compara as finalizações dos dois períodos mais recentes.',min:1,max:100,step:1,unit:'%',read:c=>c.valor,write:(c,v)=>c.valor=v},
    consecutivo_abaixo:{label:'Score de referência',formula:'Score médio de cada período por atendente.',help:'Dispara após uma sequência abaixo do limite.',min:0,max:5,step:.05,unit:'pontos',read:c=>c.valor,write:(c,v)=>c.valor=v,periods:true},
    transferencia_alta:{label:'Taxa máxima de transferência',formula:'Transferidos ÷ Assumidos × 100.',help:'Dispara acima deste percentual.',min:0,max:100,step:1,unit:'%',read:c=>c.valor*100,write:(c,v)=>c.valor=v/100},
    produtividade_baixa:{label:'Produtividade mínima',formula:'Finalizados ÷ Assumidos × 100.',help:'Dispara abaixo deste percentual.',min:0,max:100,step:1,unit:'%',read:c=>c.valor*100,write:(c,v)=>c.valor=v/100}
  };
  const metricInfo = {
    score:['Score médio','Média de SCORE','pontos',0,5,.05], produtividade:['Produtividade','Finalizados ÷ Assumidos × 100','%',0,100,1],
    transferencia:['Taxa de transferência','Transferidos ÷ Assumidos × 100','%',0,100,1], finalizacoes:['Finalizações','Soma de Finalizados','itens',0,100000,1],
    assumidos:['Assumidos','Soma de Assumidos','itens',0,100000,1], tma:['TMA','Média do tempo de atendimento','minutos',0,100000,1], tmr:['TMR','Média do tempo de resposta','minutos',0,100000,1]
  };
  function summary(c) {
    if(c.custom){const m=metricInfo[c.campo]||[c.campo],op=c.operador==='<'?'abaixo de':c.operador==='>'?'acima de':'queda de';return `${m[0]} ${op} ${Number(c.valor).toLocaleString('pt-BR')} ${m[2]||''}`;}
    if(c.id==='score_baixo')return `Abaixo de ${Number(c.valor).toFixed(2)} pontos`;
    if(c.id==='queda_20')return `Queda igual ou superior a ${Number(c.valor).toFixed(0)}%`;
    if(c.id==='meta_nao_atingida')return 'Usa o Objetivo importado em cada registro';
    if(c.id==='consecutivo_abaixo')return `${Number(c.periodos)||2}+ períodos abaixo de ${Number(c.valor).toFixed(2)}`;
    if(c.id==='transferencia_alta')return `Acima de ${(Number(c.valor)*100).toFixed(0)}%`;
    if(c.id==='produtividade_baixa')return `Abaixo de ${(Number(c.valor)*100).toFixed(0)}%`;
    return c.desc||'';
  }
  function customCard(c) {
    const m=metricInfo[c.campo]||metricInfo.score;
    return `<article class="ag-card ag-custom ${c.ativo?'':'ag-disabled'}" data-card-id="${esc(c.id)}"><header><label class="ag-switch"><input type="checkbox" class="alerta-toggle" data-id="${esc(c.id)}" ${c.ativo?'checked':''}><span>${esc(c.icone||'🔔')}</span></label><div><strong>${esc(c.name)}</strong><small>${esc(summary(c))}</small></div><button class="btn-small ag-delete" data-id="${esc(c.id)}" type="button" title="Remover indicador">Remover</button></header>
      <div class="ag-text-fields"><label class="field"><span>Nome do indicador</span><input class="ag-name" data-id="${esc(c.id)}" maxlength="80" value="${esc(c.name)}"></label><label class="field"><span>Descrição</span><textarea class="ag-desc" data-id="${esc(c.id)}" maxlength="240" rows="2">${esc(c.desc||'')}</textarea></label></div>
      <div class="ag-fields"><label class="field"><span>Métrica</span><select class="ag-custom-metric" data-id="${esc(c.id)}">${Object.entries(metricInfo).map(([id,x])=>`<option value="${id}" ${c.campo===id?'selected':''}>${x[0]}</option>`).join('')}</select></label><label class="field"><span>Condição</span><select class="ag-custom-op" data-id="${esc(c.id)}"><option value="<" ${c.operador==='<'?'selected':''}>Abaixo de</option><option value=">" ${c.operador==='>'?'selected':''}>Acima de</option><option value="queda_pct" ${c.operador==='queda_pct'?'selected':''}>Queda percentual</option></select></label><label class="field"><span>Limite</span><div class="ag-input"><input class="ag-custom-value" data-id="${esc(c.id)}" type="number" min="${m[3]}" max="${m[4]}" step="${m[5]}" value="${Number(c.valor)}"><b>${m[2]}</b></div></label><label class="field"><span>Gravidade</span><select class="ag-custom-severity" data-id="${esc(c.id)}"><option value="media" ${c.gravidade!=='alta'?'selected':''}>Atenção</option><option value="alta" ${c.gravidade==='alta'?'selected':''}>Crítico</option></select></label></div><p><b>Fórmula:</b> ${esc(m[1])}. A queda percentual compara os dois períodos mais recentes.</p></article>`;
  }
  function defaultCard(c) {
    const d=definitions[c.id];
    return `<article class="ag-card ${c.ativo?'':'ag-disabled'}" data-card-id="${esc(c.id)}"><header><label class="ag-switch"><input type="checkbox" class="alerta-toggle" data-id="${esc(c.id)}" ${c.ativo?'checked':''}><span>${c.icone}</span></label><div><strong>${esc(c.name)}</strong><small>${esc(summary(c))}</small></div><span class="ag-protected">Padrão</span></header><div class="ag-text-fields"><label class="field"><span>Nome exibido</span><input class="ag-name" data-id="${esc(c.id)}" maxlength="80" value="${esc(c.name)}"></label><label class="field"><span>Descrição</span><textarea class="ag-desc" data-id="${esc(c.id)}" maxlength="240" rows="2">${esc(c.desc||'')}</textarea></label></div>${d?`<div class="ag-fields"><label class="field"><span>${esc(d.label)}</span><div class="ag-input"><input class="alert-goal-input" data-id="${esc(c.id)}" type="number" min="${d.min}" max="${d.max}" step="${d.step}" value="${d.read(c)}"><b>${d.unit}</b></div></label>${d.periods?`<label class="field"><span>Períodos consecutivos</span><div class="ag-input"><input class="alert-period-input" data-id="${esc(c.id)}" type="number" min="1" max="12" value="${Number(c.periodos)||2}"><b>períodos</b></div></label>`:''}</div><p><b>Fórmula:</b> ${esc(d.formula)} ${esc(d.help)}</p>`:`<div class="ag-imported"><b>Meta vinculada aos dados</b><span>Compara Finalizados com o campo Objetivo de cada atendente. A meta é editada na fonte importada.</span></div>`}</article>`;
  }
  function collect(container) {
    let invalid=false;
    container.querySelectorAll('.ag-name').forEach(input=>{const c=alertasConfig.find(x=>x.id===input.dataset.id);if(!c||!input.value.trim()){input.setAttribute('aria-invalid','true');invalid=true;}else{input.removeAttribute('aria-invalid');c.name=input.value.trim();}});
    container.querySelectorAll('.ag-desc').forEach(input=>{const c=alertasConfig.find(x=>x.id===input.dataset.id);if(c)c.desc=input.value.trim();});
    container.querySelectorAll('.alert-goal-input').forEach(input=>{const v=Number(input.value),d=definitions[input.dataset.id],c=alertasConfig.find(x=>x.id===input.dataset.id);if(!d||!c||!Number.isFinite(v)||v<d.min||v>d.max){input.setAttribute('aria-invalid','true');invalid=true;}else{input.removeAttribute('aria-invalid');d.write(c,v);}});
    container.querySelectorAll('.alert-period-input').forEach(input=>{const v=Number(input.value),c=alertasConfig.find(x=>x.id===input.dataset.id);if(!c||!Number.isInteger(v)||v<1||v>12){input.setAttribute('aria-invalid','true');invalid=true;}else{input.removeAttribute('aria-invalid');c.periodos=v;}});
    container.querySelectorAll('.ag-custom-metric').forEach(input=>{const c=alertasConfig.find(x=>x.id===input.dataset.id);if(c)c.campo=input.value;});
    container.querySelectorAll('.ag-custom-op').forEach(input=>{const c=alertasConfig.find(x=>x.id===input.dataset.id);if(c)c.operador=input.value;});
    container.querySelectorAll('.ag-custom-severity').forEach(input=>{const c=alertasConfig.find(x=>x.id===input.dataset.id);if(c)c.gravidade=input.value;});
    container.querySelectorAll('.ag-custom-value').forEach(input=>{const c=alertasConfig.find(x=>x.id===input.dataset.id),m=metricInfo[c?.campo],v=Number(input.value);if(!c||!m||!Number.isFinite(v)||v<m[3]||v>m[4]){input.setAttribute('aria-invalid','true');invalid=true;}else{input.removeAttribute('aria-invalid');c.valor=v;}});
    return !invalid;
  }
  function renderEditor() {
    const container=document.getElementById('alertasContent');if(!container)return;if(!alertasConfig.length)loadAlertasConfig();const fired=verificarAlertas();
    container.innerHTML=`<div class="ag-toolbar"><div><strong>Metas, limites e descrições</strong><span>Edite as regras padrão ou crie indicadores próprios. As alterações valem para o seu usuário.</span></div><div><button class="btn-small" id="agAdd" type="button">+ Adicionar indicador</button><button class="btn-primary" id="alertGoalsSave" type="button">Salvar alterações</button></div></div><div class="ag-grid">${alertasConfig.map(c=>c.custom?customCard(c):defaultCard(c)).join('')}</div>
      <div class="ag-active-title"><div><strong>Alertas ativos</strong><span>${fired.length} ocorrência${fired.length===1?'':'s'} no recorte dos filtros</span></div></div>${fired.length?`<div class="ag-fired">${fired.map(a=>`<article class="${a.gravidade==='alta'?'ag-critical':'ag-warning'}"><span>${a.config.icone}</span><div><strong>${esc(a.config.name)}</strong><p>${esc(a.mensagem)}</p></div><b>${a.gravidade==='alta'?'Crítico':'Atenção'}</b></article>`).join('')}</div>`:(window.rawRecords&&rawRecords.length?'<div class="ag-clear">✓ Nenhum alerta disparado com as regras atuais.</div>':'<div class="empty-state"><div class="empty-title">Sem dados</div></div>')}`;
    container.querySelectorAll('.alerta-toggle').forEach(x=>x.addEventListener('change',e=>{if(!requireAdmin()){e.target.checked=!e.target.checked;return;}const c=alertasConfig.find(a=>a.id===e.target.dataset.id);if(c){c.ativo=e.target.checked;saveAlertasConfig();renderEditor();}}));
    document.getElementById('agAdd')?.addEventListener('click',()=>{if(!requireAdmin())return;alertasConfig.push({id:`custom_${Date.now().toString(36)}`,custom:true,name:'Novo indicador',desc:'Descreva o que este alerta acompanha.',icone:'🔔',campo:'score',operador:'<',valor:4,gravidade:'media',ativo:true});saveAlertasConfig();renderEditor();document.querySelector('.ag-custom:last-of-type')?.scrollIntoView({behavior:'smooth',block:'center'});});
    container.querySelectorAll('.ag-delete').forEach(x=>x.addEventListener('click',()=>{if(!requireAdmin())return;const c=alertasConfig.find(a=>a.id===x.dataset.id);if(!c||defaults.has(c.id)||!confirm(`Remover o indicador “${c.name}”?`))return;alertasConfig=alertasConfig.filter(a=>a.id!==c.id);saveAlertasConfig();renderEditor();}));
    container.querySelectorAll('.ag-custom-metric').forEach(x=>x.addEventListener('change',()=>{if(collect(container))renderEditor();}));
    document.getElementById('alertGoalsSave')?.addEventListener('click',()=>{if(!requireAdmin())return;if(!collect(container)){showToast('Revise os campos destacados.','error','Indicadores');return;}saveAlertasConfig();showToast('Indicadores e descrições atualizados.','success','Alertas');renderEditor();});
  }
  window.renderAlertas=renderEditor;
})();
